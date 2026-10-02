/**
 * scaling — make it bigger, it gets better. Pixels fly in from every
 * direction and converge on the centre of the art box, where each one lands on
 * its own cell of a fixed target picture: a brain (two bumpy lobes, a centre
 * fissure, folds). The more pixels have arrived — the bigger the model — the
 * clearer the brain gets.
 *
 * The brain reads as a brain first: a solid ink silhouette (two bumpy lobes,
 * the fissure between them) cut by 1-cell meandering grooves — its folds,
 * different in each lobe, kept off the outline so the silhouette stays
 * whole, and ending short of the fissure so the midline stays one clean
 * line. While it builds, the halftone ghost shows the picture to come.
 *
 * Colour = intelligence, used sparingly. Sparks of the vivid palette
 * (Raster.col → VIVID: blue, violet, magenta) fire along the folds, like
 * neurons: none at GPT-1 / GPT-2, a handful of single cells by GPT-3, then
 * more and more sparks, each a dot or a tiny cluster along its fold (a few
 * run on into a short path) — at most SPARK_MAX of the brain's cells at the
 * frontier; the body stays ink.
 * A spark kindles as a small dot, then breathes slowly with t (a soft wave
 * running out from where it started).
 *
 * p is the RAW section progress (the scaling stage keeps its own timeline,
 * SCALING.phases):
 *   0 … growStart       the ghost of the picture to come — a fine-dot outline
 *                       of the brain over a faint body — with a sparse seed of
 *                       landed pixels, a few specks trickling in
 *   growStart … growEnd every target cell owns one particle with a hashed,
 *                       mostly random (mildly centre-first) arrival, so the
 *                       whole picture sharpens at once. It appears near the box
 *                       border on the ray through its target, flies in
 *                       (decelerating, paper-white accent with a short streak),
 *                       lands with a brief white glint, then settles to ink.
 *                       The ghost fades as the real pixels take over; a spark
 *                       fires in a fold once a cell beside it has landed.
 *   growEnd … copyOut   hold: the finished brain
 *   copyOut …           unclipped (no copy column any more): the brain
 *                       drifts to the centre of the screen and erodes cell
 *                       by cell (exact halftone steps, no dither
 *                       churn) into a light fog of fine dots behind the plateau
 *                       question (questionStart … questionEnd)
 *   chartZoom … chartZoomEnd  the fog dissolves — the DOM chart takes over;
 *                       nothing is painted after that
 *
 * The mini loss chart (DOM, layout.chartHole): the brain is laid out clear of
 * the chart's resting rect, and nothing is painted under the chart's current
 * rect while it is visible.
 *
 * t only drives ambient motion: a trickle of incoming specks while the brain
 * is unfinished, and the sparks' slow breathing. At t = 0 every frame reads.
 */
import { SCALING } from '../../content/sections';
import { VIVID } from '../color';
import { chartHole, type ViewRect } from '../layout';
import type { Raster } from '../raster';
import { clamp, easeInOut, hash2, lerp, range, smoothstep } from '../noise';
import type { Box, Scene } from './types';

const { growStart, growEnd, copyOut, questionStart, questionEnd, chartZoom, chartZoomEnd, chartOut, chartOutEnd } = SCALING.phases;

/** growth 0..1 across the milestones (ScalingSection drives its counters with it) */
export const growth = (p: number) => range(growStart, growEnd, p);

/** the mini chart's zoom 0..1 at p (ScalingSection drives the chart with it) */
export const chartZoomAt = (p: number) => smoothstep(chartZoom, chartZoomEnd, p);

/**
 * The mini chart's opacity at p, as in global.css (.scaling__chart): in with
 * the growth on desktop, with the zoom on mobile; out with the exit.
 */
export const chartVisAt = (p: number, mobile: boolean) =>
  (mobile ? range(chartZoom, chartZoom + 0.03, p) : range(growStart, growStart + 0.04, p)) * (1 - range(chartOut, chartOutEnd, p));

