/**
 * User store — session, preferences and the active brand kit.
 * Brand kits live here because they are user-scoped configuration that the
 * editor reads passively; a team workspace would later sync them server-side.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  authService,
  brandKitService,
  emptyBrandKit,
  isBackendConfigured,
  type BrandKit,
  type User,
} from '@/services';
import { useUIStore } from './uiStore';

export interface AppSettings {
  autosave: boolean;
  autosaveDelayMs: number;
  defaultFormat: string;
  showGridOnNewDesign: boolean;
  reduceMotion: boolean;
  /** whether a real AI provider is connected on the backend */
  aiProviderConnected: boolean;
}

export interface UserState {
  user: User | null;
  initialised: boolean;
  busy: boolean;
  brandKits: BrandKit[];
  activeBrandKit: BrandKit | null;
  settings: AppSettings;

  initialise: () => Promise<void>;
  signIn: (email: string, name?: string, password?: string) => Promise<void>;
  signUp: (email: string, name?: string, password?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<User>) => Promise<void>;

  loadBrandKits: () => Promise<void>;
  setActiveBrandKit: (id: string) => Promise<void>;
  saveBrandKit: (kit: BrandKit) => Promise<void>;
  createBrandKit: (name: string) => Promise<BrandKit>;
  removeBrandKit: (id: string) => Promise<void>;

  updateSettings: (patch: Partial<AppSettings>) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  autosave: true,
  autosaveDelayMs: 2500,
  defaultFormat: 'instagram-post',
  showGridOnNewDesign: false,
  reduceMotion: false,
  aiProviderConnected: false,
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      initialised: false,
      busy: false,
      brandKits: [],
      activeBrandKit: null,
      settings: DEFAULT_SETTINGS,

      initialise: async () => {
        try {
          const user = await authService.getCurrentUser();
          // With a backend, brand kits belong to an account: don't ask for them while signed out.
          if (isBackendConfigured() && !user) {
            set({ user: null, brandKits: [], activeBrandKit: null, initialised: true });
            return;
          }
          const [kits, active] = await Promise.all([
            brandKitService.list(),
            brandKitService.getActive(),
          ]);
          set({ user, brandKits: kits, activeBrandKit: active, initialised: true });
        } catch {
          // Backend unreachable: still let the app render (and show its own error states).
          set({ initialised: true });
        }
      },

      signIn: async (email, name, password) => {
        set({ busy: true });
        try {
          const user = await authService.signIn({ email, name, password });
          set({ user, busy: false });
          useUIStore.getState().pushToast({
            title: `Welcome back, ${user.name}`,
            description: isBackendConfigured()
              ? 'Your designs are saved to your account.'
              : 'Your designs are stored locally in this browser.',
            variant: 'success',
          });
          if (isBackendConfigured()) await get().loadBrandKits();
        } catch (error) {
          set({ busy: false });
          useUIStore.getState().pushToast({
            title: 'Could not sign in',
            description: error instanceof Error ? error.message : 'Please try again.',
            variant: 'error',
          });
        }
      },

      signUp: async (email, name, password) => {
        set({ busy: true });
        try {
          const user = await authService.signUp({ email, name, password });
          set({ user, busy: false });
          useUIStore.getState().pushToast({
            title: `Welcome, ${user.name}`,
            description: isBackendConfigured()
              ? 'Your account is ready.'
              : 'Local mode — no account server is connected yet.',
            variant: 'success',
          });
          if (isBackendConfigured()) await get().loadBrandKits();
        } catch (error) {
          set({ busy: false });
          useUIStore.getState().pushToast({
            title: 'Could not create account',
            description: error instanceof Error ? error.message : 'Please try again.',
            variant: 'error',
          });
        }
      },

      signOut: async () => {
        await authService.signOut();
        set({ user: null, ...(isBackendConfigured() ? { brandKits: [], activeBrandKit: null } : {}) });
      },

      updateProfile: async (patch) => {
        const user = await authService.updateProfile(patch);
        set({ user });
      },

      loadBrandKits: async () => {
        const [kits, active] = await Promise.all([
          brandKitService.list(),
          brandKitService.getActive(),
        ]);
        set({ brandKits: kits, activeBrandKit: active });
      },

      setActiveBrandKit: async (id) => {
        await brandKitService.setActive(id);
        const kit = get().brandKits.find((k) => k.id === id) ?? null;
        set({ activeBrandKit: kit });
      },

      saveBrandKit: async (kit) => {
        const saved = await brandKitService.save(kit);
        set((state) => ({
          brandKits: state.brandKits.some((k) => k.id === saved.id)
            ? state.brandKits.map((k) => (k.id === saved.id ? saved : k))
            : [...state.brandKits, saved],
          activeBrandKit: state.activeBrandKit?.id === saved.id ? saved : state.activeBrandKit,
        }));
        useUIStore.getState().pushToast({ title: 'Brand kit saved', variant: 'success' });
      },

      createBrandKit: async (name) => {
        const kit = await brandKitService.create(name);
        set((state) => ({ brandKits: [...state.brandKits, kit] }));
        return kit;
      },

      removeBrandKit: async (id) => {
        await brandKitService.remove(id);
        await get().loadBrandKits();
        useUIStore.getState().pushToast({ title: 'Brand kit deleted', variant: 'default' });
      },

      updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
    }),
    {
      name: 'designforge:user',
      partialize: (state) => ({ settings: state.settings }),
    },
  ),
);

export { emptyBrandKit };
