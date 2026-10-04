/**
 * star-crumble — the AI sparkle, and what's under it. A one-frame glint
 * springs open into a chubby four-point sparkle (✦) with a two-dot face,
 * overshooting by a ring before it settles. It twinkles (once or twice: 'o'
 * glints on the diagonals), lifts one row in a buzz-float, and blinks. At
 * .5 s it shatters from the tips inward in 2×2 chunks: up to six chunks off
 * the side arms drop three rows and slip outward, fading through the
 * chapter's marks; the rest vanish like the page dissolve. Left behind is the
 * face block — the same little core the page calls the model — which hops,
 * blinks, and drops away in halftone steps.
 *
 * Everything is accent; the eyes are punched holes. Every sprite is centred
 * on the clicked cell C, so a beat only names a sprite and a row offset.
 *
 * Beat by beat (effective seconds):
 *   0   – .05   GLINT, a 5×5 plus
 *   .05 – .10   STAR_BIG: the spring overshoots by a ring
 *   .10 – .14   STAR, settled
 *   .14 – .20   STAR_TWINKLE: the first twinkle
 *   .20 – .32   STAR one row up: the buzz-float
 *   .32 – .38   STAR_TWINKLE again if it twinkles twice, else STAR
 *   .38 – .42   STAR
 *   .42 – .50   STAR_SQUINT: a blink
 *   .50 – .62   the shatter: every chunk round FACE lets go (tips first, or
 *               scattered); a faller drops for .28 s, one halftone step every
 *               70 ms (1 → .75 → .5 → .25), so the last is gone by .90
 *   .50 – .62   FACE, the core left behind
 *   .62 – .70   FACE hops a row
 *   .70 – .80   FACE_SQUINT: a blink, held to the drop
 *   .80 – 1.08  FACE drops away 1 → 3 rows in the same halftone steps; then
 *               nothing to the end of its 1.2 s life
 *
 * Boop / tickle: STAR_SQUINT before .50, FACE_SQUINT after (falling too).
 *
 * Variants (s.variant, by index): 0 = one twinkle, tips first; 1 = two
 * twinkles, tips first; 2 = one twinkle, scattered; 3 = two twinkles,
 * scattered. Seeded: two twinkles one click in two, scattered one in five;
 * the seed also picks which side chunks fall.
 *
 * Footprint: x -6..+6, y -6..+6 (13×13), set by STAR_BIG; the falls stay
 * inside it. It neither travels nor faces a way: one layout, no mirror.
 *
 * Reduced motion (life 1.0): STAR, still, to .6 s; its chunks vanish in place
 * tips first, all by .87; then FACE crumbles away over [.88, 1.0). No glint,
 * twinkle, float, hop or fall. A boop shows the same squint, still: the
 * still turns STAR_SQUINT, its face block FACE_SQUINT.
 */
import { hash2, keyedOpts, progress, rnd, type Span, type Sprite, sprite, spriteWidth, steps, until } from './helpers';
import type { Pen, Pop } from './types';

// ── sprites ──────────────────────────────────────────────────────────────

/** ASCII pixel art (the shared legend): here '@' accent 1, 'o' accent .5, 'x' a punched eye */

/** frame 0: the glint the sparkle springs from */
const GLINT: Sprite = [
  '  @  ',
  '  @  ',
  '@@@@@',
  '  @  ',
  '  @  ',
];

/** the spring overshoot, one ring past STAR (eyes cols 5/7, rows 5-6) */
const STAR_BIG: Sprite = [
  '      @      ',
  '      @      ',
  '     @@@     ',
  '     @@@     ',
  '    @@@@@    ',
  '  @@@x@x@@@  ',
  '@@@@@x@x@@@@@',
  '  @@@@@@@@@  ',
  '    @@@@@    ',
  '     @@@     ',
  '     @@@     ',
  '      @      ',
  '      @      ',
];

/** the settled sparkle (eyes cols 4/6, rows 4-5); its face box, cols 3-7 rows 3-6, is FACE */
const STAR: Sprite = [
  '     @     ',
  '    @@@    ',
  '    @@@    ',
  '   @@@@@   ',
  ' @@@x@x@@@ ',
  '@@@@x@x@@@@',
  ' @@@@@@@@@ ',
  '   @@@@@   ',
  '    @@@    ',
  '    @@@    ',
  '     @     ',
];

