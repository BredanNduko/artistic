/**
 * Editor store.
 *
 * Owns the live `DesignDocument`, the selection and the undo/redo stack.
 * It never talks to React, the canvas or the network — it only calls pure
 * engine operations. That is what keeps the editor reusable: the Konva canvas
 * is just one consumer of this store, and a future collaborative backend
 * would be another.
 *
 * Interaction model:
 *   - discrete edits  -> `apply(producer, label)` records one history entry
 *   - drags/resizes   -> `beginInteraction()` ... live updates ... `endInteraction()`
 *                        so a whole gesture collapses into a single undo step
 */

import { create } from 'zustand';
import {
  addElement,
  addElements,
  changeZ,
  clone,
  createDocument,
  createImage,
  createLine,
  createShape,
  createText,
  createHistory,
  commit as commitHistory,
  duplicateElement,
  estimateTextSize,
  findElement,
  groupElements,
  isSameDesign,
  moveElement,
  redo as historyRedo,
  removeElements,
  resizeCanvas as opResizeCanvas,
  setBackground as opSetBackground,
  setDocumentName as opSetDocumentName,
  toggleHidden,
  toggleLock,
  transformElement,
  undo as historyUndo,
  ungroupElement,
  updateElement as opUpdateElement,
  type Box,
  type DesignDocument,
  type DesignElement,
  type ElementPatch,
  type Guide,
  type HistoryState,
  type ShapeKind,
} from '@/engine';
import { DEFAULT_FORMAT_ID, getFormatOrDefault } from '@/lib/formats';

export type ZAction = 'front' | 'back' | 'forward' | 'backward';

export function blankDocument(formatId = DEFAULT_FORMAT_ID, name = 'Untitled design'): DesignDocument {
  const format = getFormatOrDefault(formatId);
  return createDocument({
    name,
    width: format.width,
    height: format.height,
    background: '#ffffff',
    metadata: { format: format.id, tags: [], visibility: 'private' },
  });
}

export interface EditorState {
  document: DesignDocument;
  history: HistoryState;
  selection: string[];
  hoveredId: string | null;
  /** id of the text element currently open for inline editing */
  editingTextId: string | null;
  /** id of the image element being cropped, if any */
  cropTargetId: string | null;
  /** live alignment guides produced by the snapping logic */
  guides: Guide[];
  clipboard: DesignElement[];
  dirty: boolean;
  /** snapshot taken at the start of a drag/resize gesture */
  interactionStart: DesignDocument | null;
}

export interface EditorActions {
  loadDocument: (doc: DesignDocument) => void;
  newDocument: (formatId?: string, name?: string) => void;
  renameDocument: (name: string) => void;
  markSaved: () => void;

  /* selection */
  select: (ids: string[], additive?: boolean) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setHovered: (id: string | null) => void;
  setGuides: (guides: Guide[]) => void;

  /* atomic edits */
  add: (element: DesignElement, label?: string) => void;
  addMany: (elements: DesignElement[], label?: string) => void;
  update: (id: string, patch: ElementPatch, label?: string, mergeKey?: string) => void;
  updateSelected: (patch: ElementPatch, label?: string, mergeKey?: string) => void;
  remove: (ids: string[], label?: string) => void;
  duplicate: (ids?: string[]) => void;
  move: (ids: string[], dx: number, dy: number, mergeKey?: string) => void;
  transform: (id: string, box: Partial<Box> & { rotation?: number }, label?: string) => void;
  reorder: (id: string, action: ZAction) => void;
  group: (ids?: string[]) => void;
  ungroup: (id?: string) => void;
  toggleLock: (id: string) => void;
  toggleHidden: (id: string) => void;
  renameElement: (id: string, name: string) => void;

  /* gesture lifecycle */
  beginInteraction: () => void;
  endInteraction: (label: string) => void;
  cancelInteraction: () => void;

  /* creation shortcuts */
  addText: (partial?: { text?: string; fontSize?: number; x?: number; y?: number }) => string;
  addShape: (shape: ShapeKind, options?: { x?: number; y?: number; width?: number; height?: number; fill?: string }) => string;
  addLine: () => string;
  addImageElement: (src: string, options?: { assetId?: string; name?: string; naturalWidth?: number; naturalHeight?: number }) => string;
  replaceImage: (id: string, src: string, assetId?: string) => void;

  /* text editing */
  beginTextEdit: (id: string) => void;
  endTextEdit: () => void;
  setText: (id: string, text: string, mergeKey?: string) => void;

  /* crop */
  beginCrop: (id: string) => void;
  endCrop: () => void;

