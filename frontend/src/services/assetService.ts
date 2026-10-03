/**
 * Asset service.
 *
 * Extensible by design: `AssetKind` already lists the media types the platform
 * intends to support. Only `image` and `logo` have upload paths today; the
 * others are typed so the library, filters and pickers are ready for them.
 */

import { STORAGE_KEYS, storage } from '@/lib/storage';
import {
  MAX_UPLOAD_BYTES,
  formatBytes,
  sanitizeSvg,
  validateImageUpload,
} from '@/engine';
import { fileToDataUrl, imageDimensions } from '@/lib/utils';
import { apiConfig, delay, request } from './httpClient';

export type AssetKind = 'image' | 'logo' | 'icon' | 'illustration' | 'font' | 'video' | 'audio';

/** Kinds that are fully wired up in this version. */
export const SUPPORTED_UPLOAD_KINDS: AssetKind[] = ['image', 'logo'];

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  /** data URL in local mode; an object-storage URL once a backend exists */
  src: string;
  width: number;
  height: number;
  size: number;
  mimeType: string;
  createdAt: string;
  tags: string[];
  folderId?: string | null;
  /** set when the asset came from an AI generation job */
  generatedBy?: 'upload' | 'ai' | 'brand-kit';
}

export interface UploadOptions {
  kind?: AssetKind;
  name?: string;
  tags?: string[];
  folderId?: string | null;
}

export interface AssetService {
  list(kind?: AssetKind): Promise<Asset[]>;
  upload(file: File, options?: UploadOptions): Promise<Asset>;
  /** Register an already-encoded source (AI output, generated artwork). */
  register(src: string, options: UploadOptions & { width: number; height: number; size?: number }): Promise<Asset>;
  remove(id: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
}

/* ------------------------------------------------------------------ */

function readAll(): Asset[] {
  const raw = storage.get<unknown>(STORAGE_KEYS.assets, []);
  return Array.isArray(raw) ? (raw as Asset[]) : [];
}

function writeAll(assets: Asset[]): void {
  storage.set(STORAGE_KEYS.assets, assets);
}

const newId = () => `ast_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const localAssetService: AssetService = {
  async list(kind) {
    const all = readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return delay(kind ? all.filter((a) => a.kind === kind) : all, 60);
  },

  async upload(file, options = {}) {
    const kind = options.kind ?? 'image';

    if (!SUPPORTED_UPLOAD_KINDS.includes(kind)) {
      throw new Error(`Uploading "${kind}" assets is not available yet.`);
    }

    // Validate MIME type and size BEFORE reading anything into memory.
    const validation = validateImageUpload(file);
    if (!validation.ok) throw new Error(validation.error);

    let src = await fileToDataUrl(file);

    // SVG can carry script; we only ever load it via <img>, but strip anyway.
    if (file.type === 'image/svg+xml') {
      const decoded = decodeURIComponent(src.split(',')[1] ?? '');
      src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizeSvg(decoded))}`;
    }

    let width = 0;
    let height = 0;
    try {
      const dims = await imageDimensions(src);
      width = dims.width;
      height = dims.height;
    } catch {
      // An SVG without intrinsic size, or a corrupt file — keep the asset but
      // flag it so the UI can render a placeholder rather than a broken box.
      width = 0;
      height = 0;
    }

    const asset: Asset = {
      id: newId(),
      kind,
      name: (options.name ?? file.name.replace(/\.[^.]+$/, '').slice(0, 60)) || 'Untitled asset',
      src,
      width,
      height,
      size: file.size,
      mimeType: file.type,
      createdAt: new Date().toISOString(),
      tags: options.tags ?? [],
      folderId: options.folderId ?? null,
      generatedBy: 'upload',
    };

    const all = readAll();
    all.unshift(asset);
    writeAll(all);
    return delay(asset, 80);
  },

  async register(src, options) {
    const asset: Asset = {
      id: newId(),
      kind: options.kind ?? 'image',
      name: options.name ?? 'Generated asset',
      src,
      width: options.width,
      height: options.height,
      size: options.size ?? Math.round(src.length * 0.75),
      mimeType: src.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/png',
      createdAt: new Date().toISOString(),
      tags: options.tags ?? ['ai'],
      folderId: options.folderId ?? null,
      generatedBy: 'ai',
    };
    const all = readAll();
    all.unshift(asset);
    writeAll(all);
    return delay(asset, 40);
  },

  async remove(id) {
    writeAll(readAll().filter((a) => a.id !== id));
  },

  async rename(id, name) {
    const all = readAll();
    const target = all.find((a) => a.id === id);
    if (!target) return;
    target.name = name;
    writeAll(all);
  },
};

/* ------------------------------------------------------------------ */

export const remoteAssetService: AssetService = {
  list: (kind) => request<Asset[]>(`/assets${kind ? `?kind=${kind}` : ''}`),
  upload: async (file, options = {}) => {
    const validation = validateImageUpload(file);
    if (!validation.ok) throw new Error(validation.error);
    const form = new FormData();
    form.append('file', file);
    if (options.kind) form.append('kind', options.kind);
    const response = await fetch(`${apiConfig.baseUrl}/assets`, {
      method: 'POST',
      body: form,
      credentials: 'include',
      headers: apiConfig.getAccessToken()
        ? { Authorization: `Bearer ${apiConfig.getAccessToken()}` }
        : undefined,
    });
    if (!response.ok) {
      let message = 'Upload failed';
      try {
        message = ((await response.json()) as { message?: string }).message ?? message;
      } catch {
        /* non-JSON error body */
      }
      throw new Error(message);
    }
    return (await response.json()) as Asset;
  },
  register: (src, options) =>
    request<Asset>('/assets/register', { method: 'POST', body: { src, ...options } }),
  remove: (id) => request<void>(`/assets/${id}`, { method: 'DELETE' }),
  rename: (id, name) => request<void>(`/assets/${id}`, { method: 'PATCH', body: { name } }),
};

export const assetService: AssetService = apiConfig.baseUrl ? remoteAssetService : localAssetService;

export const UPLOAD_LIMITS = {
  maxBytes: MAX_UPLOAD_BYTES,
  label: formatBytes(MAX_UPLOAD_BYTES),
};
