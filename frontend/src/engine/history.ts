/**
 * Design Engine — command history (undo / redo).
 *
 * A `DesignCommand` records the document before and after an edit plus a
 * label. Because the document is immutable, a snapshot is cheap and undo is
 * exact. Commands coalesce when the same label fires repeatedly inside a
 * short window (typing, dragging a slider) so the history stays readable.
 *
 * This same stack is the foundation for the future version-history feature:
 * a `DesignVersion` is just a labelled command plus a timestamp.
 */

import type { DesignDocument } from './types';
import { clone } from './geometry';

export interface DesignCommand {
  id: string;
  label: string;
  before: DesignDocument;
  after: DesignDocument;
  timestamp: number;
  /** grouping key used for coalescing */
  mergeKey?: string;
}

export interface DesignVersion {
  id: string;
  label: string;
  createdAt: number;
  document: DesignDocument;
}

export interface HistoryState {
  past: DesignCommand[];
  future: DesignCommand[];
}

export const HISTORY_LIMIT = 120;

export function createHistory(): HistoryState {
  return { past: [], future: [] };
}

let seq = 0;
const nextId = () => `cmd_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export interface CommitOptions {
  label: string;
  mergeKey?: string;
  /** merge with the previous command if it has the same key and is recent */
  mergeWindowMs?: number;
}

/**
 * Record a transition. Returns the new history state.
 * Merging keeps `before` from the original command and replaces `after`.
 */
export function commit(
  history: HistoryState,
  before: DesignDocument,
  after: DesignDocument,
  options: CommitOptions,
): HistoryState {
  if (JSON.stringify(before) === JSON.stringify(after)) return history;

  const { label, mergeKey, mergeWindowMs = 700 } = options;
  const last = history.past[history.past.length - 1];
  const now = Date.now();

  if (
    mergeKey &&
    last &&
    last.mergeKey === mergeKey &&
    now - last.timestamp < mergeWindowMs
  ) {
    const merged: DesignCommand = { ...last, after: clone(after), timestamp: now, label };
    return { past: [...history.past.slice(0, -1), merged], future: [] };
  }

  const command: DesignCommand = {
    id: nextId(),
    label,
    before: clone(before),
    after: clone(after),
    timestamp: now,
    mergeKey,
  };

  const past = [...history.past, command].slice(-HISTORY_LIMIT);
  return { past, future: [] };
}

export function canUndo(history: HistoryState): boolean {
  return history.past.length > 0;
}

export function canRedo(history: HistoryState): boolean {
  return history.future.length > 0;
}

export function undoLabel(history: HistoryState): string | null {
  return history.past[history.past.length - 1]?.label ?? null;
}

export function redoLabel(history: HistoryState): string | null {
  return history.future[history.future.length - 1]?.label ?? null;
}

export function undo(
  history: HistoryState,
): { history: HistoryState; document: DesignDocument } | null {
  const command = history.past[history.past.length - 1];
  if (!command) return null;
  return {
    history: { past: history.past.slice(0, -1), future: [command, ...history.future] },
    document: clone(command.before),
  };
}

export function redo(
  history: HistoryState,
): { history: HistoryState; document: DesignDocument } | null {
  const command = history.future[0];
  if (!command) return null;
  return {
    history: { past: [...history.past, command], future: history.future.slice(1) },
    document: clone(command.after),
  };
}

export function clearHistory(): HistoryState {
  return createHistory();
}

/** Turn the undo stack into a human-readable version list (future feature). */
export function toVersions(history: HistoryState, current: DesignDocument): DesignVersion[] {
  const versions: DesignVersion[] = history.past.map((c, i) => ({
    id: c.id,
    label: c.label,
    createdAt: c.timestamp,
    document: i === 0 ? c.before : c.before,
  }));
  versions.push({
    id: 'current',
    label: 'Current',
    createdAt: Date.now(),
    document: current,
  });
  return versions;
}
