from __future__ import annotations

import base64
import logging
from datetime import timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..ai import build, prompts, tools
from ..ai.catalog import formats
from ..ai.ops import apply_operations, summarize_design
from ..ai.provider import AIProvider, AIProviderError, ToolResult, ToolSpec, get_provider
from ..ai.resize import resize_document
from ..config import get_settings
from ..db import get_db
from ..deps import current_user, current_user_optional
from ..designs import new_doc_id, now_iso, walk
from ..models import AIUsage, BrandKit, User, utcnow
from ..svg import SvgError, sanitize_svg

log = logging.getLogger("designforge.ai")
router = APIRouter(prefix="/ai", tags=["ai"])

HEX = r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"
MAX_AI_ELEMENTS = 200


# ---- request models (mirror the frontend's aiService types) ---------------------------

class DesignIn(BaseModel):
    """The editor's flat DesignDocument. Envelope validated; elements pass through."""

    model_config = ConfigDict(extra="allow")
    id: str = Field(max_length=64)
    name: str = Field(max_length=200)
    width: float = Field(ge=1, le=20000)
    height: float = Field(ge=1, le=20000)
    background: Any = "#ffffff"
    elements: list[dict] = Field(default_factory=list, max_length=5000)
    metadata: dict = Field(default_factory=dict)


class GenerateDesignIn(BaseModel):
    prompt: str = Field(min_length=1, max_length=1000)
    formatId: str | None = Field(None, max_length=64)
    width: int | None = Field(None, ge=64, le=8000)
    height: int | None = Field(None, ge=64, le=8000)
    colors: list[str] = Field(default_factory=list, max_length=8)
    brandKitId: str | None = Field(None, max_length=48)
    seed: int | None = None  # accepted for contract parity; model output isn't seedable


class ModifyDesignIn(BaseModel):
    design: DesignIn
    instruction: str = Field(min_length=1, max_length=1000)


class ResizeIn(BaseModel):
    design: DesignIn
    formatId: str = Field(max_length=64)


class CopyIn(BaseModel):
    prompt: str = Field(min_length=1, max_length=500)
    kind: Literal["headline", "subtitle", "description", "cta", "caption"]
    tone: Literal["bold", "warm", "professional", "playful"] | None = None
    count: int = Field(4, ge=1, le=8)


class SuggestIn(BaseModel):
    design: DesignIn


class ImageIn(BaseModel):
    prompt: str = Field(min_length=1, max_length=500)
    width: int | None = Field(None, ge=64, le=2048)
    height: int | None = Field(None, ge=64, le=2048)
    colors: list[str] = Field(default_factory=list, max_length=8)


# ---- plumbing --------------------------------------------------------------------------

def _enforce_limits(db: Session, user: User) -> None:
    s = get_settings()
    now = utcnow()
    per_minute = db.scalar(
        select(func.count()).select_from(AIUsage).where(AIUsage.user_id == user.id, AIUsage.created_at >= now - timedelta(seconds=60))
    )
    if per_minute >= s.ai_per_minute_limit:
        raise HTTPException(429, "You're going a little fast. Wait a few seconds and try again.", headers={"Retry-After": "30"})
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today = db.scalar(select(func.count()).select_from(AIUsage).where(AIUsage.user_id == user.id, AIUsage.created_at >= day_start))
    if today >= s.ai_daily_limit:
        raise HTTPException(429, "Daily AI limit reached. It resets at midnight UTC.", headers={"Retry-After": "3600"})


def _run(
    db: Session, user: User, provider: AIProvider, *, endpoint: str, model: str,
    system: str, message: str, tool: ToolSpec, max_tokens: int,
) -> ToolResult:
    _enforce_limits(db, user)
    usage = AIUsage(user_id=user.id, endpoint=endpoint, model=model)
    db.add(usage)  # counted up-front so failed/slow calls can't be used to dodge the limit
    db.commit()
    try:
        result = provider.run_tool(model=model, system=system, user=message, tool=tool, max_tokens=max_tokens)
    except AIProviderError as exc:
        raise HTTPException(exc.status, exc.message) from exc
    usage.input_tokens, usage.output_tokens = result.input_tokens, result.output_tokens
    db.commit()
    return result


def _hex_colors(values: list[str]) -> list[str]:
    import re

    return [v for v in values if re.match(HEX, v)]


def _flat(design: DesignIn) -> dict:
    doc = design.model_dump()
    doc["width"], doc["height"] = int(round(design.width)), int(round(design.height))
    return doc


def _guard_size(doc: dict) -> None:
    if sum(1 for _ in walk(doc["elements"])) > MAX_AI_ELEMENTS:
        raise HTTPException(400, f"This design has too many layers for AI editing (limit {MAX_AI_ELEMENTS}).")


# ---- endpoints -------------------------------------------------------------------------

@router.get("/status")
def status(user: User | None = Depends(current_user_optional)):
    s = get_settings()
    ok = bool(s.provider_api_key())
    return {
        "available": ok,
        "mode": "connected" if ok else "local-preview",
        "provider": s.ai_provider if ok else None,
        "model": s.model_for("main") if ok else None,
        "fastModel": s.model_for("fast") if ok else None,
        "message": f"Generation is handled by {s.ai_provider}." if ok else "AI is not configured on this server.",
    }


