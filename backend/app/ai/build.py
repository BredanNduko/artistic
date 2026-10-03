"""Turn untrusted model output into valid DesignElements.

The model proposes; this module disposes. Every value is clamped, every colour
validated, every font checked against the registry, so nothing the model says can
produce a document the editor can't open.
"""

from __future__ import annotations

import math
import re
from typing import Any

from ..designs import new_element_id
from .catalog import font_or_default, snap_weight

HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
SHAPES = {"rect", "roundRect", "ellipse", "ring", "triangle", "diamond", "pentagon", "hexagon", "star", "arrow", "line"}
ALIGN = {"left", "center", "right", "justify"}
VALIGN = {"top", "middle", "bottom"}
TRANSFORM = {"none", "uppercase", "lowercase", "capitalize"}
CONDENSED = {"Bebas Neue", "Oswald"}
MAX_TEXT = 4000


def num(value: Any, default: float, lo: float, hi: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return default
    return max(lo, min(hi, float(value)))


def color(value: Any, default: str) -> str:
    return value if isinstance(value, str) and HEX_RE.match(value.strip()) else default


def clean_text(value: Any, limit: int = MAX_TEXT) -> str:
    return CONTROL_RE.sub("", str(value)).replace("\r\n", "\n")[:limit]


def gradient(value: Any) -> dict | None:
    if not isinstance(value, dict) or not isinstance(value.get("stops"), list):
        return None
    stops = []
    for s in value["stops"][:8]:
        if isinstance(s, dict):
            stops.append({"offset": num(s.get("offset"), 0, 0, 1), "color": color(s.get("color"), "#000000")})
    if len(stops) < 2:
        return None
    kind = "radial" if value.get("type") == "radial" else "linear"
    out: dict = {"type": kind, "stops": sorted(stops, key=lambda s: s["offset"])}
    if kind == "linear":
        out["angle"] = num(value.get("angle"), 90, -360, 360)
    return out


def paint(value: Any, default: str = "#ffffff") -> str | dict:
    if isinstance(value, dict):
        return gradient(value) or default
    return color(value, default)


def stroke(value: Any) -> dict | None:
    if not isinstance(value, dict):
        return None
    out = {"color": color(value.get("color"), "#111111"), "width": num(value.get("width"), 2, 0, 100)}
    dash = value.get("dash")
    if isinstance(dash, list) and dash:
        out["dash"] = [num(d, 4, 0, 200) for d in dash[:6]]
    return out


def shadow(value: Any) -> dict | None:
    if not isinstance(value, dict):
        return None
    return {
        "color": color(value.get("color"), "#000000"),
        "blur": num(value.get("blur"), 12, 0, 200),
        "offsetX": num(value.get("offsetX"), 0, -200, 200),
        "offsetY": num(value.get("offsetY"), 4, -200, 200),
        "opacity": num(value.get("opacity"), 0.25, 0, 1),
    }


def estimate_text_height(text: str, size: float, weight: int, line_height: float, width: float, family: str, upper: bool) -> float:
    char_w = size * (0.5 + max(0, weight - 400) / 2400) * (0.78 if family in CONDENSED else 1) * (1.1 if upper else 1)
    usable = max(width - 8, size)
    lines = sum(max(1, math.ceil(len(p) * char_w / usable)) for p in text.split("\n"))
    return math.ceil(lines * size * line_height + 8)


def build_element(spec: Any, canvas_w: float, canvas_h: float, z: int) -> dict | None:
    """Return a valid element, or None if the spec is unusable."""
    if not isinstance(spec, dict):
        return None
    kind = spec.get("type")
    big = max(canvas_w, canvas_h) * 2
    x = num(spec.get("x"), 0, -canvas_w * 0.5, canvas_w * 1.5)
    y = num(spec.get("y"), 0, -canvas_h * 0.5, canvas_h * 1.5)
    w = num(spec.get("width"), 100, 1, big)
    h = num(spec.get("height"), 100, 1, big)
    base = {
        "x": x, "y": y, "width": w, "height": h,
        "rotation": num(spec.get("rotation"), 0, -360, 360),
        "opacity": num(spec.get("opacity"), 1, 0, 1),
        "z": z,
        "meta": {"generatedBy": "ai"},
    }
    name = clean_text(spec.get("name") or "", 60)

    if kind == "text":
        text = clean_text(spec.get("text") or "")
        if not text.strip():
            return None
        family = font_or_default(spec.get("fontFamily"))
        size = num(spec.get("fontSize"), 48, 6, 1200)
        weight = snap_weight(family, num(spec.get("fontWeight"), 400, 100, 900))
        line_h = num(spec.get("lineHeight"), 1.15, 0.7, 3)
        transform = spec.get("textTransform") if spec.get("textTransform") in TRANSFORM else "none"
        needed = estimate_text_height(text, size, weight, line_h, w, family, transform == "uppercase")
        base["height"] = max(h if spec.get("height") else 0, needed)
        return {
            **base,
            "id": new_element_id("text"), "type": "text", "name": name or text[:24],
            "text": text, "fontFamily": family, "fontSize": size, "fontWeight": weight,
            "fontStyle": "italic" if spec.get("fontStyle") == "italic" else "normal",
            "lineHeight": line_h,
            "letterSpacing": num(spec.get("letterSpacing"), 0, -20, 100),
            "align": spec.get("align") if spec.get("align") in ALIGN else "left",
            "verticalAlign": spec.get("verticalAlign") if spec.get("verticalAlign") in VALIGN else "top",
            "color": color(spec.get("color"), "#111111"),
            "textTransform": transform, "textDecoration": "none", "padding": 4,
            **({"shadow": s} if (s := shadow(spec.get("shadow"))) else {}),
        }

    if kind == "shape":
        shape = spec.get("shape") if spec.get("shape") in SHAPES else "rect"
        el = {
            **base,
            "id": new_element_id("shape"), "type": "shape", "name": name or shape, "shape": shape,
            "fill": paint(spec.get("fill"), "#123456"),
            "cornerRadius": num(spec.get("cornerRadius"), 32 if shape == "roundRect" else 0, 0, 2000),
            "points": int(num(spec.get("starPoints"), 5, 3, 24)),
            "innerRadiusRatio": num(spec.get("innerRadiusRatio"), 0.45, 0.1, 0.95),
        }
        if (st := stroke(spec.get("stroke"))):
            el["stroke"] = st
        if (sh := shadow(spec.get("shadow"))):
            el["shadow"] = sh
        return el

    if kind == "line":
        raw = spec.get("points")
        pts = [num(p, 0, -big, big) for p in raw[:40]] if isinstance(raw, list) else []
        if len(pts) < 4 or len(pts) % 2:
            pts = [0, 0, w, h]
        return {
            **base,
            "id": new_element_id("line"), "type": "line", "name": name or "Line", "points": pts,
            "stroke": stroke(spec.get("stroke")) or {"color": "#111111", "width": 2}, "lineCap": "round",
        }
    return None


def build_elements(specs: Any, canvas_w: float, canvas_h: float, limit: int = 60) -> list[dict]:
    out: list[dict] = []
    for spec in (specs if isinstance(specs, list) else [])[:limit]:
        el = build_element(spec, canvas_w, canvas_h, len(out))
        if el:
            out.append(el)
    return out
