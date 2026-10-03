"""Apply model-proposed edit operations to an existing design, safely.

The model never rewrites the document: it proposes small operations that we
validate and apply to the client's own copy. That keeps images, metadata and any
field the model doesn't know about intact, and bounds what a bad answer can do.
"""

from __future__ import annotations

import copy
from typing import Any

from ..designs import now_iso, walk
from .build import (
    ALIGN, SHAPES, TRANSFORM, VALIGN, build_element, clean_text, color, estimate_text_height,
    num, paint, shadow, stroke,
)
from .catalog import font_or_default, snap_weight

MAX_OPS = 60
MAX_ELEMENTS = 500


def _int(v, d, lo, hi):
    return int(num(v, d, lo, hi))


def _validators(doc: dict) -> dict[str, Any]:
    W, H = doc["width"], doc["height"]
    big = max(W, H) * 2
    return {
        "name": lambda v: clean_text(v, 60),
        "x": lambda v: num(v, 0, -W * 0.5, W * 1.5), "y": lambda v: num(v, 0, -H * 0.5, H * 1.5),
        "width": lambda v: num(v, 100, 1, big), "height": lambda v: num(v, 100, 1, big),
        "rotation": lambda v: num(v, 0, -360, 360), "opacity": lambda v: num(v, 1, 0, 1),
        "z": lambda v: _int(v, 0, -1000, 100000),
        "locked": bool, "hidden": bool,
        "text": lambda v: clean_text(v),
        "fontFamily": font_or_default,
        "fontSize": lambda v: num(v, 48, 6, 1200),
        "fontWeight": lambda v: num(v, 400, 100, 900),
        "fontStyle": lambda v: "italic" if v == "italic" else "normal",
        "lineHeight": lambda v: num(v, 1.15, 0.7, 3),
        "letterSpacing": lambda v: num(v, 0, -20, 100),
        "align": lambda v: v if v in ALIGN else "left",
        "verticalAlign": lambda v: v if v in VALIGN else "top",
        "color": lambda v: color(v, "#111111"),
        "textTransform": lambda v: v if v in TRANSFORM else "none",
        "textDecoration": lambda v: v if v in ("none", "underline", "line-through") else "none",
        "shape": lambda v: v if v in SHAPES else "rect",
        "fill": lambda v: paint(v, "#123456"),
        "stroke": lambda v: stroke(v), "shadow": lambda v: shadow(v),
        "cornerRadius": lambda v: num(v, 0, 0, 2000),
        "innerRadiusRatio": lambda v: num(v, 0.45, 0.1, 0.95),
        "fit": lambda v: v if v in ("cover", "contain", "fill") else "cover",
        "tint": lambda v: color(v, "#000000"), "tintOpacity": lambda v: num(v, 0, 0, 1),
        "alt": lambda v: clean_text(v, 300),
    }


ALLOWED = {
    "common": {"name", "x", "y", "width", "height", "rotation", "opacity", "z", "locked", "hidden"},
    "text": {"text", "fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing",
             "align", "verticalAlign", "color", "textTransform", "textDecoration", "shadow"},
    "shape": {"shape", "fill", "stroke", "cornerRadius", "innerRadiusRatio", "shadow"},
    "line": {"stroke", "points"},
    "image": {"fit", "cornerRadius", "tint", "tintOpacity", "alt", "shadow"},
    "group": {"name", "rotation", "opacity", "z", "locked", "hidden", "x", "y"},
}


def _find(elements: list[dict], target: str, parent: list[dict] | None = None, owner: dict | None = None):
    for el in elements:
        if el.get("id") == target:
            return el, elements, owner
        if el.get("type") == "group":
            hit = _find(el.get("children") or [], target, el.get("children"), el)
            if hit:
                return hit
    return None


def _shift(el: dict, dx: float, dy: float) -> None:
    el["x"] += dx
    el["y"] += dy
    for child in el.get("children") or []:
        _shift(child, dx, dy)


def _refit_group(group: dict) -> None:
    kids = group.get("children") or []
    if not kids:
        return
    group["x"] = min(k["x"] for k in kids)
    group["y"] = min(k["y"] for k in kids)
    group["width"] = max(k["x"] + k["width"] for k in kids) - group["x"]
    group["height"] = max(k["y"] + k["height"] for k in kids) - group["y"]


