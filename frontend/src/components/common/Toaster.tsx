import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useUIStore } from '@/stores';
import { cn } from '@/lib/utils';

const VARIANTS = {
  default: { icon: Info, className: 'border-line' },
  success: { icon: CheckCircle2, className: 'border-success/40' },
  error: { icon: AlertTriangle, className: 'border-danger/40' },
  info: { icon: Info, className: 'border-brand/40' },
} as const;

export function Toaster() {
  const toasts = useUIStore((s) => s.toasts);
  const dismiss = useUIStore((s) => s.dismissToast);

  if (!toasts.length) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((toast) => {
        const variant = VARIANTS[toast.variant];
        const Icon = variant.icon;
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto flex gap-2.5 rounded-lg border bg-surface p-3 shadow-[var(--shadow-float)] animate-rise',
              variant.className,
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 size-4 shrink-0',
                toast.variant === 'success' && 'text-success',
                toast.variant === 'error' && 'text-danger',
                toast.variant === 'info' && 'text-brand',
                toast.variant === 'default' && 'text-ink-muted',
              )}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-xs font-medium text-ink">{toast.title}</p>
              {toast.description && (
                <p className="text-[11px] leading-relaxed text-ink-soft">{toast.description}</p>
              )}
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    dismiss(toast.id);
                  }}
                  className="mt-1 self-start text-[11px] font-medium text-brand underline-offset-2 hover:underline"
                >
                  {toast.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="rounded p-0.5 text-ink-muted transition-colors hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
