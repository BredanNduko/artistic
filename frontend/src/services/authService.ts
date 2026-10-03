/**
 * Authentication service.
 *
 * Local mode is a real, working single-user session stored in localStorage —
 * not a stub. It exists so the app has a genuine notion of "current user" and
 * the account menu, onboarding and ownership fields all behave correctly.
 *
 * Swapping in a real provider means implementing the same `AuthService` and
 * flipping `authService` — no component changes. Note that this service never
 * handles passwords: a real implementation delegates to the backend / OAuth.
 */

import { STORAGE_KEYS, storage } from '@/lib/storage';
import { apiConfig, delay, request } from './httpClient';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  plan: 'free' | 'pro' | 'team';
  createdAt: string;
  /** future team/collaboration hook */
  teamId?: string | null;
}

export interface Credentials {
  email: string;
  name?: string;
  /** required by the backend; the local implementation ignores it */
  password?: string;
}

export interface AuthService {
  getCurrentUser(): Promise<User | null>;
  signIn(credentials: Credentials): Promise<User>;
  signUp(credentials: Credentials): Promise<User>;
  signOut(): Promise<void>;
  updateProfile(patch: Partial<User>): Promise<User>;
}

const AVATAR_COLORS = ['#4f46e5', '#0ea5e9', '#16a34a', '#f59e0b', '#db2777', '#7c3aed'];

function makeUser(credentials: Credentials): User {
  const name = credentials.name?.trim() || credentials.email.split('@')[0];
  return {
    id: `usr_${Math.random().toString(36).slice(2, 10)}`,
    name,
    email: credentials.email,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    plan: 'free',
    createdAt: new Date().toISOString(),
    teamId: null,
  };
}

export const localAuthService: AuthService = {
  async getCurrentUser() {
    return storage.get<User | null>(STORAGE_KEYS.authUser, null);
  },

  async signIn(credentials) {
    const existing = storage.get<User | null>(STORAGE_KEYS.user, null);
    const user =
      existing && existing.email === credentials.email ? existing : makeUser(credentials);
    storage.set(STORAGE_KEYS.user, user);
    return delay(user, 200);
  },

  async signUp(credentials) {
    const user = makeUser(credentials);
    storage.set(STORAGE_KEYS.user, user);
    return delay(user, 260);
  },

  async signOut() {
    storage.remove(STORAGE_KEYS.user);
    await delay(null, 80);
  },

  async updateProfile(patch) {
    const current = storage.get<User | null>(STORAGE_KEYS.user, null);
    if (!current) throw new Error('Not signed in.');
    const next = { ...current, ...patch };
    storage.set(STORAGE_KEYS.user, next);
    return next;
  },
};

export const remoteAuthService: AuthService = {
  getCurrentUser: () => request<User | null>('/auth/me'),
  signIn: (credentials) => request<User>('/auth/sign-in', { method: 'POST', body: credentials }),
  signUp: (credentials) => request<User>('/auth/sign-up', { method: 'POST', body: credentials }),
  signOut: () => request<void>('/auth/sign-out', { method: 'POST' }),
  updateProfile: (patch) => request<User>('/auth/me', { method: 'PATCH', body: patch }),
};

export const authService: AuthService = apiConfig.baseUrl ? remoteAuthService : localAuthService;
