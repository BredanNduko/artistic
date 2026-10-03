/**
 * Sample template library.
 *
 * Twelve original designs, each a real structured `DesignDocument` — not a
 * flattened image. They exist to prove the core architectural claim: a design
 * is data, and any element of it can be edited, restyled or handed to an AI.
 *
 * Every visual asset is generated locally (see data/generated-art.ts) and
 * embedded as a data URL. Nothing is hot-linked, so exports never taint and
 * the library works offline.
 *
 * Each template demonstrates a different layout strategy:
 *   centered · leftStack · editorial · split · banner
 */

import {
  createDocument,
  createImage,
  createLine,
  createShape,
  createText,
  linearGradient,
  type DesignDocument,
  type DesignElement,
} from '@/engine';
import { gradientMesh, concentricArcs, diagonalStripes, halftone, portraitAbstract, sunburst, topography } from './generated-art';

export interface DesignTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  format: string;
  tags: string[];
  /** true = featured on the landing page and at the top of the grid */
  featured?: boolean;
  document: DesignDocument;
}

/* ------------------------------------------------------------------ */
/* Small authoring helpers                                             */
/* ------------------------------------------------------------------ */

const T = (
  text: string,
  options: Parameters<typeof createText>[1],
): DesignElement => createText(text, options);

const S = (options: Parameters<typeof createShape>[0]): DesignElement => createShape(options);

const I = (src: string, options: Parameters<typeof createImage>[1]): DesignElement =>
  createImage(src, options);

const L = (options: Parameters<typeof createLine>[0]): DesignElement => createLine(options);

/** Re-index z-orders so templates read top-to-bottom in authoring order. */
function withZ(elements: DesignElement[]): DesignElement[] {
  return elements.map((el, i) => ({ ...el, z: i }));
}

function doc(
  id: string,
  name: string,
  width: number,
  height: number,
  background: DesignDocument['background'],
  elements: DesignElement[],
  metadata: Partial<DesignDocument['metadata']> = {},
): DesignDocument {
  return createDocument({
    id: `tpl_${id}`,
    name,
    width,
    height,
    background,
    elements: withZ(elements),
    metadata: {
      category: metadata.category,
      tags: metadata.tags ?? [],
      format: metadata.format,
      templateId: `tpl_${id}`,
      description: metadata.description,
      visibility: 'public',
      author: 'DesignForge Studio',
      commentsEnabled: false,
    },
  });
}

/* ================================================================== */
/* 1. Church — "The Root"                                              */
/* ================================================================== */

const churchRoot = doc(
  'church-the-root',
  'The Root — Youth Night',
  1080,
  1350,
  linearGradient(160, [
    { offset: 0, color: '#0a1a44' },
    { offset: 0.5, color: '#12245c' },
    { offset: 1, color: '#1d3f8f' },
  ]),
  [
    I(concentricArcs({ width: 1080, height: 1350, colors: ['#0a1a44', '#1d4ed8', '#d4a017'], seed: 4 }), {
      name: 'Arc artwork', x: 0, y: 0, width: 1080, height: 1350, fit: 'fill', opacity: 0.75,
      locked: true, alt: 'Concentric arc artwork',
    }),
    S({ name: 'Top rule', shape: 'rect', x: 96, y: 140, width: 190, height: 6, fill: '#d4a017' }),
    T('GRACE CHAPEL · YOUTH MINISTRY', {
      x: 96, y: 178, width: 888, height: 40, fontSize: 26, fontFamily: 'Inter', fontWeight: 600,
      color: '#d4a017', letterSpacing: 5, align: 'left',
    }),
    T('THE\nROOT', {
      x: 88, y: 300, width: 904, height: 460, fontSize: 176, fontFamily: 'Archivo Black',
      fontWeight: 400, color: '#ffffff', lineHeight: 0.92, align: 'left', letterSpacing: -4,
    }),
    S({ name: 'Divider', shape: 'rect', x: 96, y: 800, width: 130, height: 4, fill: '#d4a017' }),
    T('A night of worship, real stories and a message about staying grounded in faith.', {
      x: 96, y: 840, width: 760, height: 130, fontSize: 40, fontFamily: 'Inter', fontWeight: 400,
      color: '#b9c6e8', lineHeight: 1.4, align: 'left',
    }),
    S({
      name: 'Date badge', shape: 'roundRect', x: 96, y: 1030, width: 420, height: 108,
      cornerRadius: 54, fill: '#d4a017',
    }),
    T('OCTOBER 12', {
      x: 96, y: 1030, width: 420, height: 108, fontSize: 46, fontFamily: 'Montserrat', fontWeight: 800,
      color: '#0a1a44', align: 'center', verticalAlign: 'middle', letterSpacing: 2,
    }),
    T('DOORS 6:30 PM  ·  14 CEDAR AVENUE', {
      x: 96, y: 1180, width: 888, height: 44, fontSize: 28, fontFamily: 'Inter', fontWeight: 500,
      color: '#8ea0cc', letterSpacing: 3,
    }),
    T('BRING A FRIEND', {
      x: 96, y: 1240, width: 888, height: 40, fontSize: 24, fontFamily: 'IBM Plex Mono', fontWeight: 500,
      color: '#d4a017', letterSpacing: 4,
    }),
  ],
  { category: 'church', format: 'instagram-post', tags: ['church', 'youth', 'event', 'blue', 'gold'], description: 'Bold blue and gold youth event poster with a strong display headline.' },
);

