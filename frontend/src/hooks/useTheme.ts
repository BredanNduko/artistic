import { useEffect } from 'react';
import { resolveTheme, useUIStore } from '@/stores';

/**
 * Applies the theme to <html>. Kept as a hook so both the app shell and the
 * standalone editor route can mount it without duplicating the logic.
 */
export function useTheme() {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const resolved = resolveTheme(theme);
      root.classList.toggle('dark', resolved === 'dark');
      root.style.colorScheme = resolved;
    };
    apply();

    if (theme !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [theme]);

  return theme;
}
