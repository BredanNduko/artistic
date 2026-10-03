/**
 * Renders a DesignDocument to a thumbnail data URL.
 *
 * Renders are serialised through a module-level queue: the offline Konva
 * renderer creates a real Stage per call, so firing a dozen at once on a grid
 * page would spike the main thread. A queue keeps the UI responsive and is
 * also the natural seam for moving thumbnail generation to a worker or a
 * backend render farm later.
 */

import { useEffect, useRef, useState } from 'react';
import { renderThumbnail, type DesignDocument } from '@/engine';

type Job = () => Promise<void>;

const queue: Job[] = [];
let running = false;

function pump() {
  if (running) return;
  const next = queue.shift();
  if (!next) return;
  running = true;
  next().finally(() => {
    running = false;
    pump();
  });
}

function enqueue(job: Job) {
  queue.push(job);
  // Yield to the browser before starting so first paint is never blocked.
  window.setTimeout(pump, 0);
}

const cache = new Map<string, string>();

function cacheKey(doc: DesignDocument, maxSize: number): string {
  return `${doc.id}:${maxSize}:${doc.metadata.updatedAt}:${doc.elements.length}`;
}

export function useDocumentThumbnail(
  doc: DesignDocument | null | undefined,
  maxSize = 512,
): { src: string | null; loading: boolean } {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!doc) {
      setSrc(null);
      return;
    }
    const key = cacheKey(doc, maxSize);
    const hit = cache.get(key);
    if (hit) {
      setSrc(hit);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;

    enqueue(async () => {
      try {
        const url = await renderThumbnail(doc, maxSize);
        cache.set(key, url);
        if (!cancelled && mounted.current) {
          setSrc(url);
        }
      } catch {
        if (!cancelled && mounted.current) setSrc(null);
      } finally {
        if (!cancelled && mounted.current) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // `doc` identity changes on every edit; the cache key above is the real
    // dependency, so we intentionally key off the serialisable parts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id, maxSize, doc?.metadata.updatedAt, doc?.elements.length]);

  return { src, loading };
}

/** Invalidate a cached thumbnail, e.g. after the user edits a design. */
export function invalidateThumbnail(docId: string) {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${docId}:`)) cache.delete(key);
  }
}
