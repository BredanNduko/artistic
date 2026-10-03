"""SVG sanitising shared by uploads and AI-generated images.

SVGs are only ever loaded through <img>/canvas (scripts can't run there) and are
served with a sandboxing CSP, but we still parse and strip active content so a
stored file is inert even if someone opens it directly.
"""

from __future__ import annotations

import re

import defusedxml.ElementTree as DET
from defusedxml.common import DefusedXmlException
from xml.etree import ElementTree as ET

SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", XLINK_NS)

FORBIDDEN_TAGS = {
    "script", "foreignobject", "iframe", "embed", "object", "audio", "video",
    "canvas", "animate", "set", "animatetransform", "animatemotion", "handler", "listener",
}
SAFE_DATA_URI = re.compile(r"^data:image/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$", re.I)
CSS_URL = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)", re.I | re.S)


class SvgError(ValueError):
    pass


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _safe_css(css: str) -> str:
    css = re.sub(r"@import[^;]*;?", "", css, flags=re.I)
    css = re.sub(r"expression\s*\(", "(", css, flags=re.I)

    def keep_local(match: re.Match) -> str:
        target = match.group(2).strip()
        return match.group(0) if target.startswith("#") or SAFE_DATA_URI.match(target) else "none"

    return CSS_URL.sub(keep_local, css)


def _clean(el: ET.Element) -> None:
    for attr in list(el.attrib):
        name = _local(attr)
        value = el.attrib[attr]
        if name.startswith("on"):
            del el.attrib[attr]
        elif name == "href":
            v = value.strip()
            if not (v.startswith("#") or SAFE_DATA_URI.match(v)):
                del el.attrib[attr]
        elif name == "style":
            el.attrib[attr] = _safe_css(value)
        elif re.search(r"javascript:|vbscript:", value, re.I):
            del el.attrib[attr]
        elif "url(" in value.lower():
            el.attrib[attr] = _safe_css(value)
    if _local(el.tag) == "style" and el.text:
        el.text = _safe_css(el.text)
    for child in list(el):
        if _local(child.tag) in FORBIDDEN_TAGS:
            el.remove(child)
        else:
            _clean(child)


def sanitize_svg(source: bytes | str, *, size: tuple[int, int] | None = None) -> bytes:
    data = source.encode() if isinstance(source, str) else source
    try:
        root = DET.fromstring(data, forbid_dtd=True)
    except (ET.ParseError, DefusedXmlException) as exc:
        raise SvgError("The SVG is not valid XML.") from exc
    if _local(root.tag) != "svg":
        raise SvgError("Not an SVG document.")
    if root.tag == "svg":  # no namespace — add it so <img> will render it
        root.set("xmlns", SVG_NS)
    _clean(root)
    if size:
        w, h = size
        if not root.get("viewBox"):
            root.set("viewBox", f"0 0 {w} {h}")
        root.set("width", str(w))
        root.set("height", str(h))
    return ET.tostring(root, encoding="utf-8")


def svg_dimensions(data: bytes) -> tuple[int, int]:
    try:
        root = DET.fromstring(data, forbid_dtd=True)
    except (ET.ParseError, DefusedXmlException):
        return 0, 0

    def px(value: str | None) -> float:
        match = re.match(r"^\s*([0-9.]+)\s*(px)?\s*$", value or "")
        return float(match.group(1)) if match else 0.0

    w, h = px(root.get("width")), px(root.get("height"))
    if not (w and h):
        parts = (root.get("viewBox") or "").replace(",", " ").split()
        if len(parts) == 4:
            try:
                w, h = float(parts[2]), float(parts[3])
            except ValueError:
                w = h = 0.0
    return int(round(w)), int(round(h))
