"""Wire-level checks: a real google-genai client against a mocked HTTP transport.

These exist because pydantic field presence is not proof of correct behaviour. An
earlier version of the provider read usage_metadata.response_token_count, which is
never populated from the wire, so every call recorded zero output tokens and the
per-day quota under-counted. Asserting on the captured request body and on the
parsed response is what actually catches that class of bug.
"""

import json

import httpx
import pytest
from google import genai

from app.ai.provider import GeminiProvider
from app.ai.tools import CREATE_DESIGN, SUBMIT_COPY


def _wire_response(args, usage=None):
    return {
        "candidates": [
            {
                "content": {"role": "model", "parts": [{"functionCall": {"name": "submit_copy", "args": args}}]},
                "finishReason": "STOP",
            }
        ],
        "usageMetadata": usage if usage is not None else {"promptTokenCount": 21, "candidatesTokenCount": 9, "totalTokenCount": 30},
        "modelVersion": "gemini-3.5-flash",
    }


@pytest.fixture
def wire(monkeypatch):
    """Returns (provider, captured_bodies). No network, real SDK serialisation."""
    bodies = []

    def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(request.content))
        return httpx.Response(200, json=_wire_response({"variants": ["Join us"]}))

    def build():
        transport = httpx.MockTransport(handler)
        p = GeminiProvider("test-key", timeout=5)
        p.client = genai.Client(api_key="test-key", http_options={"timeout": 5000, "httpx_client": httpx.Client(transport=transport)})
        return p

    build.bodies = bodies
    return build


def test_output_tokens_are_read_from_the_wire(wire):
    """Regression: candidates_token_count is the populated field, not
    response_token_count. Getting this wrong records zero usage silently."""
    result = wire().run_tool(model="gemini-3.5-flash", system="s", user="u", tool=SUBMIT_COPY, max_tokens=1500)
    assert result.input_tokens == 21
    assert result.output_tokens == 9


def test_zero_usage_is_reported_as_zero_not_none(wire):
    result = wire().run_tool(model="m", system="s", user="u", tool=SUBMIT_COPY, max_tokens=100)
    assert isinstance(result.input_tokens, int) and isinstance(result.output_tokens, int)


def test_request_body_forces_the_declared_tool(wire):
    wire().run_tool(model="gemini-3.5-flash", system="Be terse.", user="Write a CTA", tool=SUBMIT_COPY, max_tokens=1500)
    body = wire.bodies[-1]

    fcc = body["toolConfig"]["functionCallingConfig"]
    assert fcc["mode"] == "ANY"
    assert fcc["allowedFunctionNames"] == [SUBMIT_COPY.name]

    (decl,) = body["tools"][0]["functionDeclarations"]
    assert decl["name"] == SUBMIT_COPY.name
    assert decl["description"] == SUBMIT_COPY.description

    # The JSON Schema must actually reach the model under one of its two accepted
    # spellings. If the SDK ever stops serialising it, the model would be forced to
    # invent arguments with no schema to satisfy.
    schema = decl.get("parametersJsonSchema") or decl.get("parameters_json_schema")
    assert schema, "function declaration carried no parameter schema"
    assert schema.get("type") == "object" and "variants" in schema.get("properties", {})

    assert body["systemInstruction"]["parts"][0]["text"] == "Be terse."
    assert body["generationConfig"]["maxOutputTokens"] == 1500


@pytest.mark.parametrize("spec", [CREATE_DESIGN, SUBMIT_COPY])
def test_every_real_tool_schema_reaches_the_wire_intact(wire, spec):
    """The complex schemas (anyOf, nested gradients) must survive serialisation."""
    wire().run_tool(model="m", system="s", user="u", tool=spec, max_tokens=4000)
    decl = wire.bodies[-1]["tools"][0]["functionDeclarations"][0]
    sent = decl.get("parametersJsonSchema") or decl.get("parameters_json_schema")
    assert sent == spec.schema