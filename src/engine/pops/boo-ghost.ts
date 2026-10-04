/**
 * boo-ghost — a little ghost materialises out of halftone dots a row below
 * the click, floats up with a gentle sway while its dripping tail ripples,
 * blinks, throws its arm-nubs up in a tiny "boo!", then fades down the
 * halftone ladder and floats away. Beat by beat (effective seconds):
 *   0–.05      it materialises: one beat of even .75 texture, a row low
 *   .05–.08    solid, still a row low
 *   .08–.48    the float: it rises 4 rows (3 when tight), eased out, with a
 *              ±1-cell sway (.8 s a swing, lingering at the sides); the tail's
 *              drips swap sides every .16 s, from the first frame to the last
 *   .30–.38    a blink (the upper eye row closes)
 *   .48–.66    "boo!": it snaps up a row and holds still, arm-nubs high, under
 *              three accent surprise ticks until .60
 *   .66–1.28   it floats on at the boo's height, the sway carrying on where it paused
 *   1.02–1.22  the fade: .75, then .5, the eyes still punched holes
 *   1.22       on the .25 body a hole no longer reads, so the face flips to ink eyes
 *   1.28       it lifts one last row, floating away
 *   1.44       a sleepy squint, held to the end (reopening would flicker)
 *   1.50–1.60  the eyes soften to .5, and the ghost is gone
 *
 * Tones: every cell sits on an exact ladder step all the way down. The body
 * fades 1 → .75 → .5 → .25; the tail's drips are already .5 and .25, so they
 * keep their tone until the body falls below it. The face never outlasts the
 * body: a lone 1×2 face would read as a pause icon.
 *
 * Boop / tickle: the squint — the upper eye row closes (on the ink face,
 * only the lower pair of dots stays).
 *
 * Variants, in index order (seeded; s.variant picks one): 0 sways right first,
 * drips leaning left first; 1 sways left, drips left; 2 sways right, drips
 * right; 3 sways left, drips right. The body is symmetric, so these carry all
 * the side-to-side choice and both layouts are dir 1.
 *
 * Footprint around the clicked cell C: x -6..+6, y -12..+6 (the ticks' top row
 * is -12); the tight layout rises 3 rows instead of 4, so y -11..+6.
 *
 * Reduced motion: the same ghost (drips left) stands where it appeared, its
 * centre on C, and steps down the ladder in place: solid until .6, .75, .5,
 * then .25 with ink eyes from .8, eyes .5 from 1.0, gone at 1.1. A boop
 * restarts the hold from 0, so its squint shows on the solid ghost.
 */
import {
  during,
  easeOut,
  NO_OPTS,
  progress,
  recolor,
  rnd,
  spriteWidth,
  stamp,
  steps,
  until,
  type Span,
  type Sprite,
  type SpriteOpts,
} from './helpers';
import type { Pop, PopState } from './types';


// ── sprites ──────────────────────────────────────────────────────────────

/** the body afloat: ink, 1×2 punched eyes, accent blush; the tail hangs under it (TAIL) */
const BODY: Sprite = [
  '   #####   ',
  '  #######  ',
  ' ######### ',
  ' ###x#x### ',
  ' ###x#x### ',
  ' #@#####@# ',
  '###########',
  ' ######### ',
  ' ## ### ## ',
];

/** the "boo!": arm-nubs raised to eye level, and no mouth (a scream mouth read as scary, not cute) */
const BODY_BOO: Sprite = [
  '   #####   ',
  '  #######  ',
  ' ######### ',
  '####x#x####',
  '####x#x####',
  ' #@#####@# ',
  ' ######### ',
  ' ######### ',
  ' ## ### ## ',
];

/** the tail's drips leaning left ('+' mid, ':' fine), body-wide so its mirror (leaning right) pivots on the body's centre column */
const TAIL: Sprite = [
  ' +  ++  +  ',
  ':   :  :   ',
];

/** the surprise emanata: a fan of three accent ticks over the head */
const SURPRISE: Sprite = [
  '@    @    @',
  ' @   @   @ ',
];

/** the tail's first row on the ghost's grid: straight under the body */
const TAIL_ROW = BODY.length;

/**
 * The tail split by tone, each part as solid ink, to stamp at min(.5, xv) and
 * min(.25, xv): the art's .5 and .25 scaled by the fade (.375, .188, .125 …)
 * would be off the ladder, dithered by cell position and shimmering as the
 * ghost sways.
 */
