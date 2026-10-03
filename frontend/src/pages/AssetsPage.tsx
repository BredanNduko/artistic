/**
 * Assets page — the media library.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, Film, Music, Sparkles, Type as TypeIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AssetLibrary } from '@/components/assets/AssetLibrary';
import { useAssetStore, useEditorStore, useUIStore } from '@/stores';
import { cn } from '@/lib/utils';

const KIND_FILTERS = [
  { value: 'all', label: 'All assets' },
  { value: 'image', label: 'Images' },
  { value: 'logo', label: 'Logos' },
] as const;

const COMING_SOON = [
  { icon: TypeIcon, label: 'Fonts', note: 'Upload and licence brand typefaces' },
  { icon: Boxes, label: 'Icons', note: 'Curated icon sets, searchable' },
  { icon: Film, label: 'Videos', note: 'Short clips as canvas elements' },
  { icon: Music, label: 'Audio', note: 'Soundtracks for animated designs' },
];

export default function AssetsPage() {
  const navigate = useNavigate();
  const assets = useAssetStore((s) => s.assets);
  const loading = useAssetStore((s) => s.loading);
  const uploading = useAssetStore((s) => s.uploading);
  const progress = useAssetStore((s) => s.progress);
  const filter = useAssetStore((s) => s.filter);
  const setFilter = useAssetStore((s) => s.setFilter);
  const upload = useAssetStore((s) => s.upload);
  const remove = useAssetStore((s) => s.remove);
  const rename = useAssetStore((s) => s.rename);
  const visible = useAssetStore((s) => s.visible);
  const load = useAssetStore((s) => s.load);

  const addImageElement = useEditorStore((s) => s.addImageElement);
  const pushToast = useUIStore((s) => s.pushToast);

  useEffect(() => {
    void load();
  }, [load]);

  const list = visible();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Assets</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Your uploaded and generated media, available in every design. Click an asset to add it to
            the current canvas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/ai')}>
            <Sparkles /> Generate one
          </Button>
          <Button onClick={() => navigate('/editor/new')}>Open the editor</Button>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-md bg-surface-3 p-0.5">
          {KIND_FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                filter === item.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Badge variant="muted">{assets.length} stored</Badge>
      </div>

      <AssetLibrary
        assets={list}
        loading={loading}
        uploading={uploading}
        progress={progress}
        onUpload={(files) => void upload(files)}
        onInsert={(asset) => {
          addImageElement(asset.src, {
            assetId: asset.id,
            name: asset.name,
            naturalWidth: asset.width || 1200,
            naturalHeight: asset.height || 1200,
          });
          pushToast({
            title: 'Added to your canvas',
            description: asset.name,
            variant: 'success',
            action: { label: 'Open the editor', onClick: () => navigate('/editor/new') },
          });
        }}
        onDelete={(asset) => {
          if (window.confirm(`Delete “${asset.name}”?`)) void remove(asset.id);
        }}
        onRename={(asset, name) => void rename(asset.id, name)}
      />

      <section className="mt-12">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-medium text-ink">Coming soon</h2>
          <Badge variant="muted">Planned</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COMING_SOON.map((item) => (
            <div key={item.label} className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-4">
              <span className="grid size-8 place-items-center rounded-lg bg-surface-3 text-ink-muted">
                <item.icon className="size-4" />
              </span>
              <h3 className="text-sm font-medium text-ink">{item.label}</h3>
              <p className="text-[11px] leading-relaxed text-ink-soft">{item.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-ink-muted">
          The asset service is already typed for every one of these kinds, so adding them is an
          implementation detail rather than a redesign. In local mode uploads are stored as data URLs
          in this browser; a backend build moves them to object storage behind the same interface.
        </p>
      </section>
    </div>
  );
}
