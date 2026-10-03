/**
 * Asset components: card, uploader and the library grid.
 * All three are used by both the Assets page and the editor's left panel, so
 * they stay presentation-only and take their callbacks as props.
 */

import { useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Trash2, Upload, Wand2 } from 'lucide-react';
import type { Asset } from '@/services';
import { UPLOAD_LIMITS } from '@/services';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatBytes } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';

/* ------------------------------------------------------------------ */

export function AssetCard({
  asset,
  onInsert,
  onDelete,
  className,
}: {
  asset: Asset;
  onInsert?: (asset: Asset) => void;
  onDelete?: (asset: Asset) => void;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        'group relative overflow-hidden rounded-lg border border-line bg-surface',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onInsert?.(asset)}
        disabled={!onInsert}
        className="block aspect-square w-full overflow-hidden bg-surface-2 disabled:cursor-default"
        title={onInsert ? `Use ${asset.name}` : asset.name}
      >
        <img
          src={asset.src}
          alt={asset.name}
          loading="lazy"
          className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      </button>

      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(asset)}
          aria-label={`Delete ${asset.name}`}
          className="absolute right-1.5 top-1.5 rounded-md bg-surface/90 p-1 text-ink-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}

      {asset.generatedBy === 'ai' && (
        <Badge variant="brand" className="absolute left-1.5 top-1.5">
          <Wand2 className="size-2.5" /> AI
        </Badge>
      )}

      <figcaption className="flex flex-col gap-0.5 p-2">
        <span className="truncate text-[11px] font-medium text-ink">{asset.name}</span>
        <span className="truncate font-mono text-[10px] text-ink-muted">
          {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ''}
          {formatBytes(asset.size)}
        </span>
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */

export function UploadAsset({
  onFiles,
  uploading,
  progress,
  kind = 'image',
  className,
}: {
  onFiles: (files: File[]) => void;
  uploading?: boolean;
  progress?: number;
  kind?: 'image' | 'logo';
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length) onFiles(files);
      }}
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border border-dashed p-5 text-center transition-colors',
        dragging ? 'border-brand bg-brand-soft/60' : 'border-line-strong bg-surface-2',
        className,
      )}
    >
      <div className="grid size-9 place-items-center rounded-full bg-surface">
        {uploading ? (
          <Loader2 className="size-4 animate-spin text-brand" />
        ) : (
          <Upload className="size-4 text-ink-muted" />
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-medium text-ink">
          {uploading
            ? `Uploading… ${Math.round((progress ?? 0) * 100)}%`
            : `Drop ${kind === 'logo' ? 'a logo' : 'images'} here`}
        </p>
        <p className="text-[10px] text-ink-muted">
          PNG, JPG, WEBP, GIF or SVG · max {UPLOAD_LIMITS.label} per file
        </p>
      </div>

      <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={uploading}>
        <ImageIcon /> Choose files
      </Button>

      <input
        ref={input}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFiles(files);
          event.target.value = '';
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function AssetLibrary({
  assets,
  loading,
  uploading,
  progress,
  onUpload,
  onInsert,
  onDelete,
  onRename,
  compact,
}: {
  assets: Asset[];
  loading?: boolean;
  uploading?: boolean;
  progress?: number;
  onUpload: (files: File[]) => void;
  onInsert?: (asset: Asset) => void;
  onDelete?: (asset: Asset) => void;
  onRename?: (asset: Asset, name: string) => void;
  compact?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);

  const visible = assets.filter((asset) =>
    search.trim()
      ? asset.name.toLowerCase().includes(search.trim().toLowerCase())
      : true,
  );

  return (
    <div className="flex flex-col gap-3">
      <UploadAsset onFiles={onUpload} uploading={uploading} progress={progress} />

      {assets.length > 0 && (
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search assets…"
          className="h-8 text-xs"
        />
      )}

      {loading && !assets.length ? (
        <div className="flex items-center justify-center gap-2 py-8 text-ink-muted">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-xs">Loading assets…</span>
        </div>
      ) : visible.length ? (
        <div
          className={cn(
            'grid gap-2',
            compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
          )}
        >
          {visible.map((asset) => (
            <div key={asset.id} className="flex flex-col gap-1">
              <AssetCard asset={asset} onInsert={onInsert} onDelete={onDelete} />
              {renaming === asset.id ? (
                <Input
                  autoFocus
                  defaultValue={asset.name}
                  className="h-6 text-[10px]"
                  onBlur={(event) => {
                    onRename?.(asset, event.target.value);
                    setRenaming(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                    if (event.key === 'Escape') setRenaming(null);
                  }}
                />
              ) : (
                onRename && (
                  <button
                    type="button"
                    onClick={() => setRenaming(asset.id)}
                    className="self-start text-[10px] text-ink-muted transition-colors hover:text-ink"
                  >
                    Rename
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-line-strong py-8 text-center">
          <p className="text-xs text-ink-muted">
            {assets.length ? 'No assets match that search.' : 'No assets yet — upload your first image.'}
          </p>
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-ink-muted">
        Uploads are stored in this browser as data URLs so they survive a reload and export without
        any server. A future version will move them to object storage via the asset service.
        {onInsert ? '' : ' Videos, audio and font assets are coming soon.'}
      </p>
    </div>
  );
}

export { formatRelativeTime };
