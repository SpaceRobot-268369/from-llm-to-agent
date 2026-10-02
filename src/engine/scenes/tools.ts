/**
 * tools — the model is a brain; tools are its hands and feet.
 *
 * A solid pixel brain (folds cut into it) sits on top. Its brainstem runs on
 * as a dotted "nerve" that splits left and right like a body: out to a HAND
 * (a pointer cursor, far left) next to a page, and out to a FOOT (a boot,
 * far right) next to a globe. Pixel-font labels: DO under the hand, FETCH
 * under the foot (when the box has room for them).
 *
 * p (scene progress) tells the story twice, once per limb:
 *   0.02 – 0.10  the brain writes a small request under its stem: an accent
 *                `{ ≡ }` note, typed.
 *   0.10 – 0.24  the note rides the nerve out to the hand and goes into it.
 *   0.24 – 0.38  the hand slides onto the page, clicks, and a new (accent) line
 *                appears on it; the hand slides back.
 *   0.38 – 0.50  the result (a small ink page) rides back up into the brain,
 *                whose folds light up (accent) as it arrives.
 *   0.52 – 0.68  a second note is written and rides out to the foot.
 *   0.68 – 0.80  the foot hops over to the globe (which lights up while it is
 *                searched) and hops back.
 *   0.80 – 0.90  that result rides back into the brain, which lights up again.
 * p = 0 is the whole cast at rest. t only adds a slowly turning globe, the
 * typing cursor and dots that flow while something travels.
 *
 * Layout: the hand and foot are hand-made bitmaps (small / medium, ×1 or ×2),
 * the largest set whose row fits the box (labelled layouts first); the page
 * and globe are sized to match, and the brain takes the rest (continuous
 * size, its folds drawn as curves; cached per size). Everything is solid, so
 * the scene writes cells straight into the raster (no 2D-context pass).
 */
import { easeInOut, range } from '../noise';
import type { Raster } from '../raster';
import type { Box, Scene } from './types';
import { blink } from './helpers';

type Mask = { w: number; h: number; m: Uint8Array };

// ── beats ────────────────────────────────────────────────────────────────
const NOTE1: [number, number] = [0.02, 0.1];
const OUT1: [number, number] = [0.1, 0.24];
const ACT1: [number, number] = [0.24, 0.38];
const BACK1: [number, number] = [0.38, 0.5];
const NOTE2: [number, number] = [0.52, 0.58];
const OUT2: [number, number] = [0.58, 0.68];
const ACT2: [number, number] = [0.68, 0.8];
const BACK2: [number, number] = [0.8, 0.9];
/** How long the brain's folds stay lit after a result arrives. */
const FLASH = 0.06;

const LABEL_HAND = 'DO';
const LABEL_FOOT = 'FETCH';

// ── bitmaps ──────────────────────────────────────────────────────────────
// Hands point up (the index finger is where the nerve plugs in); the boot
// faces right here and is mirrored to walk left, toward the globe. `#` = solid cell.

const HAND_S = [
  '...#......',
  '..###.....',
  '..###.....',
  '..###.##..',
  '..###.##.#',
  '..###.##.#',
  '#.########',
  '##.#######',
  '.##.######',
  '..########',
  '...######.',
  '..........',
  '...######.',
];
const HAND_M = [
  '...#.........',
  '..###........',
  '..###........',
  '..###........',
  '..###.##.....',
  '..###.##.##..',
  '..###.##.##.#',
  '..###.##.##.#',
  '..###########',
  '##.##########',
  '###.#########',
  '.###.########',
  '..###########',
  '...#########.',
  '....#######..',
  '.............',
  '....#######..',
];
/** The column the nerve enters (the index fingertip). */
const HAND_TIP = { s: 3, m: 3 };