/* ================================================================== */
/* 2. Events — "Summer Sound"                                          */
/* ================================================================== */

const eventsSummerSound = doc(
  'events-summer-sound',
  'Summer Sound Festival',
  1080,
  1350,
  '#2e1065',
  [
    I(diagonalStripes({ width: 1080, height: 1350, colors: ['#2e1065', '#c026d3', '#f59e0b', '#7c3aed'], seed: 9 }), {
      name: 'Stripe artwork', x: 0, y: 0, width: 1080, height: 1350, fit: 'fill', opacity: 0.9, locked: true,
      alt: 'Diagonal festival stripes',
    }),
    S({ name: 'Scrim', shape: 'rect', x: 0, y: 620, width: 1080, height: 730, fill: 'rgba(20,4,48,0.62)' }),
    T('ONE NIGHT ONLY', {
      x: 80, y: 96, width: 920, height: 44, fontSize: 28, fontFamily: 'Oswald', fontWeight: 500,
      color: '#f59e0b', letterSpacing: 8, align: 'center',
    }),
    T('SUMMER\nSOUND', {
      x: 60, y: 250, width: 960, height: 420, fontSize: 168, fontFamily: 'Bebas Neue', fontWeight: 400,
      color: '#ffffff', lineHeight: 0.9, align: 'center', letterSpacing: 4,
    }),
    S({ name: 'Gold rule', shape: 'rect', x: 440, y: 690, width: 200, height: 5, fill: '#f59e0b' }),
    T('AUGUST 22 · PIER 9 WAREHOUSE', {
      x: 80, y: 716, width: 920, height: 48, fontSize: 32, fontFamily: 'Oswald', fontWeight: 500,
      color: '#f5d9a8', letterSpacing: 4, align: 'center',
    }),
    T('KAIJU  ·  MIRA VALE  ·  THE LOWSIDE  ·  NOVAK', {
      x: 80, y: 900, width: 920, height: 60, fontSize: 34, fontFamily: 'Oswald', fontWeight: 400,
      color: '#ffffff', letterSpacing: 2, align: 'center', lineHeight: 1.5,
    }),
    S({
      name: 'CTA', shape: 'roundRect', x: 290, y: 1120, width: 500, height: 104,
      cornerRadius: 52, fill: '#f59e0b',
    }),
    T('GET TICKETS', {
      x: 290, y: 1120, width: 500, height: 104, fontSize: 40, fontFamily: 'Oswald', fontWeight: 600,
      color: '#2e1065', align: 'center', verticalAlign: 'middle', letterSpacing: 6,
    }),
  ],
  { category: 'events', format: 'instagram-post', tags: ['events', 'festival', 'music', 'purple'], description: 'High-energy festival poster with a condensed display stack and a bold CTA.' },
);

/* ================================================================== */
/* 3. Business — "Q4 Growth Report"                                    */
/* ================================================================== */