@router.post("/generate-design")
def generate_design(
    body: GenerateDesignIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    provider: AIProvider = Depends(get_provider),
):
    if body.formatId:
        fmt = formats().get(body.formatId)
        if not fmt:
            raise HTTPException(400, f'Unknown format "{body.formatId}".')
        width, height = fmt["width"], fmt["height"]
        if body.formatId == "custom" and body.width and body.height:
            width, height = body.width, body.height
    else:
        width, height = body.width or 1080, body.height or 1080

    kit = None
    if body.brandKitId:
        row = db.scalar(select(BrandKit).where(BrandKit.id == body.brandKitId, BrandKit.owner_id == user.id))
        kit = row.data if row else None

    result = _run(
        db, user, provider, endpoint="generate", model=get_settings().model_for("main"),
        system=prompts.generate_system(width, height),
        message=prompts.generate_user(body.prompt, _hex_colors(body.colors), kit),
        tool=tools.CREATE_DESIGN, max_tokens=8000,
    )
    elements = build.build_elements(result.data.get("elements"), width, height, limit=40)
    if not elements:
        raise HTTPException(502, "The AI couldn't produce a usable design. Try rephrasing your request.")
    now = now_iso()
    return {
        "id": new_doc_id(),
        "name": build.clean_text(result.data.get("name") or "AI design", 80) or "AI design",
        "width": width,
        "height": height,
        "background": build.paint(result.data.get("background"), "#ffffff"),
        "elements": elements,
        "metadata": {
            "createdAt": now, "updatedAt": now, "tags": ["ai"], "visibility": "private",
            "commentsEnabled": True, "description": body.prompt[:300],
            **({"format": body.formatId} if body.formatId else {}),
        },
    }


@router.post("/modify-design")
def modify_design(
    body: ModifyDesignIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    provider: AIProvider = Depends(get_provider),
):
    doc = _flat(body.design)
    _guard_size(doc)
    result = _run(
        db, user, provider, endpoint="modify", model=get_settings().model_for("main"),
        system=prompts.EDIT_SYSTEM,
        message=prompts.edit_user(summarize_design(doc), body.instruction),
        tool=tools.EDIT_DESIGN, max_tokens=6000,
    )
    new_doc, applied, warnings = apply_operations(doc, result.data.get("operations"), result.data.get("background"))
    if warnings:
        log.info("modify-design warnings: %s", warnings)
    if not applied:
        raise HTTPException(422, "The AI couldn't find a way to apply that change. Try describing it differently.")
    return new_doc


@router.post("/resize-design")
def resize_design(body: ResizeIn, user: User = Depends(current_user)):
    fmt = formats().get(body.formatId)
    if not fmt:
        raise HTTPException(400, f'Unknown format "{body.formatId}".')
    doc = _flat(body.design)
    return resize_document(doc, fmt)  # deterministic: no model call, no quota


@router.post("/copy")
def copy_text(
    body: CopyIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    provider: AIProvider = Depends(get_provider),
):
    result = _run(
        db, user, provider, endpoint="copy", model=get_settings().model_for("fast"),
        system=prompts.COPY_SYSTEM, message=prompts.copy_user(body.prompt, body.kind, body.tone, body.count),
        tool=tools.SUBMIT_COPY, max_tokens=1500,
    )
    limit = prompts.COPY_LENGTH[body.kind] * 2
    seen, variants = set(), []
    for v in result.data.get("variants") or []:
        text = build.clean_text(v, limit).strip()
        if text and text.lower() not in seen:
            seen.add(text.lower())
            variants.append(text)
    if not variants:
        raise HTTPException(502, "The AI didn't return any copy. Please try again.")
    return {"variants": variants[: body.count], "kind": body.kind}


@router.post("/suggest")
def suggest(
    body: SuggestIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    provider: AIProvider = Depends(get_provider),
):
    doc = _flat(body.design)
    _guard_size(doc)
    result = _run(
        db, user, provider, endpoint="suggest", model=get_settings().model_for("fast"),
        system=prompts.SUGGEST_SYSTEM, message=prompts.suggest_user(summarize_design(doc)),
        tool=tools.SUBMIT_SUGGESTIONS, max_tokens=2000,
    )
    known = {e.get("id") for e in walk(doc["elements"])}
    out = []
    for i, s in enumerate((result.data.get("suggestions") or [])[:8]):
        if not isinstance(s, dict) or not s.get("title"):
            continue
        ids = [x for x in (s.get("elementIds") or []) if isinstance(x, str) and x in known]
        out.append({
            "id": f"ai-{i}",
            "severity": s.get("severity") if s.get("severity") in ("info", "good", "warning") else "info",
            "title": build.clean_text(s["title"], 100),
            "detail": build.clean_text(s.get("detail") or "", 400),
            **({"elementIds": ids} if ids else {}),
        })
    return out


@router.post("/image")
def generate_image(
    body: ImageIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    provider: AIProvider = Depends(get_provider),
):
    """Claude can't render pixels, so this returns model-authored SVG artwork. To use a
    raster provider (Stability, OpenAI images, ...) implement it here behind the same
    response shape; the frontend only needs {src, width, height}."""
    width, height = body.width or 1024, body.height or 1024
    result = _run(
        db, user, provider, endpoint="image", model=get_settings().model_for("main"),
        system=prompts.image_system(width, height), message=prompts.image_user(body.prompt, _hex_colors(body.colors)),
        tool=tools.SUBMIT_SVG, max_tokens=8000,
    )
    raw = result.data.get("svg")
    if not isinstance(raw, str) or len(raw) > 400_000:
        raise HTTPException(502, "The AI returned an unusable image. Please try again.")
    try:
        svg = sanitize_svg(raw, size=(width, height))
    except SvgError as exc:
        raise HTTPException(502, "The AI returned an unusable image. Please try again.") from exc
    return {
        "src": "data:image/svg+xml;base64," + base64.b64encode(svg).decode(),
        "width": width,
        "height": height,
        "prompt": body.prompt,
        "style": "gradientMesh",  # the frontend's ArtStyle label; model art isn't one of its presets
    }
