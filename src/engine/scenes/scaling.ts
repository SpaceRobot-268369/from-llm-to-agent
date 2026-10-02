/**
 * scaling — make it bigger, it gets better. Pixels fly in from every
 * direction and converge on the centre of the art box, where each one lands on
 * its own cell of a fixed target picture: a brain (two bumpy lobes, a centre
 * fissure, meandering folds). The more pixels have arrived — the bigger the
 * model — the clearer the brain gets.
 *
 * Colour = intelligence. Every fold of the brain (a patch between grooves)
 * owns one colour of the fixed vivid palette (Raster.col → VIVID). A small
 * model is plain ink; as the parameters grow, more incoming pixels arrive in
 * colour and more of the landed folds light up, fold by fold, until the
 * frontier brain is a full multi-colour map. The rim stays ink, so the
 * silhouette holds on any background.
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
 *                       The ghost fades as the real pixels take over.
 *   growEnd … copyOut   hold: the finished brain
 *   copyOut …           unclipped (no copy column any more): the brain
 *                       drifts to the centre of the screen and erodes cell
 *                       by cell (exact halftone steps, no dither
 *                       churn) into a light fog of fine dots behind the plateau
 *                       question (questionStart … questionEnd)
 *   chartZoom … chartZoomEnd  the fog dissolves — the DOM chart takes over;
 *                       nothing is painted after that
 *
 * t only drives ambient motion: a trickle of incoming specks while the brain
 * is unfinished.
 * At t = 0 every frame reads.
 */
import { SCALING } from '../../content/sections';
import { VIVID } from '../color';
import type { Raster } from '../raster';
import { clamp, easeInOut, hash2, lerp, range, smoothstep } from '../noise';
import type { Box, Scene } from './types';

const { growStart, growEnd, copyOut, questionStart, questionEnd, chartZoom, chartZoomEnd } = SCALING.phases;

/** growth 0..1 across the milestones (ScalingSection drives its counters with it) */
export const growth = (p: number) => range(growStart, growEnd, p);

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
/** colourfulness ramps over this span of growth (milestone 1 → frontier), eased in */
const COLOR_FROM = 0.1;
const COLOR_TO = 0.96;
/** how much a fold lights up as one piece (vs cell by cell) */
const COLOR_GROUP = 0.6;
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
/** folds: zero set of a narrow-band random wave field (wavenumber per cell) */
const WAVES = 11;
const WAVE_K = 0.66;
const WAVE_SEED = 13;

type Brain = {
  key: string;
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
  /** per grid cell: vivid colour slot (0 = stays ink: the rim) and the colourfulness at which it lights up */
  slot: Uint8Array;
  hue: Float32Array;
  /** per particle: its grid cell */
  cell: Int32Array;
  /** the brain sits this many cells above the box centre (clears the DOM chart) */
  lift: number;
  /** box half extents, cells */
  hw: number;
  hh: number;
};

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

/** Distance from the brain centre (lift above the box centre) to the box border along (c, s). */
function toBorder(c: number, s: number, hw: number, hh: number, lift: number): number {
  const ex = Math.abs(c) > 1e-6 ? hw / Math.abs(c) : 1e9;
  const ey = s > 1e-6 ? (hh + lift) / s : s < -1e-6 ? (hh - lift) / -s : 1e9;
  return Math.min(ex, ey);
}

