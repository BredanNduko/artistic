"""Helpers for the DesignDocument wire formats.

Two shapes exist (mirrors the frontend):
  * serialized — what the editor PUTs: {version, id, name, canvas:{width,height}, ...}
  * document   — what GET/duplicate/instantiate/AI return: {id, name, width, height, ...}
"""

from __future__ import annotations

import copy
import secrets
from collections.abc import Iterator
from datetime import datetime, timezone
from typing import Any

CURRENT_VERSION = 1


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def new_doc_id() -> str:
    return f"doc_{secrets.token_hex(4)}"


def new_element_id(element_type: str) -> str:
    return f"{element_type[:3]}_{secrets.token_hex(4)}"


def walk(elements: list[dict]) -> Iterator[dict]:
    for el in elements:
        yield el
        if el.get("type") == "group":
            yield from walk(el.get("children") or [])


def count_leaves(elements: list[dict]) -> int:
    return sum(1 for el in walk(elements) if el.get("type") != "group")


def to_document(serialized: dict, thumbnail: str | None = None) -> dict:
    metadata = dict(serialized.get("metadata") or {})
    if thumbnail:
        metadata["thumbnail"] = thumbnail
    canvas = serialized.get("canvas") or {}
    return {
        "id": serialized["id"],
        "name": serialized["name"],
        "width": canvas.get("width", serialized.get("width", 1080)),
        "height": canvas.get("height", serialized.get("height", 1080)),
        "background": serialized.get("background", "#ffffff"),
        "elements": serialized.get("elements") or [],
        "metadata": metadata,
    }


def to_serialized(doc: dict) -> dict:
    return {
        "version": CURRENT_VERSION,
        "id": doc["id"],
        "name": doc["name"],
        "canvas": {"width": doc["width"], "height": doc["height"]},
        "background": doc.get("background", "#ffffff"),
        "elements": doc.get("elements") or [],
        "metadata": doc.get("metadata") or {},
    }


def reassign_ids(doc: dict) -> dict:
    """Deep-copy a flat document with fresh ids so copies never share element ids."""
    out = copy.deepcopy(doc)

    def reid(el: dict) -> dict:
        el["id"] = new_element_id(str(el.get("type", "el")))
        if el.get("type") == "group":
            el["children"] = [reid(c) for c in el.get("children") or []]
        return el

    out["id"] = new_doc_id()
    out["elements"] = [reid(e) for e in out.get("elements") or []]
    now = now_iso()
    out["metadata"] = {
        **(out.get("metadata") or {}),
        "createdAt": now,
        "updatedAt": now,
        "visibility": "private",
    }
    return out


def as_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}
