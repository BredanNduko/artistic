/**
 * Design Engine — element & document factories.
 *
 * All creation logic lives here so templates, the UI and the (future) AI
 * service all build elements the exact same way, with the same defaults.
 */

import type {
  DesignDocument,
  DesignElement,
  DesignMetadata,
  GradientFill,
  GroupElement,
  ImageElement,
  LineElement,
  ShapeElement,
  ShapeKind,
  TextElement,
} from './types';
import { estimateTextSize, uid, unionBounds } from './geometry';

const now = () => new Date().toISOString();

export function createMetadata(
  patch: Partial<DesignMetadata> = {},
): DesignMetadata {
  return {
    createdAt: now(),
    updatedAt: now(),
    tags: [],
    visibility: 'private',
    commentsEnabled: true,
    ...patch,
  };
}

/* ------------------------------------------------------------------ */

export interface TextOptions {
  id?: string;
  name?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  color?: string;
  align?: TextElement['align'];
  verticalAlign?: TextElement['verticalAlign'];
  lineHeight?: number;
  letterSpacing?: number;
  fontStyle?: TextElement['fontStyle'];
  textTransform?: TextElement['textTransform'];
  opacity?: number;
  rotation?: number;
  z?: number;
  autoSize?: boolean;
  meta?: Record<string, unknown>;
}

export function createText(text: string, options: TextOptions): TextElement {
  const fontSize = options.fontSize ?? 48;
  const fontFamily = options.fontFamily ?? 'Inter';
  const fontWeight = options.fontWeight ?? 400;
  const lineHeight = options.lineHeight ?? 1.15;
  const measured = estimateTextSize(text, fontSize, fontWeight, lineHeight);
  const width = options.width ?? (options.autoSize ? measured.width + 8 : 600);
  const height = options.height ?? (options.autoSize ? measured.height + 4 : measured.height);
  return {
    id: options.id ?? uid('txt'),
    type: 'text',
    name: options.name ?? (text.slice(0, 24) || 'Text'),
    x: options.x,
    y: options.y,
    width,
    height,
    rotation: options.rotation ?? 0,
    opacity: options.opacity ?? 1,
    z: options.z ?? 0,
    text,
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle: options.fontStyle ?? 'normal',
    lineHeight,
    letterSpacing: options.letterSpacing ?? 0,
    align: options.align ?? 'left',
    verticalAlign: options.verticalAlign ?? 'top',
    color: options.color ?? '#111111',
    textTransform: options.textTransform ?? 'none',
    textDecoration: 'none',
    padding: 4,
    meta: options.meta,
  };
}

/* ------------------------------------------------------------------ */

export interface ImageOptions {
  id?: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fit?: ImageElement['fit'];
  crop?: ImageElement['crop'];
  cornerRadius?: number;
  assetId?: string;
  alt?: string;
  opacity?: number;
  rotation?: number;
  z?: number;
  locked?: boolean;
  filter?: ImageElement['filter'];
  meta?: Record<string, unknown>;
}

export function createImage(src: string, options: ImageOptions): ImageElement {
  return {
    id: options.id ?? uid('img'),
    type: 'image',
    name: options.name ?? 'Image',
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    rotation: options.rotation ?? 0,
    opacity: options.opacity ?? 1,
    z: options.z ?? 0,
    locked: options.locked,
    src,
    assetId: options.assetId,
    fit: options.fit ?? 'cover',
    crop: options.crop,
    cornerRadius: options.cornerRadius ?? 0,
    filter: options.filter,
    alt: options.alt,
    meta: options.meta,
  };
}

/* ------------------------------------------------------------------ */

export interface ShapeOptions {
  id?: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape?: ShapeKind;
  fill?: ShapeElement['fill'];
  stroke?: ShapeElement['stroke'];
  cornerRadius?: number;
  points?: number;
  innerRadiusRatio?: number;
  opacity?: number;
  rotation?: number;
  z?: number;
  locked?: boolean;
  shadow?: ShapeElement['shadow'];
  meta?: Record<string, unknown>;
}

export function createShape(options: ShapeOptions): ShapeElement {
  const kind = options.shape ?? 'rect';
  return {
    id: options.id ?? uid('shp'),
    type: 'shape',
    name: options.name ?? kind,
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    rotation: options.rotation ?? 0,
    opacity: options.opacity ?? 1,
    z: options.z ?? 0,
    locked: options.locked,
    shape: kind,
    fill: options.fill ?? '#123456',
    stroke: options.stroke,
    cornerRadius: options.cornerRadius ?? (kind === 'roundRect' ? 32 : 0),
    points: options.points ?? 5,
    innerRadiusRatio: options.innerRadiusRatio ?? 0.45,
    shadow: options.shadow,
    meta: options.meta,
  };
}

/* ------------------------------------------------------------------ */

export interface LineOptions {
  id?: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  points?: number[];
  stroke?: LineElement['stroke'];
  lineCap?: LineElement['lineCap'];
  tension?: number;
  closed?: boolean;
  rotation?: number;
  z?: number;
  opacity?: number;
  meta?: Record<string, unknown>;
}

export function createLine(options: LineOptions): LineElement {
  return {
    id: options.id ?? uid('lin'),
    type: 'line',
    name: options.name ?? 'Line',
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    rotation: options.rotation ?? 0,
    opacity: options.opacity ?? 1,
    z: options.z ?? 0,
    points: options.points ?? [0, 0, options.width, options.height],
    stroke: options.stroke ?? { color: '#111111', width: 2 },
    lineCap: options.lineCap ?? 'round',
    tension: options.tension,
    closed: options.closed,
    meta: options.meta,
  };
}

/* ------------------------------------------------------------------ */

export function createGroup(children: DesignElement[], patch: Partial<GroupElement> = {}): GroupElement {
  const box = unionBounds(children);
  return {
    id: patch.id ?? uid('grp'),
    type: 'group',
    name: patch.name ?? 'Group',
    x: patch.x ?? box.x,
    y: patch.y ?? box.y,
    width: patch.width ?? box.width,
    height: patch.height ?? box.height,
    rotation: patch.rotation ?? 0,
    opacity: patch.opacity ?? 1,
    z: patch.z ?? 0,
    locked: patch.locked,
    hidden: patch.hidden,
    children,
    meta: patch.meta,
  };
}

/* ------------------------------------------------------------------ */

export interface DocumentOptions {
  id?: string;
  name?: string;
  width: number;
  height: number;
  background?: DesignDocument['background'];
  elements?: DesignElement[];
  metadata?: Partial<DesignMetadata>;
}

export function createDocument(options: DocumentOptions): DesignDocument {
  return {
    id: options.id ?? uid('doc'),
    name: options.name ?? 'Untitled design',
    width: options.width,
    height: options.height,
    background: options.background ?? '#ffffff',
    elements: options.elements ?? [],
    metadata: createMetadata(options.metadata),
  };
}

/** Convenience gradient builders used by templates and the brand kit. */
export function linearGradient(angle: number, stops: GradientFill['stops']): GradientFill {
  return { type: 'linear', angle, stops };
}

export function radialGradient(stops: GradientFill['stops']): GradientFill {
  return { type: 'radial', stops };
}
