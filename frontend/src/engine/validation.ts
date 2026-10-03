/**
 * Design Engine — validation & sanitisation.
 *
 * Security posture: the frontend never holds provider keys, never trusts an
 * uploaded file, and never renders user text as HTML. Everything that enters
 * the document passes through here first.
 */

import type { DesignDocument, DesignElement, SerializedDesign } from './types';
import { CURRENT_VERSION } from './migrations';

/* ------------------------------------------------------------------ */
/* Upload validation                                                   */
/* ------------------------------------------------------------------ */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
] as const;

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validateImageUpload(file: File): ValidationResult {
  if (!file) return { ok: false, error: 'No file selected.' };

  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return {
      ok: false,
      error: `Unsupported format "${file.type || 'unknown'}". Use PNG, JPG, WEBP, GIF or SVG.`,
    };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `File is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`,
    };
  }

  if (file.size === 0) return { ok: false, error: 'File is empty.' };

  return { ok: true };
}

/**
 * SVG uploads can carry scripts. Because we only ever load them through
 * `<img>`/Konva (never inline into the DOM) they cannot execute, but we strip
 * the obvious vectors as defence in depth.
 */
export function sanitizeSvg(source: string): string {
  return source
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/* ------------------------------------------------------------------ */
/* Text sanitisation                                                   */
/* ------------------------------------------------------------------ */

export const MAX_TEXT_LENGTH = 4000;

/**
 * Text is stored as data and drawn to canvas — never injected as HTML — so
 * the risk surface is small. We still strip control characters, clamp length
 * and normalise whitespace so the document stays clean and diff-friendly.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .slice(0, MAX_TEXT_LENGTH);
}

/** Escape a string for safe interpolation into generated SVG markup. */
export function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/* ------------------------------------------------------------------ */
/* Document validation                                                 */
/* ------------------------------------------------------------------ */

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function validateElement(el: unknown, path: string, errors: string[]): void {
  if (!el || typeof el !== 'object') {
    errors.push(`${path}: not an object`);
    return;
  }
  const e = el as Record<string, unknown>;
  if (typeof e.id !== 'string' || !e.id) errors.push(`${path}: missing id`);
  if (typeof e.type !== 'string') errors.push(`${path}: missing type`);
  for (const key of ['x', 'y', 'width', 'height', 'rotation', 'opacity']) {
    if (!isFiniteNumber(e[key])) errors.push(`${path}.${key}: must be a finite number`);
  }
  if (isFiniteNumber(e.width) && e.width <= 0) errors.push(`${path}.width: must be > 0`);
  if (isFiniteNumber(e.height) && e.height <= 0) errors.push(`${path}.height: must be > 0`);
  if (e.type === 'text' && typeof e.text !== 'string') errors.push(`${path}.text: must be a string`);
  if (e.type === 'image' && typeof e.src !== 'string') errors.push(`${path}.src: must be a string`);
  if (e.type === 'group' && Array.isArray(e.children)) {
    e.children.forEach((child, i) => validateElement(child, `${path}.children[${i}]`, errors));
  }
}

export function validateDesignDocument(doc: DesignDocument): ValidationResult {
  const errors: string[] = [];
  if (!doc.id) errors.push('Document is missing an id.');
  if (!isFiniteNumber(doc.width) || doc.width <= 0) errors.push('Canvas width must be > 0.');
  if (!isFiniteNumber(doc.height) || doc.height <= 0) errors.push('Canvas height must be > 0.');
  if (!doc.background) errors.push('Document is missing a background.');
  if (!Array.isArray(doc.elements)) errors.push('elements must be an array.');
  else doc.elements.forEach((el, i) => validateElement(el, `elements[${i}]`, errors));

  return errors.length ? { ok: false, error: errors.slice(0, 5).join('\n') } : { ok: true };
}

export function validateSerializedDesign(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Not a JSON object.' };
  const raw = input as Partial<SerializedDesign>;
  if (typeof raw.version !== 'number') return { ok: false, error: 'Missing "version" field.' };
  if (raw.version > CURRENT_VERSION) {
    return {
      ok: false,
      error: `This file was created by a newer version of the editor (v${raw.version}).`,
    };
  }
  if (!raw.canvas || !isFiniteNumber(raw.canvas.width) || !isFiniteNumber(raw.canvas.height)) {
    return { ok: false, error: 'Missing or invalid canvas size.' };
  }
  if (!Array.isArray(raw.elements)) return { ok: false, error: 'Missing elements array.' };
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Element factory guards                                              */
/* ------------------------------------------------------------------ */

export function isValidColor(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim()) ||
    /^rgba?\(/i.test(value.trim());
}

export function normaliseHex(value: string, fallback = '#111111'): string {
  const v = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    return `#${v.slice(1).split('').map((c) => c + c).join('')}`.toLowerCase();
  }
  return fallback;
}

/** Depth guard so a malicious/deep file can never blow the stack. */
export function maxElementDepth(elements: DesignElement[], depth = 0): number {
  let max = depth;
  for (const el of elements) {
    if (el.type === 'group') max = Math.max(max, maxElementDepth(el.children, depth + 1));
  }
  return max;
}

export const MAX_GROUP_DEPTH = 6;
