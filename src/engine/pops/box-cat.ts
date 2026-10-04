/**
 * box-cat — what the visitor sees, beat by beat:
 *   0–.05 s    a taped cardboard box thumps onto the page, squashed flat, tape showing
 *   .05–.10    it overshoots a row …
 *   .10–.28    … settles, and shakes twice, one cell each way: something is inside
 *   .28–.32    the tape tears and the lid sits ajar
 *   .32–.52    a cat rises ears-first, wearing the lid like a hat, with a little hop above the rim
 *   .52–.68    it looks out, then blinks
 *   .68–1.00   a double-take (sinks to its ears, pops back up) or a slow, content blink (seeded)
 *   1.00–1.08  an ear flicks
 *   1.08–1.26  it ducks back in, the tape is back, and the box hops as the cat lands
 *   1.26–1.48  the box crumbles in blocks, then the tape, alone, goes last
 *
 * Around the clicked cell C (x right, y down): the box face covers rows -1..+3
 * (the rim on -1; the interior on 0..2 is punched, so dust never sits inside
 * the box and the click cell shows bare paper) and the lid rests on row -2.
 * The cat stands behind the rim, clipped to rows <= -2; R is how far it is
 * sunk — 8 hidden, 0 chin on the rim, -1 hopping above it. The lid always sits
 * on the row above the cat's ears, so ink and accent never share a cell.
 *
 * Variants (s.variant): 0 DOUBLE-TAKE (55%), 1 SLOW-BLINK (45%). The seed also
 * picks the flicking ear and the shake's first side.
 *
 * Boop / tickle: the cat squints (CAT_BLINK, or CAT_TWITCH_BLINK mid-flick so
 * the ear stays out) while it is up; a hidden cat leaves the reaction to
 * live.ts's dip. Reduced motion: one still frame — the open box, the cat
 * looking out with the lid on its ears — held, then crumbled in place; a boop
 * squints the still (a face change is not motion) and live.ts restarts its hold.
 *
 * Footprint: x -8..+8, y -11..+3 around C (17×15 cells), shake and hop
 * included. One layout: no mirror, no tight variant.
 */
import {
  during,
  easeOutBack,
  keyedOpts,
  NO_OPTS,
  progress,
  recolor,
  rnd,
  stamp,
  until,
  type Span,
  type SpriteOpts,
} from './helpers';
import type { Pen, Pop, PopState, Reach } from './types';

// ── sprites ──────────────────────────────────────────────────────────────

/** the lid: ink, with the tape (accent) at its centre */
const LID = ['#######@#######'];
/** the box face taped shut: ink outline, punched interior, the tape on the rim */
const FACE_SHUT = [
  '######@######',
  '#xxxxxxxxxxx#',
  '#xxxxxxxxxxx#',
  '#xxxxxxxxxxx#',
  '#############',
];
/** the face once the tape has torn: the rim is all ink */
const FACE_OPEN = [
  '#############',
  '#xxxxxxxxxxx#',
  '#xxxxxxxxxxx#',
  '#xxxxxxxxxxx#',
  '#############',
];
/** the face squashed flat as it lands (the first 50 ms), tape still on */
const FACE_SQUASH = [
  '######@######',
  '#xxxxxxxxxxx#',
  '#############',
];
/** the tape alone (lid centre over rim centre): the exit's last piece */
const TAPE = ['@', '@'];

/**
 * the cat: ink head, 1×2 hole eyes, accent blush, '+' whiskers at ink .5.
 * At .25 the halftone draws its smallest mark, a speck beside the solid head;
 * .5 draws one nearly twice the size, so the chapter's dash (Memory) or cross
 * (Harness) reads as a whisker stroke.
 */
const CAT = [
  '  #     #  ',
  '  ##   ##  ',
  '  #######  ',
  ' ######### ',
  '+###x#x###+',
  ' ###x#x### ',
  '+#@#####@#+',
  ' ######### ',
];
/** eyes squeezed shut to slits: only the lower eye row stays open */
const CAT_BLINK = [
  '  #     #  ',
  '  ##   ##  ',
  '  #######  ',
  ' ######### ',
  '+#########+',
  ' ###x#x### ',
  '+#@#####@#+',
  ' ######### ',
];
/** the right ear flicked out (stamp's flip mirrors it for the left) */
const CAT_TWITCH = [
  '  #        ',
  '  ##   ### ',
  '  #######  ',
  ' ######### ',
  '+###x#x###+',
  ' ###x#x### ',
  '+#@#####@#+',
  ' ######### ',
];
/** the flicked ear with the squint's eyes: a boop mid-flick squints without snapping the ear back up */
const CAT_TWITCH_BLINK = CAT_TWITCH.map((row, i) => (i === 4 ? CAT_BLINK[4] : row)); // row 4: the upper eye row