const BOOT_S = [
  '.######...',
  '..........',
  '..####....',
  '..####....',
  '..####....',
  '..#####...',
  '..#######.',
  '..########',
  '..########',
  '..........',
  '..########',
];
const BOOT_M = [
  '.########....',
  '.########....',
  '.............',
  '..######.....',
  '..######.....',
  '..######.....',
  '..######.....',
  '..######.....',
  '..#######....',
  '..#########..',
  '..##########.',
  '..###########',
  '..###########',
  '.............',
  '..###########',
];
/** The cuff column (before mirroring) where the nerve plugs in. */
const BOOT_CUFF = { s: 3, m: 4 };

/** `{` and `}` in the 3×5 pixel-font style. */
const BRACE_OPEN = ['.##', '.#.', '##.', '.#.', '.##'];
const BRACE_CLOSE = ['##.', '.#.', '.##', '.#.', '##.'];

function fromRows(rows: string[]): Mask {
  const h = rows.length;
  const w = rows[0].length;
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = rows[y].charCodeAt(x) === 35 ? 1 : 0;
  return { w, h, m };
}

function scaled(a: Mask, q: number): Mask {
  if (q === 1) return a;
  const w = a.w * q;
  const h = a.h * q;
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = a.m[((y / q) | 0) * a.w + ((x / q) | 0)];
  return { w, h, m };
}

function mirrored(a: Mask): Mask {
  const m = new Uint8Array(a.w * a.h);
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) m[y * a.w + x] = a.m[y * a.w + (a.w - 1 - x)];
  return { w: a.w, h: a.h, m };
}

// ── a direct cell painter ────────────────────────────────────────────────
// Everything here is solid, so the scene writes cells straight into the
// raster instead of drawing on the 2D context (no begin() / commit(), which is
// most of a paint's cost). Writes follow painter's order: each one replaces
// both channels of the cell. An optional clip rectangle limits writes.

const CLEAR = 0;
const INKT = 1;
const ACCT = 2;
type Tone = typeof CLEAR | typeof INKT | typeof ACCT;

let R: Raster;
let cx0 = 0;
let cy0 = 0;
let cx1 = 0;
let cy1 = 0;

function target(r: Raster) {
  R = r;
  clip(0, 0, r.w, r.h);
}

/** Limit writes to x0 ≤ x < x1, y0 ≤ y < y1 (within the raster). */
function clip(x0: number, y0: number, x1: number, y1: number) {
  cx0 = Math.max(0, Math.round(x0));
  cy0 = Math.max(0, Math.round(y0));
  cx1 = Math.min(R.w, Math.round(x1));
  cy1 = Math.min(R.h, Math.round(y1));
}

/** Fill a rectangle of cells with a tone at strength v (CLEAR erases). */
function fill(x: number, y: number, w: number, h: number, tone: Tone, v = 1) {
  const xa = Math.max(cx0, Math.round(x));
  const ya = Math.max(cy0, Math.round(y));
  const xb = Math.min(cx1, Math.round(x) + Math.round(w));
  const yb = Math.min(cy1, Math.round(y) + Math.round(h));
  const { ink, acc, w: rw } = R;
  for (let yy = ya; yy < yb; yy++) {
    for (let i = yy * rw + xa, e = yy * rw + xb; i < e; i++) {
      ink[i] = tone === INKT ? v : 0;
      acc[i] = tone === ACCT ? v : 0;
    }
  }
}

/** Paint a mask's cells at (x, y). */
function stamp(a: Mask, x: number, y: number, tone: Tone) {
  for (let j = 0; j < a.h; j++) {
    let i = 0;
    while (i < a.w) {
      if (!a.m[j * a.w + i]) {
        i++;
        continue;
      }
      const s0 = i;
      while (i < a.w && a.m[j * a.w + i]) i++;
      fill(x + s0, y + j, i - s0, 1, tone);
    }
  }
}

