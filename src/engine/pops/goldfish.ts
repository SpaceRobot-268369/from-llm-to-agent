/**
 * goldfish — a goldfish in the chapter's accent flicks its tail and swims a
 * few cells, stops and blows a bubble (a tiny one has already left on the
 * way) that rises and pops. It blinks, waits a beat and blinks again, as if
 * it has forgotten something, then hops into a U-turn and swims back,
 * dissolving tail-first. The joke stays purely visual: no caption, no claim.
 *
 * Beat by beat (effective seconds; d is the way it sets off, D its swim):
 *   0–.05      it springs in at accent .75, then lights full
 *   0–.55      it swims D cells out (eased), the tail flicking every 100 ms,
 *              riding a row up on .15–.35 (a bob)
 *   .30        the tiny bubble leaves, two cells past the nose (variant 0)
 *   .55–.62    it stops
 *   .56        the ring bubble leaves. Each bubble rises a row every 100 ms,
 *              pops into four sparks 500 ms after it left, gone at 620 ms
 *   .62–.70    a blink
 *   .70–.74    eye open: wait …
 *   .74–.82    a second blink: huh?
 *   .82–.90    it flips with a hop, one row up: the U-turn
 *   .82–1.32   it swims 4 cells back (eased), level, flicking again from .90
 *   1.15–1.40  it dissolves tail-first, the nose last
 *
 * Boop / tickle: FISH_BLINK (eye shut), whatever the beat; under reduced
 * motion too.
 *
 * Variants (s.variant; seeded otherwise): 0 both bubbles; 1 the ring bubble
 * only (1 in 3).
 *
 * Footprint around the clicked cell C (x right, y down; for d = -1 mirror
 * x): y -8..+3, from the sparks of a bubble popping five rows up to the
 * belly; x -7..+11 for D = 5 (normal), -7..+12 for D = 6 (roomy), -7..+10 for
 * D = 4 (tight), from the tail at the start to the far edge of the ring
 * bubble, born MOUTH = 7 cells ahead of the fish's centre.
 *
 * Reduced motion: FISH_A facing d with the ring bubble above its nose
 * (x -5..+7, y -4..+3), held 0–.7 s, then crumbled as one piece by 1.1 s.
 */
import { during, easeInOut, hash2, keyedOpts, progress, recolor, rnd, spriteWidth, stamp, steps, until, type Span } from './helpers';
import type { Fit, Pen, Pop, PopState, Reach } from './types';

// ── sprites ──────────────────────────────────────────────────────────────

// facing right ('@' accent, '#' ink, 'x' punch); facing left reverses the rows

/** the fish: punched 1-cell eye at col 8 row 2, nose at col 10 row 3 */
const FISH_A = [
  '    @@@    ',
  '@   @@@@@  ',
  '@@ @@@@@x@ ',
  ' @@@@@@@@@@',
  '@@ @@@@@@@ ',
  '@   @@@@@  ',
  '     @@    ',
];
/** the tail flick: the tail folds into a fan, alternating with FISH_A while it swims */
const FISH_B = [
  '    @@@    ',
  '    @@@@@  ',
  ' @ @@@@@x@ ',
  '@@@@@@@@@@@',
  ' @ @@@@@@@ ',
  '    @@@@@  ',
  '     @@    ',
];
/** the blink, and the face a boop or tickle gets: FISH_A with the eye filled in */
const FISH_BLINK = recolor(FISH_A, 'x', '@');
/** the ring bubble: a tiny nested box (the page's motif), its centre punched */
const BLUB_RING = ['###', '#x#', '###'];
/** the tiny bubble: one ink cell */
const BLUB_TINY = ['#'];

/**
 * A sprite as cell codes, so the hot loop reads numbers instead of strings
 * and the bubbles can ask which cells the fish covers. Solid cells only:
 * '@' accent, '#' ink, 'x' hole.
 */
type Cells = { w: number; h: number; code: Uint8Array };
const EMPTY = 0;
const ACCENT = 1;
const INK = 2;
const HOLE = 3;
const CODE: Record<string, number> = { ' ': EMPTY, '@': ACCENT, '#': INK, x: HOLE };

