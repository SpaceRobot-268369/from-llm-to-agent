/**
 * Live pops: turns clicks on empty space into pops, keeps them in flight, and
 * paints them into a PopBuffer each frame (PixelField layers it over the
 * field).
 *
 * A click is routed, first match wins:
 *   1. CHAIN — within CHAIN_MS of the last routed click and CHAIN_CELLS of the
 *      chain's anchor: clicks 2–3 tickle the pop click 1 made, click 4 swaps
 *      it for the combo (wrap-it-up), clicks 5–7 add the combo's rings.
 *   2. BOOP — on a live pop: it pauses, squints, and puffs a heart.
 *   3. SPAWN — anywhere else: deal the next pop from a shuffled deck (each
 *      chapter's own pop first when the visitor arrives in it) and lay it out
 *      where it fits: inside the grid, clear of text, the HUD and diagrams.
 *      In a spot too tight for any of them, a small twinkle answers instead.
 *
 * Pops are anchored to the viewport, so scrolling hurries them out (they
 * crumble in pixel chunks), as does running past MAX_LIVE.
 */
import { SECTIONS } from '../../content/sections';
import { intro } from '../intro';
import { ticker } from '../ticker';
import type { PopBuffer } from './buffer';
import { crumbled, stamp, steps, until } from './helpers';
import { Page } from './hit';
import { COMBO, DECK, FALLBACK, HOME, POPS, type PopId } from './index';
import type { Fit, LifeState, Pen, PopCtx, PopState, Reach } from './types';
import { comboReach, RADII } from './wrap-it-up';

/** at most this many pops on screen (the combo counts as one); a new one hurries the oldest out */
const MAX_LIVE = 8;
/** a tap is a touch that moves less than this (CSS px) … */
const TAP_SLOP = 8;
/** … and lifts within this (ms); a scroll flick never pops */
const TAP_MS = 300;
/** a click within this (ms) of the last one … */
const CHAIN_MS = 450;
/** … and this close to the chain's first click (cells, Chebyshev; touch is less precise) continues the chain */
const CHAIN_CELLS = 5;
const CHAIN_CELLS_TOUCH = 6;
/** soft throttle between two spawns (ms) */
const SPAWN_GAP = 250;
/** a boop pauses the pop this long (s); a tickle is a shorter, heartless boop */
const BOOP_PAUSE = 0.25;
const TICKLE_PAUSE = 0.12;
/** a third boop makes a pop shy: it hurries out */
const MAX_BOOPS = 2;
/** hurrying out: the pop crumbles in blocks over this long (s) */
const HURRY = 0.2;
const HURRY_FOR_COMBO = 0.15;
/** fit: at most this share of a pop's footprint may sit on a diagram (scene ink >= SCENE_INK) */
const SCENE_SHARE = 0.1;
const SCENE_INK = 0.42;
/** fit: how far (cells) a pop may be nudged from the click to find room */
const NUDGE = 3;
/** the boop's heart, drawn above the pop (accent) */
const BOOP_HEART = ['@@ @@', '@@@@@', ' @@@ ', '  @  '];
/** the boop heart: seconds per row it rises, and its fade down the exact tones [until s, value] — gone after the last */
const HEART_RISE = 0.13;
const HEART_FADE: readonly (readonly [number, number])[] = [
  [0.16, 1],
  [0.26, 0.75],
  [0.34, 0.5],
  [0.4, 0.25],
];
/** the heart's reach around its bottom-centre cell, over its whole rise */
const HEART_REACH: Reach = [-2, -3 - steps(0.4, HEART_RISE), 2, 0];

/** one pause in a pop's timeline: a boop or a tickle, at real age `at` (s) */
type Pause = { at: number; dur: number; kind: 'boop' | 'tickle' };

type Live = {
  id: PopId;
  /** the anchor cell's centre, in CSS px (viewport) */
  px: number;
  py: number;
  /** real clock (s) at spawn; moved by a reduced-motion boop (the still's hold restarts) */
  t0: number;
  seed: number;
  fit: Fit;
  ctx: PopCtx;
  /** scroll position at spawn: moving away hurries the pop out */
  scroll: number;
  /** in time order */
  pauses: Pause[];
  boops: number;
  /** the combo's ring times (effective age, s) */
  ringT: number[];
  /** hurrying out: clock (s) it started, its length, and the effective age it froze at */
  hurry: { at: number; dur: number; age: number } | null;
  /** the cells it drew last frame [x0, y0, x1, y1] (inclusive); `drawn` false = nothing yet */
  box: [number, number, number, number];
  drawn: boolean;
  /** the boop heart: clock (s) at the boop and the cell its bottom-centre starts on */
  heart: { at: number; x: number; y: number } | null;
};

