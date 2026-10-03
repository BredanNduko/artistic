/**
 * Locally generated artwork.
 *
 * Templates must not hot-link remote images: cross-origin pixels taint the
 * export canvas and break PNG download. Instead every "photo" in the sample
 * templates is an SVG generated here and embedded as a data URL, so it is
 * always available offline, always exports cleanly, and stays tiny.
 *
 * These are drop-in `ImageElement` sources — exactly the shape a future AI
 * image-generation flow will produce.
 */

import { escapeXml } from '@/engine/validation';

const svg = (width: number, height: number, body: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${body}</svg>`,
  )}`;

/** Deterministic pseudo-random so a given seed always renders identically. */
function rng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ------------------------------------------------------------------ */

export interface ArtOptions {
  width?: number;
  height?: number;
  colors: string[];
  seed?: number;
  opacity?: number;
}

/** Soft multi-stop gradient with blurred light blooms — a "photo" stand-in. */
export function gradientMesh({
  width = 1200,
  height = 1200,
  colors,
  seed = 7,
  opacity = 1,
}: ArtOptions): string {
  const rand = rng(seed);
  const stops = colors
    .map((c, i) => {
      const offset = colors.length === 1 ? 0 : i / (colors.length - 1);
      return `<stop offset="${(offset * 100).toFixed(1)}%" stop-color="${escapeXml(c)}"/>`;
    })
    .join('');

  const blooms = Array.from({ length: 5 }, () => {
    const cx = rand() * width;
    const cy = rand() * height;
    const r = (0.25 + rand() * 0.45) * Math.max(width, height);
    const color = colors[Math.floor(rand() * colors.length)];
    return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${escapeXml(
      color,
    )}" opacity="${(0.16 + rand() * 0.22).toFixed(2)}"/>`;
  }).join('');

  return svg(
    width,
    height,
    `<defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>
      <filter id="b" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="${Math.round(Math.max(width, height) * 0.09)}"/>
      </filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
    <g filter="url(#b)" opacity="${opacity}">${blooms}</g>`,
  );
}

/** Concentric arcs — calm, editorial, works well behind a headline. */
export function concentricArcs({
  width = 1200,
  height = 1200,
  colors,
  seed = 3,
}: ArtOptions): string {
  const rand = rng(seed);
  const cx = width * (0.3 + rand() * 0.4);
  const cy = height * (0.3 + rand() * 0.4);
  const rings = Array.from({ length: 14 }, (_, i) => {
    const r = ((i + 1) / 14) * Math.max(width, height) * 0.75;
    const color = colors[i % colors.length];
    return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(
      0,
    )}" fill="none" stroke="${escapeXml(color)}" stroke-width="${(1.5 + rand() * 3).toFixed(
      1,
    )}" opacity="${(0.12 + rand() * 0.4).toFixed(2)}"/>`;
  }).join('');
  return svg(
    width,
    height,
    `<rect width="${width}" height="${height}" fill="${escapeXml(colors[0])}"/>${rings}`,
  );
}

/** Halftone dot field — retro print texture. */
export function halftone({
  width = 1200,
  height = 1200,
  colors,
  seed = 11,
}: ArtOptions): string {
  const rand = rng(seed);
  const gap = Math.max(14, Math.round(Math.min(width, height) / 34));
  const dots: string[] = [];
  for (let y = gap / 2; y < height; y += gap) {
    for (let x = gap / 2; x < width; x += gap) {
      const t = x / width;
      const r = (1 - t) * (gap * 0.46) + rand() * 1.5;
      const color = colors[Math.floor(rand() * colors.length)];
      dots.push(
        `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${escapeXml(
          color,
        )}" opacity="0.85"/>`,
      );
    }
  }
  return svg(
    width,
    height,
    `<rect width="${width}" height="${height}" fill="${escapeXml(colors[0])}"/>${dots.join('')}`,
  );
}

/** Diagonal ribbon stripes — high-energy background. */
export function diagonalStripes({
  width = 1200,
  height = 1200,
  colors,
  seed = 5,
}: ArtOptions): string {
  const rand = rng(seed);
  const band = Math.max(20, Math.round(Math.min(width, height) / 22));
  const count = Math.ceil((width + height) / band) + 2;
  const bars = Array.from({ length: count }, (_, i) => {
    const color = colors[Math.floor(rand() * colors.length)];
    const w = band * (0.35 + rand() * 0.75);
    return `<rect x="${(i * band).toFixed(0)}" y="${-height}" width="${w.toFixed(
      0,
    )}" height="${height * 3}" fill="${escapeXml(color)}" opacity="${(0.25 + rand() * 0.6).toFixed(
      2,
    )}" transform="rotate(24 ${(i * band).toFixed(0)} ${height / 2})"/>`;
  }).join('');
  return svg(
    width,
    height,
    `<rect width="${width}" height="${height}" fill="${escapeXml(colors[0])}"/>${bars}`,
  );
}

