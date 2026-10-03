from __future__ import annotations

import io

from PIL import Image, UnidentifiedImageError

from .svg import SvgError, sanitize_svg, svg_dimensions

Image.MAX_IMAGE_PIXELS = 60_000_000  # reject decompression bombs

EXT = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
}


class ImageError(ValueError):
    pass


def sniff_mime(data: bytes) -> str | None:
    """Trust the bytes, never the client-declared content type."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    head = data[:2048].lstrip().lower()
    if b"<svg" in head or (head.startswith(b"<?xml") and b"<svg" in data[:8192].lower()):
        return "image/svg+xml"
    return None


def inspect_image(data: bytes) -> tuple[bytes, str, int, int]:
    """Validate an image. Returns (bytes_to_store, mime, width, height)."""
    mime = sniff_mime(data)
    if mime is None:
        raise ImageError("Unsupported file. Use PNG, JPG, WEBP, GIF or SVG.")
    if mime == "image/svg+xml":
        try:
            clean = sanitize_svg(data)
        except SvgError as exc:
            raise ImageError(str(exc)) from exc
        w, h = svg_dimensions(clean)
        return clean, mime, w, h
    try:
        with Image.open(io.BytesIO(data)) as im:
            width, height = im.size
            im.verify()
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, SyntaxError) as exc:
        raise ImageError("The image file is corrupt or too large to process.") from exc
    return data, mime, width, height
