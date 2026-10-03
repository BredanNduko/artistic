/**
 * Brand kit page — manage one or more brand kits.
 */

import { useEffect, useState } from 'react';
import { Check, Palette, Plus, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrandKitEditor } from '@/components/brand/BrandKit';
import { useUserStore } from '@/stores';
import { cn } from '@/lib/utils';

export default function BrandKitPage() {
  const brandKits = useUserStore((s) => s.brandKits);
  const activeBrandKit = useUserStore((s) => s.activeBrandKit);
  const loadBrandKits = useUserStore((s) => s.loadBrandKits);
  const setActiveBrandKit = useUserStore((s) => s.setActiveBrandKit);
  const saveBrandKit = useUserStore((s) => s.saveBrandKit);
  const createBrandKit = useUserStore((s) => s.createBrandKit);
  const removeBrandKit = useUserStore((s) => s.removeBrandKit);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadBrandKits();
  }, [loadBrandKits]);

  const selected =
    brandKits.find((kit) => kit.id === selectedId) ?? activeBrandKit ?? brandKits[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Brand kit</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Store the colours, typefaces, logos and business details you reuse. The editor can drop any
          of them straight onto the canvas as real, editable elements.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        {/* kit switcher */}
        <aside className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            {brandKits.map((kit) => (
              <button
                key={kit.id}
                type="button"
                onClick={() => setSelectedId(kit.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                  selected?.id === kit.id
                    ? 'border-brand bg-brand-soft/50'
                    : 'border-line bg-surface hover:border-brand/40',
                )}
              >
                <Palette className="size-3.5 shrink-0 text-ink-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-ink">{kit.name}</span>
                  <span className="block font-mono text-[10px] text-ink-muted">
                    {kit.colors.length} colours · {kit.fonts.length} fonts
                  </span>
                </span>
                {activeBrandKit?.id === kit.id && (
                  <Badge variant="success">
                    <Check className="size-2.5" /> Active
                  </Badge>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              New brand kit
            </span>
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Client or brand name"
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              disabled={!newName.trim()}
              onClick={async () => {
                const kit = await createBrandKit(newName.trim());
                setSelectedId(kit.id);
                setNewName('');
              }}
            >
              <Plus /> Create
            </Button>
          </div>

          {selected && activeBrandKit?.id !== selected.id && (
            <Button variant="outline" size="sm" onClick={() => void setActiveBrandKit(selected.id)}>
              <Star /> Set as active
            </Button>
          )}
        </aside>

        {/* editor */}
        <div className="rounded-xl border border-line bg-surface p-5">
          {selected ? (
            <BrandKitEditor
              kit={selected}
              saving={saving}
              onSave={async (kit) => {
                setSaving(true);
                try {
                  await saveBrandKit(kit);
                } finally {
                  setSaving(false);
                }
              }}
              onDelete={
                brandKits.length > 1
                  ? () => {
                      if (window.confirm(`Delete “${selected.name}”?`)) {
                        void removeBrandKit(selected.id);
                        setSelectedId(null);
                      }
                    }
                  : undefined
              }
            />
          ) : (
            <p className="py-10 text-center text-xs text-ink-muted">
              No brand kits yet — create one to get started.
            </p>
          )}
        </div>
      </div>

      <section className="mt-10 rounded-xl border border-line bg-surface-2 p-5">
        <h2 className="text-sm font-medium text-ink">How the editor uses this</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {[
            { title: 'Colours', body: 'Click a swatch in the editor\u2019s Brand tab to drop a colour block onto the canvas.' },
            { title: 'Fonts', body: 'Click a typeface to add a heading set in that family at your primary colour.' },
            { title: 'Logos & details', body: 'Click a logo to place it bottom-right, or add a grouped brand block with all your contact details.' },
          ].map((item) => (
            <div key={item.title}>
              <h3 className="text-xs font-medium text-ink">{item.title}</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{item.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-ink-muted">
          Everything added this way is a normal element — move it, restyle it, lock it or delete it.
          The brand kit is a source of truth, not a constraint.
        </p>
      </section>
    </div>
  );
}
