/**
 * Design Engine — document versioning & migrations.
 *
 * Every persisted design carries `version`. When the schema changes we add a
 * migration here and old documents are upgraded on load, forever. This is the
 * single most important piece of future-proofing in the whole codebase: it is
 * what lets the poster editor grow into a general visual design platform
 * without ever breaking a saved file.
 */

import type { DesignDocument, DesignElement, SerializedDesign } from './types';
import { uid } from './geometry';

export const CURRENT_VERSION = 1;

export interface Migration {
  /** version this migration upgrades FROM */
  from: number;
  to: number;
  description: string;
  migrate: (doc: SerializedDesign) => SerializedDesign;
}

/**
 * v0 -> v1
 * v0 is the "pre-versioned" shape: `{ canvas, background, elements }` with no
 * id/name/metadata and no z-order on elements.
 */
const v0ToV1: Migration = {
  from: 0,
  to: 1,
  description: 'Add id/name/metadata, normalise element z-order and defaults',
  migrate: (doc) => {
    const raw = doc as unknown as Record<string, unknown>;
    const elements = (Array.isArray(raw.elements) ? raw.elements : []).map(
      (el, index) => normaliseElement(el as Record<string, unknown>, index),
    );
    return {
      version: 1,
      id: (raw.id as string) ?? uid('doc'),
      name: (raw.name as string) ?? 'Untitled design',
      canvas: {
        width: Number((raw.canvas as Record<string, number>)?.width) || 1080,
        height: Number((raw.canvas as Record<string, number>)?.height) || 1080,
      },
      background: (raw.background as SerializedDesign['background']) ?? '#ffffff',
      elements,
      metadata: {
        createdAt: (raw.createdAt as string) ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        visibility: 'private',
        ...((raw.metadata as object) ?? {}),
      },
    } as SerializedDesign;
  },
};

function normaliseElement(el: Record<string, unknown>, index: number): DesignElement {
  const base = {
    id: (el.id as string) ?? uid('el'),
    name: el.name as string | undefined,
    x: Number(el.x) || 0,
    y: Number(el.y) || 0,
    width: Number(el.width) || 100,
    height: Number(el.height) || 100,
    rotation: Number(el.rotation) || 0,
    opacity: el.opacity === undefined ? 1 : Number(el.opacity),
    z: el.z === undefined ? index : Number(el.z),
    locked: Boolean(el.locked),
    hidden: Boolean(el.hidden),
  };
  if (el.type === 'group' && Array.isArray(el.children)) {
    return {
      ...base,
      type: 'group',
      children: (el.children as Record<string, unknown>[]).map(normaliseElement),
    } as DesignElement;
  }
  return { ...base, type: (el.type as DesignElement['type']) ?? 'shape' } as DesignElement;
}

/** Ordered registry — apply in ascending `from`. */
export const migrations: Migration[] = [v0ToV1];

/**
 * Upgrade any serialized design to CURRENT_VERSION.
 * Unknown/future versions are passed through untouched so a newer client's
 * document is never silently destroyed by an older one.
 */
export function migrate(input: SerializedDesign | Record<string, unknown>): SerializedDesign {
  let doc = input as SerializedDesign;
  let version = typeof doc.version === 'number' ? doc.version : 0;

  if (version > CURRENT_VERSION) return doc;

  let guard = 0;
  while (version < CURRENT_VERSION && guard++ < 50) {
    const step = migrations
      .filter((m) => m.from === version)
      .sort((a, b) => a.to - b.to)[0];
    if (!step) break;
    doc = step.migrate(doc);
    version = doc.version ?? step.to;
  }
  doc.version = CURRENT_VERSION;
  return doc;
}

/* ------------------------------------------------------------------ */
/* Conversions between the in-memory document and the wire format      */
/* ------------------------------------------------------------------ */

export function toSerialized(doc: DesignDocument): SerializedDesign {
  return {
    version: CURRENT_VERSION,
    id: doc.id,
    name: doc.name,
    canvas: { width: doc.width, height: doc.height },
    background: doc.background,
    elements: doc.elements,
    metadata: doc.metadata,
  };
}

export function fromSerialized(input: SerializedDesign | Record<string, unknown>): DesignDocument {
  const s = migrate(input);
  return {
    id: s.id,
    name: s.name,
    width: s.canvas.width,
    height: s.canvas.height,
    background: s.background,
    elements: s.elements ?? [],
    metadata: s.metadata,
  };
}

export function serializeToJSON(doc: DesignDocument): string {
  return JSON.stringify(toSerialized(doc), null, 2);
}

export function parseDesignJSON(json: string): DesignDocument {
  return fromSerialized(JSON.parse(json) as SerializedDesign);
}
