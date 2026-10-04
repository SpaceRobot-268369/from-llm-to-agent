/**
 * bot-agent — the page's idea in one toy: a bare core (the model) gets one
 * box, then the pieces shuffle in pixel chunks into a little robot (an
 * agent). It wakes eye by eye, gives a hello hop, does its act, blinks,
 * powers down and crumbles. Clicked in the finale it unbuilds back to the
 * lone core instead.
 *
 * Beat by beat (effective seconds):
 *   0–.05      a bare 3×3 core: the model
 *   .05–.10    one box snaps around it (a ring at ink .5)
 *   .10–.20    the pieces shuffle, in 2×2 chunks, into a little robot, powered off
 *   .20–.22    its bulb lights …
 *   .22–.26    … then its visor eyes, the screen-left one first
 *   .26–.36    a hello hop, one row up
 *   .36–.96    its act (the variant): it waves three times — or it thinks '…'
 *              (a dot at .36, .46, .56), gets an '!' at .72 and its bulb glows
 *              on .72–.90
 *   .96–1.04   a blink
 *   1.04–1.10  eyes open again
 *   1.10       power down: the right eye goes and the bulb dims to .5 …
 *   1.17       … then the left eye goes
 *   1.24–1.50  the bulb dims to .25 and the robot crumbles in blocks, the
 *              antenna from the top down
 *
 * Finale (ctx 'finale'; lives 1.74 s): from 1.24 it unbuilds instead —
 *   1.24–1.34  the build played backwards, back into the core and its box
 *   1.34–1.40  the core in a tighter box (radius 2, ink .5)
 *   1.40–1.50  the core alone: only the model is left
 *   1.50–1.74  the core fades down the ladder, 80 ms a step: .75, .5 (1.58), .25 (1.66)
 *
 * Boop / tickle: once the robot is built it lights up — eyes on, bulb on,
 * the bulb's glow around it (a waving arm holds its pose). Before it is built,
 * and while the finale unbuilds it, there is no face: the freeze alone holds
 * the frame.
 *
 * Reduced motion: the robot idle, eyes on, held 0–.70, then crumbled in place
 * by 1.10. A boop shows the face (the glow) and live.ts restarts the hold.
 *
 * Variants (s.variant; seeded 50/50): 0 WAVE, 1 THINK. The mirror (s.dir =
 * -1) puts the waving arm and the thought marks on the screen left; a layout
 * whose arm or marks wouldn't fit takes the other mirror.
 *
 * Footprint around the clicked cell C (x right, y down): x -6..+6, y -9..+5.
 * The robot's sprites have their top-left on C + (-6, -5 + Y): the bulb sits
 * on (0, -5 + Y), the head spans rows -3..+1 with the eyes on (±1, -1), the
 * legs stand on row +5, and Y is -1 during the hop. The body spans x -4..+4
 * and is symmetric, so the mirror moves only the arm and the marks (to x ±6
 * on the facing side; the '!' tops out on row -9), and the screen-left eye
 * always wakes first and sleeps last.
 *
 * Every tone below full strength sits on the exact halftone ladder (the box
 * rings and the glow .5, the dimming bulb .5 then .25, the fading core), so a
 * cell renders one mark size wherever the click lands and doesn't shimmer
 * when a boop's squash nudges the robot.
 */
import { crumbled, during, hash2, keyedOpts, paintCell, progress, rnd, squareRing, stamp, steps, until, type Span } from './helpers';
import type { Pen, Pop, PopState, Reach } from './types';

// ── sprites ──────────────────────────────────────────────────────────────

