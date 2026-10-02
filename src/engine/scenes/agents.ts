/**
 * agents — every agent app is the same loop. One constant core sits in the
 * middle the whole time: the model (a solid square; its soft pulse is a faint
 * halo) inside the agent-loop ring, with the accent runner lapping it (the
 * agent scene's vocabulary — the runner IS the shared loop). Around it the
 * app's shell changes, one costume after another, each with an iconic pixel
 * mark (a nod to the product's icon, about the claw's size — never a traced
 * logo) and a pixel-font name underneath:
 *
 *   0    – 0.34  CLAUDE CODE — a terminal window (title bar with three dots,
 *                 two code lines, a "> ▌" prompt; a request types in, p .03–.24)
 *                 with Claude's SPARK on its top-right corner: an accent
 *                 starburst, a small solid centre and ten tapered rays of
 *                 uneven length (eight on small marks), in front of the frame
 *   0.34 – 0.67  CODEX — the loop sits inside a cloud, a small terminal with a
 *                 ">_" prompt in front of its lower-left (its request types in,
 *                 p .40–.55, where the terminal has room) and a KNOT in front
 *                 of its lower-right (a nod to OpenAI's), in solid ink: a
 *                 six-lobed rosette with a hexagonal hole and six hooked gaps
 *                 swirling round it (about 19 cells and up — desktop sizes);
 *                 smaller marks, too small for those gaps, get three rounded
 *                 loops crossed at 60° (six petals round a hexagonal middle)
 *   0.67 – 1     OPENCLAW — a lobster claw beside the loop, chat bubbles
 *                 (two more pop in at p .75 and .83), a heartbeat underneath
 *
 * The switches follow the text column's product cards (p = 0.34 and 0.67,
 * each cross-fading over the next 0.035). Around each one the old shell
 * dissolves in 2×2-cell pixel chunks (blocky noise, like the page's own
 * dissolve) and the new one assembles in the complementary chunks — marks
 * included — while the core never changes. That is the point. The Codex
 * cloud and the two marks are painted cell by cell (distance fields, so every
 * stroke lands on whole cells), everything else with the 2D context under a
 * clip built from the same chunk test.
 *
 * t drives ambient motion only: the runner laps (scroll also advances it),
 * the core's halo and the cursors pulse softly, the spark's rays breathe by
 * about half a cell, the heartbeat scrolls and the claw snaps on each beat.
 * Everything reads at t = 0.
 */
import { clamp, easeOut, hash2, range } from '../noise';
import type { Raster } from '../raster';
import type { Box, Scene } from './types';
import { ACC, INK, blink, fillCircle, pixelText, pixelTextWidth, strokeArc } from './helpers';

const TAU = Math.PI * 2;

/**
 * Product switch points in scene progress (SECTIONS 'agent-apps'.products:
 * 0.34, 0.67). The text column cross-fades its product card over
 * [at, at + 0.035], so each shell swap is centred on that fade: the old shell
 * dissolves while the old card fades out, the new one assembles as the new
 * card arrives.
 */
const SWITCH = [0.34 + 0.0175, 0.67 + 0.0175];
/** Half-width of each shell swap, in scene progress. */
const SWAP = 0.035;
const NAMES = ['CLAUDE CODE', 'CODEX', 'OPENCLAW'];
/** Dissolve noise seeds, one per swap. */
const SEEDS = [101, 202];

// ── design space: units relative to the core centre (≈ cells on desktop) ──
/** Half-width of the widest shell. */
const HW = 28;
/** Top and bottom of the shells (the name label goes below). */
const TOP = -26;
const BOT = 24;
/** Loop ring radius and band thickness; the core's half-size. */
const RING_R = 11;
const RING_T = 3;
const CORE = 4;
/** Seconds between OpenClaw heartbeats. */
const PERIOD = 2.6;

/** Loop node angles (clockwise from the top), as in the agent scene. */
const NODES = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];

type G = CanvasRenderingContext2D;
type Rect = [number, number, number, number];

/** Snapped layout: cells per unit, unit → cell mappers, stroke weight. */
type Lay = {
  k: number;
  /** horizontal cells per unit for shell placement: wide boxes spread the shells a little */
  kx: number;
  ox: number;
  oy: number;
  /** x / y of a design point, snapped to whole cells */
  P: (u: number) => number;
  Q: (v: number) => number;
  /** a length in cells, rounded, at least `min` */
  N: (l: number, min?: number) => number;
  lw: number;
  /** top of the name label, and its pixel-font scale */
  ly: number;
  ls: number;
};

