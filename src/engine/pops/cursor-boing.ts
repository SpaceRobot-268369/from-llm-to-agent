/**
 * cursor-boing — the page's caret block comes alive with two eyes. It
 * crouches, stretches and boings sideways in a parabola (toward the roomier
 * side), trailing a fine-dot afterimage over a shadow that shrinks as it
 * rises. It lands in a wide squash between two dust puffs, stands up happy
 * (blushing on half the clicks), blinks, then slides down into a dotted slot
 * in the floor like a coin, and the slot fades out in even halftone steps.
 *
 * Around the clicked cell C (x right, y down): the floor is G = 4 rows below
 * the click, so UPRIGHT standing on it has its middle row on C; X = HX · dir
 * is the landing spot. Beat by beat (effective seconds):
 *   0–.08      CROUCH on the floor under the click
 *   .08–.14    STRETCH, about to take off
 *   .14–.50    the hop: STRETCH for its first and last fifth, UPRIGHT between,
 *              placed by the head so the face rides one smooth arc; the
 *              afterimage a step behind, the shadow on the floor
 *   .50–.56    LAND at X, a dust puff either side
 *   .56–.59    CROUCH: the squash eases back before standing
 *   .59–.66    HAPPY (the puffs drift a cell out at .56, thin at .60, gone at .66)
 *   .66–.74    the blink: HAPPY_SQUINT for 80 ms
 *   .74–.96    HAPPY; from .80 it ducks below the floor row into the slot
 *   .76–1.16   SLOT under X: ink .75 until 1.00, then .5, .25, gone
 *   1.16–1.20  nothing left
 *
 * Boop / tickle: HAPPY_SQUINT (cheeks per variant) while it is on the floor —
 * before take-off and from touch-down on, the reduced-motion still too;
 * mid-air the reaction is live.ts's dip alone.
 *
 * Variants (s.variant indexes them; otherwise rnd draw 3, half and half):
 *   0  blush: accent cheeks on HAPPY / HAPPY_SQUINT
 *   1  plain: no blush. Always on paper, where accent cheeks would read as
 *      paper notches in the face
 * Layouts: the hop's size HX/HY — 4/5 tight, 5/6 normal, 6/7 roomy (rnd draw
 * 2: roomy on 1 click in 3 when it fits) — facing the roomier side first.
 *
 * Footprint (d = +1; d = -1 mirrors x): 5/6 x -3..12, y -10..5 (16×16);
 * 6/7 x -3..13, y -11..5; 4/5 x -3..11, y -9..5.
 *
 * Reduced motion: one still — HAPPY standing on its slot (ink .75), held to
 * .70, then crumbled in blocks as one piece by 1.10.
 */
import { keyedOpts, progress, recolor, rnd, type Span, type Sprite, spriteWidth, standing, stamp, until } from './helpers';
import type { Pen, Pop, PopState, Reach } from './types';


// ── sprites ──────────────────────────────────────────────────────────────

/** the crouch before take-off and on the way up from the landing squash: the caret block squashed (square corners keep it a caret, never a tombstone) */
const CROUCH: Sprite = [
  '#######',
  '#######',
  '##x#x##',
  '#######',
  '#######',
  '#######',
];

/** take-off and touch-down: tall and thin, eyes stretched to two rows */
const STRETCH: Sprite = [
  '#####',
  '#####',
  '#x#x#',
  '#x#x#',
  '#####',
  '#####',
  '#####',
  '#####',
  '#####',
  '#####',
  '#####',
];

/** mid-air: the caret at rest */
const UPRIGHT: Sprite = [
  '#####',
  '#####',
  '#x#x#',
  '#x#x#',
  '#####',
  '#####',
  '#####',
  '#####',
  '#####',
];

/** the squash on touch-down */
const LAND: Sprite = [
  '#########',
  '#########',
  '###x#x###',
  '#########',
  '#########',
];

/** standing after the landing, with accent blush on the cheeks */
const HAPPY: Sprite = [
  '#####',
  '#####',
  '#x#x#',
  '#x#x#',
  '@###@',
  '#####',
  '#####',
  '#####',
  '#####',
];

/** HAPPY with its eyes squeezed to one row: the blink, and the boop / tickle face */
const HAPPY_SQUINT: Sprite = [
  '#####',
  '#####',
  '#####',
  '#x#x#',
  '@###@',
  '#####',
  '#####',
  '#####',
  '#####',
];

/** HAPPY without the blush (the plain variant, and every click on paper) */
const HAPPY_PLAIN: Sprite = recolor(HAPPY, '@', '#');
/** HAPPY_SQUINT without the blush, for the same clicks */
const HAPPY_SQUINT_PLAIN: Sprite = recolor(HAPPY_SQUINT, '@', '#');

/** the standing faces by variant (header order): eyes open, and shut for the blink and the boop */
const FACES: readonly { readonly open: Sprite; readonly shut: Sprite }[] = [
  { open: HAPPY, shut: HAPPY_SQUINT },
  { open: HAPPY_PLAIN, shut: HAPPY_SQUINT_PLAIN },
];

