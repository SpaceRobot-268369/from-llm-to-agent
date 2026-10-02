/**
 * subagents — a sub-agent is just another tool, told as a pixel office.
 *
 * Top: the MAIN AGENT, a manager in a tie behind a big desk, flanked by a
 * tall, leaning, messy stack of papers and a smaller messy pile (a full
 * context window). Bottom: three SUB-AGENTS, smaller workers at small, clean
 * desks, each with a monitor. Pixel-font labels under each group.
 *
 * p (scene progress) tells the story:
 *   0    – 0.15  idle: the manager is buried (sweating, mouth an "o"), the
 *                workers wait with their screens off.
 *   0.15 – 0.41  the manager peels one task card (accent) off the top of the
 *                stack for each worker (sends at 0.15 / 0.24 / 0.33, each a
 *                0.08 flight); the cards arc down and stick to the workers'
 *                monitors as sticky notes.
 *   0.23 – 0.82  each worker works from the moment its card lands: a chat
 *                bubble pops up over its screen (accent, then ink: a fresh
 *                chat session, as in 2.1), it turns to its screen, the screen
 *                types line after line, and a small loop ring with a runner
 *                turns above its head (its own agent loop). Its desk stays
 *                clean (a fresh context). The bubble needs room above the
 *                screen, so short boxes (mobile) leave it out.
 *   0.70 – 0.90  each worker sends back ONE portrait summary page (accent;
 *                leaves at 0.70 / 0.76 / 0.82) that is tossed up and dropped
 *                on the right of the manager's desk, where the small pile
 *                was, the three pages side by side; its screen shows a tick.
 *                Meanwhile the small pile is cleared, the tall stack shrinks
 *                and squares up into a neat pile of three, and the manager
 *                smiles.
 *   0.90 – 1     hold: a smiling manager between a neat pile and three
 *                one-page reports; three workers with ticks on their screens.
 * Sheets in flight are drawn last, in front of everything, clearing only
 * their own footprint (no dark halo biting into the desk or the labels).
 * t only adds calm ambient motion: the leaning stack sways a little, a loose
 * sheet drifts down beside it, a sweat drop bobs, the runners lap their rings
 * and the typing cursor pulses softly. Everything reads with t = 0.
 *
 * Layout: an org chart (manager above, workers in a row below), scaled to the
 * box in whole cells (the largest scale that fits, cached per box size) so
 * the pixel people stay crisp; spare height goes to the gap the cards cross.
 * Short boxes (mobile) move each worker's loop onto its screen, as a small
 * spinner, so the workers keep heads big enough for a face.
 */
import { easeInOut, hash2, range } from '../noise';
import type { Box, Scene } from './types';
import { ACC, INK, blink, pixelText, pixelTextWidth } from './helpers';

type G = CanvasRenderingContext2D;

const MAIN = 'MAIN AGENT';
const SUBS = 'SUB-AGENTS';
/** Pixel-font glyph height (cells). */
const FONT_H = 5;

/** When task card i leaves the manager's stack. */
const SEND = [0.15, 0.24, 0.33];
/** When summary i leaves worker i. */
const BACK = [0.7, 0.76, 0.82];
/** Length of one flight (scene progress). */
const FLY = 0.08;
/** The manager's stack squares up over this range. */
const TIDY: [number, number] = [0.7, 0.88];
/** Sheets left in the neat pile at the end. */
const NEAT = 3;
/** A stack this tall gives up its top sheet for each task card. */
const PEEL = 7;

/** A tick (✓) on a finished worker's screen: cells as [x, y]. */
const TICK5: [number, number][] = [
  [4, 0],
  [3, 1],
  [0, 2],
  [2, 2],
  [1, 3],
];
const TICK4: [number, number][] = [
  [3, 0],
  [0, 1],
  [2, 1],
  [1, 2],
];

