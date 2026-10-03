/**
 * Export service.
 *
 * PNG and JPG are fully implemented and produce a real Blob from the same
 * renderer the canvas uses — no screenshotting, no DOM capture.
 *
 * PDF is intentionally NOT faked. `exportPDF` throws `NotImplementedError`,
 * which the UI surfaces as "Coming soon". When it lands it will reuse the
 * identical `ExportService` interface, so no call site changes.
 */

import type { DesignDocument } from '@/engine';
import { renderSceneToBlob, renderSceneToDataURL } from '@/engine';
import { slugify } from '@/lib/utils';
import { NotImplementedError } from './httpClient';

export type ExportFormat = 'png' | 'jpg' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  /** 1 = design resolution, 2 = retina, 0.5 = half */
  scale?: number;
  quality?: number;
  /** flatten transparency onto this colour (required for JPG) */
  background?: string;
  /** transparent PNG keeps alpha; JPG always flattens */
  transparent?: boolean;
  filename?: string;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  format: ExportFormat;
  size: number;
}

export interface ExportService {
  exportPNG(design: DesignDocument, options?: Partial<ExportOptions>): Promise<ExportResult>;
  exportJPG(design: DesignDocument, options?: Partial<ExportOptions>): Promise<ExportResult>;
  exportPDF(design: DesignDocument, options?: Partial<ExportOptions>): Promise<ExportResult>;
  /** Render a small preview used for project thumbnails. */
  thumbnail(design: DesignDocument, maxSize?: number): Promise<string>;
}

/* ------------------------------------------------------------------ */

function filenameFor(doc: DesignDocument, format: ExportFormat): string {
  return `${slugify(doc.name)}.${format === 'jpg' ? 'jpg' : format}`;
}

export const exportService: ExportService = {
  async exportPNG(design, options = {}) {
    const scale = options.scale ?? 1;
    const blob = await renderSceneToBlob(design, {
      pixelRatio: scale,
      mime: 'image/png',
    });
    return {
      blob,
      filename: options.filename ?? filenameFor(design, 'png'),
      width: Math.round(design.width * scale),
      height: Math.round(design.height * scale),
      format: 'png',
      size: blob.size,
    };
  },

  async exportJPG(design, options = {}) {
    const scale = options.scale ?? 1;
    // JPG has no alpha channel: always flatten onto a solid colour.
    const blob = await renderSceneToBlob(design, {
      pixelRatio: scale,
      mime: 'image/jpeg',
      quality: options.quality ?? 0.92,
      padding: 0,
      background:
        options.background ??
        (typeof design.background === 'string' ? design.background : '#ffffff'),
    });
    return {
      blob,
      filename: options.filename ?? filenameFor(design, 'jpg'),
      width: Math.round(design.width * scale),
      height: Math.round(design.height * scale),
      format: 'jpg',
      size: blob.size,
    };
  },

  async exportPDF(design, options = {}) {
    // Deliberately honest: PDF needs a vector/page pipeline (pdf-lib or a
    // server-side renderer) and is not wired up in this version.
    void design;
    void options;
    throw new NotImplementedError('PDF export');
  },

  async thumbnail(design, maxSize = 512) {
    const ratio = Math.min(maxSize / design.width, maxSize / design.height, 1);
    return renderSceneToDataURL(design, { pixelRatio: Math.max(0.12, ratio) });
  },
};

export const EXPORT_PRESETS: { id: string; label: string; scale: number; hint: string }[] = [
  { id: 'standard', label: 'Standard', scale: 1, hint: 'Design resolution' },
  { id: 'high', label: 'High (2x)', scale: 2, hint: 'Retina / print-ready' },
  { id: 'ultra', label: 'Ultra (3x)', scale: 3, hint: 'Large format print' },
  { id: 'web', label: 'Web (0.5x)', scale: 0.5, hint: 'Smaller file size' },
];