/** STAR with 'o' glints on the diagonals: the twinkle (.5 is an exact halftone step, so each glint is one even chapter mark) */
const STAR_TWINKLE: Sprite = [
  'o    @    o',
  ' o  @@@  o ',
  '    @@@    ',
  '   @@@@@   ',
  ' @@@x@x@@@ ',
  '@@@@x@x@@@@',
  ' @@@@@@@@@ ',
  '   @@@@@   ',
  '    @@@    ',
  ' o  @@@  o ',
  'o    @    o',
];

/** STAR with its eyes squeezed to one row: the blink, and the boop face */
const STAR_SQUINT: Sprite = [
  '     @     ',
  '    @@@    ',
  '    @@@    ',
  '   @@@@@   ',
  ' @@@@@@@@@ ',
  '@@@@x@x@@@@',
  ' @@@@@@@@@ ',
  '   @@@@@   ',
  '    @@@    ',
  '    @@@    ',
  '     @     ',
];

/** the core under the sparkle: STAR's face box, so centred on C it lands exactly where it was */
const FACE: Sprite = [
  '@@@@@',
  '@x@x@',
  '@x@x@',
  '@@@@@',
];

/** FACE squinting (= STAR_SQUINT's face box) */
const FACE_SQUINT: Sprite = [
  '@@@@@',
  '@@@@@',
  '@x@x@',
  '@@@@@',
];

// ── timing ───────────────────────────────────────────────────────────────

/**
 * A beat: [until, art, dy, once?] — the sprite shown until `until`, shifted
 * `dy` rows, and for the encore twinkle what plays instead when it twinkles
 * only once.
 */
type Beat = readonly [until: number, art: Sprite, dy: number, once?: Sprite];

/** the sparkle shatters here; the face block carries on alone */
const CRUMBLE = 0.5;
/** the face block lets go and drops */
const DROP = 0.8;

/** the sparkle, up to the shatter */
const BLOOM: readonly Beat[] = [
  [0.05, GLINT, 0],
  [0.1, STAR_BIG, 0], // the spring overshoot
  [0.14, STAR, 0],
  [0.2, STAR_TWINKLE, 0],
  [0.32, STAR, -1], // one buzz-float lift
  [0.38, STAR_TWINKLE, 0, STAR], // the second twinkle: plain STAR when it twinkles once
  [0.42, STAR, 0],
  [CRUMBLE, STAR_SQUINT, 0], // a blink, 80 ms: the eyes open on the shattered core
];

/**
 * The face block once the sparkle has shattered off it, until it drops. The
 * hop waits until every chunk has let go (.62). The blink holds to the drop:
 * opening the eyes for the 40 ms before it would dip (-1,-1) solid → hole →
 * solid, the sub-250 ms flicker helpers.ts warns about.
 */
const FACE_BEATS: readonly Beat[] = [
  [0.62, FACE, 0],
  [0.7, FACE, -1], // a happy hop
  [DROP, FACE_SQUINT, 0], // a blink; the eyes open as it drops
];

/** one halftone step of a fall: every STEP s the tone drops a level and the piece falls further */
const STEP = 0.07;
/** a falling piece's tones, one per STEP, then it's gone: solid, then the chapter's marks shrinking */
const FADE = [1, 0.75, 0.5, 0.25] as const;

/** When the chunks let go: `start` + `stagger`·(TIP_DD − dd) + `jitter`·noise, never before `start`. */
type Release = { readonly start: number; readonly stagger: number; readonly jitter: number };
/** tips first: every chunk has gone by .62 */
const TIPS_FIRST: Release = { start: CRUMBLE, stagger: 0.025, jitter: 0.02 };
/** the scattered release: any order, over this long from CRUMBLE (so also all gone by .62) */
const SCATTER = 0.12;

/** reduced motion: the still holds to STILL.start, then the chunks vanish in place, tips first (all by .87) */
const STILL: Release = { start: 0.6, stagger: 0.06, jitter: 0.03 };
/** reduced motion: the face block crumbles away over this span, which ends the still's life */
const STILL_FACE: Span = [0.88, 1];

// ── variants ─────────────────────────────────────────────────────────────

/** s.variant, by index: how many times it twinkles, and whether the chunks let go tips first or scattered */
const VARIANTS: readonly { readonly twice: boolean; readonly scattered: boolean }[] = [
  { twice: false, scattered: false }, // 0: one twinkle, tips first
  { twice: true, scattered: false }, // 1: two twinkles, tips first
  { twice: false, scattered: true }, // 2: one twinkle, scattered
  { twice: true, scattered: true }, // 3: two twinkles, scattered
];
/** seeded: two twinkles one click in two */
const P_TWICE = 0.5;
/** seeded: a scattered release one click in five; tips first is the shatter's main read */
const P_SCATTERED = 0.2;

