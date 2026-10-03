from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import defer
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import current_user
from ..designs import (
    as_dict, count_leaves, new_doc_id, now_iso, to_document,
)
from ..models import Project, User, iso, utcnow

router = APIRouter(prefix="/projects", tags=["projects"])

MAX_THUMBNAIL_CHARS = 2_000_000


class Canvas(BaseModel):
    width: float = Field(ge=1, le=20000)
    height: float = Field(ge=1, le=20000)


class SerializedDesignIn(BaseModel):
    """Validates the envelope only. The element schema belongs to the frontend
    engine (and its migrations), so elements are stored as the client sent them."""

    model_config = ConfigDict(extra="allow")
    version: int = Field(1, ge=0, le=1000)
    id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    name: str = Field(max_length=200)
    canvas: Canvas
    background: Any = "#ffffff"
    elements: list[dict] = Field(default_factory=list, max_length=5000)
    metadata: dict = Field(default_factory=dict)


class RenameIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)


def summary_out(p: Project) -> dict:
    out = {
        "id": p.id,
        "name": p.name,
        "width": p.width,
        "height": p.height,
        "updatedAt": iso(p.updated_at),
        "createdAt": iso(p.created_at),
        "elementCount": p.element_count,
        "tags": p.tags or [],
        "visibility": p.visibility,
    }
    for key, value in (("format", p.format), ("thumbnail", p.thumbnail), ("category", p.category)):
        if value:
            out[key] = value
    return out


def _owned(db: Session, user: User, project_id: str) -> Project | None:
    return db.scalar(select(Project).where(Project.id == project_id, Project.owner_id == user.id))


def _apply(p: Project, body: SerializedDesignIn) -> None:
    data = body.model_dump()
    meta = dict(as_dict(data.get("metadata")))
    thumb = meta.pop("thumbnail", None)
    meta["updatedAt"] = now_iso()
    data["metadata"] = meta
    data["canvas"] = {
        "width": int(round(body.canvas.width)),
        "height": int(round(body.canvas.height)),
    }
    p.name = body.name.strip() or "Untitled design"
    p.width, p.height = data["canvas"]["width"], data["canvas"]["height"]
    p.format = str(meta["format"])[:64] if meta.get("format") else None
    p.category = str(meta["category"])[:64] if meta.get("category") else None
    vis = meta.get("visibility")
    p.visibility = vis if vis in ("private", "public", "team") else "private"
    tags = meta.get("tags")
    p.tags = [str(t)[:40] for t in tags[:30]] if isinstance(tags, list) else []
    p.element_count = count_leaves(body.elements)
    p.thumbnail = thumb if isinstance(thumb, str) and thumb.startswith("data:image/") and len(thumb) <= MAX_THUMBNAIL_CHARS else None
    p.data = data
    p.updated_at = utcnow()


def project_document(p: Project) -> dict:
    return to_document(p.data, p.thumbnail)


@router.get("")
def list_projects(user: User = Depends(current_user), db: Session = Depends(get_db)):
    # defer(data): the list view never needs the (potentially huge) document body.
    rows = db.scalars(
        select(Project)
        .options(defer(Project.data))
        .where(Project.owner_id == user.id)
        .order_by(Project.updated_at.desc())
    ).all()
    return [summary_out(p) for p in rows]


@router.get("/{project_id}")
def get_project(project_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    # Returns the flat DesignDocument shape, or null — exactly what projectService.get expects.
    p = _owned(db, user, project_id)
    return project_document(p) if p else None


@router.put("/{project_id}")
def save_project(
    project_id: str,
    body: SerializedDesignIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if body.id != project_id:
        raise HTTPException(400, "Design id does not match the URL.")
    p = db.get(Project, project_id)
    if p is not None and p.owner_id != user.id:
        raise HTTPException(404, "Project not found.")  # don't reveal other users' ids
    if p is None:
        count = db.scalar(select(func.count()).select_from(Project).where(Project.owner_id == user.id))
        if count >= get_settings().max_projects_per_user:
            raise HTTPException(409, "Project limit reached. Delete a design to save a new one.")
        p = Project(id=project_id, owner_id=user.id, created_at=utcnow())
        meta_created = as_dict(body.metadata).get("createdAt")
        if not meta_created:
            body.metadata["createdAt"] = now_iso()
        db.add(p)
    _apply(p, body)
    db.commit()
    return summary_out(p)


@router.patch("/{project_id}", status_code=204)
def rename_project(
    project_id: str, body: RenameIn, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    p = _owned(db, user, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    name = body.name.strip()
    p.name = name
    p.data = {**p.data, "name": name, "metadata": {**as_dict(p.data.get("metadata")), "updatedAt": now_iso()}}
    p.updated_at = utcnow()
    db.commit()
    return Response(status_code=204)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = _owned(db, user, project_id)
    if p:
        db.delete(p)
        db.commit()
    return Response(status_code=204)


@router.post("/{project_id}/duplicate")
def duplicate_project(project_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    source = _owned(db, user, project_id)
    if not source:
        return None
    count = db.scalar(select(func.count()).select_from(Project).where(Project.owner_id == user.id))
    if count >= get_settings().max_projects_per_user:
        raise HTTPException(409, "Project limit reached. Delete a design to duplicate another.")
    doc = project_document(source)
    now = now_iso()
    doc = {
        **doc,
        "id": new_doc_id(),
        "name": f"{doc['name']} copy"[:200],
        "metadata": {
            **{k: v for k, v in doc["metadata"].items() if k != "thumbnail"},
            "createdAt": now,
            "updatedAt": now,
            "forkedFrom": source.id,
        },
    }
    copy_ = Project(id=doc["id"], owner_id=user.id, created_at=utcnow())
    db.add(copy_)
    _apply(
        copy_,
        SerializedDesignIn(
            version=source.data.get("version", 1),
            id=doc["id"],
            name=doc["name"],
            canvas=Canvas(width=doc["width"], height=doc["height"]),
            background=doc["background"],
            elements=doc["elements"],
            metadata=doc["metadata"],
        ),
    )
    db.commit()
    return project_document(copy_)
