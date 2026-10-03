/**
 * AI service — abstraction + local implementation.
 *
 * IMPORTANT: this is a *mock*, and it is honest about being one.
 *
 * There is no language model behind these functions. Every result is produced
 * deterministically by the design engine (real layout composition, real colour
 * derivation, real text analysis), which makes the whole AI surface testable
 * and gives the UI something genuine to render while a provider is wired up.
 *
 * The contract is what matters: when a real model arrives it implements this
 * same `AIService` and the UI does not change. Critically, the call chain is
 *
 *     Frontend -> our backend -> AI provider
 *
 * and never `Frontend -> provider API key`. The client never holds a secret.
 */

import {
  analyseDesign,
  clone,
  createDocument,
  createImage,
  createShape,
  createText,
  darken,
  describeDesign,
  hexToRgb,
  lighten,
  mix,
  resizeCanvas,
  rgbToHex,
  uid,
  updateElement,
  walk,
  type DesignDocument,
  type DesignSuggestion,
  type DesignElement,
  type GradientFill,
  type TextElement,
} from '@/engine';
import { makeArt, type ArtStyle } from '@/data/generated-art';
import { getFormat } from '@/data/formats';
import { apiConfig, delay, NotImplementedError } from './httpClient';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface GenerateDesignRequest {
  prompt: string;
  formatId?: string;
  width?: number;
  height?: number;
  colors?: string[];
  brandKitId?: string;
  /** deterministic seed so the same request renders the same design */
  seed?: number;
}

export interface ModifyDesignRequest {
  design: DesignDocument;
  instruction: string;
}

export interface ResizeRequest {
  design: DesignDocument;
  formatId: string;
}

export interface CopyRequest {
  prompt: string;
  kind: 'headline' | 'subtitle' | 'description' | 'cta' | 'caption';
  tone?: 'bold' | 'warm' | 'professional' | 'playful';
  count?: number;
}

export interface CopyResult {
  variants: string[];
  kind: CopyRequest['kind'];
}

export interface GeneratedImage {
  /** data URL — a real, renderable ImageElement source */
  src: string;
  width: number;
  height: number;
  prompt: string;
  style: ArtStyle;
}

export interface AIStatus {
  available: boolean;
  mode: 'local-preview' | 'connected';
  provider?: string;
  message: string;
}

export interface AIService {
  status(): AIStatus;

  generateDesign(request: GenerateDesignRequest): Promise<DesignDocument>;

  modifyDesign(request: ModifyDesignRequest): Promise<DesignDocument>;

  resizeDesign(request: ResizeRequest): Promise<DesignDocument>;

  generateText(request: CopyRequest): Promise<CopyResult>;

  suggestDesignImprovements(design: DesignDocument): Promise<DesignSuggestion[]>;

  generateImage(prompt: string, options?: { width?: number; height?: number; colors?: string[] }): Promise<GeneratedImage>;
}

/* ------------------------------------------------------------------ */
/* Deterministic helpers                                               */
/* ------------------------------------------------------------------ */