function layout(box: Box): Lay {
  const aw = box.w * 0.88;
  const ah = box.h * 0.88;
  const gap = 3;
  // the label never shrinks below scale 1; it grows only when there is room
  const wide = pixelTextWidth(NAMES[0]);
  const ls = Math.max(1, Math.min(2, Math.floor(aw / wide / 1.25)));
  const lh = 5 * ls;
  const k = Math.min(aw / (2 * HW), (ah - lh - gap) / (BOT - TOP));
  const total = (BOT - TOP) * k + gap + lh;
  const top = box.y + (box.h - total) / 2;
  const kx = Math.min(aw / (2 * HW), k * 1.3);
  const ox = Math.round(box.cx);
  const oy = Math.round(top - TOP * k);
  return {
    k,
    kx,
    ox,
    oy,
    P: (u) => ox + Math.round(u * kx),
    Q: (v) => oy + Math.round(v * k),
    N: (l, min = 1) => Math.max(min, Math.round(l * k)),
    lw: Math.max(1, Math.round(k * 1.5)),
    ly: Math.round(top + (BOT - TOP) * k + gap),
    ls,
  };
}

// ── the pixel-chunk dissolve ────────────────────────────────────────────

/** Blocky dissolve noise for the 2×2-cell chunk holding cell (x, y), in [0, 1). */
function chunk(x: number, y: number, seed: number): number {
  const cx = x >> 1;
  const cy = y >> 1;
  return 0.6 * hash2(cx >> 1, cy >> 1, seed) + 0.4 * hash2(cx, cy, seed + 7);
}

/**
 * Which chunks of a shell are on: those whose arrival noise is under `inT`
 * (it is assembling) and whose departure noise is at or over `outT` (it is
 * dissolving). Consecutive shells share a seed, so their chunks never overlap.
 */
type Vis = { inT: number; inS: number; outT: number; outS: number };

const on = (v: Vis, x: number, y: number) =>
  (v.inT >= 1 || chunk(x, y, v.inS) < v.inT) && (v.outT <= 0 || chunk(x, y, v.outS) >= v.outT);

function visibility(p: number): Vis[] {
  const x0 = range(SWITCH[0] - SWAP, SWITCH[0] + SWAP, p);
  const x1 = range(SWITCH[1] - SWAP, SWITCH[1] + SWAP, p);
  // the old shell is gone by 2/3 of the swap; the new one starts at 1/3
  const out = (x: number) => clamp(1.5 * x);
  const inn = (x: number) => clamp(1.5 * x - 0.5);
  return [
    { inT: 1, inS: 0, outT: out(x0), outS: SEEDS[0] },
    { inT: inn(x0), inS: SEEDS[0], outT: out(x1), outS: SEEDS[1] },
    { inT: inn(x1), inS: SEEDS[1], outT: 0, outS: 0 },
  ];
}

/** Clip the context to the shell's visible chunks inside `box` (merged runs). */
function clipTo(g: G, box: Box, v: Vis) {
  const x0 = Math.max(0, Math.floor(box.x) - 2) & ~1;
  const y0 = Math.max(0, Math.floor(box.y) - 2) & ~1;
  const x1 = Math.ceil(box.x + box.w) + 2;
  const y1 = Math.ceil(box.y + box.h) + 2;
  g.beginPath();
  for (let y = y0; y < y1; y += 2) {
    let run = -1;
    let x = x0;
    for (; x < x1; x += 2) {
      const lit = on(v, x, y);
      if (lit && run < 0) run = x;
      else if (!lit && run >= 0) {
        g.rect(run, y, x - run, 2);
        run = -1;
      }
    }
    // close a run that reaches the right edge (x1 may be odd, so the loop can
    // step past it without ever seeing an unlit chunk)
    if (run >= 0) g.rect(run, y, x - run, 2);
  }
  g.clip();
}

// ── the constant core: model + loop ─────────────────────────────────────

/** Radius of the loop's outer edge in cells (band, runner and stops included). */
function ringOuter(k: number): number {
  const T = Math.max(2, RING_T * k);
  return RING_R * k + Math.max(T / 2 + 0.4, T * 0.66, Math.max(1.5, 2 * k));
}