/** Topographic contour lines — technical / premium feel. */
export function topography({
  width = 1200,
  height = 1200,
  colors,
  seed = 21,
}: ArtOptions): string {
  const rand = rng(seed);
  const lines = Array.from({ length: 16 }, (_, i) => {
    const baseY = (i / 15) * height;
    let d = `M 0 ${baseY.toFixed(0)}`;
    const steps = 8;
    for (let s = 1; s <= steps; s += 1) {
      const x = (s / steps) * width;
      const y = baseY + (rand() - 0.5) * height * 0.16;
      const cx = x - width / steps / 2;
      d += ` Q ${cx.toFixed(0)} ${(baseY + (rand() - 0.5) * height * 0.12).toFixed(0)} ${x.toFixed(
        0,
      )} ${y.toFixed(0)}`;
    }
    return `<path d="${d}" fill="none" stroke="${escapeXml(
      colors[i % colors.length],
    )}" stroke-width="2" opacity="${(0.2 + rand() * 0.5).toFixed(2)}"/>`;
  }).join('');
  return svg(
    width,
    height,
    `<rect width="${width}" height="${height}" fill="${escapeXml(colors[0])}"/>${lines}`,
  );
}

/** Sunburst rays — event / announcement energy. */
export function sunburst({
  width = 1200,
  height = 1200,
  colors,
  seed = 13,
}: ArtOptions): string {
  const rand = rng(seed);
  const cx = width / 2;
  const cy = height * 0.62;
  const rays = Array.from({ length: 44 }, (_, i) => {
    const a0 = (i / 44) * Math.PI * 2;
    const spread = (Math.PI * 2) / 44 / 2.4;
    const len = Math.max(width, height) * 1.4;
    const x1 = cx + Math.cos(a0 - spread) * len;
    const y1 = cy + Math.sin(a0 - spread) * len;
    const x2 = cx + Math.cos(a0 + spread) * len;
    const y2 = cy + Math.sin(a0 + spread) * len;
    const color = colors[Math.floor(rand() * colors.length)];
    return `<path d="M ${cx} ${cy} L ${x1.toFixed(0)} ${y1.toFixed(0)} L ${x2.toFixed(
      0,
    )} ${y2.toFixed(0)} Z" fill="${escapeXml(color)}" opacity="${(0.08 + rand() * 0.3).toFixed(2)}"/>`;
  }).join('');
  return svg(
    width,
    height,
    `<rect width="${width}" height="${height}" fill="${escapeXml(colors[0])}"/>${rays}`,
  );
}

/** Portrait-oriented "photo" abstraction for people-driven templates. */
export function portraitAbstract({
  width = 900,
  height = 1200,
  colors,
  seed = 31,
}: ArtOptions): string {
  const rand = rng(seed);
  const shapes = Array.from({ length: 9 }, (_, i) => {
    const cx = rand() * width;
    const cy = rand() * height;
    const rx = (0.12 + rand() * 0.3) * width;
    const ry = (0.1 + rand() * 0.3) * height;
    const color = colors[i % colors.length];
    return `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${rx.toFixed(
      0,
    )}" ry="${ry.toFixed(0)}" fill="${escapeXml(color)}" opacity="${(0.2 + rand() * 0.45).toFixed(
      2,
    )}"/>`;
  }).join('');
  return svg(
    width,
    height,
    `<defs>
      <linearGradient id="p" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0%" stop-color="${escapeXml(colors[0])}"/>
        <stop offset="100%" stop-color="${escapeXml(colors[colors.length - 1])}"/>
      </linearGradient>
      <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="${Math.round(Math.min(width, height) * 0.07)}"/>
      </filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#p)"/>
    <g filter="url(#soft)">${shapes}</g>`,
  );
}

/** Paper grain, used at low opacity over flat colour. */
export function grain({
  width = 800,
  height = 800,
  colors,
  seed = 17,
}: ArtOptions): string {
  const rand = rng(seed);
  const specks = Array.from({ length: 420 }, () => {
    const x = rand() * width;
    const y = rand() * height;
    const r = rand() * 1.8 + 0.3;
    const color = colors[Math.floor(rand() * colors.length)];
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${escapeXml(
      color,
    )}" opacity="${(0.15 + rand() * 0.5).toFixed(2)}"/>`;
  }).join('');
  return svg(width, height, `<g>${specks}</g>`);
}

export const ART_STYLES = {
  gradientMesh,
  concentricArcs,
  halftone,
  diagonalStripes,
  topography,
  sunburst,
  portraitAbstract,
  grain,
} as const;

export type ArtStyle = keyof typeof ART_STYLES;

export function makeArt(style: ArtStyle, options: ArtOptions): string {
  return ART_STYLES[style](options);
}
