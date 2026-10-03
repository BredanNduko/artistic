/**
 * Persistence adapter.
 *
 * Everything the app persists goes through this one module. Today it is
 * localStorage; swapping in IndexedDB (for large asset blobs) or a real
 * backend only means reimplementing `StorageAdapter` — no call site changes.
 *
 * Namespacing every key keeps us safe when this app is embedded alongside
 * others on the same origin.
 */

const NAMESPACE = 'designforge';

export interface StorageAdapter {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  keys(): string[];
}

function namespaced(key: string): string {
  return `${NAMESPACE}:${key}`;
}

const memory = new Map<string, string>();

function hasLocalStorage(): boolean {
  try {
    const probe = `${NAMESPACE}:__probe__`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const available = typeof window !== 'undefined' && hasLocalStorage();

/**
 * localStorage-backed adapter with an in-memory fallback for private browsing
 * or when the quota is exhausted (a large embedded image can blow the 5 MB
 * budget, and we would rather degrade than throw).
 */
export const storage: StorageAdapter = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = available ? window.localStorage.getItem(namespaced(key)) : memory.get(namespaced(key));
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  set<T>(key: string, value: T): void {
    const raw = JSON.stringify(value);
    try {
      if (available) window.localStorage.setItem(namespaced(key), raw);
      else memory.set(namespaced(key), raw);
    } catch {
      // Quota exceeded — keep the value for this session so nothing is lost.
      memory.set(namespaced(key), raw);
      console.warn(`[storage] Could not persist "${key}" to localStorage; kept in memory only.`);
    }
  },

  remove(key: string): void {
    try {
      if (available) window.localStorage.removeItem(namespaced(key));
    } catch {
      /* ignore */
    }
    memory.delete(namespaced(key));
  },

  keys(): string[] {
    if (!available) return [...memory.keys()];
    return Object.keys(window.localStorage)
      .filter((k) => k.startsWith(`${NAMESPACE}:`))
      .map((k) => k.slice(NAMESPACE.length + 1));
  },
};

export const STORAGE_KEYS = {
  projects: 'projects',
  assets: 'assets',
  brandKits: 'brand-kits',
  activeBrandKit: 'active-brand-kit',
  /** auth session — deliberately distinct from the persisted user store */
  authUser: 'auth-user',
  user: 'user',
  settings: 'settings',
  aiDrafts: 'ai-drafts',
  recent: 'recent-designs',
} as const;
