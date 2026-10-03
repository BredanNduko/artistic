/**
 * Editor dialogs: export, resize, new design, shortcuts and design JSON.
 * All are driven by `uiStore.activeDialog` so any component can open one.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  ClipboardCopy,
  Download,
  FileJson,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, NumberInput, Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EXPORT_PRESETS, aiService, exportService, type ExportFormat } from '@/services';
import { FORMATS, FORMAT_GROUPS } from '@/data/formats';
import { parseDesignJSON, serializeToJSON, validateSerializedDesign } from '@/engine';
import { useEditorStore, useUIStore } from '@/stores';
import { copyToClipboard, downloadBlob, formatBytes, modKeyLabel } from '@/lib/utils';

export function EditorDialogs() {
  const activeDialog = useUIStore((s) => s.activeDialog);
  const closeDialog = useUIStore((s) => s.closeDialog);

  return (
    <>
      <ExportDialog open={activeDialog === 'export'} onClose={closeDialog} />
      <ResizeDialog open={activeDialog === 'resize'} onClose={closeDialog} />
      <NewDesignDialog open={activeDialog === 'new-design'} onClose={closeDialog} />
      <ShortcutsDialog open={activeDialog === 'shortcuts'} onClose={closeDialog} />
      <DesignJsonDialog open={activeDialog === 'design-json'} onClose={closeDialog} />
    </>
  );
}

/* ================================================================== */
/* Export                                                              */
/* ================================================================== */

