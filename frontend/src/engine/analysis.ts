/**
 * Design Engine — deterministic design analysis.
 *
 * These are REAL heuristics computed from the DesignDocument, not a language
 * model. They power the "Design Assistant" panel today and become the
 * grounding signal an LLM later reasons over, which is why they live in the
 * engine rather than in a UI component.
 */

import type {
  DesignDocument,
  DesignElement,
  DesignSuggestion,
  TextElement,
} from './types';
import {
  averageBackgroundColor,
  contrastRatio,
  hexToRgb,
  luminance,
  unionBounds,
  walk,
} from './geometry';

const SEVERITY_ORDER: Record<DesignSuggestion['severity'], number> = {
  warning: 0,
  info: 1,
  good: 2,
};

export function analyseDesign(doc: DesignDocument): DesignSuggestion[] {
  const suggestions: DesignSuggestion[] = [];
  const background = averageBackgroundColor(doc.background);
  const bgIsLight = luminance(background) > 0.5;

  const texts: TextElement[] = [];
  const all: DesignElement[] = [];
  walk(doc.elements, (el) => {
    all.push(el);
    if (el.type === 'text') texts.push(el as TextElement);
  });

  if (!all.length) {
    return [
      {
        id: 'empty',
        severity: 'info',
        title: 'Canvas is empty',
        detail: 'Add text, a shape or an image to get started.',
      },
    ];
  }

  /* ---- 1. text contrast ----------------------------------------- */
  for (const t of texts) {
    const ratio = contrastRatio(t.color, background);
    if (ratio < 3) {
      suggestions.push({
        id: `contrast-${t.id}`,
        severity: 'warning',
        title: `"${t.name ?? t.text.slice(0, 18)}" may be hard to read`,
        detail: `Contrast against the background is ${ratio.toFixed(1)}:1. Aim for 4.5:1 for body text, 3:1 for large display type.`,
        elementIds: [t.id],
      });
    }
  }

  /* ---- 2. safe margins ------------------------------------------ */
  const margin = Math.min(doc.width, doc.height) * 0.03;
  const bleeding = all.filter(
    (el) =>
      !el.hidden &&
      (el.x < margin - 1 ||
        el.y < margin - 1 ||
        el.x + el.width > doc.width - margin + 1 ||
        el.y + el.height > doc.height - margin + 1),
  );
  const textBleeding = bleeding.filter((el) => el.type === 'text');
  if (textBleeding.length) {
    suggestions.push({
      id: 'margin-text',
      severity: 'warning',
      title: `${textBleeding.length} text element${textBleeding.length > 1 ? 's sit' : ' sits'} inside the bleed area`,
      detail: `Keep text at least ${Math.round(margin)}px from the edge so nothing is clipped when printed or cropped.`,
      elementIds: textBleeding.map((el) => el.id),
    });
  }

  /* ---- 3. visual hierarchy -------------------------------------- */
  if (texts.length >= 2) {
    const sorted = [...texts].sort((a, b) => b.fontSize - a.fontSize);
    const biggest = sorted[0];
    const second = sorted[1];
    const ratio = biggest.fontSize / (second.fontSize || 1);
    if (ratio < 1.35) {
      suggestions.push({
        id: 'hierarchy',
        severity: 'info',
        title: 'Visual hierarchy is flat',
        detail: `Your largest text is only ${ratio.toFixed(2)}x the next size. Push the headline to roughly 1.6–2.5x so the eye has an entry point.`,
        elementIds: [biggest.id, second.id],
      });
    } else {
      suggestions.push({
        id: 'hierarchy-ok',
        severity: 'good',
        title: 'Good visual hierarchy',
        detail: `Headline is ${ratio.toFixed(1)}x the next text size — a clear entry point.`,
        elementIds: [biggest.id],
      });
    }
  }

  /* ---- 4. typography consistency -------------------------------- */
  const families = new Set(texts.map((t) => t.fontFamily));
  if (families.size > 3) {
    suggestions.push({
      id: 'fonts',
      severity: 'info',
      title: `${families.size} different typefaces in use`,
      detail: 'Two, or at most three, families is the sweet spot. Consider reducing.',
    });
  }

  /* ---- 5. overlapping text -------------------------------------- */
  const overlaps: string[] = [];
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      const a = texts[i];
      const b = texts[j];
      const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
      const overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      const area = overlapX * overlapY;
      const smaller = Math.min(a.width * a.height, b.width * b.height);
      if (smaller > 0 && area / smaller > 0.35) {
        overlaps.push(a.id, b.id);
      }
    }
  }
  if (overlaps.length) {
    suggestions.push({
      id: 'overlap',
      severity: 'warning',
      title: 'Text elements overlap',
      detail: 'Some text boxes sit on top of each other. Separate them or group them deliberately.',
      elementIds: [...new Set(overlaps)],
    });
  }

  /* ---- 6. off-canvas elements ----------------------------------- */
  const outside = all.filter(
    (el) =>
      !el.hidden &&
      (el.x + el.width < 0 || el.y + el.height < 0 || el.x > doc.width || el.y > doc.height),
  );
  if (outside.length) {
    suggestions.push({
      id: 'offscreen',
      severity: 'warning',
      title: `${outside.length} element${outside.length > 1 ? 's are' : ' is'} fully off-canvas`,
      detail: 'These will not appear in the export. Move them back or delete them.',
      elementIds: outside.map((el) => el.id),
    });
  }

  /* ---- 7. element balance / whitespace -------------------------- */
  const coverage = all
    .filter((el) => !el.hidden && el.type !== 'group')
    .reduce((sum, el) => sum + Math.max(0, el.width) * Math.max(0, el.height), 0);
  const ratio = coverage / (doc.width * doc.height);
  if (ratio > 0.92) {
    suggestions.push({
      id: 'crowded',
      severity: 'info',
      title: 'Composition feels crowded',
      detail: 'Elements cover almost the whole canvas. Negative space makes a poster breathe — try removing or shrinking something.',
    });
  } else if (ratio < 0.12) {
    suggestions.push({
      id: 'sparse',
      severity: 'info',
      title: 'Lots of empty space',
      detail: 'Only a small part of the canvas is used. Scale up the hero element or add a supporting graphic.',
    });
  } else {
    suggestions.push({
      id: 'balance-ok',
      severity: 'good',
      title: 'Balanced composition',
      detail: `${Math.round(ratio * 100)}% canvas coverage — a healthy amount of negative space.`,
    });
  }

  /* ---- 8. safe-colour palette ----------------------------------- */
  const flatColors = all
    .filter((el) => el.type === 'shape')
    .map((el) => (el as { fill?: unknown }).fill)
    .filter((f): f is string => typeof f === 'string');
  const distinct = new Set(flatColors.map((c) => c.toLowerCase()));
  if (distinct.size > 6) {
    suggestions.push({
      id: 'palette',
      severity: 'info',
      title: `${distinct.size} distinct shape colours`,
      detail: 'Tighten the palette to 2–3 brand colours for a more professional result.',
    });
  }

  /* ---- 9. background darkness ----------------------------------- */
  suggestions.push({
    id: 'background',
    severity: 'info',
    title: bgIsLight ? 'Light background' : 'Dark background',
    detail: bgIsLight
      ? 'Dark type will read well. Keep body text at #333 or darker.'
      : 'Use light type at 90%+ opacity for the best legibility on a dark canvas.',
  });

  return suggestions.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/** Cheap summary used by the AI service prompt context and the info panel. */
