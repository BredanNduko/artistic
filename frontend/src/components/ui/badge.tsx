import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'brand' | 'outline' | 'success' | 'warning' | 'muted';
}

const VARIANTS: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-surface-3 text-ink-soft',
  brand: 'bg-brand-soft text-brand',
  outline: 'border border-line-strong text-ink-soft',
  success: 'bg-success/12 text-success',
  warning: 'bg-accent/16 text-accent',
  muted: 'bg-surface-3 text-ink-muted',
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