function core(g: G, L: Lay, p: number, t: number) {
  const { ox, oy, k } = L;
  const R = RING_R * k;
  const T = Math.max(2, RING_T * k);
  const rn = Math.max(1.5, 2 * k);
  // the band
  g.lineCap = 'butt';
  strokeArc(g, ox, oy, R, T, INK(0.6));
  // runner: laps with time, and scrolling advances it too
  const a = NODES[0] + (t / 3.2) * TAU + p * TAU * 3;
  const n = 12;
  const tail = 1.3;
  const seg = tail / n;
  const w = T + 0.8;
  for (let i = 0; i < n; i++) {
    const f = i / n;
    strokeArc(g, ox, oy, R, w * (1 - 0.35 * f), ACC(1 - 0.5 * f), a - seg * (i + 1), a - seg * i + 0.004);
  }
  g.lineCap = 'round';
  fillCircle(g, ox + Math.cos(a) * R, oy + Math.sin(a) * R, T * 0.66, ACC(1));
  // think · act · observe: small solid stops; the runner lights the one it is in
  for (const na of NODES) {
    let d = (((a - na) % TAU) + TAU) % TAU;
    if (d > Math.PI) d -= TAU;
    const lit = d > -0.18 && d < 0.5;
    fillCircle(g, ox + Math.cos(na) * R, oy + Math.sin(na) * R, rn, lit ? ACC(1) : INK(1));
  }
  // the model: a solid square core (always solid — a dimmed block would turn
  // into mid-tone crosses in this chapter); its soft pulse is a faint halo
  // one cell out, which breathes in and out (absent at t = 0)
  const c = Math.max(2, Math.round(CORE * k));
  const halo = 0.3 * (1 - blink(t, 2.4, 0));
  // (only where it keeps a clear cell from the band — not on small boxes)
  if (halo > 0.02 && c + 3 <= R - T / 2) {
    g.fillStyle = INK(halo);
    g.beginPath();
    g.rect(ox - c - 2, oy - c - 2, c * 2 + 4, c * 2 + 4);
    g.rect(ox - c - 1, oy - c - 1, c * 2 + 2, c * 2 + 2);
    g.fill('evenodd');
  }
  g.fillStyle = INK(1);
  g.fillRect(ox - c, oy - c, c * 2, c * 2);
}

// ── shells ──────────────────────────────────────────────────────────────

/**
 * A window: outer rect, a solid title bar of height `tb` with `dots` cut
 * out of it, and an empty body — one even-odd path, so it stays crisp.
 */
function windowFrame(g: G, x0: number, y0: number, x1: number, y1: number, lw: number, tb: number, dots: number) {
  g.beginPath();
  g.rect(x0, y0, x1 - x0, y1 - y0);
  g.rect(x0 + lw, y0 + tb, x1 - x0 - 2 * lw, y1 - y0 - tb - lw);
  if (dots > 0) {
    const d = tb >= 4 ? 2 : 1;
    const dy = y0 + Math.floor((tb - d) / 2);
    for (let i = 0; i < dots; i++) g.rect(x0 + lw + 1 + i * d * 2, dy, d, d);
  }
  g.fillStyle = INK(1);
  g.fill('evenodd');
}

/**
 * A "> ▌" prompt at (x, y) (top of the 5-row glyph): typed words grow to the
 * right. With `under`, the cursor is an underscore instead — ">_", Codex's mark.
 */
function prompt(g: G, x: number, y: number, typed: number[], f: number, t: number, maxW: number, under = false) {
  pixelText(g, '>', x, y, INK(1));
  const x0 = x + (under ? 4 : 5);
  let cx = x0;
  const total = typed.reduce((s, w) => s + w + 1, 0);
  // room for the glyph, the typing, the cursor and a clear cell before the frame
  let left = Math.round(Math.min(total, maxW - 9) * f);
  if (left > 0 && left < 2) left = 0;
  g.fillStyle = INK(0.7);
  for (const w of typed) {
    if (left <= 0) break;
    const ww = Math.min(w, left);
    g.fillRect(cx, y + 2, ww, 2);
    cx += ww + 1;
    left -= ww + 1;
  }
  g.fillStyle = INK(blink(t, 2.4, 0.5));
  if (under) g.fillRect(cx, y + 4, 3, 1);
  else g.fillRect(cx, y, 2, 5);
}

/** Code-ish rows: a solid keyword then a lighter run, `[indent, keyword, text]` in units. */
const CODE: [number, number, number][] = [
  [0, 5, 15],
  [3, 4, 11],
];

function claudeCode(g: G, L: Lay, p: number, t: number) {
  const { P, Q, N, lw } = L;
  const x0 = P(-27);
  const x1 = P(27);
  const y0 = Q(TOP);
  const y1 = Q(BOT);
  // at least 4 cells, so the three dots are 2 × 2 cells even on mobile
  const tb = N(4, 4);
  windowFrame(g, x0, y0, x1, y1, lw, tb, 3);
  // code lines under the title bar (2 cells tall, 1+ cell apart, at any size)
  const ph = N(2, 2);
  const xi = x0 + lw + N(2);
  const yc = Math.max(Q(-20), y0 + tb + 1);
  for (let i = 0; i < CODE.length; i++) {
    const [ind, kw, tx] = CODE[i];
    const y = yc + i * (ph + N(1));
    const xa = xi + N(ind, 0);
    // never run into the loop: stop 2 cells short of the ring's outer edge
    const dy = Math.max(0, Math.max(L.oy - (y + ph), y - L.oy));
    const ro = ringOuter(L.k) + 2;
    const xr = dy < ro ? Math.floor(L.ox - Math.sqrt(ro * ro - dy * dy)) : x1;
    const kwW = N(kw, 2);
    if (xr - xa < 2) continue;
    g.fillStyle = INK(1);
    g.fillRect(xa, y, Math.min(kwW, xr - xa), ph);
    const txW = Math.min(N(tx, 3), xr - (xa + kwW + 1));
    if (txW >= 2) {
      g.fillStyle = INK(0.5);
      g.fillRect(xa + kwW + 1, y, txW, ph);
    }
  }
  // the prompt: the reader's request types in as they scroll
  const typed = easeOut(range(0.03, 0.24, p));
  prompt(g, xi, Q(15), [N(4, 2), N(3, 2), N(7, 3)], typed, t, x1 - xi - lw);
}