/** the lid and taped face with the tape left out: the exit crumbles the box first and the tape last, on its own clock */
const LID_BARE = recolor(LID, '@', ' ');
const FACE_SHUT_BARE = recolor(FACE_SHUT, '@', ' ');

/** the cat's faces, indexed by EYES / BLINK / TWITCH / TWITCH_BLINK */
const FACES = [CAT, CAT_BLINK, CAT_TWITCH, CAT_TWITCH_BLINK];
/** the same faces with the blush in ink: where the accent renders as paper, paper blush would read as a second pair of eyes */
const FACES_PAPER = FACES.map((art) => recolor(art, '@', '#'));
const EYES = 0;
const BLINK = 1;
const TWITCH = 2;
const TWITCH_BLINK = 3;
type Face = typeof EYES | typeof BLINK | typeof TWITCH | typeof TWITCH_BLINK;

/** R at which the cat is entirely below the rim (its ears land on row -1, under the clip) */
const HIDDEN = 8;

// ── timing (effective seconds) ───────────────────────────────────────────

/** seconds on screen: the tape is gone by CRUMBLE_TAPE's end, 20 ms before */
const LIFE = 1.5;

/** the box's beats, in order: [until, beat]; past the last row the pop is over */
type Beat = 'land' | 'bounce' | 'shake' | 'open' | 'hop' | 'exit';
const BEATS: readonly (readonly [number, Beat])[] = [
  [0.05, 'land'], // the thump: squashed flat, tape showing on frame 0
  [0.1, 'bounce'], // a 1-row overshoot
  [0.28, 'shake'], // settled, yet shaking: something is inside
  [1.2, 'open'], // tape torn, lid ajar: the cat's whole act (sunk() and face())
  [1.26, 'hop'], // the cat lands inside and the box hops
  [LIFE, 'exit'], // the box crumbles, then the tape
];

/** the shake: one cell to the seeded side, then one cell to the other — exactly two beats, enough to say "something's in here" */
const SHAKE_1: Span = [0.13, 0.17];
const SHAKE_2: Span = [0.19, 0.23];
/** the cat rises, ears first, overshooting into a 1-row hop above the rim */
const RISE: Span = [0.32, 0.52];
/** its first blink, once it has looked out */
const BLINK_1: Span = [0.6, 0.68];
/** the double-take: sinks to its ears, holds there (until PEEK), pops back up */
const SINK: Span = [0.68, 0.74];
const PEEK: Span = [0.84, 0.92];
/**
 * the other variant's slow, content blink: 160 ms after BLINK_1 (any shorter
 * reads as a flutter), then held, opening straight into the ear flick.
 */
const SLOW_BLINK: Span = [0.84, 1.0];
/** the ear flick */
const FLICK: Span = [1.0, 1.08];
/** ducks back in, accelerating */
const DUCK: Span = [1.08, 1.2];
/**
 * the exit: the box crumbles, then the tape on its own clock. Both share the
 * seed, so overlapping windows would let the tape drop before the box on some
 * seeds and outlast the pop on others. Disjoint ones make it certain: the box
 * is gone by 1.40, the tape stands alone at least 20 ms, and it is gone by 1.48.
 */
const CRUMBLE_BOX: Span = [1.26, 1.4];
const CRUMBLE_TAPE: Span = [1.42, 1.48];
/** reduced motion: the still holds, then crumbles in place */
const STILL_CRUMBLE: Span = [0.7, 1.1];

// ── seeded choices (rnd draws: 0 the variant, 1 the ear, 2 the shake) ────

/** variant 0, DOUBLE-TAKE (55%), else 1, SLOW-BLINK; s.variant forces one (debug hooks) */
const isDoubleTake = (s: PopState) => (s.variant ?? (rnd(s.seed, 0) < 0.55 ? 0 : 1)) === 0;
/** the left ear flicks instead of the right */
const flicksLeft = (seed: number) => rnd(seed, 1) < 0.5;
/** the shake's first side (±1) */
const shakeSide = (seed: number) => (rnd(seed, 2) < 0.5 ? 1 : -1);

// ── layout ───────────────────────────────────────────────────────────────

/**
 * Worst-case reach: the shake moves the lid (x ±7) a cell each way, the
 * rise's hop lifts it to row -11, and the box bottom is row +3. The reduced
 * still (lid on row -10) and the squint (same cells as the open eyes) fit
 * inside.
 */
const REACH: Reach = [-8, -11, 8, 3];

// ── painting ─────────────────────────────────────────────────────────────

/** the one options object every crumbling or clipped stamp shares, keyed to C so lid, face, cat and tape break apart as one piece */
const opts = keyedOpts();

