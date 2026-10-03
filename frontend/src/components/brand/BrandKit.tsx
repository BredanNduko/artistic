/**
 * BrandKit — editor and preview for brand colours, fonts, logos, business
 * details and social links.
 *
 * The editor consumes a kit through `useBrandKitActions`, which injects real
 * elements (a logo image, a colour swatch, styled text) rather than just
 * storing values. That is what makes the kit useful rather than decorative.
 */

import { useRef, useState } from 'react';
import { Check, Loader2, Plus, Save, Trash2, Upload } from 'lucide-react';
import type { BrandKit as BrandKitModel } from '@/services';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, NumberInput } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FONTS } from '@/data/fonts';
import { createGroup, createImage, createShape, createText, uid } from '@/engine';
import { useAssetStore, useEditorStore, useUIStore } from '@/stores';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Editor injection helpers                                            */
/* ------------------------------------------------------------------ */

/**
 * Turns a brand colour into a real swatch element on the canvas.
 * Used by the editor's Brand tab.
 */
export function useBrandKitActions() {
  const document = useEditorStore((s) => s.document);
  const add = useEditorStore((s) => s.add);
  const pushToast = useUIStore((s) => s.pushToast);

  const addSwatch = (color: string, name: string) => {
    const size = Math.round(Math.min(document.width, document.height) * 0.16);
    add(
      createShape({
        name: `${name} swatch`,
        shape: 'roundRect',
        x: Math.round((document.width - size) / 2),
        y: Math.round((document.height - size) / 2),
        width: size,
        height: size,
        cornerRadius: 18,
        fill: color,
      }),
      'Add brand colour',
    );
    pushToast({ title: 'Colour added to canvas', variant: 'success' });
  };

  const addHeading = (text: string, fontFamily: string, color: string) => {
    const fontSize = Math.round(Math.min(document.width, document.height) * 0.08);
    add(
      createText(text, {
        name: 'Brand heading',
        x: Math.round(document.width * 0.08),
        y: Math.round(document.height * 0.4),
        width: Math.round(document.width * 0.84),
        fontSize,
        fontFamily,
        fontWeight: 700,
        color,
        align: 'left',
      }),
      'Add brand text',
    );
    pushToast({ title: 'Brand text added', variant: 'success' });
  };

  const addLogo = (src: string, naturalWidth = 600, naturalHeight = 200) => {
    const maxW = document.width * 0.32;
    const scale = Math.min(maxW / naturalWidth, 1);
    const width = Math.round(naturalWidth * scale);
    const height = Math.round(naturalHeight * scale);
    add(
      createImage(src, {
        name: 'Logo',
        x: Math.round(document.width - width - document.width * 0.06),
        y: Math.round(document.height - height - document.height * 0.06),
        width,
        height,
        fit: 'contain',
        alt: 'Brand logo',
      }),
      'Add logo',
    );
    pushToast({ title: 'Logo placed bottom-right', variant: 'success' });
  };

  const addBusinessCard = (kit: BrandKitModel) => {
    const { business } = kit;
    const pad = Math.round(Math.min(document.width, document.height) * 0.08);
    const baseFont = Math.round(Math.min(document.width, document.height) * 0.03);
    const primary = kit.colors[0]?.value ?? '#4f46e5';
    const headingFont = kit.fonts.find((f) => f.role === 'heading')?.family ?? 'Montserrat';
    const bodyFont = kit.fonts.find((f) => f.role === 'body')?.family ?? 'Inter';

    const lines = [
      business.companyName || 'Your company',
      business.tagline,
      [business.email, business.phone].filter(Boolean).join('  ·  '),
      business.website,
      business.address,
    ].filter(Boolean);

    const elements = [
      createShape({
        name: 'Brand panel',
        shape: 'rect',
        x: pad,
        y: pad,
        width: Math.round(document.width * 0.012),
        height: Math.round(document.height - pad * 2),
        fill: primary,
      }),
      ...lines.map((line, index) =>
        createText(line, {
          name: index === 0 ? 'Company name' : `Line ${index + 1}`,
          x: pad + Math.round(baseFont * 1.2),
          y: pad + index * Math.round(baseFont * 1.9),
          width: Math.round(document.width - pad * 2 - baseFont * 2),
          fontSize: index === 0 ? Math.round(baseFont * 1.9) : Math.round(baseFont * 1.05),
          fontFamily: index === 0 ? headingFont : bodyFont,
          fontWeight: index === 0 ? 700 : 400,
          color: index === 0 ? primary : '#4b5563',
          lineHeight: 1.4,
        }),
      ),
    ];

    add(createGroup(elements, { name: 'Brand block' }), 'Add brand block');
    pushToast({ title: 'Brand details added', variant: 'success' });
  };

  return { addSwatch, addHeading, addLogo, addBusinessCard };
}

