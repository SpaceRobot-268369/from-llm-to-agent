/**
 * twinkle — the small answer for a tight spot. When none of the deck's pops
 * fits around the click (a sticker or a paragraph close by), a sparkle still
 * springs open there. Beat by beat (effective seconds):
 *   0–.04      a bud: a 3×3 plus on the very first frame
 *   .04–.10    it overshoots into a full ✦
 *   .10–.75    it settles into a little star …
 *   .22–.34    … glints at its corners (fine chapter marks) …
 *   .30        … floats up a row …
 *   .45–.75    … and crumbles in blocks
 *
 * Boop / tickle: no face; live.ts's pause alone holds the frame. Variants:
 * none. Reduced motion: the settled star, still, held to .5 s and crumbled in
 * place by .8 s.
 *
 * Footprint: x -3..+3, y -4..+3 around the clicked cell C (the float's row
 * included) — a 7×8 patch of bare page is all it needs.
 */
import { during, keyedOpts, progress, type Span, stamp } from './helpers';
import type { Pop } from './types';

// ── sprites ──────────────────────────────────────────────────────────────

/** the first frame: a bud */
const BUD = [' @ ', '@@@', ' @ '];
/** the overshoot: a full ✦ */
const BIG = ['   @   ', '   @   ', '  @@@  ', '@@@@@@@', '  @@@  ', '   @   ', '   @   '];
/** settled */
const STAR = ['  @  ', '  @  ', '@@@@@', '  @  ', '  @  '];
/** its glint: fine diagonal dots (chapter marks), one cell out from the star's corners */
const GLINT = [':     :', '       ', '       ', '       ', '       ', '       ', ':     :'];

// ── timing (effective seconds) ───────────────────────────────────────────

const BUD_END = 0.04;
const BIG_END = 0.1;
const GLINT_AT: Span = [0.22, 0.34];
const FLOAT_AT = 0.3;
const CRUMBLE: Span = [0.45, 0.75];
const STILL_CRUMBLE: Span = [0.5, 0.8];

// ── painting ─────────────────────────────────────────────────────────────

/** the star's stamp options, refilled per frame: its crumble keyed to C */
const opts = keyedOpts();

const pop: Pop = {
  life: CRUMBLE[1],
  reducedLife: STILL_CRUMBLE[1],
  layouts: () => [{ fit: { dir: 1, size: 0 }, reach: [-3, -4, 3, 3] }],
  paint({ b, x, y, age, seed, reduced }) {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (reduced) {
      stamp(b, STAR, cx - 2, cy - 2, 1, opts(cx, cy, seed, progress(age, STILL_CRUMBLE)));
      return;
    }
    if (age < BUD_END) {
      stamp(b, BUD, cx - 1, cy - 1);
      return;
    }
    if (age < BIG_END) {
      stamp(b, BIG, cx - 3, cy - 3);
      return;
    }
    const lift = age >= FLOAT_AT ? 1 : 0;
    stamp(b, STAR, cx - 2, cy - 2 - lift, 1, opts(cx, cy, seed, progress(age, CRUMBLE)));
    if (during(age, GLINT_AT)) stamp(b, GLINT, cx - 3, cy - 3 - lift);
  },
};

export default pop;
