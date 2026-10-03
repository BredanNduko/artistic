/**
 * New design page — pick a format, optionally a template, then open the editor.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, LayoutTemplate, PenLine, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, NumberInput } from '@/components/ui/segmented';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TemplatePreview } from '@/components/templates/TemplateCard';
import { FEATURED_TEMPLATES } from '@/data/templates';
import { FORMATS, FORMAT_GROUPS } from '@/data/formats';
import { cn } from '@/lib/utils';

export default function NewDesignPage() {
  const navigate = useNavigate();
  const [formatId, setFormatId] = useState('instagram-post');
  const [name, setName] = useState('Untitled design');
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1080);

  const format = FORMATS.find((f) => f.id === formatId);

  const startBlank = () => {
    const params = new URLSearchParams({ name: name.trim() || 'Untitled design' });
    if (formatId === 'custom') {
      params.set('w', String(width));
      params.set('h', String(height));
    } else {
      params.set('format', formatId);
    }
    navigate(`/editor/new?${params.toString()}`);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Create a design</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Choose a format and start from a blank canvas, or open one of the featured templates. You
          can change the size at any time from the editor.
        </p>
      </header>

      <Tabs defaultValue="blank">
        <TabsList className="mb-6">
          <TabsTrigger value="blank">
            <PenLine /> Blank canvas
          </TabsTrigger>
          <TabsTrigger value="template">
            <LayoutTemplate /> From a template
          </TabsTrigger>
        </TabsList>

        <TabsContent value="blank">
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-6">
              <Field label="Design name">
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </Field>

              <div className="flex flex-col gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  Format
                </span>
                {FORMAT_GROUPS.map((group) => {
                  const items = FORMATS.filter((f) => f.group === group.id);
                  if (!items.length) return null;
                  return (
                    <section key={group.id} className="flex flex-col gap-2">
                      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                        {group.label}
                      </h3>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setFormatId(item.id);
                              setWidth(item.width);
                              setHeight(item.height);
                            }}
                            className={cn(
                              'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
                              formatId === item.id
                                ? 'border-brand bg-brand-soft/50'
                                : 'border-line bg-surface hover:border-brand/50',
                            )}
                          >
                            <span
                              className="mb-1 rounded border border-line-strong bg-surface-2"
                              style={{
                                width: 44,
                                height: Math.max(12, Math.round((44 * item.height) / item.width)),
                              }}
                              aria-hidden
                            />
                            <span className="text-xs font-medium text-ink">{item.label}</span>
                            <span className="font-mono text-[10px] text-ink-muted">
                              {item.width} × {item.height}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>

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

            <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
              <div className="rounded-xl border border-line bg-surface p-4">
                <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">Preview</h3>
                <div
                  className="mx-auto mt-3 rounded-lg border border-line bg-surface-2"
                  style={{
                    width: '100%',
                    maxWidth: 200,
                    aspectRatio: `${width} / ${height}`,
                  }}
                />
                <dl className="mt-3 flex flex-col gap-1 text-[11px]">
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Format</dt>
                    <dd className="text-ink">{format?.label ?? 'Custom'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Size</dt>
                    <dd className="font-mono text-ink">
                      {width} × {height}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Aspect</dt>
                    <dd className="font-mono text-ink">{(width / height).toFixed(2)}</dd>
                  </div>
                </dl>
              </div>

              <Button size="lg" onClick={startBlank}>
                Open the editor <ArrowRight />
              </Button>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="template">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => navigate(`/editor/new?template=${template.id}`)}
                className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface text-left transition-shadow hover:shadow-[var(--shadow-panel)]"
              >
                <div className="p-2">
                  <TemplatePreview document={template.document} maxSize={360} />
                </div>
                <div className="flex flex-col gap-1 px-3 pb-3">
                  <span className="text-sm font-medium text-ink group-hover:text-brand">
                    {template.name}
                  </span>
                  <span className="text-[11px] text-ink-muted">{template.description}</span>
                  <div className="mt-1 flex gap-1">
                    <Badge variant="brand">{template.category}</Badge>
                    <Badge variant="outline">{template.format}</Badge>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2 rounded-lg border border-line bg-surface-2 p-3">
            <Sparkles className="size-3.5 text-brand" />
            <p className="text-[11px] text-ink-soft">
              Want something new? The AI Studio can compose a design from a written prompt — as
              structured, editable elements.
            </p>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => navigate('/ai')}>
              Open AI Studio
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
