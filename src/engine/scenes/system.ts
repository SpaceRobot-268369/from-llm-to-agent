/**
 * system — a personality is a paragraph. A tall document holds the chat so
 * far, turn by turn, ending in a blinking cursor. Above the chat sits a
 * frosted band you never see. Scrolling types that hidden band into view in
 * accent, line by line; then the dashed rule that set it apart dissolves — it
 * was the same text all along.
 *
 * This file also holds the documents-family kit shared with memory and rag:
 * whole-cell bars, dog-eared pages, rows of word blocks, the prompt strip and
 * its cursor. Every weight is a whole number of cells so edges stay crisp.
 */
import { clamp, easeOut, hash2, range } from '../noise';
import type { Raster } from '../raster';
import type { Box, Scene } from './types';
import { ACC, INK, blink, space } from './helpers';

/* ---- documents-family kit ------------------------------------------------ */

/**
 * Shared metrics: the centred square space plus whole-cell weights. Desktop
 * boxes get 2-cell text rows (3 on very large screens); small boxes get
 * 1-cell rows. `fine` forces 1-cell rows for a layout that can't fit otherwise.
 */
export function docKit(box: Box, fine = false) {
  const sp = space(box);
  const big = Math.max(1, Math.round(box.s * 0.027));
  const row = fine ? 1 : big;
  return {
    ...sp,
    /** outline weight */
    T: big === 1 ? 1 : Math.max(2, Math.round(box.s * 0.0225)),
    /** height of one text row */
    row,
    /** base width of a word block */
    unit: 2,
  };
}

/** The height a family composition should fill: most of the box, kept near-square. */
export const fillHeight = (box: Box) => Math.min(box.h, box.s * 1.1) * 0.86;

/** Fill a rectangle snapped to whole cells. */
export function cells(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, style: string) {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const x1 = Math.round(x + w);
  const y1 = Math.round(y + h);
  if (x1 <= x0 || y1 <= y0) return;
  g.fillStyle = style;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
}

/**
 * Erase a snapped rectangle in both raster channels (after a commit). Lets a
 * lifted piece float above the paper with a clean one-cell margin.
 */
export function erase(r: Raster, x: number, y: number, w: number, h: number) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(r.w, Math.round(x + w));
  const y1 = Math.min(r.h, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    r.ink.fill(0, yy * r.w + x0, yy * r.w + x1);
    r.acc.fill(0, yy * r.w + x0, yy * r.w + x1);
  }
}

/**
 * A dotted stem ending in a solid down-pointing head at y1. `flow` (a phase,
 * e.g. time) walks the dots downward.
 */
export function arrowDown(
  g: CanvasRenderingContext2D,
  x: number,
  y0: number,
  y1: number,
  head: number,
  style: string,
  flow = 0,
) {
  const cx = Math.round(x);
  const hy = Math.round(y1) - head;
  const top = Math.round(y0);
  for (let y = top + (Math.floor(flow) & 1); y < hy - 1; y += 2) cells(g, cx, y, 1, 1, style);
  for (let i = 0; i < head; i++) cells(g, cx - (head - 1 - i), hy + i, (head - 1 - i) * 2 + 1, 1, style);
}

/** A square-cornered outline of weight `t`, snapped to whole cells. */
export function outline(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, style: string) {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const x1 = Math.round(x + w);
  const y1 = Math.round(y + h);
  cells(g, x0, y0, x1 - x0, t, style);
  cells(g, x0, y1 - t, x1 - x0, t, style);
  cells(g, x0, y0 + t, t, y1 - y0 - 2 * t, style);
  cells(g, x1 - t, y0 + t, t, y1 - y0 - 2 * t, style);
}

/** The page silhouette (corner cut at `e`), inset by k. */
function pagePath(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, e: number, k: number) {
  g.beginPath();
  g.moveTo(x0 + k, y0 + k);
  g.lineTo(x1 - e, y0 + k);
  g.lineTo(x1 - k, y0 + e);
  g.lineTo(x1 - k, y1 - k);
  g.lineTo(x0 + k, y1 - k);
  g.closePath();
}

/**
 * A page: outline of weight `t` with a folded top-right corner of size `ear`,
 * snapped to whole cells. `fill` tints the inside. The outline stops where the
 * folded flap begins, so the two never double up (the raster adds overlaps).
 */