/** Stable 32-bit hash so a prompt always maps to the same palette/layout. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const NAMED_COLORS: Record<string, string> = {
  blue: '#1d4ed8', navy: '#12245c', sky: '#0ea5e9', teal: '#0f766e', cyan: '#06b6d4',
  green: '#16a34a', emerald: '#059669', lime: '#65a30d', olive: '#4d7c0f',
  gold: '#d4a017', yellow: '#facc15', amber: '#f59e0b', orange: '#ea580c',
  red: '#dc2626', crimson: '#be123c', maroon: '#7f1d1d', pink: '#ec4899',
  rose: '#e11d48', magenta: '#c026d3', purple: '#7c3aed', violet: '#6d28d9',
  indigo: '#4f46e5', lavender: '#a78bfa', brown: '#78350f', beige: '#e7dcc8',
  cream: '#faf3e0', white: '#ffffff', black: '#0b0d12', grey: '#6b7280',
  gray: '#6b7280', silver: '#cbd5e1', charcoal: '#1f2937', turquoise: '#14b8a6',
  coral: '#fb7185', mint: '#6ee7b7', sand: '#e2c9a0', slate: '#334155',
};

export function extractColors(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const found: string[] = [];
  for (const [name, hex] of Object.entries(NAMED_COLORS)) {
    if (new RegExp(`\\b${name}\\b`).test(lower)) found.push(hex);
  }
  // explicit hex codes in the prompt win
  for (const match of lower.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/g)) {
    const raw = match[1];
    found.push(
      raw.length === 3
        ? `#${raw.split('').map((c) => c + c).join('')}`
        : `#${raw}`,
    );
  }
  return [...new Set(found)].slice(0, 3);
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'for', 'of', 'and', 'with', 'create', 'make', 'design', 'poster',
  'post', 'flyer', 'graphic', 'using', 'use', 'in', 'on', 'at', 'to', 'my', 'our',
  'colors', 'colour', 'colours', 'theme', 'date', 'please', 'generate', 'me', 'a',
]);

/** Pull a plausible headline and event metadata out of a free-text prompt. */
export function parsePrompt(prompt: string): {
  headline: string;
  subtitle: string;
  date: string;
  keywords: string[];
  category: string;
} {
  const cleaned = prompt.replace(/\s+/g, ' ').trim();
  const dateMatch = cleaned.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?\b/i,
  ) ?? cleaned.match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/) ?? cleaned.match(/\b\d{4}-\d{2}-\d{2}\b/);

  const themeMatch = cleaned.match(/theme[:\s]+([^.,;]+)/i);
  const words = cleaned
    .replace(/[^a-zA-Z0-9\s'-]/g, ' ')
    .split(' ')
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()));

  const headline = themeMatch
    ? themeMatch[1].trim().replace(/^["']|["']$/g, '')
    : words.slice(0, 3).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

  const categories: [RegExp, string][] = [
    [/church|worship|ministry|youth|sunday|faith|gospel|bible/i, 'church'],
    [/wedding|bride|groom|marriage|engagement/i, 'wedding'],
    [/birthday|party|anniversary|celebration/i, 'birthday'],
    [/conference|summit|symposium|forum|keynote/i, 'conference'],
    [/business|corporate|report|quarterly|investor/i, 'business'],
    [/school|campus|class|course|student|education|workshop/i, 'education'],
    [/sale|discount|launch|promo|offer|deal|marketing|campaign/i, 'marketing'],
    [/estate|property|listing|apartment|house|rent/i, 'real-estate'],
    [/tech|software|developer|saas|ai|product|startup|code/i, 'technology'],
    [/concert|festival|live|show|tour|gig/i, 'events'],
    [/story|instagram|tiktok|reel|social/i, 'social-media'],
    [/notice|announcement|update|reminder|community/i, 'announcements'],
  ];
  const category = categories.find(([re]) => re.test(cleaned))?.[1] ?? 'events';

  const subtitles: Record<string, string> = {
    church: 'A gathering for the whole community',
    wedding: 'Together with their families',
    birthday: 'Come celebrate with us',
    conference: 'Three days of talks, workshops and connection',
    business: 'Insights, results and what comes next',
    education: 'Learn something new this term',
    marketing: 'Limited time only',
    'real-estate': 'Now available for viewing',
    technology: 'Built for teams that ship',
    events: 'One night, live and loud',
    'social-media': 'Tap to see more',
    announcements: 'Important information for residents',
  };

  return {
    headline: headline || 'New Design',
    subtitle: subtitles[category],
    date: dateMatch ? dateMatch[0] : '',
    keywords: words.slice(0, 8),
    category,
  };
}

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

export interface Palette {
  background: GradientFill | string;
  surface: string;
  accent: string;
  text: string;
  muted: string;
  artColors: string[];
}

const CATEGORY_PALETTES: Record<string, string[]> = {
  church: ['#12245c', '#1d4ed8', '#d4a017'],
  wedding: ['#faf3e0', '#e2c9a0', '#8a6a3b'],
  birthday: ['#ec4899', '#06b6d4', '#facc15'],
  conference: ['#0b1220', '#4f46e5', '#22d3ee'],
  business: ['#0f172a', '#0f766e', '#f4b942'],
  education: ['#065f46', '#16a34a', '#fde68a'],
  marketing: ['#111111', '#dc2626', '#facc15'],
  'real-estate': ['#0c4a6e', '#0369a1', '#e2c9a0'],
  technology: ['#0b0d12', '#6d28d9', '#22d3ee'],
  events: ['#2e1065', '#c026d3', '#f59e0b'],
  'social-media': ['#0f172a', '#0ea5e9', '#f472b6'],
  announcements: ['#f8fafc', '#ea580c', '#0f172a'],
};

export function buildPalette(prompt: string, explicit: string[] = []): Palette {
  const { category } = parsePrompt(prompt);
  const fromPrompt = explicit.length ? explicit : extractColors(prompt);
  const base = fromPrompt.length ? fromPrompt : (CATEGORY_PALETTES[category] ?? CATEGORY_PALETTES.events);

  const primary = base[0];
  const accent = base[1] ?? lighten(primary, 0.4);
  const third = base[2] ?? mix(primary, accent, 0.5);

  // Announcement-style categories read better on a light canvas.
  const lightCategory = category === 'announcements' || category === 'education';

  const background: GradientFill | string = lightCategory
    ? mix('#ffffff', primary, 0.06)
    : {
        type: 'linear',
        angle: 135,
        stops: [
          { offset: 0, color: darken(primary, 0.35) },
          { offset: 0.55, color: primary },
          { offset: 1, color: mix(primary, third, 0.55) },
        ],
      };

  return {
    background,
    surface: lightCategory ? '#ffffff' : lighten(primary, 0.12),
    accent,
    text: lightCategory ? darken(primary, 0.55) : '#ffffff',
    muted: lightCategory ? mix(darken(primary, 0.4), '#ffffff', 0.45) : lighten(primary, 0.72),
    artColors: [darken(primary, 0.3), primary, accent, third],
  };
}

/** Per-category layout recipe. This is the "design system" the mock composes with. */
interface Recipe {
  headlineFont: string;
  headlineWeight: number;
  bodyFont: string;
  artStyle: ArtStyle;
  layout: 'centered' | 'leftStack' | 'editorial' | 'split' | 'banner';
}

const RECIPES: Record<string, Recipe> = {
  church: { headlineFont: 'Archivo Black', headlineWeight: 400, bodyFont: 'Inter', artStyle: 'concentricArcs', layout: 'centered' },
  wedding: { headlineFont: 'Cormorant Garamond', headlineWeight: 600, bodyFont: 'Lora', artStyle: 'gradientMesh', layout: 'editorial' },
  birthday: { headlineFont: 'Caveat', headlineWeight: 700, bodyFont: 'Poppins', artStyle: 'halftone', layout: 'split' },
  conference: { headlineFont: 'Space Grotesk', headlineWeight: 700, bodyFont: 'IBM Plex Mono', artStyle: 'topography', layout: 'leftStack' },
  business: { headlineFont: 'Montserrat', headlineWeight: 800, bodyFont: 'Inter', artStyle: 'concentricArcs', layout: 'leftStack' },
  education: { headlineFont: 'Poppins', headlineWeight: 700, bodyFont: 'Inter', artStyle: 'concentricArcs', layout: 'split' },
  marketing: { headlineFont: 'Archivo Black', headlineWeight: 400, bodyFont: 'Montserrat', artStyle: 'sunburst', layout: 'centered' },
  'real-estate': { headlineFont: 'Playfair Display', headlineWeight: 700, bodyFont: 'Inter', artStyle: 'portraitAbstract', layout: 'banner' },
  technology: { headlineFont: 'Space Grotesk', headlineWeight: 700, bodyFont: 'IBM Plex Mono', artStyle: 'topography', layout: 'leftStack' },
  events: { headlineFont: 'Bebas Neue', headlineWeight: 400, bodyFont: 'Oswald', artStyle: 'diagonalStripes', layout: 'centered' },
  'social-media': { headlineFont: 'Archivo Black', headlineWeight: 400, bodyFont: 'Inter', artStyle: 'gradientMesh', layout: 'banner' },
  announcements: { headlineFont: 'Montserrat', headlineWeight: 800, bodyFont: 'Inter', artStyle: 'concentricArcs', layout: 'leftStack' },
};

/* ------------------------------------------------------------------ */
/* Local (deterministic) implementation                                */
/* ------------------------------------------------------------------ */

const MAX_AI_ELEMENTS = 40;

export const localAIService: AIService = {
  status(): AIStatus {
    return {
      available: true,
      mode: 'local-preview',
      message:
        'Running the built-in deterministic design engine. No model is called and no API key is used. Connect a provider in Settings to enable real generation.',
    };
  },

  /**
   * Compose a real, fully editable DesignDocument from a prompt.
   * Every element is a normal engine element, so the result is immediately
   * editable and exportable — exactly what an AI-produced document must be.
   */
  async generateDesign(request: GenerateDesignRequest): Promise<DesignDocument> {
    const parsed = parsePrompt(request.prompt);
    const palette = buildPalette(request.prompt, request.colors);
    const recipe = RECIPES[parsed.category] ?? RECIPES.events;

    const named = getFormat(request.formatId);
    const width = request.width ?? named?.width ?? 1080;
    const height = request.height ?? named?.height ?? 1350;
    const short = Math.min(width, height);
    const long = Math.max(width, height);

    const elements: DesignElement[] = [];
    let z = 0;
    const nextZ = () => z++;

    /* --- 1. background art ---------------------------------------- */
    const art = makeArt(recipe.artStyle, {
      width,
      height,
      colors: palette.artColors,
      seed: hash(request.prompt + (request.seed ?? '')),
      opacity: 0.9,
    });
    elements.push(
      createImage(art, {
        name: 'Background art',
        x: 0,
        y: 0,
        width,
        height,
        fit: 'fill',
        opacity: 0.85,
        z: nextZ(),
        locked: true,
        alt: `Generated ${recipe.artStyle} background`,
        meta: { generated: true, role: 'background' },
      }),
    );

    /* --- 2. scrim so type always has contrast --------------------- */
    const light = parsed.category === 'announcements' || parsed.category === 'education';
    elements.push(
      createShape({
        name: 'Scrim',
        shape: 'rect',
        x: 0,
        y: recipe.layout === 'centered' ? 0 : height * 0.34,
        width,
        height: recipe.layout === 'centered' ? height : height * 0.66,
        fill: light ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.34)',
        opacity: 1,
        z: nextZ(),
        locked: true,
        meta: { generated: true, role: 'scrim' },
      }),
    );

    /* --- 3. accent bar -------------------------------------------- */
    const barHeight = Math.max(8, short * 0.012);
    elements.push(
      createShape({
        name: 'Accent bar',
        shape: 'roundRect',
        x: short * 0.08,
        y: recipe.layout === 'centered' ? height * 0.17 : height * 0.1,
        width: short * 0.16,
        height: barHeight,
        cornerRadius: barHeight / 2,
        fill: palette.accent,
        z: nextZ(),
        meta: { generated: true, role: 'accent' },
      }),
    );

    /* --- 4. eyebrow / category label ------------------------------ */
    const pad = short * 0.08;
    const eyebrow = parsed.category.replace('-', ' ').toUpperCase();
    elements.push(
      createText(eyebrow, {
        name: 'Eyebrow',
        x: pad,
        y: (recipe.layout === 'centered' ? height * 0.2 : height * 0.13),
        width: width - pad * 2,
        fontSize: Math.round(short * 0.028),
        fontFamily: recipe.bodyFont,
        fontWeight: 600,
        color: palette.accent,
        letterSpacing: Math.round(short * 0.006),
        align: recipe.layout === 'centered' ? 'center' : 'left',
        lineHeight: 1.2,
        z: nextZ(),
        meta: { generated: true, role: 'eyebrow' },
      }),
    );

    /* --- 5. headline ---------------------------------------------- */
    const headlineSize =
      recipe.layout === 'centered'
        ? Math.round(long * 0.115)
        : recipe.layout === 'editorial'
          ? Math.round(long * 0.095)
          : Math.round(long * 0.082);

    elements.push(
      createText(parsed.headline, {
        name: 'Headline',
        x: pad,
        y: recipe.layout === 'centered' ? height * 0.26 : height * 0.17,
        width: width - pad * 2,
        height: headlineSize * 2.4,
        fontSize: headlineSize,
        fontFamily: recipe.headlineFont,
        fontWeight: recipe.headlineWeight,
        color: palette.text,
        lineHeight: 1.02,
        align: recipe.layout === 'centered' ? 'center' : 'left',
        verticalAlign: 'top',
        letterSpacing: recipe.headlineFont === 'Bebas Neue' ? Math.round(short * 0.004) : 0,
        z: nextZ(),
        meta: { generated: true, role: 'headline' },
      }),
    );

    /* --- 6. rule -------------------------------------------------- */
    elements.push(
      createShape({
        name: 'Rule',
        shape: 'rect',
        x: recipe.layout === 'centered' ? width * 0.42 : pad,
        y: height * (recipe.layout === 'centered' ? 0.53 : 0.44),
        width: recipe.layout === 'centered' ? width * 0.16 : short * 0.12,
        height: Math.max(2, short * 0.0035),
        fill: palette.accent,
        opacity: 0.9,
        z: nextZ(),
        meta: { generated: true, role: 'rule' },
      }),
    );

    /* --- 7. subtitle ---------------------------------------------- */
    elements.push(
      createText(parsed.subtitle, {
        name: 'Subtitle',
        x: pad,
        y: height * (recipe.layout === 'centered' ? 0.57 : 0.47),
        width: width - pad * 2,
        height: short * 0.12,
        fontSize: Math.round(short * 0.036),
        fontFamily: recipe.bodyFont,
        fontWeight: 400,
        color: palette.muted,
        lineHeight: 1.35,
        align: recipe.layout === 'centered' ? 'center' : 'left',
        z: nextZ(),
        meta: { generated: true, role: 'subtitle' },
      }),
    );

    /* --- 8. date badge -------------------------------------------- */
    if (parsed.date) {
      const badgeW = Math.min(width * 0.5, short * 0.52);
      const badgeH = short * 0.075;
      elements.push(
        createShape({
          name: 'Date badge',
          shape: 'roundRect',
          x: recipe.layout === 'centered' ? (width - badgeW) / 2 : pad,
          y: height * 0.72,
          width: badgeW,
          height: badgeH,
          cornerRadius: badgeH / 2,
          fill: palette.accent,
          z: nextZ(),
          meta: { generated: true, role: 'badge' },
        }),
      );
      elements.push(
        createText(parsed.date.toUpperCase(), {
          name: 'Date',
          x: recipe.layout === 'centered' ? (width - badgeW) / 2 : pad,
          y: height * 0.72 + badgeH * 0.22,
          width: badgeW,
          height: badgeH,
          fontSize: Math.round(badgeH * 0.44),
          fontFamily: recipe.bodyFont,
          fontWeight: 700,
          color: light ? '#ffffff' : darken(palette.accent, 0.72),
          letterSpacing: Math.round(short * 0.004),
          align: 'center',
          verticalAlign: 'middle',
          z: nextZ(),
          meta: { generated: true, role: 'date' },
        }),
      );
    }

    /* --- 9. footer ------------------------------------------------- */
    elements.push(
      createText(
        (parsed.keywords.slice(0, 3).join(' · ') || 'DesignForge').toUpperCase(),
        {
          name: 'Footer',
          x: pad,
          y: height - short * 0.1,
          width: width - pad * 2,
          height: short * 0.06,
          fontSize: Math.round(short * 0.022),
          fontFamily: recipe.bodyFont,
          fontWeight: 500,
          color: palette.muted,
          letterSpacing: Math.round(short * 0.005),
          align: recipe.layout === 'centered' ? 'center' : 'left',
          z: nextZ(),
          meta: { generated: true, role: 'footer' },
        },
      ),
    );

    const doc = createDocument({
      name: parsed.headline,
      width,
      height,
      background: palette.background,
      elements: elements.slice(0, MAX_AI_ELEMENTS),
      metadata: {
        category: parsed.category,
        format: named?.id,
        tags: ['ai-generated', parsed.category, ...parsed.keywords.slice(0, 3)],
        description: `Generated from: "${request.prompt.slice(0, 120)}"`,
      },
    });

    return delay(doc, 420);
  },

  /**
   * Apply a natural-language instruction to a document.
   * Each recognised intent maps to a real engine operation, so the result is
   * always a valid document (never a mangled one).
   */
  async modifyDesign({ design, instruction }: ModifyDesignRequest): Promise<DesignDocument> {
    const text = instruction.toLowerCase();
    let next = clone(design);

    const texts: TextElement[] = [];
    walk(next.elements, (el) => {
      if (el.type === 'text') texts.push(el as TextElement);
    });
    const headline = [...texts].sort((a, b) => b.fontSize - a.fontSize)[0];

    /* ---- size intents -------------------------------------------- */
    if (headline) {
      if (/bigger|larger|increase.*(size|title|text)|scale up/.test(text)) {
        next = updateElement(next, headline.id, { fontSize: Math.round(headline.fontSize * 1.25) });
      }
      if (/smaller|reduce.*(size|title|text)|scale down/.test(text)) {
        next = updateElement(next, headline.id, { fontSize: Math.round(headline.fontSize * 0.8) });
      }
      if (/bolder|bold/.test(text)) {
        next = updateElement(next, headline.id, { fontWeight: 800 });
      }
      if (/italic/.test(text)) {
        next = updateElement(next, headline.id, { fontStyle: 'italic' });
      }
      if (/uppercase|all caps/.test(text)) {
        next = updateElement(next, headline.id, { textTransform: 'uppercase' });
      }
      if (/center|centre/.test(text)) {
        for (const t of texts) next = updateElement(next, t.id, { align: 'center' });
      }
    }

    /* ---- colour intents ------------------------------------------ */
    const requested = extractColors(text);
    const shade = /darker|deepen/.test(text) ? 'dark' : /lighter|brighter|lighten/.test(text) ? 'light' : null;

    if (requested.length) {
      const target = requested[0];
      const adjust = (c: string) => (shade === 'dark' ? darken(c, 0.3) : shade === 'light' ? lighten(c, 0.3) : c);
      // re-tint the dominant colour family rather than everything at once
      const base = typeof next.background === 'string' ? next.background : next.background.stops[0].color;
      next = {
        ...next,
        background:
          typeof next.background === 'string'
            ? adjust(target)
            : {
                ...next.background,
                stops: next.background.stops.map((s, i) => ({
                  ...s,
                  color: mix(adjust(target), i === 1 ? adjust(target) : lighten(adjust(target), 0.25), i / 2),
                })),
              },
        elements: next.elements.map((el) =>
          el.type === 'shape' && typeof el.fill === 'string' && el.fill.startsWith('#')
            ? ({ ...el, fill: adjust(mix(el.fill, target, 0.7)) } as DesignElement)
            : el,
        ),
      };
      void base;
    } else if (shade) {
      next = {
        ...next,
        background:
          typeof next.background === 'string'
            ? (shade === 'dark' ? darken(next.background, 0.25) : lighten(next.background, 0.25))
            : {
                ...next.background,
                stops: next.background.stops.map((s) => ({
                  ...s,
                  color: shade === 'dark' ? darken(s.color, 0.25) : lighten(s.color, 0.25),
                })),
              },
      };
    }

    /* ---- reposition intents -------------------------------------- */
    if (/move .*(logo|brand).*(bottom right|lower right)/.test(text)) {
      const logo = next.elements.find((el) => el.type === 'image');
      if (logo) {
        next = updateElement(next, logo.id, {
          x: next.width - logo.width - next.width * 0.05,
          y: next.height - logo.height - next.height * 0.05,
        });
      }
    }
    if (/move .*(logo|brand).*(top|upper)/.test(text)) {
      const logo = next.elements.find((el) => el.type === 'image');
      if (logo) next = updateElement(next, logo.id, { x: next.width * 0.05, y: next.height * 0.05 });
    }

    /* ---- style intents ------------------------------------------- */
    if (/minimal|clean|simpler|less busy/.test(text)) {
      const keep = next.elements.filter(
        (el) => el.type === 'text' || el.meta?.role === 'background' || el.type === 'image',
      );
      const keepIds = new Set(keep.map((el) => el.id));
      next = {
        ...next,
        elements: next.elements
          .filter((el) => keepIds.has(el.id))
          .map((el, i) => ({ ...el, z: i, opacity: el.meta?.role === 'background' ? 0.55 : el.opacity })),
      };
    }

    if (/more contrast|higher contrast|readab/.test(text)) {
      const bg = typeof next.background === 'string' ? next.background : next.background.stops[0].color;
      const bgLum = hexToRgb(bg);
      const isDark = (bgLum.r + bgLum.g + bgLum.b) / 3 < 128;
      for (const t of texts) {
        next = updateElement(next, t.id, { color: isDark ? '#ffffff' : '#0b0d12' });
      }
    }

    /* ---- background intents -------------------------------------- */
    if (/background.*(modern|fresh|new)|replace.*background/.test(text)) {
      const seedColors = requested.length
        ? requested
        : typeof next.background === 'string'
          ? [next.background]
          : next.background.stops.map((s) => s.color);
      const art = makeArt('gradientMesh', {
        width: next.width,
        height: next.height,
        colors: [seedColors[0], seedColors[1] ?? lighten(seedColors[0], 0.4), '#0b0d12'],
        seed: hash(instruction),
      });
      const bgEl = next.elements.find((el) => el.meta?.role === 'background');
      if (bgEl && bgEl.type === 'image') {
        next = updateElement(next, bgEl.id, { src: art });
      } else {
        next = {
          ...next,
          elements: [
            createImage(art, {
              name: 'Background art',
              x: 0,
              y: 0,
              width: next.width,
              height: next.height,
              fit: 'fill',
              z: -1,
              locked: true,
              meta: { role: 'background' },
            }),
            ...next.elements,
          ].map((el, i) => ({ ...el, z: i })),
        };
      }
    }

    /* ---- resize intents ------------------------------------------ */
    const targetFormat = /story|vertical|9:16/.test(text)
      ? 'instagram-story'
      : /square|1:1|instagram post/.test(text)
        ? 'instagram-post'
        : /thumbnail|youtube|16:9/.test(text)
          ? 'youtube-thumbnail'
          : /facebook/.test(text)
            ? 'facebook-post'
            : null;

    if (targetFormat) {
      next = await localAIService.resizeDesign({ design: next, formatId: targetFormat });
    }

    return delay(
      {
        ...next,
        metadata: {
          ...next.metadata,
          updatedAt: new Date().toISOString(),
          tags: [...new Set([...next.metadata.tags, 'ai-edited'])],
        },
      },
      360,
    );
  },

  /**
   * Intelligent resize: scale proportionally, then reflow text so nothing is
   * cropped and the safe margins are respected on the new aspect ratio.
   */
  async resizeDesign({ design, formatId }: ResizeRequest): Promise<DesignDocument> {
    const format = getFormat(formatId);
    if (!format) throw new Error(`Unknown format "${formatId}".`);

    const originalRatio = design.width / design.height;
    const targetRatio = format.width / format.height;
    const ratioChange = Math.abs(targetRatio - originalRatio) / originalRatio;

    // A big aspect change needs a reflow; a small one only needs scaling.
    let next = resizeCanvas(design, format.width, format.height, ratioChange > 0.35 ? 'center' : 'scale');

    const short = Math.min(next.width, next.height);
    const pad = short * 0.06;

    // Clamp every visible element back inside the safe area, preserving intent.
    const clampNode = (el: DesignElement): DesignElement => {
      const w = Math.min(el.width, next.width - pad * 2);
      const h = Math.min(el.height, next.height - pad * 2);
      const x = Math.max(pad, Math.min(el.x, next.width - w - pad));
      const y = Math.max(pad, Math.min(el.y, next.height - h - pad));
      const base = { ...el, x, y, width: w, height: h } as DesignElement;
      if (base.type === 'group') {
        return { ...base, children: (base as { children: DesignElement[] }).children.map(clampNode) } as DesignElement;
      }
      return base;
    };

    next = {
      ...next,
      elements: next.elements.map((el) =>
        el.meta?.role === 'background' ? el : clampNode(el),
      ),
    };

    return delay(
      {
        ...next,
        metadata: {
          ...next.metadata,
          format: formatId,
          updatedAt: new Date().toISOString(),
          tags: [...new Set([...next.metadata.tags, `resized:${formatId}`])],
        },
      },
      380,
    );
  },

  /** Copywriting. Template-driven and clearly labelled as local in the UI. */
  async generateText(request: CopyRequest): Promise<CopyResult> {
    const parsed = parsePrompt(request.prompt);
    const topic = parsed.headline;
    const tone = request.tone ?? 'bold';

    const banks: Record<CopyRequest['kind'], Record<string, string[]>> = {
      headline: {
        bold: [`${topic}`, `This Is ${topic}`, `${topic}. Be There.`, `Say Yes To ${topic}`],
        warm: [`Come Share ${topic} With Us`, `A Moment For ${topic}`, `${topic} — You're Invited`],
        professional: [`${topic}: Programme Overview`, `${topic} — Official Announcement`, `Introducing ${topic}`],
        playful: [`Guess What? ${topic}!`, `${topic}? Say Less.`, `Big ${topic} Energy`],
      },
      subtitle: {
        bold: ['One night. No excuses.', 'Doors open early.', 'Limited seats, unlimited energy.'],
        warm: ['Bring a friend and stay a while.', 'Everyone is welcome.', 'We saved you a seat.'],
        professional: ['Insights, data and next steps.', 'A focused programme for busy teams.', 'Registration is now open.'],
        playful: ['Yes, there will be snacks.', 'Come for the vibes, stay for the people.', 'Dress code: comfortable.'],
      },
      description: {
        bold: [
          `${topic} brings together the people who make things happen. Expect a sharp programme, real conversations and a room that moves fast.`,
          `We built ${topic} for people who are done waiting. Two hours, three speakers, zero filler.`,
        ],
        warm: [
          `Join us for ${topic} — an afternoon of good company, honest conversation and something worth remembering.`,
        ],
        professional: [
          `${topic} is a curated programme covering strategy, execution and measurement, with time reserved for questions.`,
        ],
        playful: [
          `Picture this: ${topic}, your favourite people, and a playlist nobody will admit to loving. See you there.`,
        ],
      },
      cta: {
        bold: ['Get your ticket', 'Claim your spot', 'Register now'],
        warm: ['Save your seat', 'Come join us', 'Reserve a place'],
        professional: ['Request an invitation', 'Download the agenda', 'Register your team'],
        playful: ["Let's go", 'Tap to join', 'You in?'],
      },
      caption: {
        bold: [`${topic} is coming. Are you ready? 🔥`, `Mark it. ${topic}. Be there.`],
        warm: [`So excited to share ${topic} with you all 💛`, `Saving you a seat at ${topic}.`],
        professional: [`We're pleased to announce ${topic}. Full details in the link.`],
        playful: [`${topic} and good company? Sign us up ✨`],
      },
    };

    const variants = banks[request.kind][tone] ?? banks[request.kind].bold;
    const count = request.count ?? 3;
    return delay(
      {
        kind: request.kind,
        variants: Array.from({ length: count }, (_, i) => variants[i % variants.length]),
      },
      280,
    );
  },

  /** Real analysis from the engine — deterministic, explainable, no model. */
  async suggestDesignImprovements(design: DesignDocument): Promise<DesignSuggestion[]> {
    void describeDesign(design);
    return delay(analyseDesign(design), 220);
  },

  /**
   * Produce a real image asset as an SVG data URL. It slots straight into the
   * asset library and then onto the canvas as a normal `ImageElement`, which
   * is the exact flow a real image model will use.
   */
  async generateImage(prompt, options = {}): Promise<GeneratedImage> {
    const width = options.width ?? 1024;
    const height = options.height ?? 1024;
    const palette = buildPalette(prompt, options.colors ?? []);

    const styleNames: ArtStyle[] = [
      'gradientMesh',
      'topography',
      'concentricArcs',
      'diagonalStripes',
      'halftone',
      'portraitAbstract',
    ];
    const style = styleNames[hash(prompt) % styleNames.length];

    const src = makeArt(style, {
      width,
      height,
      colors: palette.artColors,
      seed: hash(prompt),
    });

    return delay({ src, width, height, prompt, style }, 520);
  },
};

