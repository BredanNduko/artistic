from __future__ import annotations

import secrets
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import current_user
from ..models import BrandKit, User, iso, utcnow

router = APIRouter(prefix="/brand-kits", tags=["brand-kits"])

HEX = r"^#[0-9a-fA-F]{3,8}$"


class ColorIn(BaseModel):
    id: str = Field(max_length=48)
    name: str = Field(max_length=60)
    value: str = Field(pattern=HEX)


class FontIn(BaseModel):
    id: str = Field(max_length=48)
    family: str = Field(max_length=80)
    role: Literal["heading", "body", "accent", "mono"]


class LogoIn(BaseModel):
    id: str = Field(max_length=48)
    name: str = Field(max_length=80)
    src: str = Field(max_length=4_000_000)
    variant: Literal["primary", "light", "dark", "mono"]


class SocialIn(BaseModel):
    id: str = Field(max_length=48)
    platform: str = Field(max_length=40)
    handle: str = Field(max_length=100)
    url: str = Field(max_length=300)


class BusinessIn(BaseModel):
    companyName: str = Field("", max_length=120)
    tagline: str = Field("", max_length=200)
    email: str = Field("", max_length=200)
    phone: str = Field("", max_length=60)
    website: str = Field("", max_length=200)
    address: str = Field("", max_length=300)


class BrandKitIn(BaseModel):
    id: str = Field(min_length=1, max_length=48, pattern=r"^[A-Za-z0-9_-]+$")
    name: str = Field(min_length=1, max_length=120)
    isDefault: bool = False
    colors: list[ColorIn] = Field(default_factory=list, max_length=32)
    fonts: list[FontIn] = Field(default_factory=list, max_length=16)
    logos: list[LogoIn] = Field(default_factory=list, max_length=20)
    business: BusinessIn = Field(default_factory=BusinessIn)
    socials: list[SocialIn] = Field(default_factory=list, max_length=20)
    imageAssetIds: list[str] = Field(default_factory=list, max_length=100)


class CreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


def _rid(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(4)}"


def empty_kit(name: str = "My brand", *, is_default: bool = False) -> dict:
    return {
        "id": f"brd_{secrets.token_hex(6)}",
        "name": name,
        "isDefault": is_default,
        "colors": [
            {"id": _rid("c"), "name": "Primary", "value": "#4f46e5"},
            {"id": _rid("c"), "name": "Secondary", "value": "#f4b942"},
            {"id": _rid("c"), "name": "Ink", "value": "#0c0e13"},
            {"id": _rid("c"), "name": "Surface", "value": "#ffffff"},
        ],
        "fonts": [
            {"id": _rid("f"), "family": "Inter", "role": "body"},
            {"id": _rid("f"), "family": "Montserrat", "role": "heading"},
        ],
        "logos": [],
        "business": BusinessIn().model_dump(),
        "socials": [],
        "imageAssetIds": [],
    }


def kit_out(k: BrandKit) -> dict:
    return {**k.data, "id": k.id, "name": k.name, "isDefault": k.is_default, "updatedAt": iso(k.updated_at)}


def _create(db: Session, user: User, data: dict) -> BrandKit:
    kit = BrandKit(id=data["id"], owner_id=user.id, name=data["name"], is_default=data.get("isDefault", False), data=data)
    db.add(kit)
    return kit


def _kits(db: Session, user: User) -> list[BrandKit]:
    """Get-or-create: every account always has at least one brand kit (the UI assumes it)."""
    kits = list(db.scalars(select(BrandKit).where(BrandKit.owner_id == user.id).order_by(BrandKit.updated_at)))
    if not kits:
        kits = [_create(db, user, empty_kit(is_default=True))]
        db.commit()
    return kits


def _owned(db: Session, user: User, kit_id: str) -> BrandKit | None:
    return db.scalar(select(BrandKit).where(BrandKit.id == kit_id, BrandKit.owner_id == user.id))


@router.get("")
def list_kits(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [kit_out(k) for k in _kits(db, user)]


@router.get("/active")  # must be declared before "/{kit_id}"
def active_kit(user: User = Depends(current_user), db: Session = Depends(get_db)):
    kits = _kits(db, user)
    chosen = next((k for k in kits if k.id == user.active_brand_kit_id), kits[0])
    return kit_out(chosen)


@router.post("")
def create_kit(body: CreateIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    count = db.scalar(select(func.count()).select_from(BrandKit).where(BrandKit.owner_id == user.id))
    if count >= get_settings().max_brand_kits_per_user:
        raise HTTPException(409, "Brand kit limit reached.")
    kit = _create(db, user, empty_kit(body.name.strip()))
    db.commit()
    return kit_out(kit)


@router.get("/{kit_id}")
def get_kit(kit_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    kit = _owned(db, user, kit_id)
    return kit_out(kit) if kit else None


@router.put("/{kit_id}")
def save_kit(kit_id: str, body: BrandKitIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.id != kit_id:
        raise HTTPException(400, "Brand kit id does not match the URL.")
    existing = db.get(BrandKit, kit_id)
    if existing is not None and existing.owner_id != user.id:
        raise HTTPException(404, "Brand kit not found.")
    data = body.model_dump()
    data.pop("updatedAt", None)
    if existing is None:
        count = db.scalar(select(func.count()).select_from(BrandKit).where(BrandKit.owner_id == user.id))
        if count >= get_settings().max_brand_kits_per_user:
            raise HTTPException(409, "Brand kit limit reached.")
        existing = _create(db, user, data)
    existing.name, existing.is_default, existing.data = body.name.strip(), body.isDefault, data
    existing.updated_at = utcnow()
    db.commit()
    return kit_out(existing)


@router.post("/{kit_id}/activate", status_code=204)
def activate_kit(kit_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not _owned(db, user, kit_id):
        raise HTTPException(404, "Brand kit not found.")
    user.active_brand_kit_id = kit_id
    db.add(user)
    db.commit()
    return Response(status_code=204)


@router.delete("/{kit_id}", status_code=204)
def delete_kit(kit_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    kit = _owned(db, user, kit_id)
    if kit:
        db.delete(kit)
        if user.active_brand_kit_id == kit_id:
            user.active_brand_kit_id = None
            db.add(user)
        db.commit()
        _kits(db, user)  # re-seed if that was the last one
    return Response(status_code=204)
