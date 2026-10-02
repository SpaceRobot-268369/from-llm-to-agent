/**
 * scaling — make it bigger, it gets better. Pixels fly in from every
 * direction and converge on the centre of the art box, where each one lands on
 * its own cell of a fixed target picture: a brain (two bumpy lobes, a centre
 * fissure, meandering folds). The more pixels have arrived — the bigger the
 * model — the clearer the brain gets. Once it is fairly clear, a small,
 * friendly face opens on its lower left: the intelligence showing up.
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
 *                       The ghost fades as the real pixels take over. The face
 *                       opens from its middle over growth 0.55 … 0.68 (eyes
 *                       first, then the smile).
 *   growEnd … copyOut   hold: the finished brain + face
 *   copyOut …           unclipped (no copy column any more): the face closes,
 *                       the brain drifts to the centre of the screen and
 *                       erodes cell by cell (exact halftone steps, no dither
 *                       churn) into a light fog of fine dots behind the plateau
 *                       question (questionStart … questionEnd)
 *   chartZoom … chartZoomEnd  the fog dissolves — the DOM chart takes over;
 *                       nothing is painted after that
 *
 * t only drives ambient motion: a trickle of incoming specks while the brain
 * is unfinished, and the face's slow, soft blink (the eyes close row by row).
 * At t = 0 every frame reads.
 */
import { SCALING } from '../../content/sections';
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
/** the face blinks every BLINK seconds; one blink lasts BLINK_LEN */
const BLINK = 5.3;
const BLINK_LEN = 0.36;
/** weight of the centre-first bias in the arrival order (0 = purely random) */
const BIAS = 0.25;
/** ghost of the picture to come: its outline (uniform small squares) and its body */
const GHOST_EDGE = 0.5;
const GHOST_BODY = 0.12;

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

// ── the face: '#' plate (accent), '@' features (ink); square cells
const FACE_LG = [
  '....#####....',
  '..#########..',
  '.###########.',
  '###@@###@@###',
  '###@@###@@###',
  '###@@###@@###',
  '#############',
  '####@###@####',
  '.####@@@####.',
  '..#########..',
  '....#####....',
];
const FACE_SM = [
  '...#####...',
  '.#########.',
  '##@@###@@##',
  '##@@###@@##',
  '###########',
  '###@###@###',
  '.###@@@###.',
  '...#####...',
];

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
  /** face centre offset and sprite */
  fx: number;
  fy: number;
  face: string[];
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

  // the face sits on the lower left of the left lobe
  const face = mobile ? FACE_SM : FACE_LG;
  const fx = Math.round(-0.46 * a);
  const fy = Math.round(0.4 * b);
  return { key, a, b, n, tx, ty, k, edge, sx, sy, gx, gy, gw, gh, grid, fx, fy, face, lift, hw, hh };
}

/** max-blend one cell */
function put(r: Raster, x: number, y: number, val: number, acc: boolean) {
  if (val <= 0.01 || x < 0 || y < 0 || x >= r.w || y >= r.h) return;
  const i = y * r.w + x;
  const ch = acc ? r.acc : r.ink;
  if (val > ch[i]) ch[i] = val > 1 ? 1 : val;
}

/** overwrite one cell (things drawn on top of the brain) */
function over(r: Raster, x: number, y: number, ink: number, acc: number) {
  if (x < 0 || y < 0 || x >= r.w || y >= r.h) return;
  const i = y * r.w + x;
  r.ink[i] = ink;
  r.acc[i] = acc;
}

/** A flying pixel: a head at (hx, hy) and a fading accent streak back toward (bx, by). */
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
  if (solidHead) over(r, Math.round(hx), Math.round(hy), 0, alpha);
  else put(r, Math.round(hx), Math.round(hy), alpha, true);
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

    // ending beats
    const drift = easeInOut(range(copyOut + 0.005, questionStart + 0.06, p));
    const erode = easeInOut(range(questionStart - 0.01, questionEnd - 0.03, p));
    const fade = 1 - range(chartZoom, chartZoomEnd, p);
    const faceGone = range(copyOut, questionStart + 0.02, p);

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
          if (i < 0 || i >= B.gw || !B.grid[j * B.gw + i]) continue;
          if (hash2(i, j, 41) < gone) continue;
          const step = Math.floor(erode * 3.9 - hash2(i, j, 43) * 0.9);
          put(r, x, y, step <= 0 ? 1 : step === 1 ? 0.75 : step === 2 ? 0.5 : 0.25, false);
        }
      }
    } else {
      // a ghost of the picture to come (a fine-dot outline over a faint
      // body); landed pixels glint, then ink
      const ghost = 1 - smoothstep(0.3, 0.85, g);
      const { n, tx, ty, k, edge, sx, sy } = B;
      for (let q = 0; q < n; q++) {
        const kq = k[q];
        const x = cx + tx[q];
        const y = cy + ty[q];
        if (A >= kq) {
          if (kq >= SEED && A - kq < GLINT) put(r, x, y, 1, true);
          else put(r, x, y, 1, false);
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
        streak(r, cx + c * d, cy + s * d, cx + c * d0, cy + s * d0, al, false);
      }
    }

    // ── the face: opens once the brain is fairly clear, closes as it leaves
    const pop = range(0.55, 0.68, g) * (1 - easeInOut(faceGone));
    if (pop > 0) {
      const rows = B.face;
      const fh = rows.length;
      const fw = rows[0].length;
      const ox = cx + B.fx - (fw >> 1);
      const oy = cy + B.fy - (fh >> 1);
      const reach = pop * 1.15 * Math.hypot(fw / 2, fh / 2);
      // a slow, soft blink: every BLINK s the eyes close row by row from the
      // top down to their bottom row, then reopen the same way
      const bp = t > 0 ? (t % BLINK) - (BLINK - BLINK_LEN) : -1;
      const shut = bp > 0 ? 1 - Math.abs((2 * bp) / BLINK_LEN - 1) : 0;
      // the face opens from its middle, features and all: the eyes first, the
      // smile as it reaches the bottom (and the reverse when it closes)
      const shown = (i: number, j: number) =>
        j >= 0 &&
        j < fh &&
        i >= 0 &&
        i < fw &&
        rows[j].charCodeAt(i) !== 46 && // '.'
        Math.hypot(i + 0.5 - fw / 2, j + 0.5 - fh / 2) <= reach;
      const feature = (i: number, j: number) => j >= 0 && j < fh && rows[j].charCodeAt(i) === 64; // '@'
      for (let j = -1; j <= fh; j++) {
        for (let i = -1; i <= fw; i++) {
          const x = ox + i;
          const y = oy + j;
          if (!shown(i, j)) {
            // a crisp ink outline around the visible plate
            if (shown(i - 1, j) || shown(i + 1, j) || shown(i, j - 1) || shown(i, j + 1)) over(r, x, y, 1, 0);
            continue;
          }
          if (feature(i, j)) {
            // eyes (upper half): hide their top rows while blinking
            let above = 0;
            let below = 0;
            if (j < fh / 2) {
              while (feature(i, j - 1 - above)) above++;
              while (feature(i, j + 1 + below)) below++;
            }
            if (j >= fh / 2 || above >= Math.round(shut * (above + below))) {
              over(r, x, y, 1, 0);
              continue;
            }
          }
          over(r, x, y, 0, 1);
        }
      }
    }
  },
};

export default scene;
