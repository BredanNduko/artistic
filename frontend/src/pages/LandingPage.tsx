/**
 * Landing page. Modern, calm and visually focused: a hero, real template
 * previews rendered by the engine, feature sections, the AI roadmap, example
 * designs and a pricing placeholder.
 */

import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Boxes,
  Check,
  Download,
  Layers,
  MousePointerClick,
  Palette,
  Save,
  ShieldCheck,
  Sparkles,
  Type,
  Wand2,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TemplateStrip } from '@/components/templates/TemplateCard';
import { FEATURED_TEMPLATES, TEMPLATES } from '@/data/templates';
import { CATEGORIES } from '@/data/categories';
import { useDocumentThumbnail } from '@/hooks/useDocumentThumbnail';

/* ------------------------------------------------------------------ */

const MVP_FEATURES = [
  { icon: MousePointerClick, title: 'Direct manipulation', body: 'Drag, resize, rotate and snap on a real canvas. Alignment guides appear as you move.' },
  { icon: Type, title: 'Full typography', body: 'Thirteen curated typefaces, weight, tracking, leading, case and alignment — all live.' },
  { icon: Palette, title: 'Colour & gradients', body: 'Solid or multi-stop gradients for fills and canvas backgrounds, with a full colour picker.' },
  { icon: Layers, title: 'Layers that behave', body: 'Reorder by dragging, lock, hide, group, ungroup and rename — with a full undo stack.' },
  { icon: Boxes, title: 'Your own assets', body: 'Upload PNG, JPG, WEBP, GIF or SVG. Swap an image in place without losing its frame.' },
  { icon: Save, title: 'Saves as you work', body: 'Debounced autosave to local storage. Close the tab and pick up exactly where you left off.' },
  { icon: Download, title: 'Real exports', body: 'PNG and JPG rendered by the same engine as the canvas, at 0.5× to 3× resolution.' },
  { icon: ShieldCheck, title: 'Safe by default', body: 'MIME and size validation on every upload, sanitised SVG and no secrets in the browser.' },
];

const AI_ROADMAP = [
  { icon: Wand2, title: 'Generate from a prompt', body: 'Describe an event and get a structured, fully editable design — not a flat image.', status: 'Live (local)' },
  { icon: Sparkles, title: 'Edit by instruction', body: '“Make the title larger”, “use a darker blue”, “more minimal” — applied as real element changes.', status: 'Live (local)' },
  { icon: Zap, title: 'Intelligent resize', body: 'Convert a poster to a story and elements reflow into the new safe area automatically.', status: 'Live (local)' },
  { icon: Type, title: 'Copywriting', body: 'Headlines, subtitles, descriptions, calls to action and captions in a chosen tone.', status: 'Live (local)' },
  { icon: Layers, title: 'Design assistant', body: 'Contrast, hierarchy, safe-margin and crowding checks computed from your real geometry.', status: 'Live (local)' },
  { icon: Palette, title: 'Model-backed generation', body: 'Connect a provider on the backend for true image and design generation.', status: 'Coming soon' },
];

