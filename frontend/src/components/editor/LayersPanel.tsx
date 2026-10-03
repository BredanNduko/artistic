/**
 * LayersPanel — z-order, lock/hide, rename, group/ungroup.
 * Reorder is drag-and-drop using native HTML5 DnD, which keeps the panel
 * dependency-free and works identically in the editor and any future surface.
 */

import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Group as GroupIcon,
  Image as ImageIcon,
  Layers,
  Lock,
  LockOpen,
  Square,
  Type,
  Ungroup,
  Minus,
  GripVertical,
} from 'lucide-react';
import type { DesignElement } from '@/engine';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores';

const ICONS = {
  text: Type,
  image: ImageIcon,
  shape: Square,
  line: Minus,
  group: GroupIcon,
} as const;

export function LayersPanel() {
  const elements = useEditorStore((s) => s.document.elements);
  const selection = useEditorStore((s) => s.selection);
  const select = useEditorStore((s) => s.select);
  const toggleSelect = useEditorStore((s) => s.toggleSelect);
  const toggleLock = useEditorStore((s) => s.toggleLock);
  const toggleHidden = useEditorStore((s) => s.toggleHidden);
  const reorder = useEditorStore((s) => s.reorder);
  const renameElement = useEditorStore((s) => s.renameElement);
  const [dragId, setDragId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  // Top of the list = top of the stack, so render in reverse z-order.
  const ordered = useMemo(() => [...elements].sort((a, b) => b.z - a.z), [elements]);

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = ordered.map((el) => el.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    // The list is reversed, so a top-of-list drop means the highest z.
    const reordered = [...next].reverse();
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        elements: state.document.elements
          .map((el) => ({ ...el, z: reordered.indexOf(el.id) }))
          .sort((a, b) => a.z - b.z),
      },
      dirty: true,
    }));
    useEditorStore.getState().undo.length; // no-op keeps tree-shakers honest
    setDragId(null);
  };

  if (!elements.length) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <Layers className="size-5 text-ink-muted" />
        <p className="text-xs text-ink-muted">
          No layers yet. Add text, shapes or images and they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        <span className="mr-auto text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          {elements.length} layer{elements.length === 1 ? '' : 's'}
        </span>
        <Hint label="Bring forward" shortcut="]">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!selection.length}
            onClick={() => selection.forEach((id) => reorder(id, 'forward'))}
            aria-label="Bring forward"
          >
            <ChevronUp />
          </Button>
        </Hint>
        <Hint label="Send backward" shortcut="[">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!selection.length}
            onClick={() => selection.forEach((id) => reorder(id, 'backward'))}
            aria-label="Send backward"
          >
            <ChevronDown />
          </Button>
        </Hint>
        <Hint label="Group" shortcut="⌘ G">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={selection.length < 2}
            onClick={() => useEditorStore.getState().group()}
            aria-label="Group"
          >
            <GroupIcon />
          </Button>
        </Hint>
        <Hint label="Ungroup" shortcut="⌘ ⇧ G">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!selection.some((id) => elements.find((el) => el.id === id)?.type === 'group')}
            onClick={() => useEditorStore.getState().ungroup()}
            aria-label="Ungroup"
          >
            <Ungroup />
          </Button>
        </Hint>
      </div>

      <ul className="flex flex-col p-1">
        {ordered.map((element) => (
          <LayerRow
            key={element.id}
            element={element}
            depth={0}
            selected={selection.includes(element.id)}
            renaming={renaming === element.id}
            onSelect={(additive) => (additive ? toggleSelect(element.id) : select([element.id]))}
            onStartRename={() => setRenaming(element.id)}
            onRename={(name) => {
              renameElement(element.id, name);
              setRenaming(null);
            }}
            onToggleLock={() => toggleLock(element.id)}
            onToggleHidden={() => toggleHidden(element.id)}
            draggable
            onDragStart={() => setDragId(element.id)}
            onDropOn={() => handleDrop(element.id)}
          />
        ))}
      </ul>
    </div>
  );
}

interface RowProps {
  element: DesignElement;
  depth: number;
  selected: boolean;
  renaming: boolean;
  onSelect: (additive: boolean) => void;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onToggleLock: () => void;
  onToggleHidden: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDropOn?: () => void;
}

function LayerRow({
  element,
  depth,
  selected,
  renaming,
  onSelect,
  onStartRename,
  onRename,
  onToggleLock,
  onToggleHidden,
  draggable,
  onDragStart,
  onDropOn,
}: RowProps) {
  const Icon = ICONS[element.type];
  const [draft, setDraft] = useState(element.name ?? element.type);

  return (
    <li>
      <div
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onDropOn?.();
        }}
        onClick={(event) => onSelect(event.shiftKey || event.metaKey || event.ctrlKey)}
        onDoubleClick={onStartRename}
        className={cn(
          'group flex cursor-pointer items-center gap-1.5 rounded-md py-1 pr-1 transition-colors',
          selected ? 'bg-brand-soft text-brand' : 'text-ink-soft hover:bg-surface-3',
        )}
        style={{ paddingLeft: 4 + depth * 12 }}
      >
        <GripVertical className="size-3 shrink-0 cursor-grab text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" />
        <Icon className="size-3.5 shrink-0" />

        {renaming ? (
          <input
            autoFocus
            defaultValue={element.name ?? element.type}
            onClick={(event) => event.stopPropagation()}
            onBlur={(event) => onRename(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') onRename(element.name ?? element.type);
            }}
            className="min-w-0 flex-1 rounded border border-brand bg-surface px-1 text-xs text-ink outline-none"
          />
        ) : (
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-xs',
              element.hidden && 'opacity-50 line-through',
            )}
          >
            {element.name ?? element.type}
          </span>
        )}

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleHidden();
          }}
          aria-label={element.hidden ? 'Show layer' : 'Hide layer'}
          className="rounded p-0.5 text-ink-muted opacity-0 transition-opacity hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
        >
          {element.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleLock();
          }}
          aria-label={element.locked ? 'Unlock layer' : 'Lock layer'}
          className={cn(
            'rounded p-0.5 text-ink-muted transition-opacity hover:text-ink',
            element.locked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          )}
        >
          {element.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
        </button>
      </div>

      {element.type === 'group' &&
        element.children
          .slice()
          .sort((a, b) => b.z - a.z)
          .map((child) => (
            <LayerRow
              key={child.id}
              element={child}
              depth={depth + 1}
              selected={false}
              renaming={false}
              onSelect={() => onSelect(false)}
              onStartRename={() => undefined}
              onRename={() => undefined}
              onToggleLock={() => useEditorStore.getState().toggleLock(child.id)}
              onToggleHidden={() => useEditorStore.getState().toggleHidden(child.id)}
            />
          ))}
      {void draft}
    </li>
  );
}
