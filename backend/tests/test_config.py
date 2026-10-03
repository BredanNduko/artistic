"""Configuration parsing that gates whether the AI is considered configured."""

import pytest

from app.config import Settings


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("", None),
        ("   ", None),
        ('""', None),
        ("''", None),
        (None, None),
    ],
)
def test_blank_api_key_means_not_configured(raw, expected):
    """A missing or whitespace-only key must read as "off" so the API returns a
    clean 503 instead of calling the provider with a blank credential."""
    assert Settings(anthropic_api_key=raw).anthropic_api_key == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("sk-ant-abc123", "sk-ant-abc123"),
        ("  sk-ant-abc123  ", "sk-ant-abc123"),
        ("sk-ant-abc123\n", "sk-ant-abc123"),
        ('"sk-ant-abc123"', "sk-ant-abc123"),
        ("'sk-ant-abc123'", "sk-ant-abc123"),
        (' " sk-ant-abc123 " ', "sk-ant-abc123"),
    ],
)
def test_api_key_is_trimmed_of_paste_noise(raw, expected):
    """Keys are commonly pasted with quotes or trailing newlines. Untrimmed they
    pass the configured check and then fail at the provider as a misleading 502."""
    assert Settings(anthropic_api_key=raw).anthropic_api_key == expected


def test_unconfigured_ai_returns_503_not_a_provider_error(client, user):
    """The blank-key path must fail before any network call, and say so.
    Auth is required first, hence the signed-in ``user`` fixture."""
    r = client.post("/ai/generate-design", json={"prompt": "a blue poster"})
    assert r.status_code == 503
    assert "not configured" in r.json()["message"].lower()


def test_ai_status_reports_local_preview_without_a_key(client):
    body = client.get("/ai/status").json()
    assert body["available"] is False
    assert body["mode"] == "local-preview"
    assert body["provider"] is None