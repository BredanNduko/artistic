/**
 * AppShell — chrome for every non-editor route.
 * The editor has its own full-bleed layout, so it opts out of this shell.
 */

import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Boxes,
  LayoutTemplate,
  Moon,
  Palette,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  LayoutGrid,
} from 'lucide-react';
import { Logo } from './Logo';
import { Button } from '@/components/ui/button';
import { Toaster } from './Toaster';
import { useUIStore, useUserStore } from '@/stores';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/designs', label: 'My designs', icon: LayoutGrid },
  { to: '/assets', label: 'Assets', icon: Boxes },
  { to: '/brand', label: 'Brand kit', icon: Palette },
  { to: '/ai', label: 'AI Studio', icon: Sparkles },
];

export function AppShell() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const initialise = useUserStore((s) => s.initialise);
  const user = useUserStore((s) => s.user);
  const location = useLocation();

  useEffect(() => {
    void initialise();
  }, [initialise]);

  // Scroll to top on route change — a long templates page should not carry
  // its scroll position into the editor.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <Logo className="size-7" withText />
          </Link>

          <nav className="ml-2 hidden items-center gap-0.5 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-surface-3 font-medium text-ink'
                      : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                  )
                }
              >
                <item.icon className="size-3.5" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
            <Button variant="ghost" size="icon-sm" asChild>
              <Link to="/settings" aria-label="Settings">
                <SettingsIcon />
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/new">
                <LayoutGrid /> New design
              </Link>
            </Button>
            {user ? (
              <span
                className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                style={{ background: user.avatarColor }}
                title={user.email}
              >
                {(user.name || user.email || '?').slice(0, 1).toUpperCase()}
              </span>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link to="/settings">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:px-6">
          <span>© {new Date().getFullYear()} DesignForge — a demo visual design platform.</span>
          <span className="sm:ml-auto">
            Local-first demo: designs and uploads are stored in this browser only.
          </span>
        </div>
      </footer>

      <Toaster />
    </div>
  );
}
