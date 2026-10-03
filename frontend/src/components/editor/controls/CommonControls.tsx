/**
 * Shared properties-panel building blocks: colour, gradient, shadow, position.
 * Kept separate so TextControls / ImageControls / ShapeControls stay small.
 */

import { useState } from 'react';
import { Pipette, Plus, Trash2, X } from 'lucide-react';
import type { GradientFill, Paint, Shadow } from '@/engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

const SWATCHES = [
  '#0b0d12', '#1f2937', '#4b5563', '#9ca3af', '#e5e7eb', '#ffffff',
  '#4f46e5', '#7c3aed', '#0ea5e9', '#06b6d4', '#14b8a6', '#16a34a',
  '#65a30d', '#facc15', '#f59e0b', '#ea580c', '#dc2626', '#e11d48',
  '#ec4899', '#c026d3', '#12245c', '#d4a017', '#faf3e0', '#8a6a3b',
];

export function ColorSwatchButton({
  value,
  onChange,
  label,
  allowTransparent,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  allowTransparent?: boolean;
}) {
  const isTransparent = value === 'transparent' || value.startsWith('rgba(0,0,0,0)');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-line-strong bg-surface px-1.5 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring/40"
        >
          <span
            className={cn(
              'size-5 shrink-0 rounded border border-line-strong',
              isTransparent && 'checkerboard',
            )}
            style={isTransparent ? undefined : { background: value }}
          />
          <span className="truncate font-mono text-[11px] uppercase text-ink-soft">
            {isTransparent ? 'None' : value}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
              onChange={(event) => onChange(event.target.value)}
              className="size-8 shrink-0 rounded"
              aria-label={`${label} picker`}
            />
            <Input
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className="h-8 font-mono text-xs"
              aria-label={`${label} hex value`}
            />
          </div>
          <div className="grid grid-cols-8 gap-1">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => onChange(swatch)}
                title={swatch}
                aria-label={swatch}
                className="size-5 rounded border border-line-strong transition-transform hover:scale-110"
                style={{ background: swatch }}
              />
            ))}
          </div>
          {allowTransparent && (
            <Button variant="outline" size="sm" onClick={() => onChange('transparent')}>
              <X /> Transparent
            </Button>
          )}
          <p className="flex items-center gap-1.5 text-[10px] text-ink-muted">
            <Pipette className="size-3" /> Tip: any CSS colour works, including rgba().
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Paint (solid or gradient)                                           */
/* ------------------------------------------------------------------ */