function build(box: Box, mobile: boolean, key: string): Brain {
  const a = Math.max(8, Math.min(box.w * SIZE, box.h * 0.46));
  const b = a * ASPECT;
  const lift = mobile ? 0 : Math.round(box.h * 0.035);
  const hw = box.w / 2 - 1;
  const hh = box.h / 2 - 1;
  const gx = -(Math.ceil(a) + 2);
  const gy = -(Math.ceil(b) + 2);
  const gw = -gx * 2 + 1;
  const gh = -gy * 2 + 1;

  // inside mask; the fissure is a 1-cell wavy gap from the top down
  const inside = new Uint8Array(gw * gh);
  for (let j = 0; j < gh; j++) {
    const dy = gy + j;
    const fis = Math.round(0.7 * Math.sin(dy * 0.33 + 0.5));
    for (let i = 0; i < gw; i++) {
      const dx = gx + i;
      if (dx === fis && dy / b < FISSURE) continue;
      if (lobeDist(dx / a, dy / b) < 1) inside[j * gw + i] = 1;
    }
  }
  // folds: the sign of a narrow-band random wave field (a sum of equal-length
  // waves in random directions) — its zero set is a labyrinth of meandering
  // lines, the look of brain folds. Mirrored, so the lobes echo each other.
  const wc = new Float32Array(WAVES);
  const ws = new Float32Array(WAVES);
  const wp = new Float32Array(WAVES);
  for (let q = 0; q < WAVES; q++) {
    const th = (q / WAVES) * Math.PI + (hash2(q, 1, WAVE_SEED) - 0.5) * 0.6;
    wc[q] = Math.cos(th) * WAVE_K;
    ws[q] = Math.sin(th) * WAVE_K;
    wp[q] = hash2(q, 2, WAVE_SEED) * Math.PI * 2;
  }
  const side = new Uint8Array(gw * gh);
  for (let j = 0; j < gh; j++) {
    const Y = gy + j + 1.3;
    for (let i = 0; i < gw; i++) {
      const X = Math.abs(gx + i) + 3.1;
      let w = 0;
      for (let q = 0; q < WAVES; q++) w += Math.cos(X * wc[q] + Y * ws[q] + wp[q]);
      side[j * gw + i] = w > 0 ? 1 : 0;
    }
  }
  // target: a solid 1-cell rim, solid mass, 1-cell grooves where the fold
  // field changes sign across a cell edge
  const grid = new Uint8Array(gw * gh);
  const rims = new Uint8Array(gw * gh);
  const out = (i: number, j: number) => i < 0 || j < 0 || i >= gw || j >= gh || !inside[j * gw + i];
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const idx = j * gw + i;
      if (!inside[idx]) continue;
      const rim = out(i - 1, j) || out(i + 1, j) || out(i, j - 1) || out(i, j + 1);
      const groove =
        !rim &&
        ((inside[idx + 1] && side[idx + 1] !== side[idx]) || (inside[idx + gw] && side[idx + gw] !== side[idx]));
      if (!groove) grid[idx] = 1;
      if (rim) rims[idx] = 1;
    }
  }

  const { slot, hue } = colourFolds(grid, rims, inside, gw, gh);

  // particles, one per inked target cell; arrival order mostly random (so the
  // whole picture sharpens at once, like a photo gaining pixels) with a mild
  // centre-first bias, so the seed sits in the middle
  const cells: number[] = [];
  for (let idx = 0; idx < grid.length; idx++) if (grid[idx]) cells.push(idx);
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
  const cell = new Int32Array(n);
  const seedN = Math.round(n * SEED);
  for (let rank = 0; rank < n; rank++) {
    const idx = cells[order[rank]];
    const i = idx % gw;
    const j = (idx / gw) | 0;
    const dx = gx + i;
    const dy = gy + j;
    tx[rank] = dx;
    ty[rank] = dy;
    edge[rank] = rims[idx];
    cell[rank] = idx;
    // seed pixels are there from the start; the rest arrive evenly over A
    k[rank] =
      rank < seedN ? (rank / seedN) * SEED : SEED + FLIGHT + ((rank - seedN) / Math.max(1, n - seedN)) * (1 - SEED - FLIGHT);
    // flight starts near the box border, on (roughly) the ray from the centre through the target
    const th = Math.atan2(dy, dx) + (hash2(i, j, 23) - 0.5) * 0.5;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const D = toBorder(c, s, hw, hh, lift) * (0.9 + 0.1 * hash2(i, j, 29));
    sx[rank] = c * D;
    sy[rank] = s * D;
  }

  return { key, a, b, n, tx, ty, k, edge, sx, sy, gx, gy, gw, gh, grid, slot, hue, cell, lift, hw, hh };
}

/**
 * Give every fold its colour. Folds are the 4-connected patches of inked,
 * non-rim cells (grooves separate them). Greedy colouring keeps folds that
 * face each other across a groove in different colours. Each cell's `hue` is
 * the colourfulness at which it lights up: mostly its fold's (so folds light
 * up as pieces), partly its own (a ragged pixel front inside the fold).
 */
