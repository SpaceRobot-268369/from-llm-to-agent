/**
 * Drawing helpers for pops. Everything works in grid units (cells) and writes
 * cells directly through the pen, so shapes stay crisp pixel art.
 *
 * Tones: use the exact halftone steps 1 / .75 / .5 / .25. Each then draws
 * one even mark size in every cell; anything in between is Bayer-dithered by
 * cell position, so on a moving or fading sprite the marks would shimmer.
 * Fade in those steps too (1 → .75 → .5 → .25, ≥ 60 ms each). Mid-tones take
 * the chapter's mark (squares / dashes / crosses); solid cells are always
 * full squares.
 *
 * Flicker: a cell should never flip solid → empty → solid (or back) within
 * 250 ms — in halftone that reads as a glitch. Blinks and hops hold for at
 * least 80 ms (two frames at 30 Hz).
 *
 * Paint runs every frame: nothing here allocates per call, and pops keep
 * their options objects and derived sprites at module level (keyedOpts,
 * recolor).
 */
import { clamp, hash2, range } from '../noise';
import type { Pen } from './types';

export { easeInOut, easeOut, hash2 } from '../noise';

/** ASCII pixel art, one string per row (see LEGEND). */
export type Sprite = readonly string[];

/**
 * Sprite legend: one character per cell.
 *   '#' ink 1   '+' ink .5   ':' ink .25
 *   '@' accent 1   'o' accent .5   '*' accent .25
 *   '.' ink .15 — the one off-step tone: a sparse speckle, for cells that hold still
 *   'x' punch 1 (knock out the field under the cell)
 *   ' ' nothing
 */
const LEGEND: Readonly<Record<string, readonly [number, number]>> = {
  // [value, channel]: 0 = ink, 1 = accent, 2 = punch
  '#': [1, 0],
  '+': [0.5, 0],
  ':': [0.25, 0],
  '.': [0.15, 0],
  '@': [1, 1],
  o: [0.5, 1],
  '*': [0.25, 1],
  x: [1, 2],
};

export type SpriteOpts = {
  /** mirror left ↔ right (each row reversed) */
  flip?: boolean;
  /** swap channels: ink cells draw in accent and accent cells in ink */
  swap?: boolean;
  /** 0..1: how much of the sprite has crumbled away in blocks (see crumbled()) */
  crumble?: number;
  /** seed for the crumble pattern */
  seed?: number;
  /**
   * the cell the crumble pattern is keyed to (usually the clicked cell), so
   * every sprite of a pop crumbles as one piece and a moving sprite's chunks
   * don't swim; default: the sprite's top-left cell
   */
  origin?: readonly [number, number];
  /** only cells with y <= clipY are drawn (e.g. a cat rising behind a box rim) */
  clipY?: number;
};

/** no options: the default, shared so a stamp without options allocates nothing */
export const NO_OPTS: SpriteOpts = Object.freeze({});

/** A sprite's width in cells (its widest row). */
export function spriteWidth(art: Sprite): number {
  let w = 0;
  for (let i = 0; i < art.length; i++) if (art[i].length > w) w = art[i].length;
  return w;
}

/**
 * Stamp ASCII pixel art (LEGEND) with its top-left cell on the cell under
 * (x, y). `alpha` scales ink and accent, never punch.
 */
export function stamp(b: Pen, art: Sprite, x: number, y: number, alpha = 1, o: SpriteOpts = NO_OPTS) {
  if (alpha <= 0) return;
  const w = o.flip ? spriteWidth(art) : 0;
  const ox = Math.floor(x);
  const oy = Math.floor(y);
  const crumble = o.crumble ?? 0;
  const kx = o.origin ? Math.floor(o.origin[0]) : ox;
  const ky = o.origin ? Math.floor(o.origin[1]) : oy;
  const clipY = o.clipY ?? Infinity;
  for (let r = 0; r < art.length; r++) {
    const row = art[r];
    const cy = oy + r;
    if (cy > clipY) break;
    for (let c = 0; c < row.length; c++) {
      const e = LEGEND[row[c]];
      if (!e) continue;
      const cx = ox + (o.flip ? w - 1 - c : c);
      if (crumble > 0 && crumbled(cx - kx, cy - ky, crumble, o.seed ?? 0)) continue;
      if (e[1] === 2) b.punch(cx, cy, e[0]);
      else b.dot(cx, cy, e[0] * alpha, (e[1] === 1) !== !!o.swap);
    }
  }
}

/**
 * Stamp ASCII pixel art (LEGEND) with its centre cell — column floor(w / 2),
 * row floor(h / 2) — on the cell under (cx, cy). `alpha` scales ink and
 * accent, never punch.
 */
export function sprite(b: Pen, art: Sprite, cx: number, cy: number, alpha = 1, o: SpriteOpts = NO_OPTS) {
  stamp(b, art, Math.floor(cx) - (spriteWidth(art) >> 1), Math.floor(cy) - (art.length >> 1), alpha, o);
}

/**
 * Stamp art standing on a row: its middle column — floor(w / 2) — on column
 * cx and its bottom row (feet, a heart's tip) on row `by`, so it grows up
 * and out from there. `alpha` scales ink and accent, never punch.
 */
