/**
 * UI store — everything about how the editor *looks*, never about what the
 * design *is*. Keeping this separate from the editor store is what lets the
 * canvas re-render on a pan without invalidating the document, and vice versa.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LeftPanelTab = 'templates' | 'elements' | 'text' | 'images' | 'uploads' | 'brand';
export type RightPanelTab = 'properties' | 'layers' | 'assistant';
export type ThemeMode = 'light' | 'dark' | 'system';
export type ZoomMode = 'fit' | 'manual';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: 'default' | 'success' | 'error' | 'info';
  /** optional inline action */
  action?: { label: string; onClick: () => void };
  duration?: number;
}

export interface PanOffset {
  x: number;
  y: number;
}

export type DialogId =
  | 'shortcuts'
  | 'export'
  | 'resize'
  | 'new-design'
  | 'design-json'
  | null;

export interface UIState {
  theme: ThemeMode;
  zoom: number;
  zoomMode: ZoomMode;
  pan: PanOffset;

  leftTab: LeftPanelTab;
  rightTab: RightPanelTab;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;

  snapEnabled: boolean;
  gridVisible: boolean;
  rulersVisible: boolean;
  /** distance in design px at which snapping engages */
  snapThreshold: number;

  toasts: Toast[];
  activeDialog: DialogId;
  /** payload passed to whichever dialog is open */
  dialogPayload: Record<string, unknown> | null;

  mobilePanel: 'none' | 'left' | 'right';

  setTheme: (theme: ThemeMode) => void;
  setZoom: (zoom: number, mode?: ZoomMode) => void;
  zoomBy: (factor: number) => void;
  requestFit: () => void;
  consumeFit: () => void;
  /** set by ZoomControls when the canvas reports its fitted scale */
  fitRequested: boolean;
  setPan: (pan: PanOffset) => void;
  panBy: (dx: number, dy: number) => void;

  setLeftTab: (tab: LeftPanelTab) => void;
  setRightTab: (tab: RightPanelTab) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setMobilePanel: (panel: 'none' | 'left' | 'right') => void;

  toggleSnap: () => void;
  toggleGrid: () => void;
  toggleRulers: () => void;

  pushToast: (toast: Omit<Toast, 'id'>) => string;
  dismissToast: (id: string) => void;

  openDialog: (id: DialogId, payload?: Record<string, unknown>) => void;
  closeDialog: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      zoom: 1,
      zoomMode: 'fit',
      pan: { x: 0, y: 0 },

      leftTab: 'templates',
      rightTab: 'properties',
      leftPanelOpen: true,
      rightPanelOpen: true,

      snapEnabled: true,
      gridVisible: false,
      rulersVisible: false,
      snapThreshold: 6,

      toasts: [],
      activeDialog: null,
      dialogPayload: null,

      mobilePanel: 'none',

      setTheme: (theme) => set({ theme }),
      setZoom: (zoom, mode = 'manual') =>
        set({ zoom: Math.min(8, Math.max(0.05, zoom)), zoomMode: mode }),
      zoomBy: (factor) =>
        set((state) => ({
          zoom: Math.min(8, Math.max(0.05, state.zoom * factor)),
          zoomMode: 'manual',
        })),
      requestFit: () => set({ fitRequested: true, zoomMode: 'fit' }),
      consumeFit: () => set({ fitRequested: false }),
      fitRequested: false,
      setPan: (pan) => set({ pan }),
      panBy: (dx, dy) => set((state) => ({ pan: { x: state.pan.x + dx, y: state.pan.y + dy } })),

      setLeftTab: (leftTab) => set({ leftTab, leftPanelOpen: true, mobilePanel: 'left' }),
      setRightTab: (rightTab) => set({ rightTab, rightPanelOpen: true, mobilePanel: 'right' }),
      toggleLeftPanel: () => set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
      toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
      setMobilePanel: (mobilePanel) => set({ mobilePanel }),

      toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
      toggleGrid: () => set((state) => ({ gridVisible: !state.gridVisible })),
      toggleRulers: () => set((state) => ({ rulersVisible: !state.rulersVisible })),

      pushToast: (toast) => {
        const id = `toast_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        set((state) => ({ toasts: [...state.toasts, { ...toast, id }].slice(-4) }));
        const duration = toast.duration ?? 3800;
        if (duration > 0) {
          window.setTimeout(() => get().dismissToast(id), duration);
        }
        return id;
      },
      dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

      openDialog: (activeDialog, dialogPayload) =>
        set({ activeDialog, dialogPayload: dialogPayload ?? null }),
      closeDialog: () => set({ activeDialog: null, dialogPayload: null }),
    }),
    {
      name: 'designforge:ui',
      // Only durable preferences are persisted — never transient UI state.
      partialize: (state) => ({
        theme: state.theme,
        leftTab: state.leftTab,
        rightTab: state.rightTab,
        snapEnabled: state.snapEnabled,
        gridVisible: state.gridVisible,
        rulersVisible: state.rulersVisible,
        leftPanelOpen: state.leftPanelOpen,
        rightPanelOpen: state.rightPanelOpen,
      }),
    },
  ),
);

/** Convenience hook used by the theme effect. */
export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}