/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const heroDocument = TEMPLATES[0].document;
  const { src: heroPreview } = useDocumentThumbnail(heroDocument, 640);
  const examples = [TEMPLATES[2], TEMPLATES[4], TEMPLATES[9]];

  return (
    <div className="flex flex-col">
      {/* ---------------- hero ---------------- */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            background:
              'radial-gradient(60% 50% at 15% 0%, color-mix(in srgb, var(--brand) 28%, transparent), transparent), radial-gradient(50% 45% at 90% 20%, color-mix(in srgb, var(--accent) 22%, transparent), transparent)',
          }}
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div className="flex flex-col items-start gap-6">
            <Badge variant="brand">
              <Sparkles className="size-2.5" /> AI-ready design engine
            </Badge>

            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Design anything,
              <br />
              <span className="text-brand">without the friction.</span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-ink-soft">
              DesignForge is a focused visual design platform. Start from a professionally composed
              template, edit every element directly in the browser, and export in seconds — with an
              architecture built to grow into a full AI-powered creative suite.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link to="/new">
                  Create a design <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/templates">Browse templates</Link>
              </Button>
            </div>

            <dl className="mt-2 grid w-full max-w-lg grid-cols-3 gap-4 border-t border-line pt-6">
              {[
                [`${TEMPLATES.length}`, 'original templates'],
                [`${CATEGORIES.length}`, 'categories'],
                ['0', 'stock images needed'],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="text-2xl font-semibold tracking-tight text-ink">{value}</dt>
                  <dd className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* live preview, rendered by the design engine */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-brand/10 to-accent/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-float)]">
              <div className="mb-3 flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-danger/60" />
                <span className="size-2.5 rounded-full bg-accent/60" />
                <span className="size-2.5 rounded-full bg-success/60" />
                <span className="ml-2 truncate text-[10px] text-ink-muted">
                  The Root — Youth Night · 1080 × 1350
                </span>
              </div>
              {heroPreview ? (
                <img
                  src={heroPreview}
                  alt="Live preview of a DesignForge template"
                  className="w-full rounded-lg border border-line"
                />
              ) : (
                <div className="grid aspect-[4/5] place-items-center rounded-lg border border-line bg-surface-2">
                  <span className="text-xs text-ink-muted">Rendering preview…</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- template strip ---------------- */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">
                Start from a real template
              </h2>
              <p className="mt-1 max-w-xl text-sm text-ink-soft">
                Every template is structured data — layers of text, shapes and artwork you can edit
                individually. Nothing is flattened.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/templates">
                See all {TEMPLATES.length} templates <ArrowRight />
              </Link>
            </Button>
          </div>
          <TemplateStrip templates={FEATURED_TEMPLATES} />
        </div>
      </section>

      {/* ---------------- features ---------------- */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">
              A proper editor, not a template filler
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              The canvas is powered by a framework-free design engine. The same engine renders your
              previews, drives the export and will one day let an AI read and rewrite your design.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MVP_FEATURES.map((feature) => (
              <article key={feature.title} className="flex flex-col gap-2">
                <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand">
                  <feature.icon className="size-4" />
                </span>
                <h3 className="text-sm font-medium text-ink">{feature.title}</h3>
                <p className="text-[12px] leading-relaxed text-ink-soft">{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- examples ---------------- */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Made with the engine</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Three different formats, all built from the same primitives — shapes, text and locally
              generated artwork. No stock photography, so nothing ever blocks an export.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {examples.map((template) => (
              <ExampleCard key={template.id} templateId={template.id} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- AI roadmap ---------------- */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <Badge variant="brand">
                <Sparkles className="size-2.5" /> The AI layer
              </Badge>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
                Built for AI from the first commit
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Because a design is structured data, an AI can operate on individual elements rather
                than repainting pixels. Everything below already runs — locally, deterministically,
                with no model called and no API key in the browser.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/ai">
                Open AI Studio <ArrowRight />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AI_ROADMAP.map((item) => (
              <article
                key={item.title}
                className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-5"
              >
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-surface-3 text-ink-soft">
                    <item.icon className="size-4" />
                  </span>
                  <Badge variant={item.status.startsWith('Live') ? 'success' : 'muted'}>
                    {item.status}
                  </Badge>
                </div>
                <h3 className="text-sm font-medium text-ink">{item.title}</h3>
                <p className="text-[12px] leading-relaxed text-ink-soft">{item.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-line bg-surface-2 p-5">
            <h3 className="text-sm font-medium text-ink">How the AI plugs in</h3>
            <p className="mt-1.5 max-w-3xl text-[12px] leading-relaxed text-ink-soft">
              The frontend never holds a provider key. Requests go to your own backend, which calls the
              model and returns a <code className="font-mono text-[11px]">DesignDocument</code>. That
              document flows into the same design engine, the same canvas renderer and the same export
              path as a hand-made design — which is why AI output is always editable.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface p-3 font-mono text-[11px] leading-relaxed text-ink-soft">
{`User prompt
   ↓
Backend  (holds the provider key)
   ↓
AIService  →  DesignDocument
   ↓
Design Engine  →  Canvas Renderer  →  Export`}
            </pre>
          </div>
        </div>
      </section>

      {/* ---------------- pricing placeholder ---------------- */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-8 max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Simple pricing</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Placeholder tiers — billing is not implemented in this build. Every feature above is
              unlocked.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              { name: 'Free', price: '$0', tagline: 'Everything in this demo', features: ['Unlimited local designs', 'All templates & categories', 'PNG and JPG export', 'Asset uploads up to 8 MB', 'Local design assistant'], cta: 'Start designing', highlight: false },
              { name: 'Pro', price: '$12', tagline: 'For people who design daily', features: ['Everything in Free', 'Brand kits and shared assets', 'PDF and print-ready export', 'Version history', 'Model-backed AI generation'], cta: 'Join the waitlist', highlight: true },
              { name: 'Team', price: '$29', tagline: 'Collaboration and governance', features: ['Everything in Pro', 'Shared workspaces and roles', 'Comments and review', 'Team template libraries', 'SSO and audit log'], cta: 'Talk to us', highlight: false },
            ].map((tier) => (
              <article
                key={tier.name}
                className={`flex flex-col gap-4 rounded-xl border p-6 ${
                  tier.highlight ? 'border-brand bg-brand-soft/40' : 'border-line bg-surface'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">{tier.name}</h3>
                    {tier.highlight && <Badge variant="brand">Most popular</Badge>}
                  </div>
                  <p className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight text-ink">{tier.price}</span>
                    <span className="text-xs text-ink-muted">/ month</span>
                  </p>
                  <p className="mt-1 text-[11px] text-ink-muted">{tier.tagline}</p>
                </div>
                <ul className="flex flex-1 flex-col gap-2">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[12px] text-ink-soft">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button variant={tier.highlight ? 'default' : 'outline'} asChild>
                  <Link to={tier.name === 'Free' ? '/new' : '/settings'}>{tier.cta}</Link>
                </Button>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- final CTA ---------------- */}
      <section>
        <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight text-ink">
            Your next design is a click away
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
            Pick a template or start from a blank canvas. Everything runs in your browser — no account
            required, nothing leaves your machine.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/new">
                Create a design <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/templates">Browse {TEMPLATES.length} templates</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ExampleCard({ templateId }: { templateId: string }) {
  const template = TEMPLATES.find((t) => t.id === templateId);
  const { src } = useDocumentThumbnail(template?.document, 480);

  if (!template) return null;

  return (
    <Link
      to={`/editor/new?template=${template.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-[var(--shadow-panel)]"
    >
      <div className="flex items-center justify-center bg-surface-2 p-4">
        {src ? (
          <img
            src={src}
            alt={`Example design: ${template.name}`}
            className="max-h-72 w-auto rounded-lg border border-line shadow-sm transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="grid h-72 w-full place-items-center rounded-lg border border-line">
            <span className="text-xs text-ink-muted">Rendering…</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 border-t border-line p-4">
        <h3 className="text-sm font-medium text-ink group-hover:text-brand">{template.name}</h3>
        <p className="text-[11px] text-ink-muted">{template.description}</p>
        <div className="mt-1 flex gap-1">
          <Badge variant="outline">{template.format}</Badge>
          <Badge variant="muted">{template.document.elements.length} layers</Badge>
        </div>
      </div>
    </Link>
  );
}
