import { useEffect, useRef } from 'react';
import { useEditorStore, useProjectStore } from '@/stores';

/**
 * Autosave. Debounced on document changes so a drag does not write to storage
 * on every frame, and skipped while a gesture is in flight.
 */
export function useAutosave(enabled = true, delayMs = 2500) {
  const document = useEditorStore((s) => s.document);
  const dirty = useEditorStore((s) => s.dirty);
  const markSaved = useEditorStore((s) => s.markSaved);
  const save = useProjectStore((s) => s.save);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !dirty) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void save(document, { silent: true }).then((summary) => {
        if (summary) markSaved();
      });
    }, delayMs);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [document, dirty, enabled, delayMs, save, markSaved]);
}