// ── the shatter ──────────────────────────────────────────────────────────

/** at most this many chunks fall; the others vanish in place, like the page dissolve */
const MAX_FALLERS = 6;
/** dd of the top and left tips' blocks: they set the pace (the right and bottom tips sit one further out and clamp to `start`) */
const TIP_DD = 4.5;

/** A box of cells relative to C, bounds inclusive. */
type Box = { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number };

function inBox(r: Box, x: number, y: number): boolean {
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}

/** FACE's cells (STAR's cols 3-7, rows 3-6): the rest of STAR is the chunks */
const FACE_BOX: Box = { x0: -2, x1: 2, y0: -2, y1: 1 };
/** where the face block travels while chunks fall (its hop up to row -3, its drop's first rows down to +2): no faller may draw here */
const CLEAR: Box = { x0: -2, x1: 2, y0: -3, y1: 2 };
/**
 * A block may fall only when its centre sits at least this far (sprite
 * space) from STAR's middle column: only bx 0, 1, 4 and 5 — the horizontal
 * arms — are side chunks. The 2×2 grid starts at col 0, so bx 3 (cols 6-7)
 * holds the vertical arms' right column; falling, it would read as a stalk
 * under the face, or vanish inside the face's travel and waste a faller slot.
 */
const SIDE = 2.5;

/** Rows a piece has fallen tau s after letting go: one at once, then ~30·tau² (3 at most within FADE). */
function fallRows(tau: number): number {
  return 1 + Math.round(30 * tau * tau);
}

/** STAR's centre cell (column w >> 1, row h >> 1), which sprite() puts on C */
const SX = spriteWidth(STAR) >> 1;
const SY = STAR.length >> 1;

/**
 * STAR's cells outside FACE_BOX, grouped in 2×2 sprite-space blocks: the
 * chunks the sparkle shatters into. Per piece: its offset from C and its
 * block (every piece is solid accent: the eyes are inside FACE_BOX). Per
 * block: its sprite-space coords (the hash keys), its Chebyshev distance dd
 * from the centre (tips go first), and the side it slips toward as it falls —
 * 0 for the top and bottom arms, which never fall, so nothing reads as a stem.
 */
const CHUNKS = (() => {
  const px: number[] = [];
  const py: number[] = [];
  const pb: number[] = [];
  const bx: number[] = [];
  const by: number[] = [];
  const dd: number[] = [];
  const out: number[] = [];
  STAR.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] === ' ') continue;
      const x = c - SX;
      const y = r - SY;
      if (inBox(FACE_BOX, x, y)) continue; // FACE draws it
      // chunks() dots every piece as solid accent: a glint or a hole out here would draw wrong
      if (import.meta.env.DEV && row[c] !== '@') throw new Error(`star-crumble: '${row[c]}' outside the face box`);
      const kx = c >> 1;
      const ky = r >> 1;
      let k = bx.findIndex((v, j) => v === kx && by[j] === ky);
      if (k < 0) {
        k = bx.length;
        // the block's centre, from STAR's centre
        const sx = 2 * kx + 0.5 - SX;
        const sy = 2 * ky + 0.5 - SY;
        bx.push(kx);
        by.push(ky);
        dd.push(Math.max(Math.abs(sx), Math.abs(sy)));
        out.push(Math.abs(sx) >= SIDE ? Math.sign(sx) : 0);
      }
      // the art is fixed, so checking once at load (in dev) stands in for a per-frame check in chunks(): no faller's path crosses the face block's
      if (import.meta.env.DEV && out[k] !== 0) {
        for (let fall = 1; fall <= fallRows(STEP * FADE.length); fall++) {
          if (inBox(CLEAR, x + out[k], y + fall)) throw new Error('star-crumble: a falling chunk would cross the face');
        }
      }
      px.push(x);
      py.push(y);
      pb.push(k);
    }
  });
  return {
    px: Int8Array.from(px),
    py: Int8Array.from(py),
    pb: Uint8Array.from(pb),
    bx: Int8Array.from(bx),
    by: Int8Array.from(by),
    dd: Float32Array.from(dd),
    out: Int8Array.from(out),
  };
})();

/** per-paint scratch, one slot per block, so paint allocates nothing: when it lets go, its fall rank, whether it falls */
const RELEASE = new Float64Array(CHUNKS.bx.length);
const RANK = new Float64Array(CHUNKS.bx.length);
const FALLS = new Uint8Array(CHUNKS.bx.length);