/**
 * The grid as last rendered, kept by PixelField every frame. `scene` = each
 * cell's scene value before dust; `dy` = how far the page scrolled that frame.
 */
export type FieldInfo = {
  cols: number;
  rows: number;
  cell: number;
  offX: number;
  offY: number;
  scene: Float32Array;
  y: number;
  dy: number;
};

export type PopFrame = {
  clock: number;
  cell: number;
  offX: number;
  offY: number;
  mobile: boolean;
  reduced: boolean;
  /** the accent renders as paper here (chapter cards, signature sections) */
  paper: boolean;
};

/**
 * A pen around the frame's buffer that records the box a pop drew (for the
 * boop hit test and the heart) and, while it hurries out, drops cells in
 * blocks like the page's dissolve.
 */
class LivePen implements Pen {
  b!: PopBuffer;
  x0 = 0;
  y0 = 0;
  x1 = 0;
  y1 = 0;
  /** hurry crumble 0..1 (0 = whole), keyed to the anchor cell */
  crumble = 0;
  cx = 0;
  cy = 0;
  seed = 0;

  get w() {
    return this.b.w;
  }
  get h() {
    return this.b.h;
  }

  reset(b: PopBuffer, cx: number, cy: number, seed: number, crumble: number) {
    this.b = b;
    this.cx = cx;
    this.cy = cy;
    this.seed = seed;
    this.crumble = crumble;
    this.x0 = this.y0 = Infinity;
    this.x1 = this.y1 = -Infinity;
  }

  private keep(x: number, y: number): boolean {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (this.crumble > 0 && crumbled(xi - this.cx, yi - this.cy, this.crumble, this.seed + 997)) return false;
    if (xi < this.x0) this.x0 = xi;
    if (xi > this.x1) this.x1 = xi;
    if (yi < this.y0) this.y0 = yi;
    if (yi > this.y1) this.y1 = yi;
    return true;
  }

  dot(x: number, y: number, v: number, accent = false) {
    if (v > 0 && this.keep(x, y)) this.b.dot(x, y, v, accent);
  }

  punch(x: number, y: number, v: number) {
    if (v > 0 && this.keep(x, y)) this.b.punch(x, y, v);
  }

  /** copy the drawn box into p's; false when nothing was drawn */
  boxInto(box: [number, number, number, number]): boolean {
    if (this.x0 > this.x1) return false;
    box[0] = this.x0;
    box[1] = this.y0;
    box[2] = this.x1;
    box[3] = this.y1;
    return true;
  }
}

const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** nudge offsets within NUDGE cells, nearest first (the click itself first) */
const NUDGES: [number, number][] = [];
for (let y = -NUDGE; y <= NUDGE; y++) for (let x = -NUDGE; x <= NUDGE; x++) NUDGES.push([x, y]);
NUDGES.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));

/** the chapter of the section under the viewport centre */
function ctxNow(): PopCtx {
  const f = ticker.frame;
  const s = SECTIONS[f.blend > 0.5 && f.next >= 0 ? f.next : f.cur];
  if (!s || s.kind === 'hero') return 'hero';
  if (s.kind === 'finale') return 'finale';
  return s.chapter === 3 ? 'harness' : s.chapter === 2 ? 'memory' : 'model';
}

/** probe cells along one axis of a footprint (+ its margin): both ends and every even cell between, ≤ 2 apart */
function axis(a: number, b: number, out: number[]): number[] {
  out.length = 0;
  out.push(a);
  for (let v = (a + 2) & ~1; v < b; v += 2) out.push(v);
  if (b > a) out.push(b);
  return out;
}

/**
 * Where pops may go, for one click: grid bounds, the HUD, diagrams (scene
 * ink), and the page (DOM probes on a lattice of even cells, so footprints
 * tried at different nudges share them; a cell found blocked rejects every
 * footprint that covers it without probing again).
 */
class Room {
  private probes = new Map<number, boolean>();
  private blocked: number[] = [];
  private xs: number[] = [];
  private ys: number[] = [];

  constructor(
    private g: FieldInfo,
    private page: Page,
  ) {}

