/**
 * Brand kit service.
 *
 * A brand kit is a reusable set of design tokens the editor can pull into any
 * document. Stored as plain data so it can be synced to a backend and shared
 * across a future team workspace.
 */

import { STORAGE_KEYS, storage } from '@/lib/storage';
import { apiConfig, delay, request } from './httpClient';

export interface BrandColor {
  id: string;
  name: string;
  value: string;
}

export interface BrandFont {
  id: string;
  family: string;
  role: 'heading' | 'body' | 'accent' | 'mono';
}

export interface BrandLogo {
  id: string;
  name: string;
  src: string;
  /** light/dark/mono variants help the AI pick the right one per background */
  variant: 'primary' | 'light' | 'dark' | 'mono';
}

export interface BrandSocialLink {
  id: string;
  platform: string;
  handle: string;
  url: string;
}

export interface BrandBusinessInfo {
  companyName: string;
  tagline: string;
  email: string;
  phone: string;
  website: string;
  address: string;
}

export interface BrandKit {
  id: string;
  name: string;
  isDefault: boolean;
  colors: BrandColor[];
  fonts: BrandFont[];
  logos: BrandLogo[];
  business: BrandBusinessInfo;
  socials: BrandSocialLink[];
  /** reusable brand imagery */
  imageAssetIds: string[];
  updatedAt: string;
}

export interface BrandKitService {
  list(): Promise<BrandKit[]>;
  get(id: string): Promise<BrandKit | null>;
  getActive(): Promise<BrandKit | null>;
  setActive(id: string): Promise<void>;
  save(kit: BrandKit): Promise<BrandKit>;
  create(name: string): Promise<BrandKit>;
  remove(id: string): Promise<void>;
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function emptyBrandKit(name = 'My brand'): BrandKit {
  return {
    id: `brd_${newId()}`,
    name,
    isDefault: false,
    colors: [
      { id: `c_${newId()}`, name: 'Primary', value: '#4f46e5' },
      { id: `c_${newId()}`, name: 'Secondary', value: '#f4b942' },
      { id: `c_${newId()}`, name: 'Ink', value: '#0c0e13' },
      { id: `c_${newId()}`, name: 'Surface', value: '#ffffff' },
    ],
    fonts: [
      { id: `f_${newId()}`, family: 'Inter', role: 'body' },
      { id: `f_${newId()}`, family: 'Montserrat', role: 'heading' },
    ],
    logos: [],
    business: {
      companyName: '',
      tagline: '',
      email: '',
      phone: '',
      website: '',
      address: '',
    },
    socials: [],
    imageAssetIds: [],
    updatedAt: new Date().toISOString(),
  };
}

/** A ready-made kit so the Brand Kit page is never an empty shell on first run. */
export function starterBrandKit(): BrandKit {
  const kit = emptyBrandKit('Northwind Studio');
  return {
    ...kit,
    isDefault: true,
    colors: [
      { id: `c_${newId()}`, name: 'Primary', value: '#123456' },
      { id: `c_${newId()}`, name: 'Secondary', value: '#f4b942' },
      { id: `c_${newId()}`, name: 'Ink', value: '#0b1220' },
      { id: `c_${newId()}`, name: 'Cloud', value: '#f5f7fb' },
    ],
    fonts: [
      { id: `f_${newId()}`, family: 'Montserrat', role: 'heading' },
      { id: `f_${newId()}`, family: 'Inter', role: 'body' },
      { id: `f_${newId()}`, family: 'Cormorant Garamond', role: 'accent' },
    ],
    business: {
      companyName: 'Northwind Studio',
      tagline: 'Brand & campaign design',
      email: 'hello@northwind.studio',
      phone: '+1 555 0142',
      website: 'northwind.studio',
      address: '12 Harbour Lane, Portland',
    },
    socials: [
      { id: `s_${newId()}`, platform: 'Instagram', handle: '@northwind', url: 'https://instagram.com/northwind' },
      { id: `s_${newId()}`, platform: 'LinkedIn', handle: 'northwind-studio', url: 'https://linkedin.com/company/northwind' },
    ],
  };
}

function readAll(): BrandKit[] {
  const raw = storage.get<unknown>(STORAGE_KEYS.brandKits, []);
  const kits = Array.isArray(raw) ? (raw as BrandKit[]) : [];
  return kits.length ? kits : [starterBrandKit()];
}

function writeAll(kits: BrandKit[]): void {
  storage.set(STORAGE_KEYS.brandKits, kits);
}

export const localBrandKitService: BrandKitService = {
  async list() {
    return delay(readAll());
  },
  async get(id) {
    return readAll().find((k) => k.id === id) ?? null;
  },
  async getActive() {
    const activeId = storage.get<string | null>(STORAGE_KEYS.activeBrandKit, null);
    const kits = readAll();
    return kits.find((k) => k.id === activeId) ?? kits[0] ?? null;
  },
  async setActive(id) {
    storage.set(STORAGE_KEYS.activeBrandKit, id);
  },
  async save(kit) {
    const kits = readAll();
    const index = kits.findIndex((k) => k.id === kit.id);
    const next = { ...kit, updatedAt: new Date().toISOString() };
    if (index >= 0) kits[index] = next;
    else kits.push(next);
    writeAll(kits);
    return next;
  },
  async create(name) {
    const kits = readAll();
    const kit = emptyBrandKit(name);
    kits.push(kit);
    writeAll(kits);
    return kit;
  },
  async remove(id) {
    const kits = readAll().filter((k) => k.id !== id);
    writeAll(kits.length ? kits : [starterBrandKit()]);
    if (storage.get<string | null>(STORAGE_KEYS.activeBrandKit, null) === id) {
      storage.remove(STORAGE_KEYS.activeBrandKit);
    }
  },
};

export const remoteBrandKitService: BrandKitService = {
  list: () => request<BrandKit[]>('/brand-kits'),
  get: (id) => request<BrandKit | null>(`/brand-kits/${id}`),
  getActive: () => request<BrandKit | null>('/brand-kits/active'),
  setActive: (id) => request<void>(`/brand-kits/${id}/activate`, { method: 'POST' }),
  save: (kit) => request<BrandKit>(`/brand-kits/${kit.id}`, { method: 'PUT', body: kit }),
  create: (name) => request<BrandKit>('/brand-kits', { method: 'POST', body: { name } }),
  remove: (id) => request<void>(`/brand-kits/${id}`, { method: 'DELETE' }),
};

export const brandKitService: BrandKitService = apiConfig.baseUrl
  ? remoteBrandKitService
  : localBrandKitService;