/** Erase a mask's footprint grown by one cell (so it sits clear of what is behind it). */
function clearAround(a: Mask, x: number, y: number) {
  for (let j = 0; j < a.h; j++) {
    let i = 0;
    while (i < a.w) {
      if (!a.m[j * a.w + i]) {
        i++;
        continue;
      }
      const s0 = i;
      while (i < a.w && a.m[j * a.w + i]) i++;
      fill(x + s0 - 1, y + j - 1, i - s0 + 2, 3, CLEAR);
    }
  }
}

/** The label letters, in the page's 3×5 pixel font (see pixelText in helpers). */
const GLYPHS: Record<string, string> = {
  C: '011100100100011',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  H: '101101111101101',
  O: '010101101101010',
  T: '111010010010010',
};

/** A label centred on x, in the pixel font at scale q. */
function label(text: string, x: number, y: number, q: number) {
  const w = (text.length * 4 - 1) * q;
  let gx = Math.round(x - w / 2);
  for (const ch of text) {
    const bits = GLYPHS[ch];
    if (bits) for (let i = 0; i < 15; i++) if (bits[i] === '1') fill(gx + (i % 3) * q, y + Math.floor(i / 3) * q, q, q, INKT);
    gx += 4 * q;
  }
}

const SETS = {
  s: { hand: fromRows(HAND_S), boot: fromRows(BOOT_S) },
  m: { hand: fromRows(HAND_M), boot: fromRows(BOOT_M) },
};

// ── the brain (continuous size, cached) ──────────────────────────────────

type Brain = { w: number; h: number; body: Mask; folds: Mask; stemX: number; stemY: number };

let scratch: HTMLCanvasElement | null = null;
const brainCache = new Map<string, Brain>();

/**
 * The brain's folds, drawn as 1-cell curves (Catmull-Rom through these
 * points, in the brain's 0..1 box): the deep fold above the temporal lobe,
 * the central fold, and short curls in each lobe. Front is to the left.
 */
const FOLDS: { pts: [number, number][]; edge?: boolean }[] = [
  { pts: [[0.16, 0.62], [0.34, 0.56], [0.5, 0.52], [0.6, 0.46]], edge: true },
  { pts: [[0.54, 0.06], [0.5, 0.2], [0.52, 0.32], [0.47, 0.46]] },
  { pts: [[0.38, 0.1], [0.36, 0.24], [0.38, 0.34], [0.33, 0.5]] },
  { pts: [[0.08, 0.4], [0.16, 0.3], [0.24, 0.34], [0.22, 0.2]] },
  { pts: [[0.18, 0.12], [0.24, 0.2]] },
  { pts: [[0.12, 0.52], [0.22, 0.46], [0.28, 0.42]] },
  { pts: [[0.66, 0.1], [0.64, 0.22], [0.72, 0.3], [0.7, 0.42]] },
  { pts: [[0.84, 0.2], [0.8, 0.32], [0.88, 0.42]] },
  { pts: [[0.6, 0.56], [0.74, 0.5], [0.84, 0.56]] },
  { pts: [[0.28, 0.72], [0.4, 0.66], [0.54, 0.7]] },
];

const cr = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);

/**
 * A side-view brain in a w × h cell box: lobes, a cerebellum and a brainstem
 * as one solid silhouette, with 1-cell folds cut into it (kept off the
 * outline, so the silhouette stays whole) and fine stripes across the
 * cerebellum. Returns the solid cells and the fold cells separately, so the
 * folds can light up.
 */
