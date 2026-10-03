"""Application settings, loaded from environment variables / .env."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

INSECURE_DEFAULT_SECRET = "dev-insecure-secret-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    secret_key: str = INSECURE_DEFAULT_SECRET
    database_url: str = "sqlite:///./data/designforge.db"
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    public_base_url: str = "http://localhost:8000"

    # session
    session_days: int = 14
    cookie_name: str = "df_session"
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    # storage / limits (the frontend enforces the same 8 MB image limit)
    upload_dir: Path = Path("./data/uploads")
    max_upload_bytes: int = 8 * 1024 * 1024
    max_body_bytes: int = 30 * 1024 * 1024  # designs embed images as data URLs
    user_storage_quota_bytes: int = 500 * 1024 * 1024
    max_projects_per_user: int = 500
    max_brand_kits_per_user: int = 20

    # AI
    anthropic_api_key: str | None = None
    ai_model: str = "claude-sonnet-5-5"
    ai_fast_model: str = "claude-haiku-4-5-20251001"
    ai_daily_limit: int = Field(100, ge=0)
    ai_per_minute_limit: int = Field(10, ge=1)
    ai_timeout_seconds: float = 90.0

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value):
        if isinstance(value, str):
            text = value.strip()
            if text.startswith("["):
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    pass
            return [v.strip() for v in text.split(",") if v.strip()]
        return value

    @field_validator("public_base_url")
    @classmethod
    def _strip_slash(cls, value: str) -> str:
        return value.rstrip("/")

    def assert_production_ready(self) -> None:
        if self.app_env != "production":
            return
        problems = []
        if self.secret_key == INSECURE_DEFAULT_SECRET or len(self.secret_key) < 32:
            problems.append("SECRET_KEY must be a random string of at least 32 characters")
        if not self.cookie_secure:
            problems.append("COOKIE_SECURE must be true in production")
        if "*" in self.cors_origins:
            problems.append("CORS_ORIGINS must list explicit origins (credentials are in use)")
        if problems:
            raise RuntimeError("Unsafe production configuration: " + "; ".join(problems))


@lru_cache
def get_settings() -> Settings:
    return Settings()
