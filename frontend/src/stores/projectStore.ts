/**
 * Project store — the list of saved designs and the save/load lifecycle.
 * Delegates all persistence to `projectService`, so swapping localStorage for
 * a REST backend is invisible here.
 */

import { create } from 'zustand';
import type { DesignDocument } from '@/engine';
import { isBackendConfigured, projectService, type ProjectSummary } from '@/services';
import { useUIStore } from './uiStore';

export interface ProjectState {
  projects: ProjectSummary[];
  loading: boolean;
  saving: boolean;
  lastSavedAt: string | null;
  error: string | null;

  load: () => Promise<void>;
  save: (document: DesignDocument, options?: { silent?: boolean }) => Promise<ProjectSummary | null>;
  remove: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<DesignDocument | null>;
  rename: (id: string, name: string) => Promise<void>;
  /** fetch a stored document for the editor route */
  getDocument: (id: string) => Promise<DesignDocument | null>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  loading: false,
  saving: false,
  lastSavedAt: null,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await projectService.list();
      set({ projects, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Could not load your designs.',
      });
    }
  },

  save: async (document, options = {}) => {
    set({ saving: true });
    try {
      const summary = await projectService.save(document);
      const others = get().projects.filter((p) => p.id !== summary.id);
      set({
        projects: [summary, ...others],
        saving: false,
        lastSavedAt: summary.updatedAt,
        error: null,
      });
      if (!options.silent) {
        useUIStore.getState().pushToast({
          title: 'Design saved',
          description: isBackendConfigured()
            ? `“${summary.name}” is saved to your account.`
            : `“${summary.name}” is stored locally in this browser.`,
          variant: 'success',
        });
      }
      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the design.';
      set({ saving: false, error: message });
      useUIStore.getState().pushToast({ title: 'Save failed', description: message, variant: 'error' });
      return null;
    }
  },

  remove: async (id) => {
    await projectService.remove(id);
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
    useUIStore.getState().pushToast({ title: 'Design deleted', variant: 'default' });
  },

  duplicate: async (id) => {
    const copy = await projectService.duplicate(id);
    if (copy) {
      await get().load();
      useUIStore.getState().pushToast({
        title: 'Duplicated',
        description: `Created “${copy.name}”.`,
        variant: 'success',
      });
    }
    return copy;
  },

  rename: async (id, name) => {
    await projectService.rename(id, name);
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, name } : p)),
    }));
  },

  getDocument: (id) => projectService.get(id),
}));