export function page(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
  ear: number,
  style: string,
  fill?: string,
) {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const x1 = Math.round(x + w);
  const y1 = Math.round(y + h);
  if (x1 - x0 < t * 2 + 2 || y1 - y0 < t * 2 + 2) return;
  const e = Math.min(Math.max(t + 1, Math.round(ear)), x1 - x0 - t, y1 - y0 - t);
  const k = t / 2;
  if (fill) {
    pagePath(g, x0 + t, y0 + t, x1 - t, y1 - t, Math.max(0, e - t), 0);
    g.fillStyle = fill;
    g.fill();
  }
  g.beginPath();
  g.moveTo(x1 - e, y0 + k);
  g.lineTo(x0 + k, y0 + k);
  g.lineTo(x0 + k, y1 - k);
  g.lineTo(x1 - k, y1 - k);
  g.lineTo(x1 - k, y0 + e);
  g.lineWidth = t;
  g.strokeStyle = style;
  g.lineCap = 'butt';
  g.lineJoin = 'miter';
  g.stroke();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // the folded flap
  g.beginPath();
  g.moveTo(x1 - e, y0);
  g.lineTo(x1 - e, y0 + e);
  g.lineTo(x1, y0 + e);
  g.closePath();
  g.fillStyle = style;
  g.fill();
}

/**
 * One row of word blocks from x, `len` × w long (seeded, stable). `reveal`
 * 0..1 types it in from the left. Returns the x where the typed text ends.
 */
export function words(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  unit: number,
  seed: number,
  len: number,
  reveal: number,
  style: string,
): number {
  const x0 = Math.round(x);
  const end = x0 + Math.round(w * len);
  const typed = x0 + (end - x0) * clamp(reveal);
  let cx = x0;
  for (let i = 0; cx < end - 1 && cx < typed; i++) {
    const x1 = Math.min(cx + Math.round(unit * (1.2 + 2.4 * hash2(i, seed, 11))), end);
    cells(g, cx, y, Math.min(x1, typed) - cx, h, style);
    cx = x1 + 1;
  }
  return Math.min(end, typed);
}

/** Ragged line length for row i of a text block (stable). */
export const ragged = (i: number, seed: number, lo = 0.62) => lo + (1 - lo) * hash2(i, seed, 5);

/**
 * The prompt strip: one long frame — the single text the model reads. Its
 * corners are cut in whole-cell steps, so they stay crisp at any weight.
 */
export function stripFrame(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, style: string) {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const x1 = Math.round(x + w);
  const y1 = Math.round(y + h);
  for (let i = 0; i < t; i++) {
    const c = t - i;
    cells(g, x0 + c, y0 + i, x1 - x0 - 2 * c, 1, style);
    cells(g, x0 + c, y1 - 1 - i, x1 - x0 - 2 * c, 1, style);
  }
  cells(g, x0, y0 + t, t, y1 - y0 - 2 * t, style);
  cells(g, x1 - t, y0 + t, t, y1 - y0 - 2 * t, style);
}

/** The cursor block after a line of height h: where the next token goes. Pulses softly. */
export function cursor(g: CanvasRenderingContext2D, x: number, y: number, h: number, t: number) {
  const tall = h > 1;
  cells(g, x, tall ? y - 1 : y, Math.max(2, h), tall ? h + 2 : 2, INK(blink(t)));
}

/** A dashed horizontal rule one cell high. */
export function dashes(g: CanvasRenderingContext2D, x: number, y: number, w: number, dash: number, style: string) {
  const x0 = Math.round(x);
  const x1 = Math.round(x + w);
  for (let cx = x0; cx < x1; cx += dash * 2) cells(g, cx, y, Math.min(dash, x1 - cx), 1, style);
}

/* ---- the scene ----------------------------------------------------------- */

/** hidden instruction lines */
const BAND = 5;
/** chat turns: [is user, lines] */
const TURNS: [boolean, number][] = [
  [true, 1],
  [false, 3],
  [true, 1],
  [false, 2],
];
const LINES = TURNS.reduce((n, [, l]) => n + l, 0);

/**
 * Vertical rhythm for a kit and a looseness step e (−1 = packed and −2 =
 * tightest, for short boxes): band pitch, chat pitch, the extra gap between
 * turns, the space around the rule, and the document height that results.
 */
function rhythm(row: number, T: number, e: number) {
  const pad = T + row;
  const up = Math.max(0, e) >> 1;
  const bp = row + 1 + up;
  const cp = row + Math.max(1, 2 + e);
  const tg = e >= 0 ? row : e === -1 ? Math.max(1, row - 1) : 0;
  const gapR = e >= -1 ? row + 1 + up : row;
  const band = BAND * bp - (bp - row);
  const chat = (LINES - 1) * cp + (TURNS.length - 1) * tg + row;
  return { pad, bp, cp, tg, gapR, h: pad * 2 + band + gapR * 2 + 1 + chat };
}

