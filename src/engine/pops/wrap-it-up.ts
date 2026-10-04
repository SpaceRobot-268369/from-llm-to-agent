/**
 * wrap-it-up — the page's idea as a toy: the 5-click easter egg. live.ts
 * spawns it on the 4th rapid click in one spot: a sleeping core, eyes shut,
 * inside one box that wears the hero's accent corner brackets. Clicks 5–7
 * each snap one more box in from a cell outside, in the hero's ring tones
 * (solid → fine dots), and the core thumps as each lands; the boxes push the
 * world back (everything inside the outermost one is knocked out). 450 ms
 * after the last box the stack unwraps outermost first, as in the finale:
 * each box telescopes onto the next one in and is gone, the core bobbing as
 * it comes off. Then the reward: the core flashes awake in accent, looks at
 * the pointer, blinks, and sends up a heart that beats twice before both
 * crumble away.
 *
 * Beat by beat (effective seconds). C is the anchor cell (the chain's first click); t is the
 * effective age since click 4; ring j lands at ringT[j] (ringT[0] = 0); L is
 * the last ring's time and n the ring count (1–4).
 *   build    ring j (radius 5, 7, 9, 11; tone 1, .75, .5, .25) sits a cell
 *            outside its radius for .05 s from ringT[j], then at it; the
 *            core hops a row on [.20, .27) after each landing
 *   hold     L … L + .45: the stack waits for another click
 *   unwrap   U = t − L − .45. Ring j (outermost first, m = n − 1 − j) on
 *            [.12m, .12m + .12): a cell in for .06 s, two cells in for .06 s
 *            (never closer than hugging the core), then gone. The core bobs a
 *            row for .06 s as each comes off, while no ring hugs it
 *   reward   W = U − .12n, since the last ring came off:
 *            0 … .06        wake: CORE_POP, the core swells a cell in accent
 *            .06 … 1.00     CORE_AWAKE, eyes on the pointer
 *            .20 … .50      the heart appears over the core and rises a row
 *            .30 … .38      a blink (CORE_SQUINT)
 *            .40 … .48      heartbeat (HEART_BIG), and again .56 … .64
 *            .70 … 1.00     the core crumbles
 *            .80 … 1.10     the heart crumbles; the egg ends
 *   So the life is L + .45 + .12n + 1.10: 1.67 s for one ring, 2.03 s for four.
 *
 * Boop / tickle: asleep, the core scrunches its eyes shut (CORE_SCRUNCH, > <);
 * awake — the wake beat included — it squints (CORE_SQUINT, gaze kept).
 *
 * Variants: none; the seed only keys the crumble. Footprint (comboReach):
 * the outermost ring as it snaps in, ±(radius + 1), and the heart's clean
 * paper up to row −12: [−6, −12, 6, 6] for one ring, ±12 (25×25) for four.
 *
 * Reduced motion: each box appears in place on its click (no snap, no
 * thump), the boxes are cut away outermost first, one per .12 s, and the
 * reward is one still — CORE_AWAKE with centred eyes, the heart at its low
 * row — held .8 s, then crumbled over .4 s (life L + .45 + .12n + 1.2). The
 * boop faces hold there too; a boop restarts only that still (holdStart),
 * never the stack.
 */
import {
  during,
  easeOut,
  keyedOpts,
  progress,
  recolor,
  sprite,
  squareRing,
  standing,
  until,
  type RingOpts,
  type Span,
  type Sprite,
} from './helpers';
import type { Pop, PopState, Reach } from './types';


// ── sprites ──────────────────────────────────────────────────────────────

/** the model asleep (ink): closed eyes are punched slits */
const CORE_ASLEEP: Sprite = [
  '#######',
  '#######',
  '#######',
  '#xx#xx#',
  '#######',
  '#######',
  '#######',
];

/** the sleeper booped (ink): eyes scrunched shut, > < */
const CORE_SCRUNCH: Sprite = [
  '#######',
  '#######',
  '#x###x#',
  '##x#x##',
  '#x###x#',
  '#######',
  '#######',
];

/** the wake (accent, one beat): the core swells a cell all round, eyes wide */
const CORE_POP: Sprite = [
  '@@@@@@@@@',
  '@@@@@@@@@',
  '@@@@@@@@@',
  '@@@x@x@@@',
  '@@@x@x@@@',
  '@@@@@@@@@',
  '@@@@@@@@@',
  '@@@@@@@@@',
  '@@@@@@@@@',
];