/**
 * The cloud in units relative to the core: a flat-bottomed base (a capsule
 * from -CAP_X to CAP_X at CAP_Y, radius CAP_R) under three bumps [u, v, r] —
 * the middle one big enough to hold the whole loop.
 */
const CLOUD: [number, number, number][] = [
  [0, 0, 17],
  [-11.5, -10, 9.5],
  [10, -13.5, 10],
];
const CAP_X = 18.5;
const CAP_Y = 10.5;
const CAP_R = 6;
const CLOUD_BOT = 16.5;

/**
 * The cloud, cell by cell (signed distance to the lobes' union): a solid rim,
 * a faint inside — left open around the terminal and the knot in front of it.
 */
function cloud(r: Raster, L: Lay, v: Vis, hole: Rect, front: Mark) {
  const { k, kx, ox, oy, lw } = L;
  const lobes = CLOUD.map(([u, w, rr]) => [ox + u * kx, oy + w * k, rr * k]);
  const bot = oy + CLOUD_BOT * k;
  const capA = ox - CAP_X * kx;
  const capB = ox + CAP_X * kx;
  const capY = oy + CAP_Y * k;
  const capR = CAP_R * k;
  const xa = Math.max(0, Math.floor(ox - HW * kx));
  const xb = Math.min(r.w, Math.ceil(ox + HW * kx));
  const ya = Math.max(0, Math.floor(oy + TOP * k));
  const yb = Math.min(r.h, Math.ceil(bot) + 1);
  const rim = Math.max(1, lw * 0.95);
  // the terminal sits in front: keep a 1-cell gap around it
  const [hx0, hy0, hx1, hy1] = [hole[0] - 1, hole[1] - 1, hole[2] + 1, hole[3] + 1];
  // and a clear ring round the knot
  const fr = front.s + 1.3;
  for (let y = ya; y < yb; y++) {
    const py = y + 0.5;
    for (let x = xa; x < xb; x++) {
      if (x >= hx0 && x < hx1 && y >= hy0 && y < hy1) continue;
      const px = x + 0.5;
      if (Math.hypot(px - front.cx, py - front.cy) < fr) continue;
      let d = py - bot;
      // the base: distance to the capsule's centre line
      const sx = px < capA ? capA : px > capB ? capB : px;
      let m = Math.hypot(px - sx, py - capY) - capR;
      for (let i = 0; i < lobes.length; i++) {
        const [cx, cy, rr] = lobes[i];
        const e = Math.hypot(px - cx, py - cy) - rr;
        if (e < m) m = e;
      }
      if (m > d) d = m;
      if (d > 0) continue;
      if (!on(v, x, y)) continue;
      const val = d > -rim ? 1 : 0.14;
      const i = y * r.w + x;
      if (val > r.ink[i]) r.ink[i] = val;
    }
  }
}

/**
 * Codex's small terminal, in front of the cloud's lower-left: [x0, y0, x1, y1]
 * in cells — never too short for its title bar, a 5-row ">_" and a row of air
 * above and below it.
 */
function codexTerminal(L: Lay): Rect {
  const { P, Q, N, lw } = L;
  const y1 = Q(BOT);
  return [P(-HW), Math.min(Q(12), y1 - (N(3, 2) + lw + 7)), P(-11), y1];
}

function codex(g: G, L: Lay, p: number, t: number) {
  const { N, lw } = L;
  const [x0, y0, x1, y1] = codexTerminal(L);
  const tb = N(3, 2);
  windowFrame(g, x0, y0, x1, y1, lw, tb, 0);
  const xi = x0 + lw + N(2);
  const yi = Math.round((y0 + tb + y1 - lw) / 2 - 2.5);
  // ">_" — then a new request types in, a little after Codex has assembled
  prompt(g, xi, yi, [N(3, 2), N(5, 2)], easeOut(range(0.4, 0.55, p)), t, x1 - xi - lw, true);
}