  /** is cell (x, y) bare page? (probed at its centre, cached) */
  free(x: number, y: number): boolean {
    const key = y * 4096 + x;
    let v = this.probes.get(key);
    if (v === undefined) {
      const { cell, offX, offY } = this.g;
      v = this.page.empty(offX + (x + 0.5) * cell, offY + (y + 0.5) * cell);
      this.probes.set(key, v);
      if (!v) this.blocked.push(x, y);
    }
    return v;
  }

  /** does the reach fit around cell (cx, cy)? */
  fits(cx: number, cy: number, r: Reach): boolean {
    const { cols, rows, cell, offX, offY, scene } = this.g;
    const x0 = cx + r[0];
    const y0 = cy + r[1];
    const x1 = cx + r[2];
    const y1 = cy + r[3];
    // inside the grid, with a one-cell margin
    if (x0 < 1 || y0 < 1 || x1 > cols - 2 || y1 > rows - 2) return false;
    // clear of the HUD (footprint + one cell, in px)
    const l = offX + (x0 - 1) * cell;
    const t = offY + (y0 - 1) * cell;
    const rr = offX + (x1 + 2) * cell;
    const bb = offY + (y1 + 2) * cell;
    for (const h of this.page.hud) if (l < h.right && rr > h.left && t < h.bottom && bb > h.top) return false;
    // a cell already found blocked inside the footprint + margin
    const bl = this.blocked;
    for (let i = 0; i < bl.length; i += 2) {
      if (bl[i] >= x0 - 1 && bl[i] <= x1 + 1 && bl[i + 1] >= y0 - 1 && bl[i + 1] <= y1 + 1) return false;
    }
    // mostly off the diagrams (the DOM can't see them)
    let inked = 0;
    const limit = SCENE_SHARE * (x1 - x0 + 1) * (y1 - y0 + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) if (scene[y * cols + x] >= SCENE_INK && ++inked > limit) return false;
    }
    // clear of text and panels: the probe lattice over the footprint + one cell
    const xs = axis(x0 - 1, x1 + 1, this.xs);
    const ys = axis(y0 - 1, y1 + 1, this.ys);
    for (const y of ys) for (const x of xs) if (!this.free(x, y)) return false;
    return true;
  }

  /** the side (+1 right / -1 left) with more bare page next to cell (cx, cy) */
  side(cx: number, cy: number, seed: number): 1 | -1 {
    let score = 0;
    for (let dy = 0; dy >= -4; dy -= 4) {
      for (let d = 4; d <= 12; d += 4) {
        if (this.free(cx + d, cy + dy)) score++;
        if (this.free(cx - d, cy + dy)) score--;
      }
    }
    return score > 0 ? 1 : score < 0 ? -1 : seed & 1 ? 1 : -1;
  }
}

class Pops {
  private live: Live[] = [];
  private deck: PopId[] = [];
  private last: PopId | null = null;
  private lastCtx: PopCtx | null = null;
  private lastSpawn = -Infinity;
  private seed = (Math.random() * 1e9) | 0;
  private pen = new LivePen();
  /** the chain: last routed click (frame clock, ms), its anchor cell, its length, and the pop it plays with */
  private chain = { at: -Infinity, x: 0, y: 0, n: 0, pop: null as Live | null };
  /** reused every frame, so painting allocates nothing */
  private pointer = { x: 0, y: 0 };
  private lifeState: LifeState = { ringT: [], reduced: false, ctx: 'model' };
  private state: PopState = {
    b: this.pen,
    x: 0,
    y: 0,
    age: 0,
    k: 0,
    seed: 0,
    dir: 1,
    size: 0,
    squint: false,
    paper: false,
    ctx: 'model',
    pointer: null,
    ringT: [],
    cols: 0,
    rows: 0,
    cell: 1,
    mobile: false,
    reduced: false,
  };
  /** the grid as last rendered (PixelField keeps it current) */
  field: FieldInfo | null = null;

  get any(): boolean {
    return this.live.length > 0;
  }

  // ── the deck ───────────────────────────────────────────────────────────

  /** a fresh shuffled deck (Fisher–Yates), never starting with the pop that just played; the top is the end */
  private shuffle() {
    const d = [...DECK];
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    if (d.length > 1 && d[d.length - 1] === this.last) [d[0], d[d.length - 1]] = [d[d.length - 1], d[0]];
    this.deck = d;
  }