/** the model: a solid ink core */
const CORE3 = ['###', '###', '###'];
/** the core in one box: the ring at ink .5 */
const SEED = [
  '+++++++',
  '+     +',
  '+ ### +',
  '+ ### +',
  '+ ### +',
  '+     +',
  '+++++++',
];
/** the robot powered off: ink body, punched visor, its bulb dim on the antenna */
const BOT_OFF = [
  '      *      ',
  '      #      ',
  '   #######   ',
  '   #xxxxx#   ',
  '   #xxxxx#   ',
  '   #xxxxx#   ',
  '   #######   ',
  '    #####    ',
  '  #########  ',
  '  # ##### #  ',
  '     # #     ',
];
/** the robot awake: 1×1 accent LED eyes on the punched visor, lit bulb */
const BOT_IDLE = [
  '      @      ',
  '      #      ',
  '   #######   ',
  '   #xxxxx#   ',
  '   #x@x@x#   ',
  '   #xxxxx#   ',
  '   #######   ',
  '    #####    ',
  '  #########  ',
  '  # ##### #  ',
  '     # #     ',
];
/** waving: the screen-right forearm up */
const BOT_WAVE_A = [
  '      @      ',
  '      #      ',
  '   #######   ',
  '   #xxxxx#   ',
  '   #x@x@x#   ',
  '   #xxxxx# # ',
  '   ####### # ',
  '    ##### #  ',
  '  ########   ',
  '  # #####    ',
  '     # #     ',
];
/** waving: the hand tipped out */
const BOT_WAVE_B = [
  '      @      ',
  '      #      ',
  '   #######   ',
  '   #xxxxx#   ',
  '   #x@x@x#   ',
  '   #xxxxx#  #',
  '   ####### # ',
  '    ##### #  ',
  '  ########   ',
  '  # #####    ',
  '     # #     ',
];
/** the bulb's soft glow around the (empty) bulb cell: thinking's light, and the boop face */
const GLOW = [' o ', 'o o'];

if (import.meta.env.DEV) {
  // stamp's flip mirrors a frame about its middle column, and build() lays SEED inside BOT_OFF by
  // index: both line up with C only while every robot row is 13 cells and there are 11 rows
  for (const art of [BOT_OFF, BOT_IDLE, BOT_WAVE_A, BOT_WAVE_B]) {
    if (art.length !== 11 || art.some((row) => row.length !== 13)) throw new Error('bot-agent: robot frames must be 13×11');
  }
}

/** A robot frame without its antenna (the bulb and stem rows): robot() paints that itself, the bulb at the beat's tone. */
const body = (art: readonly string[]) => art.slice(2);
/** BOT_OFF's body with its eyes (body row 2, cols 5 and 7: '@' on, 'x' off) set */
function eyes(left: string, right: string): readonly string[] {
  return body(BOT_OFF).map((row, r) => (r === 2 ? row.slice(0, 5) + left + 'x' + right + row.slice(8) : row));
}
/** both eyes dark: just powered on, the blink, and powered down */
const EYES_OFF = eyes('x', 'x');
/** only the screen-left eye on: waking, and the last step before it is off */
const LEFT_EYE = eyes('@', 'x');
/** both eyes on */
const EYES_ON = body(BOT_IDLE);
/** the wave's two arm frames, A then B, as drawn (arm on the screen right); s.dir = -1 stamps them flipped */
const WAVE = [body(BOT_WAVE_A), body(BOT_WAVE_B)];

// ── timing (effective seconds) ───────────────────────────────────────────

/** the bare core, then the core in its box */
const CORE_END = 0.05;
/** the build's crossfade: SEED → BOT_OFF, block by block */
const BUILD: Span = [0.1, 0.2];
/** the hello hop: one row up, long enough (~6 frames) to read as a hop, landing on the act */
const HOP: Span = [0.26, 0.36];
/** the act: three waves, or the thinking */
const ACT: Span = [0.36, 0.96];
/** each wave frame holds this long (A, B, A, B, A, B) */
const ARM_SWAP = 0.1;
/** the thought dots, [appears at, x] on row -6, x mirrored with s.dir: '…' typed out */
const DOTS: readonly (readonly [at: number, x: number])[] = [
  [0.36, 2],
  [0.46, 4],
  [0.56, 6],
];
/** the '!' replaces the dots and holds to the end of the act */
const BANG = 0.72;
/** the '!' (x = 4, mirrored): two rows of stroke and the point on the dots' row, beside the antenna, never on it */
const BANG_X = 4;
const BANG_ROWS = [-9, -8, -6];
/** while thinking, the bulb glows (one soft light, no flicker) */
const THINK_GLOW: Span = [0.72, 0.9];
/** the exit: the robot crumbles (or, in the finale, unbuilds) */
const EXIT: Span = [1.24, 1.5];
/** reduced motion: the still holds, then crumbles in place */
const STILL_CRUMBLE: Span = [0.7, 1.1];

/** one beat of the built robot's face: shown until `until`, the body frame and the bulb's tone */
type Frame = readonly [until: number, body: readonly string[], bulb: number];
/** powered off: BOT_OFF with the bulb at its dimmest — what the exit crumbles */
const POWERED_OFF: Frame = [Infinity, EYES_OFF, 0.25];
/**
 * The built robot's face, beat by beat. From the blink on every beat holds
 * ≥ 60 ms, so each reads on its own. The 80 ms blink leaves the power-down
 * three such beats before the exit, so the bulb's first dim goes with the
 * right eye and its last with the crumble's start. WAVE swaps in its arm
 * frames over the act.
 */