/** a dust puff kicked up by the landing: a .5 centre in .25 dots */
const PUFF: Sprite = [
  ' : ',
  ':+:',
];

/** the puff thinning before it goes: all four cells at .25 (halving PUFF's tones would land off the ladder) */
const PUFF_THIN: Sprite = [
  ' : ',
  ':::',
];

/** the slot in the floor, stamped at an exact tone (.75 / .5 / .25): an even dotted, dashed or crossed line by chapter */
const SLOT: Sprite = ['#######'];

/** the afterimage trailing the hop: UPRIGHT's box in fine .25 dots, the body without a face (drawn cell by cell, see hop()) */
const GHOST = { w: spriteWidth(UPRIGHT), h: UPRIGHT.length, v: 0.25 } as const;

// ── timing (effective seconds) ───────────────────────────────────────────

const LIFE = 1.2;
/** the hop, take-off to touch-down */
const HOP: Span = [0.14, 0.5];
/** the duck: the body slides into the slot until it is fully below the floor */
const DUCK: Span = [0.8, 0.96];
/** reduced motion: the still holds until the crumble, which ends its life */
const STILL_CRUMBLE: Span = [0.7, 1.1];
const REDUCED_LIFE = STILL_CRUMBLE[1];

/** on the spot before take-off: [until, pose] */
const TAKE_OFF = [
  [0.08, CROUCH],
  [HOP[0], STRETCH],
] as const;

/** on the floor from touch-down until the duck has sunk it: [until, pose]; 'open' / 'shut' are the click's two HAPPY faces */
const GROUND = [
  [0.56, LAND],
  // the squash eases back through the crouch, so the 9×5 squash never snaps straight to the 5×9 stand
  [0.59, CROUCH],
  [0.66, 'open'],
  // the blink: 80 ms, long enough to read as one
  [0.74, 'shut'],
  [DUCK[1], 'open'],
] as const;

/** the dust puffs after touch-down: [until, drift outward (cells), sprite] */
const PUFFS = [
  [0.56, 0, PUFF],
  [0.6, 1, PUFF],
  [0.66, 1, PUFF_THIN],
] as const;

/** the slot under X: [until, ink] — shut until .76, then exact steps, so the line keeps one even mark size with no shimmer */
const SLOT_FADE = [
  [0.76, 0],
  [1.0, 0.75],
  [1.08, 0.5],
  [1.16, 0.25],
] as const;

/** in hop progress (0..1): the first and last fifth stay stretched (take-off, touch-down); UPRIGHT flies between */
const STRETCH_U = 0.2;
/** in hop progress: how far the afterimage lags the body's height */
const GHOST_LAG = 0.08;

// ── geometry (cells) ─────────────────────────────────────────────────────

/** the floor, in rows below the click: UPRIGHT standing on it has its middle row on the click cell */
const G = 4;
/** the hop by layout size (tight, normal, roomy): sideways travel HX and peak lift HY */
const HOP_X = [4, 5, 6] as const;
const HOP_Y = [5, 6, 7] as const;
/** how far each puff's near edge sits from X before it drifts */
const PUFF_GAP = 4;
/** the shadow's ink, the fine .25 step */
const SHADOW_V = 0.25;
/** the shadow's half-width by the feet's height: 5 wide near the floor, 3 up to 4 rows, then one dot */
const shadowHalf = (h: number) => (h <= 1 ? 2 : h <= 4 ? 1 : 0);
/** how far the duck sinks: the whole 9-row body, so it ends fully below the floor */
const DUCK_DEPTH = 9;
/** the reduced-motion slot tone */
const SLOT_V = 0.75;

/**
 * Worst-case reach for d = +1 by hop size (tight, normal, roomy); d = -1
 * mirrors x. Left: the crouch, and the afterimage one column behind the
 * take-off. Top: the apex UPRIGHT's head, G - HY - 8 (a STRETCH, placed by the
 * head too, tops out no higher). Right: the far puff after its drift,
 * HX + 5 … HX + 7. Bottom: the floor row (shadow, slot).
 */
const REACH: readonly Reach[] = [
  [-3, -9, 11, 5],
  [-3, -10, 12, 5],
  [-3, -11, 13, 5],
];

// ── painting ─────────────────────────────────────────────────────────────

/** one options object, refilled per stamp: the duck's floor clip and the still's crumble, keyed to the clicked cell */
const opts = keyedOpts();

/** The click's variant (header order): 0 blush, 1 plain — always plain on paper. */
function variantOf(s: PopState): 0 | 1 {
  if (s.paper) return 1;
  if (s.variant !== undefined) return s.variant === 0 ? 0 : 1;
  return rnd(s.seed, 3) < 0.5 ? 0 : 1;
}


/**
 * The hop's arc at progress u (0..1), in whole cells: sideways travel …
 * (d · round, not round(d · …): Math.round(-2.5) is -2, so only this way does d = -1 mirror d = +1 exactly)
 */
const arcX = (u: number, hx: number, d: 1 | -1) => d * Math.round(hx * u);
/** … and lift, a parabola peaking at hy mid-hop */
const arcY = (u: number, hy: number) => Math.round(hy * 4 * u * (1 - u));

