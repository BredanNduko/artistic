/**
 * AssistantPanel — the Design Assistant.
 *
 * Every finding here is computed by the engine's deterministic analyser
 * (contrast maths, safe margins, hierarchy ratios, overlap detection). No
 * model is called, and the panel says so. Selecting a suggestion selects the
 * elements it refers to, so advice is always actionable.
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { analyseDesign, type DesignSuggestion } from '@/engine';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEditorStore, useUIStore } from '@/stores';
import { aiService } from '@/services';
import { cn } from '@/lib/utils';

const SEVERITY_META = {
  warning: { icon: AlertTriangle, className: 'text-accent' },
  info: { icon: Info, className: 'text-ink-muted' },
  good: { icon: CheckCircle2, className: 'text-success' },
} as const;

export function AssistantPanel() {
  const document = useEditorStore((s) => s.document);
  const select = useEditorStore((s) => s.select);
  const [suggestions, setSuggestions] = useState<DesignSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const result = await aiService.suggestDesignImprovements(document);
      setSuggestions(result);
    } finally {
      setLoading(false);
    }
  }, [document]);

  useEffect(() => {
    void run();
    // Re-analysing on every keystroke would be noisy; the manual refresh
    // button covers rapid iteration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id, document.width, document.height, document.elements.length]);

  const warnings = suggestions.filter((s) => s.severity === 'warning').length;

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5 text-brand" />
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Design assistant
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          onClick={() => void run()}
          disabled={loading}
          aria-label="Re-analyse design"
        >
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant={warnings ? 'warning' : 'success'}>
          {warnings ? `${warnings} to review` : 'No issues'}
        </Badge>
        <Badge variant="muted">{suggestions.length} checks</Badge>
      </div>

      <div className="flex flex-col gap-2">
        {suggestions.map((suggestion) => {
          const meta = SEVERITY_META[suggestion.severity];
          const Icon = meta.icon;
          return (
            <button
              key={suggestion.id}
              type="button"
              disabled={!suggestion.elementIds?.length}
              onClick={() => suggestion.elementIds && select(suggestion.elementIds)}
              className={cn(
                'flex gap-2.5 rounded-lg border border-line bg-surface p-2.5 text-left transition-colors',
                suggestion.elementIds?.length && 'hover:border-brand/50 hover:bg-surface-2',
                !suggestion.elementIds?.length && 'cursor-default',
              )}
            >
              <Icon className={cn('mt-0.5 size-3.5 shrink-0', meta.className)} />
              <span className="flex flex-col gap-1">
                <span className="text-xs font-medium leading-snug text-ink">{suggestion.title}</span>
                <span className="text-[11px] leading-relaxed text-ink-soft">{suggestion.detail}</span>
              </span>
            </button>
          );
        })}
      </div>

      <AiQuickActions />

      <p className="rounded-md border border-line bg-surface-2 p-2.5 text-[10px] leading-relaxed text-ink-muted">
        These checks are computed locally from your design's real geometry and colour contrast — no
        model is called. Connect a provider in Settings to add model-backed suggestions on top.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const QUICK_INSTRUCTIONS = [
  'Make the title larger',
  'Use a darker blue',
  'Make the design more minimal',
  'Increase the contrast',
  'Replace the background with something more modern',
  'Create a version suitable for Instagram Story',
];

function AiQuickActions() {
  const document = useEditorStore((s) => s.document);
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const pushToast = useUIStore((s) => s.pushToast);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (instruction: string) => {
    setBusy(instruction);
    try {
      const next = await aiService.modifyDesign({ design: document, instruction });
      // Preserve identity so autosave overwrites the same project rather than
      // silently creating a new one.
      loadDocument({ ...next, id: document.id, name: document.name });
      pushToast({
        title: 'Design updated',
        description: `Applied “${instruction}” as an editable change — press ${navigator.platform.includes('Mac') ? '⌘Z' : 'Ctrl+Z'} to undo.`,
        variant: 'success',
      });
    } catch (error) {
      pushToast({
        title: 'Could not apply that change',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-2.5">
      <div className="flex items-center gap-1.5">
        <Wand2 className="size-3.5 text-brand" />
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          One-tap edits
        </span>
      </div>
      <p className="text-[10px] leading-relaxed text-ink-muted">
        These map to real, deterministic engine operations on your design document — the result is
        always fully editable and lands in the undo stack.
      </p>
      <div className="flex flex-wrap gap-1">
        {QUICK_INSTRUCTIONS.map((instruction) => (
          <button
            key={instruction}
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void run(instruction)}
            className="rounded-full border border-line-strong bg-surface px-2 py-1 text-[10px] text-ink-soft transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
          >
            {busy === instruction ? 'Working…' : instruction}
          </button>
        ))}
      </div>
    </div>
  );
}
