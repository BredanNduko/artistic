/**
 * Templates page — browse, filter and open templates.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutTemplate, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TemplateGrid } from '@/components/templates/TemplateCard';
import { CATEGORIES } from '@/data/categories';
import { FORMATS, FORMAT_GROUPS } from '@/data/formats';
import { TEMPLATES, type DesignTemplate } from '@/data/templates';
import { useEditorStore, useUIStore } from '@/stores';
import { cn } from '@/lib/utils';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const pushToast = useUIStore((s) => s.pushToast);
  const addMany = useEditorStore((s) => s.addMany);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [format, setFormat] = useState('all');
  const [sort, setSort] = useState<'featured' | 'name' | 'layers'>('featured');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = TEMPLATES.filter((template) => {
      if (category !== 'all' && template.category !== category) return false;
      if (format !== 'all' && template.format !== format) return false;
      if (!term) return true;
      return (
        template.name.toLowerCase().includes(term) ||
        template.description.toLowerCase().includes(term) ||
        template.tags.some((tag) => tag.includes(term)) ||
        template.document.elements.some(
          (el) => el.type === 'text' && el.text.toLowerCase().includes(term),
        )
      );
    });

    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'layers') {
      return [...list].sort((a, b) => b.document.elements.length - a.document.elements.length);
    }
    return [...list].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  }, [search, category, format, sort]);

  const openTemplate = (template: DesignTemplate) => {
    navigate(`/editor/new?template=${template.id}`);
  };

  /** Merge into whatever is currently in the editor, without leaving the page. */
  const addToCanvas = (template: DesignTemplate) => {
    const document = useEditorStore.getState().document;
    const rand = () => Math.random().toString(36).slice(2, 7);
    const offsetX = (document.width - template.document.width) / 2;
    const offsetY = (document.height - template.document.height) / 2;
    const reid = (el: (typeof template.document.elements)[number]): typeof el => {
      const next = {
        ...el,
        id: `${el.type.slice(0, 3)}_${rand()}`,
        x: el.x + offsetX,
        y: el.y + offsetY,
      } as typeof el;
      if (next.type === 'group') {
        return { ...next, children: next.children.map(reid) } as typeof next;
      }
      return next;
    };
    addMany(template.document.elements.map(reid), 'Insert template');
    pushToast({
      title: 'Added to your canvas',
      description: `“${template.name}” is now in the editor, ready to move and edit.`,
      variant: 'success',
      action: { label: 'Open the editor', onClick: () => navigate('/editor/new') },
    });
  };

  const hasFilters = category !== 'all' || format !== 'all' || search.trim().length > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Templates</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            {TEMPLATES.length} original designs across {CATEGORIES.length} categories, each one a
            fully editable document. Filter by category or format, then open one to start editing.
          </p>
        </div>
        <Button asChild>
          <a href="/new">Start blank</a>
        </Button>
      </header>

      {/* filters */}
      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, tag or text inside a design…"
              className="pl-8"
            />
          </div>

          <select
            value={format}
            onChange={(event) => setFormat(event.target.value)}
            aria-label="Filter by format"
            className="h-9 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink outline-none focus-visible:border-brand"
          >
            <option value="all">All formats</option>
            {FORMAT_GROUPS.map((group) => (
              <optgroup key={group.id} label={group.label}>
                {FORMATS.filter((f) => f.group === group.id).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
            aria-label="Sort templates"
            className="h-9 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink outline-none focus-visible:border-brand"
          >
            <option value="featured">Featured first</option>
            <option value="name">Name A–Z</option>
            <option value="layers">Most layers</option>
          </select>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setCategory('all');
                setFormat('all');
              }}
            >
              <X /> Clear
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={category === 'all'} onClick={() => setCategory('all')} label="All" count={TEMPLATES.length} />
          {CATEGORIES.map((item) => {
            const count = TEMPLATES.filter((t) => t.category === item.id).length;
            return (
              <FilterChip
                key={item.id}
                active={category === item.id}
                onClick={() => setCategory(item.id)}
                label={item.label}
                count={count}
                accent={item.accent}
              />
            );
          })}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <SlidersHorizontal className="size-3.5 text-ink-muted" />
        <span className="text-xs text-ink-muted">
          {filtered.length} template{filtered.length === 1 ? '' : 's'}
          {category !== 'all' && ` in ${CATEGORIES.find((c) => c.id === category)?.label}`}
        </span>
      </div>

      <TemplateGrid
        templates={filtered}
        onUse={openTemplate}
        onInsert={addToCanvas}
        emptyMessage="No templates match those filters. Try clearing the search or picking another category."
      />

      {/* coming soon */}
      <section className="mt-12 rounded-xl border border-dashed border-line-strong bg-surface p-6">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="size-4 text-ink-muted" />
          <h2 className="text-sm font-medium text-ink">Coming soon</h2>
          <Badge variant="muted">Planned</Badge>
        </div>
        <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-ink-soft">
          The engine already supports every format in the registry, so the following are content
          additions rather than architectural changes: flyers, business cards, certificates,
          invitations, brochures, presentation decks, logo marks, advertisements and animated designs.
          Templates are data — adding a category means adding documents, not rewriting the app.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['Flyers', 'Business cards', 'Certificates', 'Invitations', 'Brochures', 'Presentations', 'Logos', 'Adverts', 'Thumbnails', 'Animated designs'].map(
            (label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ),
          )}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-surface-2 p-3">
          <Sparkles className="size-3.5 text-brand" />
          <p className="text-[11px] text-ink-soft">
            Soon you will be able to describe a template and have the AI generate it as structured
            elements — see the AI Studio.
          </p>
        </div>
      </section>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
        active
          ? 'border-brand bg-brand-soft text-brand'
          : 'border-line-strong bg-surface text-ink-soft hover:border-brand/50 hover:text-ink',
      )}
    >
      {accent && (
        <span className="size-1.5 rounded-full" style={{ background: accent }} aria-hidden />
      )}
      {label}
      {count !== undefined && <span className="font-mono text-[9px] opacity-60">{count}</span>}
    </button>
  );
}
