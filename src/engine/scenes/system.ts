/**
 * system — the prompt before your prompt. One frame is everything the model
 * reads. Inside it, top to bottom, the same order as the 2.2 code block: four
 * hidden file cards (COMPANY · APP · SETTINGS · MEMORY), a pleated curtain
 * with a HIDDEN plaque, and below it the only part you see — YOU and your own
 * message bubble. A dotted arrow carries the whole frame to the model (a ring
 * around a solid core, labelled LLM).
 *
 * p (scene progress) tells the story:
 *   0            the frame, four empty dotted slots above the curtain, your
 *                message below it, the model waiting: a complete picture of
 *                what you think you sent.
 *   0.05 – 0.48  the cards slide in from the left, one by one, and settle
 *                into their slots (solid accent chips, labels knocked out,
 *                a clipped corner so they read as files).
 *   0.52 – 0.66  the model reads it all: a beam sweeps the frame top to
 *                bottom — straight through the curtain — and the frame turns
 *                accent behind it.
 *   0.60 – 0.74  accent fills the arrow from the frame to the model …
 *   0.72 – 0.78  … and the core lights up: it has read every part.
 *   0.78 – 1     hold; the arrow's dots keep flowing (t).
 * Accent marks the hidden parts and their flow; your side stays ink.
 * Everything reads at t = 0. On phones the same story loops in time (the
 * ticker's mobileScene, as for every READ section) and reduced motion holds
 * the finished picture.
 *
 * Layout: whole cells, the largest kit that fits the box (cached per box).
 * Desktop side boxes put the model (ringed, labelled) to the right of the
 * frame; a narrow box puts it on top; phones swap the chips for a list (file
 * icon + label) and the model for a bare solid core; wide, short boxes lay
 * the cards in two columns; 375-wide phones drop the frame, and the shortest
 * the plaque too.
 *
 * This file also holds the documents-family kit shared with rag: whole-cell
 * bars, dog-eared pages, rows of word blocks, the prompt strip and its
 * cursor. Every weight is a whole number of cells so edges stay crisp.
 */
import { clamp, easeOut, hash2, lerp, range } from '../noise';
import type { Raster } from '../raster';
import type { Box, Scene } from './types';
import { ACC, INK, blink, pixelText, pixelTextWidth, space } from './helpers';

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

/* ---- the scene ----------------------------------------------------------- */

type G = CanvasRenderingContext2D;

/** The hidden parts, in the order the app puts them together (the 2.2 code block). */
const FILES = ['COMPANY', 'APP', 'SETTINGS', 'MEMORY'] as const;
const WIDEST = 'SETTINGS';
const CURTAIN = 'HIDDEN';
const YOU = 'YOU';
const MODEL = 'LLM';
/** Pixel-font glyph height (font pixels). */
const FH = 5;
/** Your message: token widths, × token height. */
const MSG = [1.8, 1, 2.3];
/** Opaque black, drawn source-over: clears both channels (a knock-out). */
const HOLE = '#000';

// ── beats (scene progress) ──────────────────────────────────────────────
/** Card k slides in over [CARD0 + k·STEP, + LEN]. */
const CARD0 = 0.05;
const CARD_STEP = 0.1;
const CARD_LEN = 0.13;
/** The model reads: a beam sweeps the frame top → bottom. */
const SCAN: [number, number] = [0.52, 0.66];
/** Accent fills the arrow, root → tip. */
const FLOW: [number, number] = [0.6, 0.74];
/** The core lights up (a wipe from the arrow's side). */
const LIT: [number, number] = [0.72, 0.78];

// ── kits ────────────────────────────────────────────────────────────────