// ── product marks: pixel nods to each app's icon, painted cell by cell ──

/** A mark's centre, radius and stroke weight, in cells. */
type Mark = { cx: number; cy: number; s: number; w: number };

/** Mark radius in units — about the claw's size; never under MARK_MIN cells. */
const MARK = 8.6;
const MARK_MIN = 5.5;

/**
 * A mark of radius `s` and stroke `w` near (x, y). Its centre snaps to a cell
 * centre when the stroke is odd and to a cell corner when it is even, so
 * 1-cell strokes stay 1 cell and 2-cell strokes stay 2 — symmetric and crisp.
 */
function mark(x: number, y: number, s: number, w: number): Mark {
  const snap = (u: number) => (w % 2 ? Math.floor(u) + 0.5 : Math.round(u));
  return { cx: snap(x), cy: snap(y), s, w };
}

/** The cells a mark (plus a margin) may touch, clamped to the raster: [x0, y0, x1, y1). */
function markBounds(r: Raster, m: Mark, pad: number): Rect {
  const e = m.s + pad;
  return [
    Math.max(0, Math.floor(m.cx - e)),
    Math.max(0, Math.floor(m.cy - e)),
    Math.min(r.w, Math.ceil(m.cx + e)),
    Math.min(r.h, Math.ceil(m.cy + e)),
  ];
}

/**
 * Claude's spark: per ray, [angle jitter in ray steps, length as a share of
 * the radius] — slightly uneven, like a hand-cut starburst. Small marks use
 * the first eight rays.
 */
const RAYS: [number, number][] = [
  [0, 1],
  [0.04, 0.8],
  [-0.03, 0.94],
  [0.03, 0.74],
  [-0.02, 0.98],
  [0.03, 0.84],
  [-0.04, 0.9],
  [0.02, 0.76],
  [-0.02, 1],
  [0.03, 0.82],
];
/** Scratch for the spark's ray directions and lengths (no per-frame allocation). */
const RX = new Float64Array(RAYS.length);
const RY = new Float64Array(RAYS.length);
const RL = new Float64Array(RAYS.length);

/** The spark sits over the terminal's top-right corner, kept inside the box. */
function sparkAt(L: Lay, box: Box): Mark {
  const s = Math.max(MARK_MIN, MARK * L.k);
  const x = Math.min(L.P(27) - 0.35 * s, box.x + box.w - 1 - s);
  const y = Math.max(L.Q(TOP) + 0.35 * s, box.y + 1 + s);
  // thick rays: 2 cells (or the shell's stroke, if heavier) — 1 on small marks, where 2 would clot
  return mark(x, y, s, Math.max(L.lw, s >= 7 ? 2 : 1));
}

/**
 * The spark, in the accent: a small solid centre and ten tapered rays (eight
 * on small marks), `w` cells wide at the tip and a little wider at the root.
 * It sits in front of the window: the window's ink is cleared in a 1-cell
 * outline around it. A slow breath runs round the rays (a tip moves by about
 * half a cell); none at t = 0.
 */
function spark(r: Raster, m: Mark, v: Vis, t: number) {
  const { cx, cy, s, w } = m;
  const n = s >= 7 ? RAYS.length : 8;
  const hw1 = w / 2 - 0.05;
  const hw0 = hw1 + 0.35;
  const rc = Math.max(1.2, 0.14 * s);
  for (let i = 0; i < n; i++) {
    const [jit, len] = RAYS[i];
    const a = -Math.PI / 2 + ((i + jit) / n) * TAU;
    const ph = (i / n) * TAU * 2;
    const breath = 0.03 * (Math.sin((t / 5) * TAU - ph) + Math.sin(ph));
    RX[i] = Math.cos(a);
    RY[i] = Math.sin(a);
    RL[i] = s * (len + breath) - hw1;
  }
  const [x0, y0, x1, y1] = markBounds(r, m, 2);
  for (let y = y0; y < y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - cx;
      // distance to the spark (≤ 0 inside): the centre disc, then each ray
      let d = Math.hypot(dx, dy) - rc;
      for (let i = 0; i < n && d > 0; i++) {
        const l = RL[i];
        let f = (dx * RX[i] + dy * RY[i]) / l;
        f = f < 0 ? 0 : f > 1 ? 1 : f;
        const e = Math.hypot(dx - RX[i] * l * f, dy - RY[i] * l * f) - (hw0 + (hw1 - hw0) * f);
        if (e < d) d = e;
      }
      if (d > 1.25 || !on(v, x, y)) continue;
      const k = y * r.w + x;
      r.ink[k] = 0;
      if (d <= 0) r.acc[k] = 1;
    }
  }
}

