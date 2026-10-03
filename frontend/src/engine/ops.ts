/**
 * Design Engine — pure document operations.
 *
 * Every function here takes a DesignDocument and returns a NEW document.
 * No mutation, no side effects, no store awareness. That makes the whole
 * engine trivially testable and lets undo/redo work by snapshotting.
 */

import type {
  Background,
  Box,
  DesignDocument,
  DesignElement,
  ElementPatch,
  GroupElement,
  TextElement,
} from './types';
import { clone, findElement, flatten, leaves, uid, unionBounds } from './geometry';
import { createGroup } from './factories';

const touch = (doc: DesignDocument): DesignDocument => ({
  ...doc,
  metadata: { ...doc.metadata, updatedAt: new Date().toISOString() },
});

/* ------------------------------------------------------------------ */
/* Insert / update / delete                                            */
/* ------------------------------------------------------------------ */

export function addElement(doc: DesignDocument, element: DesignElement): DesignDocument {
  const maxZ = doc.elements.reduce((m, e) => Math.max(m, e.z), -1);
  return touch({
    ...doc,
    elements: [...doc.elements, { ...element, z: maxZ + 1 }],
  });
}

export function addElements(doc: DesignDocument, elements: DesignElement[]): DesignDocument {
  let next = doc;
  for (const el of elements) next = addElement(next, el);
  return next;
}

/** Shallow-merge a patch onto one element, anywhere in the tree. */
export function updateElement(
  doc: DesignDocument,
  id: string,
  patch: ElementPatch,
): DesignDocument {
  const apply = (elements: DesignElement[]): DesignElement[] =>
    elements.map((el) => {
      if (el.id === id) return { ...el, ...patch } as DesignElement;
      if (el.type === 'group') return { ...el, children: apply(el.children) };
      return el;
    });
  return touch({ ...doc, elements: apply(doc.elements) });
}

export function updateElements(
  doc: DesignDocument,
  patches: { id: string; patch: ElementPatch }[],
): DesignDocument {
  return patches.reduce((acc, p) => updateElement(acc, p.id, p.patch), doc);
}

export function removeElements(doc: DesignDocument, ids: string[]): DesignDocument {
  const set = new Set(ids);
  const apply = (elements: DesignElement[]): DesignElement[] =>
    elements
      .filter((el) => !set.has(el.id))
      .map((el) =>
        el.type === 'group' ? { ...el, children: apply(el.children) } : el,
      );
  return touch({ ...doc, elements: apply(doc.elements) });
}

export function duplicateElement(
  doc: DesignDocument,
  id: string,
  offset = 24,
): { doc: DesignDocument; newId: string | null } {
  const el = findElement(doc.elements, id);
  if (!el) return { doc, newId: null };

  const copy = clone(el);
  const reid = (node: DesignElement, dx: number, dy: number): DesignElement => {
    const base = {
      ...node,
      id: uid(node.type === 'group' ? 'grp' : node.type.slice(0, 3)),
      x: node.x + dx,
      y: node.y + dy,
    } as DesignElement;
    if (base.type === 'group') {
      return { ...base, children: (node as GroupElement).children.map((c) => reid(c, 0, 0)) } as GroupElement;
    }
    return base;
  };

  const reidentified = reid(copy, offset, offset);
  const inserted = addElement(doc, { ...reidentified, name: `${el.name ?? el.type} copy` });
  return { doc: inserted, newId: reidentified.id };
}

/* ------------------------------------------------------------------ */
/* Movement & transforms                                               */
/* ------------------------------------------------------------------ */

export function moveElement(doc: DesignDocument, id: string, dx: number, dy: number): DesignDocument {
  const el = findElement(doc.elements, id);
  if (!el || el.locked) return doc;
  const shift = (node: DesignElement): DesignElement => {
    const next = { ...node, x: node.x + dx, y: node.y + dy } as DesignElement;
    if (next.type === 'group') {
      return { ...next, children: (node as GroupElement).children.map(shift) } as GroupElement;
    }
    return next;
  };
  const apply = (elements: DesignElement[]): DesignElement[] =>
    elements.map((node) => (node.id === id ? shift(node) : node.type === 'group' ? { ...node, children: apply(node.children) } : node));
  return touch({ ...doc, elements: apply(doc.elements) });
}

/**
 * Apply a new box to an element, scaling its visual content with it.
 * Used by the canvas transformer. Groups scale their children proportionally.
 */