/** The hop at progress u: the body along its arc, the afterimage a step behind, the shadow on the floor. */
function hop(b: Pen, cx: number, cy: number, u: number, d: 1 | -1, hx: number, hy: number) {
  const S = u < STRETCH_U || u >= 1 - STRETCH_U ? STRETCH : UPRIGHT;
  const px = arcX(u, hx, d);
  // the body's box, in grid cells. Placed by the head (UPRIGHT's head on the arc), not the feet,
  // so swapping STRETCH and UPRIGHT never jerks the face; STRETCH's two extra rows are legs
  // reaching down, to the floor at most (the push-off and the touch-down)
  const w = spriteWidth(S);
  const x0 = cx + px - (w >> 1);
  const x1 = x0 + w - 1;
  const y0 = cy + Math.min(G - arcY(u, hy) - (UPRIGHT.length - 1), G - (S.length - 1));
  const y1 = y0 + S.length - 1;
  stamp(b, S, x0, y0);

  if (u >= GHOST_LAG) {
    // lagging in height but always one column behind, so the trail never vanishes into the body;
    // ink max-blends, so it would fill the punched eyes: it skips the body's box instead
    const gx0 = cx + px - d - (GHOST.w >> 1);
    const gy1 = cy + G - arcY(u - GHOST_LAG, hy);
    for (let y = gy1 - GHOST.h + 1; y <= gy1; y++) {
      for (let x = gx0; x < gx0 + GHOST.w; x++) {
        if (x < x0 || x > x1 || y < y0 || y > y1) b.dot(x, y, GHOST.v);
      }
    }
  }

  // sized by how high the feet are, so a STRETCH still touching the floor keeps the full shadow
  const half = shadowHalf(cy + G - y1);
  for (let i = -half; i <= half; i++) b.dot(cx + px + i, cy + G + 1, SHADOW_V);
}

const pop: Pop = {
  life: LIFE,
  reducedLife: REDUCED_LIFE,
  layouts: (seed, side) => {
    const at = (dir: 1 | -1, size: -1 | 0 | 1) => {
      const [x0, y0, x1, y1] = REACH[size + 1];
      return { fit: { dir, size }, reach: (dir > 0 ? [x0, y0, x1, y1] : [-x1, y0, -x0, y1]) as Reach };
    };
    const other = -side as 1 | -1;
    // the bigger 6/7 hop on 1 click in 3 when it fits, else the normal 5/6;
    // toward the roomier side first; the tight 4/5 hop last
    const roomy = rnd(seed, 2) < 1 / 3;
    return [
      ...(roomy ? [at(side, 1)] : []),
      at(side, 0),
      ...(roomy ? [at(other, 1)] : []),
      at(other, 0),
      at(side, -1),
      at(other, -1),
    ];
  },
  paint(s) {
    const { b, age: a, dir: d } = s;
    const cx = Math.floor(s.x);
    const cy = Math.floor(s.y);
    // object destructuring: an array pattern would allocate an iterator every frame
    const { open, shut } = FACES[variantOf(s)];

    if (s.reduced) {
      // a still: HAPPY standing on its slot, held, then crumbled in blocks as one piece
      const o = opts(cx, cy, s.seed, progress(a, STILL_CRUMBLE));
      standing(b, s.squint ? shut : open, cx, cy + G, 1, o);
      stamp(b, SLOT, cx - (spriteWidth(SLOT) >> 1), cy + G + 1, SLOT_V, o);
      return;
    }

    const takeOff = until(TAKE_OFF, a);
    if (takeOff) {
      // on the spot: crouch, then stretch for take-off
      standing(b, s.squint ? shut : takeOff[1], cx, cy + G);
      return;
    }
    const size = s.size + 1;
    if (a < HOP[1]) {
      hop(b, cx, cy, progress(a, HOP), d, HOP_X[size], HOP_Y[size]);
      return;
    }

    const X = d * HOP_X[size];
    const ground = until(GROUND, a);
    if (ground) {
      // squash, crouch, stand happy, blink; then the duck lowers the feet below the floor, clipped at
      // it, so the body slides into the slot row by row
      const pose = ground[1];
      const S = s.squint || pose === 'shut' ? shut : pose === 'open' ? open : pose;
      const sink = Math.round(DUCK_DEPTH * progress(a, DUCK) ** 2);
      standing(b, S, cx + X, cy + G + sink, 1, opts(cx, cy, s.seed, 0, false, cy + G));
    }

    const puff = until(PUFFS, a);
    if (puff) {
      // a puff either side of the squash, PUFF_GAP cells clear of X, drifting outward as they thin
      const out = PUFF_GAP + puff[1];
      const art = puff[2];
      stamp(b, art, cx + X - out - (spriteWidth(art) - 1), cy + G - 1);
      stamp(b, art, cx + X + out, cy + G - 1);
    }

    // stamp draws nothing at ink 0, so the slot's shut first row needs no gate
    const slot = until(SLOT_FADE, a);
    if (slot) stamp(b, SLOT, cx + X - (spriteWidth(SLOT) >> 1), cy + G + 1, slot[1]);
  },
};

export default pop;