/**
 * The knot's radius in units — a touch over MARK, since the swirl needs room —
 * and, in cells, the radius from which it is drawn as the swirl (below it the
 * swirl's 1-cell gaps turn into a maze, so small marks use the crossed loops)
 * and the size from which a mark is pushed up to that.
 */
const KNOT = 9.2;
const SWIRL_MIN = 9.3;
const SWIRL_FROM = 7.4;

/** Codex's knot sits in front of the cloud's lower right (mirroring the terminal), clear of the name. */
function knotAt(L: Lay, box: Box): Mark {
  let s = Math.max(MARK_MIN, MARK * L.k);
  if (s >= SWIRL_FROM) s = Math.max(SWIRL_MIN, KNOT * L.k);
  return mark(Math.min(L.P(19.5), box.x + box.w - 1 - s), Math.min(L.Q(18), L.ly - 2 - s), s, L.lw);
}

/** Directions of the swirl's six hooks (multiples of 60°). */
const HC = [0, 1, 2, 3, 4, 5].map((j) => Math.cos((j * Math.PI) / 3));
const HS = [0, 1, 2, 3, 4, 5].map((j) => Math.sin((j * Math.PI) / 3));
/** Its six lobes' centres (30° + multiples of 60°, at half the radius), as unit vectors. */
const LC = [0, 1, 2, 3, 4, 5].map((j) => Math.cos(Math.PI / 6 + (j * Math.PI) / 3));
const LS = [0, 1, 2, 3, 4, 5].map((j) => Math.sin(Math.PI / 6 + (j * Math.PI) / 3));
/** A hook in radius units (before rotation): a straight run x = HX, y HY0 → HY1, then an arc round (HAX, HY1). */
const HX = 0.39;
const HY0 = -0.04;
const HY1 = 0.49;
const HAX = 0.1;
const HAR = 0.29;
const HSWEEP = (2 * Math.PI) / 3;
const HEX = 0.28 * Math.cos(Math.PI / 6);

/**
 * Is (x, y) — in radius units from the swirl's centre — solid? A six-lobed
 * rosette with a hexagonal hole, cut by six hooked gaps (half-width `gh`):
 * each runs out from beside the hole, then bends back along the rim, so the
 * solid between them reads as six interlocking links wound round the middle.
 */
function swirlAt(x: number, y: number, gh: number): boolean {
  let inside = false;
  for (let j = 0; j < 6 && !inside; j++) inside = Math.hypot(x - 0.5 * LC[j], y - 0.5 * LS[j]) <= 0.5;
  if (!inside) return false;
  // the hexagonal hole (pointy top)
  let h = 0;
  for (let j = 0; j < 3; j++) h = Math.max(h, Math.abs(y * HC[j] + x * HS[j]));
  if (h <= HEX) return false;
  for (let j = 0; j < 6; j++) {
    // into the hook's frame
    const u = x * HC[j] + y * HS[j];
    const w = -x * HS[j] + y * HC[j];
    const f = w < HY0 ? HY0 : w > HY1 ? HY1 : w;
    let d = Math.hypot(u - HX, w - f);
    const a = Math.atan2(w - HY1, u - HAX);
    if (a >= 0 && a <= HSWEEP) d = Math.min(d, Math.abs(Math.hypot(u - HAX, w - HY1) - HAR));
    else d = Math.min(d, Math.hypot(u - HAX - HAR * Math.cos(HSWEEP), w - HY1 - HAR * Math.sin(HSWEEP)));
    if (d <= gh) return false;
  }
  return true;
}

/** Distance from (x, y) to the segment (ax, ay) → (bx, by). */
function toSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const ux = bx - ax;
  const uy = by - ay;
  let f = ((x - ax) * ux + (y - ay) * uy) / (ux * ux + uy * uy);
  f = f < 0 ? 0 : f > 1 ? 1 : f;
  return Math.hypot(x - ax - ux * f, y - ay - uy * f);
}

/** Scratch for the knot's three loops: segment ends, 4 numbers per loop. */
const LOOPS = new Float64Array(12);

/**
 * Codex's knot, a nod to OpenAI's. From SWIRL_MIN up it is the swirl (see
 * swirlAt): a solid rosette with a hexagonal hole and six hooked gaps wound
 * round it. Smaller marks can't hold those 1-cell gaps, so they get three
 * long rounded loops (stadium outlines, `w` cells — the shell's stroke
 * weight) crossed at 60°: six round ends for petals, a hexagon where they
 * overlap.
 */
