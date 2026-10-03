/**
 * Formats helper used by the editor when it needs a default canvas.
 * Re-exported through lib/ so stores never import from data/ directly.
 */

import { FORMATS, getFormat, type DesignFormat } from '@/data/formats';

export const DEFAULT_FORMAT_ID = 'instagram-post';

export function getFormatOrDefault(id: string | undefined): DesignFormat {
  return getFormat(id) ?? FORMATS[0];
}

export const NEW_DESIGN_FORMATS = FORMATS.filter((f) => f.id !== 'custom');