/** the model awake (accent), looking straight out; the eyes shift to follow the pointer */
const CORE_AWAKE: Sprite = [
  '@@@@@@@',
  '@@@@@@@',
  '@@x@x@@',
  '@@x@x@@',
  '@@@@@@@',
  '@@@@@@@',
  '@@@@@@@',
];

/** the awake core blinking or booped (accent): only the eyes' bottom row stays open */
const CORE_SQUINT: Sprite = [
  '@@@@@@@',
  '@@@@@@@',
  '@@@@@@@',
  '@@x@x@@',
  '@@@@@@@',
  '@@@@@@@',
  '@@@@@@@',
];

/** the heart the core sends up (accent) */
const HEART: Sprite = [
  '@@ @@',
  '@@@@@',
  '@@@@@',
  ' @@@ ',
  '  @  ',
];

/** the heart mid-beat (accent): a cell bigger all round but its tip */
const HEART_BIG: Sprite = [
  ' @@ @@ ',
  '@@@@@@@',
  '@@@@@@@',
  '@@@@@@@',
  ' @@@@@ ',
  '  @@@  ',
  '   @   ',
];

/** the heart's clean paper: HEART_BIG's square plus the row under the tip, so no field speck sits in the notch or between heart and core */
const HEART_CLEAR: Sprite = [
  'xxxxxxx',
  'xxxxxxx',
  'xxxxxxx',
  'xxxxxxx',
  'xxxxxxx',
  'xxxxxxx',
  'xxxxxxx',
  'xxxxxxx',
];

/** `art` with its 'x' eye cells moved by (sx, sy) and the holes they leave filled with '@' (accent faces only) */
function gaze(art: Sprite, sx: number, sy: number): string[] {
  const cells = recolor(art, 'x', '@').map((row) => row.split(''));
  art.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] === 'x') cells[r + sy][c + sx] = 'x';
  });
  return cells.map((row) => row.join(''));
}

/** the awake face looking each way, indexed by look(sx, sy); index 4 is CORE_AWAKE itself */
const CORE_LOOK = [-1, 0, 1].flatMap((sy) => [-1, 0, 1].map((sx) => gaze(CORE_AWAKE, sx, sy)));
/** the blink keeps the gaze: CORE_SQUINT shifted the same way */
const CORE_BLINK = [-1, 0, 1].flatMap((sy) => [-1, 0, 1].map((sx) => gaze(CORE_SQUINT, sx, sy)));
const look = (sx: number, sy: number) => (sy + 1) * 3 + sx + 1;

// ── the stack ────────────────────────────────────────────────────────────

/** ring radii (Chebyshev, cells), innermost first; live.ts adds a ring only while the next one's square fits */
export const RADII = [5, 7, 9, 11] as const;
/** the rings' tones, innermost first: the hero's exact halftone levels, so each ring is one even mark */
const TONE = [1, 0.75, 0.5, 0.25] as const;
/** accent corner bracket arm on the innermost ring, corner cell included */
const ARM = 3;
/** the core sprites are 7×7, centred on C */
const CORE_R = 3;
/** the innermost a telescoping ring goes: hugging the core */
const HUG = CORE_R + 1;

/** ring options, shared so paint allocates nothing: the innermost ring's brackets, and the knocked-out squares between rings */
const BRACKETED: RingOpts = { arm: ARM };
const HOLLOW: RingOpts = { punch: true };

// ── timing (seconds) ─────────────────────────────────────────────────────

/** a new ring snaps in from one cell outside for this long */
const SNAP = 0.05;
/** each ring's thump, in seconds since it landed: the core alone hops up a row (the stack never jolts) */
const THUMP: Span = [0.2, 0.27];
/** the stack holds this long after the last ring, then unwraps */
const HOLD = 0.45;
/** unwrap: one ring every STEP, outermost first */
const STEP = 0.12;
/** a ring's unwrap step: [until (s into it), cells it has telescoped in]; past the last row it is gone */
const TELESCOPE: readonly (readonly [number, number])[] = [
  [STEP / 2, 1],
  [STEP, 2],
];
/** the core's bob, in seconds into a ring's unwrap step: from when it's gone, for one telescoping half (any shorter is two frames: a twitch) */
const BOB: Span = [STEP, STEP + STEP / 2];