function knot(r: Raster, m: Mark, v: Vis) {
  const { cx, cy, s, w } = m;
  if (s >= SWIRL_MIN) {
    const [x0, y0, x1, y1] = markBounds(r, m, 1);
    for (let y = y0; y < y1; y++) {
      const dy = (y + 0.5 - cy) / s;
      for (let x = x0; x < x1; x++) {
        if (swirlAt((x + 0.5 - cx) / s, dy, 0.065) && on(v, x, y)) r.ink[y * r.w + x] = 1;
      }
    }
    return;
  }
  const rad = (w >= 2 ? 0.44 : 0.4) * s;
  const hl = s - rad;
  const shift = 0.07 * s * clamp((s - 6) / 2);
  for (let j = 0; j < 3; j++) {
    const a = Math.PI / 2 + (j * Math.PI) / 3;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    LOOPS[j * 4] = -ux * hl - uy * shift;
    LOOPS[j * 4 + 1] = -uy * hl + ux * shift;
    LOOPS[j * 4 + 2] = ux * hl - uy * shift;
    LOOPS[j * 4 + 3] = uy * hl + ux * shift;
  }
  const [x0, y0, x1, y1] = markBounds(r, m, 1);
  for (let y = y0; y < y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x < x1; x++) {
      const dx = x + 0.5 - cx;
      let lit = false;
      for (let j = 0; j < 12 && !lit; j += 4) {
        const d = toSegment(dx, dy, LOOPS[j], LOOPS[j + 1], LOOPS[j + 2], LOOPS[j + 3]) - rad;
        lit = d <= 0 && d > -w;
      }
      if (lit && on(v, x, y)) r.ink[y * r.w + x] = 1;
    }
  }
}

/** One ECG beat: (x in spike widths, y in amplitudes; negative = up). */
const BEAT: [number, number][] = [
  [-1.6, 0],
  [-1.3, -0.14],
  [-1.0, 0],
  [-0.4, 0],
  [-0.22, 0.22],
  [0, -1],
  [0.24, 0.42],
  [0.44, 0],
  [0.95, 0],
  [1.25, -0.24],
  [1.6, 0],
];

/** The claw silhouette in claw units (copied from the openclaw scene). */
function clawPath(g: G, bite: number) {
  g.moveTo(0.56, 0.25);
  g.ellipse(0, 0.25, 0.56, 0.62, 0, 0, TAU);
  g.moveTo(0.56, 0.12);
  g.quadraticCurveTo(0.82, -0.8, 0.12, -1.3);
  g.quadraticCurveTo(0.3, -0.7, 0.06, -0.1);
  g.closePath();
  g.save();
  g.translate(-0.45, 0);
  g.rotate(bite);
  g.translate(0.45, 0);
  g.moveTo(-0.56, 0.12);
  g.quadraticCurveTo(-0.82, -0.8, -0.12, -1.3);
  g.quadraticCurveTo(-0.3, -0.7, -0.06, -0.1);
  g.closePath();
  g.restore();
  g.moveTo(0.28, 1.27);
  g.ellipse(-0.06, 1.27, 0.34, 0.24, 0.15, 0, TAU);
}

/** Chat bubbles around the loop: [u, v] centres in units, and when each pops in. */
const BUBBLES: [number, number][] = [
  [-17, -19],
  [18, -17],
  [21, 5],
];
const BUBBLE_AT = [0, 0.75, 0.83];

const easeOutBack = (x: number) => (x <= 0 ? 0 : 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2);