type Kit = {
  /** the model above the frame (else to its right) */
  top: boolean;
  /** font scale (cells per font pixel) */
  fs: number;
  /** solid chips with knocked-out labels; false = a list (file icon + label) */
  chip: boolean;
  /** chip padding around the label, and its clipped corner */
  cpx: number;
  cpy: number;
  ear: number;
  /** gap between card rows; columns of cards and their gap */
  cg: number;
  cols: 1 | 2;
  cgx: number;
  /** frame outline weight (0 = no frame) and inner padding */
  lw: number;
  fpad: number;
  /** curtain: the HIDDEN plaque, else a thin band `hc` rows high */
  plaque: boolean;
  hc: number;
  /** gap between the zones: cards · curtain · your view */
  zg: number;
  /** your bubble: token height and padding; the YOU label */
  th: number;
  bpx: number;
  bpy: number;
  you: boolean;
  /** the model: core size, its gap to the ring, ring weight; the LLM label */
  core: number;
  rg: number;
  rw: number;
  label: boolean;
  /** shortest gap between the frame and the model (the arrow lives in it) */
  arrow: number;
  /** empty cells kept inside the box */
  m: number;
};

const ROOMY: Kit = {
  top: false,
  fs: 1,
  chip: true,
  cpx: 2, cpy: 1, ear: 3,
  cg: 2, cols: 1, cgx: 3,
  lw: 1, fpad: 1,
  plaque: true, hc: 3,
  zg: 2,
  th: 3, bpx: 2, bpy: 2, you: true,
  core: 5, rg: 2, rw: 1, label: true,
  arrow: 6,
  m: 1,
};
/** 2560-class boxes: everything at font scale 2. */
const BIG: Kit = {
  ...ROOMY,
  fs: 2,
  cpx: 4, cpy: 2, ear: 4,
  cg: 2, cgx: 6,
  lw: 2, fpad: 2,
  zg: 2,
  th: 5, bpx: 4, bpy: 3,
  core: 10, rg: 3, rw: 2,
  arrow: 10,
  m: 1,
};
/** 1728–1920-class boxes: roomier chips and a heavier ring. */
const LARGE: Kit = { ...ROOMY, cpx: 3, cpy: 2, cg: 3, fpad: 2, zg: 3, th: 4, bpx: 3, core: 7, rg: 2, rw: 2, arrow: 8, m: 2 };
/** Shorter desktop boxes (1280 × 720). */
const MID: Kit = { ...ROOMY, cg: 1, zg: 1, arrow: 5 };
/** Wide, short boxes (tablets): the cards in two columns. */
const WIDE: Kit = { ...ROOMY, cols: 2, cg: 1, zg: 1, arrow: 5 };
/** Phones: a list — file icon + label — and the model as a bare solid core. */
const LIST: Kit = {
  ...ROOMY,
  chip: false,
  cg: 1, zg: 1,
  th: 2, bpx: 2, bpy: 1,
  core: 5, rg: 0, rw: 0, label: false,
  arrow: 5,
  m: 0,
};
/** Narrow, tall boxes (1024-wide desktops): the list with the model (ringed, labelled) on top. */
const NARROW: Kit = { ...LIST, top: true, cg: 2, zg: 2, core: 3, rg: 1, rw: 1, label: true, m: 1 };
/** Landscape phones: the list in two columns. */
const WIDELIST: Kit = { ...LIST, cols: 2, cgx: 4 };
/** 375-wide phones: no frame. */
const BARE: Kit = { ...LIST, lw: 0, fpad: 0 };
/** The shortest phones: no frame, a thin curtain without its plaque. */
const TINY: Kit = { ...BARE, plaque: false, hc: 3 };
const KITS = [BIG, LARGE, ROOMY, MID, WIDE, NARROW, LIST, WIDELIST, BARE, TINY];

type Lay = {
  k: Kit;
  /** frame (outer edge) and its inside */
  fx: number;
  fy: number;
  fw: number;
  fh: number;
  ix: number;
  iy: number;
  iw: number;
  /** one card's size, every slot's top-left, and the x the cards slide in from */
  cardW: number;
  cardH: number;
  slots: [number, number][];
  enter: number;
  /** curtain: top, height, pleats' span, the rod's span */
  curY: number;
  curH: number;
  cx0: number;
  cx1: number;
  rod0: number;
  rod1: number;
  /** your bubble, its tokens, the YOU label */
  bx: number;
  by: number;
  bw: number;
  bh: number;
  tail: number;
  toks: number[];
  tgap: number;
  youY: number;
  /** the model's ring (top-left, size) and label */
  rx: number;
  ry: number;
  R: number;
  labX: number;
  labY: number;
  /** the arrow: stem root (top-left of its first cell), length, thickness, head */
  ax: number;
  ay: number;
  alen: number;
  st: number;
  head: number;
};

