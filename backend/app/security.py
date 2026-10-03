from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from .config import get_settings

_hasher = PasswordHasher()
# Verified against when the email is unknown so sign-in timing doesn't reveal accounts.
_DUMMY_HASH = _hasher.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        ok = _hasher.verify(password_hash or _DUMMY_HASH, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False
    return ok and password_hash is not None


def new_id(prefix: str, nbytes: int = 8) -> str:
    return f"{prefix}_{secrets.token_hex(nbytes)}"


def create_session_token(user_id: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(days=settings.session_days),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_session_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, get_settings().secret_key, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    sub = payload.get("sub")
    return sub if isinstance(sub, str) else None