/* ------------------------------------------------------------------ */
/* Remote implementation (provider-backed, server-side key)            */
/* ------------------------------------------------------------------ */

/**
 * Every method posts to OUR backend. The backend holds the provider key and
 * calls the model. The browser never sees a secret, which is the whole point
 * of putting this behind a service rather than calling a provider directly.
 */
export const remoteAIService: AIService = {
  status: () => ({
    available: true,
    mode: 'connected',
    provider: 'backend',
    message: 'Generation is handled by the configured backend provider.',
  }),

  generateDesign: async (request) => {
    const { request: post } = await import('./httpClient');
    return post<DesignDocument>('/ai/generate-design', { method: 'POST', body: request });
  },

  modifyDesign: async ({ design, instruction }) => {
    const { request: post } = await import('./httpClient');
    return post<DesignDocument>('/ai/modify-design', {
      method: 'POST',
      body: { design, instruction },
    });
  },

  resizeDesign: async ({ design, formatId }) => {
    const { request: post } = await import('./httpClient');
    return post<DesignDocument>('/ai/resize-design', {
      method: 'POST',
      body: { design, formatId },
    });
  },

  generateText: async (request) => {
    const { request: post } = await import('./httpClient');
    return post<CopyResult>('/ai/copy', { method: 'POST', body: request });
  },

  suggestDesignImprovements: async (design) => {
    const { request: post } = await import('./httpClient');
    return post<DesignSuggestion[]>('/ai/suggest', { method: 'POST', body: { design } });
  },

  generateImage: async (prompt, options = {}) => {
    const { request: post } = await import('./httpClient');
    return post<GeneratedImage>('/ai/image', { method: 'POST', body: { prompt, ...options } });
  },
};

