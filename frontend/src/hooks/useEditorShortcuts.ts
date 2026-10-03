import { useEffect } from 'react';
import { useEditorStore, useUIStore } from '@/stores';

const EDITABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (EDITABLE.has(target.tagName)) return true;
  return target.isContentEditable;
}

/**
 * Global editor keyboard shortcuts.
 *
 * Deliberately conservative: anything pressed while focus is inside a text
 * field is ignored, so typing "delete" in a headline never removes a layer.
 */
export function useEditorShortcuts() {
  const store = useEditorStore;
  const ui = useUIStore;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const editor = store.getState();
      const uiState = ui.getState();
      const mod = event.metaKey || event.ctrlKey;
      const typing = isTypingTarget(event.target);

      /* ---- editing an element's text: let the field handle it ---- */
      if (editor.editingTextId && typing) {
        if (event.key === 'Escape') {
          event.preventDefault();
          editor.endTextEdit();
          (event.target as HTMLElement)?.blur();
        }
        return;
      }

      if (typing && !mod) return;

      const selection = editor.selection;
      const step = event.shiftKey ? 10 : 1;

      /* ---- history ---------------------------------------------- */
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        editor.redo();
        return;
      }

      /* ---- clipboard -------------------------------------------- */
      if (mod && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        editor.copy();
        return;
      }
      if (mod && event.key.toLowerCase() === 'x') {
        event.preventDefault();
        editor.cut();
        return;
      }
      if (mod && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        editor.paste();
        return;
      }
      if (mod && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        editor.duplicate();
        return;
      }
      if (mod && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        editor.selectAll();
        return;
      }
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('designforge:save'));
        return;
      }

      /* ---- grouping --------------------------------------------- */
      if (mod && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        if (event.shiftKey) editor.ungroup();
        else editor.group();
        return;
      }

      /* ---- zoom ------------------------------------------------- */
      if (mod && (event.key === '=' || event.key === '+')) {
        event.preventDefault();
        uiState.zoomBy(1.2);
        return;
      }
      if (mod && event.key === '-') {
        event.preventDefault();
        uiState.zoomBy(1 / 1.2);
        return;
      }
      if (mod && event.key === '0') {
        event.preventDefault();
        uiState.setZoom(1, 'manual');
        return;
      }
      if (mod && event.key === '1') {
        event.preventDefault();
        uiState.requestFit();
        return;
      }

      /* ---- panels ----------------------------------------------- */
      if (mod && event.key === '\\') {
        event.preventDefault();
        uiState.toggleLeftPanel();
        return;
      }
      if (mod && event.key === '/') {
        event.preventDefault();
        uiState.openDialog('shortcuts');
        return;
      }

      /* ---- selection movement ----------------------------------- */
      if (selection.length) {
        const arrows: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        };
        const delta = arrows[event.key];
        if (delta) {
          event.preventDefault();
          editor.move(selection, delta[0], delta[1], 'nudge');
          return;
        }

        if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault();
          editor.remove(selection);
          return;
        }

        if (event.key === 'Escape') {
          editor.clearSelection();
          return;
        }

        /* z-order */
        if (event.key === ']' && !mod) {
          event.preventDefault();
          editor.reorder(selection[0], 'forward');
          return;
        }
        if (event.key === '[' && !mod) {
          event.preventDefault();
          editor.reorder(selection[0], 'backward');
          return;
        }
        if (event.key === ']' && mod) {
          event.preventDefault();
          editor.reorder(selection[0], 'front');
          return;
        }
        if (event.key === '[' && mod) {
          event.preventDefault();
          editor.reorder(selection[0], 'back');
          return;
        }

        /* lock / hide */
        if (mod && event.key.toLowerCase() === 'l') {
          event.preventDefault();
          editor.toggleLock(selection[0]);
          return;
        }
        if (mod && event.key.toLowerCase() === 'h') {
          event.preventDefault();
          editor.toggleHidden(selection[0]);
          return;
        }
      }

      /* ---- creation --------------------------------------------- */
      if (!mod) {
        if (event.key.toLowerCase() === 't') {
          event.preventDefault();
          editor.addText();
          return;
        }
        if (event.key.toLowerCase() === 'r') {
          event.preventDefault();
          editor.addShape('rect');
          return;
        }
        if (event.key.toLowerCase() === 'o') {
          event.preventDefault();
          editor.addShape('ellipse');
          return;
        }
        if (event.key.toLowerCase() === 'l') {
          event.preventDefault();
          editor.addLine();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store, ui]);
}
