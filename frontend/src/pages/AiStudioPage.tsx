/**
 * AI Studio — the AI surface.
 *
 * Honesty is a feature here. Every panel states plainly whether it is running
 * the local deterministic engine or a connected provider, and anything not
 * built yet is labelled "Coming soon" rather than dressed up as working.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Copy,
  Image as ImageIcon,
  Info,
  Loader2,
  Palette,
  Sparkles,
  Type as TypeIcon,
  Wand2,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/input';
import { Field, Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TemplatePreview } from '@/components/templates/TemplateCard';
import { AI_CAPABILITIES, aiService, localAIStatus, type CopyResult } from '@/services';
import { FORMATS, FORMAT_GROUPS } from '@/data/formats';
import { useAssetStore, useEditorStore, useUIStore } from '@/stores';
import { copyToClipboard } from '@/lib/utils';
import type { DesignDocument } from '@/engine';

const EXAMPLE_PROMPTS = [
  'Create a church youth event poster. Theme: The Root. Date: October 12. Colors: blue and gold.',
  'A minimal tech conference poster for a developer summit in Berlin, purple and cyan, March 4–6.',
  'Elegant wedding invitation for Ava and Noah, cream and gold, September 12, serif type.',
  'Loud launch sale poster, 40% off everything, red and yellow, bold condensed type.',
];

export default function AiStudioPage() {
  const navigate = useNavigate();
  const pushToast = useUIStore((s) => s.pushToast);
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const document = useEditorStore((s) => s.document);
  const registerAsset = useAssetStore((s) => s.register);

  const [prompt, setPrompt] = useState(EXAMPLE_PROMPTS[0]);
  const [formatId, setFormatId] = useState('instagram-post');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<DesignDocument | null>(null);

  const [imagePrompt, setImagePrompt] = useState('blue and gold abstract background');
  const [imageBusy, setImageBusy] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<{ src: string; width: number; height: number } | null>(null);

  const [copyKind, setCopyKind] = useState<'headline' | 'subtitle' | 'description' | 'cta' | 'caption'>('headline');
  const [copyTone, setCopyTone] = useState<'bold' | 'warm' | 'professional' | 'playful'>('bold');
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyResult, setCopyResult] = useState<CopyResult | null>(null);

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const doc = await aiService.generateDesign({ prompt, formatId });
      setResult(doc);
      pushToast({
        title: 'Design composed',
        description: `${doc.elements.length} structured elements at ${doc.width}×${doc.height}.`,
        variant: 'success',
      });
    } catch (error) {
      pushToast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    } finally {
      setGenerating(false);
    }
  };

  const openInEditor = () => {
    if (!result) return;
    loadDocument(result);
    navigate('/editor/new');
  };

  const generateImage = async () => {
    if (!imagePrompt.trim()) return;
    setImageBusy(true);
    try {
      const image = await aiService.generateImage(imagePrompt, { width: 1024, height: 1024 });
      setGeneratedImage(image);
      const asset = await registerAsset(image.src, {
        kind: 'image',
        name: imagePrompt.slice(0, 40),
        width: image.width,
        height: image.height,
        tags: ['ai', image.style],
      });
      pushToast({
        title: 'Asset created',
        description: `Saved to your library as “${asset.name}”.`,
        variant: 'success',
      });
    } catch (error) {
      pushToast({
        title: 'Could not generate that image',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      });
    } finally {
      setImageBusy(false);
    }
  };

  const generateCopy = async () => {
    setCopyBusy(true);
    try {
      const resultCopy = await aiService.generateText({
        prompt: prompt || 'your event',
        kind: copyKind,
        tone: copyTone,
        count: 3,
      });
      setCopyResult(resultCopy);
    } finally {
      setCopyBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">AI Studio</h1>
          <Badge variant={localAIStatus.mode === 'connected' ? 'success' : 'warning'}>
            {localAIStatus.mode === 'connected' ? 'Provider connected' : 'Local engine'}
          </Badge>
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-soft">
          Generate a design from a prompt, rewrite copy, resize intelligently and produce artwork — all
          as structured, editable output.
        </p>
      </header>

      {/* honest status banner */}
      <div className="mb-8 flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-brand" />
        <div>
          <p className="text-xs font-medium text-ink">
            {localAIStatus.mode === 'connected'
              ? 'Generation is handled by your configured backend provider.'
              : 'No model is called in this build.'}
          </p>
          <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-ink-soft">
            {localAIStatus.message}{' '}
            {localAIStatus.mode === 'connected'
              ? 'Results come back as structured, editable layers and are validated server-side before they reach the editor.'
              : 'Every result below is produced deterministically by the design engine — real layout composition, real colour derivation, real text analysis — so you can see exactly how the pipeline behaves.'}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* ---------------- design generation ---------------- */}
        <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" />
            <h2 className="text-sm font-medium text-ink">Generate a design</h2>
            <Badge variant="success">
              <Check className="size-2.5" /> Working
            </Badge>
          </div>

          <Field label="Prompt">
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
              placeholder="Describe the design you want…"
            />
          </Field>

          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_PROMPTS.map((example, index) => (
              <button
                key={example}
                type="button"
                onClick={() => setPrompt(example)}
                className="rounded-full border border-line-strong bg-surface px-2 py-1 text-[10px] text-ink-soft transition-colors hover:border-brand hover:text-brand"
              >
                Example {index + 1}
              </button>
            ))}
          </div>

          <Field label="Format">
            <Select value={formatId} onValueChange={setFormatId}>
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

          <Button onClick={() => void generate()} disabled={generating || !prompt.trim()}>
            {generating ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {generating ? 'Composing…' : 'Generate design'}
          </Button>

          {result && (
            <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="brand">{result.elements.length} elements</Badge>
                <Badge variant="outline">
                  {result.width} × {result.height}
                </Badge>
                <Badge variant="muted">Editable</Badge>
              </div>
              <TemplatePreview document={result} maxSize={360} className="bg-surface" />
              <p className="text-[10px] leading-relaxed text-ink-muted">
                Background, scrim, accent bar, eyebrow, headline, rule, subtitle, date badge and footer
                — each a separate, editable element.
              </p>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={openInEditor}>
                  Open in editor <ArrowRight />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void copyToClipboard(JSON.stringify(result, null, 2));
                    pushToast({ title: 'Design JSON copied', variant: 'success' });
                  }}
                >
                  <Copy /> JSON
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* ---------------- editing by instruction ---------------- */}
        <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-brand" />
            <h2 className="text-sm font-medium text-ink">Edit by instruction</h2>
            <Badge variant="success">
              <Check className="size-2.5" /> Working
            </Badge>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-soft">
            Recognised instructions are mapped to real engine operations and applied to the design
            currently in your editor — so you can undo them like any other edit.
          </p>
          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <p className="text-[11px] font-medium text-ink">Current design</p>
            <p className="mt-1 font-mono text-[10px] text-ink-muted">
              {document.name} · {document.width}×{document.height} · {document.elements.length}{' '}
              top-level elements
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              'Make the title larger',
              'Use a darker blue',
              'Make the design more minimal',
              'Increase the contrast',
              'Replace the background with something more modern',
              'Create a version suitable for Instagram Story',
            ].map((instruction) => (
              <span
                key={instruction}
                className="rounded-full border border-line-strong bg-surface px-2 py-1 text-[10px] text-ink-soft"
              >
                {instruction}
              </span>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed text-ink-muted">
            The one-tap versions of these live in the editor's Assistant panel, right next to your
            canvas.
          </p>
          <Button variant="outline" onClick={() => navigate('/editor/new')}>
            Open the editor to try it <ArrowRight />
          </Button>
        </section>

        {/* ---------------- copywriting ---------------- */}
        <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2">
            <TypeIcon className="size-4 text-brand" />
            <h2 className="text-sm font-medium text-ink">Copywriting</h2>
            <Badge variant="success">
              <Check className="size-2.5" /> Working
            </Badge>
          </div>

          <Field label="Topic">
            <Input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="text-xs"
            />
          </Field>

          <Field label="Kind">
            <Segmented
              value={copyKind}
              onChange={(next) => setCopyKind(next)}
              options={[
                { value: 'headline', label: 'Headline' },
                { value: 'subtitle', label: 'Subtitle' },
                { value: 'cta', label: 'CTA' },
                { value: 'caption', label: 'Caption' },
              ]}
            />
          </Field>

          <Field label="Tone">
            <Segmented
              value={copyTone}
              onChange={(next) => setCopyTone(next)}
              options={[
                { value: 'bold', label: 'Bold' },
                { value: 'warm', label: 'Warm' },
                { value: 'professional', label: 'Pro' },
                { value: 'playful', label: 'Playful' },
              ]}
            />
          </Field>

          <Button variant="outline" onClick={() => void generateCopy()} disabled={copyBusy}>
            {copyBusy ? <Loader2 className="animate-spin" /> : <Sparkles />} Suggest copy
          </Button>

          {copyResult && (
            <ul className="flex flex-col gap-1.5">
              {copyResult.variants.map((variant) => (
                <li
                  key={variant}
                  className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 p-2.5"
                >
                  <span className="min-w-0 flex-1 text-xs text-ink">{variant}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Copy variant"
                    onClick={() => {
                      void copyToClipboard(variant);
                      pushToast({ title: 'Copied', variant: 'success' });
                    }}
                  >
                    <Copy />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <p className="text-[10px] leading-relaxed text-ink-muted">
            Drafts from a curated local bank, keyed off your topic and tone. A connected model would
            replace this method without changing the interface.
          </p>
        </section>

        {/* ---------------- image generation ---------------- */}
        <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2">
            <ImageIcon className="size-4 text-brand" />
            <h2 className="text-sm font-medium text-ink">Generate an image</h2>
            <Badge variant="success">
              <Check className="size-2.5" /> Working
            </Badge>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-soft">
            Produces a real SVG asset — a gradient mesh, contour map, halftone field and so on —
            derived from your prompt's colours. It lands in your asset library and on the canvas as a
            normal <code className="font-mono text-[10px]">ImageElement</code>, which is exactly the
            slot a model-generated image will occupy.
          </p>

          <Field label="Prompt">
            <Input
              value={imagePrompt}
              onChange={(event) => setImagePrompt(event.target.value)}
              className="text-xs"
            />
          </Field>

          <Button variant="outline" onClick={() => void generateImage()} disabled={imageBusy}>
            {imageBusy ? <Loader2 className="animate-spin" /> : <Palette />} Generate &amp; save to library
          </Button>

          {generatedImage && (
            <div className="overflow-hidden rounded-lg border border-line">
              <img src={generatedImage.src} alt={imagePrompt} className="w-full" />
            </div>
          )}
        </section>
      </div>

      {/* ---------------- capability matrix ---------------- */}
      <section className="mt-10">
        <h2 className="text-sm font-medium text-ink">Capability status</h2>
        <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-ink-soft">
          What is real in this build, and what is honestly not built yet.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-surface-2 text-[10px] uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Capability</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">How</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Design generation', 'designGeneration', 'Composes a full DesignDocument from a prompt'],
                ['Design editing', 'designEditing', 'Maps instructions to engine operations'],
                ['Copywriting', 'copywriting', 'Curated local bank keyed off topic and tone'],
                ['Intelligent resize', 'resize', 'Scales then reflows into the new safe area'],
                ['Design suggestions', 'suggestions', 'Real contrast, margin and hierarchy analysis'],
                ['Image generation', 'imageGeneration', 'Deterministic SVG artwork from prompt colours'],
                ['Video generation', 'videoGeneration', 'Requires a video model — not started'],
                ['Brand voice training', 'brandVoiceTraining', 'Requires a fine-tuned model'],
                ['Realtime collaboration', 'realtimeCollaboration', 'Requires a sync server'],
              ].map(([label, key, how]) => {
                const capability = AI_CAPABILITIES[key as keyof typeof AI_CAPABILITIES];
                return (
                  <tr key={label} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 font-medium text-ink">{label}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={capability.implemented ? 'success' : 'muted'}>
                        {capability.implemented ? 'Working (local)' : 'Coming soon'}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-2.5 text-[11px] text-ink-soft sm:table-cell">{how}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