/** Place kit `k` in `box`, or null when it does not fit. */
function fit(box: Box, k: Kit, force = false): Lay | null {
  const fs = k.fs;
  const bx0 = Math.ceil(box.x);
  const by0 = Math.ceil(box.y);
  const availW = Math.floor(box.x + box.w) - bx0 - 2 * k.m;
  const availH = Math.floor(box.y + box.h) - by0 - 2 * k.m;

  // the cards
  const LW = pixelTextWidth(WIDEST, fs);
  let cardW = k.chip ? LW + 2 * k.cpx + Math.max(0, k.ear - k.cpy + 1 - k.cpx) : 5 * fs + LW;
  const cardH = k.chip ? FH * fs + 2 * k.cpy : FH * fs;
  const rowsN = FILES.length / k.cols;
  const cardsW = k.cols * cardW + (k.cols - 1) * k.cgx;
  const cardsH = rowsN * cardH + (rowsN - 1) * k.cg;
  // the curtain
  const plaqueW = pixelTextWidth(CURTAIN, fs) + 4 * fs;
  const curH = k.plaque ? (FH + 2) * fs : k.hc;
  // your view
  const toks = MSG.map((w) => Math.round(w * k.th));
  const tgap = Math.max(1, Math.round(k.th * 0.5));
  const bw = toks.reduce((a, b) => a + b, 0) + tgap * (toks.length - 1) + 2 * k.bpx;
  const bh = k.th + 2 * k.bpy;
  const tail = Math.max(1, Math.round(k.th * 0.6));
  const youW = k.you ? pixelTextWidth(YOU, fs) + 3 * fs : 0;
  const zoneH = Math.max(bh + tail, k.you ? FH * fs : 0);
  // the frame
  const iw = Math.max(cardsW, k.plaque ? plaqueW + 8 * fs : 0, youW + bw);
  const ih = cardsH + k.zg + curH + k.zg + zoneH;
  // chips stretch to fill the frame, so the stack reads as one block
  if (k.chip) cardW = Math.floor((iw - (k.cols - 1) * k.cgx) / k.cols);
  const edge = k.lw + k.fpad;
  const fw = iw + 2 * edge;
  const fh = ih + 2 * edge;
  // the model
  const st = fs;
  const R = k.core + 2 * (k.rg + k.rw);
  const labW = k.label ? pixelTextWidth(MODEL, fs) : 0;

  let W: number;
  let H: number;
  if (k.top) {
    W = Math.max(fw, R + 2 * (2 * fs + labW));
    H = R + k.arrow + fh;
  } else {
    W = fw + k.arrow + Math.max(R, labW);
    H = Math.max(fh, R + (k.label ? 2 * fs + FH * fs : 0));
  }
  if (!force && (W > availW || H > availH)) return null;

  // spare room lengthens the arrow (up to twice its shortest)
  const A = k.top ? k.arrow + clamp(availH - H, 0, k.arrow) : k.arrow + clamp(availW - W, 0, k.arrow);
  const totW = k.top ? W : W - k.arrow + A;
  const totH = k.top ? H - k.arrow + A : H;
  const ox = bx0 + k.m + Math.floor((availW - totW) / 2);
  const oy = by0 + k.m + Math.floor((availH - totH) / 2);

  let fx: number;
  let fy: number;
  let rx: number;
  let ry: number;
  let ax: number;
  let ay: number;
  let alen: number;
  let labX: number;
  let labY: number;
  if (k.top) {
    fx = ox + Math.floor((totW - fw) / 2);
    fy = oy + R + A;
    ax = fx + Math.floor((fw - st) / 2);
    ay = fy - 2;
    rx = ax - Math.floor((R - st) / 2);
    ry = oy;
    alen = ay - (ry + R);
    labX = rx + R + 2 * fs;
    labY = ry + Math.floor((R - FH * fs) / 2);
  } else {
    fx = ox;
    fy = oy + Math.floor((totH - fh) / 2);
    const colW = Math.max(R, labW);
    rx = fx + fw + A + Math.floor((colW - R) / 2);
    ry = fy + Math.floor((fh - R) / 2);
    ax = fx + fw + 1;
    ay = ry + Math.floor((R - st) / 2);
    alen = rx - 1 - ax;
    labX = rx + Math.floor((R - labW) / 2);
    labY = ry + R + 2 * fs;
  }

  // a short arrow is all head
  const head = Math.max(1, Math.min(st === 1 ? 3 : 4, alen));
  const ix = fx + edge;
  const iy = fy + edge;
  const cardsX = ix + Math.floor((iw - (k.cols * cardW + (k.cols - 1) * k.cgx)) / 2);
  const slots: [number, number][] = FILES.map((_, i) => [
    cardsX + (i % k.cols) * (cardW + k.cgx),
    iy + Math.floor(i / k.cols) * (cardH + k.cg),
  ]);
  const curY = iy + cardsH + k.zg;
  const zy = curY + curH + k.zg;
  // the curtain hangs across the whole frame; its rod overhangs by one font pixel
  const cx0 = k.lw ? fx + k.lw : ix;
  const cx1 = k.lw ? fx + fw - k.lw : ix + iw;
  const rod0 = (k.lw ? fx : ix) - fs;
  const rod1 = (k.lw ? fx + fw : ix + iw) + fs;
  const by = zy + Math.floor((zoneH - tail - bh) / 2);

  return {
    k,
    fx, fy, fw, fh, ix, iy, iw,
    cardW, cardH, slots,
    enter: Math.floor(box.x) - cardW - 2,
    curY, curH, cx0, cx1, rod0, rod1,
    bx: ix + iw - bw, by, bw, bh, tail, toks, tgap,
    // centred on the bubble, but never up into the gap under the curtain (a label taller than a phone's bubble)
    youY: Math.max(zy, by + Math.floor((bh - FH * fs) / 2)),
    rx, ry, R, labX, labY,
    ax, ay, alen, st, head,
  };
}

