/**
 * tokens — the autoregressive loop, mirroring the demo beside it
 * (NEXT_TOKEN_DEMO): the prompt's token blocks (widths follow the words) end in
 * a blinking cursor; under it, a framed list of the top three candidates with
 * their probability bars. Scrolling picks the likeliest candidate, lifts it
 * into the slot, appends it (the newest generated token is the accent block),
 * and asks again. tokenStep() is the one p → step map, shared with the demo.
 *
 * Also home of the shared look of the text-as-a-strip family (tokens, chat,
 * window): token height, gaps, radii, stroke weight and the cursor block.
 */
import { NEXT_TOKEN_DEMO } from '../../content/sections';
import { easeInOut, hash2, lerp, range } from '../noise';
import type { Box, Scene } from './types';
import { ACC, INK, blink, fillRound, space, strokeRound } from './helpers';

// ── shared strip vocabulary ──────────────────────────────────────────────

/** Metrics of the strip family, in whole cells so static blocks stay crisp. */
export function kit(box: Box, scale = 1) {
  const { L } = space(box);
  const th = Math.max(3, Math.round(L(0.105 * scale)));
  return {
    /** token height */
    th,
    /** gap between tokens on a row */
    gap: Math.max(1, Math.round(th * 0.32)),
    /** row pitch */
    pitch: Math.round(th * 1.7),
    /** frame stroke weight: 2 cells on desktop, 1.5 on small grids */
    lw: Math.max(1.5, Math.round(L(0.05))),
    /** cursor width */
    cw: Math.max(2, Math.round(th * 0.6)),
  };
}

/**
 * Offset that puts a stroke of weight `lw` on whole cells when drawn along an
 * integer coordinate (a 2-cell stroke straddles it, a 1.5 stroke sits inside).
 */
export const edge = (lw: number) => (lw >= 2 ? 0 : 0.5);

/** Stable word-piece width for token `i` (seeded), in cells. */
export function tokenW(i: number, seed: number, th: number) {
  const h = hash2(i, seed, 23);
  return Math.round(th * (1 + 1.55 * h * h));
}

/** One token block. */
export function token(g: CanvasRenderingContext2D, x: number, y: number, w: number, th: number, style: string) {
  fillRound(g, x, y, w, th, th * 0.3, style);
}

/** The cursor: a narrow solid block, dimmed (not hidden) when blinking off. */
export function caret(g: CanvasRenderingContext2D, x: number, y: number, th: number, cw: number, on: number) {
  const over = Math.max(1, Math.round(th * 0.15));
  fillRound(g, x, y - over, cw, th + over * 2, Math.min(1, cw / 3), INK(on ? 1 : 0.2));
}

// ── the story's timeline (shared with the demo in TokenDemo.tsx) ─────────

/** prompt tokens already on the page */
const PROMPT = NEXT_TOKEN_DEMO.prompt;
const PRED = NEXT_TOKEN_DEMO.steps;
const START = PROMPT.length;
/** tokens appended across the story: every prediction but the last, which stays open */
export const TOKEN_STEPS = PRED.length - 1;

/** Beats inside one step (fractions of a step). */
export const BEAT = {
  /** the likeliest candidate is chosen (turns accent) … */
  SEL: 0.3,
  /** … lifts out of the list … */
  LIFT0: 0.35,
  /** … and lands in the slot: appended; the next prediction appears */
  LAND: 0.75,
  /** the list has followed the cursor */
  MOVE1: 0.95,
} as const;

/**
 * Where the steps sit in the scene progress. Desktop: the read act's scene
 * progress — prediction 0 appears (s = LAND − 1) as the demo fades in beside
 * the body text (Section's reveal stagger puts it at p ≈ .31–.37), and the
 * first pick comes once it is in full view. Mobile: the ticker's mobileScene
 * for this section — 0 as the demo's bottom edge comes into view, 1 as its top
 * reaches the top bar — so every step plays while the whole demo is on screen
 * (prediction 0's bars grow in at 0, the last token lands with a short hold).
 */
const SPAN = { desktop: [0.17, 0.96], mobile: [0.06, 0.96] } as const;

/**
 * Scene progress → step. `s` is the continuous step coordinate (negative
 * before the first step, > TOKEN_STEPS after the last); `k` (0…TOKEN_STEPS)
 * and `f` are the clamped step and the fraction into it; `n` is how many
 * tokens have been appended (also the index of the prediction on show).
 */
export function tokenStep(sp: number, mobile: boolean) {
  const [a, b] = mobile ? SPAN.mobile : SPAN.desktop;
  const s = ((sp - a) / (b - a)) * TOKEN_STEPS;
  let k = Math.floor(s);
  let f = s - k;
  if (k < 0) {
    k = 0;
    f = 0;
  } else if (k >= TOKEN_STEPS) {
    k = TOKEN_STEPS;
    f = 0;
  }
  const chosen = f >= BEAT.SEL;
  const landed = f >= BEAT.LAND;
  return { s, k, f, chosen, landed, n: k + (landed ? 1 : 0) };
}

/** Block width of a token's text (its leading space counts, like the demo's “·”). */
const wordW = (text: string, th: number) => Math.max(2, Math.round(th * (0.7 + 0.28 * text.length)));

// ── scene ────────────────────────────────────────────────────────────────

/** the sentence: prompt, appended tokens, the open slot, one spare slot */
const SEQ = [...PROMPT, ...PRED.map((c) => c[0].token), ' '];
/** candidates drawn per list */
const N_CAND = 3;
/** ink density of each candidate row */
const CAND_A = [0.92, 0.5, 0.36];