/** fraction of the brain already landed before growth starts */
const SEED = 0.05;
/** flight time of one particle, in arrival units (A runs SEED → 1 over the growth) */
const FLIGHT = 0.075;
/** how long a landed pixel glints (accent) before it settles to ink, in A units */
const GLINT = 0.025;
/** longest streak behind a flying pixel, in cells */
const STREAK = 6;
/** ambient specks trickling in while the brain is unfinished */
const TRICKLE = 12;
/** weight of the centre-first bias in the arrival order (0 = purely random) */
const BIAS = 0.25;
/** ghost of the picture to come: its outline (uniform small squares) and its body */
const GHOST_EDGE = 0.5;
const GHOST_BODY = 0.12;

// ── sparks (colour = intelligence) ──
/** growth at which the first spark kindles (GPT-2 → GPT-3) */
const SPARK_FROM = 0.18;
/** share of the brain's cells in colour at the frontier */
const SPARK_MAX = 0.075;
/** how the share ramps up from SPARK_FROM to the frontier (> 1 = slow start) */
const SPARK_POW = 1.3;
/** cells between spark starts along the folds; how far (cells) a spark runs on along its fold — most stay a tiny cluster, a few become a short path */
const SPARK_GAP = 7;
const SPARK_SPAN = 1;
const SPARK_LONG = 2;
const SPARK_LONG_SHARE = 0.3;
/** delay per cell as a spark runs along its fold (in start-time units, 0..1) */
const SPARK_RUN = 0.09;
/** a spark cell grows from a small dot to full over this many cells of the count */
const SPARK_KINDLE = 2.5;
/** breathing: depth (share of the value), period range in seconds, wave length in cells */
const TWINKLE = 0.26;
const TW_MIN = 3.6;
const TW_MAX = 6.4;
const TW_WAVE = 3;
/** number of vivid colour slots used (VIVID in color.ts) */
const SLOTS = VIVID.length;

// ── brain shape, in brain space (|n| ≈ 1 at the rim; y scaled by ASPECT) ──
const SIZE = 0.37; // half-width as a fraction of the box width
const ASPECT = 0.85;
/** lobes: centre ±LOBE_X, radii LOBE_RX × LOBE_RY; a lower bridge fills the bottom notch */
const LOBE_X = 0.42;
const LOBE_RX = 0.6;
const LOBE_RY = 0.9;
const BRIDGE_R = 0.55;
const BRIDGE_Y = 0.25;
/** rim bumps (gyri seen edge-on): amplitude and count */
const BUMP = 0.045;
const BUMPS = 11;
/** the fissure runs from the top down to this depth */
const FISSURE = 0.6;
/** no fold within this many cells of the fissure, so no groove runs alongside it */
const MIDLINE = 2;
/** folds: zero set of a narrow-band random wave field — wavenumber per cell for a brain WAVE_A cells wide (half); ∝ 1/√size */
const WAVES = 11;
const WAVE_K = 0.6;
const WAVE_A = 25;
const WAVE_SEED = 29;
/** brain extents in brain space (half-width, half-height), with the bumps */
const EXT_X = (LOBE_X + LOBE_RX) * (1 + BUMP);
const EXT_Y = LOBE_RY * (1 + BUMP);

// ── the mini chart ──
/** cells of air kept between the brain and the chart's resting rect */
const CHART_AIR = 1.5;
/** brain fit around the chart: smallest scale tried, and its step */
const FIT_MIN = 0.6;
const FIT_STEP = 0.025;

type Brain = {
  /** layout key (box, mobile) and the chart-hole key it was laid out around */
  key: string;
  hk: string;
  /** semi-axes, cells */
  a: number;
  b: number;
  /** particles (sorted by arrival): target offset from the brain centre, arrival key, flight start offset */
  n: number;
  tx: Int16Array;
  ty: Int16Array;
  k: Float32Array;
  /** 1 = the target is on the brain's outline or fissure (drawn as the ghost outline before it lands) */
  edge: Uint8Array;
  sx: Float32Array;
  sy: Float32Array;
  /** target mask over offsets gx…gx+gw, gy…gy+gh from the centre (for the scaled fog) */
  gx: number;
  gy: number;
  gw: number;
  gh: number;
  grid: Uint8Array;
  /** per grid cell: spark order (−1 = never a spark), colour slot, breathing phase (cycles) and period (s) */
  rank: Int32Array;
  slot: Uint8Array;
  phase: Float32Array;
  period: Float32Array;
  /** spark cells (fold cells) in firing order, and the arrival after which each may fire */
  spark: Int32Array;
  ready: Float32Array;
  /** the brain's centre, cells from the box centre (up / left to clear the chart) */
  ox: number;
  oy: number;
  /** box half extents, cells */
  hw: number;
  hh: number;
};