function cells(art: readonly string[]): Cells {
  const w = spriteWidth(art);
  const code = new Uint8Array(w * art.length);
  art.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const v = CODE[row[c]];
      if (v !== undefined) code[r * w + c] = v;
      // a mid-tone ('+', 'o', …) would otherwise vanish silently: fail at load while developing
      else if (import.meta.env.DEV) throw new Error(`goldfish: unsupported sprite cell '${row[c]}'`);
    }
  });
  return { w, h: art.length, code };
}

const A = cells(FISH_A);
const B = cells(FISH_B);
const BLINK = cells(FISH_BLINK);
const RING = cells(BLUB_RING);
const TINY = cells(BLUB_TINY);

// ── geometry (cells, relative to the clicked cell, for d = +1) ───────────

/** the fish's centre column within its sprite, and its top row relative to its centre */
const HALF = 5;
const TOP = -3;
/** where the fish's centre starts: two cells behind the click, so the swim crosses it */
const START = -2;
/** the swim out: D = SWIM + s.size cells (tight 4, normal 5, roomy 6) */
const SWIM = 5;
/** a 4-cell swim back after the U-turn: it ends near the click (where it began, for the tight swim) */
const BACK = 4;
/**
 * bubbles leave this far ahead of the fish's centre, two cells past the nose:
 * the ring is born a clear column off the head, and the flipped tail lands
 * beside it on the turn hop, never inside it
 */
const MOUTH = 7;
/** reduced motion's ring sits a row higher than the live one, so it can stay one cell closer */
const STILL_RING_X = 6;
/** the exit counts a cell's distance from the tail over the fish's length */
const LENGTH = 10;

// ── timing (effective seconds) ───────────────────────────────────────────

const LIFE = 1.4;
/** the arrival: the first frames light the fish one step down the ladder, so it springs in like the deck's other pops */
const ARRIVE: Span = [0, 0.05];
const ARRIVE_TONE = 0.75;
/** the swim out, eased over D cells */
const SWIM_OUT: Span = [0, 0.55];
/** the bob on the way out: the fish rides a row up */
const BOB: Span = [0.15, 0.35];
/** the U-turn: the fish flips and rides a row up, once the second blink is over */
const TURN: Span = [0.82, 0.9];
/** the swim back, eased over BACK cells for half a second from the turn: when the turn waits out a longer blink, the swim keeps its pace */
const SWIM_BACK: Span = [TURN[0], TURN[0] + 0.5];
/** the tail flicks (FISH_A ↔ FISH_B) every FLICK while it swims */
const FLICK = 0.1;
/**
 * The face, beat by beat: [until, face], null while it swims (the tail
 * flicks). Each blink is 80 ms (about five frames at 60 Hz), long enough
 * to read as a blink rather than a flicker; the 40 ms open between them
 * makes it a double-take.
 */
const FACES: readonly (readonly [number, Cells | null])[] = [
  [SWIM_OUT[1], null], // the swim out
  [0.62, A], // stopped
  [0.7, BLINK],
  [0.74, A], // wait …
  [TURN[0], BLINK], // huh?
  [TURN[1], A], // flipped, mid-hop: the tail holds still until it lands
  [Infinity, null], // the swim back
];
/** the exit: the fish dissolves tail-first, the nose last */
const EXIT: Span = [1.15, LIFE];
/** how much of the exit cut comes from a cell's distance to the tail vs 2×2-block noise */
const EXIT_TAIL = 0.6;
const EXIT_NOISE = 0.4;
/** the bubbles: [emitted at, row offset from the fish's centre row (up is negative), sprite]; the first is the tiny one */
const BUBBLES: readonly (readonly [number, number, Cells])[] = [
  [0.3, -1, TINY],
  [0.56, -2, RING],
];
/** after leaving, a bubble rises a row every RISE; at POP_ROWS up (500 ms) it pops */
const RISE = 0.1;
const POP_ROWS = 5;
/** the pop's four sparks hold the row it popped on until GONE after it left */
const GONE = 0.62;
/** the pop's sparkle: an exact halftone level, so all four sparks get one even chapter mark */
const SPARK = 0.5;
/** a pop's four sparks, around the bubble's centre */
const DIAGONALS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];
/** reduced motion: the still holds, then crumbles over STILL_OUT */
const REDUCED_LIFE = 1.1;
const STILL_OUT: Span = [0.7, REDUCED_LIFE];

