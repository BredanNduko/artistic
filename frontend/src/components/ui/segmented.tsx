import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Compact segmented control. Used constantly in the properties panel where a
 * full Select would be too heavy.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label?: string;
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  size = 'default',
}: {
  value: T | undefined;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'default';
}) {
  return (
    <div
      role="radiogroup"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md bg-surface-3 p-0.5',
        size === 'sm' ? 'h-7' : 'h-8',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title ?? option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-full flex-1 items-center justify-center gap-1 rounded-[5px] px-2 text-xs font-medium transition-colors',
              active
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Labelled row used throughout the properties panel. */
export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</span>
        {hint && <span className="font-mono text-[10px] text-ink-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** Two-column grid for compact number inputs. */
export function FieldRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-2', className)}>{children}</div>;
}

/** Numeric input with an optional unit suffix. */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  className,
  onCommit,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
  onCommit?: () => void;
}) {
  const [draft, setDraft] = React.useState(String(Math.round(value * 100) / 100));
  const focused = React.useRef(false);

  React.useEffect(() => {
    if (!focused.current) setDraft(String(Math.round(value * 100) / 100));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      setDraft(String(Math.round(value * 100) / 100));
      return;
    }
    const clamped = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, parsed));
    onChange(clamped);
    onCommit?.();
  };

  return (
    <div
      className={cn(
        'flex h-8 items-center rounded-md border border-line-strong bg-surface px-2 transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-ring/40',
        className,
      )}
    >
      <input
        type="number"
        value={draft}
        step={step}
        min={min}
        max={max}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={(event) => {
          focused.current = false;
          commit(event.target.value);
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          const parsed = Number(event.target.value);
          if (!Number.isNaN(parsed)) {
            onChange(
              Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, parsed)),
            );
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        className="w-full bg-transparent text-xs text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {suffix && <span className="pl-1 text-[10px] text-ink-muted">{suffix}</span>}
    </div>
  );
}