  /* document level */
  setBackground: (background: DesignDocument['background']) => void;
  setCanvasSize: (width: number, height: number, strategy?: 'keep' | 'scale' | 'center') => void;
  alignSelected: (axis: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => void;

  /* clipboard */
  copy: () => void;
  cut: () => void;
  paste: () => void;

  /* history */
  undo: () => void;
  redo: () => void;
}

export type EditorStore = EditorState & EditorActions;

const initial = blankDocument();

export const useEditorStore = create<EditorStore>((set, get) => {
  /** Run a pure engine operation and record it as one history entry. */
  const apply = (
    producer: (doc: DesignDocument) => DesignDocument,
    label: string,
    mergeKey?: string,
  ) => {
    const { document, history } = get();
    const next = producer(document);
    if (isSameDesign(document, next)) return;
    set({
      document: next,
      history: commitHistory(history, document, next, { label, mergeKey }),
      dirty: true,
    });
  };

  /** Update the document without touching history (used during a gesture). */
  const applyLive = (producer: (doc: DesignDocument) => DesignDocument) => {
    const next = producer(get().document);
    set({ document: next, dirty: true });
  };

  const pruneSelection = (ids: string[], doc: DesignDocument) =>
    ids.filter((id) => Boolean(findElement(doc.elements, id)));

  const topLevelTargets = () => {
    const doc = get().document;
    return doc.elements.filter((el) => !el.locked && !el.hidden).map((el) => el.id);
  };

  return {
    document: initial,
    history: createHistory(),
    selection: [],
    hoveredId: null,
    editingTextId: null,
    cropTargetId: null,
    guides: [],
    clipboard: [],
    dirty: false,
    interactionStart: null,

    /* ---------------------------------------------------------- */
    loadDocument: (doc) =>
      set({
        document: doc,
        history: createHistory(),
        selection: [],
        hoveredId: null,
        editingTextId: null,
        cropTargetId: null,
        guides: [],
        dirty: false,
        interactionStart: null,
      }),

    newDocument: (formatId, name) =>
      get().loadDocument(blankDocument(formatId, name)),

    renameDocument: (name) => apply((doc) => opSetDocumentName(doc, name), 'Rename design', 'rename-doc'),

    markSaved: () => set({ dirty: false }),

    /* ---------------------------------------------------------- */

    select: (ids, additive = false) => {
      const current = get().selection;
      const next = additive ? [...new Set([...current, ...ids])] : ids;
      set({ selection: pruneSelection(next, get().document) });
    },

    toggleSelect: (id) => {
      const current = get().selection;
      set({
        selection: current.includes(id) ? current.filter((i) => i !== id) : [...current, id],
      });
    },

    selectAll: () => set({ selection: topLevelTargets() }),
    clearSelection: () => set({ selection: [], editingTextId: null, cropTargetId: null }),
    setHovered: (id) => set({ hoveredId: id }),
    setGuides: (guides) => set({ guides }),

    /* ---------------------------------------------------------- */

    add: (element, label = 'Add element') => {
      apply((doc) => addElement(doc, element), label);
      set({ selection: [element.id] });
    },

    addMany: (elements, label = 'Add elements') => {
      if (!elements.length) return;
      apply((doc) => addElements(doc, elements), label);
      set({ selection: elements.map((e) => e.id) });
    },

    update: (id, patch, label = 'Update element', mergeKey) =>
      apply((doc) => opUpdateElement(doc, id, patch), label, mergeKey),

    updateSelected: (patch, label = 'Update selection', mergeKey) => {
      const ids = get().selection;
      if (!ids.length) return;
      apply(
        (doc) => ids.reduce((acc, id) => opUpdateElement(acc, id, patch), doc),
        label,
        mergeKey,
      );
    },

    remove: (ids, label = 'Delete') => {
      if (!ids.length) return;
      apply((doc) => removeElements(doc, ids), label);
      set((state) => ({
        selection: state.selection.filter((id) => !ids.includes(id)),
        editingTextId: null,
        cropTargetId: null,
      }));
    },

    duplicate: (ids) => {
      const targetIds = ids ?? get().selection;
      if (!targetIds.length) return;
      let doc = get().document;
      const newIds: string[] = [];
      for (const id of targetIds) {
        const result = duplicateElement(doc, id);
        doc = result.doc;
        if (result.newId) newIds.push(result.newId);
      }
      const before = get().document;
      if (isSameDesign(before, doc)) return;
      set({
        document: doc,
        history: commitHistory(get().history, before, doc, { label: 'Duplicate' }),
        selection: newIds,
        dirty: true,
      });
    },

    move: (ids, dx, dy, mergeKey) => {
      if (!ids.length) return;
      apply(
        (doc) => ids.reduce((acc, id) => moveElement(acc, id, dx, dy), doc),
        'Move',
        mergeKey,
      );
    },

    transform: (id, box, label = 'Transform') =>
      apply((doc) => transformElement(doc, id, box), label, `transform:${id}`),

    reorder: (id, action) => {
      const labels: Record<ZAction, string> = {
        front: 'Bring to front',
        back: 'Send to back',
        forward: 'Bring forward',
        backward: 'Send backward',
      };
      apply((doc) => changeZ(doc, id, action), labels[action]);
    },

    group: (ids) => {
      const targetIds = ids ?? get().selection;
      if (targetIds.length < 2) return;
      const before = get().document;
      const { doc, groupId } = groupElements(before, targetIds);
      if (!groupId) return;
      set({
        document: doc,
        history: commitHistory(get().history, before, doc, { label: 'Group' }),
        selection: [groupId],
        dirty: true,
      });
    },

    ungroup: (id) => {
      const targetId = id ?? get().selection[0];
      if (!targetId) return;
      const before = get().document;
      const { doc, childIds } = ungroupElement(before, targetId);
      if (!childIds.length) return;
      set({
        document: doc,
        history: commitHistory(get().history, before, doc, { label: 'Ungroup' }),
        selection: childIds,
        dirty: true,
      });
    },

    toggleLock: (id) => {
      const el = findElement(get().document.elements, id);
      apply((doc) => toggleLock(doc, id), el?.locked ? 'Unlock' : 'Lock');
    },

    toggleHidden: (id) => {
      const el = findElement(get().document.elements, id);
      apply((doc) => toggleHidden(doc, id), el?.hidden ? 'Show' : 'Hide');
    },

    renameElement: (id, name) => apply((doc) => opUpdateElement(doc, id, { name }), 'Rename layer'),

    /* ---------------------------------------------------------- */

    beginInteraction: () => set({ interactionStart: clone(get().document) }),

    endInteraction: (label) => {
      const start = get().interactionStart;
      const current = get().document;
      set({ interactionStart: null, guides: [] });
      if (!start || isSameDesign(start, current)) return;
      set({ history: commitHistory(get().history, start, current, { label }) });
    },

    cancelInteraction: () => {
      const start = get().interactionStart;
      if (!start) return;
      set({ document: start, interactionStart: null, guides: [] });
    },

    /* ---------------------------------------------------------- */

    addText: (partial = {}) => {
      const doc = get().document;
      const text = partial.text ?? 'Add your text';
      const fontSize = partial.fontSize ?? Math.round(Math.min(doc.width, doc.height) * 0.07);
      const measured = estimateTextSize(text, fontSize, 700, 1.15);
      const width = Math.min(doc.width * 0.8, Math.max(measured.width + 24, doc.width * 0.5));
      const element = createText(text, {
        x: partial.x ?? Math.round((doc.width - width) / 2),
        y: partial.y ?? Math.round(doc.height / 2 - measured.height / 2),
        width,
        height: measured.height + 8,
        fontSize,
        fontFamily: 'Inter',
        fontWeight: 700,
        color: '#111827',
        align: 'center',
      });
      get().add(element, 'Add text');
      set({ editingTextId: element.id });
      return element.id;
    },

    addShape: (shape, options = {}) => {
      const doc = get().document;
      const base = Math.round(Math.min(doc.width, doc.height) * 0.28);
      const width = options.width ?? base;
      const height = options.height ?? base;
      const element = createShape({
        shape,
        x: options.x ?? Math.round((doc.width - width) / 2),
        y: options.y ?? Math.round((doc.height - height) / 2),
        width,
        height,
        fill: options.fill ?? '#4f46e5',
        cornerRadius: shape === 'roundRect' ? 28 : 0,
      });
      get().add(element, 'Add shape');
      return element.id;
    },

    addLine: () => {
      const doc = get().document;
      const width = Math.round(doc.width * 0.5);
      const element = createLine({
        x: Math.round((doc.width - width) / 2),
        y: Math.round(doc.height / 2),
        width,
        height: 0,
        points: [0, 0, width, 0],
        stroke: { color: '#111827', width: 3 },
      });
      get().add(element, 'Add line');
      return element.id;
    },

    addImageElement: (src, options = {}) => {
      const doc = get().document;
      const maxW = doc.width * 0.55;
      const maxH = doc.height * 0.55;
      const naturalW = options.naturalWidth ?? 1200;
      const naturalH = options.naturalHeight ?? 1200;
      const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
      const width = Math.max(80, Math.round(naturalW * scale));
      const height = Math.max(80, Math.round(naturalH * scale));
      const element = createImage(src, {
        name: options.name ?? 'Image',
        x: Math.round((doc.width - width) / 2),
        y: Math.round((doc.height - height) / 2),
        width,
        height,
        fit: 'cover',
        assetId: options.assetId,
      });
      get().add(element, 'Add image');
      return element.id;
    },

    replaceImage: (id, src, assetId) => {
      const el = findElement(get().document.elements, id);
      if (!el || el.type !== 'image') return;
      apply(
        (doc) => opUpdateElement(doc, id, { src, assetId, crop: undefined }),
        'Replace image',
      );
    },

    /* ---------------------------------------------------------- */

    beginTextEdit: (id) => set({ editingTextId: id }),
    endTextEdit: () => set({ editingTextId: null }),
    setText: (id, text, mergeKey) =>
      apply((doc) => opUpdateElement(doc, id, { text }), 'Edit text', mergeKey ?? `text:${id}`),

    beginCrop: (id) => {
      const el = findElement(get().document.elements, id);
      if (!el || el.type !== 'image') return;
      set({ cropTargetId: id, selection: [id] });
    },
    endCrop: () => set({ cropTargetId: null }),

    /* ---------------------------------------------------------- */

    setBackground: (background) => apply((doc) => opSetBackground(doc, background), 'Change background', 'background'),

    setCanvasSize: (width, height, strategy = 'scale') =>
      apply(
        (doc) => opResizeCanvas(doc, Math.max(16, Math.round(width)), Math.max(16, Math.round(height)), strategy),
        'Resize canvas',
      ),

    alignSelected: (axis) => {
      const { selection, document: doc } = get();
      if (!selection.length) return;
      apply(
        (current) =>
          selection.reduce((acc, id) => {
            const el = findElement(acc.elements, id);
            if (!el) return acc;
            const box: Partial<Box> & { rotation?: number } = {
              width: el.width,
              height: el.height,
              rotation: el.rotation,
            };
            switch (axis) {
              case 'left':
                box.x = 0;
                break;
              case 'right':
                box.x = doc.width - el.width;
                break;
              case 'hcenter':
                box.x = Math.round((doc.width - el.width) / 2);
                break;
              case 'top':
                box.y = 0;
                break;
              case 'bottom':
                box.y = doc.height - el.height;
                break;
              case 'vcenter':
                box.y = Math.round((doc.height - el.height) / 2);
                break;
            }
            return transformElement(acc, id, box);
          }, current),
        `Align ${axis}`,
      );
    },

    /* ---------------------------------------------------------- */

    copy: () => {
      const { selection, document: doc } = get();
      const items = selection
        .map((id) => findElement(doc.elements, id))
        .filter((el): el is DesignElement => Boolean(el))
        .map((el) => clone(el));
      if (items.length) set({ clipboard: items });
    },

    cut: () => {
      get().copy();
      get().remove(get().selection, 'Cut');
    },

    paste: () => {
      const { clipboard } = get();
      if (!clipboard.length) return;
      const stamp = Date.now().toString(36).slice(-4);
      const remap = (el: DesignElement, offset: number): DesignElement => {
        const base = {
          ...clone(el),
          id: `${el.type.slice(0, 3)}_${stamp}${offset}${Math.random().toString(36).slice(2, 5)}`,
          x: el.x + 28,
          y: el.y + 28,
        } as DesignElement;
        if (base.type === 'group') {
          return { ...base, children: base.children.map((c, i) => remap(c, i)) } as DesignElement;
        }
        return base;
      };
      const pasted = clipboard.map((el, i) => remap(el, i));
      get().addMany(pasted, 'Paste');
    },

    /* ---------------------------------------------------------- */

    undo: () => {
      const result = historyUndo(get().history);
      if (!result) return;
      set({
        document: result.document,
        history: result.history,
        selection: pruneSelection(get().selection, result.document),
        dirty: true,
      });
    },

    redo: () => {
      const result = historyRedo(get().history);
      if (!result) return;
      set({
        document: result.document,
        history: result.history,
        selection: pruneSelection(get().selection, result.document),
        dirty: true,
      });
    },
  };
});

/* ------------------------------------------------------------------ */
/* Derived selectors — keep components from re-deriving this logic     */
/* ------------------------------------------------------------------ */

export const selectSelectedElements = (state: EditorStore): DesignElement[] =>
  state.selection
    .map((id) => findElement(state.document.elements, id))
    .filter((el): el is DesignElement => Boolean(el));

export const selectPrimarySelection = (state: EditorStore): DesignElement | null =>
  selectSelectedElements(state)[0] ?? null;

export const selectCanUndo = (state: EditorStore) => state.history.past.length > 0;
export const selectCanRedo = (state: EditorStore) => state.history.future.length > 0;
export const selectUndoLabel = (state: EditorStore) =>
  state.history.past[state.history.past.length - 1]?.label ?? null;
export const selectRedoLabel = (state: EditorStore) =>
  state.history.future[state.history.future.length - 1]?.label ?? null;