// ── seeded choices (rnd draw 0: the variant) ─────────────────────────────

/** 1 in 3 fish blow the ring bubble only (variant 1; variant 0 blows both) */
const RING_ONLY = 1 / 3;
const variant = (s: PopState) => s.variant ?? (rnd(s.seed, 0) < RING_ONLY ? 1 : 0);

// ── the swim ─────────────────────────────────────────────────────────────

/** the fish's centre column at age a, for d = +1 (d × this mirrors it with the same rounding) */
function centreX(a: number, D: number): number {
  if (a < SWIM_OUT[1]) return START + Math.round(D * easeInOut(progress(a, SWIM_OUT)));
  // stopped at START + D until the turn, then back
  return START + D - Math.round(BACK * easeInOut(progress(a, SWIM_BACK)));
}

/**
 * The bob and the turn hop: -1 while riding a row up. The swim back stays
 * level: a second bob, so soon after the hop lands, read as a stutter.
 */
function lift(a: number): number {
  return during(a, BOB) || during(a, TURN) ? -1 : 0;
}

/** the fish's face at age a: the beat's, or the tail flicking while it swims */
function face(a: number): Cells {
  return until(FACES, a)?.[1] ?? (steps(a, FLICK) % 2 === 0 ? A : B);
}

// ── painting ─────────────────────────────────────────────────────────────

/** this frame's fish: face, top-left (relative to C) and mirroring; one reused object, so paint allocates nothing */
const FISH = { art: A, ox: 0, oy: 0, flip: false };

/** true where this frame's fish draws: the bubbles keep off these cells, so their ink never meets its accent */
function covers(x: number, y: number): boolean {
  const { art, ox, oy, flip } = FISH;
  const c = x - ox;
  const r = y - oy;
  if (c < 0 || r < 0 || c >= art.w || r >= art.h) return false;
  return art.code[r * art.w + (flip ? art.w - 1 - c : c)] !== EMPTY;
}

/** one sprite cell: knock a hole (always fully, whatever the tone), or light it in its channel at `tone` */
function put(b: Pen, v: number, x: number, y: number, tone: number) {
  if (v === HOLE) b.punch(x, y, 1);
  else if (v !== EMPTY) b.dot(x, y, tone, v === ACCENT);
}

/**
 * Stamp this frame's fish on C at `tone`. On the way out (cut > 0) a cell
 * survives while its distance from the tail, plus 2×2-block noise, stays
 * ahead of the cut, so the fish dissolves tail-first and the nose goes last.
 */
function drawFish(b: Pen, cx: number, cy: number, tone: number, cut: number, tailX: number, seed: number) {
  const { art, ox, oy, flip } = FISH;
  for (let r = 0; r < art.h; r++) {
    const y = oy + r;
    for (let c = 0; c < art.w; c++) {
      const v = art.code[r * art.w + c];
      if (v === EMPTY) continue;
      const x = ox + (flip ? art.w - 1 - c : c);
      if (cut > 0 && (EXIT_TAIL * Math.abs(x - tailX)) / LENGTH + EXIT_NOISE * hash2(x >> 1, y >> 1, seed + 3) < cut) continue;
      put(b, v, cx + x, cy + y, tone);
    }
  }
}

/**
 * A bubble that left the mouth at C + (bx, by) and has risen `n` rows since
 * (x fixed); at POP_ROWS it has popped into four diagonal sparks that hold
 * the row it popped on.
 */
