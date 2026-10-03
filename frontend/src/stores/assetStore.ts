/**
 * Asset store — the user's uploaded and generated media.
 * Mirrors `assetService`; components read from here so a slow upload never
 * blocks a re-render elsewhere.
 */

import { create } from 'zustand';
import { assetService, UPLOAD_LIMITS, type Asset, type AssetKind, type UploadOptions } from '@/services';
import { useUIStore } from './uiStore';

export interface AssetState {
  assets: Asset[];
  loading: boolean;
  uploading: boolean;
  /** 0..1 progress for the current upload batch */
  progress: number;
  filter: AssetKind | 'all';
  search: string;
  error: string | null;

  load: () => Promise<void>;
  setFilter: (filter: AssetKind | 'all') => void;
  setSearch: (search: string) => void;
  upload: (files: File[], options?: UploadOptions) => Promise<Asset[]>;
  register: (src: string, options: UploadOptions & { width: number; height: number; size?: number }) => Promise<Asset>;
  remove: (id: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  visible: () => Asset[];
}

export const useAssetStore = create<AssetState>((set, get) => ({
  assets: [],
  loading: false,
  uploading: false,
  progress: 0,
  filter: 'all',
  search: '',
  error: null,

  load: async () => {
    set({ loading: true });
    try {
      const assets = await assetService.list();
      set({ assets, loading: false, error: null });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Could not load assets.',
      });
    }
  },

  setFilter: (filter) => set({ filter }),
  setSearch: (search) => set({ search }),

  upload: async (files, options) => {
    if (!files.length) return [];
    set({ uploading: true, progress: 0, error: null });
    const uploaded: Asset[] = [];
    const failures: string[] = [];

    for (let i = 0; i < files.length; i += 1) {
      try {
        // assetService validates MIME type and byte size before reading.
        uploaded.push(await assetService.upload(files[i], options));
      } catch (error) {
        failures.push(error instanceof Error ? error.message : `${files[i].name} failed.`);
      }
      set({ progress: (i + 1) / files.length });
    }

    set((state) => ({
      assets: [...uploaded, ...state.assets],
      uploading: false,
      progress: 0,
    }));

    const toast = useUIStore.getState().pushToast;
    if (uploaded.length) {
      toast({
        title: `${uploaded.length} asset${uploaded.length > 1 ? 's' : ''} uploaded`,
        description: `Stored in this browser (limit ${UPLOAD_LIMITS.label} per file).`,
        variant: 'success',
      });
    }
    if (failures.length) {
      set({ error: failures[0] });
      toast({
        title: failures.length > 1 ? `${failures.length} files rejected` : 'Upload rejected',
        description: failures[0],
        variant: 'error',
      });
    }
    return uploaded;
  },

  register: async (src, options) => {
    const asset = await assetService.register(src, options);
    set((state) => ({ assets: [asset, ...state.assets] }));
    return asset;
  },

  remove: async (id) => {
    await assetService.remove(id);
    set((state) => ({ assets: state.assets.filter((a) => a.id !== id) }));
  },

  rename: async (id, name) => {
    await assetService.rename(id, name);
    set((state) => ({
      assets: state.assets.map((a) => (a.id === id ? { ...a, name } : a)),
    }));
  },

  visible: () => {
    const { assets, filter, search } = get();
    const term = search.trim().toLowerCase();
    return assets.filter((asset) => {
      if (filter !== 'all' && asset.kind !== filter) return false;
      if (!term) return true;
      return (
        asset.name.toLowerCase().includes(term) ||
        asset.tags.some((tag) => tag.toLowerCase().includes(term))
      );
    });
  },
}));