export function transformElement(
  doc: DesignDocument,
  id: string,
  box: Partial<Box> & { rotation?: number },
): DesignDocument {
  const el = findElement(doc.elements, id);
  if (!el || el.locked) return doc;

  const nextX = box.x ?? el.x;
  const nextY = box.y ?? el.y;
  const nextW = Math.max(4, box.width ?? el.width);
  const nextH = Math.max(4, box.height ?? el.height);
  const sx = nextW / (el.width || 1);
  const sy = nextH / (el.height || 1);
  const uniform = (sx + sy) / 2;

  const rescale = (node: DesignElement): DesignElement => {
    const scaled = {
      ...node,
      x: nextX + (node.x - el.x) * sx,
      y: nextY + (node.y - el.y) * sy,
      width: Math.max(1, node.width * sx),
      height: Math.max(1, node.height * sy),
    } as DesignElement;

    if (scaled.type === 'text') {
      const t = scaled as TextElement;
      return { ...t, fontSize: Math.max(4, t.fontSize * uniform) };
    }
    if (scaled.type === 'line') {
      return {
        ...scaled,
        points: scaled.points.map((p, i) => p * (i % 2 === 0 ? sx : sy)),
      } as DesignElement;
    }
    if (scaled.type === 'group') {
      const g = scaled as GroupElement;
      return { ...g, children: g.children.map(rescale) } as GroupElement;
    }
    if (scaled.type === 'shape' && scaled.stroke) {
      return { ...scaled, stroke: { ...scaled.stroke, width: scaled.stroke.width * uniform } };
    }
    return scaled;
  };

  const apply = (elements: DesignElement[]): DesignElement[] =>
    elements.map((node) => {
      if (node.id === id) {
        const updated = rescale(node) as DesignElement;
        return {
          ...updated,
          x: nextX,
          y: nextY,
          width: nextW,
          height: nextH,
          rotation: box.rotation ?? el.rotation,
        } as DesignElement;
      }
      if (node.type === 'group') return { ...node, children: apply(node.children) };
      return node;
    });

  return touch({ ...doc, elements: apply(doc.elements) });
}

export function setElementBox(doc: DesignDocument, id: string, box: Box): DesignDocument {
  const el = findElement(doc.elements, id);
  if (!el) return doc;
  return transformElement(doc, id, box);
}

/** Nudge with optional alignment distribution (future-proof hook). */
export function nudge(doc: DesignDocument, ids: string[], dx: number, dy: number): DesignDocument {
  return ids.reduce((acc, id) => moveElement(acc, id, dx, dy), doc);
}

/* ------------------------------------------------------------------ */
/* Z-order                                                             */
/* ------------------------------------------------------------------ */

type ZAction = 'front' | 'back' | 'forward' | 'backward';

function reindex(elements: DesignElement[]): DesignElement[] {
  return [...elements]
    .sort((a, b) => a.z - b.z)
    .map((el, i) => ({ ...el, z: i }));
}

export function changeZ(doc: DesignDocument, id: string, action: ZAction): DesignDocument {
  const el = findElement(doc.elements, id);
  if (!el) return doc;
  const apply = (elements: DesignElement[]): DesignElement[] => {
    const sorted = reindex(elements);
    const index = sorted.findIndex((e) => e.id === id);
    if (index < 0) return sorted;
    const [item] = sorted.splice(index, 1);
    const target =
      action === 'front'
        ? sorted.length
        : action === 'back'
          ? 0
          : action === 'forward'
            ? Math.min(sorted.length, index + 1)
            : Math.max(0, index - 1);
    sorted.splice(target, 0, item);
    return sorted.map((e, i) => ({ ...e, z: i }));
  };

  const top = apply(doc.elements);
  return touch({
    ...doc,
    elements: top.map((node) =>
      node.type === 'group' ? { ...node, children: reindex(node.children) } : node,
    ),
  });
}

/** Move an element to an explicit z index (used by layers drag-reorder). */
export function setZIndex(doc: DesignDocument, id: string, z: number): DesignDocument {
  const sorted = reindex(doc.elements);
  const index = sorted.findIndex((e) => e.id === id);
  if (index < 0) return doc;
  const [item] = sorted.splice(index, 1);
  sorted.splice(Math.max(0, Math.min(sorted.length, z)), 0, item);
  return touch({ ...doc, elements: sorted.map((e, i) => ({ ...e, z: i })) });
}

export function reorderElements(doc: DesignDocument, orderedIds: string[]): DesignDocument {
  const map = new Map(doc.elements.map((e) => [e.id, e]));
  const next = orderedIds
    .map((id) => map.get(id))
    .filter((e): e is DesignElement => Boolean(e))
    .map((e, i) => ({ ...e, z: i }));
  const missing = doc.elements.filter((e) => !orderedIds.includes(e.id));
  return touch({ ...doc, elements: [...next, ...missing] });
}

/* ------------------------------------------------------------------ */
/* Flags                                                               */
/* ------------------------------------------------------------------ */

export function toggleLock(doc: DesignDocument, id: string): DesignDocument {
  const el = findElement(doc.elements, id);
  if (!el) return doc;
  return updateElement(doc, id, { locked: !el.locked });
}

export function toggleHidden(doc: DesignDocument, id: string): DesignDocument {
  const el = findElement(doc.elements, id);
  if (!el) return doc;
  return updateElement(doc, id, { hidden: !el.hidden });
}