function drawBubble(b: Pen, blub: Cells, cx: number, cy: number, bx: number, by: number, n: number) {
  if (n >= POP_ROWS) {
    const y = by - POP_ROWS;
    for (let i = 0; i < DIAGONALS.length; i++) {
      const sx = bx + DIAGONALS[i][0];
      const sy = y + DIAGONALS[i][1];
      if (!covers(sx, sy)) b.dot(cx + sx, cy + sy, SPARK);
    }
    return;
  }
  const x0 = bx - (blub.w >> 1);
  const y0 = by - n - (blub.h >> 1);
  for (let r = 0; r < blub.h; r++) {
    for (let c = 0; c < blub.w; c++) {
      if (!covers(x0 + c, y0 + r)) put(b, blub.code[r * blub.w + c], cx + x0 + c, cy + y0 + r, 1);
    }
  }
}

/** the still's stamp options: its crumble keyed to C, so fish and bubble crumble as one piece */
const opts = keyedOpts();

/** reduced motion: FISH_A facing d with BLUB_RING above its nose; both hold, then crumble */
function still(s: PopState, cx: number, cy: number) {
  const d = s.dir;
  const o = opts(cx, cy, s.seed, progress(s.age, STILL_OUT), d < 0);
  stamp(s.b, s.squint ? FISH_BLINK : FISH_A, cx - HALF, cy + TOP, 1, o);
  stamp(s.b, BLUB_RING, cx + STILL_RING_X * d - 1, cy + TOP - 1, 1, o);
}

// ── layouts ──────────────────────────────────────────────────────────────

/**
 * Reach for a swim of D = 5 + size cells, facing d: from the tail at the
 * start (centre -2, 5 cells back) to the ring bubble's far edge (centre
 * -2 + D + MOUTH, 1 cell out; its sparks reach no further); from the sparks
 * of a bubble popping 5 rows up to the fish's belly 3 rows down. The
 * reduced still (x -5..7, y -4..3) sits inside every one of these.
 */
function layout(dir: 1 | -1, size: Fit['size']): { fit: Fit; reach: Reach } {
  const back = START - HALF;
  const ahead = START + SWIM + size + MOUTH + 1;
  return {
    fit: { dir, size },
    reach: dir > 0 ? [back, -8, ahead, 3] : [-ahead, -8, -back, 3],
  };
}

const pop: Pop = {
  life: LIFE,
  reducedLife: REDUCED_LIFE,
  // face the larger free side, roomy swim first; then the other way; the tight swim last
  layouts: (_seed, side) => {
    const o = -side as 1 | -1;
    return [layout(side, 1), layout(side, 0), layout(o, 1), layout(o, 0), layout(side, -1), layout(o, -1)];
  },
  paint(s) {
    const cx = Math.floor(s.x);
    const cy = Math.floor(s.y);
    if (s.reduced) {
      still(s, cx, cy);
      return;
    }
    const { b, seed, age: a } = s;
    const d = s.dir;
    const D = SWIM + s.size;

    // the fish: it turns (and hops) at TURN, so f is the way it faces now
    const f = a < TURN[0] ? d : -d;
    const fx = d * centreX(a, D);
    FISH.art = s.squint ? BLINK : face(a);
    FISH.ox = fx - HALF;
    FISH.oy = TOP + lift(a);
    FISH.flip = f < 0;
    drawFish(b, cx, cy, during(a, ARRIVE) ? ARRIVE_TONE : 1, progress(a, EXIT), fx - HALF * f, seed);

    // the bubbles stay where they left the mouth: x fixed, rising
    for (let i = variant(s) === 1 ? 1 : 0; i < BUBBLES.length; i++) {
      const te = BUBBLES[i][0];
      // rows risen, counted float-safe: an age a hair under the beat (0.4 × 1.4 = 0.5599…) still blows the bubble
      const n = steps(a - te, RISE);
      if (n < 0 || a - te >= GONE) continue;
      drawBubble(b, BUBBLES[i][2], cx, cy, d * (centreX(te, D) + MOUTH), BUBBLES[i][1] + lift(te), n);
    }
  },
};

export default pop;
