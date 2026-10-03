from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Query, Response
from pydantic import BaseModel, ConfigDict

from ..designs import reassign_ids, walk

router = APIRouter(prefix="/templates", tags=["templates"])

DATA = Path(__file__).resolve().parent.parent / "data"
TEMPLATE_KEYS = ("id", "name", "description", "category", "format", "tags", "featured", "document")


@lru_cache
def load_templates() -> list[dict]:
    raw = json.loads((DATA / "templates.json").read_text())
    # The seed export spreads document fields onto each template; keep only the template shape.
    return [{k: t[k] for k in TEMPLATE_KEYS if k in t} for t in raw]


@lru_cache
def load_categories() -> list[dict]:
    return json.loads((DATA / "categories.json").read_text())


def _matches(t: dict, category, fmt, search, tags) -> bool:
    if category and category != "all" and t["category"] != category:
        return False
    if fmt and fmt != "all" and t["format"] != fmt:
        return False
    if tags and not any(x in t.get("tags", []) for x in tags):
        return False
    if search:
        texts = [e.get("text", "") for e in walk(t["document"]["elements"]) if e.get("type") == "text"]
        haystack = " ".join([t["name"], t["description"], t["category"], *t.get("tags", []), *texts]).lower()
        if search.lower() not in haystack:
            return False
    return True


class InstantiateIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str | None = None
    width: int | None = None
    height: int | None = None
    background: Any | None = None
    metadata: dict | None = None


@router.get("")
def list_templates(
    response: Response,
    category: str | None = None,
    format: str | None = None,
    search: str | None = Query(None, max_length=100),
    tags: str | None = Query(None, max_length=200),
    limit: int | None = Query(None, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    tag_list = [t for t in (tags or "").split(",") if t]
    filtered = [t for t in load_templates() if _matches(t, category, format, search, tag_list)]
    end = offset + limit if limit else None
    response.headers["Cache-Control"] = "public, max-age=300"
    return {"items": filtered[offset:end], "total": len(filtered)}


@router.get("/categories")  # declared before "/{template_id}"
def categories(response: Response):
    response.headers["Cache-Control"] = "public, max-age=300"
    return load_categories()


@router.get("/{template_id}")
def get_template(template_id: str):
    return next((t for t in load_templates() if t["id"] == template_id), None)


@router.post("/{template_id}/instantiate")
def instantiate(template_id: str, body: InstantiateIn | None = None):
    template = next((t for t in load_templates() if t["id"] == template_id), None)
    if template is None:
        return None  # matches the local service, which resolves null for unknown ids
    doc = reassign_ids(template["document"])
    if body:
        if body.name:
            doc["name"] = body.name[:200]
        if body.width and body.height and 1 <= body.width <= 20000 and 1 <= body.height <= 20000:
            doc["width"], doc["height"] = body.width, body.height
        if body.background is not None:
            doc["background"] = body.background
        if body.metadata:
            doc["metadata"] = {**doc["metadata"], **{k: v for k, v in body.metadata.items() if k not in ("createdAt", "updatedAt")}}
    return doc