const TAIL_MID = recolor(recolor(TAIL, ':', ' '), '+', '#');
const TAIL_FINE = recolor(recolor(TAIL, '+', ' '), ':', '#');
/** the tail's two steps (the art's '+' and ':'): each part draws at its step, or at the body's tone once that is fainter */
const MID_TONE = 0.5;
const FINE_TONE = 0.25;
/** the tail mirrored: the drips lean right (the ripple swaps this in and out) */
const LEAN_RIGHT: SpriteOpts = Object.freeze({ flip: true });

if (import.meta.env.DEV && spriteWidth(TAIL) !== spriteWidth(BODY)) {
  throw new Error('boo-ghost: the tail must be as wide as the body, or its mirror shifts the drips off the body');
}

/** the face's eyes sit on these two sprite rows (a squint closes the upper one) … */
const EYE_TOP = 3;
const EYE_LOW = 4;
/** … in these columns, symmetric about the centre, so the eyes match the art in every pose */
const EYE_COLS = [4, 6] as const;

/**
 * A body's faces: eyes punched open, squinting (upper row closed), and shut
 * (both rows closed into body, so ink eyes can be dotted on over it).
 */
type Faces = { readonly open: Sprite; readonly squint: Sprite; readonly shut: Sprite };

/** `art` with the eye holes on `rows` filled in as body */
function closed(art: Sprite, rows: readonly number[]): Sprite {
  return art.map((row, r) => (rows.includes(r) ? row.replaceAll('x', '#') : row));
}

/** a body's faces, blush in accent and (where the accent renders as paper, so pale blush would read as a second pair of eyes) in ink */
function faces(art: Sprite): readonly [Faces, Faces] {
  const of = (a: Sprite): Faces => ({ open: a, squint: closed(a, [EYE_TOP]), shut: closed(a, [EYE_TOP, EYE_LOW]) });
  return [of(art), of(recolor(art, '@', '#'))];
}

const FLOAT_FACES = faces(BODY);
const BOO_FACES = faces(BODY_BOO);

/** the sprites' centre cell (col 5, row 5): the ghost hangs on it */
const MID = 5;

// ── timing (effective seconds) ───────────────────────────────────────────

const LIFE = 1.6;
const STILL_LIFE = 1.1;

/**
 * One step down the ladder: until when, the body's tone (exact steps, so
 * every cell gets one even mark), the eyes' ink (0 = punched holes; on a body
 * fainter than .5 a hole barely reads, so the face turns to ink), and whether
 * the face squints.
 */
type Beat = readonly [until: number, xv: number, eyes: number, squint: boolean];

/** tone and face over the life; past the last row the ghost is gone */
const LADDER: readonly Beat[] = [
  [0.05, 0.75, 0, false], // materialises as even chapter-mark texture
  [0.3, 1, 0, false],
  [0.38, 1, 0, true], // the blink
  [1.02, 1, 0, false],
  [1.12, 0.75, 0, false], // the fade down the ladder
  [1.22, 0.5, 0, false],
  [1.44, 0.25, 1, false], // the face inverts: ink eyes on the faint body
  [1.5, 0.25, 1, true], // a last squint, held to the end
  [LIFE, 0.25, 0.5, true], // the face softens before the ghost is gone
];

/** reduced motion: a stepped fade in place */
const STILL: readonly Beat[] = [
  [0.6, 1, 0, false],
  [0.7, 0.75, 0, false],
  [0.8, 0.5, 0, false],
  [1.0, 0.25, 1, false],
  [STILL_LIFE, 0.25, 0.5, false],
];

/**
 * the float's rise eases out across this span of the float's clock (which
 * stops for the boo); until it starts the ghost sits a row low, and the sway
 * starts with it. The boo's extra row is already the rise's top, so after the
 * boo only the sway still moves it.
 */
const FLOAT: Span = [0.08, 1.3];
/** how many rows it rises (tight: one fewer) */
const RISE = 4;
const RISE_TIGHT = 3;
/** the sway: ±1 cell at most (1.2 rounds to 1, so it lingers at the sides) */
const SWAY = 1.2;
const SWAY_PERIOD = 0.8;
/** the tail swaps drips this often, never faster: its clock runs from the first frame, through the boo */
const TAIL_SWAP = 0.16;
/** the boo snaps up a row and holds; the ghost keeps that row after it */
const BOO: Span = [0.48, 0.66];
/** the surprise ticks show for the boo's first part */
const TICKS: Span = [0.48, 0.6];
/** the float (rise and sway) stands still for the boo, then carries on where it left off */
const BOO_HOLD = BOO[1] - BOO[0];
/**
 * the faint ghost lifts a row as it dissolves, so the exit reads as floating
 * away: on a tail beat, a moment after the face flips (the new eye cells were
 * solid body until the fade began; sooner, they would dip under 250 ms)
 */
