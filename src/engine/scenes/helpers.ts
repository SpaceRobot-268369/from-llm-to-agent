/**
 * Shared drawing helpers for scenes. Everything works in grid units (cells).
 *
 * Colours: draw ordinary pixels with INK(a) and highlighted pixels with ACC(a)
 * (re-exported here). Alpha maps to halftone density: 1 = solid block,
 * ~0.5 = mid dots, ~0.15 = sparse fine dots.
 */
import type { Raster } from '../raster';
import { hash2 } from '../noise';
import type { Box } from './types';

export { INK, ACC } from '../raster';

/**
 * A centred square coordinate space inside `box`: u, v ∈ [-1, 1] map to the
 * largest centred square; L() scales a length in the same units. Lets scenes
 * keep their proportions at any aspect ratio.
 */
export function space(box: Box) {
  const half = box.s / 2;
  return {
    X: (u: number) => box.cx + u * half,
    Y: (v: number) => box.cy + v * half,
    L: (l: number) => l * half,
  };
}

/** Fill a rounded rectangle (grid units). */
export function fillRound(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  style: string,
) {
  if (w <= 0 || h <= 0) return;
  g.beginPath();
  g.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
  g.fillStyle = style;
  g.fill();
}

/** Stroke a rounded rectangle outline (grid units). */
export function strokeRound(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  lineWidth: number,
  style: string,
) {
  if (w <= 0 || h <= 0) return;
  g.beginPath();
  g.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
  g.lineWidth = lineWidth;
  g.strokeStyle = style;
  g.stroke();
}

/** Fill a circle. */
export function fillCircle(g: CanvasRenderingContext2D, x: number, y: number, r: number, style: string) {
  if (r <= 0) return;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = style;
  g.fill();
}

/** Stroke a circle (or an arc from a0 to a1, radians). */
export function strokeArc(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  lineWidth: number,
  style: string,
  a0 = 0,
  a1 = Math.PI * 2,
) {
  if (r <= 0) return;
  g.beginPath();
  g.arc(x, y, r, a0, a1);
  g.lineWidth = lineWidth;
  g.strokeStyle = style;
  g.stroke();
}

/** Straight line. */
export function line(
  g: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  lineWidth: number,
  style: string,
  dash?: number[],
  dashOffset = 0,
) {
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.lineWidth = lineWidth;
  g.strokeStyle = style;
  g.setLineDash(dash ?? []);
  g.lineDashOffset = dashOffset;
  g.stroke();
  g.setLineDash([]);
}

/**
 * Text-like bars inside a rectangle: `n` rows of height `rowH`, ragged right
 * edges (seeded, stable), filled with `style`. `reveal` 0..1 draws only the
 * first fraction of rows (with the last one partially typed).
 */
export function textLines(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  n: number,
  rowH: number,
  gap: number,
  style: string,
  seed = 1,
  reveal = 1,
) {
  const shown = reveal * n;
  for (let i = 0; i < n; i++) {
    if (i >= shown) break;
    const ragged = 0.55 + 0.45 * hash2(i, seed, 3);
    const partial = Math.min(1, shown - i);
    const lw = w * ragged * partial;
    fillRound(g, x, y + i * (rowH + gap), lw, rowH, rowH / 2, style);
  }
}

/**
 * A soft, slow cursor pulse between 1 and `low` (never fully off — hard
 * blinking distracts from reading). Returns 1 when time is frozen (t = 0).
 */
export function blink(t: number, period = 2.4, low = 0.62): number {
  if (t === 0) return 1;
  const w = 0.5 + 0.5 * Math.cos((t / period) * Math.PI * 2);
  return low + (1 - low) * w;
}

/**
 * Sprinkle sparse "dust" dots over the raster's ink channel — the faint
 * scattered texture of print halftone. `density` is the fraction of cells lit.
 */
export function dust(r: Raster, density: number, seed = 0, t = 0, amp = 0.35) {
  const { w, h, ink } = r;
  const tick = Math.floor(t * 0.8);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = hash2(x, y, seed);
      if (k < 1 - density) continue;
      const tw = hash2(x, y, seed + 31 + tick) > 0.35 ? 1 : 0.4;
      const i = y * w + x;
      const v = amp * tw;
      if (v > ink[i]) ink[i] = v;
    }
  }
}

/**
 * Per-cell procedural painting over a box: `fn(u, v)` receives coordinates
 * normalised to the box (0..1) and returns an intensity 0..1.
 */
