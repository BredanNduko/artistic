/**
 * Template service.
 *
 * Templates are structured `DesignDocument`s, never flattened images. Today
 * they ship with the bundle; a backend can serve the same shape later without
 * any consumer changing.
 */

import type { DesignDocument } from '@/engine';
import { TEMPLATES, type DesignTemplate } from '@/data/templates';
import { CATEGORIES, type TemplateCategory } from '@/data/categories';
import { apiConfig, delay, request } from './httpClient';

export interface TemplateQuery {
  category?: string;
  format?: string;
  search?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface TemplatePage {
  items: DesignTemplate[];
  total: number;
}

export interface TemplateService {
  list(query?: TemplateQuery): Promise<TemplatePage>;
  get(id: string): Promise<DesignTemplate | null>;
  categories(): Promise<TemplateCategory[]>;
  /** Instantiate a template into an editable document (fresh ids). */
  instantiate(id: string, overrides?: Partial<DesignDocument>): Promise<DesignDocument | null>;
}

/* ------------------------------------------------------------------ */
/* Local implementation                                                */
/* ------------------------------------------------------------------ */

function matches(template: DesignTemplate, query: TemplateQuery): boolean {
  if (query.category && query.category !== 'all' && template.category !== query.category) return false;
  if (query.format && query.format !== 'all' && template.format !== query.format) return false;
  if (query.tags?.length && !query.tags.some((t) => template.tags.includes(t))) return false;
  if (query.search) {
    const haystack = [
      template.name,
      template.description,
      template.category,
      ...template.tags,
      // let people search the actual copy inside a design
      ...template.document.elements
        .filter((el) => el.type === 'text')
        .map((el) => (el as { text: string }).text),
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(query.search.toLowerCase())) return false;
  }
  return true;
}

export const localTemplateService: TemplateService = {
  async list(query = {}) {
    const filtered = TEMPLATES.filter((t) => matches(t, query));
    const offset = query.offset ?? 0;
    const limit = query.limit ?? filtered.length;
    return delay({ items: filtered.slice(offset, offset + limit), total: filtered.length });
  },

  async get(id) {
    return delay(TEMPLATES.find((t) => t.id === id) ?? null);
  },

  async categories() {
    return delay(CATEGORIES);
  },

  async instantiate(id, overrides) {
    const template = TEMPLATES.find((t) => t.id === id);
    if (!template) return null;
    // Deep clone + re-id so editing a template never mutates the source and
    // two designs from the same template never share element ids.
    const clone = JSON.parse(JSON.stringify(template.document)) as DesignDocument;
    const doc = reassignIds(clone);
    return delay({ ...doc, ...overrides }, 60);
  },
};

/* ------------------------------------------------------------------ */
/* HTTP implementation                                                 */
/* ------------------------------------------------------------------ */

export const remoteTemplateService: TemplateService = {
  list: (query = {}) => request<TemplatePage>(`/templates?${toQuery(query)}`),
  get: (id) => request<DesignTemplate | null>(`/templates/${id}`),
  categories: () => request<TemplateCategory[]>('/templates/categories'),
  instantiate: (id, overrides) =>
    request<DesignDocument>(`/templates/${id}/instantiate`, {
      method: 'POST',
      body: overrides ?? {},
    }),
};

function toQuery(query: TemplateQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return params.toString();
}

function reassignIds(doc: DesignDocument): DesignDocument {
  const rand = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  const reid = (el: DesignDocument['elements'][number]): DesignDocument['elements'][number] => {
    const next = { ...el, id: `${el.type.slice(0, 3)}_${rand()}` };
    if (next.type === 'group') {
      return { ...next, children: next.children.map(reid) };
    }
    return next;
  };
  return {
    ...doc,
    id: `doc_${rand()}`,
    elements: doc.elements.map(reid),
    metadata: {
      ...doc.metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      visibility: 'private',
    },
  };
}

/** Chosen at import time based on whether a backend is configured. */
export const templateService: TemplateService = apiConfig.baseUrl
  ? remoteTemplateService
  : localTemplateService;
