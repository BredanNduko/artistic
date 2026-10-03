/**
 * TextControls — typography editing for the selected text element.
 * Every control writes straight through to the editor store, so the canvas
 * updates live and each edit lands in the undo stack.
 */

import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, Minus, RotateCcw } from 'lucide-react';
import type { TextElement } from '@/engine';
import { FONTS } from '@/data/fonts';
import { Button } from '@/components/ui/button';
import { Segmented, Field, NumberInput } from '@/components/ui/segmented';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColorSwatchButton, ShadowControl } from './controls/CommonControls';
import { useEditorStore } from '@/stores';
import { FONT_CATEGORIES } from '@/data/fonts';

const WEIGHTS = [300, 400, 500, 600, 700, 800, 900];

export function TextControls({ element }: { element: TextElement }) {
  const update = useEditorStore((s) => s.update);

  const patch = (value: Partial<TextElement>, label: string, mergeKey?: string) =>
    update(element.id, value, label, mergeKey);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Content">
        <textarea
          value={element.text}
          onChange={(event) => patch({ text: event.target.value }, 'Edit text', `text:${element.id}`)}
          rows={3}
          className="w-full resize-y rounded-md border border-line-strong bg-surface px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-ring/40"
        />
      </Field>

      <Field label="Typeface">
        <Select
          value={element.fontFamily}
          onValueChange={(fontFamily) => patch({ fontFamily }, 'Change font')}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_CATEGORIES.map((category) => (
              <SelectGroup key={category.id}>
                <SelectLabel>{category.label}</SelectLabel>
                {FONTS.filter((f) => f.category === category.id).map((font) => (
                  <SelectItem key={font.family} value={font.family}>
                    <span style={{ fontFamily: `"${font.family}", sans-serif` }}>{font.family}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Size">
          <NumberInput
            value={element.fontSize}
            min={4}
            max={800}
            onChange={(fontSize) => patch({ fontSize }, 'Change font size', `fontSize:${element.id}`)}
          />
        </Field>
        <Field label="Weight">
          <Select
            value={String(element.fontWeight)}
            onValueChange={(value) => patch({ fontWeight: Number(value) }, 'Change weight')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEIGHTS.map((weight) => (
                <SelectItem key={weight} value={String(weight)}>
                  {weight}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Colour">
        <ColorSwatchButton
          label="Text colour"
          value={element.color}
          onChange={(color) => patch({ color }, 'Change text colour', `color:${element.id}`)}
        />
      </Field>

      <Field label="Align">
        <Segmented
          value={element.align}
          onChange={(align) => patch({ align }, 'Change alignment')}
          options={[
            { value: 'left', icon: AlignLeft, title: 'Align left' },
            { value: 'center', icon: AlignCenter, title: 'Align centre' },
            { value: 'right', icon: AlignRight, title: 'Align right' },
            { value: 'justify', icon: AlignJustify, title: 'Justify' },
          ]}
        />
      </Field>

      <Field label="Vertical align">
        <Segmented
          value={element.verticalAlign}
          onChange={(verticalAlign) => patch({ verticalAlign }, 'Change vertical align')}
          options={[
            { value: 'top', icon: ArrowUpToLine, title: 'Top' },
            { value: 'middle', icon: Minus, title: 'Middle' },
            { value: 'bottom', icon: ArrowDownToLine, title: 'Bottom' },
          ]}
        />
      </Field>

      <Field label="Line height" hint={element.lineHeight.toFixed(2)}>
        <Slider
          value={[element.lineHeight]}
          min={0.8}
          max={2.4}
          step={0.01}
          onValueChange={([lineHeight]) => patch({ lineHeight }, 'Change line height', `lh:${element.id}`)}
        />
      </Field>

      <Field label="Letter spacing" hint={`${element.letterSpacing}px`}>
        <Slider
          value={[element.letterSpacing]}
          min={-10}
          max={40}
          step={0.5}
          onValueChange={([letterSpacing]) =>
            patch({ letterSpacing }, 'Change letter spacing', `ls:${element.id}`)
          }
        />
      </Field>

      <Field label="Transform">
        <Segmented
          value={element.textTransform ?? 'none'}
          onChange={(textTransform) => patch({ textTransform }, 'Change text transform')}
          options={[
            { value: 'none', label: 'Aa' },
            { value: 'uppercase', label: 'AA' },
            { value: 'lowercase', label: 'aa' },
            { value: 'capitalize', label: 'Ab' },
          ]}
        />
      </Field>

      <Field label="Style">
        <div className="flex gap-1">
          <Button
            variant={element.fontStyle === 'italic' ? 'subtle' : 'outline'}
            size="sm"
            className="flex-1 italic"
            onClick={() =>
              patch({ fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' }, 'Toggle italic')
            }
          >
            Italic
          </Button>
          <Button
            variant={element.textDecoration === 'underline' ? 'subtle' : 'outline'}
            size="sm"
            className="flex-1 underline"
            onClick={() =>
              patch(
                { textDecoration: element.textDecoration === 'underline' ? 'none' : 'underline' },
                'Toggle underline',
              )
            }
          >
            Underline
          </Button>
          <Button
            variant="outline"
            size="sm"
            title="Reset typography"
            onClick={() =>
              patch(
                {
                  fontFamily: 'Inter',
                  fontWeight: 400,
                  fontStyle: 'normal',
                  textDecoration: 'none',
                  letterSpacing: 0,
                  lineHeight: 1.2,
                },
                'Reset typography',
              )
            }
          >
            <RotateCcw />
          </Button>
        </div>
      </Field>

      <ShadowControl
        value={element.shadow}
        onChange={(shadow) => patch({ shadow }, 'Change shadow')}
      />
    </div>
  );
}