export function field(r: Raster, box: Box, fn: (u: number, v: number, x: number, y: number) => number, accent = false) {
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(r.w, Math.ceil(box.x + box.w));
  const y1 = Math.min(r.h, Math.ceil(box.y + box.h));
  const ch = accent ? r.acc : r.ink;
  for (let y = y0; y < y1; y++) {
    const v = (y + 0.5 - box.y) / box.h;
    for (let x = x0; x < x1; x++) {
      const u = (x + 0.5 - box.x) / box.w;
      const val = fn(u, v, x, y);
      if (val <= 0) continue;
      const i = y * r.w + x;
      const c = val > 1 ? 1 : val;
      if (c > ch[i]) ch[i] = c;
    }
  }
}

/**
 * Concentric nested boxes around a solid core — the finale's motif. `count`
 * boxes; `spread` 0..1 scales how far they reach; `keep` (0..count) is how
 * many survive, removed from the outside in — a fractional value fades the
 * outermost remaining box. The core blinks when `cursorOn` is 1.
 */
export function nestedBoxes(
  g: CanvasRenderingContext2D,
  box: Box,
  opts: { count: number; spread: number; keep: number; cursorOn: number; coreAccent?: boolean; outward?: number },
) {
  const { X, Y, L } = space(box);
  // pixel-aligned: square corners, strokes that cover whole cells
  const cx = Math.round(X(0));
  const cy = Math.round(Y(0));
  const core = Math.max(2, Math.round(L(0.1)));
  const maxR = L(0.94) * opts.spread;
  const keep = Math.max(0, Math.min(opts.count, opts.keep));
  for (let i = opts.count; i >= 1; i--) {
    if (i > Math.ceil(keep)) continue;
    const fade = i === Math.ceil(keep) && keep % 1 > 0 ? keep % 1 : 1;
    const k = i / opts.count;
    const out = (opts.outward ?? 0) * k * L(0.6);
    const half = Math.round(core + 2 + (maxR - core - 2) * k + out);
    const a = (1 - k * 0.58) * fade;
    g.lineWidth = 1;
    g.strokeStyle = INK_(a);
    g.strokeRect(cx - half + 0.5, cy - half + 0.5, half * 2 - 1, half * 2 - 1);
  }
  const coreStyle = opts.coreAccent ? ACC_(opts.cursorOn) : INK_(opts.cursorOn);
  g.fillStyle = coreStyle;
  g.fillRect(cx - core, cy - core, core * 2, core * 2);
}

// local aliases (avoid a circular import of the re-export)
const INK_ = (a = 1) => `rgba(255,0,0,${a})`;
const ACC_ = (a = 1) => `rgba(0,255,0,${a})`;

// ── 3×5 pixel font ──────────────────────────────────────────────────────
// Labels inside diagrams (NOTION, MAIN AGENT, CODEX…). Capitals, digits and a
// few symbols; unknown characters render as a space. Each glyph is 3 columns ×
// 5 rows; one font pixel = `scale` cells.

const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100110101010', '7': '111001010010010',
  '8': '010101010101010', '9': '010101011001110',
  ' ': '000000000000000', '.': '000000000000010', '-': '000000111000000', '+': '000010111010000',
  ':': '000010000010000', '/': '001001010100100', '?': '110001010000010', '=': '000111000111000',
  '·': '000000010000000', '×': '000101010101000', '>': '100010001010100', '<': '001010100010001',
  '_': '000000000000111', '!': '010010010000010', '#': '101111101111101', '@': '010101111100011',
};

/** Width in cells of `text` in the pixel font. */
export function pixelTextWidth(text: string, scale = 1, tracking = 1): number {
  const n = text.length;
  return n <= 0 ? 0 : (n * 3 + (n - 1) * tracking) * scale;
}

/**
 * Draw `text` in the 3×5 pixel font with its top-left at (x, y), in grid
 * units. `align` 'center' centres on x. Returns the drawn width in cells.
 * Coordinates are rounded to whole cells so glyphs stay crisp.
 */
export function pixelText(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: string,
  opts: { scale?: number; tracking?: number; align?: 'left' | 'center' | 'right' } = {},
): number {
  const scale = Math.max(1, Math.round(opts.scale ?? 1));
  const tracking = opts.tracking ?? 1;
  const up = text.toUpperCase();
  const w = pixelTextWidth(up, scale, tracking);
  let cx = Math.round(opts.align === 'center' ? x - w / 2 : opts.align === 'right' ? x - w : x);
  const cy = Math.round(y);
  g.fillStyle = style;
  for (const ch of up) {
    const bits = FONT[ch] ?? FONT[' '];
    for (let i = 0; i < 15; i++) {
      if (bits.charCodeAt(i) !== 49) continue; // '1'
      g.fillRect(cx + (i % 3) * scale, cy + Math.floor(i / 3) * scale, scale, scale);
    }
    cx += (3 + tracking) * scale;
  }
  return w;
}
