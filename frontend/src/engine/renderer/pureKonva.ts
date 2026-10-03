/**
 * Design Engine — offline renderer (plain Konva, no React).
 *
 * Used for:
 *   - template thumbnails
 *   - PNG / JPG export
 *   - (future) server-side rendering parity checks
 *
 * It consumes the shared scene descriptors, so it always matches the
 * interactive canvas.
 */

import Konva from 'konva';
import type { DesignDocument } from '../types';
import {
  collectFontFamilies,
  collectImageSources,
  describeScene,
  type NodeDescriptor,
} from './describe';

/* ------------------------------------------------------------------ */
/* Image loading with an in-memory cache                               */
/* ------------------------------------------------------------------ */

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'sync';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 64)}`));
    img.src = src;
  });

  imageCache.set(src, promise);
  return promise;
}

export function preloadImages(sources: string[]): Promise<Map<string, HTMLImageElement>> {
  return Promise.all(
    sources.map(async (src) => {
      try {
        return [src, await loadImage(src)] as const;
      } catch {
        return [src, null] as const;
      }
    }),
  ).then((entries) => {
    const map = new Map<string, HTMLImageElement>();
    for (const [src, img] of entries) if (img) map.set(src, img);
    return map;
  });
}

/** Wait for the webfonts a document actually uses so exports are faithful. */
export async function ensureFonts(families: string[]): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(
    families.map((family) =>
      document.fonts.load(`16px "${family}"`).catch(() => undefined),
    ),
  );
  await document.fonts.ready;
}

/* ------------------------------------------------------------------ */
/* Descriptor -> Konva tree                                            */
/* ------------------------------------------------------------------ */

type KonvaCtor = new (config?: Record<string, unknown>) => Konva.Node;

/** Anything Konva will accept as a child of a Group. */
type BuildableNode = Konva.Group | Konva.Shape;

function buildNode(
  descriptor: NodeDescriptor,
  images: Map<string, HTMLImageElement>,
): BuildableNode {
  const Ctor = (Konva as unknown as Record<string, KonvaCtor>)[descriptor.type];
  if (!Ctor) return new Konva.Group({});

  const props: Record<string, unknown> = { ...descriptor.props };

  if (descriptor.imageSrc) {
    const img = images.get(descriptor.imageSrc);
    if (!img) {
      // graceful placeholder so a single bad asset never blanks the design
      return new Konva.Rect({
        ...props,
        fill: '#e2e8f0',
        stroke: '#cbd5e1',
        strokeWidth: 1,
        width: descriptor.props.width as number,
        height: descriptor.props.height as number,
        offsetX: 0,
        offsetY: 0,
        x: (props.x as number) - (descriptor.props.width as number) / 2,
        y: (props.y as number) - (descriptor.props.height as number) / 2,
      });
    }
    props.image = img;
    if (descriptor.crop) {
      const nw = img.naturalWidth || img.width;
      const nh = img.naturalHeight || img.height;
      props.crop = {
        x: descriptor.crop.x * nw,
        y: descriptor.crop.y * nh,
        width: descriptor.crop.width * nw,
        height: descriptor.crop.height * nh,
      };
    }
  }

  if (props.filters === undefined) delete props.filters;

  const node = new Ctor(props) as BuildableNode;
  if (descriptor.children?.length && node instanceof Konva.Group) {
    for (const child of descriptor.children) node.add(buildNode(child, images));
  }
  return node;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface RenderOptions {
  /** device pixels per design pixel. 1 = design resolution. */
  pixelRatio?: number;
  /** draw a light checkerboard behind transparent areas (PNG only) */
  transparent?: boolean;
  /** extra padding around the canvas, in design px */
  padding?: number;
  background?: string;
}

export interface RenderedScene {
  canvas: HTMLCanvasElement;
  /** the hidden host element — call `dispose` when finished */
  dispose: () => void;
}

/**
 * Render a design document to a detached canvas.
 * Safe to call from a thumbnail grid; each call is fully isolated.
 */
export async function renderSceneToCanvas(
  doc: DesignDocument,
  options: RenderOptions = {},
): Promise<RenderedScene> {
  const pixelRatio = options.pixelRatio ?? 1;
  const padding = options.padding ?? 0;

  const [images] = await Promise.all([
    preloadImages(collectImageSources(doc)),
    ensureFonts(collectFontFamilies(doc)),
  ]);

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.pointerEvents = 'none';
  document.body.appendChild(host);

  const stage = new Konva.Stage({
    container: host,
    width: doc.width + padding * 2,
    height: doc.height + padding * 2,
  });

  const layer = new Konva.Layer({ listening: false });
  stage.add(layer);

  if (padding > 0 || options.background) {
    layer.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: stage.width(),
        height: stage.height(),
        fill: options.background ?? '#ffffff',
      }),
    );
  }

  const group = new Konva.Group({ x: padding, y: padding });
  layer.add(group);

  for (const descriptor of describeScene(doc)) {
    const node = buildNode(descriptor, images);
    group.add(node);
    if (descriptor.needsCache) {
      try {
        node.cache();
      } catch {
        /* filters unsupported for this node — draw unfiltered */
      }
    }
  }

  layer.draw();

  const canvas = stage.toCanvas({ pixelRatio });

  return {
    canvas,
    dispose: () => {
      stage.destroy();
      host.remove();
    },
  };
}

export async function renderSceneToDataURL(
  doc: DesignDocument,
  options: RenderOptions & { mime?: 'image/png' | 'image/jpeg'; quality?: number } = {},
): Promise<string> {
  const { canvas, dispose } = await renderSceneToCanvas(doc, options);
  const url = canvas.toDataURL(options.mime ?? 'image/png', options.quality ?? 0.92);
  dispose();
  return url;
}

export async function renderSceneToBlob(
  doc: DesignDocument,
  options: RenderOptions & { mime?: 'image/png' | 'image/jpeg'; quality?: number } = {},
): Promise<Blob> {
  const { canvas, dispose } = await renderSceneToCanvas(doc, options);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, options.mime ?? 'image/png', options.quality ?? 0.92),
  );
  dispose();
  if (!blob) throw new Error('Canvas could not be encoded');
  return blob;
}

/** Thumbnail helper that fits the design into a max box. */
export async function renderThumbnail(
  doc: DesignDocument,
  maxSize = 640,
): Promise<string> {
  const ratio = Math.min(maxSize / doc.width, maxSize / doc.height);
  return renderSceneToDataURL(doc, { pixelRatio: Math.max(0.15, ratio) });
}