export function standing(b: Pen, art: Sprite, cx: number, by: number, alpha = 1, o: SpriteOpts = NO_OPTS) {
  stamp(b, art, Math.floor(cx) - (spriteWidth(art) >> 1), Math.floor(by) - art.length + 1, alpha, o);
}

/** Paint one LEGEND character at cell (x, y), for art that is chosen cell by cell. */
export function paintCell(b: Pen, ch: string, x: number, y: number, alpha = 1) {
  const e = LEGEND[ch];
  if (!e) return;
  if (e[1] === 2) b.punch(x, y, e[0]);
  else if (alpha > 0) b.dot(x, y, e[0] * alpha, e[1] === 1);
}

/** A copy of the art with every `from` character swapped for `to` (build at module load: e.g. blush in ink on paper). */
export function recolor(art: Sprite, from: string, to: string): string[] {
  return art.map((row) => row.split(from).join(to));
}

/**
 * One reusable options object for a pop: `opts(cx, cy, seed, crumble, flip,
 * clipY)` refills it and returns it, crumbling keyed to the clicked cell
 * (cx, cy). Use the result before calling opts() again — it is the same
 * object every time, so paint allocates nothing.
 */
export function keyedOpts() {
  const origin: [number, number] = [0, 0];
  const o: SpriteOpts = { flip: false, crumble: 0, seed: 0, origin, clipY: Infinity };
  return (cx: number, cy: number, seed: number, crumble = 0, flip = false, clipY = Infinity): SpriteOpts => {
    origin[0] = cx;
    origin[1] = cy;
    o.seed = seed;
    o.crumble = crumble;
    o.flip = flip;
    o.clipY = clipY;
    return o;
  };
}

/**
 * The page's blocky dissolve, for one cell: true once the cell has dropped
 * out at progress k (0 = whole, 1 = gone). Like the topic dissolve, 62% of
 * the threshold comes from 2×2-block noise, so shapes break apart in pixel
 * chunks rather than fading.
 */
export function crumbled(x: number, y: number, k: number, seed = 0): boolean {
  if (k <= 0) return false;
  if (k >= 1) return true;
  // >> 1 floors negative cells too (-1 → -1), so blocks stay 2×2 on both sides of the origin
  const n = 0.62 * hash2(x >> 1, y >> 1, seed + 71) + 0.38 * hash2(x, y, seed + 73);
  return n < k;
}

// ── timing ───────────────────────────────────────────────────────────────

/** A window of time [from, until) in seconds. */
export type Span = readonly [number, number];

/** Is a inside the span? */
export const during = (a: number, s: Span) => a >= s[0] && a < s[1];

/** 0 → 1 across the span (clamped). */
export const progress = (a: number, s: Span) => range(s[0], s[1], a);

/**
 * A beat table's current row: the first row whose `until` time (its first
 * entry) is still ahead of a; undefined once a has passed them all. Rows are
 * in time order: [[until, ...what to show], ...].
 */
export function until<R extends readonly [number, ...unknown[]]>(table: readonly R[], a: number): R | undefined {
  for (let i = 0; i < table.length; i++) if (a < table[i][0]) return table[i];
  return undefined;
}

/** Whole steps of `period` in t, safe from float slips (0.3 / 0.1 = 2.999…). */
export const steps = (t: number, period: number) => Math.floor(t / period + 1e-6);

/** A seeded random number in [0, 1) for click `seed`, draw `i`. */
export function rnd(seed: number, i: number): number {
  return hash2(seed, i, 613);
}

/** Overshooting ease-out (a springy "pop"): 0 → ~1.1 → 1. */
export function easeOutBack(t: number, s = 1.70158): number {
  const u = clamp(t) - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}

// ── shapes ───────────────────────────────────────────────────────────────

export type RingOpts = {
  /** draw in accent */
  accent?: boolean;
  /** knock the field out along the ring instead of drawing */
  punch?: boolean;
  /** accent corner brackets: each corner plus arm − 1 cells along both edges, in accent 1 instead */
  arm?: number;
};
const NO_RING: RingOpts = Object.freeze({});

/** One cell of a square ring at radius d, `along` cells from the middle of its side. */
function ringCell(b: Pen, x: number, y: number, along: number, d: number, v: number, o: RingOpts) {
  if (o.punch) return b.punch(x, y, v);
  const bracket = d - Math.abs(along) < (o.arm ?? 0);
  b.dot(x, y, bracket ? 1 : v, bracket || !!o.accent);
}

/** A 1-cell square outline (the page's nested-box motif) `r` cells out from the centre cell. */
export function squareRing(b: Pen, cx: number, cy: number, r: number, v: number, o: RingOpts = NO_RING) {
  const x = Math.floor(cx);
  const y = Math.floor(cy);
  const d = Math.round(r);
  if (d <= 0) {
    ringCell(b, x, y, 0, 0, v, o);
    return;
  }
  for (let i = -d; i <= d; i++) {
    ringCell(b, x + i, y - d, i, d, v, o);
    ringCell(b, x + i, y + d, i, d, v, o);
  }
  // the sides: corners are already on the rows
  for (let i = -d + 1; i < d; i++) {
    ringCell(b, x - d, y + i, i, d, v, o);
    ringCell(b, x + d, y + i, i, d, v, o);
  }
}