// the reward's beats, in seconds since the last ring came off (W)
/** CORE_POP until here: the model wakes */
const WAKE = 0.06;
/** CORE_SQUINT: a blink */
const BLINK: Span = [0.3, 0.38];
/** the awake core crumbles */
const CORE_OUT: Span = [0.7, 1.0];
/** the heart appears and rises RISE_ROWS */
const RISE: Span = [0.2, 0.5];
const RISE_ROWS = 1;
/** the heart's sprite: [until W, art] — the two beats of a heartbeat; HEART after the table */
const HEARTBEAT: readonly (readonly [number, Sprite])[] = [
  [0.4, HEART],
  [0.48, HEART_BIG],
  [0.56, HEART],
  [0.64, HEART_BIG],
];
/** the heart crumbles; the egg ends with it */
const HEART_OUT: Span = [0.8, 1.1];
/** reduced motion's still reward: holds, then crumbles until the end */
const STILL_OUT: Span = [0.8, 1.2];
/** the heart's tip row before it rises, relative to C */
const HEART_TIP = -5;
/**
 * float slack at both ends of the reward. A reduced boop parks the combo on
 * holdStart for its whole pause, where W comes out a hair below 0 about half
 * the time: without the slack the innermost box would come back for the
 * pause. And the frame at exactly the egg's life draws nothing.
 */
const EPS = 1e-6;

/** the reward's length: the heart's crumble, or the reduced still's */
const rewardEnd = (reduced: boolean) => (reduced ? STILL_OUT[1] : HEART_OUT[1]);
/** rings in the stack (1..4) for this ringT */
const ringCount = (ringT: readonly number[]) => Math.max(1, Math.min(RADII.length, ringT.length));
/** when the last ring landed */
const lastRing = (ringT: readonly number[]) => ringT[ringCount(ringT) - 1] ?? 0;
/** where the reward begins: the last ring, the hold, then one unwrap step per ring */
const rewardAt = (ringT: readonly number[]) => lastRing(ringT) + HOLD + STEP * ringCount(ringT);
/** seconds into ring j's unwrap step, U seconds into the unwrap (outermost first; negative while it waits its turn) */
const unwrapping = (j: number, U: number, n: number) => U - STEP * (n - 1 - j);

// ── painting ─────────────────────────────────────────────────────────────

/** one options object for every crumbling stamp, keyed to C so the core and heart break up as one piece */
const opts = keyedOpts();

/** the top row of `art` when it stands with its bottom row on row y */
const top = (art: Sprite, y: number) => y - art.length + 1;


/**
 * Ring j's radius at this moment, or 0 while it isn't there. U is the time
 * into the unwrap (negative while the stack builds and holds).
 */
function radius(j: number, t: number, U: number, ringT: readonly number[], n: number, reduced: boolean): number {
  const R = RADII[j];
  if (U < 0) {
    // building / holding: a ring exists from its click, and a fresh one snaps in from a cell outside
    const at = ringT[j] ?? 0;
    if (t < at) return 0;
    return !reduced && t - at < SNAP ? R + 1 : R;
  }
  const since = unwrapping(j, U, n);
  if (since < 0) return R;
  const row = until(TELESCOPE, since);
  if (!row) return 0;
  if (reduced) return R; // a cut, no telescoping
  return Math.max(HUG, R - row[1]);
}

/** The boxes and the sleeping core: building, holding, then unwrapping (U = time into the unwrap, < 0 before it). */
function stack(s: PopState, cx: number, cy: number, U: number, n: number) {
  const { b, ringT, reduced } = s;
  const t = s.age;
  let out = 0; // outermost live radius: the boxes push the world back to here
  let inner = 0; // innermost live radius: the core's headroom
  let drawn = 0; // bit r set: a ring sits at radius r (its cells replace the field anyway)
  for (let j = 0; j < n; j++) {
    const r = radius(j, t, U, ringT, n, reduced);
    if (!r) continue;
    if (r > out) out = r;
    if (!inner) inner = r;
    // telescoped onto the ring inside it: that ring stands for both (and keeps its brackets clear of ink)
    if (j > 0 && r === radius(j - 1, t, U, ringT, n, reduced)) continue;
    if (j === 0) squareRing(b, cx, cy, r, TONE[j], BRACKETED);
    else squareRing(b, cx, cy, r, TONE[j]);
    drawn |= 1 << r;
  }
  for (let d = HUG; d <= out; d++) if (!(drawn & (1 << d))) squareRing(b, cx, cy, d, 1, HOLLOW);

  // the core hops up a row as each ring lands and as each comes off — only with headroom, so a ring
  // hugging it holds it down. Each ring keys its own hop, which plays out in full even if the next ring
  // lands mid-thump: fast clicks give an even run of hops instead of one cut short to a twitch
  let hop = false;
  if (!reduced && inner > HUG) {
    for (let j = 0; j < n; j++) {
      if (U < 0 ? during(t - (ringT[j] ?? 0), THUMP) : during(unwrapping(j, U, n), BOB)) hop = true;
    }
  }
  const lift = hop ? 1 : 0;
  sprite(b, s.squint ? CORE_SCRUNCH : CORE_ASLEEP, cx, cy - lift);
  // the row the core hopped out of is inside the boxes: keep it knocked out
  if (hop) for (let i = -CORE_R; i <= CORE_R; i++) b.punch(cx + i, cy + CORE_R, 1);
}