const businessReport = doc(
  'business-q4-report',
  'Q4 Growth Report',
  2480,
  3508,
  '#f7f8fa',
  [
    S({ name: 'Left panel', shape: 'rect', x: 0, y: 0, width: 300, height: 3508, fill: '#0f766e' }),
    S({ name: 'Accent block', shape: 'rect', x: 0, y: 0, width: 300, height: 620, fill: '#f4b942' }),
    T('Q4', {
      x: 40, y: 90, width: 220, height: 200, fontSize: 148, fontFamily: 'Montserrat', fontWeight: 900,
      color: '#0f172a', align: 'left', lineHeight: 0.95,
    }),
    T('NORTHWIND STUDIO', {
      x: 40, y: 3300, width: 220, height: 140, fontSize: 34, fontFamily: 'Montserrat', fontWeight: 700,
      color: '#ffffff', letterSpacing: 3, lineHeight: 1.4,
    }),
    T('GROWTH REPORT', {
      x: 400, y: 420, width: 1900, height: 320, fontSize: 200, fontFamily: 'Montserrat', fontWeight: 800,
      color: '#0f172a', lineHeight: 1.02, letterSpacing: -3,
    }),
    T('Prepared for the board  ·  January 2026', {
      x: 400, y: 780, width: 1900, height: 60, fontSize: 46, fontFamily: 'Inter', fontWeight: 400,
      color: '#64748b', letterSpacing: 1,
    }),
    L({ name: 'Header rule', x: 400, y: 900, width: 1880, height: 0, points: [0, 0, 1880, 0], stroke: { color: '#0f766e', width: 5 } }),
    // three metric cards
    S({ name: 'Metric 1 bg', shape: 'rect', x: 400, y: 1010, width: 580, height: 420, fill: '#ffffff', stroke: { color: '#e2e8f0', width: 2 } }),
    T('REVENUE', { x: 440, y: 1060, width: 500, height: 44, fontSize: 34, fontFamily: 'Inter', fontWeight: 600, color: '#64748b', letterSpacing: 4 }),
    T('$4.2M', { x: 440, y: 1120, width: 500, height: 120, fontSize: 96, fontFamily: 'Montserrat', fontWeight: 800, color: '#0f172a' }),
    T('+38% year on year', { x: 440, y: 1270, width: 500, height: 60, fontSize: 38, fontFamily: 'Inter', fontWeight: 500, color: '#0f766e' }),

    S({ name: 'Metric 2 bg', shape: 'rect', x: 1050, y: 1010, width: 580, height: 420, fill: '#ffffff', stroke: { color: '#e2e8f0', width: 2 } }),
    T('ACTIVE ACCOUNTS', { x: 1090, y: 1060, width: 500, height: 44, fontSize: 34, fontFamily: 'Inter', fontWeight: 600, color: '#64748b', letterSpacing: 4 }),
    T('18.4k', { x: 1090, y: 1120, width: 500, height: 120, fontSize: 96, fontFamily: 'Montserrat', fontWeight: 800, color: '#0f172a' }),
    T('+12% quarter on quarter', { x: 1090, y: 1270, width: 500, height: 60, fontSize: 38, fontFamily: 'Inter', fontWeight: 500, color: '#0f766e' }),

    S({ name: 'Metric 3 bg', shape: 'rect', x: 1700, y: 1010, width: 580, height: 420, fill: '#0f172a' }),
    T('RETENTION', { x: 1740, y: 1060, width: 500, height: 44, fontSize: 34, fontFamily: 'Inter', fontWeight: 600, color: '#94a3b8', letterSpacing: 4 }),
    T('94%', { x: 1740, y: 1120, width: 500, height: 120, fontSize: 96, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff' }),
    T('Best quarter on record', { x: 1740, y: 1270, width: 500, height: 60, fontSize: 38, fontFamily: 'Inter', fontWeight: 500, color: '#f4b942' }),

    T('Highlights', {
      x: 400, y: 1580, width: 1000, height: 90, fontSize: 74, fontFamily: 'Montserrat', fontWeight: 800, color: '#0f172a',
    }),
    T(
      '• Launched the self-serve onboarding flow, cutting time-to-first-design to 4 minutes.\n' +
        '• Expanded the template library to 340 designs across 12 categories.\n' +
        '• Reduced export times by 61% with a rewritten rendering pipeline.\n' +
        '• Grew enterprise pipeline to $1.9M in qualified opportunities.',
      {
        x: 400, y: 1700, width: 1880, height: 480, fontSize: 46, fontFamily: 'Inter', fontWeight: 400,
        color: '#334155', lineHeight: 1.7,
      },
    ),
    S({ name: 'Chart panel', shape: 'rect', x: 400, y: 2260, width: 1880, height: 700, fill: '#ffffff', stroke: { color: '#e2e8f0', width: 2 } }),
    T('Revenue by quarter', { x: 460, y: 2320, width: 1000, height: 60, fontSize: 44, fontFamily: 'Montserrat', fontWeight: 700, color: '#0f172a' }),
    // simple bar chart drawn from shapes
    ...[0, 1, 2, 3, 4, 5].map((i) => {
      const heights = [180, 240, 300, 380, 470, 560];
      return S({
        name: `Bar ${i + 1}`, shape: 'roundRect',
        x: 520 + i * 290, y: 2860 - heights[i], width: 150, height: heights[i],
        cornerRadius: 8, fill: i === 5 ? '#0f766e' : '#cbd5e1',
      });
    }),
    ...[0, 1, 2, 3, 4, 5].map((i) =>
      T(`Q${i + 1}`, {
        x: 500 + i * 290, y: 2880, width: 190, height: 50, fontSize: 32, fontFamily: 'Inter',
        fontWeight: 500, color: '#64748b', align: 'center',
      }),
    ),
    T('northwind.studio  ·  Confidential', {
      x: 400, y: 3320, width: 1880, height: 50, fontSize: 34, fontFamily: 'Inter', fontWeight: 400,
      color: '#94a3b8', align: 'right',
    }),
  ],
  { category: 'business', format: 'poster-a4', tags: ['business', 'report', 'a4', 'metrics'], description: 'Structured A4 report layout with metric cards and a shape-built bar chart.' },
);

/* ================================================================== */
/* 4. Birthday — "Rooftop Party"                                       */
/* ================================================================== */

const birthdayRooftop = doc(
  'birthday-rooftop',
  'Rooftop Birthday Party',
  1080,
  1080,
  '#fdf2f8',
  [
    I(halftone({ width: 1080, height: 1080, colors: ['#fdf2f8', '#ec4899', '#06b6d4'], seed: 14 }), {
      name: 'Halftone', x: 0, y: 0, width: 1080, height: 1080, fit: 'fill', opacity: 0.35, locked: true,
      alt: 'Halftone dot pattern',
    }),
    S({ name: 'Circle', shape: 'ellipse', x: 640, y: -120, width: 620, height: 620, fill: '#06b6d4', opacity: 0.85 }),
    S({ name: 'Ring', shape: 'ring', x: -140, y: 700, width: 520, height: 520, fill: '#ec4899', innerRadiusRatio: 0.72, opacity: 0.8 }),
    T("You're invited to", {
      x: 90, y: 130, width: 900, height: 60, fontSize: 40, fontFamily: 'Caveat', fontWeight: 600,
      color: '#be185d', align: 'left',
    }),
    T('MAYA\nTURNS 30', {
      x: 80, y: 210, width: 920, height: 400, fontSize: 150, fontFamily: 'Poppins', fontWeight: 800,
      color: '#111827', lineHeight: 1.0, align: 'left', letterSpacing: -3,
    }),
    S({ name: 'Underline', shape: 'roundRect', x: 88, y: 640, width: 340, height: 18, cornerRadius: 9, fill: '#facc15' }),
    T('Rooftop drinks, loud music and questionable dancing.', {
      x: 88, y: 700, width: 620, height: 110, fontSize: 36, fontFamily: 'Poppins', fontWeight: 400,
      color: '#4b5563', lineHeight: 1.45,
    }),
    S({ name: 'Info card', shape: 'roundRect', x: 88, y: 850, width: 620, height: 150, cornerRadius: 28, fill: '#111827' }),
    T('SAT 14 JUNE  ·  8 PM  ·  22 SKYLINE TERRACE', {
      x: 108, y: 850, width: 580, height: 150, fontSize: 30, fontFamily: 'Poppins', fontWeight: 600,
      color: '#facc15', align: 'left', verticalAlign: 'middle', letterSpacing: 1, lineHeight: 1.5,
    }),
    T('RSVP 555 0188', {
      x: 88, y: 1010, width: 620, height: 44, fontSize: 26, fontFamily: 'IBM Plex Mono', fontWeight: 500,
      color: '#9ca3af', letterSpacing: 3,
    }),
  ],
  { category: 'birthday', format: 'instagram-post', tags: ['birthday', 'party', 'pink', 'playful'], description: 'Playful split composition with halftone texture and a dark info card.' },
);

/* ================================================================== */
/* 5. Wedding — "Ava & Noah"                                           */
/* ================================================================== */

const weddingInvite = doc(
  'wedding-ava-noah',
  'Ava & Noah — Wedding Invitation',
  1080,
  1500,
  '#faf3e0',
  [
    I(gradientMesh({ width: 1080, height: 1500, colors: ['#faf3e0', '#e7dcc8', '#d9c9a8'], seed: 6, opacity: 0.5 }), {
      name: 'Paper wash', x: 0, y: 0, width: 1080, height: 1500, fit: 'fill', opacity: 0.55, locked: true,
      alt: 'Soft paper wash',
    }),
    S({ name: 'Frame', shape: 'rect', x: 70, y: 70, width: 940, height: 1360, fill: 'rgba(0,0,0,0)', stroke: { color: '#8a6a3b', width: 2 } }),
    S({ name: 'Inner frame', shape: 'rect', x: 86, y: 86, width: 908, height: 1328, fill: 'rgba(0,0,0,0)', stroke: { color: '#8a6a3b', width: 1 } }),
    T('TOGETHER WITH THEIR FAMILIES', {
      x: 140, y: 200, width: 800, height: 44, fontSize: 24, fontFamily: 'Lora', fontWeight: 400,
      color: '#8a6a3b', letterSpacing: 7, align: 'center',
    }),
    S({ name: 'Sprig', shape: 'star', x: 500, y: 280, width: 80, height: 80, points: 4, innerRadiusRatio: 0.22, fill: '#8a6a3b', opacity: 0.9 }),
    T('Ava', {
      x: 140, y: 400, width: 800, height: 200, fontSize: 160, fontFamily: 'Cormorant Garamond',
      fontWeight: 600, color: '#3f3324', align: 'center', lineHeight: 1.0,
    }),
    T('&', {
      x: 140, y: 600, width: 800, height: 140, fontSize: 96, fontFamily: 'Cormorant Garamond',
      fontWeight: 300, color: '#b08d57', align: 'center', fontStyle: 'italic',
    }),
    T('Noah', {
      x: 140, y: 740, width: 800, height: 200, fontSize: 160, fontFamily: 'Cormorant Garamond',
      fontWeight: 600, color: '#3f3324', align: 'center', lineHeight: 1.0,
    }),
    S({ name: 'Rule', shape: 'rect', x: 440, y: 960, width: 200, height: 2, fill: '#b08d57' }),
    T('REQUEST THE PLEASURE OF YOUR COMPANY', {
      x: 140, y: 1000, width: 800, height: 44, fontSize: 22, fontFamily: 'Lora', fontWeight: 400,
      color: '#8a6a3b', letterSpacing: 6, align: 'center',
    }),
    T('Saturday, the twelfth of September\nTwo thousand and twenty-six\nHalf past four in the afternoon', {
      x: 140, y: 1070, width: 800, height: 180, fontSize: 36, fontFamily: 'Lora', fontWeight: 400,
      color: '#4a3f2f', align: 'center', lineHeight: 1.7,
    }),
    S({ name: 'Rule 2', shape: 'rect', x: 440, y: 1290, width: 200, height: 2, fill: '#b08d57' }),
    T('THE OLD ORCHARD  ·  SOMERSET', {
      x: 140, y: 1320, width: 800, height: 44, fontSize: 24, fontFamily: 'Lora', fontWeight: 500,
      color: '#8a6a3b', letterSpacing: 5, align: 'center',
    }),
  ],
  { category: 'wedding', format: 'instagram-story', tags: ['wedding', 'invitation', 'elegant', 'serif'], description: 'Centred editorial invitation with serif display type and fine gold framing.' },
);

/* ================================================================== */
/* 6. Conference — "Future Stack Summit"                               */
/* ================================================================== */

const conferenceSummit = doc(
  'conference-future-stack',
  'Future Stack Summit',
  1920,
  1080,
  '#0b1220',
  [
    I(topography({ width: 1920, height: 1080, colors: ['#0b1220', '#4f46e5', '#22d3ee'], seed: 8 }), {
      name: 'Topography', x: 0, y: 0, width: 1920, height: 1080, fit: 'fill', opacity: 0.6, locked: true,
      alt: 'Topographic contour lines',
    }),
    S({ name: 'Left scrim', shape: 'rect', x: 0, y: 0, width: 1180, height: 1080, fill: 'rgba(11,18,32,0.72)' }),
    S({ name: 'Accent bar', shape: 'rect', x: 100, y: 130, width: 80, height: 6, fill: '#22d3ee' }),
    T('FUTURE STACK SUMMIT 2026', {
      x: 100, y: 165, width: 1000, height: 44, fontSize: 26, fontFamily: 'IBM Plex Mono', fontWeight: 500,
      color: '#22d3ee', letterSpacing: 6,
    }),
    T('BUILD\nWHAT\nSCALES', {
      x: 96, y: 260, width: 1000, height: 420, fontSize: 140, fontFamily: 'Space Grotesk',
      fontWeight: 700, color: '#ffffff', lineHeight: 0.95, letterSpacing: -3,
    }),
    T('Three days of systems thinking with the engineers behind the platforms you use daily.', {
      x: 100, y: 720, width: 880, height: 110, fontSize: 34, fontFamily: 'Inter', fontWeight: 400,
      color: '#94a3b8', lineHeight: 1.5,
    }),
    S({ name: 'CTA', shape: 'roundRect', x: 100, y: 870, width: 340, height: 88, cornerRadius: 6, fill: '#4f46e5' }),
    T('GET A PASS', {
      x: 100, y: 870, width: 340, height: 88, fontSize: 30, fontFamily: 'Space Grotesk', fontWeight: 700,
      color: '#ffffff', align: 'center', verticalAlign: 'middle', letterSpacing: 4,
    }),
    T('MAR 4–6 · BERLIN', {
      x: 470, y: 870, width: 460, height: 88, fontSize: 30, fontFamily: 'IBM Plex Mono', fontWeight: 500,
      color: '#cbd5e1', verticalAlign: 'middle', letterSpacing: 3,
    }),
    // speaker grid on the right
    ...[0, 1, 2, 3].map((i) => {
      const y = 170 + i * 200;
      return S({
        name: `Speaker ${i + 1}`, shape: 'roundRect', x: 1320, y, width: 480, height: 160,
        cornerRadius: 12, fill: 'rgba(79,70,229,0.16)', stroke: { color: '#334155', width: 1 },
      });
    }),
    ...[
      ['01', 'Distributed systems'],
      ['02', 'AI infrastructure'],
      ['03', 'Developer platforms'],
      ['04', 'Observability'],
    ].map(([num, label], i) =>
      T(`${num}  ${label}`, {
        x: 1352, y: 170 + i * 200, width: 420, height: 160, fontSize: 28, fontFamily: 'Space Grotesk',
        fontWeight: 500, color: '#e2e8f0', verticalAlign: 'middle', lineHeight: 1.4,
      }),
    ),
  ],
  { category: 'conference', format: 'presentation-16-9', tags: ['conference', 'tech', 'dark', 'summit'], description: 'Dark 16:9 summit key visual with a left-weighted stack and a session grid.' },
);

/* ================================================================== */
/* 7. Social Media — "New Drop" story                                  */
/* ================================================================== */

const socialNewDrop = doc(
  'social-new-drop',
  'New Drop — Story',
  1080,
  1920,
  '#0f172a',
  [
    I(gradientMesh({ width: 1080, height: 1920, colors: ['#0f172a', '#0ea5e9', '#f472b6', '#1e1b4b'], seed: 12 }), {
      name: 'Mesh gradient', x: 0, y: 0, width: 1080, height: 1920, fit: 'fill', opacity: 0.9, locked: true,
      alt: 'Colourful mesh gradient',
    }),
    S({ name: 'Scrim', shape: 'rect', x: 0, y: 700, width: 1080, height: 1220, fill: 'rgba(10,15,30,0.55)' }),
    T('DROPPING TODAY', {
      x: 80, y: 180, width: 920, height: 50, fontSize: 30, fontFamily: 'Inter', fontWeight: 600,
      color: '#f472b6', letterSpacing: 8, align: 'center',
    }),
    T('NEW\nDROP', {
      x: 60, y: 820, width: 960, height: 420, fontSize: 200, fontFamily: 'Archivo Black',
      fontWeight: 400, color: '#ffffff', lineHeight: 0.92, align: 'center', letterSpacing: -6,
    }),
    T('Limited run. 200 pieces. No restock.', {
      x: 120, y: 1280, width: 840, height: 70, fontSize: 36, fontFamily: 'Inter', fontWeight: 400,
      color: '#cbd5e1', align: 'center',
    }),
    S({ name: 'CTA pill', shape: 'roundRect', x: 240, y: 1440, width: 600, height: 110, cornerRadius: 55, fill: '#ffffff' }),
    T('SWIPE UP TO SHOP', {
      x: 240, y: 1440, width: 600, height: 110, fontSize: 32, fontFamily: 'Inter', fontWeight: 700,
      color: '#0f172a', align: 'center', verticalAlign: 'middle', letterSpacing: 3,
    }),
    T('@STUDIO.NINE', {
      x: 80, y: 1720, width: 920, height: 50, fontSize: 28, fontFamily: 'IBM Plex Mono', fontWeight: 500,
      color: '#94a3b8', align: 'center', letterSpacing: 6,
    }),
  ],
  { category: 'social-media', format: 'instagram-story', tags: ['social', 'story', 'drop', 'bold'], description: 'Full-screen story with a mesh gradient and oversized display type.' },
);

/* ================================================================== */
/* 8. Announcements — "Community Notice"                               */
/* ================================================================== */

const announcementNotice = doc(
  'announcements-notice',
  'Community Notice',
  1200,
  1200,
  '#f8fafc',
  [
    S({ name: 'Header band', shape: 'rect', x: 0, y: 0, width: 1200, height: 260, fill: '#ea580c' }),
    T('OFFICIAL NOTICE', {
      x: 80, y: 70, width: 1040, height: 44, fontSize: 28, fontFamily: 'Inter', fontWeight: 600,
      color: '#ffe8d6', letterSpacing: 8,
    }),
    T('Road Closure\nNotice', {
      x: 80, y: 118, width: 1040, height: 130, fontSize: 74, fontFamily: 'Montserrat', fontWeight: 800,
      color: '#ffffff', lineHeight: 1.05,
    }),
    S({ name: 'Card', shape: 'rect', x: 80, y: 330, width: 1040, height: 380, fill: '#ffffff', stroke: { color: '#e2e8f0', width: 2 } }),
    T('Harbour Lane will be closed to traffic between 07:00 and 17:00 on 3 November while resurfacing works take place.', {
      x: 130, y: 380, width: 940, height: 180, fontSize: 38, fontFamily: 'Inter', fontWeight: 400,
      color: '#1e293b', lineHeight: 1.6,
    }),
    T('Diversions are signposted via Mill Road. Access for residents and emergency vehicles is maintained at all times.', {
      x: 130, y: 570, width: 940, height: 120, fontSize: 32, fontFamily: 'Inter', fontWeight: 400,
      color: '#64748b', lineHeight: 1.6,
    }),
    // info rows
    ...[
      ['DATE', '3 November 2026'],
      ['TIME', '07:00 – 17:00'],
      ['CONTACT', 'roads@citycouncil.gov'],
    ].map(([label, value], i) => {
      const y = 770 + i * 110;
      return [
        S({ name: `Row ${i + 1} rule`, shape: 'rect', x: 80, y, width: 1040, height: 2, fill: '#e2e8f0' }),
        T(label, { x: 80, y: y + 30, width: 240, height: 60, fontSize: 28, fontFamily: 'Inter', fontWeight: 600, color: '#ea580c', letterSpacing: 4, verticalAlign: 'middle' }),
        T(value, { x: 340, y: y + 30, width: 780, height: 60, fontSize: 32, fontFamily: 'Inter', fontWeight: 500, color: '#0f172a', verticalAlign: 'middle' }),
      ];
    }).flat(),
    T('CITY COUNCIL · HIGHWAYS DEPARTMENT', {
      x: 80, y: 1120, width: 1040, height: 40, fontSize: 24, fontFamily: 'IBM Plex Mono', fontWeight: 500,
      color: '#94a3b8', letterSpacing: 4, align: 'right',
    }),
  ],
  { category: 'announcements', format: 'instagram-post', tags: ['announcement', 'notice', 'civic', 'clean'], description: 'Information-dense civic notice with a clear header band and labelled data rows.' },
);

/* ================================================================== */
/* 9. Education — "Open Day"                                           */
/* ================================================================== */

const educationOpenDay = doc(
  'education-open-day',
  'Campus Open Day',
  1080,
  1350,
  '#f0fdf4',
  [
    I(concentricArcs({ width: 1080, height: 1350, colors: ['#f0fdf4', '#16a34a', '#065f46'], seed: 2 }), {
      name: 'Arc artwork', x: 0, y: 0, width: 1080, height: 1350, fit: 'fill', opacity: 0.5, locked: true,
      alt: 'Concentric arc artwork',
    }),
    S({ name: 'Green block', shape: 'rect', x: 0, y: 900, width: 1080, height: 450, fill: '#065f46' }),
    S({ name: 'Pill', shape: 'roundRect', x: 80, y: 110, width: 320, height: 70, cornerRadius: 35, fill: '#065f46' }),
    T('CAMPUS EVENT', {
      x: 80, y: 110, width: 320, height: 70, fontSize: 26, fontFamily: 'Inter', fontWeight: 600,
      color: '#ffffff', align: 'center', verticalAlign: 'middle', letterSpacing: 3,
    }),
    T('Open\nDay', {
      x: 80, y: 240, width: 920, height: 340, fontSize: 170, fontFamily: 'Poppins', fontWeight: 700,
      color: '#064e3b', lineHeight: 0.95, letterSpacing: -4,
    }),
    T('Explore the campus, meet the tutors and find the course that fits.', {
      x: 84, y: 620, width: 760, height: 130, fontSize: 40, fontFamily: 'Inter', fontWeight: 400,
      color: '#166534', lineHeight: 1.45,
    }),
    T('SATURDAY 18 OCTOBER · 10AM – 4PM', {
      x: 80, y: 960, width: 920, height: 60, fontSize: 38, fontFamily: 'Poppins', fontWeight: 600,
      color: '#fde68a', letterSpacing: 2,
    }),
    ...[
      ['40+', 'courses'],
      ['3', 'campuses'],
      ['Free', 'entry'],
    ].map(([big, small], i) =>
      T(`${big}\n${small}`, {
        x: 80 + i * 310, y: 1070, width: 280, height: 160, fontSize: 60, fontFamily: 'Poppins',
        fontWeight: 700, color: '#ffffff', lineHeight: 1.15,
      }),
    ),
    T('northgate.ac.uk/openday', {
      x: 80, y: 1260, width: 920, height: 50, fontSize: 28, fontFamily: 'IBM Plex Mono', fontWeight: 500,
      color: '#6ee7b7', letterSpacing: 2,
    }),
  ],
  { category: 'education', format: 'instagram-post', tags: ['education', 'campus', 'green', 'event'], description: 'Friendly education poster with a colour block footer and stat row.' },
);

/* ================================================================== */
/* 10. Marketing — "Launch Sale"                                       */
/* ================================================================== */

const marketingSale = doc(
  'marketing-launch-sale',
  'Launch Sale — 40% Off',
  1080,
  1080,
  '#111111',
  [
    I(sunburst({ width: 1080, height: 1080, colors: ['#111111', '#dc2626', '#facc15'], seed: 15 }), {
      name: 'Sunburst', x: 0, y: 0, width: 1080, height: 1080, fit: 'fill', opacity: 0.95, locked: true,
      alt: 'Sunburst rays',
    }),
    S({ name: 'Inner disc', shape: 'ellipse', x: 240, y: 240, width: 600, height: 600, fill: '#111111', opacity: 0.82 }),
    T('LAUNCH WEEK', {
      x: 140, y: 200, width: 800, height: 50, fontSize: 32, fontFamily: 'Montserrat', fontWeight: 700,
      color: '#facc15', letterSpacing: 10, align: 'center',
    }),
    T('40%', {
      x: 140, y: 300, width: 800, height: 300, fontSize: 280, fontFamily: 'Archivo Black',
      fontWeight: 400, color: '#ffffff', align: 'center', lineHeight: 1.0, letterSpacing: -10,
    }),
    T('OFF EVERYTHING', {
      x: 140, y: 600, width: 800, height: 70, fontSize: 46, fontFamily: 'Montserrat', fontWeight: 800,
      color: '#facc15', align: 'center', letterSpacing: 6,
    }),
    S({ name: 'CTA', shape: 'roundRect', x: 320, y: 730, width: 440, height: 100, cornerRadius: 50, fill: '#dc2626' }),
    T('SHOP NOW', {
      x: 320, y: 730, width: 440, height: 100, fontSize: 38, fontFamily: 'Montserrat', fontWeight: 800,
      color: '#ffffff', align: 'center', verticalAlign: 'middle', letterSpacing: 6,
    }),
    T('ENDS SUNDAY · CODE LAUNCH40', {
      x: 140, y: 880, width: 800, height: 50, fontSize: 28, fontFamily: 'IBM Plex Mono', fontWeight: 500,
      color: '#fca5a5', align: 'center', letterSpacing: 3,
    }),
  ],
  { category: 'marketing', format: 'instagram-post', tags: ['marketing', 'sale', 'bold', 'red'], description: 'Loud promotional poster built around a single oversized number.' },
);

/* ================================================================== */
/* 11. Real Estate — "Open House"                                      */
/* ================================================================== */

const realEstateOpenHouse = doc(
  'real-estate-open-house',
  'Open House — Harbour View',
  1200,
  630,
  '#0c4a6e',
  [
    I(portraitAbstract({ width: 760, height: 630, colors: ['#0c4a6e', '#0369a1', '#e2c9a0'], seed: 19 }), {
      name: 'Property image', x: 0, y: 0, width: 640, height: 630, fit: 'cover', locked: false,
      alt: 'Property photograph placeholder',
    }),
    S({ name: 'Info panel', shape: 'rect', x: 640, y: 0, width: 560, height: 630, fill: '#0b1220' }),
    S({ name: 'Accent rule', shape: 'rect', x: 700, y: 90, width: 90, height: 6, fill: '#e2c9a0' }),
    T('OPEN HOUSE', {
      x: 700, y: 120, width: 440, height: 40, fontSize: 24, fontFamily: 'Inter', fontWeight: 600,
      color: '#e2c9a0', letterSpacing: 7,
    }),
    T('Harbour\nView', {
      x: 696, y: 180, width: 440, height: 170, fontSize: 78, fontFamily: 'Playfair Display',
      fontWeight: 700, color: '#ffffff', lineHeight: 1.0,
    }),
    T('3 bed · 2 bath · 128 m²', {
      x: 700, y: 380, width: 440, height: 44, fontSize: 28, fontFamily: 'Inter', fontWeight: 400,
      color: '#94a3b8',
    }),
    T('$845,000', {
      x: 700, y: 430, width: 440, height: 70, fontSize: 54, fontFamily: 'Inter', fontWeight: 700,
      color: '#ffffff',
    }),
    S({ name: 'CTA', shape: 'rect', x: 700, y: 520, width: 300, height: 64, fill: '#e2c9a0' }),
    T('BOOK A VIEWING', {
      x: 700, y: 520, width: 300, height: 64, fontSize: 24, fontFamily: 'Inter', fontWeight: 700,
      color: '#0b1220', align: 'center', verticalAlign: 'middle', letterSpacing: 2,
    }),
    T('Sat 11–2', {
      x: 1020, y: 520, width: 120, height: 64, fontSize: 22, fontFamily: 'IBM Plex Mono', fontWeight: 500,
      color: '#e2c9a0', align: 'center', verticalAlign: 'middle',
    }),
  ],
  { category: 'real-estate', format: 'facebook-post', tags: ['real-estate', 'listing', 'landscape', 'premium'], description: 'Landscape listing card pairing a property image with a dark information panel.' },
);

/* ================================================================== */
/* 12. Technology — "DevTools Launch" thumbnail                        */
/* ================================================================== */

const techThumbnail = doc(
  'tech-devtools-thumbnail',
  'DevTools Launch — Thumbnail',
  1280,
  720,
  '#0b0d12',
  [
    I(topography({ width: 1280, height: 720, colors: ['#0b0d12', '#6d28d9', '#22d3ee'], seed: 23 }), {
      name: 'Topography', x: 0, y: 0, width: 1280, height: 720, fit: 'fill', opacity: 0.55, locked: true,
      alt: 'Topographic lines',
    }),
    S({ name: 'Left scrim', shape: 'rect', x: 0, y: 0, width: 860, height: 720, fill: 'rgba(11,13,18,0.7)' }),
    S({ name: 'Badge', shape: 'roundRect', x: 70, y: 80, width: 300, height: 62, cornerRadius: 6, fill: '#22d3ee' }),
    T('V2.0 IS LIVE', {
      x: 70, y: 80, width: 300, height: 62, fontSize: 26, fontFamily: 'IBM Plex Mono', fontWeight: 600,
      color: '#062b33', align: 'center', verticalAlign: 'middle', letterSpacing: 3,
    }),
    T('SHIP\nFASTER', {
      x: 66, y: 190, width: 800, height: 300, fontSize: 150, fontFamily: 'Space Grotesk',
      fontWeight: 700, color: '#ffffff', lineHeight: 0.92, letterSpacing: -5,
    }),
    T('The build tool your CI has been waiting for.', {
      x: 70, y: 520, width: 760, height: 60, fontSize: 32, fontFamily: 'Inter', fontWeight: 400,
      color: '#94a3b8',
    }),
    S({ name: 'Play', shape: 'ellipse', x: 1000, y: 480, width: 150, height: 150, fill: '#dc2626' }),
    S({ name: 'Play triangle', shape: 'triangle', x: 1050, y: 520, width: 70, height: 70, fill: '#ffffff', rotation: 90 }),
  ],
  { category: 'technology', format: 'youtube-thumbnail', tags: ['technology', 'thumbnail', 'video', 'dark'], description: 'High-contrast YouTube thumbnail with a play badge and condensed headline.' },
);

/* ================================================================== */

export const TEMPLATES: DesignTemplate[] = [
  { ...churchRoot, id: 'church-the-root', name: 'The Root — Youth Night', description: 'Bold blue and gold youth event poster with a strong display headline.', category: 'church', format: 'instagram-post', tags: ['church', 'youth', 'event'], featured: true, document: churchRoot },
  { ...eventsSummerSound, id: 'events-summer-sound', name: 'Summer Sound Festival', description: 'High-energy festival poster with a condensed display stack.', category: 'events', format: 'instagram-post', tags: ['events', 'festival', 'music'], featured: true, document: eventsSummerSound },
  { ...businessReport, id: 'business-q4-report', name: 'Q4 Growth Report', description: 'Structured A4 report layout with metric cards and a shape-built chart.', category: 'business', format: 'poster-a4', tags: ['business', 'report', 'a4'], featured: true, document: businessReport },
  { ...birthdayRooftop, id: 'birthday-rooftop', name: 'Rooftop Birthday Party', description: 'Playful composition with halftone texture and a dark info card.', category: 'birthday', format: 'instagram-post', tags: ['birthday', 'party', 'playful'], featured: true, document: birthdayRooftop },
  { ...weddingInvite, id: 'wedding-ava-noah', name: 'Ava & Noah — Wedding Invitation', description: 'Centred editorial invitation with serif display type.', category: 'wedding', format: 'instagram-story', tags: ['wedding', 'invitation', 'elegant'], featured: true, document: weddingInvite },
  { ...conferenceSummit, id: 'conference-future-stack', name: 'Future Stack Summit', description: 'Dark 16:9 summit key visual with a session grid.', category: 'conference', format: 'presentation-16-9', tags: ['conference', 'tech', 'dark'], featured: true, document: conferenceSummit },
  { ...socialNewDrop, id: 'social-new-drop', name: 'New Drop — Story', description: 'Full-screen story with a mesh gradient and oversized type.', category: 'social-media', format: 'instagram-story', tags: ['social', 'story', 'drop'], document: socialNewDrop },
  { ...announcementNotice, id: 'announcements-notice', name: 'Community Notice', description: 'Information-dense civic notice with labelled data rows.', category: 'announcements', format: 'instagram-post', tags: ['announcement', 'notice', 'civic'], document: announcementNotice },
  { ...educationOpenDay, id: 'education-open-day', name: 'Campus Open Day', description: 'Friendly education poster with a colour block footer.', category: 'education', format: 'instagram-post', tags: ['education', 'campus', 'event'], document: educationOpenDay },
  { ...marketingSale, id: 'marketing-launch-sale', name: 'Launch Sale — 40% Off', description: 'Loud promotional poster built around one oversized number.', category: 'marketing', format: 'instagram-post', tags: ['marketing', 'sale', 'bold'], document: marketingSale },
  { ...realEstateOpenHouse, id: 'real-estate-open-house', name: 'Open House — Harbour View', description: 'Landscape listing card with a dark information panel.', category: 'real-estate', format: 'facebook-post', tags: ['real-estate', 'listing', 'premium'], document: realEstateOpenHouse },
  { ...techThumbnail, id: 'tech-devtools-thumbnail', name: 'DevTools Launch — Thumbnail', description: 'High-contrast thumbnail with a play badge.', category: 'technology', format: 'youtube-thumbnail', tags: ['technology', 'thumbnail', 'video'], document: techThumbnail },
];

export function getTemplate(id: string): DesignTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export const FEATURED_TEMPLATES = TEMPLATES.filter((t) => t.featured);