/** The closed box with its centre column on x and its rim on row y - 1: the lid on y - 2 over the face. */
function closedBox(b: Pen, x: number, y: number, lid: readonly string[], face: readonly string[], o: SpriteOpts = NO_OPTS) {
  stamp(b, lid, x - 7, y - 2, 1, o);
  stamp(b, face, x - 6, y - 1, 1, o);
}

/** How far the cat is sunk below the rim during the 'open' beat (HIDDEN … 0, -1 at the top of the hop). */
function sunk(a: number, doubleTake: boolean): number {
  if (a < RISE[0]) return HIDDEN; // lid ajar, nobody yet
  if (a < RISE[1]) return HIDDEN - Math.round(HIDDEN * easeOutBack(progress(a, RISE)));
  if (a >= DUCK[0]) return Math.round(HIDDEN * progress(a, DUCK) ** 2);
  if (!doubleTake || a < SINK[0] || a >= FLICK[0]) return 0;
  // the double-take: only the ears, the head top and the lid stay above the rim
  if (a < SINK[1]) return Math.round(4 * progress(a, SINK) ** 2);
  if (a < PEEK[0]) return 4;
  return 4 - Math.round(4 * easeOutBack(progress(a, PEEK)));
}

/** The cat's face at age a: a boop or tickle always gets the squint, keeping a flicked ear out. */
function face(a: number, doubleTake: boolean, squint: boolean): Face {
  if (during(a, FLICK)) return squint ? TWITCH_BLINK : TWITCH;
  if (squint || during(a, BLINK_1)) return BLINK;
  if (!doubleTake && during(a, SLOW_BLINK)) return BLINK;
  return EYES;
}

const pop: Pop = {
  life: LIFE,
  reducedLife: STILL_CRUMBLE[1],
  // the cat never travels and the box is symmetric: no mirror and no tight variant (a box that doesn't fit deals the next card)
  layouts: () => [{ fit: { dir: 1, size: 0 }, reach: REACH }],
  paint(s) {
    const { b, age: a, seed } = s;
    const cx = Math.floor(s.x);
    const cy = Math.floor(s.y);
    const faces = s.paper ? FACES_PAPER : FACES;

    if (s.reduced) {
      // nothing moves; a boop or tickle still squints (live.ts restarts the hold)
      const f = progress(a, STILL_CRUMBLE);
      stamp(b, FACE_OPEN, cx - 6, cy - 1, 1, opts(cx, cy, seed, f));
      stamp(b, faces[s.squint ? BLINK : EYES], cx - 5, cy - 9, 1, opts(cx, cy, seed, f, false, cy - 2));
      stamp(b, LID, cx - 7, cy - 10, 1, opts(cx, cy, seed, f));
      return;
    }

    const beat = until(BEATS, a);
    if (!beat) return;
    switch (beat[1]) {
      case 'land':
        // the lid on row 0 and a 3-row face: the box shoved 2 rows down and flattened
        closedBox(b, cx, cy + 2, LID, FACE_SQUASH);
        break;
      case 'bounce':
      case 'hop':
        closedBox(b, cx, cy - 1, LID, FACE_SHUT);
        break;
      case 'shake': {
        const q = shakeSide(seed);
        closedBox(b, cx + (during(a, SHAKE_1) ? q : during(a, SHAKE_2) ? -q : 0), cy, LID, FACE_SHUT);
        break;
      }
      case 'open': {
        const doubleTake = isDoubleTake(s);
        const r = sunk(a, doubleTake);
        const ducking = a >= DUCK[0];
        // the tape is back on once the cat is all the way down
        stamp(b, ducking && r >= HIDDEN ? FACE_SHUT : FACE_OPEN, cx - 6, cy - 1);
        // the lid rides on the ears: ajar (row -3) while the box is open, settling to its rest row (-2) as the cat ducks
        stamp(b, LID, cx - 7, cy + Math.min(ducking ? -2 : -3, r - 10));
        if (r < HIDDEN) {
          // only the flick is asymmetric: the left-ear seeds mirror it
          const flip = during(a, FLICK) && flicksLeft(seed);
          stamp(b, faces[face(a, doubleTake, s.squint)], cx - 5, cy - 9 + r, 1, opts(cx, cy, seed, 0, flip, cy - 2));
        }
        break;
      }
      case 'exit':
        closedBox(b, cx, cy, LID_BARE, FACE_SHUT_BARE, opts(cx, cy, seed, progress(a, CRUMBLE_BOX)));
        stamp(b, TAPE, cx, cy - 2, 1, opts(cx, cy, seed, progress(a, CRUMBLE_TAPE)));
        break;
    }
  },
};

export default pop;
