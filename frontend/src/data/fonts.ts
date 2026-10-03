/**
 * Font registry.
 *
 * Fonts are loaded from Google Fonts in `index.html` and referenced by family
 * name everywhere else. Because text is drawn onto a canvas (not styled HTML),
 * the family string is all the engine needs — which also means the same
 * registry works for a future server-side renderer that ships its own fonts.
 */

export type FontCategory = 'sans' | 'serif' | 'display' | 'mono' | 'handwriting';

export interface FontDefinition {
  family: string;
  category: FontCategory;
  /** weights available in the loaded font file */
  weights: number[];
  /** short description shown in the font picker */
  note?: string;
  /** stack used as a fallback before the webfont arrives */
  fallback: string;
}

export const FONTS: FontDefinition[] = [
  { family: 'Inter', category: 'sans', weights: [300, 400, 500, 600, 700, 800], note: 'Neutral UI workhorse', fallback: 'system-ui, sans-serif' },
  { family: 'Poppins', category: 'sans', weights: [300, 400, 500, 600, 700, 800], note: 'Geometric, friendly', fallback: 'system-ui, sans-serif' },
  { family: 'Montserrat', category: 'sans', weights: [300, 400, 500, 600, 700, 800, 900], note: 'Corporate & clean', fallback: 'system-ui, sans-serif' },
  { family: 'Space Grotesk', category: 'sans', weights: [300, 400, 500, 600, 700], note: 'Technical, modern', fallback: 'system-ui, sans-serif' },
  { family: 'Archivo Black', category: 'display', weights: [400], note: 'Heavy poster headline', fallback: 'Impact, sans-serif' },
  { family: 'Bebas Neue', category: 'display', weights: [400], note: 'Condensed caps', fallback: 'Impact, sans-serif' },
  { family: 'Oswald', category: 'display', weights: [300, 400, 500, 600, 700], note: 'Tall condensed', fallback: 'Impact, sans-serif' },
  { family: 'Playfair Display', category: 'serif', weights: [400, 500, 600, 700, 800, 900], note: 'Elegant editorial', fallback: 'Georgia, serif' },
  { family: 'DM Serif Display', category: 'serif', weights: [400], note: 'High-contrast serif', fallback: 'Georgia, serif' },
  { family: 'Lora', category: 'serif', weights: [400, 500, 600, 700], note: 'Readable serif body', fallback: 'Georgia, serif' },
  { family: 'Cormorant Garamond', category: 'serif', weights: [300, 400, 500, 600, 700], note: 'Wedding & luxury', fallback: 'Georgia, serif' },
  { family: 'Caveat', category: 'handwriting', weights: [400, 500, 600, 700], note: 'Casual script accent', fallback: 'cursive' },
  { family: 'IBM Plex Mono', category: 'mono', weights: [300, 400, 500, 600], note: 'Data & code labels', fallback: 'ui-monospace, monospace' },
];

export const DEFAULT_FONT = 'Inter';

export const FONT_CATEGORIES: { id: FontCategory; label: string }[] = [
  { id: 'sans', label: 'Sans serif' },
  { id: 'display', label: 'Display' },
  { id: 'serif', label: 'Serif' },
  { id: 'handwriting', label: 'Script' },
  { id: 'mono', label: 'Mono' },
];

export function getFont(family: string): FontDefinition | undefined {
  return FONTS.find((f) => f.family === family);
}

/** CSS font shorthand used by DOM-based previews (font pickers, thumbnails). */
export function fontStack(family: string): string {
  const font = getFont(family);
  return `"${family}", ${font?.fallback ?? 'system-ui, sans-serif'}`;
}

/**
 * Load a Google Fonts stylesheet on demand. Used by the font picker so the
 * preview list renders in the correct face before the user picks it.
 */
const loaded = new Set<string>();

export function ensureFontLoaded(family: string): void {
  if (typeof document === 'undefined' || loaded.has(family)) return;
  const font = getFont(family);
  if (!font) return;
  loaded.add(family);
  const weights = font.weights.join(';');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(
    /%20/g,
    '+',
  )}:wght@${weights}&display=swap`;
  document.head.appendChild(link);
}