function brain(w: number, h: number): Brain {
  const key = `${w}x${h}`;
  const hit = brainCache.get(key);
  if (hit) return hit;
  scratch ??= document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const g = scratch.getContext('2d', { willReadFrequently: true })!;
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#fff';
  const E = (u: number, v: number, rx: number, ry: number) => {
    g.beginPath();
    g.ellipse(u * w, v * h, rx * w, ry * h, 0, 0, Math.PI * 2);
    g.fill();
  };
  E(0.5, 0.42, 0.48, 0.36);
  E(0.27, 0.3, 0.24, 0.27);
  E(0.66, 0.3, 0.3, 0.28);
  E(0.33, 0.6, 0.26, 0.17);
  E(0.74, 0.76, 0.16, 0.13);
  // brainstem
  const s0 = Math.round(w * 0.52);
  const sw = Math.max(2, Math.round(w * 0.08));
  const st = Math.round(h * 0.68);
  g.fillRect(s0, st, sw, h - st);
  const d = g.getImageData(0, 0, w, h).data;
  const sil = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) sil[i] = d[i * 4 + 3] > 127 ? 1 : 0;

  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && sil[y * w + x] === 1;
  const deep = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!inside(x + dx, y + dy)) return false;
    return true;
  };
  const folds = new Uint8Array(w * h);
  for (const f of FOLDS) {
    const P = f.pts;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)];
      const p1 = P[i];
      const p2 = P[i + 1];
      const p3 = P[Math.min(P.length - 1, i + 2)];
      const n = Math.ceil(Math.hypot((p2[0] - p1[0]) * w, (p2[1] - p1[1]) * h) * 3) + 1;
      for (let k = 0; k <= n; k++) {
        const x = Math.floor(cr(p0[0], p1[0], p2[0], p3[0], k / n) * w);
        const y = Math.floor(cr(p0[1], p1[1], p2[1], p3[1], k / n) * h);
        if (f.edge ? inside(x, y) : deep(x, y)) folds[y * w + x] = 1;
      }
    }
  }
  // cerebellum stripes
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x++) {
      if ((y + 0.5) / h > 0.68 && (x + 0.5) / w > 0.64 && deep(x, y) && !(x >= s0 && x < s0 + sw)) folds[y * w + x] = 1;
    }
  }
  const body = sil.slice();
  for (let i = 0; i < w * h; i++) if (folds[i]) body[i] = 0;
  // where the nerve leaves: the stem's bottom
  const stemX = s0 + ((sw - 1) >> 1);
  let stemY = h - 1;
  while (stemY > 0 && !sil[stemY * w + stemX]) stemY--;
  const b: Brain = { w, h, body: { w, h, m: body }, folds: { w, h, m: folds }, stemX, stemY };
  if (brainCache.size > 16) brainCache.clear();
  brainCache.set(key, b);
  return b;
}

// ── layout ───────────────────────────────────────────────────────────────

type Layout = {
  q: number;
  hand: Mask;
  boot: Mask;
  tip: number;
  ankle: number;
  docW: number;
  docH: number;
  globeD: number;
  /** gaps: hand–page, globe–boot */
  g1: number;
  walk: number;
  rowW: number;
  labels: boolean;
  bw: number;
  bh: number;
  /** stem → junction, junction → hand top */
  t1: number;
  g2: number;
  H: number;
  availH: number;
};

const layoutCache = new Map<string, Layout>();