/* ------------------------------------------------------------------ */
/* Editor form                                                         */
/* ------------------------------------------------------------------ */

export function BrandKitEditor({
  kit,
  onSave,
  onDelete,
  saving,
  compact,
}: {
  kit: BrandKitModel;
  onSave: (kit: BrandKitModel) => void;
  onDelete?: () => void;
  saving?: boolean;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState<BrandKitModel>(kit);
  const logoInput = useRef<HTMLInputElement>(null);
  const register = useAssetStore((s) => s.register);
  const pushToast = useUIStore((s) => s.pushToast);

  // Re-sync when a different kit is selected.
  const [lastId, setLastId] = useState(kit.id);
  if (kit.id !== lastId) {
    setLastId(kit.id);
    setDraft(kit);
  }

  const patch = (value: Partial<BrandKitModel>) => setDraft((prev) => ({ ...prev, ...value }));

  const handleLogoUpload = async (file: File) => {
    try {
      const asset = await register(
        await fileToDataUrl(file),
        {
          kind: 'logo',
          name: file.name.replace(/\.[^.]+$/, ''),
          width: 0,
          height: 0,
          size: file.size,
        },
      );
      patch({
        logos: [
          ...draft.logos,
          {
            id: `lg_${uid('x').slice(2, 8)}`,
            name: asset.name,
            src: asset.src,
            variant: 'primary',
          },
        ],
      });
      pushToast({ title: 'Logo added to brand kit', variant: 'success' });
    } catch (error) {
      pushToast({
        title: 'Could not add that logo',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Field label="Brand kit name">
        <Input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
      </Field>

      {/* colours */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Brand colours
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              patch({
                colors: [
                  ...draft.colors,
                  { id: `c_${uid('x').slice(2, 8)}`, name: 'New colour', value: '#888888' },
                ],
              })
            }
          >
            <Plus /> Add
          </Button>
        </div>
        <div className="flex flex-col gap-1.5">
          {draft.colors.map((color, index) => (
            <div key={color.id} className="flex items-center gap-2">
              <input
                type="color"
                value={color.value}
                aria-label={`${color.name} value`}
                onChange={(event) =>
                  patch({
                    colors: draft.colors.map((c, i) =>
                      i === index ? { ...c, value: event.target.value } : c,
                    ),
                  })
                }
                className="size-7 shrink-0 rounded"
              />
              <Input
                value={color.name}
                onChange={(event) =>
                  patch({
                    colors: draft.colors.map((c, i) =>
                      i === index ? { ...c, name: event.target.value } : c,
                    ),
                  })
                }
                className="h-7 text-xs"
              />
              <Input
                value={color.value}
                onChange={(event) =>
                  patch({
                    colors: draft.colors.map((c, i) =>
                      i === index ? { ...c, value: event.target.value } : c,
                    ),
                  })
                }
                className="h-7 w-28 font-mono text-xs"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => patch({ colors: draft.colors.filter((_, i) => i !== index) })}
                aria-label={`Remove ${color.name}`}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* fonts */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Brand fonts
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              patch({
                fonts: [
                  ...draft.fonts,
                  { id: `f_${uid('x').slice(2, 8)}`, family: 'Inter', role: 'body' },
                ],
              })
            }
          >
            <Plus /> Add
          </Button>
        </div>
        <div className="flex flex-col gap-1.5">
          {draft.fonts.map((font, index) => (
            <div key={font.id} className="flex items-center gap-2">
              <Select
                value={font.family}
                onValueChange={(family) =>
                  patch({
                    fonts: draft.fonts.map((f, i) => (i === index ? { ...f, family } : f)),
                  })
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONTS.map((option) => (
                    <SelectItem key={option.family} value={option.family}>
                      {option.family}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={font.role}
                onValueChange={(role) =>
                  patch({
                    fonts: draft.fonts.map((f, i) =>
                      i === index ? { ...f, role: role as typeof f.role } : f,
                    ),
                  })
                }
              >
                <SelectTrigger className="h-8 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['heading', 'body', 'accent', 'mono'] as const).map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => patch({ fonts: draft.fonts.filter((_, i) => i !== index) })}
                aria-label="Remove font"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* logos */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Logos</span>
          <Button variant="outline" size="sm" onClick={() => logoInput.current?.click()}>
            <Upload /> Upload
          </Button>
          <input
            ref={logoInput}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleLogoUpload(file);
              event.target.value = '';
            }}
          />
        </div>
        {draft.logos.length ? (
          <div className="grid grid-cols-3 gap-2">
            {draft.logos.map((logo) => (
              <div key={logo.id} className="flex flex-col gap-1">
                <div className="checkerboard flex aspect-video items-center justify-center overflow-hidden rounded border border-line">
                  <img src={logo.src} alt={logo.name} className="max-h-full max-w-full object-contain" />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => patch({ logos: draft.logos.filter((l) => l.id !== logo.id) })}
                >
                  <Trash2 /> Remove
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-line-strong p-3 text-center text-[10px] text-ink-muted">
            No logos yet. PNG or SVG with transparency works best.
          </p>
        )}
      </section>

      {/* business info */}
      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Business information
        </span>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['companyName', 'Company name'],
              ['tagline', 'Tagline'],
              ['email', 'Email'],
              ['phone', 'Phone'],
              ['website', 'Website'],
              ['address', 'Address'],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <Input
                value={draft.business[key]}
                onChange={(event) =>
                  patch({ business: { ...draft.business, [key]: event.target.value } })
                }
                className="h-8 text-xs"
              />
            </Field>
          ))}
        </div>
      </section>

      {/* socials */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Social links
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              patch({
                socials: [
                  ...draft.socials,
                  { id: `s_${uid('x').slice(2, 8)}`, platform: 'Instagram', handle: '', url: '' },
                ],
              })
            }
          >
            <Plus /> Add
          </Button>
        </div>
        {draft.socials.map((social, index) => (
          <div key={social.id} className="flex items-center gap-2">
            <Input
              value={social.platform}
              onChange={(event) =>
                patch({
                  socials: draft.socials.map((s, i) =>
                    i === index ? { ...s, platform: event.target.value } : s,
                  ),
                })
              }
              className="h-7 w-24 text-xs"
            />
            <Input
              value={social.handle}
              placeholder="@handle"
              onChange={(event) =>
                patch({
                  socials: draft.socials.map((s, i) =>
                    i === index ? { ...s, handle: event.target.value } : s,
                  ),
                })
              }
              className="h-7 flex-1 text-xs"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => patch({ socials: draft.socials.filter((_, i) => i !== index) })}
              aria-label="Remove social link"
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </section>

      <div className="flex items-center gap-2">
        <Button onClick={() => onSave(draft)} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />} Save brand kit
        </Button>
        {onDelete && (
          <Button variant="outline" onClick={onDelete}>
            <Trash2 /> Delete
          </Button>
        )}
        {!compact && (
          <span className="ml-auto text-[10px] text-ink-muted">
            Updated {new Date(draft.updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Read-only summary (used in the editor's Brand tab)                  */
/* ------------------------------------------------------------------ */

export function BrandKitSummary({
  kit,
  onAddColor,
  onAddHeading,
  onAddLogo,
  onAddBlock,
}: {
  kit: BrandKitModel;
  onAddColor?: (color: string, name: string) => void;
  onAddHeading?: (text: string, font: string, color: string) => void;
  onAddLogo?: (src: string) => void;
  onAddBlock?: () => void;
}) {
  const headingFont = kit.fonts.find((f) => f.role === 'heading')?.family ?? 'Montserrat';
  const bodyFont = kit.fonts.find((f) => f.role === 'body')?.family ?? 'Inter';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant="brand">{kit.name}</Badge>
        {kit.isDefault && <Badge variant="outline">Default</Badge>}
      </div>

      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Colours — click to add a swatch
        </span>
        <div className="grid grid-cols-4 gap-2">
          {kit.colors.map((color) => (
            <button
              key={color.id}
              type="button"
              onClick={() => onAddColor?.(color.value, color.name)}
              title={`Add ${color.name} to the canvas`}
              className="flex flex-col gap-1"
            >
              <span
                className="h-9 w-full rounded-md border border-line-strong transition-transform hover:scale-105"
                style={{ background: color.value }}
              />
              <span className="truncate text-[10px] text-ink-soft">{color.name}</span>
              <span className="truncate font-mono text-[9px] uppercase text-ink-muted">
                {color.value}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Fonts</span>
        <div className="flex flex-col gap-1.5">
          {kit.fonts.map((font) => (
            <button
              key={font.id}
              type="button"
              onClick={() =>
                onAddHeading?.(
                  kit.business.companyName || 'Brand heading',
                  font.family,
                  kit.colors[0]?.value ?? '#111827',
                )
              }
              className="flex items-center justify-between rounded-md border border-line bg-surface px-2.5 py-1.5 text-left transition-colors hover:border-brand/60"
            >
              <span className="truncate text-sm text-ink" style={{ fontFamily: `"${font.family}", sans-serif` }}>
                {font.family}
              </span>
              <Badge variant="muted">{font.role}</Badge>
            </button>
          ))}
        </div>
      </section>

      {kit.logos.length > 0 && (
        <section className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Logos — click to place
          </span>
          <div className="grid grid-cols-3 gap-2">
            {kit.logos.map((logo) => (
              <button
                key={logo.id}
                type="button"
                onClick={() => onAddLogo?.(logo.src)}
                title={`Place ${logo.name}`}
                className="checkerboard flex aspect-video items-center justify-center overflow-hidden rounded border border-line transition-colors hover:border-brand"
              >
                <img src={logo.src} alt={logo.name} className="max-h-full max-w-full object-contain" />
              </button>
            ))}
          </div>
        </section>
      )}

      {(kit.business.companyName || kit.business.email) && (
        <section className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Business details
          </span>
          <div className="rounded-md border border-line bg-surface-2 p-2.5 text-[11px] leading-relaxed text-ink-soft">
            <p className="font-medium text-ink" style={{ fontFamily: `"${headingFont}", sans-serif` }}>
              {kit.business.companyName}
            </p>
            {kit.business.tagline && <p>{kit.business.tagline}</p>}
            <p style={{ fontFamily: `"${bodyFont}", sans-serif` }}>
              {[kit.business.email, kit.business.phone].filter(Boolean).join(' · ')}
            </p>
            {kit.business.website && <p>{kit.business.website}</p>}
          </div>
          {onAddBlock && (
            <Button variant="outline" size="sm" onClick={onAddBlock}>
              <Check /> Add brand block to canvas
            </Button>
          )}
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

export { NumberInput };