/**
 * A chat bubble with "…" across its middle and a tail pointing down at the
 * worker (7 × 6): it pops up over a worker's screen when its task card lands —
 * each sub-agent is a fresh chat session (as in 2.1).
 */
const CHAT: string[] = ['.#####.', '#######', '#.#.#.#', '#######', '.#####.', '.##....'];
/** A flatter one (7 × 4) where there are fewer rows above the screen. */
const CHAT_M: string[] = ['.#####.', '#.#.#.#', '.#####.', '.##....'];
/** A smaller one (5 × 4) for tighter boxes. */
const CHAT_S: string[] = ['#####', '#.#.#', '#####', '.#...'];
/** How long a new chat bubble stays accent before it settles to ink. */
const CHAT_NEW = 0.08;

// ── pixel primitives (integer cells, so everything stays crisp) ─────────────

function rect(g: G, x: number, y: number, w: number, h: number, style: string) {
  if (w <= 0 || h <= 0) return;
  g.fillStyle = style;
  g.fillRect(x, y, w, h);
}

/** Erase to background (both channels): eyes, ties, gaps, halos. */
function cut(g: G, x: number, y: number, w: number, h: number) {
  if (w <= 0 || h <= 0) return;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#000';
  g.fillRect(x, y, w, h);
  g.globalCompositeOperation = 'lighter';
}

/** A solid block with its four corner cells cut (a pixel "rounded" rect). */
function blob(g: G, x: number, y: number, w: number, h: number, style: string) {
  rect(g, x, y, w, h, style);
  if (w >= 4 && h >= 4) {
    cut(g, x, y, 1, 1);
    cut(g, x + w - 1, y, 1, 1);
    cut(g, x, y + h - 1, 1, 1);
    cut(g, x + w - 1, y + h - 1, 1, 1);
  }
}

/** Ring cells (offsets from the centre) for a pixel circle of radius R, sorted by angle. */
const ringCache = new Map<number, [number, number, number][]>();
function ringCells(R: number) {
  let cells = ringCache.get(R);
  if (cells) return cells;
  cells = [];
  for (let y = -R - 1; y <= R + 1; y++) {
    for (let x = -R - 1; x <= R + 1; x++) {
      const d = Math.hypot(x, y);
      if (Math.abs(d - R) <= 0.5) cells.push([x, y, Math.atan2(y, x)]);
    }
  }
  cells.sort((a, b) => a[2] - b[2]);
  ringCache.set(R, cells);
  return cells;
}

/** A loop: a pixel ring with a ~3-cell solid runner at angle `a`, faded by `on`. */
function loop(g: G, cx: number, cy: number, R: number, a: number, on: number) {
  const cells = ringCells(R);
  const tail = (2.6 * Math.PI * 2) / cells.length;
  for (const [ox, oy, ang] of cells) {
    let d = (a - ang) % (Math.PI * 2);
    if (d < 0) d += Math.PI * 2;
    rect(g, cx + ox, cy + oy, 1, 1, INK((d < tail ? 1 : 0.5) * on));
  }
}

/**
 * A 3×3 loop on a small screen: a solid ring with a two-cell gap that turns
 * (a dotted ring would break up into mid-tone noise at this size).
 */
