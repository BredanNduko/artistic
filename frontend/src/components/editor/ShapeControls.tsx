/**
 * ShapeControls — geometry, fill and border for shapes and lines.
 */

import { Trash2 } from 'lucide-react';
import type { LineElement, ShapeElement, ShapeKind } from '@/engine';
import { Button } from '@/components/ui/button';
import { Field, NumberInput, Segmented } from '@/components/ui/segmented';
import { Slider } from '@/components/ui/slider';
import { ColorSwatchButton, PaintControl, ShadowControl } from './controls/CommonControls';
import { useEditorStore } from '@/stores';

const SHAPE_KINDS: { value: ShapeKind; label: string }[] = [
  { value: 'rect', label: 'Rect' },
  { value: 'roundRect', label: 'Rounded' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'ring', label: 'Ring' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'pentagon', label: 'Pentagon' },
  { value: 'hexagon', label: 'Hexagon' },
  { value: 'star', label: 'Star' },
  { value: 'arrow', label: 'Arrow' },
];

export function ShapeControls({ element }: { element: ShapeElement }) {
  const update = useEditorStore((s) => s.update);
  const patch = (value: Partial<ShapeElement>, label: string, mergeKey?: string) =>
    update(element.id, value, label, mergeKey);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Shape">
        <div className="grid grid-cols-5 gap-1">
          {SHAPE_KINDS.map((kind) => (
            <button
              key={kind.value}
              type="button"
              title={kind.label}
              onClick={() => patch({ shape: kind.value }, 'Change shape')}
              className={`flex aspect-square items-center justify-center rounded border text-[9px] transition-colors ${
                element.shape === kind.value
                  ? 'border-brand bg-brand-soft text-brand'
                  : 'border-line-strong bg-surface text-ink-muted hover:border-brand/60 hover:text-ink'
              }`}
            >
              <ShapeGlyph kind={kind.value} />
            </button>
          ))}
        </div>
      </Field>

      <PaintControl
        label="Fill"
        value={element.fill}
        onChange={(fill) => patch({ fill }, 'Change fill', `fill:${element.id}`)}
        allowTransparent
      />

      {(element.shape === 'roundRect' || element.shape === 'rect') && (
        <Field label="Corner radius" hint={`${element.cornerRadius ?? 0}px`}>
          <Slider
            value={[element.cornerRadius ?? 0]}
            min={0}
            max={Math.round(Math.min(element.width, element.height) / 2)}
            step={1}
            onValueChange={([cornerRadius]) =>
              patch({ cornerRadius }, 'Change corner radius', `cr:${element.id}`)
            }
          />
        </Field>
      )}

      {element.shape === 'ring' && (
        <Field label="Thickness" hint={`${Math.round((element.innerRadiusRatio ?? 0.6) * 100)}%`}>
          <Slider
            value={[(element.innerRadiusRatio ?? 0.6) * 100]}
            min={5}
            max={95}
            step={1}
            onValueChange={([value]) =>
              patch({ innerRadiusRatio: value / 100 }, 'Change ring thickness', `ring:${element.id}`)
            }
          />
        </Field>
      )}

      {element.shape === 'star' && (
        <>
          <Field label="Points">
            <NumberInput
              value={element.points ?? 5}
              min={3}
              max={20}
              onChange={(points) => patch({ points }, 'Change star points')}
            />
          </Field>
          <Field label="Inner radius" hint={`${Math.round((element.innerRadiusRatio ?? 0.45) * 100)}%`}>
            <Slider
              value={[(element.innerRadiusRatio ?? 0.45) * 100]}
              min={5}
              max={95}
              step={1}
              onValueChange={([value]) =>
                patch({ innerRadiusRatio: value / 100 }, 'Change star inner radius', `star:${element.id}`)
              }
            />
          </Field>
        </>
      )}

      <Field label="Border">
        <div className="flex items-center gap-2">
          <Button
            variant={element.stroke ? 'subtle' : 'outline'}
            size="sm"
            onClick={() =>
              patch(
                element.stroke ? { stroke: undefined } : { stroke: { color: '#111827', width: 2 } },
                'Toggle border',
              )
            }
          >
            {element.stroke ? 'On' : 'Off'}
          </Button>
          {element.stroke && (
            <>
              <ColorSwatchButton
                label="Border colour"
                value={element.stroke.color}
                onChange={(color) => patch({ stroke: { ...element.stroke!, color } }, 'Change border colour')}
              />
              <NumberInput
                value={element.stroke.width}
                min={0}
                max={80}
                onChange={(width) => patch({ stroke: { ...element.stroke!, width } }, 'Change border width')}
              />
            </>
          )}
        </div>
      </Field>

      <ShadowControl value={element.shadow} onChange={(shadow) => patch({ shadow }, 'Change shadow')} />

      <Button variant="outline" size="sm" onClick={() => useEditorStore.getState().remove([element.id])}>
        <Trash2 /> Delete shape
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function LineControls({ element }: { element: LineElement }) {
  const update = useEditorStore((s) => s.update);
  const patch = (value: Partial<LineElement>, label: string, mergeKey?: string) =>
    update(element.id, value, label, mergeKey);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Colour">
        <ColorSwatchButton
          label="Line colour"
          value={element.stroke.color}
          onChange={(color) => patch({ stroke: { ...element.stroke, color } }, 'Change line colour')}
        />
      </Field>

      <Field label="Thickness" hint={`${element.stroke.width}px`}>
        <Slider
          value={[element.stroke.width]}
          min={1}
          max={60}
          step={1}
          onValueChange={([width]) => patch({ stroke: { ...element.stroke, width } }, 'Change thickness', `sw:${element.id}`)}
        />
      </Field>

      <Field label="Cap">
        <Segmented
          value={element.lineCap ?? 'round'}
          onChange={(lineCap) => patch({ lineCap }, 'Change line cap')}
          options={[
            { value: 'butt', label: 'Butt' },
            { value: 'round', label: 'Round' },
            { value: 'square', label: 'Square' },
          ]}
        />
      </Field>

      <Field label="Curve" hint={(element.tension ?? 0).toFixed(2)}>
        <Slider
          value={[element.tension ?? 0]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={([tension]) => patch({ tension }, 'Change line curve', `t:${element.id}`)}
        />
      </Field>

      <Button variant="outline" size="sm" onClick={() => useEditorStore.getState().remove([element.id])}>
        <Trash2 /> Delete line
      </Button>
    </div>
  );
}

/** Tiny inline glyphs so the shape picker reads without loading an icon set. */
function ShapeGlyph({ kind }: { kind: ShapeKind }) {
  const common = 'size-4';
  switch (kind) {
    case 'rect':
      return <svg viewBox="0 0 16 16" className={common}><rect x="1.5" y="3.5" width="13" height="9" fill="currentColor" /></svg>;
    case 'roundRect':
      return <svg viewBox="0 0 16 16" className={common}><rect x="1.5" y="3.5" width="13" height="9" rx="3" fill="currentColor" /></svg>;
    case 'ellipse':
      return <svg viewBox="0 0 16 16" className={common}><ellipse cx="8" cy="8" rx="6.5" ry="4.5" fill="currentColor" /></svg>;
    case 'ring':
      return <svg viewBox="0 0 16 16" className={common}><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2.5" /></svg>;
    case 'triangle':
      return <svg viewBox="0 0 16 16" className={common}><polygon points="8,2 15,14 1,14" fill="currentColor" /></svg>;
    case 'diamond':
      return <svg viewBox="0 0 16 16" className={common}><polygon points="8,1 15,8 8,15 1,8" fill="currentColor" /></svg>;
    case 'pentagon':
      return <svg viewBox="0 0 16 16" className={common}><polygon points="8,1.5 15,6.5 12.5,14.5 3.5,14.5 1,6.5" fill="currentColor" /></svg>;
    case 'hexagon':
      return <svg viewBox="0 0 16 16" className={common}><polygon points="8,1.5 14.5,5.5 14.5,10.5 8,14.5 1.5,10.5 1.5,5.5" fill="currentColor" /></svg>;
    case 'star':
      return <svg viewBox="0 0 16 16" className={common}><polygon points="8,1 10,6 15.5,6.5 11.5,10 12.8,15 8,12.2 3.2,15 4.5,10 0.5,6.5 6,6" fill="currentColor" /></svg>;
    case 'arrow':
      return <svg viewBox="0 0 16 16" className={common}><path d="M1 8h11M8 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" /></svg>;
    default:
      return <svg viewBox="0 0 16 16" className={common}><rect x="1.5" y="7" width="13" height="2" fill="currentColor" /></svg>;
  }
}