/** a rect in grid cells, half-open */
type Cells = { x0: number; y0: number; x1: number; y1: number };

let CACHE: Brain | null = null;

/** Brain-space distance: < 1 inside two bumpy lobes joined by a lower bridge. */
function lobeDist(nx: number, ny: number): number {
  const lx = (Math.abs(nx) - LOBE_X) / LOBE_RX;
  const ly = ny / LOBE_RY;
  const dl = Math.hypot(lx, ly) / (1 + BUMP * Math.sin(Math.atan2(ly, lx) * BUMPS + (nx < 0 ? 2.1 : 0.4)));
  const bx = nx / BRIDGE_R;
  const by = (ny - BRIDGE_Y) / BRIDGE_R;
  const db = Math.hypot(bx, by) / (1 + BUMP * Math.sin(Math.atan2(by, bx) * BUMPS * 0.8 + 1));
  return Math.min(dl, db);
}

/** The fissure's column (cells from the brain centre) in row dy: a gentle wave. */
const fissureAt = (dy: number) => Math.round(0.7 * Math.sin(dy * 0.33 + 0.5));

/** Distance from the brain centre (ox, oy from the box centre) to the box border along (c, s). */
function toBorder(c: number, s: number, hw: number, hh: number, ox: number, oy: number): number {
  const ex = c > 1e-6 ? (hw - ox) / c : c < -1e-6 ? (hw + ox) / -c : 1e9;
  const ey = s > 1e-6 ? (hh - oy) / s : s < -1e-6 ? (hh + oy) / -s : 1e9;
  return Math.min(ex, ey);
}

/** A viewport-fraction rect → grid cells, grown by `pad` cells (the grid spans the viewport). */
function toCells(v: ViewRect, full: Box, pad: number): Cells {
  return {
    x0: Math.floor(v.x * full.w - pad),
    y0: Math.floor(v.y * full.h - pad),
    x1: Math.ceil((v.x + v.w) * full.w + pad),
    y1: Math.ceil((v.y + v.h) * full.h + pad),
  };
}

/** True when a brain of half-width a centred on cell (cx, cy) keeps out of `h`. */
function clears(cx: number, cy: number, a: number, h: Cells): boolean {
  const b = a * ASPECT;
  for (let y = h.y0; y < h.y1; y++) {
    const dy = y - cy;
    if (Math.abs(dy) > EXT_Y * b + 1) continue;
    for (let x = h.x0; x < h.x1; x++) {
      const dx = x - cx;
      if (Math.abs(dx) > EXT_X * a + 1) continue;
      if (lobeDist(dx / a, dy / b) < 1) return false;
    }
  }
  return true;
}

/**
 * Size and place the brain so it keeps clear of the chart's resting rect:
 * the full size if a small nudge up / left (staying inside the box) clears
 * it, else a little smaller, and so on.
 */
function fit(box: Box, a0: number, oy0: number, hole: Cells | null): { a: number; ox: number; oy: number } {
  if (!hole) return { a: a0, ox: 0, oy: oy0 };
  for (let s = 1; s >= FIT_MIN - 1e-6; s -= FIT_STEP) {
    const a = a0 * s;
    const maxL = Math.max(0, Math.floor(box.w / 2 - EXT_X * a - 1));
    const maxU = Math.max(0, Math.floor(box.h / 2 + oy0 - EXT_Y * a * ASPECT - 1));
    const shifts: [number, number][] = [];
    for (let dx = 0; dx <= maxL; dx++) for (let dy = 0; dy <= maxU; dy++) shifts.push([dx, dy]);
    // smallest nudge first; up is cheaper than sideways (keeps it centred in the box)
    shifts.sort((p, q) => 1.6 * p[0] * p[0] + p[1] * p[1] - (1.6 * q[0] * q[0] + q[1] * q[1]));
    for (const [dx, dy] of shifts) {
      if (clears(Math.round(box.cx) - dx, Math.round(box.cy + oy0) - dy, a, hole)) return { a, ox: -dx, oy: oy0 - dy };
    }
  }
  return { a: a0 * FIT_MIN, ox: 0, oy: oy0 };
}