function layout(box: Box): Layout {
  const key = `${box.w.toFixed(1)}|${box.h.toFixed(1)}`;
  const hit = layoutCache.get(key);
  if (hit) return hit;
  const m = Math.max(2, Math.round(Math.min(box.w, box.h) * 0.05));
  const availW = Math.floor(box.w - 2 * m);
  const availH = Math.floor(box.h - 2 * m);
  let best: Layout | null = null;
  const tries: ['s' | 'm', number][] = [
    ['m', 2],
    ['s', 2],
    ['m', 1],
    ['s', 1],
  ];
  // labelled first (any set), then unlabelled; within each, the largest set that fits
  for (const labels of [true, false]) for (const [set, q] of tries) {
    if (best) break;
    const hand = scaled(SETS[set].hand, q);
    const boot = mirrored(scaled(SETS[set].boot, q));
    const docH = hand.h - 2 * q;
    const docW = Math.round(docH * 0.68);
    const globeD = Math.round(hand.h * 0.74) | 1;
    const min = hand.w + docW + globeD + boot.w;
    // gaps: the hand slides and the foot hops across them, so they get what is spare
    const spareW = availW - min;
    if (spareW < 6) continue;
    const g1 = Math.min(3 * q, Math.max(2, Math.floor(spareW * 0.25)));
    const walk = Math.min(6 * q, Math.max(3, Math.floor(spareW * 0.5)));
    const rowW = Math.min(availW, min + g1 + walk + Math.max(2, Math.round(spareW * 0.3)));
    const nh = 5 * q;
    const t1 = Math.ceil(nh / 2) + q;
    const g2 = Math.ceil(nh / 2) + 1 + q;
    const lab = labels ? 2 * q + 5 * q : 0;
    const fixed = t1 + g2 + hand.h + lab;
    const bhMax = availH - fixed;
    const bw = Math.min(Math.floor(bhMax / 0.7), Math.round(availW * 0.66), Math.round(rowW * 0.8));
    const bh = Math.round(bw * 0.7);
    if (bw < Math.max(24, rowW * 0.45)) continue;
    if (bh + fixed > availH) continue;
    best = {
      q,
      hand,
      boot,
      tip: HAND_TIP[set] * q,
      ankle: (boot.w - 1 - BOOT_CUFF[set] * q) - (q - 1),
      docW,
      docH,
      globeD,
      g1,
      walk,
      rowW,
      labels,
      bw,
      bh,
      t1,
      g2,
      H: bh + fixed,
      availH,
    };
  }
  if (!best) {
    // a narrow or tiny box: the small set and a brain no wider than in the
    // layouts above (the engine clips); labels if the height still has room
    const hand = SETS.s.hand;
    const boot = mirrored(SETS.s.boot);
    const docH = hand.h - 2;
    const t1 = 4;
    const g2 = 5;
    const fixed = t1 + g2 + hand.h;
    const bw = Math.max(16, Math.min(Math.floor((availH - fixed) / 0.7), Math.round(availW * 0.66)));
    const bh = Math.round(bw * 0.7);
    const labels = availH - (bh + fixed) >= 7;
    best = {
      q: 1,
      hand,
      boot,
      tip: HAND_TIP.s,
      ankle: boot.w - 1 - BOOT_CUFF.s,
      docW: Math.round(docH * 0.68),
      docH,
      globeD: Math.round(hand.h * 0.74) | 1,
      g1: 2,
      walk: 3,
      rowW: Math.min(availW, 46),
      labels,
      bw,
      bh,
      t1,
      g2,
      H: bh + fixed + (labels ? 7 : 0),
      availH,
    };
  }
  if (layoutCache.size > 32) layoutCache.clear();
  layoutCache.set(key, best);
  return best;
}

// ── pieces ───────────────────────────────────────────────────────────────

type Pt = [number, number];

/** Total length of an axis-aligned polyline. */
function plen(pts: Pt[]) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
  return s;
}

/** The point `d` cells along an axis-aligned polyline. */
function at(pts: Pt[], d: number): Pt {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const l = Math.abs(bx - ax) + Math.abs(by - ay);
    if (d <= l || i === pts.length - 1) {
      const f = l > 0 ? Math.max(0, Math.min(1, d / l)) : 0;
      return [ax + (bx - ax) * f, ay + (by - ay) * f];
    }
    d -= l;
  }
  return pts[0];
}

/**
 * A dotted axis-aligned path: q×q dots every 2q cells. `flow` slides the dots
 * along it (in cells; positive = from the first point to the last).
 */
function dotted(pts: Pt[], q: number, flow: number) {
  const len = plen(pts);
  const per = 2 * q;
  const off = ((flow % per) + per) % per;
  for (let d = off; d <= len; d += per) {
    const [x, y] = at(pts, d);
    fill(x, y, q, q, INKT);
  }
}