export function PaintControl({
  label,
  value,
  onChange,
  allowTransparent,
}: {
  label: string;
  value: Paint;
  onChange: (value: Paint) => void;
  allowTransparent?: boolean;
}) {
  const isGradient = typeof value !== 'string';

  const switchMode = (mode: 'solid' | 'gradient') => {
    if (mode === 'solid' && isGradient) onChange(value.stops[0]?.color ?? '#4f46e5');
    if (mode === 'gradient' && !isGradient) {
      onChange({
        type: 'linear',
        angle: 135,
        stops: [
          { offset: 0, color: value },
          { offset: 1, color: '#0b0d12' },
        ],
      });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</span>
        <Segmented
          size="sm"
          value={isGradient ? 'gradient' : 'solid'}
          onChange={switchMode}
          options={[
            { value: 'solid', label: 'Solid' },
            { value: 'gradient', label: 'Gradient' },
          ]}
          className="w-36"
        />
      </div>

      {isGradient ? (
        <GradientEditor value={value as GradientFill} onChange={onChange} />
      ) : (
        <ColorSwatchButton
          label={label}
          value={value as string}
          onChange={onChange}
          allowTransparent={allowTransparent}
        />
      )}
    </div>
  );
}

function GradientEditor({
  value,
  onChange,
}: {
  value: GradientFill;
  onChange: (value: GradientFill) => void;
}) {
  const preview =
    value.type === 'radial'
      ? `radial-gradient(circle, ${value.stops.map((s) => `${s.color} ${s.offset * 100}%`).join(', ')})`
      : `linear-gradient(${value.angle ?? 0}deg, ${value.stops.map((s) => `${s.color} ${s.offset * 100}%`).join(', ')})`;

  return (
    <div className="flex flex-col gap-2">
      <div className="h-8 rounded-md border border-line-strong" style={{ background: preview }} />
      <Segmented
        size="sm"
        value={value.type}
        onChange={(type) => onChange({ ...value, type })}
        options={[
          { value: 'linear', label: 'Linear' },
          { value: 'radial', label: 'Radial' },
        ]}
      />
      {value.type === 'linear' && (
        <div className="flex items-center gap-2">
          <span className="w-12 text-[10px] text-ink-muted">Angle</span>
          <Slider
            value={[value.angle ?? 0]}
            min={0}
            max={360}
            step={1}
            onValueChange={([angle]) => onChange({ ...value, angle })}
          />
          <span className="w-8 text-right font-mono text-[10px] text-ink-muted">{value.angle ?? 0}°</span>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        {value.stops.map((stop, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="color"
              value={stop.color}
              onChange={(event) => {
                const stops = value.stops.map((s, i) =>
                  i === index ? { ...s, color: event.target.value } : s,
                );
                onChange({ ...value, stops });
              }}
              className="size-6 shrink-0 rounded"
              aria-label={`Stop ${index + 1} colour`}
            />
            <Slider
              value={[stop.offset * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={([offset]) => {
                const stops = value.stops.map((s, i) => (i === index ? { ...s, offset: offset / 100 } : s));
                onChange({ ...value, stops });
              }}
            />
            <span className="w-8 text-right font-mono text-[10px] text-ink-muted">
              {Math.round(stop.offset * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={value.stops.length <= 2}
              onClick={() => onChange({ ...value, stops: value.stops.filter((_, i) => i !== index) })}
              aria-label="Remove stop"
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          disabled={value.stops.length >= 5}
          onClick={() => {
            const last = value.stops[value.stops.length - 1];
            onChange({
              ...value,
              stops: [...value.stops, { offset: Math.min(1, last.offset + 0.25), color: last.color }],
            });
          }}
        >
          <Plus /> Add stop
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shadow                                                              */
/* ------------------------------------------------------------------ */

export function ShadowControl({
  value,
  onChange,
}: {
  value: Shadow | undefined;
  onChange: (value: Shadow | undefined) => void;
}) {
  const enabled = Boolean(value);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Shadow</span>
        <Button
          variant={enabled ? 'subtle' : 'outline'}
          size="sm"
          onClick={() =>
            onChange(
              enabled
                ? undefined
                : { color: '#000000', blur: 18, offsetX: 0, offsetY: 6, opacity: 0.25 },
            )
          }
        >
          {enabled ? 'On' : 'Off'}
        </Button>
      </div>

      {value && (
        <div className="flex flex-col gap-2 rounded-md border border-line bg-surface-2 p-2">
          <ColorSwatchButton
            label="Shadow colour"
            value={value.color}
            onChange={(color) => onChange({ ...value, color })}
          />
          {(
            [
              ['Blur', 'blur', 0, 80, 1],
              ['X', 'offsetX', -60, 60, 1],
              ['Y', 'offsetY', -60, 60, 1],
              ['Opacity', 'opacity', 0, 1, 0.01],
            ] as const
          ).map(([label, key, min, max, step]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-14 text-[10px] text-ink-muted">{label}</span>
              <Slider
                value={[value[key]]}
                min={min}
                max={max}
                step={step}
                onValueChange={([next]) => onChange({ ...value, [key]: next })}
              />
              <span className="w-9 text-right font-mono text-[10px] text-ink-muted">
                {step < 1 ? value[key].toFixed(2) : Math.round(value[key])}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stroke                                                              */
/* ------------------------------------------------------------------ */

export function StrokeControl({
  value,
  onChange,
}: {
  value: Paint | undefined;
  onChange: (value: { color: string; width: number } | undefined) => void;
}) {
  const [enabled, setEnabled] = useState(Boolean(value));
  const color = typeof value === 'string' ? value : '#111827';
  const width = typeof value === 'object' && value && 'width' in value ? 2 : 2;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Border</span>
        <Button
          variant={enabled ? 'subtle' : 'outline'}
          size="sm"
          onClick={() => {
            const next = !enabled;
            setEnabled(next);
            onChange(next ? { color, width } : undefined);
          }}
        >
          {enabled ? 'On' : 'Off'}
        </Button>
      </div>
      {enabled && (
        <div className="flex flex-col gap-2">
          <ColorSwatchButton label="Border colour" value={color} onChange={(next) => onChange({ color: next, width })} />
        </div>
      )}
    </div>
  );
}