function build(box: Box, mobile: boolean, hole: Cells | null, key: string, hk: string): Brain {
  const a0 = Math.max(8, Math.min(box.w * SIZE, box.h * 0.46));
  const lift = mobile ? 0 : Math.round(box.h * 0.035);
  const { a, ox, oy } = fit(box, a0, -lift, hole);
  const b = a * ASPECT;
  const hw = box.w / 2 - 1;
  const hh = box.h / 2 - 1;
  const gx = -(Math.ceil(a) + 2);
  const gy = -(Math.ceil(b) + 2);
  const gw = -gx * 2 + 1;
  const gh = -gy * 2 + 1;
  const N = gw * gh;

  // inside mask; the fissure is a 1-cell wavy gap from the top down
  const inside = new Uint8Array(N);
  for (let j = 0; j < gh; j++) {
    const dy = gy + j;
    const fis = fissureAt(dy);
    for (let i = 0; i < gw; i++) {
      const dx = gx + i;
      if (dx === fis && dy / b < FISSURE) continue;
      if (lobeDist(dx / a, dy / b) < 1) inside[j * gw + i] = 1;
    }
  }
  const isIn = (i: number, j: number) => i >= 0 && j >= 0 && i < gw && j < gh && inside[j * gw + i] === 1;
  const deep = (c: number) => {
    const i = c % gw;
    const j = (c / gw) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (!isIn(i + di, j + dj)) return false;
    return true;
  };
  // folds: where a narrow-band random wave field (a sum of equal-length
  // waves in random directions) changes sign — its zero set is a labyrinth of
  // meandering lines, the look of brain folds. Not mirrored: each lobe folds
  // its own way. The folds widen a little with the brain (not in step), so
  // a big screen shows a brain with roomier folds, not a busier one.
  const kw = WAVE_K * Math.sqrt(WAVE_A / a);
  const wc = new Float32Array(WAVES);
  const ws = new Float32Array(WAVES);
  const wp = new Float32Array(WAVES);
  for (let q = 0; q < WAVES; q++) {
    const th = (q / WAVES) * Math.PI + (hash2(q, 1, WAVE_SEED) - 0.5) * 0.6;
    wc[q] = Math.cos(th) * kw;
    ws[q] = Math.sin(th) * kw;
    wp[q] = hash2(q, 2, WAVE_SEED) * Math.PI * 2;
  }
  const side = new Uint8Array(N);
  for (let j = 0; j < gh; j++) {
    const Y = gy + j + 1.3;
    for (let i = 0; i < gw; i++) {
      const X = gx + i + 3.1;
      let w = 0;
      for (let q = 0; q < WAVES; q++) w += Math.cos(X * wc[q] + Y * ws[q] + wp[q]);
      side[j * gw + i] = w > 0 ? 1 : 0;
    }
  }
  // a fold cell is where the sign flips across its right or lower edge; it
  // keeps a whole ring of brain around it, so the outline and the fissure
  // stay unbroken, and it keeps off the fissure's sides, so the folds end at
  // the midline instead of doubling it
  const fold = new Uint8Array(N);
  for (let j = 0; j < gh - 1; j++) {
    const dy = gy + j;
    const fis = fissureAt(dy);
    const mid = dy / b < FISSURE + 0.08;
    for (let i = 0; i < gw - 1; i++) {
      const idx = j * gw + i;
      if (mid && Math.abs(gx + i - fis) <= MIDLINE) continue;
      if (side[idx + 1] !== side[idx] || side[idx + gw] !== side[idx]) fold[idx] = deep(idx) ? 1 : 0;
    }
  }

  // target: everything inside but the folds; the rim (next to the outside or
  // the fissure) is the ghost's outline
  const grid = new Uint8Array(N);
  const rims = new Uint8Array(N);
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const idx = j * gw + i;
      if (!inside[idx] || fold[idx]) continue;
      grid[idx] = 1;
      if (!isIn(i - 1, j) || !isIn(i + 1, j) || !isIn(i, j - 1) || !isIn(i, j + 1)) rims[idx] = 1;
    }
  }

  // particles, one per inked target cell; arrival order mostly random (so the
  // whole picture sharpens at once, like a photo gaining pixels) with a mild
  // centre-first bias, so the seed sits in the middle
  const cells: number[] = [];
  for (let idx = 0; idx < N; idx++) if (grid[idx]) cells.push(idx);
  const n = cells.length;
  const raw = new Float32Array(n);
  for (let q = 0; q < n; q++) {
    const i = cells[q] % gw;
    const j = (cells[q] / gw) | 0;
    raw[q] = (1 - BIAS) * hash2(i, j, 17) + BIAS * clamp(Math.hypot((gx + i) / a, (gy + j) / b));
  }
  const order = Array.from({ length: n }, (_, q) => q).sort((x, y) => raw[x] - raw[y]);
  const tx = new Int16Array(n);
  const ty = new Int16Array(n);
  const k = new Float32Array(n);
  const edge = new Uint8Array(n);
  const sx = new Float32Array(n);
  const sy = new Float32Array(n);
  const kAt = new Float32Array(N);
  const seedN = Math.round(n * SEED);
  for (let r = 0; r < n; r++) {
    const idx = cells[order[r]];
    const i = idx % gw;
    const j = (idx / gw) | 0;
    const dx = gx + i;
    const dy = gy + j;
    tx[r] = dx;
    ty[r] = dy;
    edge[r] = rims[idx];
    // seed pixels are there from the start; the rest arrive evenly over A
    k[r] = r < seedN ? (r / seedN) * SEED : SEED + FLIGHT + ((r - seedN) / Math.max(1, n - seedN)) * (1 - SEED - FLIGHT);
    kAt[idx] = k[r];
    // flight starts near the box border, on (roughly) the ray from the centre through the target
    const th = Math.atan2(dy, dx) + (hash2(i, j, 23) - 0.5) * 0.5;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const D = toBorder(c, s, hw, hh, ox, oy) * (0.9 + 0.1 * hash2(i, j, 29));
    sx[r] = c * D;
    sy[r] = s * D;
  }

  const sp = sparks(fold, grid, gw, gh, N, kAt);
  return { key, hk, a, b, n, tx, ty, k, edge, sx, sy, gx, gy, gw, gh, grid, ...sp, ox, oy, hw, hh };
}

