/**
 * EditorPage — assembles the editor chrome around the canvas.
 *
 * Route contract:
 *   /editor/new?template=<id>   fresh design, optionally seeded from a template
 *   /editor/:id                 load a saved design by id
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, Loader2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Sparkles, Layers, SlidersHorizontal } from 'lucide-react';
import { EditorCanvas } from '@/components/editor/EditorCanvas';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { EditorDialogs } from '@/components/editor/EditorDialogs';
import { LeftPanel } from '@/components/editor/LeftPanel';
import { LayersPanel } from '@/components/editor/LayersPanel';
import { PropertiesPanel } from '@/components/editor/PropertiesPanel';
import { AssistantPanel } from '@/components/editor/AssistantPanel';
import { ZoomControls } from '@/components/editor/ZoomControls';
import { Toaster } from '@/components/common/Toaster';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useEditorShortcuts } from '@/hooks/useEditorShortcuts';
import { useAutosave } from '@/hooks/useAutosave';
import { useTheme } from '@/hooks/useTheme';
import { blankDocument, useEditorStore, useProjectStore, useUIStore, useUserStore } from '@/stores';
import { templateService } from '@/services';
import { cn } from '@/lib/utils';

export default function EditorPage() {
  useTheme();
  useEditorShortcuts();
  useAutosave();

  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const loadDocument = useEditorStore((s) => s.loadDocument);
  const documentId = useEditorStore((s) => s.document.id);
  const getDocument = useProjectStore((s) => s.getDocument);
  const loadBrandKits = useUserStore((s) => s.loadBrandKits);

  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const rightTab = useUIStore((s) => s.rightTab);
  const setRightTab = useUIStore((s) => s.setRightTab);
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const requestFit = useUIStore((s) => s.requestFit);
  const pushToast = useUIStore((s) => s.pushToast);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    const boot = async () => {
      setLoading(true);
      setError(null);
      try {
        await loadBrandKits();

        const templateId = searchParams.get('template');

        if (templateId) {
          const doc = await templateService.instantiate(templateId);
          if (!doc) throw new Error('That template could not be found.');
          loadDocument(doc);
          pushToast({
            title: 'Template loaded',
            description: `${doc.name} — ${doc.elements.length} editable layers.`,
            variant: 'success',
          });
        } else if (id && id !== 'new') {
          const doc = await getDocument(id);
          if (!doc) throw new Error('That design could not be found. It may have been deleted.');
          loadDocument(doc);
        } else {
          loadDocument(blankDocument());
        }

        requestFit();
      } catch (bootError) {
        setError(bootError instanceof Error ? bootError.message : 'Could not open the editor.');
      } finally {
        setLoading(false);
      }
    };

    void boot();
  }, [id, searchParams, loadDocument, getDocument, loadBrandKits, pushToast, requestFit]);

  if (loading) {
    return (
      <div className="grid h-full place-items-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-5 animate-spin text-brand" />
          <p className="text-xs text-ink-muted">Preparing the canvas…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid h-full place-items-center bg-canvas px-4">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <AlertTriangle className="size-6 text-accent" />
          <p className="text-sm font-medium text-ink">{error}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/designs')}>
              <ChevronLeft /> My designs
            </Button>
            <Button
              onClick={() => {
                loadDocument(blankDocument());
                setError(null);
              }}
            >
              Start a blank design
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-full flex-col overflow-hidden bg-canvas">
        <EditorToolbar />

        <div className="flex min-h-0 flex-1">
          {/* ---------------- left panel ---------------- */}
          <aside
            className={cn(
              'relative flex shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200',
              leftPanelOpen ? 'w-72' : 'w-0 overflow-hidden border-r-0',
              'max-lg:absolute max-lg:inset-y-12 max-lg:left-0 max-lg:z-30 max-lg:w-72 max-lg:shadow-[var(--shadow-float)]',
            )}
            aria-hidden={!leftPanelOpen}
          >
            {leftPanelOpen && <LeftPanel />}
          </aside>

          {/* ---------------- canvas ---------------- */}
          <div className="relative min-w-0 flex-1">
            <EditorCanvas />

            <ZoomControls className="absolute bottom-4 left-4" />

            <div className="pointer-events-none absolute bottom-4 right-4 flex flex-col items-end gap-2">
              <span className="pointer-events-none rounded-full border border-line bg-surface/95 px-3 py-1 font-mono text-[10px] text-ink-muted backdrop-blur">
                {documentId}
              </span>
            </div>
          </div>

          {/* ---------------- right panel ---------------- */}
          <aside
            className={cn(
              'flex shrink-0 flex-col border-l border-line bg-surface transition-[width] duration-200',
              rightPanelOpen ? 'w-80' : 'w-0 overflow-hidden border-l-0',
              'max-lg:absolute max-lg:inset-y-12 max-lg:right-0 max-lg:z-30 max-lg:w-80 max-lg:shadow-[var(--shadow-float)]',
            )}
            aria-hidden={!rightPanelOpen}
          >
            {rightPanelOpen && (
              <Tabs
                value={rightTab}
                onValueChange={(value) => setRightTab(value as typeof rightTab)}
                className="flex h-full min-h-0 flex-col"
              >
                <div className="border-b border-line px-2 py-2">
                  <TabsList className="w-full">
                    <TabsTrigger value="properties" className="flex-1">
                      <SlidersHorizontal /> Properties
                    </TabsTrigger>
                    <TabsTrigger value="layers" className="flex-1">
                      <Layers /> Layers
                    </TabsTrigger>
                    <TabsTrigger value="assistant" className="flex-1">
                      <Sparkles /> Assistant
                    </TabsTrigger>
                  </TabsList>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <TabsContent value="properties">
                    <PropertiesPanel />
                  </TabsContent>
                  <TabsContent value="layers">
                    <LayersPanel />
                  </TabsContent>
                  <TabsContent value="assistant">
                    <AssistantPanel />
                  </TabsContent>
                </div>
              </Tabs>
            )}
          </aside>
        </div>

        {/* panel toggles — always reachable, including on small screens */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2">
          <div className="hidden">
            <Button variant="outline" size="icon-sm" onClick={toggleLeftPanel}>
              {leftPanelOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
            </Button>
            <Button variant="outline" size="icon-sm" onClick={toggleRightPanel}>
              {rightPanelOpen ? <PanelRightClose /> : <PanelRightOpen />}
            </Button>
          </div>
        </div>

        <div className="absolute left-3 top-14 z-20 flex flex-col gap-1 lg:hidden">
          <Button variant="outline" size="icon-sm" onClick={toggleLeftPanel} aria-label="Toggle left panel">
            {leftPanelOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </Button>
          <Button variant="outline" size="icon-sm" onClick={toggleRightPanel} aria-label="Toggle right panel">
            {rightPanelOpen ? <PanelRightClose /> : <PanelRightOpen />}
          </Button>
        </div>

        <EditorDialogs />
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