/** −1, 0 or 1: which way to look along one axis, from C to the target cell (0 within 2 cells, either side) */
const side = (d: number) => (Math.abs(d) > 2 ? Math.sign(d) : 0);

/**
 * The reward, W seconds after the last ring came off. The core and the heart
 * fill their own footprints; only the heart carries clean paper, which moves
 * and crumbles with it, so nothing outlives what is drawn.
 */
function reward(s: PopState, cx: number, cy: number, W: number) {
  const { b, seed } = s;

  if (s.reduced) {
    // one still: centred eyes and the heart, held, then crumbled
    const f = progress(W, STILL_OUT);
    sprite(b, s.squint ? CORE_SQUINT : CORE_AWAKE, cx, cy, 1, opts(cx, cy, seed, f));
    const o = opts(cx, cy, seed + 1, f);
    standing(b, HEART_CLEAR, cx, cy + HEART_TIP + 1, 1, o);
    standing(b, HEART, cx, cy + HEART_TIP, 1, o);
    return;
  }

  // the core looks at the pointer's cell; on touch (no pointer) toward the viewport centre
  const px = Math.floor(s.pointer ? s.pointer.x : s.cols / 2);
  const py = Math.floor(s.pointer ? s.pointer.y : s.rows / 2);
  const g = look(side(px - cx), side(py - cy));
  // a boop skips the wake beat: the squint is the answer
  if (W < WAKE && !s.squint) sprite(b, CORE_POP, cx, cy);
  else {
    const face = s.squint || during(W, BLINK) ? CORE_BLINK[g] : CORE_LOOK[g];
    sprite(b, face, cx, cy, 1, opts(cx, cy, seed, progress(W, CORE_OUT)));
  }

  if (W < RISE[0]) return;
  const tip = cy + HEART_TIP - Math.round(RISE_ROWS * easeOut(progress(W, RISE)));
  const o = opts(cx, cy, seed + 1, progress(W, HEART_OUT));
  standing(b, HEART_CLEAR, cx, tip + 1, 1, o);
  standing(b, until(HEARTBEAT, W)?.[1] ?? HEART, cx, tip, 1, o);
}

/**
 * What the combo needs to hold n rings: the outermost ring as it snaps in
 * (radius + 1) and the heart's clean paper at its peak (row −12). live.ts
 * spawns the combo only where comboReach(1) fits, and adds ring n + 1 only
 * where comboReach(n + 1) does.
 */
export const comboReach = (n: number): Reach => {
  const r = RADII[n - 1] + 1;
  // the clean paper stands on the row under the risen tip
  return [-r, Math.min(-r, top(HEART_CLEAR, HEART_TIP - RISE_ROWS + 1)), r, r];
};

const pop: Pop = {
  // a full stack's unattended part (hold, four unwrap steps, the reward); lifeOf gives the real one
  life: HOLD + STEP * RADII.length + HEART_OUT[1],
  // the last ring's time, then the unattended part
  lifeOf: ({ ringT, reduced }) => rewardAt(ringT) + rewardEnd(reduced),
  // under reduced motion the still is the reward, so a boop restarts it there and never replays the stack
  holdStart: ({ ringT }) => rewardAt(ringT),
  // one layout; live.ts grows the reach ring by ring with comboReach
  layouts: () => [{ fit: { dir: 1, size: 0 }, reach: comboReach(1) }],
  paint(s) {
    const cx = Math.floor(s.x);
    const cy = Math.floor(s.y);
    const n = ringCount(s.ringT);
    const U = s.age - lastRing(s.ringT) - HOLD; // into the unwrap
    const W = U - STEP * n; // into the reward
    if (W < -EPS) stack(s, cx, cy, U, n);
    else if (W < rewardEnd(s.reduced) - EPS) reward(s, cx, cy, W);
  },
};

export default pop;