  /** the pops to try for a spawn, best first: the deck top-down, then the rest; the pop that just played goes last */
  private candidates(ctx: PopCtx): PopId[] {
    if (!this.deck.length) this.shuffle();
    // arriving in a chapter deals its own pop first, unless it played this deck or just now
    if (ctx !== this.lastCtx) {
      const home = HOME[ctx];
      const i = this.deck.indexOf(home);
      if (i >= 0 && home !== this.last) this.deck.push(...this.deck.splice(i, 1));
    }
    const top = [...this.deck].reverse();
    const rest = DECK.filter((id) => !top.includes(id));
    const order = [...top, ...rest].filter((id) => id !== this.last);
    return this.last ? [...order, this.last] : order;
  }

  private dealt(id: PopId, ctx: PopCtx) {
    const i = this.deck.indexOf(id);
    if (i >= 0) this.deck.splice(i, 1);
    this.last = id;
    this.lastCtx = ctx;
  }

  // ── timeline ───────────────────────────────────────────────────────────

  /**
   * A pop's effective age (s): real age minus the time it spent paused,
   * frozen while it hurries out. Overlapping pauses (a boop, then a quick
   * tickle) freeze it once, over their union, so it never runs backwards.
   */
  private age(p: Live, clock: number): number {
    if (p.hurry) return p.hurry.age;
    const real = clock - p.t0;
    let a = real;
    let end = -Infinity;
    for (const q of p.pauses) {
      const s = Math.max(q.at, end);
      const e = q.at + q.dur;
      if (e > s) a -= Math.min(Math.max(real - s, 0), e - s);
      if (e > end) end = e;
    }
    return Math.max(0, a);
  }

  private life(p: Live, reduced: boolean): number {
    const pop = POPS[p.id];
    if (!pop.lifeOf) return reduced ? (pop.reducedLife ?? pop.life) : pop.life;
    const s = this.lifeState;
    s.ringT = p.ringT;
    s.reduced = reduced;
    s.ctx = p.ctx;
    return pop.lifeOf(s);
  }

  private hurry(p: Live, clock: number, dur = HURRY) {
    if (!p.hurry) p.hurry = { at: clock, dur, age: this.age(p, clock) };
  }

  /**
   * Pause p for a boop or a tickle: its timeline stops and it squints. Under
   * reduced motion nothing moves, but the face still changes, and the
   * still's hold restarts from where the still begins (holdStart: for the
   * combo, its reward — the stack never replays).
   */
  private pause(p: Live, kind: Pause['kind'], clock: number, reduced: boolean) {
    if (reduced) {
      const s = this.lifeState;
      s.ringT = p.ringT;
      s.reduced = true;
      s.ctx = p.ctx;
      const start = POPS[p.id].holdStart?.(s) ?? 0;
      if (this.age(p, clock) > start) {
        // a hair past the start, so a still that begins exactly at it is never shown a frame early
        p.t0 = clock - start - 1e-6;
        p.pauses.length = 0;
      }
    }
    p.pauses.push({ at: clock - p.t0, dur: kind === 'boop' ? BOOP_PAUSE : TICKLE_PAUSE, kind });
  }

  // ── clicks ─────────────────────────────────────────────────────────────

  /**
   * Route a click on empty space at viewport point (x, y), CSS px. `page` is
   * the snapshot the click was found empty on (reused to lay the pop out).
   */
  click(x: number, y: number, touch: boolean, page = new Page()) {
    const g = this.field;
    if (!g) return;
    const f = ticker.frame;
    const clock = f.clock;
    // the chain and the throttle run on the frame clock too, like the pops' timelines
    const now = clock * 1000;
    const cx = Math.floor((x - g.offX) / g.cell);
    const cy = Math.floor((y - g.offY) / g.cell);
    const c = this.chain;

    // 1. chain: rapid clicks in one spot
    if (now - c.at <= CHAIN_MS && cheb(cx, cy, c.x, c.y) <= (touch ? CHAIN_CELLS_TOUCH : CHAIN_CELLS)) {
      c.at = now;
      c.n++;
      const target = c.pop && !c.pop.hurry && this.live.includes(c.pop) ? c.pop : null;
      if (c.n <= 3) {
        if (target) this.pause(target, 'tickle', clock, f.reduced);
      } else if (c.n === 4) {
        // the combo needs room for ring 1 and its reward; otherwise the chain just ends
        if (new Room(g, page).fits(c.x, c.y, comboReach(1))) {
          if (target) this.hurry(target, clock, HURRY_FOR_COMBO);
          c.pop = this.add(COMBO, c.x, c.y, { dir: 1, size: 0 }, ctxNow(), g, clock);
        }
      } else if (c.n <= 3 + RADII.length && target?.id === COMBO && target.ringT.length < RADII.length) {
        if (new Room(g, page).fits(c.x, c.y, comboReach(target.ringT.length + 1))) {
          target.ringT.push(this.age(target, clock));
        }
      }
      return;
    }

    // 2. boop: a click on a live pop, newest first
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      if (p.hurry || !p.drawn) continue;
      const [x0, y0, x1, y1] = p.box;
      if (cx < x0 - 1 || cx > x1 + 1 || cy < y0 - 1 || cy > y1 + 1) continue;
      Object.assign(c, { at: now, x: cx, y: cy, n: 1, pop: p });
      if (++p.boops > MAX_BOOPS) {
        this.hurry(p, clock); // shy
        return;
      }
      this.pause(p, 'boop', clock, f.reduced);
      // the heart floats above the pop, where there's room for its whole rise
      const hx = Math.floor((x0 + x1) / 2);
      const hy = y0 - 2;
      p.heart = new Room(g, page).fits(hx, hy, HEART_REACH) ? { at: clock, x: hx, y: hy } : null;
      return;
    }

