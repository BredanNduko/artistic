"""Fonts and formats, exported from the frontend registries (data/fonts.ts, data/formats.ts)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
DEFAULT_FONT = "Inter"


@lru_cache
def fonts() -> dict[str, dict]:
    return {f["family"]: f for f in json.loads((DATA / "fonts.json").read_text())}


@lru_cache
def formats() -> dict[str, dict]:
    return {f["id"]: f for f in json.loads((DATA / "formats.json").read_text())}


def font_or_default(family: object) -> str:
    return family if isinstance(family, str) and family in fonts() else DEFAULT_FONT


def snap_weight(family: str, weight: float) -> int:
    weights = fonts().get(family, {}).get("weights") or [400]
    return min(weights, key=lambda w: abs(w - weight))