const FRAMES: readonly Frame[] = [
  [0.22, EYES_OFF, 1], // the bulb lights …
  [0.26, LEFT_EYE, 1], // … then the screen-left eye
  [ACT[1], EYES_ON, 1], // the hop, then the act
  [1.04, EYES_OFF, 1], // the blink
  [1.1, EYES_ON, 1], // eyes open again
  [1.17, LEFT_EYE, 0.5], // power down: the right eye goes and the bulb dims …
  [EXIT[0], EYES_OFF, 0.5], // … then the left eye …
  POWERED_OFF, // … and the bulb dims again as the exit begins
];

/** the finale's unbuild: the build played backwards, back to SEED */
const UNBUILD: Span = [EXIT[0], 1.34];
/** then the core in a ring of radius 2, until here */
const RING2_END = 1.4;
/**
 * Then the core alone, [until, tone]: whole for 100 ms (only the model is
 * left), then down the ladder, 80 ms a step. The last row ends the finale's
 * life (lifeOf).
 */
const CORE_FADE: readonly (readonly [until: number, tone: number])[] = [
  [1.5, 1],
  [1.58, 0.75],
  [1.66, 0.5],
  [1.74, 0.25],
];
const FINALE_END = CORE_FADE[CORE_FADE.length - 1][0];

// ── seeded choices (rnd draws: 1 the mirror, 2 the act) ──────────────────

/** the act, in the header's variant order (s.variant forces one) */
const WAVES = 0;
const THINKS = 1;
const actOf = (seed: number) => (rnd(seed, 2) < 0.5 ? WAVES : THINKS);

/**
 * Worst-case reach for a layout. The body spans x -4..+4 and rows -5..+5;
 * the wave's hand and the thought marks add two columns on the facing side
 * (x ±6). The top is the '!' (row -9) for a thinker; for a waver it is the
 * boop glow over the bulb mid-hop (row -7). The reduced still and the
 * finale's unbuild lie inside. The act comes from the seed, as layouts()
 * sees it: a debug-forced s.variant = THINKS on a waving seed can draw the
 * '!' above this reach.
 */
function reach(dir: 1 | -1, act: number): Reach {
  const top = act === THINKS ? -9 : -7;
  return dir > 0 ? [-4, top, 6, 5] : [-6, top, 4, 5];
}

// ── painting ─────────────────────────────────────────────────────────────

/** the body's stamp options, refilled per frame: its crumble is keyed to C, the same blocks robot() tests for the antenna, so they break apart as one piece */
const opts = keyedOpts();


/**
 * The build's crossfade at t (0 = SEED, 1 = BOT_OFF): each click-relative
 * 2×2 block shows the robot once its hash is under t, so the pieces shuffle
 * in chunks. The robot's 13×11 box holds SEED's 7×7, so one pass covers both.
 */
function build(b: Pen, cx: number, cy: number, seed: number, t: number) {
  for (let r = 0; r < BOT_OFF.length; r++) {
    const y = r - 5;
    const bot = BOT_OFF[r];
    const box = y >= -3 && y <= 3 ? SEED[y + 3] : null;
    for (let c = 0; c < bot.length; c++) {
      const x = c - 6;
      // >> 1 floors negative cells too, so the blocks stay 2×2 on both sides of C
      if (t > 0 && hash2(x >> 1, y >> 1, seed) < t) paintCell(b, bot[c], cx + x, cy + y);
      else if (box && x >= -3 && x <= 3) paintCell(b, box[x + 3], cx + x, cy + y);
    }
  }
}

/** The finale's exit: the build played backwards, then the core in a tighter box, then the core alone, fading. */
function unbuild(b: Pen, cx: number, cy: number, seed: number, a: number) {
  if (a < UNBUILD[1]) {
    build(b, cx, cy, seed, 1 - progress(a, UNBUILD));
  } else if (a < RING2_END) {
    stamp(b, CORE3, cx - 1, cy - 1);
    squareRing(b, cx, cy, 2, 0.5);
  } else {
    // past the last row (the end of its life) nothing is left
    stamp(b, CORE3, cx - 1, cy - 1, until(CORE_FADE, a)?.[1] ?? 0);
  }
}

