import { useEffect, useMemo, useRef, useState } from 'react';
import { loadImage } from '@/engine';

/**
 * Load a set of image sources once and cache the decoded elements.
 * Used by the canvas and by any component that needs real pixels.
 */
export function useImageMap(sources: string[]): Map<string, HTMLImageElement> {
  const [version, setVersion] = useState(0);
  const cache = useRef(new Map<string, HTMLImageElement>());
  const key = sources.join('|');

  useEffect(() => {
    let cancelled = false;
    const pending = sources.filter((src) => src && !cache.current.has(src));
    if (!pending.length) return;

    Promise.all(
      pending.map(async (src) => {
        try {
          const img = await loadImage(src);
          return [src, img] as const;
        } catch {
          return [src, null] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      let changed = false;
      for (const [src, img] of entries) {
        if (img && !cache.current.has(src)) {
          cache.current.set(src, img);
          changed = true;
        }
      }
      if (changed) setVersion((v) => v + 1);
    });

    return () => {
      cancelled = true;
    };
    // `key` is the stable identity of the source list
  }, [key, sources]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => new Map(cache.current), [version, key]);
}

/** Measure an element with a ResizeObserver. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5
          ? prev
          : { width, height },
      );
    });
    observer.observe(node);
    setSize({ width: node.clientWidth, height: node.clientHeight });
    return () => observer.disconnect();
  }, []);

  return { ref, ...size };
}

/** Debounce a rapidly changing value (text input, slider drags). */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Track a media query. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = () => setMatches(mql.matches);
    handler();
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

/** Stable interval that always sees the latest callback. */
export function useInterval(callback: () => void, delay: number | null) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = window.setInterval(() => saved.current(), delay);
    return () => window.clearInterval(id);
  }, [delay]);
}
