/**
 * ZoomControls — bottom-left canvas controls.
 * "Fit" is a live mode: the canvas keeps fitting while the window resizes.
 */

import { Maximize, Minus, Plus, Grid3x3, Magnet, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Hint } from '@/components/ui/tooltip';
import { useUIStore } from '@/stores';
import { cn } from '@/lib/utils';

const PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];

export function ZoomControls({ className }: { className?: string }) {
  const zoom = useUIStore((s) => s.zoom);
  const zoomMode = useUIStore((s) => s.zoomMode);
  const setZoom = useUIStore((s) => s.setZoom);
  const zoomBy = useUIStore((s) => s.zoomBy);
  const requestFit = useUIStore((s) => s.requestFit);
  const snapEnabled = useUIStore((s) => s.snapEnabled);
  const gridVisible = useUIStore((s) => s.gridVisible);
  const rulersVisible = useUIStore((s) => s.rulersVisible);
  const toggleSnap = useUIStore((s) => s.toggleSnap);
  const toggleGrid = useUIStore((s) => s.toggleGrid);
  const toggleRulers = useUIStore((s) => s.toggleRulers);

  const percent = Math.round(zoom * 100);

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center gap-0.5 rounded-full border border-line bg-surface/95 p-1 shadow-[var(--shadow-panel)] backdrop-blur',
        className,
      )}
    >
      <Hint label="Zoom out" shortcut="⌘ -">
        <Button variant="ghost" size="icon-sm" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out">
          <Minus />
        </Button>
      </Hint>

      <select
        value={zoomMode === 'fit' ? 'fit' : String(zoom)}
        onChange={(event) => {
          if (event.target.value === 'fit') requestFit();
          else setZoom(Number(event.target.value), 'manual');
        }}
        aria-label="Zoom level"
        className="h-7 cursor-pointer rounded-full bg-transparent px-1.5 text-center text-xs font-medium text-ink outline-none hover:bg-surface-3"
      >
        <option value="fit">Fit</option>
        {PRESETS.map((preset) => (
          <option key={preset} value={String(preset)}>
            {Math.round(preset * 100)}%
          </option>
        ))}
        {!PRESETS.includes(zoom) && zoomMode === 'manual' && (
          <option value={String(zoom)}>{percent}%</option>
        )}
      </select>

      <Hint label="Zoom in" shortcut="⌘ +">
        <Button variant="ghost" size="icon-sm" onClick={() => zoomBy(1.2)} aria-label="Zoom in">
          <Plus />
        </Button>
      </Hint>

      <Hint label="Fit to screen" shortcut="⌘ 1">
        <Button
          variant={zoomMode === 'fit' ? 'subtle' : 'ghost'}
          size="icon-sm"
          onClick={requestFit}
          aria-label="Fit to screen"
        >
          <Maximize />
        </Button>
      </Hint>

      <div className="mx-0.5 h-5 w-px bg-line" />

      <Hint label="Snapping">
        <Button
          variant={snapEnabled ? 'subtle' : 'ghost'}
          size="icon-sm"
          onClick={toggleSnap}
          aria-label="Toggle snapping"
        >
          <Magnet />
        </Button>
      </Hint>
      <Hint label="Grid">
        <Button
          variant={gridVisible ? 'subtle' : 'ghost'}
          size="icon-sm"
          onClick={toggleGrid}
          aria-label="Toggle grid"
        >
          <Grid3x3 />
        </Button>
      </Hint>
      <Hint label="Rulers">
        <Button
          variant={rulersVisible ? 'subtle' : 'ghost'}
          size="icon-sm"
          onClick={toggleRulers}
          aria-label="Toggle rulers"
        >
          <Ruler />
        </Button>
      </Hint>
    </div>
  );
}