export function describeDesign(doc: DesignDocument): string {
  const parts: string[] = [];
  const counts = { text: 0, image: 0, shape: 0, line: 0, group: 0 };
  walk(doc.elements, (el) => {
    counts[el.type] += 1;
  });
  parts.push(`Canvas ${doc.width}x${doc.height}`);
  parts.push(`background ${typeof doc.background === 'string' ? doc.background : 'gradient'}`);
  parts.push(
    `${counts.text} text, ${counts.image} image, ${counts.shape} shape, ${counts.line} line, ${counts.group} group element(s)`,
  );
  const headline = doc.elements
    .flatMap(function collect(el): DesignElement[] {
      return el.type === 'group' ? el.children.flatMap(collect) : [el];
    })
    .filter((el): el is TextElement => el.type === 'text')
    .sort((a, b) => b.fontSize - a.fontSize)[0];
  if (headline) parts.push(`headline "${headline.text.slice(0, 48)}" at ${headline.fontSize}px`);
  return parts.join('; ');
}

/** Nearest accessible colour for a given foreground/background pair. */
export function suggestReadableColor(color: string, background: string): string {
  const bgLight = luminance(background) > 0.5;
  let candidate = color;
  let guard = 0;
  while (contrastRatio(candidate, background) < 4.5 && guard++ < 24) {
    const { r, g, b } = hexToRgb(candidate);
    candidate = bgLight
      ? `#${[r, g, b].map((v) => Math.max(0, Math.floor(v * 0.78)).toString(16).padStart(2, '0')).join('')}`
      : `#${[r, g, b].map((v) => Math.min(255, Math.ceil(v * 1.28)).toString(16).padStart(2, '0')).join('')}`;
  }
  return candidate;
}

/** Bounding box of the whole composition, handy for AI repositioning. */
export function contentBounds(doc: DesignDocument) {
  return unionBounds(doc.elements.filter((el) => !el.hidden));
}
