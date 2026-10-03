/**
 * My designs — the saved design library.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Copy,
  Grid3x3,
  LayoutList,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjectStore } from '@/stores';
import { formatLabel } from '@/data/formats';
import { categoryLabel } from '@/data/categories';
import { cn, formatRelativeTime, pluralise } from '@/lib/utils';

export default function MyDesignsPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const loading = useProjectStore((s) => s.loading);
  const load = useProjectStore((s) => s.load);
  const remove = useProjectStore((s) => s.remove);
  const duplicate = useProjectStore((s) => s.duplicate);
  const rename = useProjectStore((s) => s.rename);

  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [renaming, setRenaming] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(term) ||
        project.tags.some((tag) => tag.includes(term)) ||
        (project.category ?? '').includes(term),
    );
  }, [projects, search]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">My designs</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {loading
              ? 'Loading…'
              : projects.length
                ? `${pluralise(projects.length, 'design')} saved in this browser. Autosave keeps them current.`
                : 'Nothing saved yet — your designs will appear here automatically.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search designs…"
              className="w-52 pl-8"
            />
          </div>
          <div className="hidden items-center gap-0.5 rounded-md bg-surface-3 p-0.5 sm:flex">
            <button
              type="button"
              onClick={() => setView('grid')}
              aria-label="Grid view"
              className={cn(
                'rounded p-1.5 transition-colors',
                view === 'grid' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
              )}
            >
              <Grid3x3 className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              aria-label="List view"
              className={cn(
                'rounded p-1.5 transition-colors',
                view === 'list' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
              )}
            >
              <LayoutList className="size-3.5" />
            </button>
          </div>
          <Button asChild>
            <Link to="/new">
              <Plus /> New design
            </Link>
          </Button>
        </div>
      </header>

      {loading && !projects.length ? (
        <div className="flex items-center justify-center gap-2 py-20 text-ink-muted">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-xs">Loading your designs…</span>
        </div>
      ) : !visible.length ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong py-20 text-center">
          <p className="text-sm font-medium text-ink">
            {projects.length ? 'No designs match that search' : 'No designs yet'}
          </p>
          <p className="max-w-sm text-xs text-ink-soft">
            {projects.length
              ? 'Try a different search term.'
              : 'Open a template or start from a blank canvas — your work is saved automatically as you go.'}
          </p>
          {!projects.length && (
            <div className="mt-1 flex gap-2">
              <Button asChild>
                <Link to="/new">Create a design</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/templates">Browse templates</Link>
              </Button>
            </div>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((project) => (
            <article
              key={project.id}
              className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-[var(--shadow-panel)]"
            >
              <Link
                to={`/editor/${project.id}`}
                className="flex items-center justify-center bg-surface-2 p-3"
              >
                {project.thumbnail ? (
                  <img
                    src={project.thumbnail}
                    alt={project.name}
                    className="max-h-48 w-auto rounded border border-line"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="grid w-full place-items-center rounded border border-line bg-surface"
                    style={{
                      aspectRatio: `${project.width} / ${project.height}`,
                      maxHeight: 192,
                    }}
                  >
                    <span className="text-[10px] text-ink-muted">
                      {project.width} × {project.height}
                    </span>
                  </div>
                )}
              </Link>

              <div className="flex flex-col gap-1.5 p-3">
                <div className="flex items-start gap-1">
                  {renaming === project.id ? (
                    <Input
                      autoFocus
                      defaultValue={project.name}
                      className="h-7 text-xs"
                      onBlur={(event) => {
                        if (event.target.value.trim()) void rename(project.id, event.target.value.trim());
                        setRenaming(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur();
                        if (event.key === 'Escape') setRenaming(null);
                      }}
                    />
                  ) : (
                    <Link
                      to={`/editor/${project.id}`}
                      className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-brand"
                    >
                      {project.name}
                    </Link>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Design actions">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => navigate(`/editor/${project.id}`)}>
                        <Pencil /> Open in editor
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setRenaming(project.id)}>
                        <Pencil /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void duplicate(project.id)}>
                        <Copy /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        destructive
                        onSelect={() => {
                          if (window.confirm(`Delete “${project.name}”? This cannot be undone.`)) {
                            void remove(project.id);
                          }
                        }}
                      >
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {project.format && <Badge variant="outline">{formatLabel(project.format)}</Badge>}
                  {project.category && <Badge variant="muted">{categoryLabel(project.category)}</Badge>}
                </div>

                <p className="font-mono text-[10px] text-ink-muted">
                  {project.width} × {project.height} · {pluralise(project.elementCount, 'layer')} ·{' '}
                  {formatRelativeTime(project.updatedAt)}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-2 text-[11px] uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">Format</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Layers</th>
                <th className="px-4 py-2 font-medium">Updated</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((project) => (
                <tr key={project.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-2.5">
                    <Link to={`/editor/${project.id}`} className="font-medium text-ink hover:text-brand">
                      {project.name}
                    </Link>
                    <p className="font-mono text-[10px] text-ink-muted">
                      {project.width} × {project.height}
                    </p>
                  </td>
                  <td className="hidden px-4 py-2.5 text-xs text-ink-soft sm:table-cell">
                    {project.format ? formatLabel(project.format) : '—'}
                  </td>
                  <td className="hidden px-4 py-2.5 font-mono text-xs text-ink-soft md:table-cell">
                    {project.elementCount}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-muted">
                    {formatRelativeTime(project.updatedAt)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button variant="ghost" size="icon-sm" asChild aria-label="Open design">
                      <Link to={`/editor/${project.id}`}>
                        <Pencil />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete design"
                      onClick={() => {
                        if (window.confirm(`Delete “${project.name}”?`)) void remove(project.id);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
