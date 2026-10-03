import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-line-strong bg-surface px-2.5 py-1 text-sm text-ink shadow-inner shadow-transparent outline-none transition-colors',
        'placeholder:text-ink-muted focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-ring/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex w-full resize-y rounded-md border border-line-strong bg-surface px-2.5 py-2 text-sm text-ink outline-none transition-colors',
      'placeholder:text-ink-muted focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-ring/40',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
