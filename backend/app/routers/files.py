from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..storage import get_storage

router = APIRouter(tags=["files"])

MIME_BY_EXT = {
    ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
    ".gif": "image/gif", ".svg": "image/svg+xml",
}


@router.get("/files/{key}")
def serve_file(key: str):
    """Public by design: <img> elements can't send credentials cross-origin, and
    keys are 144-bit random, so URLs are unguessable capabilities."""
    path = get_storage().path_for(key)
    if path is None:
        raise HTTPException(404, "File not found.")
    headers = {
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        # lets the SPA (a different origin) draw these onto a canvas without tainting it
        "Cross-Origin-Resource-Policy": "cross-origin",
        # if someone opens an SVG directly, scripts still can't run
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    }
    return FileResponse(path, media_type=MIME_BY_EXT.get(path.suffix, "application/octet-stream"), headers=headers)
