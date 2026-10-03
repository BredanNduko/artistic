/**
 * Design Engine — scene description.
 *
 * This is the ONE place that turns a `DesignElement` into a concrete set of
 * drawing instructions. Both the interactive canvas (react-konva) and the
 * offline export renderer (plain Konva) consume the exact same descriptors,
 * so what you see on screen is what lands in the exported PNG.
 *
 * Descriptors are plain objects: no Konva instances, no React, no DOM.
 */

import type {
  Background,
  CropRect,
  DesignDocument,
  DesignElement,
  GradientFill,
  GroupElement,
  ImageElement,
  LineElement,
  Paint,
  ShapeElement,
  TextElement,
} from '../types';

export type KonvaNodeType =
  | 'Group'
  | 'Rect'
  | 'Ellipse'
  | 'Ring'
  | 'RegularPolygon'
  | 'Star'
  | 'Line'
  | 'Arrow'
  | 'Text'
  | 'Image';

export interface NodeDescriptor {
  /** stable key for React reconciliation */
  key: string;
  /** the element this node draws — used for hit-testing and selection */
  elementId: string;
  type: KonvaNodeType;
  props: Record<string, unknown>;
  children?: NodeDescriptor[];
  /** remote or data URL that must be decoded before this node can draw */
  imageSrc?: string;
  /** normalised crop window, resolved against the natural image size */
  crop?: CropRect;
  /** filters require the node to be rasterised before drawing */
  needsCache?: boolean;
}

/* ------------------------------------------------------------------ */
/* Paint                                                               */
/* ------------------------------------------------------------------ */

export function paintProps(paint: Paint, w: number, h: number): Record<string, unknown> {
  if (typeof paint === 'string') return { fill: paint };

  const gradient = paint as GradientFill;
  const colorStops = gradient.stops.flatMap((s) => [s.offset, s.color]);

  if (gradient.type === 'radial') {
    return {
      fillRadialGradientStartPoint: { x: w / 2, y: h / 2 },
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndPoint: { x: w / 2, y: h / 2 },
      fillRadialGradientEndRadius: Math.max(w, h) / 2,
      fillRadialGradientColorStops: colorStops,
    };
  }

  const angle = ((gradient.angle ?? 0) * Math.PI) / 180;
  const len = Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle));
  const dx = (Math.cos(angle) * len) / 2;
  const dy = (Math.sin(angle) * len) / 2;
  return {
    fillLinearGradientStartPoint: { x: w / 2 - dx, y: h / 2 - dy },
    fillLinearGradientEndPoint: { x: w / 2 + dx, y: h / 2 + dy },
    fillLinearGradientColorStops: colorStops,
  };
}

