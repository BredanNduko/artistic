/**
 * TemplateCard / TemplateGrid / TemplatePreview.
 *
 * Preview thumbnails are produced by the real design engine, so a card can
 * never drift from what the template actually contains.
 */

import { Link } from 'react-router-dom';
import { ArrowRight, LayoutTemplate, Loader2, Plus, Wand2 } from 'lucide-react';
import type { DesignDocument } from '@/engine';
import type { DesignTemplate } from '@/data/templates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDocumentThumbnail } from '@/hooks/useDocumentThumbnail';
import { categoryLabel } from '@/data/categories';
import { formatLabel } from '@/data/formats';
import { cn } from '@/lib/utils';

export function TemplatePreview({
  document,
  maxSize = 480,
  className,
  showLoading = true,
}: {
  document: DesignDocument;
  maxSize?: number;
  className?: string;
  showLoading?: boolean;
}) {
  const { src, loading } = useDocumentThumbnail(document, maxSize);

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-2',
        className,
      )}
      style={{ aspectRatio: `${document.width} / ${document.height}` }}
    >
      {src ? (
        <img
          src={src}
          alt={`Preview of ${document.name}`}
          className="size-full object-contain"
          loading="lazy"
        />
      ) : (
        showLoading && (
          <div className="flex flex-col items-center gap-2 text-ink-muted">
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <LayoutTemplate className="size-5" />
            )}
            <span className="text-[10px]">{loading ? 'Rendering…' : 'No preview'}</span>
          </div>
        )
      )}
    </div>
  );
}

export function TemplateCard({
  template,
  onUse,
  onInsert,
  className,
}: {
  template: DesignTemplate;
  /** open the template in the editor as a new design */
  onUse?: (template: DesignTemplate) => void;
  /** add the template's elements to the current design */
  onInsert?: (template: DesignTemplate) => void;
  className?: string;
}) {
  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-[var(--shadow-panel)]',
        className,
      )}
    >
      <div className="relative p-2">
        <TemplatePreview document={template.document} maxSize={420} />
        <div className="pointer-events-none absolute inset-2 flex items-end justify-center gap-1.5 rounded-lg bg-gradient-to-t from-black/70 via-black/10 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
          {onUse && (
            <Button size="sm" className="pointer-events-auto" onClick={() => onUse(template)}>
              <Wand2 /> Use template
            </Button>
          )}
          {onInsert && (
            <Button
              size="sm"
              variant="outline"
              className="pointer-events-auto bg-surface"
              onClick={() => onInsert(template)}
            >
              <Plus /> Add to canvas
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 px-3 pb-3">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 text-sm font-medium leading-snug text-ink">{template.name}</h3>
        </div>
        <p className="line-clamp-2 text-[11px] leading-relaxed text-ink-soft">{template.description}</p>
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="brand">{categoryLabel(template.category)}</Badge>
          <Badge variant="outline">{formatLabel(template.format)}</Badge>
          <Badge variant="muted">{template.document.elements.length} layers</Badge>
        </div>
      </div>
    </article>
  );
}

export function TemplateGrid({
  templates,
  onUse,
  onInsert,
  emptyMessage = 'No templates match those filters.',
  className,
}: {
  templates: DesignTemplate[];
  onUse?: (template: DesignTemplate) => void;
  onInsert?: (template: DesignTemplate) => void;
  emptyMessage?: string;
  className?: string;
}) {
  if (!templates.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong py-14 text-center">
        <LayoutTemplate className="size-5 text-ink-muted" />
        <p className="text-xs text-ink-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className,
      )}
    >
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          onUse={onUse}
          onInsert={onInsert}
        />
      ))}
    </div>
  );
}

/** Horizontal scroller used on the landing page. */
export function TemplateStrip({ templates }: { templates: DesignTemplate[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {templates.map((template) => (
        <Link
          key={template.id}
          to={`/editor/new?template=${template.id}`}
          className="group w-56 shrink-0 snap-start"
        >
          <TemplatePreview document={template.document} maxSize={320} />
          <p className="mt-2 truncate text-xs font-medium text-ink group-hover:text-brand">
            {template.name}
          </p>
          <p className="truncate text-[10px] text-ink-muted">{categoryLabel(template.category)}</p>
        </Link>
      ))}
    </div>
  );
}

export { ArrowRight };