/** The request note: `{ ≡ }` in accent; `typed` 0..1 (the two rows, one after the other). */
function note(cx: number, cy: number, q: number, typed: number, t: number, cursor: boolean) {
  const w = 11 * q;
  const h = 5 * q;
  const x = Math.round(cx - w / 2);
  const y = Math.round(cy - h / 2);
  fill(x - q, y - q, w + 2 * q, h + 2 * q, CLEAR);
  for (let j = 0; j < 5; j++) {
    for (let i = 0; i < 3; i++) {
      if (BRACE_OPEN[j][i] === '#') fill(x + i * q, y + j * q, q, q, ACCT);
      if (BRACE_CLOSE[j][i] === '#') fill(x + (8 + i) * q, y + j * q, q, q, ACCT);
    }
  }
  const a = Math.round(3 * Math.min(1, typed * 2));
  const b = Math.round(2 * Math.max(0, Math.min(1, typed * 2 - 1)));
  if (a > 0) fill(x + 4 * q, y + q, a * q, q, ACCT);
  if (b > 0) fill(x + 4 * q, y + 3 * q, b * q, q, ACCT);
  if (cursor && typed < 1) {
    // a soft cursor after the last typed cell
    const kx = b > 0 ? x + (4 + b) * q : x + (4 + a) * q;
    const ky = b > 0 ? y + 3 * q : y + q;
    fill(kx, ky, q, q, ACCT, blink(t, 1.2, 0.62));
  }
}

/** The result: a little ink page (4 × 5 font pixels) with two text rows cut in. */
function result(cx: number, cy: number, q: number) {
  const w = 4 * q;
  const h = 5 * q;
  const x = Math.round(cx - w / 2);
  const y = Math.round(cy - h / 2);
  fill(x - q, y - q, w + 2 * q, h + 2 * q, CLEAR);
  fill(x, y, w, h, INKT);
  fill(x + q, y + q, 2 * q, q, CLEAR);
  fill(x + q, y + 3 * q, q, q, CLEAR);
}

/** A page: q-thick outline with a folded corner and ragged text rows; the last row is typed by `fresh`. */
function page(x: number, y: number, w: number, h: number, q: number, fresh: number) {
  const c = Math.max(2 * q, Math.round((w * 0.32) / q) * q);
  // outline, minus the folded corner
  fill(x, y, w - c, q, INKT);
  fill(x, y, q, h, INKT);
  fill(x, y + h - q, w, q, INKT);
  fill(x + w - q, y + c, q, h - c, INKT);
  // the fold: an L inside the corner and its diagonal edge
  fill(x + w - c, y, q, c, INKT);
  fill(x + w - c, y + c - q, c, q, INKT);
  for (let i = 0; i < c; i += q) fill(x + w - c + i, y + i, q, q, INKT);
  // text rows every other row below the fold; the last slot is the new line
  const ix = x + 2 * q;
  const iw = w - 4 * q;
  const ys: number[] = [];
  for (let ry = y + c + q; ry + q <= y + h - 2 * q; ry += 2 * q) ys.push(ry);
  for (let j = 0; j < ys.length; j++) {
    const lw = Math.max(q, Math.round((iw * (0.55 + 0.45 * (((j * 7 + 3) % 5) / 4))) / q) * q);
    if (j < ys.length - 1) fill(ix, ys[j], lw, q, INKT);
    else if (fresh > 0) fill(ix, ys[j], Math.max(q, Math.round((iw * fresh) / q) * q), q, ACCT);
  }
}

