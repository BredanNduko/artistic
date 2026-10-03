import { cn } from '@/lib/utils';

/**
 * Wordmark. Drawn as SVG rather than an image so it inherits the theme colour
 * and stays crisp at every size.
 */
export function Logo({ className, withText = false }: { className?: string; withText?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <svg
        viewBox="0 0 32 32"
        className={cn('shrink-0', className)}
        role="img"
        aria-label="DesignForge"
      >
        <rect width="32" height="32" rx="8" fill="var(--brand)" />
        <path
          d="M9 22.5 16 9l7 13.5H9Z"
          fill="none"
          stroke="var(--brand-ink)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="18.5" r="2.2" fill="var(--brand-ink)" />
      </svg>
      {withText && (
        <span className="text-sm font-semibold tracking-tight text-ink">DesignForge</span>
      )}
    </span>
  );
}
