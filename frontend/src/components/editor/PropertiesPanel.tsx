/**
 * PropertiesPanel — right-hand inspector.
 *
 * Shows canvas properties when nothing is selected, otherwise dispatches to
 * the control group for the selected element type, plus the shared transform
 * controls (position, size, rotation, opacity, alignment).
 */

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ChevronsUpDown,
  Copy,
  Group as GroupIcon,
  Lock,
  Trash2,
  Ungroup,
  Unlock,
} from 'lucide-react';
import { findElement, type DesignElement } from '@/engine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, NumberInput } from '@/components/ui/segmented';
import { Slider } from '@/components/ui/slider';
import { Hint } from '@/components/ui/tooltip';
import { TextControls } from './TextControls';
import { ImageControls } from './ImageControls';
import { LineControls, ShapeControls } from './ShapeControls';
import { PaintControl } from './controls/CommonControls';
import { useEditorStore, useUIStore } from '@/stores';
import { formatLabel } from '@/data/formats';

export function PropertiesPanel() {
  const document = useEditorStore((s) => s.document);
  const selection = useEditorStore((s) => s.selection);
  const update = useEditorStore((s) => s.update);
  const transform = useEditorStore((s) => s.transform);
  const align = useEditorStore((s) => s.alignSelected);
  const remove = useEditorStore((s) => s.remove);
  const duplicate = useEditorStore((s) => s.duplicate);
  const setBackground = useEditorStore((s) => s.setBackground);
  const openDialog = useUIStore((s) => s.openDialog);

  const elements = selection
    .map((id) => findElement(document.elements, id))
    .filter((el): el is DesignElement => Boolean(el));

  /* ---- canvas properties when nothing is selected ------------ */
  if (!elements.length) {
    return (
      <div className="flex flex-col gap-5 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Canvas</span>
          <Badge variant="outline">{formatLabel(document.metadata.format)}</Badge>
        </div>

        <Field label="Size">
          <div className="flex items-center gap-2">
            <NumberInput
              value={document.width}
              min={16}
              max={10000}
              onChange={(width) => useEditorStore.getState().setCanvasSize(width, document.height, 'keep')}
            />
            <span className="text-xs text-ink-muted">×</span>
            <NumberInput
              value={document.height}
              min={16}
              max={10000}
              onChange={(height) => useEditorStore.getState().setCanvasSize(document.width, height, 'keep')}
            />
          </div>
        </Field>

        <Button variant="outline" size="sm" onClick={() => openDialog('resize')}>
          <ChevronsUpDown /> Resize to a format…
        </Button>

        <PaintControl
          label="Background"
          value={document.background}
          onChange={(background) => setBackground(background)}
        />

        <div className="rounded-md border border-line bg-surface-2 p-3">
          <p className="text-[11px] font-medium text-ink">Nothing selected</p>
          <p className="mt-1 text-[10px] leading-relaxed text-ink-muted">
            Click an element on the canvas to edit its properties, or use the left panel to add
            text, shapes, images and brand assets.
          </p>
        </div>
      </div>
    );
  }

  /* ---- multi-selection --------------------------------------- */
  if (elements.length > 1) {
    const hasGroup = elements.some((el) => el.type === 'group');
    return (
      <div className="flex flex-col gap-4 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            {elements.length} elements
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Button variant="outline" size="sm" onClick={() => useEditorStore.getState().group()}>
            <GroupIcon /> Group
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasGroup}
            onClick={() => useEditorStore.getState().ungroup()}
          >
            <Ungroup /> Ungroup
          </Button>
        </div>

        <Field label="Align to canvas">
          <div className="grid grid-cols-6 gap-1">
            {(
              [
                ['left', AlignStartVertical, 'Align left'],
                ['hcenter', AlignCenterVertical, 'Centre horizontally'],
                ['right', AlignEndVertical, 'Align right'],
                ['top', AlignStartHorizontal, 'Align top'],
                ['vcenter', AlignCenterHorizontal, 'Centre vertically'],
                ['bottom', AlignEndHorizontal, 'Align bottom'],
              ] as const
            ).map(([axis, Icon, title]) => (
              <Hint key={axis} label={title}>
                <Button variant="outline" size="icon-sm" onClick={() => align(axis)} aria-label={title}>
                  <Icon />
                </Button>
              </Hint>
            ))}
          </div>
        </Field>

        <OpacityControl />

        <div className="grid grid-cols-2 gap-1.5">
          <Button variant="outline" size="sm" onClick={() => duplicate()}>
            <Copy /> Duplicate
          </Button>
          <Button variant="outline" size="sm" onClick={() => remove(selection)}>
            <Trash2 /> Delete
          </Button>
        </div>
      </div>
    );
  }

  /* ---- single selection -------------------------------------- */
  const element = elements[0];

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="flex items-center gap-2">
        <Badge variant="brand">{element.type}</Badge>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">
          {element.name ?? element.type}
        </span>
        <Hint label={element.locked ? 'Unlock' : 'Lock'} shortcut="⌘ L">
          <Button
            variant={element.locked ? 'subtle' : 'ghost'}
            size="icon-sm"
            onClick={() => useEditorStore.getState().toggleLock(element.id)}
            aria-label="Toggle lock"
          >
            {element.locked ? <Lock /> : <Unlock />}
          </Button>
        </Hint>
        <Hint label="Duplicate" shortcut="⌘ D">
          <Button variant="ghost" size="icon-sm" onClick={() => duplicate([element.id])} aria-label="Duplicate">
            <Copy />
          </Button>
        </Hint>
        <Hint label="Delete" shortcut="⌫">
          <Button variant="ghost" size="icon-sm" onClick={() => remove([element.id])} aria-label="Delete">
            <Trash2 />
          </Button>
        </Hint>
      </div>

      {/* transform */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Transform</span>
        <div className="grid grid-cols-2 gap-2">
          <Field label="X">
            <NumberInput
              value={element.x}
              onChange={(x) =>
                transform(element.id, { x, y: element.y, width: element.width, height: element.height })
              }
            />
          </Field>
          <Field label="Y">
            <NumberInput
              value={element.y}
              onChange={(y) =>
                transform(element.id, { x: element.x, y, width: element.width, height: element.height })
              }
            />
          </Field>
          <Field label="Width">
            <NumberInput
              value={Math.round(element.width)}
              min={4}
              onChange={(width) =>
                transform(element.id, { x: element.x, y: element.y, width, height: element.height })
              }
            />
          </Field>
          <Field label="Height">
            <NumberInput
              value={Math.round(element.height)}
              min={4}
              onChange={(height) =>
                transform(element.id, { x: element.x, y: element.y, width: element.width, height })
              }
            />
          </Field>
        </div>
        <Field label="Rotation" hint={`${Math.round(element.rotation)}°`}>
          <Slider
            value={[element.rotation]}
            min={-180}
            max={180}
            step={1}
            onValueChange={([rotation]) =>
              update(element.id, { rotation }, 'Rotate', `rot:${element.id}`)
            }
          />
        </Field>
        <OpacityControl />
      </div>

      {/* alignment */}
      <Field label="Align to canvas">
        <div className="grid grid-cols-6 gap-1">
          {(
            [
              ['left', AlignStartVertical, 'Align left'],
              ['hcenter', AlignCenterVertical, 'Centre horizontally'],
              ['right', AlignEndVertical, 'Align right'],
              ['top', AlignStartHorizontal, 'Align top'],
              ['vcenter', AlignCenterHorizontal, 'Centre vertically'],
              ['bottom', AlignEndHorizontal, 'Align bottom'],
            ] as const
          ).map(([axis, Icon, title]) => (
            <Hint key={axis} label={title}>
              <Button variant="outline" size="icon-sm" onClick={() => align(axis)} aria-label={title}>
                <Icon />
              </Button>
            </Hint>
          ))}
        </div>
      </Field>

      <div className="h-px bg-line" />

      {/* type-specific controls */}
      {element.type === 'text' && <TextControls element={element} />}
      {element.type === 'image' && <ImageControls element={element} />}
      {element.type === 'shape' && <ShapeControls element={element} />}
      {element.type === 'line' && <LineControls element={element} />}
      {element.type === 'group' && (
        <div className="rounded-md border border-line bg-surface-2 p-3">
          <p className="text-[11px] font-medium text-ink">
            Group · {element.children.length} children
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-ink-muted">
            Children keep absolute canvas coordinates, so a group is a logical wrapper rather than a
            nested transform. Resize the group to scale its contents together.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={() => useEditorStore.getState().ungroup(element.id)}
          >
            <Ungroup /> Ungroup
          </Button>
        </div>
      )}
    </div>
  );
}

function OpacityControl() {
  const selection = useEditorStore((s) => s.selection);
  const opacity = useEditorStore((s) => {
    const first = s.document.elements.find((el) => el.id === s.selection[0]);
    return first?.opacity ?? 1;
  });
  const updateSelected = useEditorStore((s) => s.updateSelected);

  if (!selection.length) return null;

  return (
    <Field label="Opacity" hint={`${Math.round(opacity * 100)}%`}>
      <Slider
        value={[opacity]}
        min={0}
        max={1}
        step={0.01}
        onValueChange={([value]) =>
          updateSelected({ opacity: value }, 'Change opacity', `opacity:${selection.join(',')}`)
        }
      />
    </Field>
  );
}
