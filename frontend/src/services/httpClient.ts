/**
 * Services layer — transport.
 *
 * This is the ONLY place that knows how to talk to a server. Components never
 * call `fetch`; they call a service. When a real backend appears, we point
 * `API_BASE_URL` at it and the mock repositories behind each service are
 * swapped for HTTP ones — no component changes.
 *
 * Security note: no AI provider key ever lives here. AI calls go
 * Frontend -> our backend -> provider, so the key stays server-side.
 */

export interface ApiConfig {
  baseUrl: string | null;
  getAccessToken: () => string | null;
}

export const apiConfig: ApiConfig = {
  // `null` means "no backend configured yet" — every service falls back to its
  // local implementation. Set VITE_API_BASE_URL to switch to a real server.
  baseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? null,
  getAccessToken: () => {
    try {
      return window.localStorage.getItem('designforge:access-token');
    } catch {
      return null;
    }
  },
};

export function isBackendConfigured(): boolean {
  return Boolean(apiConfig.baseUrl);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class NotImplementedError extends Error {
  feature: string;
  constructor(feature: string) {
    super(`${feature} is not implemented yet.`);
    this.name = 'NotImplementedError';
    this.feature = feature;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** skip the "backend configured" guard — used by health checks */
  allowWhenUnconfigured?: boolean;
}

/**
 * Thin JSON client. Adds auth, normalises errors and never leaks a raw
 * provider error to the UI.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!apiConfig.baseUrl && !options.allowWhenUnconfigured) {
    throw new ApiError('No backend is configured. Running in local mode.', 503);
  }

  const token = apiConfig.getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${apiConfig.baseUrl ?? ''}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
    credentials: 'include',
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) detail = payload.message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail || 'Request failed', response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Simulated network latency so loading states are exercised in local mode. */
export function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
