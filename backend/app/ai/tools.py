"""JSON schemas the model must fill in. Kept permissive on purpose: build.py/ops.py
are the real validators; the schema's job is to steer the model and force structure."""

from __future__ import annotations

from .catalog import fonts
from .provider import ToolSpec

HEX = {"type": "string", "description": "Hex colour such as #1a2b3c"}
GRADIENT = {
    "type": "object",
    "description": "Gradient fill. angle is in degrees (0 = left to right, 90 = top to bottom).",
    "properties": {
        "type": {"type": "string", "enum": ["linear", "radial"]},
        "angle": {"type": "number"},
        "stops": {
            "type": "array", "minItems": 2, "maxItems": 6,
            "items": {
                "type": "object",
                "properties": {"offset": {"type": "number", "minimum": 0, "maximum": 1}, "color": HEX},
                "required": ["offset", "color"],
            },
        },
    },
    "required": ["stops"],
}
PAINT = {"description": "A hex colour string, or a gradient object", "anyOf": [HEX, GRADIENT]}
STROKE = {
    "type": ["object", "null"],
    "properties": {"color": HEX, "width": {"type": "number"}, "dash": {"type": "array", "items": {"type": "number"}}},
    "required": ["color", "width"],
}
SHADOW = {
    "type": ["object", "null"],
    "properties": {
        "color": HEX, "blur": {"type": "number"}, "offsetX": {"type": "number"},
        "offsetY": {"type": "number"}, "opacity": {"type": "number", "minimum": 0, "maximum": 1},
    },
}
FONT_ENUM = sorted(fonts())

# properties shared by the "create" spec and the "update" patch
_PROPS = {
    "name": {"type": "string"},
    "x": {"type": "number"}, "y": {"type": "number"},
    "width": {"type": "number"}, "height": {"type": "number"},
    "rotation": {"type": "number"}, "opacity": {"type": "number", "minimum": 0, "maximum": 1},
    "text": {"type": "string"},
    "fontFamily": {"type": "string", "enum": FONT_ENUM},
    "fontSize": {"type": "number"}, "fontWeight": {"type": "number"},
    "fontStyle": {"type": "string", "enum": ["normal", "italic"]},
    "lineHeight": {"type": "number"}, "letterSpacing": {"type": "number"},
    "align": {"type": "string", "enum": ["left", "center", "right", "justify"]},
    "verticalAlign": {"type": "string", "enum": ["top", "middle", "bottom"]},
    "color": {**HEX, "description": "Text colour"},
    "textTransform": {"type": "string", "enum": ["none", "uppercase", "lowercase", "capitalize"]},
    "shape": {"type": "string", "enum": ["rect", "roundRect", "ellipse", "ring", "triangle", "diamond", "pentagon", "hexagon", "star", "arrow"]},
    "fill": PAINT, "stroke": STROKE, "shadow": SHADOW,
    "cornerRadius": {"type": "number"},
    "starPoints": {"type": "integer", "description": "Number of points for a star shape"},
    "innerRadiusRatio": {"type": "number"},
    "points": {"type": "array", "items": {"type": "number"}, "description": "Line only: [x0,y0,x1,y1,...] relative to the element box"},
}

ELEMENT_SPEC = {
    "type": "object",
    "properties": {"type": {"type": "string", "enum": ["text", "shape", "line"]}, **_PROPS},
    "required": ["type", "x", "y", "width", "height"],
}

CREATE_DESIGN = ToolSpec(
    name="create_design",
    description="Submit the finished design. Elements are ordered back to front.",
    schema={
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "Short design title"},
            "background": PAINT,
            "elements": {"type": "array", "items": ELEMENT_SPEC, "minItems": 1, "maxItems": 40},
        },
        "required": ["name", "background", "elements"],
    },
)

_SET = {
    "type": "object",
    "description": "Properties to change on an existing element",
    "properties": {
        **{k: v for k, v in _PROPS.items() if k != "starPoints"},
        "z": {"type": "integer"}, "locked": {"type": "boolean"}, "hidden": {"type": "boolean"},
        "fit": {"type": "string", "enum": ["cover", "contain", "fill"]},
        "tint": HEX, "tintOpacity": {"type": "number"}, "alt": {"type": "string"},
    },
}

EDIT_DESIGN = ToolSpec(
    name="edit_design",
    description="Submit the minimal list of operations that fulfils the instruction.",
    schema={
        "type": "object",
        "properties": {
            "summary": {"type": "string", "description": "One sentence describing what changed"},
            "background": {**PAINT, "description": "New canvas background, only if it should change"},
            "operations": {
                "type": "array", "maxItems": 60,
                "items": {
                    "type": "object",
                    "properties": {
                        "op": {"type": "string", "enum": ["update", "add", "remove"]},
                        "id": {"type": "string", "description": "Existing element id (update/remove)"},
                        "set": _SET,
                        "element": {**ELEMENT_SPEC, "description": "New element (add)"},
                    },
                    "required": ["op"],
                },
            },
        },
        "required": ["operations"],
    },
)

SUBMIT_COPY = ToolSpec(
    name="submit_copy",
    description="Submit the copy variants.",
    schema={
        "type": "object",
        "properties": {"variants": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 8}},
        "required": ["variants"],
    },
)

SUBMIT_SUGGESTIONS = ToolSpec(
    name="submit_suggestions",
    description="Submit design review suggestions.",
    schema={
        "type": "object",
        "properties": {
            "suggestions": {
                "type": "array", "maxItems": 8,
                "items": {
                    "type": "object",
                    "properties": {
                        "severity": {"type": "string", "enum": ["info", "good", "warning"]},
                        "title": {"type": "string"},
                        "detail": {"type": "string"},
                        "elementIds": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["severity", "title", "detail"],
                },
            }
        },
        "required": ["suggestions"],
    },
)

SUBMIT_SVG = ToolSpec(
    name="submit_svg",
    description="Submit the finished SVG illustration.",
    schema={
        "type": "object",
        "properties": {"svg": {"type": "string", "description": "A complete <svg> document"}},
        "required": ["svg"],
    },
)
