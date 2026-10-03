from __future__ import annotations

import base64
import binascii
import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import Text, cast, func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import current_user
from ..imaging import EXT, ImageError, inspect_image
from ..models import Asset, BrandKit, Project, User, iso
from ..security import new_id
from ..storage import get_storage

router = APIRouter(prefix="/assets", tags=["assets"])

ASSET_KINDS = {"image", "logo", "icon", "illustration", "font", "video", "audio"}
UPLOADABLE_KINDS = {"image", "logo"}  # same set the frontend supports today
DATA_URL = re.compile(r"^data:(image/[a-z0-9.+-]+);base64,(.+)$", re.I | re.S)


def asset_out(a: Asset) -> dict:
    return {
        "id": a.id,
        "kind": a.kind,
        "name": a.name,
        "src": get_storage().url_for(a.storage_key),
        "width": a.width,
        "height": a.height,
        "size": a.size,
        "mimeType": a.mime_type,
        "createdAt": iso(a.created_at),
        "tags": a.tags or [],
        "folderId": a.folder_id,
        "generatedBy": a.generated_by,
    }


class RegisterIn(BaseModel):
    src: str = Field(max_length=14_000_000)
    kind: str = "image"
    name: str | None = Field(None, max_length=120)
    tags: list[str] | None = Field(None, max_length=30)
    folderId: str | None = Field(None, max_length=48)
    width: int = Field(0, ge=0, le=20000)
    height: int = Field(0, ge=0, le=20000)
    size: int | None = None


class RenameIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


def _check_kind(kind: str, *, upload: bool) -> str:
    if kind not in ASSET_KINDS:
        raise HTTPException(400, f'Unknown asset kind "{kind}".')
    if upload and kind not in UPLOADABLE_KINDS:
        raise HTTPException(400, f'Uploading "{kind}" assets is not available yet.')
    return kind


def _store(
    db: Session, user: User, data: bytes, *, kind: str, name: str, tags: list[str],
    folder_id: str | None, generated_by: str, hint_w: int = 0, hint_h: int = 0,
) -> Asset:
    settings = get_settings()
    if not data:
        raise HTTPException(400, "File is empty.")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(413, f"File is too large. The limit is {settings.max_upload_bytes // (1024 * 1024)} MB.")
    try:
        clean, mime, width, height = inspect_image(data)
    except ImageError as exc:
        raise HTTPException(400, str(exc)) from exc

    used = db.scalar(select(func.coalesce(func.sum(Asset.size), 0)).where(Asset.owner_id == user.id)) or 0
    if used + len(clean) > settings.user_storage_quota_bytes:
        raise HTTPException(413, "Storage quota exceeded. Delete some assets first.")

    key = get_storage().save(clean, EXT[mime])
    asset = Asset(
        id=new_id("ast"),
        owner_id=user.id,
        kind=kind,
        name=(name or "Untitled asset")[:120],
        storage_key=key,
        width=width or hint_w,
        height=height or hint_h,
        size=len(clean),
        mime_type=mime,
        tags=[t[:40] for t in tags],
        folder_id=folder_id,
        generated_by=generated_by,
    )
    db.add(asset)
    try:
        db.commit()
    except Exception:
        db.rollback()
        get_storage().delete(key)
        raise
    return asset


@router.get("")
def list_assets(
    kind: str | None = Query(None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    q = select(Asset).where(Asset.owner_id == user.id).order_by(Asset.created_at.desc())
    if kind:
        q = q.where(Asset.kind == kind)
    return [asset_out(a) for a in db.scalars(q)]


@router.post("")
def upload_asset(
    file: UploadFile = File(...),
    kind: str = Form("image"),
    name: str | None = Form(None),
    tags: str | None = Form(None),
    folderId: str | None = Form(None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    kind = _check_kind(kind, upload=True)
    limit = get_settings().max_upload_bytes
    data = file.file.read(limit + 1)  # never buffer more than the cap
    default_name = re.sub(r"\.[^.]+$", "", file.filename or "")[:60]
    tag_list = [t.strip() for t in (tags or "").split(",") if t.strip()][:30]
    asset = _store(
        db, user, data, kind=kind, name=(name or default_name or "Untitled asset"),
        tags=tag_list, folder_id=folderId, generated_by="upload",
    )
    return asset_out(asset)


@router.post("/register")
def register_asset(body: RegisterIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Persist an already-encoded image (AI output, generated artwork). Data URLs only —
    fetching arbitrary URLs server-side would be an SSRF hole."""
    kind = _check_kind(body.kind, upload=False)
    match = DATA_URL.match(body.src)
    if not match:
        raise HTTPException(400, "src must be a base64 image data URL.")
    try:
        data = base64.b64decode(re.sub(r"\s+", "", match.group(2)), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(400, "src is not valid base64.") from exc
    asset = _store(
        db, user, data, kind=kind, name=body.name or "Generated asset",
        tags=body.tags if body.tags is not None else ["ai"], folder_id=body.folderId,
        generated_by="ai", hint_w=body.width, hint_h=body.height,
    )
    return asset_out(asset)


@router.patch("/{asset_id}", status_code=204)
def rename_asset(asset_id: str, body: RenameIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = db.scalar(select(Asset).where(Asset.id == asset_id, Asset.owner_id == user.id))
    if not a:
        raise HTTPException(404, "Asset not found.")
    a.name = body.name.strip()
    db.commit()
    return Response(status_code=204)


def _in_use(db: Session, user: User, key: str) -> bool:
    """Designs and brand kits embed the file URL, so deleting the file would
    silently break them. Keep the bytes while anything still references them."""
    in_project = db.scalar(
        select(Project.id).where(Project.owner_id == user.id, cast(Project.data, Text).contains(key)).limit(1)
    )
    if in_project:
        return True
    return bool(
        db.scalar(select(BrandKit.id).where(BrandKit.owner_id == user.id, cast(BrandKit.data, Text).contains(key)).limit(1))
    )


@router.delete("/{asset_id}", status_code=204)
def delete_asset(asset_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = db.scalar(select(Asset).where(Asset.id == asset_id, Asset.owner_id == user.id))
    if a:
        key = a.storage_key
        db.delete(a)
        db.commit()
        if not _in_use(db, user, key):
            get_storage().delete(key)
    return Response(status_code=204)