function colourFolds(grid: Uint8Array, rims: Uint8Array, inside: Uint8Array, gw: number, gh: number) {
  const N = gw * gh;
  const label = new Int32Array(N).fill(-1);
  const queue = new Int32Array(N);
  let folds = 0;
  for (let s0 = 0; s0 < N; s0++) {
    if (!grid[s0] || rims[s0] || label[s0] >= 0) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = s0;
    label[s0] = folds;
    while (head < tail) {
      const c = queue[head++];
      const i = c % gw;
      const nb = [i > 0 ? c - 1 : -1, i < gw - 1 ? c + 1 : -1, c - gw, c + gw];
      for (const d of nb) {
        if (d < 0 || d >= N || !grid[d] || rims[d] || label[d] >= 0) continue;
        label[d] = folds;
        queue[tail++] = d;
      }
    }
    folds++;
  }
  // folds that meet across a groove cell are neighbours
  const near: Set<number>[] = Array.from({ length: folds }, () => new Set<number>());
  for (let c = 0; c < N; c++) {
    if (!inside[c] || grid[c]) continue;
    const i = c % gw;
    const ids: number[] = [];
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const ii = i + di;
        const d = c + dj * gw + di;
        if (ii < 0 || ii >= gw || d < 0 || d >= N || label[d] < 0) continue;
        if (!ids.includes(label[d])) ids.push(label[d]);
      }
    }
    for (const x of ids) for (const y of ids) if (x !== y) near[x].add(y);
  }
  const colour = new Int8Array(folds).fill(-1);
  for (let f = 0; f < folds; f++) {
    const start = Math.floor(hash2(f, 1, 71) * SLOTS);
    let pick = start;
    for (let o = 0; o < SLOTS; o++) {
      const c = (start + o) % SLOTS;
      let clash = false;
      for (const g of near[f]) if (colour[g] === c) clash = true;
      if (!clash) {
        pick = c;
        break;
      }
    }
    colour[f] = pick;
  }
  const slot = new Uint8Array(N);
  const hue = new Float32Array(N);
  for (let c = 0; c < N; c++) {
    const f = label[c];
    if (f < 0) continue;
    slot[c] = colour[f] + 1;
    hue[c] = COLOR_GROUP * hash2(f, 2, 73) + (1 - COLOR_GROUP) * hash2(c % gw, (c / gw) | 0, 79);
  }
  return { slot, hue };
}

/** colourfulness 0..1 at growth g: plain ink at the first milestone, a full colour map at the frontier */
const colourful = (g: number) => smoothstep(COLOR_FROM, COLOR_TO, g) ** 1.25;

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

/** overwrite one cell (things drawn on top of the brain) */
function over(r: Raster, x: number, y: number, ink: number, acc: number, slot = 0) {
  if (x < 0 || y < 0 || x >= r.w || y >= r.h) return;
  const i = y * r.w + x;
  r.ink[i] = ink;
  r.acc[i] = acc;
  r.col[i] = slot;
}

/**
 * A flying pixel: a head at (hx, hy) and a fading streak back toward (bx, by),
 * in paper-white accent — or, with a colour slot, in that vivid colour.
 */
function streak(r: Raster, hx: number, hy: number, bx: number, by: number, alpha: number, solidHead: boolean, slot = 0) {
  const dx = bx - hx;
  const dy = by - hy;
  const d = Math.hypot(dx, dy);
  const len = Math.min(STREAK, d);
  const acc = slot === 0;
  for (let s = 1; s <= len; s++) {
    const fall = 1 - (s - 1) / STREAK;
    put(r, Math.round(hx + (dx / d) * s), Math.round(hy + (dy / d) * s), alpha * (0.3 + 0.5 * fall), acc, slot);
  }
  // the head shows even over landed ink, so the pixel visibly reaches its cell
  const x = Math.round(hx);
  const y = Math.round(hy);
  if (solidHead) {
    if (acc) over(r, x, y, 0, alpha);
    else over(r, x, y, alpha, 0, slot);
  } else put(r, x, y, alpha, acc, slot);
}