function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const document = useEditorStore((s) => s.document);
  const pushToast = useUIStore((s) => s.pushToast);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [preset, setPreset] = useState('standard');
  const [transparent, setTransparent] = useState(false);
  const [busy, setBusy] = useState(false);

  const scale = EXPORT_PRESETS.find((p) => p.id === preset)?.scale ?? 1;
  const isPdf = format === 'pdf';

  const run = async () => {
    if (isPdf) return;
    setBusy(true);
    try {
      const options = { format, scale, transparent, quality: 0.92 };
      const result =
        format === 'png'
          ? await exportService.exportPNG(document, options)
          : await exportService.exportJPG(document, options);
      downloadBlob(result.blob, result.filename);
      pushToast({
        title: `${format.toUpperCase()} exported`,
        description: `${result.width} × ${result.height} · ${formatBytes(result.size)}`,
        variant: 'success',
      });
      onClose();
    } catch (error) {
      pushToast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export design</DialogTitle>
          <DialogDescription>
            Rendered by the same engine the canvas uses, so the file matches what you see.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-2">
          <Field label="Format">
            <Segmented
              value={format}
              onChange={(next) => setFormat(next)}
              options={[
                { value: 'png', label: 'PNG' },
                { value: 'jpg', label: 'JPG' },
                { value: 'pdf', label: 'PDF' },
              ]}
            />
          </Field>

          {isPdf ? (
            <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="warning">Coming soon</Badge>
              </div>
              <p className="text-[11px] leading-relaxed text-ink-soft">
                PDF export needs a vector page pipeline (for example pdf-lib, or a server-side
                renderer) and is not wired up in this version. The{' '}
                <code className="font-mono text-[10px]">exportPDF</code> method exists on the export
                service and throws a <code className="font-mono text-[10px]">NotImplementedError</code>
                , so the interface is ready — only the implementation is missing.
              </p>
              <p className="text-[11px] leading-relaxed text-ink-muted">
                Workaround: export PNG at 2× or 3× and place it in a document. That is a real,
                working path today.
              </p>
            </div>
          ) : (
            <>
              <Field label="Resolution">
                <Select value={preset} onValueChange={setPreset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPORT_PRESETS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label} — {option.hint}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {format === 'png' && (
                <label className="flex items-center gap-2 text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    checked={transparent}
                    onChange={(event) => setTransparent(event.target.checked)}
                    className="size-3.5 accent-[var(--brand)]"
                  />
                  Transparent background (PNG only)
                </label>
              )}

              <div className="rounded-lg border border-line bg-surface-2 p-3 text-[11px] text-ink-soft">
                <div className="flex justify-between">
                  <span>Output size</span>
                  <span className="font-mono text-ink">
                    {Math.round(document.width * scale)} × {Math.round(document.height * scale)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span>Estimated</span>
                  <span className="font-mono text-ink">
                    ~{formatBytes(document.width * document.height * scale * scale * 0.35)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void run()} disabled={busy || isPdf}>
            {busy ? <Loader2 className="animate-spin" /> : <Download />}
            {isPdf ? 'Not available yet' : `Export ${format.toUpperCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* Resize                                                              */
/* ================================================================== */

function ResizeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const document = useEditorStore((s) => s.document);
  const setCanvasSize = useEditorStore((s) => s.setCanvasSize);
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const pushToast = useUIStore((s) => s.pushToast);

  const [formatId, setFormatId] = useState(document.metadata.format ?? 'instagram-post');
  const [width, setWidth] = useState(document.width);
  const [height, setHeight] = useState(document.height);
  const [strategy, setStrategy] = useState<'scale' | 'center' | 'keep'>('scale');
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWidth(document.width);
    setHeight(document.height);
    setFormatId(document.metadata.format ?? 'instagram-post');
  }, [open, document.width, document.height, document.metadata.format]);

  const selected = FORMATS.find((f) => f.id === formatId);

  const apply = () => {
    setCanvasSize(width, height, strategy);
    pushToast({
      title: 'Canvas resized',
      description: `${width} × ${height} · strategy: ${strategy}`,
      variant: 'success',
    });
    onClose();
  };

  /** Real, deterministic reflow — not a model call. */
  const runAiResize = async () => {
    setAiBusy(true);
    try {
      const next = await aiService.resizeDesign({ design: document, formatId });
      loadDocument({ ...next, id: document.id, name: document.name });
      pushToast({
        title: `Reflowed to ${selected?.label ?? formatId}`,
        description: 'Elements were scaled and clamped into the new safe area. Undo with ⌘Z.',
        variant: 'success',
      });
      onClose();
    } catch (error) {
      pushToast({
        title: 'Resize failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resize canvas</DialogTitle>
          <DialogDescription>
            Pick a preset format or set custom dimensions, then choose what happens to your elements.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-2">
          <Field label="Format preset">
            <Select
              value={formatId}
              onValueChange={(value) => {
                setFormatId(value);
                const format = FORMATS.find((f) => f.id === value);
                if (format && value !== 'custom') {
                  setWidth(format.width);
                  setHeight(format.height);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_GROUPS.map((group) => (
                  <div key={group.id}>
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      {group.label}
                    </div>
                    {FORMATS.filter((f) => f.group === group.id).map((format) => (
                      <SelectItem key={format.id} value={format.id}>
                        {format.label} — {format.width}×{format.height}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Dimensions">
            <div className="flex items-center gap-2">
              <NumberInput value={width} min={16} max={12000} onChange={setWidth} suffix="px" />
              <span className="text-xs text-ink-muted">×</span>
              <NumberInput value={height} min={16} max={12000} onChange={setHeight} suffix="px" />
            </div>
          </Field>

          <Field label="Element behaviour">
            <Segmented
              value={strategy}
              onChange={(next) => setStrategy(next)}
              options={[
                { value: 'scale', label: 'Scale' },
                { value: 'center', label: 'Recentre' },
                { value: 'keep', label: 'Keep' },
              ]}
            />
            <p className="text-[10px] leading-relaxed text-ink-muted">
              {strategy === 'scale' &&
                'Elements scale with the canvas and font sizes follow. Best for a proportional change.'}
              {strategy === 'center' &&
                'Element sizes are preserved and everything shifts to the new centre. Best for a big aspect-ratio change.'}
              {strategy === 'keep' && 'Coordinates are untouched. Elements may end up outside the canvas.'}
            </p>
          </Field>

          <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-brand" />
              <span className="text-[11px] font-medium text-ink">Smart reflow</span>
              <Badge variant="muted">Local engine</Badge>
            </div>
            <p className="text-[10px] leading-relaxed text-ink-soft">
              Scales proportionally, then reflows and clamps every visible element into the new safe
              area so nothing is cropped. Deterministic and fully undoable.
            </p>
            <Button variant="outline" size="sm" onClick={() => void runAiResize()} disabled={aiBusy}>
              {aiBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Reflow to {selected?.label ?? 'this format'}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={apply}>Apply resize</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* New design                                                          */
/* ================================================================== */

function NewDesignDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const newDocument = useEditorStore((s) => s.newDocument);
  const [formatId, setFormatId] = useState('instagram-post');
  const [name, setName] = useState('Untitled design');
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1080);

  const selected = FORMATS.find((f) => f.id === formatId);

  useEffect(() => {
    if (!open) return;
    setName('Untitled design');
    setFormatId('instagram-post');
    setWidth(1080);
    setHeight(1080);
  }, [open]);

  const create = () => {
    const finalWidth = formatId === 'custom' ? width : (selected?.width ?? 1080);
    const finalHeight = formatId === 'custom' ? height : (selected?.height ?? 1080);
    newDocument(formatId, name.trim() || 'Untitled design');
    // newDocument uses the preset; apply custom dimensions when needed.
    if (formatId === 'custom') {
      useEditorStore.getState().setCanvasSize(finalWidth, finalHeight, 'keep');
    }
    onClose();
    navigate('/editor/new', { replace: true });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New design</DialogTitle>
          <DialogDescription>
            Start from a blank canvas. This replaces the current document — save first if you want to
            keep it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 pb-2">
          <Field label="Name">
            <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </Field>

          <Field label="Format">
            <Select
              value={formatId}
              onValueChange={(value) => {
                setFormatId(value);
                const format = FORMATS.find((f) => f.id === value);
                if (format) {
                  setWidth(format.width);
                  setHeight(format.height);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map((format) => (
                  <SelectItem key={format.id} value={format.id}>
                    {format.label} — {format.width}×{format.height}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {formatId === 'custom' && (
            <Field label="Custom dimensions">
              <div className="flex items-center gap-2">
                <NumberInput value={width} min={16} max={12000} onChange={setWidth} suffix="px" />
                <span className="text-xs text-ink-muted">×</span>
                <NumberInput value={height} min={16} max={12000} onChange={setHeight} suffix="px" />
              </div>
            </Field>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={create}>Create design</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* Shortcuts                                                           */
/* ================================================================== */

const SHORTCUT_GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'General',
    items: [
      ['Save design', '⌘ S'],
      ['Undo', '⌘ Z'],
      ['Redo', '⌘ ⇧ Z'],
      ['Select all', '⌘ A'],
      ['Keyboard shortcuts', '⌘ /'],
      ['Toggle left panel', '⌘ \\'],
    ],
  },
  {
    title: 'Editing',
    items: [
      ['Copy', '⌘ C'],
      ['Cut', '⌘ X'],
      ['Paste', '⌘ V'],
      ['Duplicate', '⌘ D'],
      ['Delete selection', '⌫'],
      ['Group', '⌘ G'],
      ['Ungroup', '⌘ ⇧ G'],
      ['Lock layer', '⌘ L'],
      ['Hide layer', '⌘ H'],
    ],
  },
  {
    title: 'Create',
    items: [
      ['New text box', 'T'],
      ['New rectangle', 'R'],
      ['New ellipse', 'O'],
      ['New line', 'L'],
    ],
  },
  {
    title: 'Arrange',
    items: [
      ['Nudge 1px', '↑ ↓ ← →'],
      ['Nudge 10px', '⇧ + arrows'],
      ['Bring forward', ']'],
      ['Send backward', '['],
      ['Bring to front', '⌘ ]'],
      ['Send to back', '⌘ ['],
    ],
  },
  {
    title: 'View',
    items: [
      ['Zoom in', '⌘ +'],
      ['Zoom out', '⌘ -'],
      ['Zoom to 100%', '⌘ 0'],
      ['Fit to screen', '⌘ 1'],
      ['Pan canvas', 'Drag empty space'],
      ['Zoom at pointer', '⌘ + scroll'],
    ],
  },
];

function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mod = modKeyLabel();
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            {mod === '⌘'
              ? 'On macOS, ⌘ is the Command key.'
              : 'On Windows and Linux, ⌘ maps to Ctrl.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 overflow-y-auto px-5 pb-5 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} className="flex flex-col gap-1.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                {group.title}
              </h3>
              {group.items.map(([label, keys]) => (
                <div key={label} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-ink-soft">{label}</span>
                  <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink">
                    {keys.replace(/⌘/g, mod)}
                  </kbd>
                </div>
              ))}
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================== */
/* Design JSON                                                         */
/* ================================================================== */

function DesignJsonDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const document = useEditorStore((s) => s.document);
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const pushToast = useUIStore((s) => s.pushToast);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<'view' | 'import'>('view');

  const serialized = useMemo(() => serializeToJSON(document), [document]);

  useEffect(() => {
    if (open) {
      setMode('view');
      setDraft(serialized);
    }
  }, [open, serialized]);

  const importJson = () => {
    try {
      const parsed = JSON.parse(draft) as unknown;
      const validation = validateSerializedDesign(parsed);
      if (!validation.ok) throw new Error(validation.error);
      const next = parseDesignJSON(draft);
      loadDocument(next);
      pushToast({
        title: 'Design imported',
        description: `Loaded ${next.elements.length} top-level elements at v1.`,
        variant: 'success',
      });
      onClose();
    } catch (error) {
      pushToast({
        title: 'Could not import that JSON',
        description: error instanceof Error ? error.message : 'Invalid JSON',
        variant: 'error',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Design document JSON</DialogTitle>
          <DialogDescription>
            Your design is plain structured data. This is exactly what a backend stores and what an AI
            service reads and writes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 px-5 pb-2">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'view', label: 'View / export' },
              { value: 'import', label: 'Import' },
            ]}
            className="w-56"
          />
          <Badge variant="outline">version 1</Badge>
          <Badge variant="muted">{document.elements.length} elements</Badge>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-5 pb-2">
          <textarea
            value={draft}
            readOnly={mode === 'view'}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            className="h-72 w-full resize-none rounded-lg border border-line-strong bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-ink outline-none focus-visible:border-brand"
          />
        </div>

        <DialogFooter>
          {mode === 'view' ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  void copyToClipboard(serialized);
                  pushToast({ title: 'JSON copied to clipboard', variant: 'success' });
                }}
              >
                <ClipboardCopy /> Copy
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  downloadBlob(
                    new Blob([serialized], { type: 'application/json' }),
                    `${document.name.replace(/\s+/g, '-').toLowerCase()}.design.json`,
                  )
                }
              >
                <Download /> Download .json
              </Button>
              <Button variant="ghost" onClick={() => setMode('import')}>
                <Upload /> Import instead
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setMode('view')}>
                Back
              </Button>
              <Button onClick={importJson}>
                <Check /> Load into editor
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { FileJson };