/** The largest kit that fits — and, given spare height, a looser rhythm. Cached per box. */
let cacheKey = '';
let cacheLay: Lay | null = null;
function layout(box: Box): Lay {
  const key = `${box.x}|${box.y}|${box.w}|${box.h}`;
  if (key === cacheKey && cacheLay) return cacheLay;
  let lay: Lay | null = null;
  for (const k of KITS) {
    lay = fit(box, k);
    if (!lay) continue;
    for (let e = 1; e <= 2; e++) {
      const loose = fit(box, { ...k, cg: k.cg + e, zg: k.zg + e });
      if (!loose) break;
      lay = loose;
    }
    break;
  }
  lay ??= fit(box, TINY, true)!;
  cacheKey = key;
  cacheLay = lay;
  return lay;
}

// ── drawing ─────────────────────────────────────────────────────────────

/** Draw `fn`'s shapes as holes: whatever it paints is cleared from both channels. */
function knock(g: G, fn: () => void) {
  g.globalCompositeOperation = 'source-over';
  fn();
  g.globalCompositeOperation = 'lighter';
}

/** A solid card with its top-right corner clipped in whole-cell steps. */
function clipped(g: G, x: number, y: number, w: number, h: number, ear: number, style: string) {
  cells(g, x, y + ear, w, h - ear, style);
  for (let r = 0; r < ear; r++) cells(g, x, y + r, w - (ear - r), 1, style);
}