const scene: Scene = {
  // the copy column has left: the brain may drift to the centre of the screen
  unclipped: (p) => p >= copyOut,

  paint({ r, box, full, p, t, mobile }) {
    if (p >= chartZoomEnd) return;
    const key = `${Math.round(box.w * 4)}:${Math.round(box.h * 4)}:${mobile ? 1 : 0}`;
    if (!CACHE || CACHE.key !== key) CACHE = build(box, mobile, key);
    const B = CACHE;

    const g = growth(p);
    // arrival front: SEED → 1 (+ the last glint) over the growth
    const A = SEED + (1 + GLINT - SEED) * clamp(g / 0.97);
    // colour: how far the brain has lit up (cells with hue < C are in colour)
    const C = colourful(g);

    // ending beats
    const drift = easeInOut(range(copyOut + 0.005, questionStart + 0.06, p));
    const erode = easeInOut(range(questionStart - 0.01, questionEnd - 0.03, p));
    const fade = 1 - range(chartZoom, chartZoomEnd, p);

    const cx = Math.round(lerp(box.cx, full.cx, drift));
    const cy = Math.round(lerp(box.cy - B.lift, full.cy, drift));

    // ── the brain ────────────────────────────────────────────────────────
    if (erode > 0) {
      // the finished brain, a little larger, eroding into a light fog. Each
      // cell drops out or steps down the halftone levels (1 → ¾ → ½ → ¼, all
      // exact levels, so no dither churn) at its own hashed moment — a clean
      // dissolve. The chart's zoom then dissolves the rest.
      const sc = 1 + 0.3 * erode;
      const gone = 0.5 * erode + 0.5 * (1 - fade);
      const x0 = Math.max(0, Math.floor(cx + B.gx * sc));
      const x1 = Math.min(r.w, Math.ceil(cx + (B.gx + B.gw) * sc));
      const y0 = Math.max(0, Math.floor(cy + B.gy * sc));
      const y1 = Math.min(r.h, Math.ceil(cy + (B.gy + B.gh) * sc));
      for (let y = y0; y < y1; y++) {
        const j = Math.round((y - cy) / sc) - B.gy;
        if (j < 0 || j >= B.gh) continue;
        for (let x = x0; x < x1; x++) {
          const i = Math.round((x - cx) / sc) - B.gx;
          const gi = j * B.gw + i;
          if (i < 0 || i >= B.gw || !B.grid[gi]) continue;
          if (hash2(i, j, 41) < gone) continue;
          const step = Math.floor(erode * 3.9 - hash2(i, j, 43) * 0.9);
          put(r, x, y, step <= 0 ? 1 : step === 1 ? 0.75 : step === 2 ? 0.5 : 0.25, false, B.hue[gi] < C ? B.slot[gi] : 0);
        }
      }
    } else {
      // a ghost of the picture to come (a fine-dot outline over a faint
      // body); landed pixels glint, then ink
      const ghost = 1 - smoothstep(0.3, 0.85, g);
      const { n, tx, ty, k, edge, sx, sy, slot, hue, cell } = B;
      for (let q = 0; q < n; q++) {
        const kq = k[q];
        const x = cx + tx[q];
        const y = cy + ty[q];
        if (A >= kq) {
          if (kq >= SEED && A - kq < GLINT) put(r, x, y, 1, true);
          else put(r, x, y, 1, false, hue[cell[q]] < C ? slot[cell[q]] : 0);
        } else if (ghost > 0) {
          put(r, x, y, (edge[q] ? GHOST_EDGE : GHOST_BODY) * ghost, false);
        }
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
          hue[cell[q]] < C ? slot[cell[q]] : 0,
        );
      }
    }

    // ── ambient trickle: a few specks keep streaming in while it grows ────
    const trickle = 1 - range(growEnd - 0.06, growEnd, p);
    if (trickle > 0 && t > 0) {
      for (let m = 0; m < TRICKLE; m++) {
        const th = ((m + hash2(m, 3, 61)) / TRICKLE) * Math.PI * 2;
        const period = 2.8 + 1.8 * hash2(m, 5, 61);
        const ph = (t / period + hash2(m, 7, 61)) % 1;
        const c = Math.cos(th);
        const s = Math.sin(th);
        const D = toBorder(c, s, B.hw, B.hh, B.lift) * 0.97;
        // they fade out at the brain's rim
        const rim = 0.92 / Math.hypot(c / B.a, s / B.b);
        if (D <= rim + 2) continue;
        const d = lerp(D, rim, ph * ph);
        const d0 = lerp(D, rim, Math.max(0, ph - 0.14) ** 2);
        const al = 0.55 * trickle * smoothstep(0, 0.15, ph) * (1 - smoothstep(0.85, 1, ph));
        const tint = hash2(m, 9, 61) < C ? 1 + (m % SLOTS) : 0;
        streak(r, cx + c * d, cy + s * d, cx + c * d0, cy + s * d0, al, false, tint);
      }
    }

  },
};

export default scene;