/**
 * Where and when the sparks fire. Spark starts sit on the fold cells about
 * SPARK_GAP apart (hashed), each with a hashed start time; a spark runs on
 * along its fold (8-connected) SPARK_SPAN cells each way (SPARK_LONG for
 * SPARK_LONG_SHARE of them), one cell per SPARK_RUN of time — so the first
 * sparks are single cells and later ones grow into tiny clusters, a few
 * into short paths, with dark gaps left between them. Each spark keeps
 * one colour, and breathes as a wave out from its start. A fold cell may
 * fire once a brain cell beside it has landed (`ready`).
 */
function sparks(fold: Uint8Array, grid: Uint8Array, gw: number, gh: number, N: number, kAt: Float32Array) {
  const rank = new Int32Array(N).fill(-1);
  const slot = new Uint8Array(N);
  const phase = new Float32Array(N);
  const period = new Float32Array(N);
  const when = new Float32Array(N);
  const cells: number[] = [];
  for (let c = 0; c < N; c++) if (fold[c]) cells.push(c);
  // starts: in hashed order, each at least ~0.7 SPARK_GAP from the others
  const order = cells.slice().sort((x, y) => hash2(x, 0, 51) - hash2(y, 0, 51));
  const starts: number[] = [];
  const sep = (0.7 * SPARK_GAP) ** 2;
  for (const c of order) {
    const i = c % gw;
    const j = (c / gw) | 0;
    if (starts.every((o) => ((o % gw) - i) ** 2 + (((o / gw) | 0) - j) ** 2 >= sep)) starts.push(c);
  }
  // run along the folds from every start at once
  const from = new Int32Array(N).fill(-1);
  const dist = new Uint8Array(N);
  const queue = new Int32Array(N);
  const span = starts.map((_, s) => (hash2(s, 6, 67) < SPARK_LONG_SHARE ? SPARK_LONG : SPARK_SPAN));
  let head = 0;
  let tail = 0;
  starts.forEach((c, s) => {
    from[c] = s;
    queue[tail++] = c;
  });
  while (head < tail) {
    const c = queue[head++];
    if (dist[c] >= span[from[c]]) continue;
    const i = c % gw;
    const j = (c / gw) | 0;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue;
        const d = jj * gw + ii;
        if (!fold[d] || from[d] >= 0) continue;
        from[d] = from[c];
        dist[d] = dist[c] + 1;
        queue[tail++] = d;
      }
    }
  }
  const sites: number[] = [];
  for (const c of cells) {
    const s = from[c];
    if (s < 0) continue;
    const d = dist[c];
    sites.push(c);
    when[c] = hash2(s, 1, 57) + d * SPARK_RUN + hash2(c, 2, 59) * 0.01;
    slot[c] = 1 + Math.min(SLOTS - 1, Math.floor(hash2(s, 3, 61) * SLOTS));
    period[c] = lerp(TW_MIN, TW_MAX, hash2(s, 4, 63));
    phase[c] = hash2(s, 5, 65) - d / TW_WAVE;
  }
  sites.sort((x, y) => when[x] - when[y]);
  const spark = Int32Array.from(sites);
  const ready = new Float32Array(spark.length);
  for (let r = 0; r < spark.length; r++) {
    const c = spark[r];
    rank[c] = r;
    // once a brain cell beside it has landed
    const i = c % gw;
    const j = (c / gw) | 0;
    let k1 = 2;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const ii = i + di;
        const jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < gw && jj < gh && grid[jj * gw + ii]) k1 = Math.min(k1, kAt[jj * gw + ii]);
      }
    }
    ready[r] = k1 + GLINT;
  }
  return { rank, slot, phase, period, spark, ready };
}