/** A wire globe: an outline ring, the equator, two latitudes and meridians that turn with `spin`. */
function globe(cx: number, cy: number, d: number, q: number, spin: number, tone: Tone) {
  const Rr = d / 2;
  const x0 = Math.round(cx - Rr);
  const y0 = Math.round(cy - Rr);
  const hq = q / 2;
  const lat = Rr * 0.52;
  const mer: number[] = [];
  for (let j = 0; j < 8; j++) {
    const lam = spin + (j * Math.PI) / 4;
    if (Math.cos(lam) > 0.2) mer.push(Math.sin(lam));
  }
  for (let y = 0; y < d; y++) {
    const vy = y + 0.5 - Rr;
    const half = Math.sqrt(Math.max(0, Rr * Rr - vy * vy));
    const band = Math.abs(vy) < hq || (d >= 11 * q && Math.abs(Math.abs(vy) - lat) < hq);
    for (let x = 0; x < d; x++) {
      const vx = x + 0.5 - Rr;
      const dist = Math.hypot(vx, vy);
      if (dist > Rr) continue;
      let on = band || dist > Rr - q;
      for (let j = 0; j < mer.length && !on; j++) if (Math.abs(vx - mer[j] * half) < hq) on = true;
      if (on) fill(x0 + x, y0 + y, 1, 1, tone);
    }
  }
}

