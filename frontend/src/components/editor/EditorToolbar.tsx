/**
 * EditorToolbar — the top chrome: file/edit menus, history, canvas toggles
 * and the export entry point.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  Grid3x3,
  Keyboard,
  Lock,
  Magnet,
  Redo2,
  Ruler,
  Save,
  Trash2,
  Undo2,
  Unlock,
  Home,
  Loader2,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Hint } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Logo } from '@/components/common/Logo';
import { useEditorStore, useProjectStore, useUIStore } from '@/stores';
import { modKeyLabel } from '@/lib/utils';
import { selectCanRedo, selectCanUndo, selectRedoLabel, selectUndoLabel } from '@/stores';

export function EditorToolbar() {
  const mod = modKeyLabel();
  const document = useEditorStore((s) => s.document);
  const dirty = useEditorStore((s) => s.dirty);
  const selection = useEditorStore((s) => s.selection);
  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);
  const undoLabel = useEditorStore(selectUndoLabel);
  const redoLabel = useEditorStore(selectRedoLabel);

  const snapEnabled = useUIStore((s) => s.snapEnabled);
  const gridVisible = useUIStore((s) => s.gridVisible);
  const rulersVisible = useUIStore((s) => s.rulersVisible);
  const openDialog = useUIStore((s) => s.openDialog);
  const saving = useProjectStore((s) => s.saving);
  const save = useProjectStore((s) => s.save);

  const [nameDraft, setNameDraft] = useState(document.name);
  useEffect(() => setNameDraft(document.name), [document.name]);

  const primary = useEditorStore((s) =>
    s.selection.length === 1
      ? s.document.elements.find((el) => el.id === s.selection[0]) ??
        s.document.elements.flatMap((el) => (el.type === 'group' ? el.children : [])).find((el) => el.id === s.selection[0])
      : undefined,
  );

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== document.name) useEditorStore.getState().renameDocument(trimmed);
    else setNameDraft(document.name);
  };

  const handleSave = async () => {
    const summary = await save(document);
    if (summary) useEditorStore.getState().markSaved();
  };

  useEffect(() => {
    const handler = () => void handleSave();
    window.addEventListener('designforge:save', handler);
    return () => window.removeEventListener('designforge:save', handler);
  });

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
      <Link to="/" className="mr-1 flex items-center gap-2" title="Back to home">
        <Logo className="size-6" />
      </Link>

      <div className="hidden items-center gap-1 md:flex">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              File <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => openDialog('new-design')}>
              New design
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleSave}>
              <Save /> Save now <DropdownMenuShortcut>{mod} S</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openDialog('design-json')}>
              Design JSON…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => openDialog('export')}>
              <Download /> Export…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => openDialog('resize')}>
              Resize canvas…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              Edit <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              disabled={!selection.length}
              onSelect={() => useEditorStore.getState().copy()}
            >
              Copy <DropdownMenuShortcut>{mod} C</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!selection.length}
              onSelect={() => useEditorStore.getState().cut()}
            >
              Cut <DropdownMenuShortcut>{mod} X</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => useEditorStore.getState().paste()}>
              Paste <DropdownMenuShortcut>{mod} V</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!selection.length}
              onSelect={() => useEditorStore.getState().duplicate()}
            >
              <Copy /> Duplicate <DropdownMenuShortcut>{mod} D</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => useEditorStore.getState().selectAll()}>
              Select all <DropdownMenuShortcut>{mod} A</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={selection.length < 2}
              onSelect={() => useEditorStore.getState().group()}
            >
              Group <DropdownMenuShortcut>{mod} G</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!primary || primary.type !== 'group'}
              onSelect={() => useEditorStore.getState().ungroup()}
            >
              Ungroup <DropdownMenuShortcut>{mod} ⇧ G</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!selection.length}
              destructive
              onSelect={() => useEditorStore.getState().remove(selection)}
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              View <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => useUIStore.getState().toggleGrid()}>
              <Grid3x3 /> {gridVisible ? 'Hide grid' : 'Show grid'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => useUIStore.getState().toggleRulers()}>
              <Ruler /> {rulersVisible ? 'Hide rulers' : 'Show rulers'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => useUIStore.getState().toggleSnap()}>
              <Magnet /> {snapEnabled ? 'Disable snapping' : 'Enable snapping'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => useUIStore.getState().toggleLeftPanel()}>
              Toggle left panel
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => useUIStore.getState().toggleRightPanel()}>
              Toggle right panel
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => openDialog('shortcuts')}>
              <Keyboard /> Keyboard shortcuts
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* design name */}
      <div className="mx-auto flex min-w-0 items-center gap-2">
        <input
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          aria-label="Design name"
          className="min-w-0 max-w-[16rem] truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-center text-sm font-medium text-ink outline-none transition-colors hover:border-line focus:border-brand focus:bg-surface"
        />
        <span className="hidden shrink-0 text-[11px] text-ink-muted sm:inline">
          {document.width} × {document.height}
        </span>
        {dirty && <Badge variant="warning">Unsaved</Badge>}
        {saving && <Loader2 className="size-3.5 animate-spin text-ink-muted" />}
      </div>

      <div className="flex items-center gap-1">
        <Hint label="Undo" shortcut={`${mod} Z`}>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!canUndo}
            onClick={() => useEditorStore.getState().undo()}
            aria-label={undoLabel ? `Undo ${undoLabel}` : 'Undo'}
          >
            <Undo2 />
          </Button>
        </Hint>
        <Hint label="Redo" shortcut={`${mod} ⇧ Z`}>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!canRedo}
            onClick={() => useEditorStore.getState().redo()}
            aria-label={redoLabel ? `Redo ${redoLabel}` : 'Redo'}
          >
            <Redo2 />
          </Button>
        </Hint>

        <div className="mx-1 hidden h-5 w-px bg-line sm:block" />

        <Hint label="Snapping" shortcut="Magnet">
          <Button
            variant={snapEnabled ? 'subtle' : 'ghost'}
            size="icon-sm"
            onClick={() => useUIStore.getState().toggleSnap()}
            aria-label="Toggle snapping"
          >
            <Magnet />
          </Button>
        </Hint>
        <Hint label="Grid">
          <Button
            variant={gridVisible ? 'subtle' : 'ghost'}
            size="icon-sm"
            onClick={() => useUIStore.getState().toggleGrid()}
            aria-label="Toggle grid"
          >
            <Grid3x3 />
          </Button>
        </Hint>
        <Hint label="Rulers">
          <Button
            variant={rulersVisible ? 'subtle' : 'ghost'}
            size="icon-sm"
            onClick={() => useUIStore.getState().toggleRulers()}
            aria-label="Toggle rulers"
          >
            <Ruler />
          </Button>
        </Hint>

        {primary && (
          <>
            <div className="mx-1 hidden h-5 w-px bg-line sm:block" />
            <Hint label={primary.locked ? 'Unlock layer' : 'Lock layer'}>
              <Button
                variant={primary.locked ? 'subtle' : 'ghost'}
                size="icon-sm"
                onClick={() => useEditorStore.getState().toggleLock(primary.id)}
                aria-label="Toggle lock"
              >
                {primary.locked ? <Lock /> : <Unlock />}
              </Button>
            </Hint>
            <Hint label={primary.hidden ? 'Show layer' : 'Hide layer'}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => useEditorStore.getState().toggleHidden(primary.id)}
                aria-label="Toggle visibility"
              >
                {primary.hidden ? <EyeOff /> : <Eye />}
              </Button>
            </Hint>
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          className="ml-1 hidden lg:inline-flex"
          onClick={handleSave}
          disabled={saving}
        >
          <Save /> Save
        </Button>
        <Button size="sm" onClick={() => openDialog('export')}>
          <Download /> Export
        </Button>
      </div>
    </header>
  );
}

export { Home };