export function renameElement(doc: DesignDocument, id: string, name: string): DesignDocument {
  return updateElement(doc, id, { name });
}

/* ------------------------------------------------------------------ */
/* Grouping                                                            */
/* ------------------------------------------------------------------ */

export function groupElements(doc: DesignDocument, ids: string[]): { doc: DesignDocument; groupId: string | null } {
  const top = doc.elements.filter((e) => ids.includes(e.id));
  if (top.length < 2) return { doc, groupId: null };
  const others = doc.elements.filter((e) => !ids.includes(e.id));
  const maxZ = others.reduce((m, e) => Math.max(m, e.z), -1);
  const group = createGroup(reindex(top).map((e) => ({ ...e, z: e.z })), { z: maxZ + 1 });
  return { doc: touch({ ...doc, elements: [...others, group] }), groupId: group.id };
}

export function ungroupElement(doc: DesignDocument, id: string): { doc: DesignDocument; childIds: string[] } {
  const el = findElement(doc.elements, id);
  if (!el || el.type !== 'group') return { doc, childIds: [] };
  const group = el as GroupElement;
  const others = doc.elements.filter((e) => e.id !== id);
  const released = group.children.map((child, i) => ({
    ...child,
    x: child.x + (group.x - unionBounds(group.children).x),
    y: child.y + (group.y - unionBounds(group.children).y),
    z: others.length + i,
  })) as DesignElement[];
  return { doc: touch({ ...doc, elements: [...others, ...released] }), childIds: released.map((c) => c.id) };
}

/* ------------------------------------------------------------------ */
/* Canvas                                                              */
/* ------------------------------------------------------------------ */

export function setBackground(doc: DesignDocument, background: Background): DesignDocument {
  return touch({ ...doc, background });
}

export function setDocumentName(doc: DesignDocument, name: string): DesignDocument {
  return touch({ ...doc, name });
}

/**
 * Resize the canvas. `strategy` decides what happens to existing elements:
 *  - 'keep'    : leave coordinates untouched (may crop)
 *  - 'scale'   : scale everything proportionally (true "AI resize" baseline)
 *  - 'center'  : keep element sizes, re-centre them on the new canvas
 */
export function resizeCanvas(
  doc: DesignDocument,
  width: number,
  height: number,
  strategy: 'keep' | 'scale' | 'center' = 'scale',
): DesignDocument {
  if (strategy === 'keep') return touch({ ...doc, width, height });

  if (strategy === 'center') {
    const dx = (width - doc.width) / 2;
    const dy = (height - doc.height) / 2;
    const shift = (el: DesignElement): DesignElement => {
      const next = { ...el, x: el.x + dx, y: el.y + dy } as DesignElement;
      if (next.type === 'group') {
        return { ...next, children: (el as GroupElement).children.map(shift) } as GroupElement;
      }
      return next;
    };
    return touch({ ...doc, width, height, elements: doc.elements.map(shift) });
  }

  const sx = width / doc.width;
  const sy = height / doc.height;
  const uniform = Math.min(sx, sy);
  const scaleNode = (el: DesignElement): DesignElement => {
    const next = {
      ...el,
      x: el.x * sx,
      y: el.y * sy,
      width: el.width * sx,
      height: el.height * sy,
    } as DesignElement;
    if (next.type === 'text') {
      return { ...next, fontSize: (next as TextElement).fontSize * uniform } as DesignElement;
    }
    if (next.type === 'line') {
      return { ...next, points: (next as DesignElement & { points: number[] }).points.map((p, i) => p * (i % 2 === 0 ? sx : sy)) };
    }
    if (next.type === 'group') {
      return { ...next, children: (next as GroupElement).children.map(scaleNode) } as GroupElement;
    }
    return next;
  };
  return touch({ ...doc, width, height, elements: doc.elements.map(scaleNode) });
}

/* ------------------------------------------------------------------ */
/* Selection helpers                                                   */
/* ------------------------------------------------------------------ */

export function selectableIds(doc: DesignDocument): string[] {
  return leaves(doc.elements)
    .filter((e) => !e.locked && !e.hidden)
    .map((e) => e.id);
}

export function centerElementOnCanvas(doc: DesignDocument, id: string, axis: 'x' | 'y' | 'both' = 'both'): DesignDocument {
  const el = findElement(doc.elements, id);
  if (!el) return doc;
  const box: Partial<Box> = {};
  if (axis === 'x' || axis === 'both') box.x = (doc.width - el.width) / 2;
  if (axis === 'y' || axis === 'both') box.y = (doc.height - el.height) / 2;
  return transformElement(doc, id, { ...box, width: el.width, height: el.height });
}

/** Deep equality on the serialisable payload — used to skip no-op history entries. */
export function isSameDesign(a: DesignDocument, b: DesignDocument): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function countElements(doc: DesignDocument): number {
  return flatten(doc.elements).length;
}