function openClaw(g: G, L: Lay, box: Box, p: number, t: number) {
  const { k, P, Q, N, lw } = L;
  const beat = t / PERIOD;
  const phase = beat - Math.floor(beat);
  const snapA = t > 0 && phase < 0.22 ? Math.sin((phase / 0.22) * Math.PI) : 0;

  // the claw, beside the loop
  const c = 7 * k;
  g.save();
  g.translate(P(-20.5), Q(1));
  g.rotate(0.32 + 0.025 * Math.sin(t * 0.7));
  g.scale(c, c);
  g.beginPath();
  clawPath(g, -0.12 + 0.22 * snapA);
  g.fillStyle = INK(1);
  // filled twice: the context adds ('lighter'), so half-covered edge cells
  // turn solid and the silhouette stays crisp instead of a fringe of crosses
  g.fill('nonzero');
  g.fill('nonzero');
  g.restore();

  // chat bubbles: outline, a tail toward the loop, a badge and a message row
  const bw = N(12, 10);
  const bh = N(8, 5);
  const rad = Math.max(1, 1.5 * k);
  for (let i = 0; i < BUBBLES.length; i++) {
    const [bu, bv] = BUBBLES[i];
    const pop = BUBBLE_AT[i] > 0 ? easeOutBack(range(BUBBLE_AT[i], BUBBLE_AT[i] + 0.06, p)) : 1;
    if (pop <= 0.05) continue;
    const x0 = clamp(P(bu) - Math.round(bw / 2), Math.ceil(box.x + 1), Math.floor(box.x + box.w - 1 - bw));
    const y0 = clamp(Q(bv) - Math.round(bh / 2), Math.ceil(box.y + 1), Math.floor(box.y + box.h - 1 - bh));
    g.save();
    if (pop < 1) {
      // a channel arriving pops in about its centre
      g.translate(x0 + bw / 2, y0 + bh / 2);
      g.scale(pop, pop);
      g.translate(-x0 - bw / 2, -y0 - bh / 2);
    }
    const bl = Math.max(1, lw - 1);
    g.beginPath();
    g.roundRect(x0 + bl / 2, y0 + bl / 2, bw - bl, bh - bl, rad);
    g.lineWidth = bl;
    g.strokeStyle = INK(1);
    g.stroke();
    // tail toward the loop
    const dir = bu < 0 ? 1 : -1;
    const tx = Math.round(x0 + bw / 2 + dir * bw * 0.2);
    const tw = Math.max(2, Math.round(bh * 0.3));
    g.beginPath();
    g.moveTo(tx - tw / 2, y0 + bh - 0.5);
    g.lineTo(tx + tw / 2, y0 + bh - 0.5);
    g.lineTo(tx + dir * tw, y0 + bh + tw);
    g.closePath();
    g.fillStyle = INK(1);
    g.fill();
    // an app badge and one message row
    const bs = Math.max(2, Math.min(3, bh - 2 * bl - 2));
    const bx = x0 + bl + 1;
    const by = y0 + Math.round((bh - bs) / 2);
    g.fillRect(bx, by, bs, bs);
    const rh = Math.min(2, bs);
    g.fillStyle = INK(0.55);
    g.fillRect(bx + bs + 1, by + Math.round((bs - rh) / 2), x0 + bw - bl - 1 - (bx + bs + 1), rh);
    g.restore();
  }

  // heartbeat: a monitor trace scrolling left under the loop
  const xa = P(-HW + 1);
  const xb = P(HW - 1);
  // centre the stroke on whole cells: an odd width on a cell centre, an even one on a cell edge
  const yb = Q(20) + (lw % 2) * 0.5;
  const amp = 4.5 * k;
  const sw = Math.max(3, 3.4 * k);
  const D = Math.max(sw * 4, (xb - xa) * 0.42);
  const kMax = Math.ceil((xb - xa) / D) + 2;
  g.beginPath();
  let pX = -Infinity;
  let pY = yb;
  let started = false;
  outer: for (let j = kMax; j >= -1; j--) {
    const xk = xb - (phase + j) * D - D * 0.35;
    for (const [bx, by] of BEAT) {
      const x = xk + bx * sw;
      const y = yb + by * amp;
      if (!started && x >= xa) {
        g.moveTo(xa, pX === -Infinity ? yb : pY + ((y - pY) * (xa - pX)) / (x - pX));
        started = true;
      }
      if (x > xb) {
        g.lineTo(xb, pY + ((y - pY) * (xb - pX)) / (x - pX));
        break outer;
      }
      if (started) g.lineTo(x, y);
      pX = x;
      pY = y;
    }
  }
  const grad = g.createLinearGradient(xa, 0, xb, 0);
  grad.addColorStop(0, INK(0.25));
  grad.addColorStop(0.5, INK(0.7));
  grad.addColorStop(1, INK(1));
  g.lineWidth = lw;
  g.strokeStyle = grad;
  g.stroke();
}

// ── scene ───────────────────────────────────────────────────────────────

const scene: Scene = {
  paint({ r, box, p, t }) {
    const L = layout(box);
    const vis = visibility(p);
    const g = r.begin();
    for (let s = 0; s < 3; s++) {
      const v = vis[s];
      if (v.inT <= 0 || v.outT >= 1) continue;
      const full = v.inT >= 1 && v.outT <= 0;
      g.save();
      if (!full) clipTo(g, box, v);
      if (s === 0) claudeCode(g, L, p, t);
      else if (s === 1) codex(g, L, p, t);
      else openClaw(g, L, box, p, t);
      pixelText(g, NAMES[s], L.ox, L.ly, INK(1), { scale: L.ls, align: 'center' });
      g.restore();
    }
    core(g, L, p, t);
    r.commit();
    // the product marks and Codex's cloud are painted cell by cell, straight
    // into the channels, under the same chunk test as their shells
    const [v0, v1] = vis;
    if (v0.inT > 0 && v0.outT < 1) spark(r, sparkAt(L, box), v0, t);
    if (v1.inT > 0 && v1.outT < 1) {
      const m = knotAt(L, box);
      cloud(r, L, v1, codexTerminal(L), m);
      knot(r, m, v1);
    }
  },
};

export default scene;
