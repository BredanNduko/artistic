/**
 * Design Engine — Core Schema
 * ------------------------------------------------------------------
 * This module is intentionally FRAMEWORK FREE. It has zero imports from
 * React, Konva, Zustand or any UI library. Everything here is plain data.
 *
 * The whole platform is built on one idea:
 *
 *    Content -> DesignDocument -> Design Engine -> Canvas Renderer -> Export
 *
 * Any producer of a `DesignDocument` (a human, a template, an AI service,
 * an importer) plugs into the same pipeline. Nothing downstream cares where
 * the document came from.
 */

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

export type ElementType = 'text' | 'image' | 'shape' | 'line' | 'group';

export interface Stroke {
  color: string;
  width: number;
  dash?: number[];
}

export interface Shadow {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
}

export interface GradientStop {
  offset: number; // 0..1
  color: string;
}

export interface GradientFill {
  type: 'linear' | 'radial';
  /** degrees, 0 = left -> right */
  angle?: number;
  stops: GradientStop[];
}

export type Paint = string | GradientFill;

/** Canvas background: solid colour or a gradient. */
export type Background = Paint;

export interface CropRect {
  /** normalised 0..1 window of the SOURCE image that is visible */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageFilter {
  grayscale?: number; // 0..1
  blur?: number; // px
  brightness?: number; // 1 = unchanged
  contrast?: number; // 1 = unchanged
  saturate?: number; // 1 = unchanged
}

/* ------------------------------------------------------------------ */
/* Element base                                                        */
/* ------------------------------------------------------------------ */

export interface BaseElement {
  id: string;
  type: ElementType;
  /** human readable name shown in the layers panel */
  name?: string;
  /** top-left of the element's UNROTATED bounding box, in canvas px */
  x: number;
  y: number;
  width: number;
  height: number;
  /** degrees, always rotated around the element centre */
  rotation: number;
  /** 0..1 */
  opacity: number;
  /** z-order within its parent. Higher = closer to the viewer. */
  z: number;
  locked?: boolean;
  hidden?: boolean;
  /** prevent non-uniform scaling */
  lockAspect?: boolean;
  shadow?: Shadow;
  /** free-form slot reserved for future/AI metadata, survives round-trips */
  meta?: Record<string, unknown>;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle?: 'normal' | 'italic';
  lineHeight: number;
  letterSpacing: number;
  align: 'left' | 'center' | 'right' | 'justify';
  verticalAlign: 'top' | 'middle' | 'bottom';
  color: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textDecoration?: 'none' | 'underline' | 'line-through';
  padding?: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  /** data: URL or absolute URL. Local uploads are stored as data URLs. */
  src: string;
  /** link back to the asset library entry, when the image came from there */
  assetId?: string;
  fit: 'cover' | 'contain' | 'fill';
  crop?: CropRect;
  cornerRadius?: number;
  filter?: ImageFilter;
  /** optional flat colour overlay, useful for duotone looks */
  tint?: string;
  tintOpacity?: number;
  /** alt text — matters for accessibility and for AI vision grounding later */
  alt?: string;
}

export type ShapeKind =
  | 'rect'
  | 'roundRect'
  | 'ellipse'
  | 'ring'
  | 'triangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'arrow'
  | 'line';

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shape: ShapeKind;
  fill: Paint;
  stroke?: Stroke;
  cornerRadius?: number;
  /** star only */
  points?: number;
  innerRadiusRatio?: number;
}

export interface LineElement extends BaseElement {
  type: 'line';
  /** points relative to the element box, in canvas px: [x0,y0,x1,y1,...] */
  points: number[];
  stroke: Stroke;
  lineCap?: 'butt' | 'round' | 'square';
  tension?: number;
  closed?: boolean;
}

export interface GroupElement extends BaseElement {
  type: 'group';
  /**
   * Children keep ABSOLUTE canvas coordinates. The group's own x/y/width/height
   * is always the bounding box of its children. This keeps the model flat and
   * easy for an AI to reason about, and avoids nested transform math.
   */
  children: DesignElement[];
}

export type DesignElement =
  | TextElement
  | ImageElement
  | ShapeElement
  | LineElement
  | GroupElement;

/* ------------------------------------------------------------------ */
/* Document                                                            */
/* ------------------------------------------------------------------ */

export type Visibility = 'private' | 'public' | 'team';

export interface DesignMetadata {
  createdAt: string;
  updatedAt: string;
  author?: string;
  ownerId?: string;
  category?: string;
  tags: string[];
  /** registry key from data/formats.ts, e.g. "instagram-post" */
  format?: string;
  templateId?: string;
  description?: string;
  thumbnail?: string;
  visibility: Visibility;
  /** set when a design was created from another design (remix / AI variant) */
  forkedFrom?: string;
  /** future collaboration hooks */
  collaborators?: string[];
  commentsEnabled?: boolean;
}

export interface DesignDocument {
  id: string;
  name: string;
  width: number;
  height: number;
  background: Background;
  elements: DesignElement[];
  metadata: DesignMetadata;
}

/**
 * Wire format. This is what gets persisted, sent to a backend, or handed to
 * an AI provider. It carries an explicit `version` so the migration registry
 * can upgrade old documents forever.
 */
export interface SerializedDesign {
  version: number;
  id: string;
  name: string;
  canvas: { width: number; height: number };
  background: Background;
  elements: DesignElement[];
  metadata: DesignMetadata;
}

/* ------------------------------------------------------------------ */
/* Selection & transform helpers                                       */
/* ------------------------------------------------------------------ */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export type ElementPatch = Partial<Omit<BaseElement, 'id' | 'type'>> &
  Record<string, unknown>;

export interface DesignSuggestion {
  id: string;
  severity: 'info' | 'good' | 'warning';
  title: string;
  detail: string;
  /** ids of the elements the suggestion refers to */
  elementIds?: string[];
}

/** Everything the engine needs to know about the surface it draws onto. */
export interface RenderTarget {
  width: number;
  height: number;
}
