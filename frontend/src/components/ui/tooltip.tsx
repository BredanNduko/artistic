import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 max-w-xs overflow-hidden rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink shadow-[var(--shadow-float)]',
        'data-[state=delayed-open]:animate-fade-in',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = 'TooltipContent';

/**
 * Small helper for the dozens of icon buttons in the editor chrome.
 * Renders a plain button when `label` is falsy so we never nest empty tips.
 */
export function Hint({
  label,
  shortcut,
  children,
  side = 'bottom',
}: {
  label?: string;
  shortcut?: string;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  if (!label) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>
        <span className="font-medium">{label}</span>
        {shortcut && <span className="ml-2 font-mono text-[10px] text-ink-muted">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