/** An empty slot: a dotted outline. */
function slot(g: G, x: number, y: number, w: number, h: number, style: string) {
  for (let i = 0; i < w; i += 2) {
    cells(g, x + i, y, 1, 1, style);
    cells(g, x + i, y + h - 1, 1, 1, style);
  }
  for (let j = 2; j < h - 1; j += 2) {
    cells(g, x, y + j, 1, 1, style);
    cells(g, x + w - 1, y + j, 1, 1, style);
  }
}

/** One hidden file: a chip with its label knocked out, or (list) a file icon + label. */
function card(g: G, L: Lay, i: number, x: number, y: number) {
  const { k, cardW, cardH } = L;
  const fs = k.fs;
  // a card covers whatever it slides over
  knock(g, () => cells(g, x, y, cardW, cardH, HOLE));
  if (k.chip) {
    clipped(g, x, y, cardW, cardH, k.ear, ACC(1));
    knock(g, () => pixelText(g, FILES[i], x + k.cpx, y + k.cpy, HOLE, { scale: fs }));
  } else {
    clipped(g, x, y, 3 * fs, FH * fs, fs, ACC(1));
    pixelText(g, FILES[i], x + 5 * fs, y, ACC(1), { scale: fs });
  }
}

/** The curtain: a rod, pleats with a scalloped hem, and (if room) the HIDDEN plaque. */
function curtain(g: G, L: Lay) {
  const { k, curY, curH, cx0, cx1, rod0, rod1 } = L;
  const fs = k.fs;
  const style = INK(1);
  cells(g, rod0, curY, rod1 - rod0, fs, style);
  const pw = 2 * fs;
  const pitch = 3 * fs;
  const pleat = (x: number, j: number) => cells(g, x, curY + fs, pw, curH - fs - (j % 2 ? fs : 0), style);
  if (!k.plaque) {
    for (let x = cx0, j = 0; x + pw <= cx1; x += pitch, j++) pleat(x, j);
    return;
  }
  const w = pixelTextWidth(CURTAIN, fs) + 4 * fs;
  const px = Math.round((cx0 + cx1 - w) / 2);
  cells(g, px, curY, w, curH, style);
  knock(g, () => pixelText(g, CURTAIN, px + 2 * fs, curY + fs, HOLE, { scale: fs }));
  // pleats from each end inwards, a font pixel clear of the plaque
  for (let x = cx0, j = 0; x + pw <= px - fs; x += pitch, j++) pleat(x, j);
  for (let x = cx1 - pw, j = 0; x >= px + w + fs; x -= pitch, j++) pleat(x, j);
}

/** Your side: YOU, and your message in a chat bubble with its tail at the right. */
function yourView(g: G, L: Lay) {
  const { k, bx, by, bw, bh, tail, toks, tgap } = L;
  const ol = INK(1);
  const t = Math.max(1, k.lw);
  cells(g, bx + t, by + t, bw - 2 * t, bh - 2 * t, INK(0.18));
  // outline with its corner cells left out, so it reads rounded
  cells(g, bx + t, by, bw - 2 * t, t, ol);
  cells(g, bx + t, by + bh - t, bw - 2 * t, t, ol);
  cells(g, bx, by + t, t, bh - 2 * t, ol);
  cells(g, bx + bw - t, by + t, t, bh - 2 * t, ol);
  const xr = bx + bw - t - 1;
  for (let r = 0; r < tail; r++) cells(g, xr - (tail - r), by + bh + r, tail - r, 1, ol);
  let x = bx + k.bpx;
  for (const w of toks) {
    cells(g, x, by + k.bpy, w, k.th, INK(0.9));
    x += w + tgap;
  }
  if (k.you) pixelText(g, YOU, L.ix, L.youY, INK(1), { scale: k.fs });
}

/**
 * The arrow from the frame to the model: a dotted stem `st` cells thick and a
 * solid head, axis-aligned (rightwards, or upwards when the model is on top).
 * The first `lit` (0..1) of it is accent; `phase` walks the dots forward.
 */
