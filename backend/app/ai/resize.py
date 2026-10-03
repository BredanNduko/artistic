"""Deterministic canvas resize (port of the frontend's resizeCanvas + safe-area clamp)."""

from __future__ import annotations

import copy

from ..designs import now_iso


def _scale(el: dict, sx: float, sy: float, uniform: float) -> None:
    el["x"] *= sx
    el["y"] *= sy
    el["width"] *= sx
    el["height"] *= sy
    if el.get("type") == "text":
        el["fontSize"] *= uniform
    elif el.get("type") == "line":
        el["points"] = [p * (sx if i % 2 == 0 else sy) for i, p in enumerate(el.get("points") or [])]
    for child in el.get("children") or []:
        _scale(child, sx, sy, uniform)


def _shift(el: dict, dx: float, dy: float) -> None:
    el["x"] += dx
    el["y"] += dy
    for child in el.get("children") or []:
        _shift(child, dx, dy)


def _clamp(el: dict, W: float, H: float, pad: float) -> None:
    w = min(el["width"], W - pad * 2)
    h = min(el["height"], H - pad * 2)
    el["x"] = max(pad, min(el["x"], W - w - pad))
    el["y"] = max(pad, min(el["y"], H - h - pad))
    el["width"], el["height"] = w, h
    for child in el.get("children") or []:
        _clamp(child, W, H, pad)


def resize_document(doc: dict, fmt: dict) -> dict:
    out = copy.deepcopy(doc)
    W, H = fmt["width"], fmt["height"]
    ow, oh = doc["width"], doc["height"]
    ratio_change = abs(W / H - ow / oh) / (ow / oh)

    if ratio_change > 0.35:  # big aspect change: keep sizes, re-centre, then clamp
        dx, dy = (W - ow) / 2, (H - oh) / 2
        for el in out["elements"]:
            _shift(el, dx, dy)
    else:
        sx, sy = W / ow, H / oh
        for el in out["elements"]:
            _scale(el, sx, sy, min(sx, sy))

    pad = min(W, H) * 0.06
    for el in out["elements"]:
        if (el.get("meta") or {}).get("role") != "background":
            _clamp(el, W, H, pad)

    out["width"], out["height"] = W, H
    out["metadata"] = {**(out.get("metadata") or {}), "format": fmt["id"], "updatedAt": now_iso()}
    return out
