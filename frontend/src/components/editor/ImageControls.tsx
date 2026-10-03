/**
 * ImageControls — replace, crop, fit, corner radius and filters.
 * Crop is a normalised window over the source image, which keeps it
 * resolution-independent and exportable at any scale.
 */

import { useRef } from 'react';
import { Crop, ImageIcon, RefreshCw, Upload, Wand2, Trash2 } from 'lucide-react';
import type { ImageElement } from '@/engine';
import { Button } from '@/components/ui/button';
import { Field, Segmented, NumberInput } from '@/components/ui/segmented';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ShadowControl, ColorSwatchButton } from './controls/CommonControls';
import { useAssetStore, useEditorStore, useUIStore } from '@/stores';
import { UPLOAD_LIMITS } from '@/services';
import { imageDimensions } from '@/lib/utils';

export function ImageControls({ element }: { element: ImageElement }) {
  const update = useEditorStore((s) => s.update);
  const replaceImage = useEditorStore((s) => s.replaceImage);
  const beginCrop = useEditorStore((s) => s.beginCrop);
  const cropTargetId = useEditorStore((s) => s.cropTargetId);
  const endCrop = useEditorStore((s) => s.endCrop);
  const upload = useAssetStore((s) => s.upload);
  const assets = useAssetStore((s) => s.assets);
  const pushToast = useUIStore((s) => s.pushToast);
  const fileInput = useRef<HTMLInputElement>(null);

  const patch = (value: Partial<ImageElement>, label: string, mergeKey?: string) =>
    update(element.id, value, label, mergeKey);

  const handleUploadAndReplace = async (file: File) => {
    try {
      const [asset] = await upload([file], { kind: 'image' });
      if (!asset) return;
      replaceImage(element.id, asset.src, asset.id);
      pushToast({ title: 'Image replaced', description: asset.name, variant: 'success' });
    } catch (error) {
      pushToast({
        title: 'Could not use that file',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-md border border-line bg-surface-2 p-2">
        <img
          src={element.src}
          alt={element.alt ?? element.name ?? 'Selected image'}
          className="size-14 shrink-0 rounded border border-line object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-ink">{element.name ?? 'Image'}</p>
          <p className="truncate font-mono text-[10px] text-ink-muted">
            {element.src.startsWith('data:') ? 'Embedded asset' : element.src.slice(0, 32)}
          </p>
        </div>
      </div>

      <Field label="Source">
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => fileInput.current?.click()}>
            <Upload /> Upload &amp; replace
          </Button>
          <Button
            variant={cropTargetId === element.id ? 'subtle' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => (cropTargetId === element.id ? endCrop() : beginCrop(element.id))}
          >
            <Crop /> {cropTargetId === element.id ? 'Crop on' : 'Crop'}
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleUploadAndReplace(file);
            event.target.value = '';
          }}
        />
        <p className="text-[10px] text-ink-muted">
          PNG, JPG, WEBP, GIF or SVG · max {UPLOAD_LIMITS.label} per file.
        </p>
      </Field>

      {cropTargetId === element.id && (
        <div className="flex flex-col gap-2 rounded-md border border-brand/40 bg-brand-soft/60 p-2">
          <p className="text-[11px] font-medium text-brand">Cropping</p>
          <p className="text-[10px] leading-relaxed text-ink-soft">
            Drag the handles on the canvas to set the visible window, then apply. The crop is stored
            as a normalised rectangle, so it survives any resize or export scale.
          </p>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                endCrop();
                pushToast({ title: 'Crop applied', variant: 'success' });
              }}
            >
              Apply crop
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                patch({ crop: undefined }, 'Reset crop');
                endCrop();
              }}
            >
              <RefreshCw /> Reset
            </Button>
          </div>
        </div>
      )}

      <Field label="Fit">
        <Segmented
          value={element.fit}
          onChange={(fit) => patch({ fit }, 'Change image fit')}
          options={[
            { value: 'cover', label: 'Cover' },
            { value: 'contain', label: 'Contain' },
            { value: 'fill', label: 'Stretch' },
          ]}
        />
      </Field>

      <Field label="Corner radius" hint={`${element.cornerRadius ?? 0}px`}>
        <Slider
          value={[element.cornerRadius ?? 0]}
          min={0}
          max={200}
          step={1}
          onValueChange={([cornerRadius]) => patch({ cornerRadius }, 'Change corner radius', `cr:${element.id}`)}
        />
      </Field>

      <Field label="Filters">
        <div className="flex flex-col gap-2.5">
          <FilterRow
            label="Grayscale"
            value={element.filter?.grayscale ?? 0}
            min={0}
            max={1}
            step={0.01}
            onChange={(grayscale) =>
              patch({ filter: { ...element.filter, grayscale } }, 'Image filter', `f:${element.id}`)
            }
          />
          <FilterRow
            label="Brightness"
            value={element.filter?.brightness ?? 1}
            min={0.2}
            max={2}
            step={0.01}
            onChange={(brightness) =>
              patch({ filter: { ...element.filter, brightness } }, 'Image filter', `f:${element.id}`)
            }
          />
          <FilterRow
            label="Contrast"
            value={element.filter?.contrast ?? 1}
            min={0.2}
            max={2.5}
            step={0.01}
            onChange={(contrast) =>
              patch({ filter: { ...element.filter, contrast } }, 'Image filter', `f:${element.id}`)
            }
          />
          <FilterRow
            label="Saturation"
            value={element.filter?.saturate ?? 1}
            min={0}
            max={3}
            step={0.01}
            onChange={(saturate) =>
              patch({ filter: { ...element.filter, saturate } }, 'Image filter', `f:${element.id}`)
            }
          />
          <FilterRow
            label="Blur"
            value={element.filter?.blur ?? 0}
            min={0}
            max={24}
            step={0.5}
            onChange={(blur) =>
              patch({ filter: { ...element.filter, blur } }, 'Image filter', `f:${element.id}`)
            }
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => patch({ filter: undefined }, 'Reset filters')}
          >
            <RefreshCw /> Reset filters
          </Button>
        </div>
      </Field>

      <Field label="Tint overlay">
        <div className="flex items-center gap-2">
          <Switch
            checked={Boolean(element.tint)}
            onCheckedChange={(on) =>
              patch(
                on ? { tint: '#4f46e5', tintOpacity: 0.35 } : { tint: undefined },
                'Toggle tint',
              )
            }
            aria-label="Toggle tint"
          />
          {element.tint && (
            <>
              <ColorSwatchButton
                label="Tint colour"
                value={element.tint}
                onChange={(tint) => patch({ tint }, 'Change tint')}
              />
              <NumberInput
                value={Math.round((element.tintOpacity ?? 0.35) * 100)}
                min={0}
                max={100}
                suffix="%"
                onChange={(value) => patch({ tintOpacity: value / 100 }, 'Change tint opacity')}
              />
            </>
          )}
        </div>
      </Field>

      {assets.length > 0 && (
        <Field label="Swap with a library asset">
          <div className="grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto">
            {assets.slice(0, 16).map((asset) => (
              <button
                key={asset.id}
                type="button"
                title={asset.name}
                onClick={() => replaceImage(element.id, asset.src, asset.id)}
                className="aspect-square overflow-hidden rounded border border-line transition-transform hover:scale-105 hover:border-brand"
              >
                <img src={asset.src} alt={asset.name} className="size-full object-cover" />
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field label="Accessibility">
        <input
          value={element.alt ?? ''}
          placeholder="Describe this image"
          onChange={(event) => patch({ alt: event.target.value }, 'Edit alt text', `alt:${element.id}`)}
          className="h-8 w-full rounded-md border border-line-strong bg-surface px-2 text-xs text-ink outline-none focus-visible:border-brand"
        />
        <p className="flex items-start gap-1 text-[10px] leading-relaxed text-ink-muted">
          <ImageIcon className="mt-0.5 size-3 shrink-0" />
          Alt text is used by screen readers, and gives a future AI model a description to reason about.
        </p>
      </Field>

      <ShadowControl value={element.shadow} onChange={(shadow) => patch({ shadow }, 'Change shadow')} />

      <div className="flex gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={async () => {
            try {
              const dims = await imageDimensions(element.src);
              const ratio = dims.width / dims.height;
              const height = Math.round(element.width / ratio);
              patch({ height }, 'Match aspect ratio');
            } catch {
              pushToast({ title: 'Could not read the image dimensions', variant: 'error' });
            }
          }}
        >
          <Wand2 /> Match aspect
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => useEditorStore.getState().remove([element.id])}
        >
          <Trash2 /> Delete
        </Button>
      </div>
    </div>
  );
}

function FilterRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[10px] text-ink-muted">{label}</span>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([next]) => onChange(next)} />
      <span className="w-9 shrink-0 text-right font-mono text-[10px] text-ink-muted">
        {value.toFixed(2)}
      </span>
    </div>
  );
}
