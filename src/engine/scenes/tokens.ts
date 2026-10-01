/**
 * tokens — the autoregressive loop. A short paragraph of token blocks ends in
 * a blinking cursor; under it, a framed list of candidate tokens with their
 * probability bars. Scrolling picks the likeliest candidate, lifts it into the
 * slot, appends it (the newest token is the accent block), and asks again —
 * one token at a time, until the paragraph fills.
 *
 * Also home of the shared look of the text-as-a-strip family (tokens, chat,
 * window): token height, gaps, radii, stroke weight and the cursor block.
 */
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

// ── scene ────────────────────────────────────────────────────────────────

/** tokens already on the page at p = 0 */
const START = 10;
/** tokens appended across the story beat (each step ≈ 9% of the progress) */
const STEPS = 8;
const SLOTS = START + STEPS + 2;
const P0 = 0.05;
const P1 = 0.75;
/** candidate list: relative probabilities (the likeliest is the real next token) */
const PROB = [0.41, 0.17, 0.12];
/** ink density of each candidate row */
const CAND_A = [0.92, 0.5, 0.36];
const SEED = 7;

// step timeline (fractions of one step)
const SEL = 0.3; // the top candidate is chosen (turns accent)
const LIFT0 = 0.35; // … lifts out of the list …
const LAND = 0.75; // … and lands in the slot
const MOVE1 = 0.95; // the list has followed the cursor

const scene: Scene = {
  paint({ r, box, p, t }) {
    const g = r.begin();
    const { th, gap, pitch, lw, cw } = kit(box, 1.3);
    const { L } = space(box);
    const maxW = Math.round(Math.min(box.w * 0.88, L(1.96)));
    const x0 = Math.round(box.cx - maxW / 2);

    // paragraph layout (slot i = where token i goes)
    const sx: number[] = [];
    const srow: number[] = [];
    const sw: number[] = [];
    let cx = 0;
    let row = 0;
    for (let i = 0; i < SLOTS; i++) {
      const w = tokenW(i, SEED, th);
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
    const s = range(P0, P1, p) * STEPS;
    let k = Math.floor(s);
    let f = s - k;
    if (k >= STEPS) {
      k = STEPS;
      f = 0;
    }
    const slotA = START + k; // the slot being predicted
    const slotB = slotA + 1; // the next one, once it has landed
    const chosen = f >= SEL;
    const landed = f >= LAND;
    const lift = landed ? 1 : easeInOut(range(LIFT0, LAND, f));
    // everything that follows the cursor (rows, list) eases to the next slot
    const mv = landed ? easeInOut(range(LAND, MOVE1, f)) : 0;
    const placed = slotA + (landed ? 1 : 0);
    const newest = chosen ? slotA : slotA - 1;

    // candidate list geometry
    const nCand = 3;
    const cPitch = Math.round(th * 1.45);
    const pad = Math.max(2, Math.round(th * 0.5));
    const dropGap = Math.round(th * 0.9) + pad;
    const dropH = dropGap + (nCand - 1) * cPitch + th + pad;
    const tokMax = Math.round(th * 2.6);
    const barMax = Math.round(maxW * 0.3);
    const listW = tokMax + gap * 2 + barMax;
    const listH = (nCand - 1) * cPitch + th + pad * 2;

    // vertical centring: paragraph rows + candidate list, eased across a wrap
    const rowsF = lerp(srow[slotA], srow[slotB], mv) + 1;
    const contentH = (rowsF - 1) * pitch + th + dropH;
    const top = box.cy - contentH / 2;
    const Yrow = (rw: number) => Math.round(top + rw * pitch);

    // tokens on the page — a slow reading wave passes over them (ambient)
    const wave = t > 0 ? ((t * 7) % (placed + 14)) - 5 : -99;
    for (let i = 0; i < placed; i++) {
      const y = Yrow(srow[i]);
      if (i === newest) {
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
    const list = (slot: number, a: number, skipTop: boolean) => {
      for (let c = 0; c < nCand; c++) {
        const y = ly + c * cPitch;
        const shimmer = 0.92 + 0.08 * Math.sin(t * 2.4 + c * 1.7);
        const ca = a * shimmer;
        if (ca <= 0.02) continue;
        const bar = Math.max(2, Math.round((barMax * PROB[c]) / PROB[0]));
        fillRound(g, barX, y + Math.floor((th - bh) / 2), bar, bh, 0.6, INK((c === 0 ? 0.78 : CAND_A[c]) * ca));
        if (c === 0 && skipTop) continue;
        const w = c === 0 ? sw[slot] : tokenW(slot * 5 + c, SEED + 3, th);
        token(g, lx, y, w, th, INK(CAND_A[c] * ca));
      }
    };
    if (oldA > 0.02) list(slotA, oldA, chosen);
    if (newA > 0.02) list(slotB, newA, false);
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