def apply_operations(doc: dict, operations: Any, background: Any = None) -> tuple[dict, int, list[str]]:
    """Returns (new_doc, applied_count, warnings). The input is never mutated."""
    out = copy.deepcopy(doc)
    check = _validators(out)
    warnings: list[str] = []
    applied = 0
    touched_groups: list[dict] = []

    if background is not None:
        out["background"] = paint(background, out.get("background") or "#ffffff")
        applied += 1

    total = sum(1 for _ in walk(out["elements"]))
    for op in (operations if isinstance(operations, list) else [])[:MAX_OPS]:
        if not isinstance(op, dict):
            continue
        kind = op.get("op")

        if kind == "add":
            if total >= MAX_ELEMENTS:
                warnings.append("element limit reached")
                continue
            top_z = max((e.get("z", 0) for e in out["elements"]), default=-1) + 1
            el = build_element(op.get("element"), out["width"], out["height"], top_z)
            if el:
                out["elements"].append(el)
                total += 1
                applied += 1
            else:
                warnings.append("skipped an unusable new element")
            continue

        hit = _find(out["elements"], str(op.get("id", "")))
        if not hit:
            warnings.append(f"unknown element id {str(op.get('id'))[:40]!r}")
            continue
        el, siblings, owner = hit

        if kind == "remove":
            siblings.remove(el)
            applied += 1
            if owner is not None:
                if owner.get("children"):
                    touched_groups.append(owner)
                else:
                    hit2 = _find(out["elements"], owner["id"])
                    if hit2:
                        hit2[1].remove(owner)
            continue

        if kind == "update" and isinstance(op.get("set"), dict):
            allowed = ALLOWED["common"] | ALLOWED.get(el.get("type"), set()) if el.get("type") != "group" else ALLOWED["group"]
            changed = False
            for key, value in op["set"].items():
                if key not in allowed or key not in check and key != "points":
                    continue
                if el.get("type") == "group" and key in ("x", "y"):
                    new = check[key](value)
                    _shift(el, new - el["x"] if key == "x" else 0, new - el["y"] if key == "y" else 0)
                    changed = True
                    continue
                if key == "points":
                    if isinstance(value, list) and len(value) >= 4 and len(value) % 2 == 0:
                        el["points"] = [num(p, 0, -1e5, 1e5) for p in value[:40]]
                        changed = True
                    continue
                new = check[key](value)
                if key == "fontWeight":
                    new = snap_weight(el.get("fontFamily", "Inter"), new)
                if new is None:  # stroke/shadow removal
                    el.pop(key, None)
                else:
                    el[key] = new
                changed = True
            if changed and el.get("type") == "text":
                if "fontFamily" in op["set"]:
                    el["fontWeight"] = snap_weight(el["fontFamily"], el.get("fontWeight", 400))
                needed = estimate_text_height(
                    el["text"], el["fontSize"], el["fontWeight"], el["lineHeight"], el["width"],
                    el["fontFamily"], el.get("textTransform") == "uppercase",
                )
                if "height" not in op["set"]:
                    el["height"] = max(el["height"], needed)
            if changed:
                applied += 1
                if owner is not None:
                    touched_groups.append(owner)
            continue

        warnings.append(f"ignored malformed operation {kind!r}")

    for group in touched_groups:
        _refit_group(group)
    if applied:
        out["metadata"] = {**(out.get("metadata") or {}), "updatedAt": now_iso()}
    return out, applied, warnings


def summarize_design(doc: dict, *, max_elements: int = 150) -> dict:
    """Compact, image-free view of the document for the prompt (data URLs would burn tokens)."""
    budget = [max_elements]

    def r(v):
        return round(v, 1) if isinstance(v, float) else v

    def slim(el: dict) -> dict | None:
        if budget[0] <= 0:
            return None
        budget[0] -= 1
        out = {k: r(v) for k, v in el.items() if k not in ("meta", "src", "children", "padding", "points") or k == "points"}
        if el.get("type") == "image":
            out["src"] = "[image omitted]"
        if isinstance(out.get("text"), str):
            out["text"] = out["text"][:500]
        if isinstance(out.get("points"), list):
            out["points"] = [r(p) for p in out["points"]]
        if el.get("type") == "group":
            kids = [s for c in el.get("children") or [] if (s := slim(c))]
            out["children"] = kids
        return out

    elements = [s for e in doc.get("elements", []) if (s := slim(e))]
    total = sum(1 for _ in walk(doc.get("elements", [])))
    return {
        "width": doc["width"], "height": doc["height"], "background": doc.get("background"),
        "elements": elements,
        **({"note": f"only the first {max_elements} of {total} elements are shown"} if total > max_elements else {}),
    }
