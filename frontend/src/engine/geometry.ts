/**
 * Design Engine — geometry helpers. Pure functions, no DOM, no Konva.
 */

import type {
  Box,
  DesignElement,
  GroupElement,
  Point,
  SerializedDesign,
  DesignDocument,
} from './types';

export const DEG = Math.PI / 180;

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export const round = (v: number, p = 2) => {
  const f = 10 ** p;
  return Math.round(v * f) / f;
};

/** Collision-resistant, human-readable id. */
export function uid(prefix = 'el'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export function centerOf(el: Box): Point {
  return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
}

export function boundsOf(el: DesignElement): Box {
  return { x: el.x, y: el.y, width: el.width, height: el.height };
}

/** Union bounding box of many elements (ignores rotation, by design). */
export function unionBounds(els: DesignElement[]): Box {
  if (!els.length) return { x: 0, y: 0, width: 0, height: 0 };
  const minX = Math.min(...els.map((e) => e.x));
  const minY = Math.min(...els.map((e) => e.y));
  const maxX = Math.max(...els.map((e) => e.x + e.width));
  const maxY = Math.max(...els.map((e) => e.y + e.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Axis-aligned bounds including rotation. */
export function rotatedBounds(el: DesignElement): Box {
  if (!el.rotation) return boundsOf(el);
  const c = centerOf(el);
  const hw = el.width / 2;
  const hh = el.height / 2;
  const rad = el.rotation * DEG;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = el.width * cos + el.height * sin;
  const h = el.width * sin + el.height * cos;
  return { x: c.x - w / 2, y: c.y - h / 2, width: w, height: h };
}

/* ------------------------------------------------------------------ */
/* Tree traversal                                                      */
/* ------------------------------------------------------------------ */

export function walk(
  elements: DesignElement[],
  fn: (el: DesignElement, parent: GroupElement | null) => void,
  parent: GroupElement | null = null,
): void {
  for (const el of elements) {
    fn(el, parent);
    if (el.type === 'group') walk(el.children, fn, el);
  }
}

/** Every element, groups included, in paint order. */
export function flatten(elements: DesignElement[]): DesignElement[] {
  const out: DesignElement[] = [];
  walk(elements, (el) => out.push(el));
  return out;
}

/** Leaf elements only (no groups). */
export function leaves(elements: DesignElement[]): DesignElement[] {
  const out: DesignElement[] = [];
  walk(elements, (el) => {
    if (el.type !== 'group') out.push(el);
  });
  return out;
}

export function findElement(
  elements: DesignElement[],
  id: string,
): DesignElement | undefined {
  let found: DesignElement | undefined;
  walk(elements, (el) => {
    if (el.id === id) found = el;
  });
  return found;
}

export function findParent(
  elements: DesignElement[],
  id: string,
  parent: GroupElement | null = null,
): GroupElement | null {
  for (const el of elements) {
    if (el.id === id) return parent;
    if (el.type === 'group') {
      const hit = findParent(el.children, id, el);
      if (hit !== null || el.children.some((c) => c.id === id)) return hit;
    }
  }
  return null;
}

/** Depth-first list of ids, top-level first. */
export function allIds(elements: DesignElement[]): string[] {
  return flatten(elements).map((e) => e.id);
}

/* ------------------------------------------------------------------ */
/* Snapping                                                            */
/* ------------------------------------------------------------------ */

export interface Guide {
  orientation: 'v' | 'h';
  position: number;
  from: number;
  to: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

const EDGE_ANCHORS = [0, 0.5, 1];

/**
 * Snap a moving box to the canvas centre, canvas edges and the edges/centres
 * of the other elements. Returns the delta to apply plus the guides to draw.
 */
export function computeSnap(
  moving: Box,
  others: DesignElement[],
  canvas: { width: number; height: number },
  threshold = 6,
): SnapResult {
  const movingXs = EDGE_ANCHORS.map((a) => moving.x + moving.width * a);
  const movingYs = EDGE_ANCHORS.map((a) => moving.y + moving.height * a);

  const targetXs: { v: number; from: number; to: number }[] = [
    { v: 0, from: 0, to: canvas.height },
    { v: canvas.width / 2, from: 0, to: canvas.height },
    { v: canvas.width, from: 0, to: canvas.height },
  ];
  const targetYs: { v: number; from: number; to: number }[] = [
    { v: 0, from: 0, to: canvas.width },
    { v: canvas.height / 2, from: 0, to: canvas.width },
    { v: canvas.height, from: 0, to: canvas.width },
  ];

  for (const o of others) {
    for (const a of EDGE_ANCHORS) {
      targetXs.push({ v: o.x + o.width * a, from: o.y, to: o.y + o.height });
      targetYs.push({ v: o.y + o.height * a, from: o.x, to: o.x + o.width });
    }
  }

  let bestX: { d: number; v: number; from: number; to: number } | null = null;
  for (const t of targetXs) {
    for (const m of movingXs) {
      const d = t.v - m;
      if (Math.abs(d) <= threshold && (!bestX || Math.abs(d) < Math.abs(bestX.d))) {
        bestX = { d, v: t.v, from: t.from, to: t.to };
      }
    }
  }

  let bestY: { d: number; v: number; from: number; to: number } | null = null;
  for (const t of targetYs) {
    for (const m of movingYs) {
      const d = t.v - m;
      if (Math.abs(d) <= threshold && (!bestY || Math.abs(d) < Math.abs(bestY.d))) {
        bestY = { d, v: t.v, from: t.from, to: t.to };
      }
    }
  }

  const guides: Guide[] = [];
  if (bestX) guides.push({ orientation: 'v', position: bestX.v, from: bestX.from, to: bestX.to });
  if (bestY) guides.push({ orientation: 'h', position: bestY.v, from: bestY.from, to: bestY.to });

  return { dx: bestX?.d ?? 0, dy: bestY?.d ?? 0, guides };
}

/* ------------------------------------------------------------------ */
/* Colour utils (used by the UI, the AI mock and the SVG preview)      */
/* ------------------------------------------------------------------ */

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6) || '000000', 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const a = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(
    ca.r + (cb.r - ca.r) * t,
    ca.g + (cb.g - ca.g) * t,
    ca.b + (cb.b - ca.b) * t,
  );
}

export function darken(hex: string, amount = 0.2): string {
  return mix(hex, '#000000', amount);
}

export function lighten(hex: string, amount = 0.2): string {
  return mix(hex, '#ffffff', amount);
}

/** Average colour of a solid or gradient background. */
export function averageBackgroundColor(background: DesignDocument['background']): string {
  if (typeof background === 'string') return background;
  const stops = background.stops;
  if (!stops.length) return '#ffffff';
  const total = stops.reduce(
    (acc, s) => {
      const c = hexToRgb(s.color);
      return { r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b };
    },
    { r: 0, g: 0, b: 0 },
  );
  return rgbToHex(total.r / stops.length, total.g / stops.length, total.b / stops.length);
}

/* ------------------------------------------------------------------ */
/* A rough text measurer used when creating text boxes outside a canvas */
/* ------------------------------------------------------------------ */

export function estimateTextSize(
  text: string,
  fontSize: number,
  fontWeight = 400,
  lineHeight = 1.2,
): { width: number; height: number } {
  const lines = text.split('\n');
  const widest = Math.max(
    ...lines.map((l) => l.length * fontSize * (fontWeight >= 600 ? 0.58 : 0.54)),
    1,
  );
  return {
    width: Math.ceil(widest),
    height: Math.ceil(lines.length * fontSize * lineHeight),
  };
}

/** Serialize-free clone that is safe for structured data. */
export function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      /* fall through */
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function isSerializedDesign(value: unknown): value is SerializedDesign {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.version === 'number' && !!v.canvas && Array.isArray(v.elements);
}
