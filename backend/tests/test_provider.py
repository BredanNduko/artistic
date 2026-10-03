from types import SimpleNamespace

import anthropic
import httpx
import pytest

from app.ai.provider import AIProviderError, AnthropicProvider
from app.ai.tools import SUBMIT_COPY


def _resp(status):
    return httpx.Response(status, request=httpx.Request("POST", "https://api.anthropic.com/v1/messages"))


def provider_with(create):
    p = AnthropicProvider("sk-ant-test", timeout=5)
    p.client = SimpleNamespace(messages=SimpleNamespace(create=create))
    return p


def message(blocks, stop="tool_use"):
    return SimpleNamespace(content=blocks, stop_reason=stop, usage=SimpleNamespace(input_tokens=11, output_tokens=7))


def call(p):
    return p.run_tool(model="m", system="s", user="u", tool=SUBMIT_COPY, max_tokens=100)


def test_forces_the_tool_and_parses_the_result():
    seen = {}

    def create(**kw):
        seen.update(kw)
        return message([SimpleNamespace(type="text", text="thinking"), SimpleNamespace(type="tool_use", input={"variants": ["a"]})])

    r = call(provider_with(create))
    assert r.data == {"variants": ["a"]} and (r.input_tokens, r.output_tokens) == (11, 7)
    assert seen["tool_choice"] == {"type": "tool", "name": "submit_copy"}
    assert seen["tools"][0]["input_schema"] == SUBMIT_COPY.schema and seen["model"] == "m" and seen["max_tokens"] == 100


@pytest.mark.parametrize("exc,status", [
    (anthropic.RateLimitError("secret details", response=_resp(429), body=None), 503),
    (anthropic.InternalServerError("secret details", response=_resp(529), body=None), 503),
    (anthropic.AuthenticationError("sk-ant-LEAKED", response=_resp(401), body=None), 502),
    (anthropic.BadRequestError("secret details", response=_resp(400), body=None), 502),
    (anthropic.APITimeoutError(request=httpx.Request("POST", "https://x")), 504),
    (anthropic.APIConnectionError(request=httpx.Request("POST", "https://x")), 502),
])
def test_provider_errors_map_to_safe_messages(exc, status):
    def create(**kw):
        raise exc

    with pytest.raises(AIProviderError) as info:
        call(provider_with(create))
    assert info.value.status == status
    assert "secret" not in info.value.message and "LEAKED" not in info.value.message


def test_truncated_or_tool_less_responses_are_errors():
    with pytest.raises(AIProviderError):
        call(provider_with(lambda **kw: message([SimpleNamespace(type="tool_use", input={})], stop="max_tokens")))
    with pytest.raises(AIProviderError):
        call(provider_with(lambda **kw: message([SimpleNamespace(type="text", text="no tool")], stop="end_turn")))
