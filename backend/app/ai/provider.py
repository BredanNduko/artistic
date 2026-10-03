"""The AI boundary: Frontend -> this API -> provider. The API key never leaves the server.

Everything model-facing goes through `AIProvider.run_tool`: the model is forced to
answer by calling one tool with a JSON schema, so we get structured output rather
than free text to parse. Swap providers by implementing the same method.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

import anthropic
import httpx
from fastapi import HTTPException
from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types

from ..config import get_settings

log = logging.getLogger("designforge.ai")


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    schema: dict


@dataclass
class ToolResult:
    data: dict
    model: str
    input_tokens: int = 0
    output_tokens: int = 0


class AIProviderError(Exception):
    """Carries a message that is safe to show users (never raw provider text)."""

    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


class AIProvider(Protocol):
    def run_tool(self, *, model: str, system: str, user: str, tool: ToolSpec, max_tokens: int) -> ToolResult: ...


class AnthropicProvider:
    def __init__(self, api_key: str, timeout: float) -> None:
        self.client = anthropic.Anthropic(api_key=api_key, timeout=timeout, max_retries=2)

    def run_tool(self, *, model: str, system: str, user: str, tool: ToolSpec, max_tokens: int) -> ToolResult:
        try:
            response = self.client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
                tools=[{"name": tool.name, "description": tool.description, "input_schema": tool.schema}],
                tool_choice={"type": "tool", "name": tool.name},
            )
        except anthropic.RateLimitError as exc:
            log.warning("provider rate limited: %s", exc)
            raise AIProviderError(503, "The AI service is busy. Please try again in a moment.") from exc
        except anthropic.APITimeoutError as exc:
            raise AIProviderError(504, "The AI service took too long to respond. Please try again.") from exc
        except anthropic.APIConnectionError as exc:
            log.error("provider connection error: %s", exc)
            raise AIProviderError(502, "Could not reach the AI service.") from exc
        except (anthropic.AuthenticationError, anthropic.PermissionDeniedError) as exc:
            log.error("provider rejected our credentials: %s", exc)
            raise AIProviderError(502, "The AI service is not configured correctly.") from exc
        except anthropic.APIStatusError as exc:
            log.error("provider error %s: %s", exc.status_code, exc)
            code = 503 if exc.status_code in (429, 500, 502, 503, 529) else 502
            raise AIProviderError(code, "The AI service returned an error. Please try again.") from exc

        if response.stop_reason == "max_tokens":
            raise AIProviderError(502, "The AI response was cut off. Try a simpler request.")
        block = next((b for b in response.content if getattr(b, "type", "") == "tool_use"), None)
        if block is None or not isinstance(block.input, dict):
            raise AIProviderError(502, "The AI service returned an unexpected response.")
        usage = getattr(response, "usage", None)
        return ToolResult(
            data=block.input,
            model=model,
            input_tokens=getattr(usage, "input_tokens", 0) or 0,
            output_tokens=getattr(usage, "output_tokens", 0) or 0,
        )


@lru_cache
def _anthropic(api_key: str, timeout: float) -> AnthropicProvider:
    return AnthropicProvider(api_key, timeout)


# Gemini statuses that mean "try again shortly", mapped to the same 503 the
# Anthropic path returns for rate limits and upstream outages.
_GEMINI_RETRY_STATUSES = frozenset({"RESOURCE_EXHAUSTED", "UNAVAILABLE", "INTERNAL", "DEADLINE_EXCEEDED"})


class GeminiProvider:
    """Google Gemini behind the same forced-tool-call contract.

    Anthropic's `tool_choice={"type": "tool"}` has no direct spelling here; the
    equivalent is `FunctionCallingConfig(mode="ANY")`, which constrains the model
    to emit a function call instead of prose. `parameters_json_schema` takes a
    raw JSON Schema, so ToolSpec.schema passes through unchanged.
    """

    def __init__(self, api_key: str, timeout: float) -> None:
        self.client = genai.Client(api_key=api_key, http_options={"timeout": int(timeout * 1000)})

    def run_tool(self, *, model: str, system: str, user: str, tool: ToolSpec, max_tokens: int) -> ToolResult:
        declaration = genai_types.FunctionDeclaration(
            name=tool.name,
            description=tool.description,
            parameters_json_schema=tool.schema,
        )
        config = genai_types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=max_tokens,
            tools=[genai_types.Tool(function_declarations=[declaration])],
            tool_config=genai_types.ToolConfig(
                function_calling_config=genai_types.FunctionCallingConfig(
                    mode=genai_types.FunctionCallingConfigMode.ANY,
                    allowed_function_names=[tool.name],
                )
            ),
        )
        try:
            response = self.client.models.generate_content(model=model, contents=user, config=config)
        except httpx.TimeoutException as exc:
            raise AIProviderError(504, "The AI service took too long to respond. Please try again.") from exc
        except httpx.TransportError as exc:
            log.error("gemini connection error: %s", exc)
            raise AIProviderError(502, "Could not reach the AI service.") from exc
        except genai_errors.ClientError as exc:
            if exc.code in (401, 403):
                log.error("gemini rejected our credentials (code %s)", exc.code)
                raise AIProviderError(502, "The AI service is not configured correctly.") from exc
            if exc.status in _GEMINI_RETRY_STATUSES or exc.code == 429:
                log.warning("gemini throttled: code %s status %s", exc.code, exc.status)
                raise AIProviderError(503, "The AI service is busy. Please try again in a moment.") from exc
            log.error("gemini client error %s: %s", exc.code, exc)
            raise AIProviderError(502, "The AI service returned an error. Please try again.") from exc
        except genai_errors.APIError as exc:
            log.error("gemini error %s: %s", exc.code, exc)
            if exc.status in _GEMINI_RETRY_STATUSES or (exc.code or 0) >= 500:
                raise AIProviderError(503, "The AI service is busy. Please try again in a moment.") from exc
            raise AIProviderError(502, "The AI service returned an error. Please try again.") from exc

        candidates = getattr(response, "candidates", None) or []
        finish_reason = getattr(candidates[0], "finish_reason", None) if candidates else None
        # Truncation and safety refusals both arrive with no function call, so they
        # are checked before the generic "unexpected response" case to keep the
        # message honest about what went wrong.
        if finish_reason is not None and str(finish_reason).endswith("MAX_TOKENS"):
            raise AIProviderError(502, "The AI response was cut off. Try a simpler request.")
        block_reason = getattr(getattr(response, "prompt_feedback", None), "block_reason", None)
        if block_reason:
            log.info("gemini blocked the prompt: %s", block_reason)
            raise AIProviderError(422, "The AI declined that request. Try different wording.")

        # Thinking models emit thought parts before the call, so scan rather than
        # indexing into the part list.
        call = None
        for candidate in candidates:
            for part in getattr(getattr(candidate, "content", None), "parts", None) or []:
                if getattr(part, "function_call", None) is not None:
                    call = part.function_call
                    break
            if call is not None:
                break
        if call is None or not isinstance(call.args, dict):
            raise AIProviderError(502, "The AI service returned an unexpected response.")

        usage = getattr(response, "usage_metadata", None)
        # Gemini reports output tokens as candidates_token_count. response_token_count
        # exists on the model but is never populated from the wire, so reading it
        # silently records zero usage against the per-day quota.
        output_tokens = getattr(usage, "candidates_token_count", None)
        if output_tokens is None:
            output_tokens = getattr(usage, "response_token_count", 0)
        return ToolResult(
            data=call.args,
            model=model,
            input_tokens=getattr(usage, "prompt_token_count", 0) or 0,
            output_tokens=output_tokens or 0,
        )


@lru_cache
def _gemini(api_key: str, timeout: float) -> GeminiProvider:
    return GeminiProvider(api_key, timeout)


def get_provider() -> AIProvider:
    """FastAPI dependency. Tests override it with a fake."""
    s = get_settings()
    key = s.provider_api_key()
    if not key:
        raise HTTPException(503, "AI is not configured on this server.")
    if s.ai_provider == "gemini":
        return _gemini(key, s.ai_timeout_seconds)
    return _anthropic(key, s.ai_timeout_seconds)