const scene: Scene = {
  paint({ r, box, p, t }) {
    target(r);
    const L = layout(box);
    const { q, hand, boot } = L;
    const B = brain(L.bw, L.bh);

    // ── vertical stack: brain · stem → junction · row · labels
    const spare = Math.max(0, L.availH - L.H);
    const g2 = L.g2 + Math.floor(spare * 0.45);
    const top = Math.round(box.cy - (L.H + Math.floor(spare * 0.45)) / 2);
    const bx = Math.round(box.cx - L.bw / 2);
    const by = top;
    const stemX = bx + B.stemX;
    const stemY = by + B.stemY;
    const jy = stemY + L.t1;
    const ground = jy + g2 + hand.h; // one row below the bottom of every object

    // ── the row: hand · page … globe · boot (centred)
    const rowX = Math.round(box.cx - L.rowW / 2);
    const handX = rowX;
    const bootX = rowX + L.rowW - boot.w;
    const docX = handX + hand.w + L.g1;
    const globeX = bootX - L.walk - L.globeD;
    const handTop = ground - hand.h;
    const bootTop = ground - boot.h;
    const tipX = handX + L.tip;
    const ankleX = bootX + L.ankle;

    // story values
    const act1 = range(ACT1[0], ACT1[1], p);
    const act2 = range(ACT2[0], ACT2[1], p);
    const flash = (p >= BACK1[1] - 0.01 && p < BACK1[1] - 0.01 + FLASH) || (p >= BACK2[1] - 0.01 && p < BACK2[1] - 0.01 + FLASH);

    // ── the brain: solid; its folds light up as a result arrives
    stamp(B.body, bx, by, INKT);
    if (flash) stamp(B.folds, bx, by, ACCT);

    // ── nerves: stem → junction, then out to each limb
    const toHand: Pt[] = [
      [stemX, jy],
      [tipX, jy],
      [tipX, handTop - q],
    ];
    const toFoot: Pt[] = [
      [stemX, jy],
      [ankleX, jy],
      [ankleX, bootTop - q],
    ];
    const trunk: Pt[] = [
      [stemX, stemY + 1],
      [stemX, jy],
    ];
    const outHand = range(OUT1[0], OUT1[1], p);
    const outFoot = range(OUT2[0], OUT2[1], p);
    const backHand = range(BACK1[0], BACK1[1], p);
    const backFoot = range(BACK2[0], BACK2[1], p);
    const flow = Math.floor(t * 5) * q;
    const moving = (s: number) => s > 0 && s < 1;
    dotted(trunk, q, moving(backHand) || moving(backFoot) ? -flow : 0);
    dotted(toHand, q, moving(outHand) ? flow : moving(backHand) ? -flow : 0);
    dotted(toFoot, q, moving(outFoot) ? flow : moving(backFoot) ? -flow : 0);

    // ── the page, which the hand edits
    page(docX, ground - L.docH, L.docW, L.docH, q, range(ACT1[0] + 0.05, ACT1[0] + 0.1, p));

    // ── the globe, which the foot visits (lit while it is searched)
    const atGlobe = act2 > 0.38 && act2 < 0.62;
    globe(globeX + L.globeD / 2, ground - L.globeD / 2, L.globeD, q, t * 0.35 + p * 3, atGlobe ? ACCT : INKT);

    // ── the hand: slides onto the page, clicks, slides back
    const reach = Math.max(2 * q, L.g1 + Math.round(L.docW * 0.45));
    const slide = easeInOut(range(0, 0.3, act1)) * (1 - easeInOut(range(0.75, 1, act1)));
    const click = act1 > 0.32 && act1 < 0.48 ? q : 0;
    const hx = handX + Math.round(reach * slide);
    const hy = handTop + click;
    if (slide > 0) clearAround(hand, hx, hy);
    stamp(hand, hx, hy, INKT);
    if (click) {
      // a little click burst over the fingertip
      const fx = hx + L.tip;
      const fy = hy - 2 * q;
      fill(fx - 2 * q, fy - q, q, q, ACCT);
      fill(fx, fy - 2 * q, q, q, ACCT);
      fill(fx + 2 * q, fy - q, q, q, ACCT);
    }

    // ── the foot: hops over to the globe and back
    const go = easeInOut(range(0, 0.38, act2));
    const ret = easeInOut(range(0.62, 1, act2));
    const travel = go * (1 - ret);
    const hopPhase = act2 < 0.5 ? range(0, 0.38, act2) : range(0.62, 1, act2);
    const hop = hopPhase > 0 && hopPhase < 1 ? Math.round(Math.abs(Math.sin(hopPhase * Math.PI * 2)) * 2 * q) : 0;
    const sx = bootX - Math.round((L.walk + q) * travel);
    const sy = bootTop - hop;
    if (travel > 0) clearAround(boot, sx, sy);
    stamp(boot, sx, sy, INKT);
    if (hop > 0) {
      // motion ticks behind the heel (it walks left, then back right)
      const dir = act2 < 0.5 ? 1 : -1;
      const ex = dir > 0 ? sx + boot.w + q : sx - 3 * q;
      fill(ex, sy + Math.round(boot.h * 0.3), 2 * q, q, INKT);
      fill(ex + (dir > 0 ? q : 0), sy + Math.round(boot.h * 0.6), 2 * q, q, INKT);
    }

    // ── labels
    if (L.labels) {
      label(LABEL_HAND, handX + hand.w / 2, ground + 2 * q, q);
      // centred under the boot, but never past the row's right end
      const fw = (LABEL_FOOT.length * 4 - 1) * q;
      label(LABEL_FOOT, Math.min(bootX + boot.w / 2, rowX + L.rowW - fw / 2), ground + 2 * q, q);
    }

    // ── the requests: written under the stem, then out along a nerve into a limb
    const send = (span: [number, number], out: number, path: Pt[], limbTop: number) => {
      const typed = range(span[0], span[1], p);
      if (typed <= 0 || out >= 1) return;
      const [px, py] = at(path, easeInOut(out) * plen(path));
      clip(0, 0, r.w, limbTop);
      note(px, py, q, typed, t, out <= 0);
      clip(0, 0, r.w, r.h);
    };
    send(NOTE1, outHand, toHand, handTop);
    send(NOTE2, outFoot, toFoot, bootTop);

    // ── the results: out of the limb, back along the nerve, up into the brainstem
    const back = (s: number, path: Pt[], limbTop: number) => {
      if (s <= 0 || s >= 1) return;
      const full: Pt[] = [...path].reverse().concat([[stemX, stemY + 1]]);
      const [px, py] = at(full, easeInOut(s) * plen(full));
      clip(0, stemY + 1, r.w, limbTop);
      result(px, py, q);
      clip(0, 0, r.w, r.h);
    };
    back(backHand, toHand, handTop);
    back(backFoot, toFoot, bootTop);
  },
};

export default scene;