/** The thinking marks at age a: the dots typed out, then the '!' (x mirrored with m). */
function thought(b: Pen, cx: number, cy: number, m: 1 | -1, a: number) {
  if (a >= BANG) {
    for (let i = 0; i < BANG_ROWS.length; i++) b.dot(cx + BANG_X * m, cy + BANG_ROWS[i], 1, true);
    return;
  }
  for (let i = 0; i < DOTS.length; i++) if (a >= DOTS[i][0]) b.dot(cx + DOTS[i][1] * m, cy - 6, 1, true);
}

/**
 * The robot under crumble f (keyed to C): `art` (a body frame, flipped for a
 * mirrored wave) hopped up Y rows, its antenna with the bulb at `bulb`, and
 * the bulb's glow if `glow` and the bulb still stands.
 */
function robot(
  s: PopState,
  cx: number,
  cy: number,
  f: number,
  art: readonly string[],
  flip: boolean,
  bulb: number,
  Y: number,
  glow: boolean,
) {
  const { b, seed } = s;
  stamp(b, art, cx - 6, cy - 3 + Y, 1, opts(cx, cy, seed, f, flip));
  // the head top, the stem and the bulb fall in different crumble blocks: each piece of the antenna
  // drops with the one under it, so it breaks from the top down and never hangs alone in mid-air
  if (crumbled(0, -3 + Y, f, seed) || crumbled(0, -4 + Y, f, seed)) return;
  b.dot(cx, cy - 4 + Y, 1);
  if (crumbled(0, -5 + Y, f, seed)) return;
  b.dot(cx, cy - 5 + Y, bulb, true);
  // the glow is the bulb's light, not a part: whole while the bulb stands, gone with it (a boop
  // mid-crumble would otherwise leave a halo floating over a fallen antenna)
  if (glow) stamp(b, GLOW, cx - 1, cy - 6 + Y);
}

/** The built robot, from its first light to its crumbling exit: the beat at age a, its act, hop and boop face. */
function alive(s: PopState, cx: number, cy: number) {
  const a = s.age;
  const frame = until(FRAMES, a) ?? POWERED_OFF;
  let art = frame[1];
  let bulb = frame[2];
  let glow = s.squint;
  let waving = false;
  if (during(a, ACT)) {
    if ((s.variant ?? actOf(s.seed)) === THINKS) {
      thought(s.b, cx, cy, s.dir, a);
      glow ||= during(a, THINK_GLOW);
    } else {
      art = WAVE[steps(a - ACT[0], ARM_SWAP) & 1];
      waving = true;
    }
  }
  // the boop face: eyes and bulb on (a waving frame already has its eyes)
  if (s.squint) {
    bulb = 1;
    if (!waving) art = EYES_ON;
  }
  // only a wave is flipped: the body is symmetric, but LEFT_EYE must stay on the screen left
  robot(s, cx, cy, progress(a, EXIT), art, waving && s.dir < 0, bulb, during(a, HOP) ? -1 : 0, glow);
}

const pop: Pop = {
  life: EXIT[1],
  reducedLife: STILL_CRUMBLE[1],
  // the finale's unbuild outlasts the crumble: it ends when the core has faded out
  lifeOf: ({ reduced, ctx }) => (reduced ? STILL_CRUMBLE[1] : ctx === 'finale' ? FINALE_END : EXIT[1]),
  // facing m, then mirrored: a wave arm or thought marks that wouldn't fit flip m
  layouts: (seed) => {
    const m: 1 | -1 = rnd(seed, 1) < 0.5 ? 1 : -1;
    const act = actOf(seed);
    return [
      { fit: { dir: m, size: 0 }, reach: reach(m, act) },
      { fit: { dir: -m as 1 | -1, size: 0 }, reach: reach(-m as 1 | -1, act) },
    ];
  },
  paint(s) {
    const { b, age: a, seed } = s;
    const cx = Math.floor(s.x);
    const cy = Math.floor(s.y);
    if (s.reduced) {
      // idle, eyes on, nothing moves; a boop only adds the glow (and live.ts restarts the hold)
      robot(s, cx, cy, progress(a, STILL_CRUMBLE), EYES_ON, false, 1, 0, s.squint);
    } else if (a < CORE_END) {
      stamp(b, CORE3, cx - 1, cy - 1);
    } else if (a < BUILD[1]) {
      build(b, cx, cy, seed, progress(a, BUILD)); // t = 0 until .10: SEED
    } else if (a >= EXIT[0] && s.ctx === 'finale') {
      unbuild(b, cx, cy, seed, a);
    } else {
      alive(s, cx, cy);
    }
  },
};

export default pop;
