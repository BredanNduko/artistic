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
from fastapi import HTTPException

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


def get_provider() -> AIProvider:
    """FastAPI dependency. Tests override it with a fake."""
    s = get_settings()
    if not s.anthropic_api_key:
        raise HTTPException(503, "AI is not configured on this server.")
    return _anthropic(s.anthropic_api_key, s.ai_timeout_seconds)