/** sparks lit at growth g (a float count of cells, in firing order): none before SPARK_FROM, SPARK_MAX of the brain at the frontier */
const lit = (g: number, n: number, max: number) => Math.min(max, SPARK_MAX * n * range(SPARK_FROM, 1, g) ** SPARK_POW);

/** max-blend one cell; an ink write with a colour slot also tags the cell's colour */
function put(r: Raster, x: number, y: number, val: number, acc: boolean, slot = 0) {
  if (val <= 0.01 || x < 0 || y < 0 || x >= r.w || y >= r.h) return;
  const i = y * r.w + x;
  const ch = acc ? r.acc : r.ink;
  if (val > ch[i]) {
    ch[i] = val > 1 ? 1 : val;
    if (!acc) r.col[i] = slot;
  }
}

/**
 * A flying pixel: a head at (hx, hy) and a fading streak back toward (bx, by),
 * in paper-white accent.
 */
function streak(r: Raster, hx: number, hy: number, bx: number, by: number, alpha: number, solidHead: boolean) {
  const dx = bx - hx;
  const dy = by - hy;
  const d = Math.hypot(dx, dy);
  const len = Math.min(STREAK, d);
  for (let s = 1; s <= len; s++) {
    const fall = 1 - (s - 1) / STREAK;
    put(r, Math.round(hx + (dx / d) * s), Math.round(hy + (dy / d) * s), alpha * (0.3 + 0.5 * fall), true);
  }
  // the head shows even over landed ink, so the pixel visibly reaches its cell
  const x = Math.round(hx);
  const y = Math.round(hy);
  if (solidHead && x >= 0 && y >= 0 && x < r.w && y < r.h) {
    const i = y * r.w + x;
    r.ink[i] = 0;
    r.acc[i] = alpha;
    r.col[i] = 0;
  } else put(r, x, y, alpha, true);
}

