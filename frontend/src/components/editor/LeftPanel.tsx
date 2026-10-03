/**
 * Left panel: templates, elements, text, images, uploads and brand.
 * Each tab is a small focused component; this file is only the switcher.
 */

import { useMemo, useRef, useState } from 'react';
import {
  Circle,
  Crop,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Minus,
  Palette,
  Plus,
  Search,
  Sparkles,
  Square,
  Star,
  Triangle,
  Type,
  Upload,
  Wand2,
} from 'lucide-react';
import { CATEGORIES } from '@/data/categories';
import { TEMPLATES, type DesignTemplate } from '@/data/templates';
import { createGroup, createShape, createText, type ShapeKind } from '@/engine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AssetLibrary } from '@/components/assets/AssetLibrary';
import { BrandKitSummary, useBrandKitActions } from '@/components/brand/BrandKit';
import { TemplateGrid } from '@/components/templates/TemplateCard';
import { useAssetStore, useEditorStore, useUIStore, useUserStore } from '@/stores';
import { aiService } from '@/services';
import { cn } from '@/lib/utils';

export function LeftPanel() {
  const leftTab = useUIStore((s) => s.leftTab);
  const setLeftTab = useUIStore((s) => s.setLeftTab);

  return (
    <Tabs
      value={leftTab}
      onValueChange={(value) => setLeftTab(value as typeof leftTab)}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="border-b border-line px-2 py-2">
        <TabsList className="w-full overflow-x-auto no-scrollbar">
          <TabsTrigger value="templates" title="Templates">
            <LayoutTemplate />
          </TabsTrigger>
          <TabsTrigger value="elements" title="Shapes & elements">
            <Square />
          </TabsTrigger>
          <TabsTrigger value="text" title="Text">
            <Type />
          </TabsTrigger>
          <TabsTrigger value="uploads" title="Uploads">
            <Upload />
          </TabsTrigger>
          <TabsTrigger value="images" title="Assets">
            <ImageIcon />
          </TabsTrigger>
          <TabsTrigger value="brand" title="Brand kit">
            <Palette />
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <TabsContent value="templates" className="p-3">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="elements" className="p-3">
          <ElementsTab />
        </TabsContent>
        <TabsContent value="text" className="p-3">
          <TextTab />
        </TabsContent>
        <TabsContent value="uploads" className="p-3">
          <UploadsTab />
        </TabsContent>
        <TabsContent value="images" className="p-3">
          <ImagesTab />
        </TabsContent>
        <TabsContent value="brand" className="p-3">
          <BrandTab />
        </TabsContent>
      </div>
    </Tabs>
  );
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

function TemplatesTab() {
  const document = useEditorStore((s) => s.document);
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const addMany = useEditorStore((s) => s.addMany);
  const pushToast = useUIStore((s) => s.pushToast);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const filtered = useMemo(
    () =>
      TEMPLATES.filter((template) => {
        if (category !== 'all' && template.category !== category) return false;
        if (!search.trim()) return true;
        const term = search.trim().toLowerCase();
        return (
          template.name.toLowerCase().includes(term) ||
          template.tags.some((tag) => tag.includes(term)) ||
          template.category.includes(term)
        );
      }),
    [search, category],
  );

  /** Replace the canvas with the template, keeping the current project id. */
  const applyTemplate = (template: DesignTemplate) => {
    loadDocument({
      ...JSON.parse(JSON.stringify(template.document)),
      id: document.id,
      name: document.name === 'Untitled design' ? template.name : document.name,
      metadata: {
        ...template.document.metadata,
        createdAt: document.metadata.createdAt,
        visibility: 'private',
      },
    });
    pushToast({
      title: 'Template applied',
      description: `“${template.name}” loaded with ${template.document.elements.length} editable layers.`,
      variant: 'success',
    });
  };

  /** Merge the template's elements into the current design (offset slightly). */
  const insertTemplate = (template: DesignTemplate) => {
    const rand = () => Math.random().toString(36).slice(2, 7);
    const offsetX = (document.width - template.document.width) / 2;
    const offsetY = (document.height - template.document.height) / 2;
    const reid = (el: (typeof template.document.elements)[number]): typeof el => {
      const next = {
        ...el,
        id: `${el.type.slice(0, 3)}_${rand()}`,
        x: el.x + offsetX,
        y: el.y + offsetY,
      } as typeof el;
      if (next.type === 'group') {
        return { ...next, children: next.children.map(reid) } as typeof next;
      }
      return next;
    };
    addMany(template.document.elements.map(reid), 'Insert template');
    pushToast({ title: 'Template added to canvas', variant: 'success' });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search templates…"
          className="h-8 pl-7 text-xs"
        />
      </div>

      <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        <CategoryChip active={category === 'all'} onClick={() => setCategory('all')} label="All" />
        {CATEGORIES.map((item) => (
          <CategoryChip
            key={item.id}
            active={category === item.id}
            onClick={() => setCategory(item.id)}
            label={item.label}
          />
        ))}
      </div>

      <TemplateGrid
        templates={filtered}
        onUse={applyTemplate}
        onInsert={insertTemplate}
        className="grid-cols-2 xl:grid-cols-2"
        emptyMessage="No templates match that search."
      />
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-2.5 py-1 text-[10px] transition-colors',
        active
          ? 'border-brand bg-brand-soft text-brand'
          : 'border-line-strong bg-surface text-ink-soft hover:border-brand/50 hover:text-ink',
      )}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Elements                                                            */
/* ------------------------------------------------------------------ */

const SHAPE_LIBRARY: { shape: ShapeKind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { shape: 'rect', label: 'Rectangle', icon: Square },
  { shape: 'roundRect', label: 'Rounded', icon: Square },
  { shape: 'ellipse', label: 'Ellipse', icon: Circle },
  { shape: 'ring', label: 'Ring', icon: Circle },
  { shape: 'triangle', label: 'Triangle', icon: Triangle },
  { shape: 'star', label: 'Star', icon: Star },
  { shape: 'hexagon', label: 'Hexagon', icon: Layers },
  { shape: 'arrow', label: 'Arrow', icon: Plus },
];

function ElementsTab() {
  const addShape = useEditorStore((s) => s.addShape);
  const addLine = useEditorStore((s) => s.addLine);
  const addMany = useEditorStore((s) => s.addMany);
  const document = useEditorStore((s) => s.document);

  /** Small decorative compositions built from real elements. */
  const addComposition = (kind: 'frame' | 'dots' | 'banner') => {
    const short = Math.min(document.width, document.height);
    const pad = short * 0.07;

    if (kind === 'frame') {
      addMany(
        [
          createShape({
            name: 'Frame',
            shape: 'rect',
            x: pad,
            y: pad,
            width: document.width - pad * 2,
            height: document.height - pad * 2,
            fill: 'transparent',
            stroke: { color: '#111827', width: 3 },
          }),
          createShape({
            name: 'Frame accent',
            shape: 'rect',
            x: pad,
            y: pad,
            width: short * 0.16,
            height: short * 0.16,
            fill: '#4f46e5',
          }),
        ],
        'Add frame',
      );
      return;
    }

    if (kind === 'dots') {
      const size = short * 0.018;
      const gap = short * 0.05;
      const dots = Array.from({ length: 5 }, (_, i) =>
        createShape({
          name: `Dot ${i + 1}`,
          shape: 'ellipse',
          x: pad + i * gap,
          y: pad,
          width: size,
          height: size,
          fill: i % 2 === 0 ? '#4f46e5' : '#f59e0b',
        }),
      );
      addMany(dots, 'Add dot row');
      return;
    }

    const height = short * 0.14;
    addMany(
      [
        createShape({
          name: 'Banner',
          shape: 'rect',
          x: 0,
          y: document.height - height,
          width: document.width,
          height,
          fill: '#111827',
        }),
        createText('Add your headline here', {
          name: 'Banner text',
          x: pad,
          y: document.height - height + height * 0.26,
          width: document.width - pad * 2,
          height: height * 0.5,
          fontSize: Math.round(height * 0.4),
          fontFamily: 'Inter',
          fontWeight: 700,
          color: '#ffffff',
          align: 'center',
          verticalAlign: 'middle',
        }),
      ],
      'Add banner',
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Shapes</span>
        <div className="grid grid-cols-4 gap-2">
          {SHAPE_LIBRARY.map((item) => (
            <button
              key={item.shape}
              type="button"
              title={item.label}
              onClick={() => addShape(item.shape)}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-line bg-surface text-ink-soft transition-colors hover:border-brand hover:text-brand"
            >
              <item.icon className="size-4" />
              <span className="text-[9px]">{item.label}</span>
            </button>
          ))}
          <button
            type="button"
            title="Line"
            onClick={() => addLine()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-line bg-surface text-ink-soft transition-colors hover:border-brand hover:text-brand"
          >
            <Minus className="size-4" />
            <span className="text-[9px]">Line</span>
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Compositions
        </span>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['frame', 'Frame'],
              ['dots', 'Dot row'],
              ['banner', 'Banner'],
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              onClick={() => addComposition(kind)}
              className="flex flex-col items-center gap-1 rounded-lg border border-line bg-surface p-2 text-ink-soft transition-colors hover:border-brand hover:text-brand"
            >
              <Crop className="size-4" />
              <span className="text-[9px]">{label}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] leading-relaxed text-ink-muted">
          Compositions are groups of real elements — ungroup them to edit each part.
        </p>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

const TEXT_PRESETS = [
  { label: 'Heading', text: 'Your Headline', font: 'Archivo Black', weight: 400, size: 0.1, align: 'left' as const },
  { label: 'Subheading', text: 'A supporting line of context', font: 'Inter', weight: 600, size: 0.045, align: 'left' as const },
  { label: 'Body', text: 'Add a paragraph of descriptive copy here.', font: 'Inter', weight: 400, size: 0.03, align: 'left' as const },
  { label: 'Quote', text: '“The best designs are the ones people actually finish.”', font: 'Playfair Display', weight: 500, size: 0.05, align: 'center' as const },
  { label: 'Eyebrow', text: 'SECTION LABEL', font: 'Inter', weight: 600, size: 0.022, align: 'left' as const },
  { label: 'Display', text: 'BIG', font: 'Bebas Neue', weight: 400, size: 0.22, align: 'center' as const },
];

function TextTab() {
  const document = useEditorStore((s) => s.document);
  const addText = useEditorStore((s) => s.addText);
  const addMany = useEditorStore((s) => s.addMany);

  const addPreset = (preset: (typeof TEXT_PRESETS)[number]) => {
    const short = Math.min(document.width, document.height);
    addText({
      text: preset.text,
      fontSize: Math.round(short * preset.size),
    });
    const id = useEditorStore.getState().selection[0];
    if (id) {
      useEditorStore.getState().update(
        id,
        { fontFamily: preset.font, fontWeight: preset.weight, align: preset.align },
        'Apply text preset',
      );
    }
  };

  const addTitleStack = () => {
    const short = Math.min(document.width, document.height);
    const pad = short * 0.08;
    addMany(
      [
        createText('EYEBROW LABEL', {
          name: 'Eyebrow',
          x: pad,
          y: document.height * 0.34,
          width: document.width - pad * 2,
          fontSize: Math.round(short * 0.022),
          fontFamily: 'Inter',
          fontWeight: 600,
          color: '#f59e0b',
          letterSpacing: Math.round(short * 0.006),
        }),
        createText('Main Headline', {
          name: 'Headline',
          x: pad,
          y: document.height * 0.38,
          width: document.width - pad * 2,
          height: short * 0.2,
          fontSize: Math.round(short * 0.095),
          fontFamily: 'Archivo Black',
          fontWeight: 400,
          color: '#111827',
          lineHeight: 1.02,
        }),
        createText('A supporting subtitle that explains the value.', {
          name: 'Subtitle',
          x: pad,
          y: document.height * 0.58,
          width: document.width - pad * 2,
          height: short * 0.1,
          fontSize: Math.round(short * 0.034),
          fontFamily: 'Inter',
          fontWeight: 400,
          color: '#4b5563',
          lineHeight: 1.4,
        }),
      ],
      'Add title stack',
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Button onClick={() => addText()} size="sm">
        <Type /> Add a text box
      </Button>

      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Text presets
        </span>
        <div className="flex flex-col gap-1.5">
          {TEXT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => addPreset(preset)}
              className="flex items-center justify-between rounded-lg border border-line bg-surface px-2.5 py-2 text-left transition-colors hover:border-brand"
            >
              <span
                className="truncate text-sm text-ink"
                style={{
                  fontFamily: `"${preset.font}", sans-serif`,
                  fontWeight: preset.weight,
                }}
              >
                {preset.label}
              </span>
              <span className="shrink-0 text-[10px] text-ink-muted">{preset.font}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Layouts
        </span>
        <Button variant="outline" size="sm" onClick={addTitleStack}>
          <Layers /> Title + subtitle stack
        </Button>
      </section>

      <p className="text-[10px] leading-relaxed text-ink-muted">
        Double-click any text on the canvas to edit it in place. Press{' '}
        <kbd className="font-mono text-ink">T</kbd> for a new text box.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Uploads                                                             */
/* ------------------------------------------------------------------ */

function UploadsTab() {
  const assets = useAssetStore((s) => s.assets);
  const upload = useAssetStore((s) => s.upload);
  const uploading = useAssetStore((s) => s.uploading);
  const progress = useAssetStore((s) => s.progress);
  const remove = useAssetStore((s) => s.remove);
  const rename = useAssetStore((s) => s.rename);
  const addImageElement = useEditorStore((s) => s.addImageElement);
  const pushToast = useUIStore((s) => s.pushToast);
  const input = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: File[]) => {
    const uploaded = await upload(files, { kind: 'image' });
    if (uploaded[0]) {
      addImageElement(uploaded[0].src, {
        assetId: uploaded[0].id,
        name: uploaded[0].name,
        naturalWidth: uploaded[0].width || 1200,
        naturalHeight: uploaded[0].height || 1200,
      });
      pushToast({
        title: 'Image added to canvas',
        description: uploaded[0].name,
        variant: 'success',
      });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface-2 p-5 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const files = Array.from(event.dataTransfer.files);
          if (files.length) void handleUpload(files);
        }}
      >
        <Upload className="size-4 text-ink-muted" />
        <p className="text-xs font-medium text-ink">
          {uploading ? `Uploading… ${Math.round(progress * 100)}%` : 'Upload from your device'}
        </p>
        <p className="text-[10px] text-ink-muted">
          PNG, JPG, WEBP, GIF or SVG · max 8 MB per file
        </p>
        <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={uploading}>
          Choose files
        </Button>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length) void handleUpload(files);
            event.target.value = '';
          }}
        />
      </div>

      {assets.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() =>
                addImageElement(asset.src, {
                  assetId: asset.id,
                  name: asset.name,
                  naturalWidth: asset.width || 1200,
                  naturalHeight: asset.height || 1200,
                })
              }
              className="group overflow-hidden rounded-lg border border-line bg-surface text-left transition-colors hover:border-brand"
            >
              <img src={asset.src} alt={asset.name} className="aspect-square w-full object-cover" />
              <span className="block truncate px-1.5 py-1 text-[10px] text-ink-soft">
                {asset.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {assets.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface-2 p-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
            Manage
          </span>
          {assets.slice(0, 4).map((asset) => (
            <div key={asset.id} className="flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-[10px] text-ink-soft">{asset.name}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  const next = window.prompt('Rename asset', asset.name);
                  if (next?.trim()) void rename(asset.id, next.trim());
                }}
                aria-label="Rename asset"
              >
                <Type />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => void remove(asset.id)}
                aria-label="Delete asset"
              >
                <Minus />
              </Button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-ink-muted">
        Uploads stay in this browser as data URLs, so they reload with your design and export without
        a server. Icons, illustrations, video and audio are coming soon.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Assets (library + AI generation)                                    */
/* ------------------------------------------------------------------ */

function ImagesTab() {
  const assets = useAssetStore((s) => s.assets);
  const loading = useAssetStore((s) => s.loading);
  const upload = useAssetStore((s) => s.upload);
  const uploading = useAssetStore((s) => s.uploading);
  const progress = useAssetStore((s) => s.progress);
  const remove = useAssetStore((s) => s.remove);
  const rename = useAssetStore((s) => s.rename);
  const register = useAssetStore((s) => s.register);
  const addImageElement = useEditorStore((s) => s.addImageElement);
  const document = useEditorStore((s) => s.document);
  const pushToast = useUIStore((s) => s.pushToast);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      // Local deterministic generator — produces a real SVG asset, no model.
      const image = await aiService.generateImage(prompt, {
        width: Math.round(document.width),
        height: Math.round(document.height),
      });
      const asset = await register(image.src, {
        kind: 'image',
        name: prompt.slice(0, 40),
        width: image.width,
        height: image.height,
        tags: ['generated'],
      });
      addImageElement(asset.src, {
        assetId: asset.id,
        name: asset.name,
        naturalWidth: image.width,
        naturalHeight: image.height,
      });
      pushToast({
        title: 'Image generated',
        description: 'Produced locally by the design engine as an editable SVG asset.',
        variant: 'success',
      });
      setPrompt('');
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

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-brand" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Generate an image
          </span>
          <Badge variant="muted">Local</Badge>
        </div>
        <Input
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void generate();
          }}
          placeholder="blue and gold abstract background"
          className="h-8 text-xs"
        />
        <Button size="sm" onClick={() => void generate()} disabled={generating || !prompt.trim()}>
          <Wand2 /> {generating ? 'Generating…' : 'Generate & add'}
        </Button>
        <p className="text-[10px] leading-relaxed text-ink-muted">
          Composed locally from your prompt by the design engine — no model is called and no API key
          is used. The result is a normal asset you can edit like any other image.
        </p>
      </section>

      <AssetLibrary
        assets={assets}
        loading={loading}
        uploading={uploading}
        progress={progress}
        onUpload={(files) => void upload(files)}
        onInsert={(asset) =>
          addImageElement(asset.src, {
            assetId: asset.id,
            name: asset.name,
            naturalWidth: asset.width || 1200,
            naturalHeight: asset.height || 1200,
          })
        }
        onDelete={(asset) => void remove(asset.id)}
        onRename={(asset, name) => void rename(asset.id, name)}
        compact
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Brand                                                               */
/* ------------------------------------------------------------------ */

function BrandTab() {
  const activeKit = useUserStore((s) => s.activeBrandKit);
  const brandKits = useUserStore((s) => s.brandKits);
  const setActive = useUserStore((s) => s.setActiveBrandKit);
  const actions = useBrandKitActions();

  if (!activeKit) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Palette className="size-5 text-ink-muted" />
        <p className="text-xs text-ink-muted">
          No brand kit yet. Create one on the Brand kit page to reuse your colours, fonts and logo
          in every design.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {brandKits.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {brandKits.map((kit) => (
            <button
              key={kit.id}
              type="button"
              onClick={() => void setActive(kit.id)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[10px] transition-colors',
                kit.id === activeKit.id
                  ? 'border-brand bg-brand-soft text-brand'
                  : 'border-line-strong bg-surface text-ink-soft hover:border-brand/50',
              )}
            >
              {kit.name}
            </button>
          ))}
        </div>
      )}

      <BrandKitSummary
        kit={activeKit}
        onAddColor={actions.addSwatch}
        onAddHeading={actions.addHeading}
        onAddLogo={actions.addLogo}
        onAddBlock={() => actions.addBusinessCard(activeKit)}
      />
    </div>
  );
}

export { createGroup };