/** Fill RELEASE: with timing `t`, or scattered when `t` is null. */
function letGo(seed: number, t: Release | null) {
  const { bx, by, dd } = CHUNKS;
  for (let i = 0; i < bx.length; i++) {
    RELEASE[i] = t
      ? Math.max(t.start, t.start + t.stagger * (TIP_DD - dd[i]) + t.jitter * hash2(bx[i], by[i], seed))
      : CRUMBLE + SCATTER * hash2(bx[i], by[i], seed + 9);
  }
}

/** Fill FALLS: the MAX_FALLERS side blocks with the highest hash fall (ties go to the earlier block). */
function pickFallers(seed: number) {
  const { bx, by, out } = CHUNKS;
  const n = bx.length;
  for (let i = 0; i < n; i++) RANK[i] = out[i] ? hash2(bx[i], by[i], seed + 5) : -1;
  for (let i = 0; i < n; i++) {
    let above = 0;
    for (let j = 0; j < n; j++) if (RANK[j] > RANK[i] || (RANK[j] === RANK[i] && j < i)) above++;
    FALLS[i] = RANK[i] >= 0 && above < MAX_FALLERS ? 1 : 0;
  }
}

/**
 * The shattered rim at age a: each chunk in place until it lets go, then (if
 * it falls) dropping and slipping outward as it fades; the rest just vanish.
 * A faller slips outward on its very first frame: dropped straight down it
 * would sit flush under its old neighbours, so the arm would look bent or
 * sagging rather than chipped. CHUNKS checks (in dev, at load)
 * that no faller can reach CLEAR.
 */
function chunks(b: Pen, cx: number, cy: number, a: number, fall: boolean) {
  const { px, py, pb, out } = CHUNKS;
  for (let p = 0; p < pb.length; p++) {
    const i = pb[p];
    const tau = a - RELEASE[i];
    if (tau < 0) {
      b.dot(cx + px[p], cy + py[p], 1, true);
      continue;
    }
    if (!fall || !FALLS[i]) continue;
    const step = steps(tau, STEP);
    if (step < FADE.length) b.dot(cx + px[p] + out[i], cy + py[p] + fallRows(tau), FADE[step], true);
  }
}

// ── painting ─────────────────────────────────────────────────────────────

/** the reduced still's crumble, keyed to C so the face block breaks up like the page dissolve */
const opts = keyedOpts();

const pop: Pop = {
  life: 1.2,
  reducedLife: STILL_FACE[1],
  // it neither travels nor faces a way, so one layout; STAR_BIG's ±6 is the widest and lowest it draws
  layouts: () => [{ fit: { dir: 1, size: 0 }, reach: [-6, -6, 6, 6] }],
  paint({ b, x, y, age: a, seed, variant, squint, reduced }) {
    const cx = Math.floor(x);
    const cy = Math.floor(y);

    if (reduced) {
      const face = squint ? FACE_SQUINT : FACE;
      if (a >= STILL_FACE[0]) {
        sprite(b, face, cx, cy, 1, opts(cx, cy, seed, progress(a, STILL_FACE)));
        return;
      }
      // FACE (or FACE_SQUINT) plus every chunk in place is exactly STAR (or STAR_SQUINT): the still
      letGo(seed, STILL);
      chunks(b, cx, cy, a, false);
      sprite(b, face, cx, cy);
      return;
    }

    // out of range (a stray dev override) falls back to the seed, like undefined
    const forced = variant === undefined ? undefined : VARIANTS[variant];

    // BLOOM runs to CRUMBLE: past it, until() finds no beat and the sparkle has shattered
    const bloom = until(BLOOM, a);
    if (bloom) {
      const twice = forced ? forced.twice : rnd(seed, 0) < P_TWICE;
      const art = squint ? STAR_SQUINT : bloom[3] && !twice ? bloom[3] : bloom[1];
      sprite(b, art, cx, cy + bloom[2]);
      return;
    }

    const scattered = forced ? forced.scattered : rnd(seed, 1) < P_SCATTERED;
    letGo(seed, scattered ? null : TIPS_FIRST);
    pickFallers(seed);
    chunks(b, cx, cy, a, true);

    // FACE_BEATS runs to DROP: past it, the face block falls
    const beat = until(FACE_BEATS, a);
    if (beat) {
      sprite(b, squint ? FACE_SQUINT : beat[1], cx, cy + beat[2]);
      return;
    }
    // the face block falls fallRows(tau) below C, just like its chunks
    const tau = a - DROP;
    const step = steps(tau, STEP);
    if (step < FADE.length) sprite(b, squint ? FACE_SQUINT : FACE, cx, cy + fallRows(tau), FADE[step]);
  },
};

export default pop;