const scene: Scene = {
  paint({ r, box, p, t, mobile }) {
    const g = r.begin();
    const { th, gap, pitch, lw, cw } = kit(box, 1.5);
    const { L } = space(box);
    const maxW = Math.round(Math.min(box.w * 0.88, L(1.96)));
    const x0 = Math.round(box.cx - maxW / 2);

    // paragraph layout (slot i = where token i goes)
    const sx: number[] = [];
    const srow: number[] = [];
    const sw: number[] = [];
    let cx = 0;
    let row = 0;
    for (let i = 0; i < SEQ.length; i++) {
      const w = wordW(SEQ[i], th);
      if (cx > 0 && cx + w > maxW) {
        cx = 0;
        row++;
      }
      sx.push(x0 + cx);
      srow.push(row);
      sw.push(w);
      cx += w + gap;
    }

    // story: which step, and how far into it
    const { k, f, chosen, landed } = tokenStep(p, mobile);
    const { SEL, LIFT0, LAND, MOVE1 } = BEAT;
    const slotA = START + k; // the slot being predicted
    const slotB = slotA + 1; // the next one, once it has landed
    const lift = landed ? 1 : easeInOut(range(LIFT0, LAND, f));
    // everything that follows the cursor (rows, list) eases to the next slot
    const mv = landed ? easeInOut(range(LAND, MOVE1, f)) : 0;
    const placed = slotA + (landed ? 1 : 0);
    // the newest generated token is the accent block (the prompt never is)
    const newest = chosen ? slotA : slotA - 1;

    // candidate list geometry
    const cPitch = Math.round(th * 1.45);
    const pad = Math.max(2, Math.round(th * 0.5));
    const dropGap = Math.round(th * 0.9) + pad;
    const dropH = dropGap + (N_CAND - 1) * cPitch + th + pad;
    let tokMax = 0;
    for (const c of PRED) for (let j = 0; j < N_CAND; j++) tokMax = Math.max(tokMax, wordW(c[j].token, th));
    const barMax = Math.round(maxW * 0.3);
    const listW = tokMax + gap * 2 + barMax;
    const listH = (N_CAND - 1) * cPitch + th + pad * 2;

    // vertical centring: paragraph rows + candidate list, eased across a wrap
    const rowsF = lerp(srow[slotA], srow[slotB], mv) + 1;
    const contentH = (rowsF - 1) * pitch + th + dropH;
    const top = box.cy - contentH / 2;
    const Yrow = (rw: number) => Math.round(top + rw * pitch);

    // tokens on the page — a slow reading wave passes over them (ambient)
    const wave = t > 0 ? ((t * 7) % (placed + 14)) - 5 : -99;
    for (let i = 0; i < placed; i++) {
      const y = Yrow(srow[i]);
      if (i === newest && i >= START) {
        token(g, sx[i], y, sw[i], th, ACC(1));
        continue;
      }
      const lit = Math.max(0, 1 - Math.abs(i - wave) / 2.2);
      token(g, sx[i], y, sw[i], th, INK(0.86 + 0.14 * lit));
    }

    // cursor: at the slot until the guess arrives, then one slot on
    const on = blink(t);
    if (landed) caret(g, sx[slotB], Yrow(srow[slotB]), th, cw, on);
    else if (lift < 0.5) caret(g, sx[slotA], Yrow(srow[slotA]), th, cw, on);

    // the candidate list: always on screen, sliding after the cursor
    const anchor = (slot: number) => Math.max(x0 + pad, Math.min(sx[slot], x0 + maxW - listW - pad));
    const lx = Math.round(lerp(anchor(slotA), anchor(slotB), mv));
    const ly = Math.round(top + (rowsF - 1) * pitch + th + dropGap);
    const e = edge(lw);
    strokeRound(g, lx - pad + e, ly - pad + e, listW + pad * 2 - e * 2, listH - e * 2, th * 0.5, lw, INK(0.42));

    const barX = lx + tokMax + gap * 2;
    const bh = Math.max(1, Math.round(th * 0.5));
    // the old list dims once a token is chosen, then swaps for the next guess
    const oldA = landed ? 0.45 * (1 - range(LAND, LAND + 0.08, f)) : 1 - 0.55 * range(SEL, SEL + 0.12, f);
    const newA = landed ? range(LAND + 0.04, 1, f) : 0;
    /** prediction q (its top three candidates and their relative bars) */
    const list = (q: number, a: number, skipTop: boolean) => {
      const cands = PRED[q];
      if (!cands) return;
      for (let c = 0; c < N_CAND; c++) {
        const y = ly + c * cPitch;
        const shimmer = 0.92 + 0.08 * Math.sin(t * 2.4 + c * 1.7);
        const ca = a * shimmer;
        if (ca <= 0.02) continue;
        const bar = Math.max(2, Math.round((barMax * cands[c].p) / cands[0].p));
        fillRound(g, barX, y + Math.floor((th - bh) / 2), bar, bh, 0.6, INK((c === 0 ? 0.78 : CAND_A[c]) * ca));
        if (c === 0 && skipTop) continue;
        token(g, lx, y, wordW(cands[c].token, th), th, INK(CAND_A[c] * ca));
      }
    };
    if (oldA > 0.02) list(k, oldA, chosen);
    if (newA > 0.02) list(k + 1, newA, false);
    if (chosen && !landed) {
      // the likeliest token lifts up into the slot
      const tx = Math.round(lerp(lx, sx[slotA], lift));
      const ty = Math.round(lerp(ly, Yrow(srow[slotA]), lift));
      token(g, tx, ty, sw[slotA], th, ACC(1));
    }

    r.commit();
  },
};

export default scene;
