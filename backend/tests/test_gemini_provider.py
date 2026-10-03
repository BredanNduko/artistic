"""GeminiProvider against mocked google-genai responses. No network, no API key."""

from types import SimpleNamespace

import httpx
import pytest
from google.genai import errors as genai_errors

from app.ai.provider import AIProviderError, GeminiProvider
from app.ai.tools import SUBMIT_COPY


def provider_with(create):
    p = GeminiProvider("test-key", timeout=5)
    p.client = SimpleNamespace(models=SimpleNamespace(generate_content=create))
    return p


def part(**kw):
    return SimpleNamespace(function_call=SimpleNamespace(args=kw.pop("args"), name="submit_copy", **kw), text=None, thought=None)


def response(parts, finish="STOP", usage=(11, 7), block=None):
    candidate = SimpleNamespace(content=SimpleNamespace(parts=parts), finish_reason=finish)
    return SimpleNamespace(
        candidates=[candidate],
        usage_metadata=SimpleNamespace(prompt_token_count=usage[0], response_token_count=usage[1]),
        prompt_feedback=SimpleNamespace(block_reason=block),
    )


def call(p):
    return p.run_tool(model="m", system="s", user="u", tool=SUBMIT_COPY, max_tokens=100)


def test_forces_the_tool_and_parses_the_result():
    seen = {}

    def create(**kw):
        seen.update(kw)
        return response([part(args={"variants": ["a"]})])

    r = call(provider_with(create))
    assert r.data == {"variants": ["a"]} and (r.input_tokens, r.output_tokens) == (11, 7)
    assert seen["model"] == "m" and seen["contents"] == "u"

    config = seen["config"]
    assert config.system_instruction == "s" and config.max_output_tokens == 100

    (decl,) = config.tools[0].function_declarations
    assert decl.name == SUBMIT_COPY.name and decl.description == SUBMIT_COPY.description
    # The raw JSON Schema must survive untouched: build.py/ops.py are the real validators.
    assert decl.parameters_json_schema == SUBMIT_COPY.schema

    fcc = config.tool_config.function_calling_config
    assert fcc.mode == "ANY" and list(fcc.allowed_function_names) == [SUBMIT_COPY.name]


def test_thought_parts_before_the_call_are_skipped():
    """Thinking models emit thought parts first, so the call cannot be at index 0."""
    call_part = part(args={"variants": ["b"]})
    parts = [
        SimpleNamespace(function_call=None, text=None, thought=True),
        SimpleNamespace(function_call=None, text="planning", thought=None),
        call_part,
    ]
    assert call(provider_with(lambda **kw: response(parts))).data == {"variants": ["b"]}


def _err(cls, code, status):
    return cls(code=code, response_json={"error": {"message": "secret provider detail", "status": status}})


@pytest.mark.parametrize("exc,status", [
    (_err(genai_errors.ClientError, 429, "RESOURCE_EXHAUSTED"), 503),
    (_err(genai_errors.ServerError, 503, "UNAVAILABLE"), 503),
    (_err(genai_errors.ServerError, 500, "INTERNAL"), 503),
    (_err(genai_errors.ClientError, 400, "INVALID_ARGUMENT"), 502),
    (_err(genai_errors.ClientError, 404, "NOT_FOUND"), 502),
    (httpx.ReadTimeout("timed out", request=httpx.Request("POST", "https://x")), 504),
    (httpx.ConnectError("refused", request=httpx.Request("POST", "https://x")), 502),
])
def test_provider_errors_map_to_safe_messages(exc, status):
    def create(**kw):
        raise exc

    with pytest.raises(AIProviderError) as info:
        call(provider_with(create))
    assert info.value.status == status
    # Raw provider text must never reach the browser.
    assert "secret" not in info.value.message


@pytest.mark.parametrize("code", [401, 403])
def test_rejected_credentials_read_as_a_config_problem(code):
    """A bad key is a setup mistake, not an outage, so it must not say "busy"."""
    exc = _err(genai_errors.ClientError, code, "UNAUTHENTICATED")

    def create(**kw):
        raise exc

    with pytest.raises(AIProviderError) as info:
        call(provider_with(create))
    assert info.value.status == 502
    assert "not configured correctly" in info.value.message


def test_truncated_response_is_reported_as_truncated():
    with pytest.raises(AIProviderError) as info:
        call(provider_with(lambda **kw: response([part(args={})], finish="MAX_TOKENS")))
    assert "cut off" in info.value.message


def test_safety_block_is_reported_as_a_refusal():
    with pytest.raises(AIProviderError) as info:
        call(provider_with(lambda **kw: response([], block="SAFETY")))
    assert info.value.status == 422 and "declined" in info.value.message


def test_prose_instead_of_a_tool_call_is_an_error():
    with pytest.raises(AIProviderError) as info:
        call(provider_with(lambda **kw: response([SimpleNamespace(function_call=None, text="here you go", thought=None)])))
    assert info.value.status == 502 and "unexpected response" in info.value.message


def test_non_dict_args_are_rejected():
    with pytest.raises(AIProviderError):
        call(provider_with(lambda **kw: response([part(args=None)])))


def test_empty_candidates_are_rejected():
    empty = SimpleNamespace(candidates=[], usage_metadata=None, prompt_feedback=None)
    with pytest.raises(AIProviderError):
        call(provider_with(lambda **kw: empty))


def test_missing_usage_metadata_does_not_crash():
    resp = response([part(args={"variants": ["a"]})])
    resp.usage_metadata = None
    r = call(provider_with(lambda **kw: resp))
    assert (r.input_tokens, r.output_tokens) == (0, 0)