const scene: Scene = {
  paint({ r, box, p, t, mobile }) {
    const g = r.begin();
    // 2-cell rows when they fit, else 1-cell rows; then loosen the line pitch
    // until the document fills the box's height
    const fill = fillHeight(box);
    let kit = docKit(box);
    if (kit.row > 1 && rhythm(kit.row, kit.T, -1).h > fill) kit = docKit(box, true);
    const { X, Y, L, T, row, unit } = kit;
    let lay = rhythm(row, T, -2);
    for (let e = -1; e < row && rhythm(row, T, e).h <= fill; e++) lay = rhythm(row, T, e);
    const { pad, bp, cp, tg, gapR, h: docH } = lay;
    const docW = Math.round(L(mobile ? 0.74 : 0.58) * 2);
    const x0 = Math.round(X(0) - docW / 2);
    const y0 = Math.round(Y(0) - docH / 2);
    const x1 = x0 + docW;
    const y1 = y0 + docH;
    const ear = row * 2 + T + 1;
    const ix = x0 + pad + 1;
    const iw = docW - (pad + 1) * 2;
    const bandY = y0 + pad;
    const ruleY = bandY + BAND * bp - (bp - row) + gapR;
    const chatY = ruleY + 1 + gapR;

    // story: the band unveils (tint), then its lines type in, then the rule dissolves
    const unveil = easeOut(range(0.05, 0.3, p));
    const typed = range(0.1, 0.55, p) * BAND;
    const merge = range(0.55, 0.72, p);

    // band backdrop: frosted ink while hidden → accent tint once seen
    g.save();
    pagePath(g, x0, y0, x1, y1, ear, T + 1);
    g.clip();
    const by0 = y0 + T + 1;
    const bh = ruleY - 1 - by0;
    if (unveil < 1) cells(g, x0, by0, docW, bh, INK(0.1 * (1 - unveil)));
    if (unveil > 0) cells(g, x0, by0, docW, bh, ACC(0.2 * unveil));
    g.restore();

    // band lines: ghosts until typed
    let pen = -1;
    let penY = 0;
    for (let i = 0; i < BAND; i++) {
      const y = bandY + i * bp;
      const len = i === BAND - 1 ? 0.55 : ragged(i, 41, 0.78);
      const tag = i === 0 ? unit * 2 + 1 : 0;
      const lp = clamp(typed - i);
      if (lp < 1) {
        if (tag) cells(g, ix, y, tag - 1, row, INK(0.3));
        words(g, ix + tag, y, iw - tag, row, unit, 40 + i, len, 1, INK(0.26));
      }
      if (lp > 0) {
        if (tag) cells(g, ix, y, (tag - 1) * Math.min(1, lp * 6), row, ACC(1));
        const end = words(g, ix + tag, y, iw - tag, row, unit, 40 + i, len, lp, ACC(1));
        if (lp < 1) {
          pen = end;
          penY = y;
        }
      }
    }
    if (pen >= 0) cells(g, pen + 1, penY, Math.max(2, row), row, ACC(blink(t)));

    // the rule between what you never see and what you do
    if (merge < 1) dashes(g, ix, ruleY, iw, unit, INK(0.75 * (1 - merge)));

    // the chat: user turns indented, each turn opens with a solid tag
    let y = chatY;
    let lastEnd = ix;
    let lastY = chatY;
    let j = 0;
    for (const [user, lines] of TURNS) {
      const lx = user ? ix + Math.round(iw * 0.3) : ix;
      const lw = ix + iw - lx;
      for (let k = 0; k < lines; k++) {
        const last = k === lines - 1;
        const len = last ? 0.35 + 0.3 * hash2(j, 7, 5) : ragged(j, 9, 0.8);
        let tx = lx;
        if (k === 0) {
          const tw = user ? unit + 1 : unit * 2;
          cells(g, lx, y, tw, row, INK(0.9));
          tx = lx + tw + 1;
        }
        lastEnd = words(g, tx, y, lx + lw - tx, row, unit, 70 + j, len, 1, INK(0.55));
        lastY = y;
        y += cp;
        j++;
      }
      y += tg;
    }
    cursor(g, lastEnd + 1, lastY, row, t);

    // the document itself
    page(g, x0, y0, docW, docH, T, ear, INK(0.95));
    r.commit();
  },
};

export default scene;