/** Background as a full-canvas rect descriptor. */
export function describeBackground(doc: DesignDocument): NodeDescriptor {
  return {
    key: 'background',
    elementId: '__background__',
    type: 'Rect',
    props: {
      x: 0,
      y: 0,
      width: doc.width,
      height: doc.height,
      listening: false,
      ...paintProps(doc.background as Paint, doc.width, doc.height),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

interface Offset {
  dx: number;
  dy: number;
}

const baseTransform = (
  el: DesignElement,
  offset: Offset,
): Record<string, unknown> => ({
  x: el.x - offset.dx + el.width / 2,
  y: el.y - offset.dy + el.height / 2,
  offsetX: el.width / 2,
  offsetY: el.height / 2,
  rotation: el.rotation,
  opacity: el.opacity,
  visible: !el.hidden,
  listening: !el.locked,
  name: `element:${el.id}`,
  id: el.id,
});

const shadowProps = (el: DesignElement): Record<string, unknown> =>
  el.shadow
    ? {
        shadowColor: el.shadow.color,
        shadowBlur: el.shadow.blur,
        shadowOffsetX: el.shadow.offsetX,
        shadowOffsetY: el.shadow.offsetY,
        shadowOpacity: el.shadow.opacity,
      }
    : {};

function fontStyleOf(el: TextElement): string {
  const parts: string[] = [];
  if (el.fontStyle === 'italic') parts.push('italic');
  if (el.fontWeight >= 600) parts.push('bold');
  return parts.join(' ') || 'normal';
}

function applyTransform(text: string, el: TextElement): string {
  switch (el.textTransform) {
    case 'uppercase':
      return text.toUpperCase();
    case 'lowercase':
      return text.toLowerCase();
    case 'capitalize':
      return text.replace(/\b\w/g, (c) => c.toUpperCase());
    default:
      return text;
  }
}

/* ------------------------------------------------------------------ */
/* Element descriptors                                                 */
/* ------------------------------------------------------------------ */

function describeText(el: TextElement, offset: Offset): NodeDescriptor {
  return {
    key: el.id,
    elementId: el.id,
    type: 'Text',
    props: {
      ...baseTransform(el, offset),
      text: applyTransform(el.text, el),
      fontFamily: el.fontFamily,
      fontSize: el.fontSize,
      fontStyle: fontStyleOf(el),
      textDecoration: el.textDecoration ?? 'none',
      align: el.align,
      verticalAlign: el.verticalAlign,
      lineHeight: el.lineHeight,
      letterSpacing: el.letterSpacing,
      padding: el.padding ?? 0,
      width: el.width,
      height: el.height,
      fill: el.color,
      wrap: 'word',
      ...shadowProps(el),
    },
  };
}

function describeImage(el: ImageElement, offset: Offset): NodeDescriptor {
  const filter = el.filter ?? {};
  const filters: unknown[] = [];
  const needsCache =
    filter.grayscale !== undefined ||
    filter.blur !== undefined ||
    filter.brightness !== undefined ||
    filter.contrast !== undefined ||
    filter.saturate !== undefined;

  return {
    key: el.id,
    elementId: el.id,
    type: 'Image',
    imageSrc: el.src,
    crop: el.crop,
    needsCache,
    props: {
      ...baseTransform(el, offset),
      width: el.width,
      height: el.height,
      cornerRadius: el.cornerRadius ?? 0,
      filters: filters.length ? filters : undefined,
      ...shadowProps(el),
    },
  };
}

function describeShape(el: ShapeElement, offset: Offset): NodeDescriptor {
  const t = baseTransform(el, offset);
  const stroke = el.stroke
    ? {
        stroke: el.stroke.color,
        strokeWidth: el.stroke.width,
        dash: el.stroke.dash,
      }
    : {};
  const w = el.width;
  const h = el.height;

  switch (el.shape) {
    case 'rect':
    case 'roundRect':
      return {
        key: el.id,
        elementId: el.id,
        type: 'Rect',
        props: {
          ...t,
          width: w,
          height: h,
          cornerRadius: el.shape === 'roundRect' ? el.cornerRadius ?? 24 : el.cornerRadius ?? 0,
          ...paintProps(el.fill, w, h),
          ...stroke,
          ...shadowProps(el),
        },
      };

    case 'ellipse':
      return {
        key: el.id,
        elementId: el.id,
        type: 'Ellipse',
        props: {
          ...t,
          offsetX: 0,
          offsetY: 0,
          radiusX: w / 2,
          radiusY: h / 2,
          ...paintProps(el.fill, w, h),
          ...stroke,
          ...shadowProps(el),
        },
      };

    case 'ring':
      return {
        key: el.id,
        elementId: el.id,
        type: 'Ring',
        props: {
          ...t,
          offsetX: 0,
          offsetY: 0,
          innerRadius: (Math.min(w, h) / 2) * (el.innerRadiusRatio ?? 0.6),
          outerRadius: Math.min(w, h) / 2,
          ...paintProps(el.fill, w, h),
          ...stroke,
          ...shadowProps(el),
        },
      };

    case 'triangle':
    case 'diamond':
    case 'pentagon':
    case 'hexagon': {
      const sides = { triangle: 3, diamond: 4, pentagon: 5, hexagon: 6 }[el.shape];
      return {
        key: el.id,
        elementId: el.id,
        type: 'RegularPolygon',
        props: {
          ...t,
          offsetX: 0,
          offsetY: 0,
          sides,
          radius: Math.min(w, h) / 2,
          ...paintProps(el.fill, w, h),
          ...stroke,
          ...shadowProps(el),
        },
      };
    }

    case 'star':
      return {
        key: el.id,
        elementId: el.id,
        type: 'Star',
        props: {
          ...t,
          offsetX: 0,
          offsetY: 0,
          numPoints: el.points ?? 5,
          outerRadius: Math.min(w, h) / 2,
          innerRadius: (Math.min(w, h) / 2) * (el.innerRadiusRatio ?? 0.45),
          ...paintProps(el.fill, w, h),
          ...stroke,
          ...shadowProps(el),
        },
      };

    case 'arrow':
      return {
        key: el.id,
        elementId: el.id,
        type: 'Arrow',
        props: {
          ...t,
          points: [0, h / 2, w, h / 2],
          stroke: el.stroke?.color ?? (typeof el.fill === 'string' ? el.fill : '#111111'),
          strokeWidth: el.stroke?.width ?? 4,
          fill: el.stroke?.color ?? (typeof el.fill === 'string' ? el.fill : '#111111'),
          pointerLength: Math.min(w, h) * 0.4,
          pointerWidth: Math.min(w, h) * 0.5,
          lineCap: 'round',
          ...shadowProps(el),
        },
      };

    case 'line':
    default:
      return {
        key: el.id,
        elementId: el.id,
        type: 'Line',
        props: {
          ...t,
          points: [0, 0, w, h],
          stroke: el.stroke?.color ?? '#111111',
          strokeWidth: el.stroke?.width ?? 2,
          lineCap: 'round',
          ...shadowProps(el),
        },
      };
  }
}

function describeLine(el: LineElement, offset: Offset): NodeDescriptor {
  return {
    key: el.id,
    elementId: el.id,
    type: 'Line',
    props: {
      ...baseTransform(el, offset),
      points: el.points,
      stroke: el.stroke.color,
      strokeWidth: el.stroke.width,
      dash: el.stroke.dash,
      lineCap: el.lineCap ?? 'round',
      tension: el.tension ?? 0,
      closed: el.closed ?? false,
      ...shadowProps(el),
    },
  };
}

function describeGroup(el: GroupElement, offset: Offset): NodeDescriptor {
  return {
    key: el.id,
    elementId: el.id,
    type: 'Group',
    props: {
      ...baseTransform(el, offset),
      width: el.width,
      height: el.height,
      draggable: false,
    },
    children: el.children
      .slice()
      .sort((a, b) => a.z - b.z)
      .map((child) => describeElement(child, { dx: offset.dx + el.x, dy: offset.dy + el.y })),
  };
}

export function describeElement(el: DesignElement, offset: Offset = { dx: 0, dy: 0 }): NodeDescriptor {
  switch (el.type) {
    case 'text':
      return describeText(el, offset);
    case 'image':
      return describeImage(el, offset);
    case 'shape':
      return describeShape(el, offset);
    case 'line':
      return describeLine(el, offset);
    case 'group':
      return describeGroup(el, offset);
    default: {
      // Exhaustiveness guard: a future element type must not crash the renderer.
      const unknown = el as unknown as DesignElement;
      return { key: unknown.id, elementId: unknown.id, type: 'Group', props: {} };
    }
  }
}

/** Full scene in paint order, background first. */
export function describeScene(doc: DesignDocument): NodeDescriptor[] {
  const background = describeBackground(doc);
  const body = doc.elements
    .slice()
    .sort((a, b) => a.z - b.z)
    .map((el) => describeElement(el));
  return [background, ...body];
}

/** Every image URL referenced by a document. */
export function collectImageSources(doc: DesignDocument): string[] {
  const out = new Set<string>();
  const visit = (el: DesignElement) => {
    if (el.type === 'image' && el.src) out.add(el.src);
    if (el.type === 'group') el.children.forEach(visit);
  };
  doc.elements.forEach(visit);
  return [...out];
}

/** Every font family referenced by a document. */
export function collectFontFamilies(doc: DesignDocument): string[] {
  const out = new Set<string>();
  const visit = (el: DesignElement) => {
    if (el.type === 'text' && el.fontFamily) out.add(el.fontFamily);
    if (el.type === 'group') el.children.forEach(visit);
  };
  doc.elements.forEach(visit);
  return [...out];
}

export function isGradient(background: Background): background is GradientFill {
  return typeof background !== 'string';
}