/** Feature flags so the UI can label AI surfaces honestly. */
export const AI_CAPABILITIES = {
  designGeneration: { implemented: true, mode: 'local-preview' as const },
  designEditing: { implemented: true, mode: 'local-preview' as const },
  copywriting: { implemented: true, mode: 'local-preview' as const },
  resize: { implemented: true, mode: 'local-preview' as const },
  suggestions: { implemented: true, mode: 'local-preview' as const },
  imageGeneration: { implemented: true, mode: 'local-preview' as const },
  /** not available in any form yet — surfaced as "Coming soon" */
  videoGeneration: { implemented: false, mode: 'coming-soon' as const },
  brandVoiceTraining: { implemented: false, mode: 'coming-soon' as const },
  realtimeCollaboration: { implemented: false, mode: 'coming-soon' as const },
};

export { NotImplementedError };

/** The single swap point for the whole AI surface. */
export const aiService: AIService = apiConfig.baseUrl ? remoteAIService : localAIService;

/** Convenience for UI that wants to show the current mode inline. */
export const localAIStatus: AIStatus = aiService.status();

/** Utility used by the AI Studio preview to show the derived palette. */
export function palettePreview(prompt: string): { swatches: string[]; label: string } {
  const palette = buildPalette(prompt);
  const stops =
    typeof palette.background === 'string'
      ? [palette.background]
      : palette.background.stops.map((s) => s.color);
  return {
    swatches: [...stops, palette.accent].slice(0, 4),
    label: rgbToHex(
      hexToRgb(palette.accent).r,
      hexToRgb(palette.accent).g,
      hexToRgb(palette.accent).b,
    ),
  };
}

export { uid };