    // 3. spawn: not while the page is still gliding (the pop would hurry out at once), nor right after another
    if (Math.abs(g.dy) > 0.5 || now - this.lastSpawn < SPAWN_GAP) return;
    Object.assign(c, { at: now, x: cx, y: cy, n: 1, pop: null });
    const ctx = ctxNow();
    const seed = (this.seed += 7919);
    const room = new Room(g, page);
    const side = room.side(cx, cy, seed);
    for (const id of [...this.candidates(ctx), FALLBACK]) {
      const layouts = POPS[id].layouts(seed, side);
      for (const [dx, dy] of NUDGES) {
        const hit = layouts.find((l) => room.fits(cx + dx, cy + dy, l.reach));
        if (!hit) continue;
        if (id !== FALLBACK) this.dealt(id, ctx);
        this.lastSpawn = now;
        c.pop = this.add(id, cx + dx, cy + dy, hit.fit, ctx, g, clock, seed);
        return;
      }
    }
  }

  private add(id: PopId, cx: number, cy: number, fit: Fit, ctx: PopCtx, g: FieldInfo, clock: number, seed = (this.seed += 7919)) {
    const oldest = this.live.find((p) => !p.hurry);
    if (oldest && this.live.filter((p) => !p.hurry).length >= MAX_LIVE) this.hurry(oldest, clock);
    const p: Live = {
      id,
      px: g.offX + (cx + 0.5) * g.cell,
      py: g.offY + (cy + 0.5) * g.cell,
      t0: clock,
      seed,
      fit,
      ctx,
      scroll: ticker.frame.y,
      pauses: [],
      boops: 0,
      ringT: [0],
      hurry: null,
      box: [0, 0, 0, 0],
      drawn: false,
      heart: null,
    };
    this.live.push(p);
    return p;
  }

  // ── painting ───────────────────────────────────────────────────────────

  /** Paint every live pop into `b` (cleared, sized to the grid): oldest first, the combo last; retire finished ones. */
  paint(b: PopBuffer, f: PopFrame) {
    // retire in place: hurried out, or played through
    const scrolled = ticker.frame.y;
    let n = 0;
    for (const p of this.live) {
      if (Math.abs(scrolled - p.scroll) > f.cell) this.hurry(p, f.clock);
      const alive = p.hurry ? f.clock - p.hurry.at < p.hurry.dur : this.age(p, f.clock) < this.life(p, f.reduced);
      if (alive) this.live[n++] = p;
    }
    this.live.length = n;

    const ptr = ticker.frame.pointer;
    this.pointer.x = (ptr.x - f.offX) / f.cell;
    this.pointer.y = (ptr.y - f.offY) / f.cell;
    // two passes: the combo last, on top
    for (const p of this.live) if (p.id !== COMBO) this.paintOne(b, p, f, ptr.on);
    for (const p of this.live) if (p.id === COMBO) this.paintOne(b, p, f, ptr.on);
  }

  private paintOne(b: PopBuffer, p: Live, f: PopFrame, pointerOn: boolean) {
    const real = f.clock - p.t0;
    const age = this.age(p, f.clock);
    // the face and the little squash / spring: a running boop wins over a tickle
    let squint = false;
    let shift = 0;
    let booped = false;
    if (!p.hurry) {
      for (const q of p.pauses) {
        const into = real - q.at;
        if (into < 0 || into >= q.dur) continue;
        if (q.kind === 'boop') {
          booped = squint = true;
          shift = into < 0.06 ? 1 : into < 0.14 ? -1 : 0;
        } else if (!booped && into < 0.08) {
          squint = true;
          shift = -1;
        }
      }
    }
    if (f.reduced) shift = 0;
    const x = (p.px - f.offX) / f.cell;
    const y = (p.py - f.offY) / f.cell + shift;
    this.pen.reset(b, Math.floor(x), Math.floor(y), p.seed, p.hurry ? (f.clock - p.hurry.at) / p.hurry.dur : 0);

    const s = this.state;
    s.x = x;
    s.y = y;
    s.age = age;
    s.k = Math.min(1, age / this.life(p, f.reduced));
    s.seed = p.seed;
    s.dir = p.fit.dir;
    s.size = p.fit.size;
    s.squint = squint;
    s.paper = f.paper;
    s.ctx = p.ctx;
    s.pointer = pointerOn ? this.pointer : null;
    s.ringT = p.ringT;
    s.cols = b.w;
    s.rows = b.h;
    s.cell = f.cell;
    s.mobile = f.mobile;
    s.reduced = f.reduced;
    POPS[p.id].paint(s);
    p.drawn = this.pen.boxInto(p.box);
    this.heart(b, p, f);
  }

  /** the boop's heart: rises a row every HEART_RISE (still under reduced motion), stepping down the tones */
  private heart(b: PopBuffer, p: Live, f: PopFrame) {
    const h = p.heart;
    if (!h) return;
    const t = f.clock - h.at;
    const tone = until(HEART_FADE, t);
    if (!tone) {
      p.heart = null;
      return;
    }
    const rise = f.reduced ? 0 : steps(t, HEART_RISE);
    // bottom-centre on (h.x, h.y - rise): the art is 5 wide, 4 tall
    stamp(b, BOOP_HEART, h.x - 2, h.y - rise - 3, tone[1]);
  }

  // ── input ──────────────────────────────────────────────────────────────

  /**
   * Listen for clicks (mouse / pen: on press, for an instant response) and
   * taps (touch: on lift). Rapid presses on empty space would otherwise make
   * the browser select the nearest word (a double or triple click) and end
   * the chain: a routed press's multi-click selection is prevented. Returns
   * the cleanup.
   */
  listen(): () => void {
    let tap: { id: number; x: number; y: number; at: number } | null = null;
    let routed = false;
    /** a routable press: the page's snapshot when it lands on empty space, else null */
    const ok = (e: PointerEvent): Page | null => {
      if (intro.at < 0 || !e.isPrimary || e.button !== 0) return null;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return null;
      const page = new Page();
      return page.empty(e.clientX, e.clientY) ? page : null;
    };
    const onDown = (e: PointerEvent) => {
      routed = false;
      if (e.pointerType === 'touch') {
        tap = e.isPrimary ? { id: e.pointerId, x: e.clientX, y: e.clientY, at: e.timeStamp } : null;
        return;
      }
      const page = ok(e);
      if (!page) return;
      routed = true;
      this.click(e.clientX, e.clientY, false, page);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (routed && e.detail > 1) e.preventDefault();
      routed = false;
    };
    const onUp = (e: PointerEvent) => {
      const t = tap;
      if (e.pointerType !== 'touch' || !t || t.id !== e.pointerId) return;
      tap = null;
      if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > TAP_SLOP || e.timeStamp - t.at > TAP_MS) return;
      const page = ok(e);
      if (page) this.click(e.clientX, e.clientY, true, page);
    };
    const onCancel = () => (tap = null);
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onCancel, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }

  /** Dev hook: play a pop at viewport point (x, y) in CSS px, skipping the deck and the fit test. */
  spawn(x: number, y: number, id: PopId) {
    const g = this.field;
    if (!g) return;
    const cx = Math.floor((x - g.offX) / g.cell);
    const cy = Math.floor((y - g.offY) / g.cell);
    const seed = (this.seed += 7919);
    const fit = POPS[id].layouts(seed, 1)[0]?.fit ?? { dir: 1, size: 0 };
    this.add(id, cx, cy, fit, ctxNow(), g, ticker.frame.clock, seed);
  }
}

export const pops = new Pops();
