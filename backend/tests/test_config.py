"""Configuration parsing that gates whether the AI is considered configured."""

from unittest import mock

import pytest

from app.config import Settings, get_settings


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


# --- provider selection ---------------------------------------------------------------


def test_model_ids_resolve_per_provider():
    """Model ids are not portable, so each provider must resolve its own."""
    gemini = Settings(ai_provider="gemini")
    assert gemini.model_for("main") == gemini.gemini_model
    assert gemini.model_for("fast") == gemini.gemini_fast_model

    anthropic = Settings(ai_provider="anthropic")
    assert anthropic.model_for("main") == anthropic.ai_model
    assert anthropic.model_for("fast") == anthropic.ai_fast_model

    # The tiers must actually differ, or the fast model saves nothing.
    assert gemini.model_for("main") != gemini.model_for("fast")


def test_provider_api_key_follows_the_selected_provider():
    both = Settings(ai_provider="gemini", gemini_api_key="g-key", anthropic_api_key="a-key")
    assert both.provider_api_key() == "g-key"

    both.ai_provider = "anthropic"
    assert both.provider_api_key() == "a-key"

    assert Settings(ai_provider="gemini", anthropic_api_key="a-key").provider_api_key() is None


@pytest.mark.parametrize("provider", ["gemini", "anthropic"])
def test_get_provider_builds_the_selected_backend(provider):
    from app.ai import provider as provider_mod

    provider_mod._gemini.cache_clear()
    provider_mod._anthropic.cache_clear()
    key = "test-key"
    s = Settings(ai_provider=provider, gemini_api_key=key, anthropic_api_key=key)
    with mock.patch.object(provider_mod, "get_settings", return_value=s):
        built = provider_mod.get_provider()
    assert isinstance(built, provider_mod.GeminiProvider if provider == "gemini" else provider_mod.AnthropicProvider)
    provider_mod._gemini.cache_clear()
    provider_mod._anthropic.cache_clear()


@pytest.mark.parametrize("provider", ["gemini", "anthropic"])
def test_missing_key_for_either_provider_is_a_clean_503(provider):
    from fastapi import HTTPException

    from app.ai import provider as provider_mod

    s = Settings(ai_provider=provider)
    with mock.patch.object(provider_mod, "get_settings", return_value=s):
        with pytest.raises(HTTPException) as info:
            provider_mod.get_provider()
    assert info.value.status_code == 503


def test_status_endpoint_names_the_active_provider_and_models(client, monkeypatch):
    from app.ai import provider as provider_mod

    monkeypatch.setenv("GEMINI_API_KEY", "g-key")
    get_settings.cache_clear()
    provider_mod._gemini.cache_clear()
    body = client.get("/ai/status").json()
    assert body["available"] is True
    assert body["provider"] == "gemini"
    assert body["model"] == get_settings().gemini_model
    assert body["fastModel"] == get_settings().gemini_fast_model
    provider_mod._gemini.cache_clear()