function arrow(g: G, L: Lay, lit: number, phase: number) {
  const { ax, ay, alen, st, head } = L;
  const up = L.k.top;
  const block = (d: number, c: number, dl: number, cw: number, style: string) =>
    up ? cells(g, ax + c, ay - d - dl + 1, cw, dl, style) : cells(g, ax + d, ay + c, dl, cw, style);
  const hd = alen - head;
  const litTo = alen * lit;
  for (let d = (phase & 1) * st; d + st <= hd - 1; d += 2 * st) block(d, 0, st, st, d < litTo ? ACC(1) : INK(0.7));
  const hs = litTo >= Math.max(hd, alen * 0.5) ? ACC(1) : INK(1);
  for (let i = 0; i < head; i++) {
    const sp = head - 1 - i;
    block(hd + i, -sp, 1, st + 2 * sp, hs);
  }
}

/** The model: a ring around a solid core; `lit` wipes the core to accent from the arrow's side. */
function model(g: G, L: Lay, lit: number) {
  const { k, rx, ry, R } = L;
  outline(g, rx, ry, R, R, k.rw, INK(1));
  const c = k.core;
  const cx = rx + k.rw + k.rg;
  const cy = ry + k.rw + k.rg;
  const n = Math.round(c * lit);
  if (k.top) {
    // the arrow arrives from below: light the core bottom-up
    cells(g, cx, cy, c, c - n, INK(1));
    cells(g, cx, cy + c - n, c, n, ACC(1));
  } else {
    cells(g, cx, cy, n, c, ACC(1));
    cells(g, cx + n, cy, c - n, c, INK(1));
  }
  if (k.label) pixelText(g, MODEL, L.labX, L.labY, INK(1), { scale: k.fs });
}

const scene: Scene = {
  paint({ r, box, p, t }) {
    const g = r.begin();
    const L = layout(box);
    const { k, fx, fy, fw, fh, cardW, cardH } = L;

    // the frame: everything the model reads; accent above the reading beam
    const scan = easeOut(range(SCAN[0], SCAN[1], p));
    const ys = Math.round(fy + fh * scan);
    if (k.lw) {
      if (scan > 0) {
        g.save();
        g.beginPath();
        g.rect(fx - 1, fy - 1, fw + 2, ys - fy + 1);
        g.clip();
        outline(g, fx, fy, fw, fh, k.lw, ACC(1));
        g.restore();
      }
      if (scan < 1) {
        g.save();
        g.beginPath();
        g.rect(fx - 1, ys, fw + 2, fy + fh + 1 - ys);
        g.clip();
        outline(g, fx, fy, fw, fh, k.lw, INK(1));
        g.restore();
      }
    }

    // the hidden files slide in, one by one; empty slots wait as dotted outlines
    const cs = FILES.map((_, i) => easeOut(range(CARD0 + i * CARD_STEP, CARD0 + i * CARD_STEP + CARD_LEN, p)));
    for (let i = 0; i < FILES.length; i++) {
      if (cs[i] < 1) slot(g, L.slots[i][0], L.slots[i][1], cardW, cardH, INK(0.45));
    }
    // cards still in flight first, so a landed card stays on top of them
    for (const pass of [0, 1]) {
      for (let i = 0; i < FILES.length; i++) {
        const s = cs[i];
        if (s <= 0 || (s >= 1) !== (pass === 1)) continue;
        const [sx, sy] = L.slots[i];
        card(g, L, i, Math.round(lerp(L.enter, sx, s)), sy);
      }
    }

    curtain(g, L);
    yourView(g, L);

    // the model reads the whole frame, then lights up
    const flow = range(FLOW[0], FLOW[1], p);
    arrow(g, L, flow, flow > 0 ? Math.floor(t * 3) : 0);
    model(g, L, range(LIT[0], LIT[1], p));

    // the reading beam: one row, straight through the curtain
    if (scan > 0 && scan < 1) {
      const x0 = k.lw ? fx : L.ix;
      const w = k.lw ? fw : L.iw;
      const y = Math.min(ys, fy + fh - k.fs);
      knock(g, () => cells(g, x0, y, w, k.fs, HOLE));
      cells(g, x0, y, w, k.fs, ACC(1));
    }

    r.commit();
  },
};

export default scene;
