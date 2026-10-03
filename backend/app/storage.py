"""File storage. Local disk today; implement the same three methods for S3/R2/GCS."""

from __future__ import annotations

import os
import re
import secrets
import tempfile
from pathlib import Path

from .config import get_settings

KEY_RE = re.compile(r"^[A-Za-z0-9_-]{16,64}\.[a-z0-9]{2,5}$")


class LocalStorage:
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, data: bytes, ext: str) -> str:
        key = f"{secrets.token_urlsafe(18)}{ext}"
        fd, tmp = tempfile.mkstemp(dir=self.root)
        try:
            with os.fdopen(fd, "wb") as fh:
                fh.write(data)
            os.replace(tmp, self.root / key)  # atomic
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise
        return key

    def path_for(self, key: str) -> Path | None:
        if not KEY_RE.match(key):
            return None
        path = (self.root / key).resolve()
        return path if path.is_file() and path.parent == self.root else None

    def delete(self, key: str) -> None:
        path = self.path_for(key)
        if path:
            path.unlink(missing_ok=True)

    def url_for(self, key: str) -> str:
        return f"{get_settings().public_base_url}/files/{key}"


_storage: LocalStorage | None = None


def get_storage() -> LocalStorage:
    global _storage
    if _storage is None:
        _storage = LocalStorage(get_settings().upload_dir)
    return _storage


def reset_storage() -> None:
    global _storage
    _storage = None
