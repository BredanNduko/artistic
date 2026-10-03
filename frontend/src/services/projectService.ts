/**
 * Project service — saving and loading designs.
 *
 * Local mode persists the full `DesignDocument` to localStorage. Images are
 * stored as data URLs inside the document, so a reload restores everything
 * with no backend. The interface matches a future REST/GraphQL API exactly.
 */

import type { DesignDocument } from '@/engine';
import { fromSerialized, toSerialized } from '@/engine';
import { STORAGE_KEYS, storage } from '@/lib/storage';
import { apiConfig, delay, request } from './httpClient';

export interface ProjectSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  format?: string;
  thumbnail?: string;
  updatedAt: string;
  createdAt: string;
  elementCount: number;
  category?: string;
  tags: string[];
  visibility: 'private' | 'public' | 'team';
}

export interface ProjectService {
  list(): Promise<ProjectSummary[]>;
  get(id: string): Promise<DesignDocument | null>;
  save(document: DesignDocument): Promise<ProjectSummary>;
  remove(id: string): Promise<void>;
  duplicate(id: string): Promise<DesignDocument | null>;
  rename(id: string, name: string): Promise<void>;
}

/* ------------------------------------------------------------------ */

function summarise(doc: DesignDocument): ProjectSummary {
  return {
    id: doc.id,
    name: doc.name,
    width: doc.width,
    height: doc.height,
    format: doc.metadata.format,
    thumbnail: doc.metadata.thumbnail,
    updatedAt: doc.metadata.updatedAt,
    createdAt: doc.metadata.createdAt,
    elementCount: countLeaves(doc),
    category: doc.metadata.category,
    tags: doc.metadata.tags ?? [],
    visibility: doc.metadata.visibility,
  };
}

function countLeaves(doc: DesignDocument): number {
  const walk = (els: DesignDocument['elements']): number =>
    els.reduce((sum, el) => sum + (el.type === 'group' ? walk(el.children) : 1), 0);
  return walk(doc.elements);
}

function readAll(): DesignDocument[] {
  const raw = storage.get<unknown>(STORAGE_KEYS.projects, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      try {
        return fromSerialized(entry as Record<string, unknown>);
      } catch {
        return null;
      }
    })
    .filter((d): d is DesignDocument => Boolean(d));
}

function writeAll(docs: DesignDocument[]): void {
  storage.set(
    STORAGE_KEYS.projects,
    docs.map((d) => toSerialized(d)),
  );
}

/* ------------------------------------------------------------------ */

export const localProjectService: ProjectService = {
  async list() {
    return readAll()
      .map(summarise)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async get(id) {
    return readAll().find((d) => d.id === id) ?? null;
  },

  async save(document) {
    const all = readAll();
    const index = all.findIndex((d) => d.id === document.id);
    const next: DesignDocument = {
      ...document,
      metadata: { ...document.metadata, updatedAt: new Date().toISOString() },
    };
    if (index >= 0) all[index] = next;
    else all.unshift(next);
    writeAll(all);
    return summarise(next);
  },

  async remove(id) {
    writeAll(readAll().filter((d) => d.id !== id));
  },

  async duplicate(id) {
    const source = readAll().find((d) => d.id === id);
    if (!source) return null;
    const rand = Math.random().toString(36).slice(2, 8);
    const copy: DesignDocument = {
      ...JSON.parse(JSON.stringify(source)),
      id: `doc_${Date.now().toString(36)}${rand}`,
      name: `${source.name} copy`,
      metadata: {
        ...source.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        thumbnail: undefined,
        forkedFrom: source.id,
      },
    };
    const all = readAll();
    all.unshift(copy);
    writeAll(all);
    return copy;
  },

  async rename(id, name) {
    const all = readAll();
    const target = all.find((d) => d.id === id);
    if (!target) return;
    target.name = name;
    target.metadata = { ...target.metadata, updatedAt: new Date().toISOString() };
    writeAll(all);
  },
};

/* ------------------------------------------------------------------ */

export const remoteProjectService: ProjectService = {
  list: () => request<ProjectSummary[]>('/projects'),
  get: (id) => request<DesignDocument | null>(`/projects/${id}`),
  save: (document) =>
    request<ProjectSummary>(`/projects/${document.id}`, {
      method: 'PUT',
      body: toSerialized(document),
    }),
  remove: (id) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  duplicate: (id) => request<DesignDocument | null>(`/projects/${id}/duplicate`, { method: 'POST' }),
  rename: (id, name) =>
    request<void>(`/projects/${id}`, { method: 'PATCH', body: { name } }),
};

export const projectService: ProjectService = apiConfig.baseUrl
  ? remoteProjectService
  : localProjectService;