const LIFT_AT = 1.28;
/** the ticks' top row sits this far above the head's: two tick rows plus a 1-row gap */
const TICKS_UP = SURPRISE.length + 1;

// ── seeded choices ───────────────────────────────────────────────────────

/** the looks, in the header's order: sway sign, and which tail the ripple starts on (0 = drips left) */
const VARIANTS = [
  { sway: 1, t0: 0 },
  { sway: -1, t0: 0 },
  { sway: 1, t0: 1 },
  { sway: -1, t0: 1 },
] as const;

// ── painting ─────────────────────────────────────────────────────────────

/** the float's row at float-clock `fa`: the rise, eased out, in whole rows */
function floatY(rise: number, fa: number): number {
  return -Math.round(rise * easeOut(progress(fa, FLOAT)));
}

/**
 * The ghost with its top-left cell on (x0, y0): the body in its face for this
 * beat (a boop or tickle, s.squint, squints it too), toned by the beat; the
 * tail on its exact steps, leaning right when `lean`; and on the faint body
 * the ink eyes.
 */
function ghost(s: PopState, body: readonly [Faces, Faces], lean: boolean, x0: number, y0: number, beat: Beat) {
  const xv = beat[1];
  const eyes = beat[2];
  const sq = s.squint || beat[3];
  const f = body[s.paper ? 1 : 0];
  stamp(s.b, eyes > 0 ? f.shut : sq ? f.squint : f.open, x0, y0, xv);
  const o = lean ? LEAN_RIGHT : NO_OPTS;
  stamp(s.b, TAIL_MID, x0, y0 + TAIL_ROW, Math.min(MID_TONE, xv), o);
  stamp(s.b, TAIL_FINE, x0, y0 + TAIL_ROW, Math.min(FINE_TONE, xv), o);
  if (eyes <= 0) return;
  // ink eyes over the closed body (max blend lifts them above its tone)
  for (let i = 0; i < EYE_COLS.length; i++) {
    const x = x0 + EYE_COLS[i];
    if (!sq) s.b.dot(x, y0 + EYE_TOP, eyes);
    s.b.dot(x, y0 + EYE_LOW, eyes);
  }
}

const pop: Pop = {
  life: LIFE,
  reducedLife: STILL_LIFE,
  layouts: () => [
    { fit: { dir: 1, size: 0 }, reach: [-6, -12, 6, 6] },
    { fit: { dir: 1, size: -1 }, reach: [-6, -11, 6, 6] },
  ],
  paint(s) {
    const a = s.age;
    const cx = Math.floor(s.x);
    const cy = Math.floor(s.y);

    if (s.reduced) {
      const beat = until(STILL, a);
      if (beat) ghost(s, FLOAT_FACES, false, cx - MID, cy - MID, beat);
      return;
    }

    const beat = until(LADDER, a);
    if (!beat) return;
    const look = VARIANTS[Math.abs(s.variant ?? Math.floor(rnd(s.seed, 0) * VARIANTS.length)) % VARIANTS.length];
    const rise = s.size < 0 ? RISE_TIGHT : RISE;
    const boo = during(a, BOO);
    const lean = (steps(a, TAIL_SWAP) + look.t0) % 2 === 1;
    // the ghost's centre sits on C + (X, Y)
    let X = 0;
    let Y = 1;
    if (a >= FLOAT[0]) {
      // the float's own clock, frozen through the boo so the pose holds still
      const fa = a < BOO[0] ? a : boo ? BOO[0] : a - BOO_HOLD;
      Y = floatY(rise, fa);
      X = Math.round(SWAY * look.sway * Math.sin((2 * Math.PI * (fa - FLOAT[0])) / SWAY_PERIOD));
    }
    // From the boo on it never sinks below the boo's row: dropping back and
    // rising again within 250 ms would read as a stutter at the climax.
    if (a >= BOO[0]) Y = Math.min(Y, floatY(rise, BOO[0]) - 1);
    if (a >= LIFT_AT) Y -= 1;
    const x0 = cx - MID + X;
    const y0 = cy - MID + Y;

    ghost(s, boo ? BOO_FACES : FLOAT_FACES, lean, x0, y0, beat);
    if (during(a, TICKS)) stamp(s.b, SURPRISE, x0, y0 - TICKS_UP);
  },
};

export default pop;
