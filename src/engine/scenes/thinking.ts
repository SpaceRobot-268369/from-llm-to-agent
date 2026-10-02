/**
 * thinking — chain of thought: more tokens before the answer. A solid
 * question row on top, a dashed scratchpad of "working" tokens in the middle
 * (dashed: usually hidden), and the answer at the bottom. Scrolling turns up
 * the effort meter on the right: the scratchpad is written out row by row
 * (the typing head pulses softly) and pushes the answer's slot further down.
 * The answer is only a faint slot while the working is being written; it
 * lands, solid, once the working is done — same engine, the next tokens
 * spent first.
 */
import { hash2, range, easeInOut, smoothstep } from '../noise';
import type { Scene } from './types';
import { ACC, INK, blink, fillRound, space, strokeRound } from './helpers';

const MAX_ROWS = 6;
const QUESTION = [0.2, 0.13, 0.24, 0.11];
const ANSWER = [0.16, 0.1];

/** stable ragged token widths for scratch row i (in L units) */
function rowTokens(i: number): number[] {
  const out: number[] = [];
  let used = 0;
  for (let k = 0; used < 1.15; k++) {
    const w = 0.08 + 0.14 * hash2(i, k, 23);
    out.push(w);
    used += w + 0.035;
  }
  return out;
}
const ROWS = Array.from({ length: MAX_ROWS }, (_, i) => rowTokens(i));

const scene: Scene = {
  paint({ r, box, p, t }) {
    const g = r.begin();
    const { X, Y, L } = space(box);
    const th = Math.max(2, Math.round(L(0.085)));
    const gap = Math.max(1, Math.round(L(0.035)));
    const pitch = th + Math.max(2, Math.round(L(0.05)));
    const left = Math.round(X(-0.86));
    const right = Math.round(X(0.5));

    // effort: 1 → 6 scratch rows across the scroll
    const effort = easeInOut(range(0.05, 0.85, p));
    const rowsF = 1.2 + (MAX_ROWS - 1.2) * effort;
    // the working is done: the answer lands and the typing head stops
    const done = smoothstep(0.85, 0.93, p);

    const tokenRow = (y: number, widths: number[], style: string, limit = Infinity) => {
      let x = left;
      let drawn = 0;
      for (const w of widths) {
        const pw = Math.round(L(w));
        if (x + pw > right || drawn >= limit) break;
        const part = Math.min(1, limit - drawn);
        fillRound(g, x, y, Math.max(1, Math.round(pw * part)), th, Math.round(th / 3), style);
        x += pw + gap;
        drawn += 1;
      }
      return x;
    };

    // stack is vertically centred for the current scratch size
    const scratchH = Math.ceil(rowsF) * pitch + gap * 2;
    const total = th + pitch * 0.9 + scratchH + pitch * 0.9 + th;
    let y = Math.round(Y(0) - total / 2);

    // question (solid)
    tokenRow(y, QUESTION, INK(1));
    y += Math.round(th + pitch * 0.9);

    // scratchpad frame (dashed: you usually don't see it)
    const fx = left - gap * 2;
    const fw = right - left + gap * 4;
    g.setLineDash([2, 2]);
    strokeRound(g, fx + 0.5, y + 0.5, fw, scratchH, Math.round(th / 2), 1, INK(0.75));
    g.setLineDash([]);

    // scratch tokens: dim, typed row by row
    const sy = y + gap * 2;
    let headX = left;
    let headY = sy;
    const full = Math.floor(rowsF);
    for (let i = 0; i < Math.ceil(rowsF); i++) {
      const tokens = ROWS[i];
      const limit = i < full ? Infinity : (rowsF - full) * tokens.length;
      const ry = sy + i * pitch;
      const end = tokenRow(ry, tokens, ACC(0.42), limit);
      headX = end;
      headY = ry;
    }
    // typing head: a soft-pulsing cursor at the end of the working
    if (done < 1 && headX + th <= right + gap * 4)
      fillRound(g, headX, headY, Math.max(1, Math.round(th * 0.6)), th, 1, ACC(0.9 * blink(t) * (1 - done)));

    y += scratchH + Math.round(pitch * 0.9);

    // the answer comes after the working: a faint slot until it is done
    tokenRow(y, ANSWER, INK(0.3 + 0.7 * done));

    // effort meter: six cells, filled from the bottom
    const mw = Math.max(5, Math.round(L(0.2)));
    const mh = Math.max(4, Math.round(L(0.15)));
    const mx = Math.round(X(0.66));
    const mTop = Math.round(Y(0) - (MAX_ROWS * (mh + gap)) / 2);
    for (let i = 0; i < MAX_ROWS; i++) {
      const cy = mTop + (MAX_ROWS - 1 - i) * (mh + gap);
      const fill = Math.max(0, Math.min(1, rowsF - i));
      strokeRound(g, mx + 0.5, cy + 0.5, mw, mh, 1, 1, INK(0.8));
      if (fill > 0) fillRound(g, mx + 2, cy + 2, Math.max(1, Math.round((mw - 3) * fill)), mh - 3, 0, INK(0.9));
    }
    // dial knob marker beside the meter
    const level = mTop + MAX_ROWS * (mh + gap) - Math.round(rowsF * (mh + gap));
    fillRound(g, mx - Math.round(L(0.07)), level - 1, Math.max(2, Math.round(L(0.045))), 3, 1, ACC(0.95));

    r.commit();
  },
};

export default scene;