function spinner(g: G, cx: number, cy: number, a: number, on: number) {
  for (const [ox, oy, ang] of ringCells(1)) {
    let d = (((a - ang) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d > Math.PI / 4.2) rect(g, cx + ox, cy + oy, 1, 1, INK(on));
  }
}

/**
 * A page / card in accent with dark text lines cut into it. Only its own
 * footprint is cleared (ink wins a cell it shares with accent), so a sheet
 * flying in front of the desk or a label never bites a dark halo out of it.
 */
function sheet(g: G, x: number, y: number, w: number, h: number) {
  cut(g, x, y, w, h);
  rect(g, x, y, w, h, ACC(1));
  if (w >= 4 && h >= 3) {
    for (let row = 1; row < h - 1; row += 2) cut(g, x + 1, y + row, w - 2 - ((row >> 1) & 1), 1);
  }
}

/** Quadratic Bézier point. */
function qpt(x0: number, y0: number, qx: number, qy: number, x1: number, y1: number, s: number): [number, number] {
  const m = 1 - s;
  return [m * m * x0 + 2 * m * s * qx + s * s * x1, m * m * y0 + 2 * m * s * qy + s * s * y1];
}

// ── layout ─────────────────────────────────────────────────────────────────

type Dims = {
  k: number;
  /** Usable height of the box (the flight gap grows into what is left). */
  availH: number;
  /** How far right of the box centre the manager sits, so his row is centred. */
  shift: number;
  /** How far the top of the messy stack leans out (cells). */
  lean: number;
  // manager
  deskW: number;
  /** Manager's centre column and the small pile's (= the summary slots') left edge, from the desk's left end. */
  xMid: number;
  xPile: number;
  slab: number;
  legs: number;
  torsoW: number;
  torsoH: number;
  head: number;
  sheets: number;
  stackW: number;
  pileW: number;
  mAbove: number;
  // workers
  /** Desk overhang left of the person (0 on small boxes). */
  ov: number;
  /** Rows between a worker's head and its loop ring. */
  ringGap: number;
  /** The sticky note's offset above / from the left of its monitor. */
  stickUp: number;
  stickX: number;
  wDeskW: number;
  wSlab: number;
  wLegs: number;
  wTorsoW: number;
  wTorsoH: number;
  wHead: number;
  monW: number;
  monH: number;
  R: number;
  wAbove: number;
  pitch: number;
  card: [number, number];
  page: [number, number];
  // stacking
  lg: number;
  fly: number;
  /** Height of the whole composition at the minimum flight gap. */
  H: number;
};

/**
 * Sizes at scale k (cells per design unit), or null if it does not fit the box.
 * mode 0: each worker's loop spins above its head. mode 1 (short boxes): the
 * loop spins on its screen instead, so the people can stay big. mode 2
 * (tiny boxes): as 1, and smaller people with no desk legs.
 */
function dims(box: Box, k: number, mode: 0 | 1 | 2 = 0, force = false): Dims | null {
  const tiny = mode === 2;
  const S = (v: number, min = 1) => Math.max(min, Math.round(v * k));
  const m = tiny ? 1 : Math.max(2, Math.round(Math.min(box.w, box.h) * 0.05));
  const availW = box.w - 2 * m;
  const availH = box.h - 2 * m;

  // the papers in flight: a landscape task card, a portrait summary page
  const card: [number, number] = [Math.max(4, S(6.5)), Math.max(3, S(5))];
  const page: [number, number] = [Math.max(4, S(5.5)), Math.max(5, S(7))];

  // ── manager: along the desk, stack · gap · manager · gap · small pile
  // (where the three summaries land later, side by side)
  const slab = S(2);
  const legs = tiny ? 1 : S(4, 2);
  const torsoW = S(15, 7) | 1;
  const torsoH = S(7, tiny ? 3 : 4);
  const head = S(7.6, 5) | 1;
  // buried: the stack always towers over the manager's head (by less on
  // short boxes, where every row counts)
  const sheets = tiny ? 4 : mode ? Math.max(5, Math.ceil((torsoH + head + 3) / 2)) : Math.max(5, Math.round(13 * k), Math.ceil((torsoH + head + 4) / 2));
  const stackW = S(10, 6);
  const pileW = S(8, 5);
  const lean = S(5, 2);
  const xMid = S(1) + stackW + 2 + (torsoW >> 1);
  const xPile = xMid + (torsoW >> 1) + 2;
  const deskW = xPile + Math.max(pileW, 3 * page[0] + 2) + 2;
  // the stack can lean and jitter out past the desk's left end
  const reachL = xMid + lean + 3;
  const reachR = deskW - xMid;
  const mAbove = Math.max(sheets * 2 + 1, torsoH + head + 1);

  // ── workers: person · monitor on a small desk
  const ov = k >= 0.7 ? 1 : 0;
  const wTorsoW = S(8, 5) | 1;
  const wTorsoH = S(3, 2);
  const wHead = S(6, 3) | 1;
  // a screen a little wider than tall
  const monW = S(10, 6);
  const monH = S(8.5, 5);
  const wDeskW = ov + wTorsoW + 1 + monW + 1;
  const wSlab = S(2);
  const wLegs = tiny ? 0 : mode ? 1 : S(3, 1);
  // short boxes have no room above the heads: the loop spins on the screen
  const R = mode ? 0 : S(3.6, 2);
  const ringGap = k >= 0.7 ? 1 : 0;
  // a sticky note sits on the monitor's top-right corner, covering the top
  // frame and the blank row under it, never the typed lines; with the loop
  // on the screen (inner columns 0–2) it keeps right of the loop, and on
  // tiny boxes it slides down the right edge instead of poking up
  const stickUp = Math.max(0, card[1] - (tiny ? 3 : 2));
  const stickX = mode ? Math.max(4, monW - card[0] + 1) : monW - card[0] + 1;
  const wAbove = Math.max(monH + 1 + stickUp, R ? wTorsoH + wHead + 1 + ringGap + 2 * R : wTorsoH + wHead + 1);
  const pitch = wDeskW + S(3, 2);
  // the row is centred on the middle desk; a note may poke out on the right
  const reachW = Math.max(wDeskW, ov + wTorsoW + 1 + stickX + card[0]);
  const rowW = 2 * pitch + 2 * reachW - wDeskW;

  const lg = S(2, 1);
  const fly = tiny ? 1 : mode ? 2 : S(5, 2);
  const mH = mAbove + slab + legs;
  const wH = wAbove + wSlab + wLegs;
  const W = Math.max(reachL + reachR, rowW, pixelTextWidth(MAIN), pixelTextWidth(SUBS));
  const H = mH + lg + FONT_H + fly + wH + lg + FONT_H;
  if (!force && (W > availW || H > availH)) return null;
  return {
    k,
    availH,
    shift: (reachL - reachR) / 2,
    lean,
    deskW,
    xMid,
    xPile,
    slab,
    legs,
    torsoW,
    torsoH,
    head,
    sheets,
    stackW,
    pileW,
    mAbove,
    ov,
    ringGap,
    stickUp,
    stickX,
    wDeskW,
    wSlab,
    wLegs,
    wTorsoW,
    wTorsoH,
    wHead,
    monW,
    monH,
    R,
    wAbove,
    pitch,
    card,
    page,
    lg,
    fly,
    H,
  };
}

/** Largest scale that fits, per box size. */
const fitCache = new Map<string, Dims>();
function fitDims(box: Box): Dims {
  const key = `${box.w.toFixed(1)}|${box.h.toFixed(1)}`;
  let d = fitCache.get(key);
  if (d) return d;
  // people big enough for a face (worker heads of 5 cells) first: with the
  // loops above their heads, else on their screens; then smaller
  for (let k = 1.6; k >= 0.58 && !d; k -= 0.02) d = dims(box, k) ?? undefined;
  for (let k = 1.6; k >= 0.58 && !d; k -= 0.02) d = dims(box, k, 1) ?? undefined;
  for (let k = 0.58; k >= 0.3 && !d; k -= 0.02) d = dims(box, k) ?? undefined;
  for (let k = 0.6; k >= 0.3 && !d; k -= 0.02) d = dims(box, k, 2) ?? undefined;
  // nothing fits (a tiny box): draw at the smallest scale and let the engine clip
  if (!d) d = dims(box, 0.3, 2, true) as Dims;
  if (fitCache.size > 32) fitCache.clear();
  fitCache.set(key, d);
  return d;
}

/** One messy-or-neat pile of sheets seen edge-on: 1-row sheets with dark gaps. */
function pile(
  g: G,
  x: number,
  base: number,
  count: number,
  of: number,
  w: number,
  mess: number,
  seed: number,
  lean: number,
  t: number,
) {
  for (let j = 0; j < count; j++) {
    const y = base - 2 * j;
    const [sx, sw] = sheetSpan(x, j, w, mess, seed, lean, t, of);
    cut(g, sx - 1, y - 1, sw + 2, 2);
    // now and then a sheet lies askew: half of it a row higher
    if (mess > 0.5 && j > 0 && hash2(j, seed + 9, 3) > 0.7) {
      const h = sw >> 1;
      const up = hash2(j, seed + 2, 3) > 0.5;
      rect(g, sx, up ? y : y - 1, h, 1, INK(1));
      rect(g, sx + h, up ? y - 1 : y, sw - h, 1, INK(1));
    } else rect(g, sx, y, sw, 1, INK(1));
  }
}

/** Left edge and width of sheet j: jittered, leaning left, a few sticking out. */
function sheetSpan(x: number, j: number, w: number, mess: number, seed: number, lean: number, t: number, of: number): [number, number] {
  const f = j / Math.max(1, of - 1);
  const jit = (lean > 0 ? -3 : 2) * hash2(j, seed, 3);
  const sway = f * f * f * Math.sin(t * 0.9 + j * 0.45) * 1.2;
  const sx = x + Math.round(mess * (jit - f * f * lean + sway));
  const stick = hash2(j, seed + 6, 3) > 0.72 ? Math.round(mess * 3) : 0;
  const sw = w + Math.round(mess * (hash2(j, seed + 4, 3) - 0.5) * 2);
  return lean > 0 ? [sx - stick, sw + stick] : [sx, sw + stick];
}

const scene: Scene = {
  paint({ r, box, p, t }) {
    const g = r.begin();
    const D = fitDims(box);
    const S = (v: number, min = 1) => Math.max(min, Math.round(v * D.k));
    // the flight gap between manager and workers takes most of the spare height
    const spare = Math.max(0, D.availH - D.H);
    const fly = D.fly + Math.floor(spare * 0.6);
    const top = Math.round(box.cy - (D.H + Math.floor(spare * 0.6)) / 2);

    // ── where things go
    const dy = top + D.mAbove; // manager desk top
    const mx = Math.round(box.cx + D.shift); // manager's centre column
    const dx = mx - D.xMid; // desk's left end
    const labelY = dy + D.slab + D.legs + D.lg;
    const wTop = labelY + FONT_H + fly;
    const stackX = dx + S(1);
    const pileX = dx + D.xPile;
    const wy = wTop + D.wAbove; // workers' desk top

    // story values
    const tidy = easeInOut(range(TIDY[0], TIDY[1], p));
    const mess = 1 - tidy;
    let n = D.sheets;
    // each task card is peeled off the top of the stack (when it is tall enough to spare one)
    if (D.sheets >= PEEL) for (let i = 0; i < 3; i++) n -= p >= SEND[i] + 0.015 ? 1 : 0;
    n = Math.round(n + (NEAT - n) * tidy);
    // the right-hand pile is cleared away just before the first summary lands
    const nRight = Math.round(S(5, 3) * (1 - range(TIDY[0], BACK[0] + FLY - 0.01, p)));

    // ── manager: torso, tie, head (behind the desk)
    const tx = mx - (D.torsoW >> 1);
    blob(g, tx, dy - D.torsoH, D.torsoW, D.torsoH + D.slab, INK(1));
    const hx = mx - (D.head >> 1);
    const hy = dy - D.torsoH - D.head;
    blob(g, hx, hy, D.head, D.head, INK(1));
    // a tie: dark lapel lines either side of a blade that widens below the knot
    // (on a small torso, just a dark tie under an open collar)
    const ty = dy - D.torsoH;
    if (D.torsoW >= 11) {
      const knot = Math.min(2, D.torsoH - 2);
      cut(g, mx - 1, ty, 1, knot + 1);
      cut(g, mx + 1, ty, 1, knot + 1);
      cut(g, mx - 2, ty + knot + 1, 1, D.torsoH);
      cut(g, mx + 2, ty + knot + 1, 1, D.torsoH);
    } else {
      cut(g, mx - 1, ty, 3, 1);
      cut(g, mx, ty + 1, 1, D.torsoH);
    }
    // face: eyes, and a mouth that turns from a worried "o" to a smile
    const ex = Math.max(1, Math.round(D.head * 0.28));
    const ey = hy + Math.max(1, Math.floor(D.head * 0.3));
    cut(g, hx + ex, ey, 1, 1);
    cut(g, hx + D.head - 1 - ex, ey, 1, 1);
    const my = hy + D.head - 2;
    if (tidy < 0.5) cut(g, mx, my, 1, 1);
    else {
      cut(g, mx - 1, my, 3, 1);
      if (D.head >= 7) {
        cut(g, mx - 2, my - 1, 1, 1);
        cut(g, mx + 2, my - 1, 1, 1);
      }
    }
    // a sweat drop while it is buried
    if (mess > 0.4) {
      const bob = Math.round(Math.sin(t * 1.6) * 0.6 + 0.4);
      const sx = hx + D.head + 1;
      const sy = hy + 1 + bob;
      rect(g, sx, sy + 1, 1, 1, INK(1));
      rect(g, sx, sy, 1, 1, INK(0.55));
    }

    // ── manager's desk
    rect(g, dx, dy, D.deskW, D.slab, INK(1));
    const pedW = S(9, 6);
    const pedX = dx + S(1);
    rect(g, pedX, dy + D.slab, pedW, D.legs, INK(1));
    if (D.legs >= 3) {
      const dr = dy + D.slab + Math.floor(D.legs / 2);
      cut(g, pedX + 1, dr, pedW - 2, 1);
      cut(g, pedX + (pedW >> 1), dr - 1, 1, 1);
      if (D.legs >= 4) cut(g, pedX + (pedW >> 1), dr + 1, 1, 1);
    }
    rect(g, dx + D.deskW - 1 - S(2), dy + D.slab, S(2), D.legs, INK(1));

    // ── the papers: a tall stack leaning off the left of the desk, a smaller
    // one on the right; both square up and shrink as the work comes back
    pile(g, stackX, dy - 1, n, D.sheets, D.stackW, mess, 7, D.lean, t);
    pile(g, pileX, dy - 1, nRight, S(5, 3), D.pileW, mess, 21, 0, t);
    // a loose sheet drifting down beside the stack
    if (mess > 0.5 && n > 4) {
      const fall = (t / 7) % 1;
      const y0 = dy - 1 - 2 * (n - 1);
      const fy = Math.round(y0 + fall * (dy - 2 - y0));
      const fx = Math.round(stackX - D.lean - S(3, 2) + Math.sin(fall * 9) * 1.5);
      if (fx >= Math.ceil(box.x) + 1) rect(g, fx, fy, S(3, 2), 1, INK(1));
    }

    // ── workers
    const sticky: [number, number][] = [];
    const ring: [number, number][] = [];
    for (let i = 0; i < 3; i++) {
      const wcx = Math.round(box.cx + (i - 1) * D.pitch);
      const wdx = wcx - (D.wDeskW >> 1);
      const land = SEND[i] + FLY;
      const back = BACK[i];
      // person (behind the desk)
      const px = wdx + D.ov + (D.wTorsoW >> 1);
      blob(g, wdx + D.ov, wy - D.wTorsoH, D.wTorsoW, D.wTorsoH + D.wSlab, INK(1));
      if (D.wTorsoW >= 7) cut(g, px, wy - D.wTorsoH, 1, 1); // collar
      const whx = px - (D.wHead >> 1);
      const why = wy - D.wTorsoH - D.wHead;
      blob(g, whx, why, D.wHead, D.wHead, INK(1));
      if (D.wHead >= 5) {
        // eyes: on the reader while idle, turned to the screen while working
        const look = p >= land && p < back ? 1 : 0;
        const wex = Math.round(D.wHead * 0.25) + look;
        const wey = why + Math.round(D.wHead * 0.4);
        cut(g, whx + wex, wey, 1, 1);
        cut(g, whx + D.wHead - 1 - wex + 2 * look, wey, 1, 1);
      } else {
        // too small for a face: one eye on the side facing the screen
        cut(g, whx + D.wHead - 1, why + 1, 1, 1);
      }
      ring.push([px, why - 1 - D.ringGap - D.R]);

      // desk
      rect(g, wdx, wy, D.wDeskW, D.wSlab, INK(1));
      rect(g, wdx + D.ov, wy + D.wSlab, 1, D.wLegs, INK(1));
      rect(g, wdx + D.wDeskW - 2, wy + D.wSlab, 1, D.wLegs, INK(1));

      // monitor: frame, stand, screen
      const mX = wdx + D.ov + D.wTorsoW + 1;
      const mY = wy - 1 - D.monH;
      rect(g, mX, mY, D.monW, D.monH, INK(1));
      cut(g, mX + 1, mY + 1, D.monW - 2, D.monH - 2);
      rect(g, mX + (D.monW >> 1) - 1, wy - 1, 2, 1, INK(1));
      sticky.push([mX + D.stickX, mY - D.stickUp]);

      const iw = D.monW - 3; // text area inside the frame (from a 1-cell padding)
      const ix = mX + 2;
      const rows = Math.max(1, Math.floor((D.monH - 3) / 2));
      const on = range(land, land + 0.03, p) * (1 - range(back, back + 0.03, p));
      if (!D.R && p >= land && p < back + 0.03) {
        // short boxes: the worker's loop spins on its screen
        if (on > 0) spinner(g, mX + 2, mY + 2, Math.PI * 1.5 + i * 2.1 + t * 2.2 + p * 40, on);
      } else if (p >= land && p < back) {
        // typing: line after line, then a soft cursor
        const work = range(land, back - 0.03, p);
        let total = 0;
        const lens: number[] = [];
        for (let j = 0; j < rows; j++) {
          const len = Math.max(1, Math.floor(iw * (0.5 + 0.45 * hash2(i, j, 5))));
          lens.push(len);
          total += len;
        }
        let left2 = Math.round(total * (0.15 + 0.85 * work));
        let cx = ix;
        let cy = mY + 2;
        for (let j = 0; j < rows && left2 > 0; j++) {
          const len = Math.min(lens[j], left2);
          rect(g, ix, mY + 2 + 2 * j, len, 1, INK(1));
          left2 -= len;
          cx = ix + len + 1;
          cy = mY + 2 + 2 * j;
          if (len === lens[j] && j + 1 < rows && left2 > 0) {
            cx = ix;
            cy = mY + 2 + 2 * (j + 1);
          }
        }
        if (cx < mX + D.monW - 1) rect(g, cx, cy, 1, 1, INK(blink(t, 1.6, 0.4)));
      } else if (p >= back) {
        // done: a tick on the screen
        const cw = D.monW - 2;
        const ch = D.monH - 2;
        const tick = cw >= 6 && ch >= 5 ? TICK5 : TICK4;
        const tw = tick === TICK5 ? 5 : 4;
        const th = tick === TICK5 ? 4 : 3;
        const ox = mX + 1 + Math.floor((cw - tw) / 2);
        const oy = mY + 1 + Math.floor((ch - th) / 2);
        const tickOn = D.R ? range(back, back + 0.03, p) : range(back + 0.03, back + 0.05, p);
        for (const [a, b] of tick) rect(g, ox + a, oy + b, 1, 1, INK(tickOn));
      }

      // its own loop: a small ring with a runner above its head
      if (on > 0 && D.R) loop(g, ring[i][0], ring[i][1], D.R, Math.PI * 1.5 + i * 2.1 + t * 2.2 + p * 40, on);

      // a new chat session: a chat bubble pops up over its screen as the card
      // lands (accent), then stays. Only where there is room above the screen,
      // right of its own loop and clear of the next worker's.
      if (p >= land) {
        const side = D.R || D.wHead >> 1;
        const xLo = Math.max(mX, px + side + 2);
        const xHi = i < 2 ? px + D.pitch - side - 1 : Math.floor(box.x + box.w);
        const glyph = [CHAT, CHAT_M, CHAT_S].find((c) => xHi - xLo >= c[0].length && mY - D.stickUp - 1 - c.length >= labelY + FONT_H + 2);
        if (glyph) {
          const gw = glyph[0].length;
          const cy0 = mY - D.stickUp - 1 - glyph.length;
          const cx0 = Math.min(xHi - gw, Math.max(xLo, mX + ((D.monW - gw) >> 1)));
          const style = p < land + CHAT_NEW ? ACC(1) : INK(1);
          for (let yy = 0; yy < glyph.length; yy++) {
            for (let xx = 0; xx < gw; xx++) if (glyph[yy][xx] === '#') rect(g, cx0 + xx, cy0 + yy, 1, 1, style);
          }
        }
      }
    }

    // ── labels
    pixelText(g, MAIN, mx, labelY, INK(1), { align: 'center' });
    pixelText(g, SUBS, Math.round(box.cx), wy + D.wSlab + D.wLegs + D.lg, INK(1), { align: 'center' });

    // ── summaries: three one-page reports standing side by side on the right
    // of the manager's desk (where the small pile was; worker i's in slot i),
    // then the ones in flight. Everything in flight is drawn last, in front.
    const [cw, ch] = D.card;
    const [pw, ph] = D.page;
    const ceil = Math.ceil(box.y) + 1;
    for (let i = 0; i < 3; i++) {
      const s = range(BACK[i], BACK[i] + FLY, p);
      if (s <= 0) continue;
      const x1 = pileX + i * (pw + 1);
      const y1 = dy - ph;
      if (s >= 1) {
        sheet(g, x1, y1, pw, ph);
        continue;
      }
      // it leaves from where the task card was stuck, is tossed up over the
      // desk and dropped onto its slot
      const x0 = sticky[i][0] + ((cw - pw) >> 1);
      const y0 = sticky[i][1];
      const qy = Math.max(ceil, y1 - S(6, 3));
      const [fx, fy] = qpt(x0, y0, x1 + (x0 - x1) * 0.15, qy, x1, y1, easeInOut(s));
      sheet(g, Math.round(fx), Math.round(fy), pw, ph);
    }

    // ── task cards: peel off the stack, fly to a worker, stick to its monitor
    for (let i = 0; i < 3; i++) {
      const s = range(SEND[i], SEND[i] + FLY, p);
      if (s <= 0 || p >= BACK[i]) continue;
      const [x1, y1] = sticky[i];
      if (s >= 1) {
        sheet(g, x1, y1, cw, ch);
        continue;
      }
      const j0 = D.sheets - 1 - (D.sheets >= PEEL ? i : 0);
      const [sx0, sw0] = sheetSpan(stackX, j0, D.stackW, 1, 7, D.lean, t, D.sheets);
      const x0 = sx0 + (sw0 >> 1) - (cw >> 1);
      const y0 = dy - 1 - 2 * j0 - ch;
      const qx = (x0 + x1) / 2;
      const qy = Math.max(ceil, y0 - S(6, 3));
      const [fx, fy] = qpt(x0, y0, qx, qy, x1, y1, easeInOut(s));
      sheet(g, Math.round(fx), Math.round(fy), cw, ch);
    }

    r.commit();
  },
};

export default scene;