/**
 * Clear every cell under the chart (viewport fractions → cells, touching
 * cells included) — or, while the chart fades in, fade them out in step.
 */
function unpaint(r: Raster, v: ViewRect, vis: number, full: Box) {
  const h = toCells(v, full, 0.5);
  const keep = vis >= 0.999 ? 0 : 1 - vis;
  const x0 = Math.max(0, h.x0);
  const x1 = Math.min(r.w, h.x1);
  for (let y = Math.max(0, h.y0); y < Math.min(r.h, h.y1); y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * r.w + x;
      r.ink[i] *= keep;
      r.acc[i] *= keep;
      if (!keep) r.col[i] = 0;
    }
  }
}

const TAU = Math.PI * 2;

const scene: Scene = {
  // the copy column has left: the brain may drift to the centre of the screen
  unclipped: (p) => p >= copyOut,

  paint({ r, box, full, p, t, mobile }) {
    if (p >= chartZoomEnd) return;
    // mobile shows the chart only for the closing zoom: no corner to keep clear
    const hole = chartHole.rest && !mobile ? toCells(chartHole.rest, full, CHART_AIR) : null;
    const hk = hole ? `${hole.x0},${hole.y0},${hole.x1},${hole.y1}` : '-';
    const key = `${Math.round(box.w * 4)}:${Math.round(box.h * 4)}:${Math.round(box.x * 4)}:${Math.round(box.y * 4)}:${mobile ? 1 : 0}`;
    // a re-measured chart (it is measured again as the zoom starts) only
    // re-lays the brain while it still sits in its box — never mid-fog
    if (!CACHE || CACHE.key !== key || (CACHE.hk !== hk && p < copyOut)) CACHE = build(box, mobile, hole, key, hk);
    const B = CACHE;
    const { gx, gy, gw, rank, slot, phase, period, spark, ready } = B;

    const g = growth(p);
    // arrival front: SEED → 1 (+ the last glint) over the growth
    const A = SEED + (1 + GLINT - SEED) * clamp(g / 0.97);
    // sparks lit so far (fold cells with rank < S fire)
    const S = lit(g, B.n, spark.length);

    // ending beats
    const drift = easeInOut(range(copyOut + 0.005, questionStart + 0.06, p));
    const erode = easeInOut(range(questionStart - 0.01, questionEnd - 0.03, p));
    const fade = 1 - range(chartZoom, chartZoomEnd, p);

    const cx = Math.round(lerp(box.cx + B.ox, full.cx, drift));
    const cy = Math.round(lerp(box.cy + B.oy, full.cy, drift));

    // ── the brain ────────────────────────────────────────────────────────
    if (erode > 0) {
      // the finished brain, a little larger, eroding into a light fog. Each
      // cell drops out or steps down the halftone levels (1 → ¾ → ½ → ¼, all
      // exact levels, so no dither churn) at its own hashed moment — a clean
      // dissolve. Sparks keep their colour. The chart's zoom then dissolves
      // the rest.
      const sc = 1 + 0.3 * erode;
      const gone = 0.5 * erode + 0.5 * (1 - fade);
      const x0 = Math.max(0, Math.floor(cx + gx * sc));
      const x1 = Math.min(r.w, Math.ceil(cx + (gx + gw) * sc));
      const y0 = Math.max(0, Math.floor(cy + gy * sc));
      const y1 = Math.min(r.h, Math.ceil(cy + (gy + B.gh) * sc));
      for (let y = y0; y < y1; y++) {
        const j = Math.round((y - cy) / sc) - gy;
        if (j < 0 || j >= B.gh) continue;
        for (let x = x0; x < x1; x++) {
          const i = Math.round((x - cx) / sc) - gx;
          if (i < 0 || i >= gw) continue;
          const gi = j * gw + i;
          const on = rank[gi] >= 0 && rank[gi] < S;
          if (!B.grid[gi] && !on) continue;
          if (hash2(i, j, 41) < gone) continue;
          const step = Math.floor(erode * 3.9 - hash2(i, j, 43) * 0.9);
          put(r, x, y, step <= 0 ? 1 : step === 1 ? 0.75 : step === 2 ? 0.5 : 0.25, false, on ? slot[gi] : 0);
        }
      }
    } else {
      // a ghost of the picture to come (a fine-dot outline over a faint
      // body); landed pixels glint, then settle to ink
      const ghost = 1 - smoothstep(0.3, 0.85, g);
      const { n, tx, ty, k, edge, sx, sy } = B;
      for (let q = 0; q < n; q++) {
        const kq = k[q];
        const x = cx + tx[q];
        const y = cy + ty[q];
        if (A >= kq) put(r, x, y, 1, kq >= SEED && A - kq < GLINT);
        else if (ghost > 0) put(r, x, y, (edge[q] ? GHOST_EDGE : GHOST_BODY) * ghost, false);
      }
      // sparks fire in the folds: each kindles as a small dot, then breathes
      // (a slow wave out from where it started)
      const top = Math.ceil(S);
      for (let q = 0; q < top; q++) {
        if (A < ready[q]) continue;
        const gi = spark[q];
        const kin = Math.min(1, (S - q) / SPARK_KINDLE);
        const tw = 0.5 + 0.5 * Math.cos(TAU * (t / period[gi] + phase[gi]));
        const v = (0.45 + 0.55 * kin) * (1 - TWINKLE * (1 - tw));
        put(r, cx + gx + (gi % gw), cy + gy + ((gi / gw) | 0), v, false, slot[gi]);
      }
      // in flight: from the border toward the target, decelerating
      for (let q = 0; q < n; q++) {
        const f = (A - k[q] + FLIGHT) / FLIGHT;
        if (f <= 0 || f >= 1) continue;
        const e = 1 - (1 - f) * (1 - f);
        const fb = Math.max(0, f - 0.2);
        const eb = 1 - (1 - fb) * (1 - fb);
        streak(
          r,
          cx + lerp(sx[q], tx[q], e),
          cy + lerp(sy[q], ty[q], e),
          cx + lerp(sx[q], tx[q], eb),
          cy + lerp(sy[q], ty[q], eb),
          0.45 + 0.55 * smoothstep(0, 0.18, f),
          true,
        );
      }
    }

    // ── ambient trickle: a few specks keep streaming in while it grows ────
    const trickle = 1 - range(growEnd - 0.06, growEnd, p);
    if (trickle > 0 && t > 0) {
      for (let m = 0; m < TRICKLE; m++) {
        const th = ((m + hash2(m, 3, 61)) / TRICKLE) * Math.PI * 2;
        const per = 2.8 + 1.8 * hash2(m, 5, 61);
        const ph = (t / per + hash2(m, 7, 61)) % 1;
        const c = Math.cos(th);
        const s = Math.sin(th);
        const D = toBorder(c, s, B.hw, B.hh, B.ox, B.oy) * 0.97;
        // they fade out at the brain's rim
        const rim = 0.92 / Math.hypot(c / B.a, s / B.b);
        if (D <= rim + 2) continue;
        const d = lerp(D, rim, ph * ph);
        const d0 = lerp(D, rim, Math.max(0, ph - 0.14) ** 2);
        const al = 0.55 * trickle * smoothstep(0, 0.15, ph) * (1 - smoothstep(0.85, 1, ph));
        streak(r, cx + c * d, cy + s * d, cx + c * d0, cy + s * d0, al, false);
      }
    }

    // ── never under the mini chart while it shows ────────────────────────
    // (its rect and opacity for this p, so the hole and the chart move together)
    const vis = chartVisAt(p, mobile);
    const { rest, zoom } = chartHole;
    if (vis > 0 && rest && zoom) {
      const z = chartZoomAt(p);
      const v = { x: lerp(rest.x, zoom.x, z), y: lerp(rest.y, zoom.y, z), w: lerp(rest.w, zoom.w, z), h: lerp(rest.h, zoom.h, z) };
      unpaint(r, v, vis, full);
    }
  },
};

export default scene;
