/**
 * Store barrel. Components import stores from here.
 *
 * Deliberately four small stores rather than one:
 *   editorStore  — what the design IS
 *   uiStore      — how the editor LOOKS
 *   projectStore — the saved design library
 *   assetStore   — the user's media
 *   userStore    — session, preferences, brand kits
 */

export {
  useEditorStore,
  blankDocument,
  selectSelectedElements,
  selectPrimarySelection,
  selectCanUndo,
  selectCanRedo,
  selectUndoLabel,
  selectRedoLabel,
  type EditorState,
  type EditorActions,
  type EditorStore,
  type ZAction,
} from './editorStore';

export {
  useUIStore,
  resolveTheme,
  type UIState,
  type Toast,
  type LeftPanelTab,
  type RightPanelTab,
  type ThemeMode,
  type DialogId,
} from './uiStore';

export { useProjectStore, type ProjectState } from './projectStore';
export { useAssetStore, type AssetState } from './assetStore';
export { useUserStore, type UserState, type AppSettings } from './userStore';
