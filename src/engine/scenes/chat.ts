/**
 * chat — the model forgets you; the app fakes memory by re-sending everything.
 *
 * READ act (p = 0, the reader is reading): a time-driven loop shows the
 * problem. A short conversation builds up in "SESSION 1"; then a NEW SESSION
 * starts, the old bubbles vanish, "what did I ask?" is sent — and the model
 * can only answer "?". Then it repeats. (Reduced motion: that "?" moment.)
 *
 * WATCH act (p > 0): the fix. Four chat bubbles alternate left and right (the
 * last one still typing). Scrolling slides them into one left-aligned column,
 * the bubbles dissolve, an accent role tag marks the start of every turn, and
 * one frame closes around it all: <user> … <assistant> … <user> … <assistant> ▌
 * — the whole history, re-sent as one long text.
 */
import { easeInOut, easeOut, lerp, range } from '../noise';
import type { Scene } from './types';
import { ACC, INK, blink, fillRound, pixelText, pixelTextWidth, space, strokeRound } from './helpers';
import { caret, edge, kit, token, tokenW } from './tokens';

/** tokens per turn: user, assistant, user, assistant (still typing) */
const TURNS = [3, 7, 5, 0];
/** shorter turns on the small, wide mobile box */
const TURNS_MOBILE = [3, 4, 3, 0];
const SEED = 19;
/** when each turn starts merging into the strip */
const M0 = 0.08;
const M_STAGGER = 0.035;
const M_LEN = 0.36;

// ── read-act loop: SESSION 1 → NEW SESSION → "?" ────────────────────────

/** seconds per loop */
const LOOP = 9;
/** tokens per bubble in session 1: user, assistant, user, assistant */
const DEMO = [3, 5, 4, 4];
const DEMO_MOBILE = [2, 3, 3, 3];
/** when each session-1 bubble is typed (s), when the session ends, when session 2 runs */
const TYPE_STEP = 1.05;
const END_A = 4.7;
const END_B = 5.5;
const ASK = [5.6, 6.3];
const REPLY = 6.7;

function bubble(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  user: boolean,
  th: number,
  lw: number,
  a: number,
) {
  const rad = th * 0.9;
  if (user) fillRound(g, x, y, w, h, rad, INK(0.18 * a));
  const e = edge(lw);
  strokeRound(g, x + e, y + e, w - e * 2, h - e * 2, rad, lw, INK(0.9 * a));
  const sz = Math.max(2, Math.round(th * 0.9));
  const dir = user ? 1 : -1;
  const tx = user ? x + w - Math.round(th * 1.2) : x + Math.round(th * 1.2);
  const ty = y + h - 1;
  g.beginPath();
  g.moveTo(tx - sz * 0.6 * dir, ty);
  g.lineTo(tx + sz * 0.6 * dir, ty);
  g.lineTo(tx + sz * dir, ty + sz + 0.5);
  g.closePath();
  g.fillStyle = INK(0.9 * a);
  g.fill();
}

/** Tokens typed into a bubble: `typed` 0..1 of `n` tokens; returns the end x. */
function typeTokens(g: CanvasRenderingContext2D, x: number, y: number, widths: number[], typed: number, th: number, gap: number) {
  const shown = typed * widths.length;
  let cx = x;
  for (let i = 0; i < widths.length; i++) {
    if (i >= shown) break;
    const part = Math.min(1, shown - i);
    token(g, cx, y, Math.max(1, Math.round(widths[i] * part)), th, INK(0.88));
    cx += widths[i] + gap;
  }
  return cx;
}

function forgetfulLoop(g: CanvasRenderingContext2D, box: Parameters<Scene['paint']>[0]['box'], t: number, mobile: boolean) {
  const { th, gap, lw, cw } = kit(box);
  const { L } = space(box);
  const local = t === 0 ? 7.6 : t % LOOP;
  const turns = mobile ? DEMO_MOBILE : DEMO;
  const padX = Math.max(2, Math.round(th * 0.7));
  const padY = Math.max(2, Math.round(th * 0.45));
  const bh = th + padY * 2;
  const bgap = Math.round(th * 0.95);
  const tail = Math.max(2, Math.round(th * 0.9));
  const maxW = Math.round(Math.min(box.w * 0.86, L(1.9)));
  const x0 = Math.round(box.cx - maxW / 2);
  const scale = box.s >= 56 && pixelTextWidth('NEW SESSION', 2) <= maxW ? 2 : 1;
  const labelH = 5 * scale;
  const labelGap = Math.round(th * 1.1);
  const stackH = turns.length * bh + (turns.length - 1) * bgap + tail;
  const top = Math.round(box.cy - (labelH + labelGap + stackH) / 2);
  const rowsY = top + labelH + labelGap;
  const widthsOf = (j: number, n: number) => Array.from({ length: n }, (_, i) => tokenW(j * 10 + i, 41, th));
  const bubbleW = (ws: number[]) => ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1) + padX * 2;

  // the session label: SESSION 1 … then NEW SESSION (accent: the moment memory is lost)
  const fresh = local >= END_A;
  pixelText(g, fresh ? 'NEW SESSION' : 'SESSION 1', x0, top, fresh ? ACC(1) : INK(0.85), { scale });
  if (fresh) {
    // a rule under the label marks the clean slate
    const lwid = pixelTextWidth('NEW SESSION', scale);
    fillRound(g, x0, top + labelH + 2, lwid, 1, 0, ACC(0.9));
  }

  // session 1: four bubbles typed in turn, then dissolving away row by row
  const gone = range(END_A, END_B, local);
  if (gone < 1) {
    let y = rowsY;
    for (let j = 0; j < turns.length; j++) {
      const typed = range(j * TYPE_STEP + 0.1, j * TYPE_STEP + 0.9, local);
      if (typed <= 0) break;
      const a = 1 - range(j * 0.12, j * 0.12 + 0.55, gone);
      if (a > 0.01) {
        const user = j % 2 === 0;
        const ws = widthsOf(j, turns[j]);
        const bw = bubbleW(ws);
        const bx = user ? x0 + maxW - bw : x0;
        bubble(g, bx, y, bw, bh, user, th, lw, a);
        const outer = g.globalAlpha;
        g.globalAlpha = outer * a;
        const end = typeTokens(g, bx + padX, y + padY, ws, typed, th, gap);
        if (typed < 1) caret(g, end, y + padY, th, cw, 1);
        g.globalAlpha = outer;
      }
      y += bh + bgap;
    }
  }

  // session 2: "what did I ask?" — and the model has nothing to go on
  if (local >= ASK[0]) {
    const ws = widthsOf(7, mobile ? 2 : 3);
    const qW = pixelTextWidth('?', scale);
    const typed = range(ASK[0], ASK[1], local);
    const bw = bubbleW(ws) + gap + qW;
    const bx = x0 + maxW - bw;
    bubble(g, bx, rowsY, bw, bh, true, th, lw, 1);
    const end = typeTokens(g, bx + padX, rowsY + padY, ws, Math.min(1, typed * 1.25), th, gap);
    if (typed >= 0.85) pixelText(g, '?', end, rowsY + Math.round((bh - 5 * scale) / 2), INK(0.95), { scale });
    const ry = rowsY + bh + bgap;
    if (local >= REPLY) {
      // the reply: just a question mark, in accent
      const rW = pixelTextWidth('?', scale * 2) + padX * 2;
      const rH = Math.max(bh, 10 * scale + padY * 2);
      bubble(g, x0, ry, rW, rH, false, th, lw, 1);
      pixelText(g, '?', x0 + padX, ry + Math.round((rH - 10 * scale) / 2), ACC(1), { scale: scale * 2 });
    } else if (typed >= 1) {
      // waiting for the reply
      caret(g, x0 + padX, ry + padY, th, cw, blink(t));
    }
  }
}

/** A role tag: a block with pointed ends, like <user>. */
function tag(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, style: string) {
  const e = Math.min(h * 0.42, w / 2);
  g.beginPath();
  g.moveTo(x, y + h / 2);
  g.lineTo(x + e, y);
  g.lineTo(x + w - e, y);
  g.lineTo(x + w, y + h / 2);
  g.lineTo(x + w - e, y + h);
  g.lineTo(x + e, y + h);
  g.closePath();
  g.fillStyle = style;
  g.fill();
}

const scene: Scene = {
  paint({ r, box, p, t, mobile }) {
    const g = r.begin();
    // read act: the forgetful loop; it hands over to the watch story as p leaves 0
    const story = range(0, 0.04, p);
    if (story < 1) {
      g.globalAlpha = 1 - story;
      forgetfulLoop(g, box, t, mobile);
      g.globalAlpha = 1;
    }
    if (story <= 0) {
      r.commit();
      return;
    }
    g.globalAlpha = story;
    const { th, gap, pitch, lw, cw } = kit(box);
    const { L } = space(box);
    const maxW = Math.round(Math.min(box.w * 0.88, L(1.96)));
    const x0 = Math.round(box.cx - maxW / 2);
    const padX = Math.max(2, Math.round(th * 0.7));
    const padY = Math.max(2, Math.round(th * 0.45));
    const framePad = Math.max(3, Math.round(th * 0.75));
    const bubbleGap = Math.round(th * (mobile ? 0.7 : 0.9));
    const turns = mobile ? TURNS_MOBILE : TURNS;
    const tagCol = Math.round(th * 2.3);
    const tagW = (j: number) => (j % 2 ? tagCol : Math.round(th * 1.6));
    const lead = framePad + tagCol + gap * 2;
    const innerMax = Math.min(Math.round(maxW * (mobile ? 0.74 : 0.66)) - padX * 2, maxW - lead - framePad);

    // token layout inside each bubble (kept rigid through the merge)
    const xs: number[][] = [];
    const rs: number[][] = [];
    const ws: number[][] = [];
    const rows: number[] = [];
    const widths: number[] = [];
    let id = 0;
    for (let j = 0; j < turns.length; j++) {
      const x: number[] = [];
      const rw: number[] = [];
      const w: number[] = [];
      let cx = 0;
      let row = 0;
      let widest = turns[j] === 0 ? cw : 0;
      for (let i = 0; i < turns[j]; i++) {
        const tw = tokenW(id++, SEED, th);
        if (cx > 0 && cx + tw > innerMax) {
          cx = 0;
          row++;
        }
        x.push(cx);
        rw.push(row);
        w.push(tw);
        cx += tw + gap;
        widest = Math.max(widest, cx - gap);
      }
      xs.push(x);
      rs.push(rw);
      ws.push(w);
      rows.push(row + 1);
      widths.push(widest);
    }

    // B (the merged strip) is as wide as its longest line, centred
    const stripW = lead + Math.max(...widths) + framePad;
    const sx = Math.round(box.cx - stripW / 2);
    const textX = sx + lead;

    // A: alternating chat bubbles, centred as a stack
    const bh = rows.map((n) => (n - 1) * pitch + th + padY * 2);
    const stackH = bh.reduce((a, b) => a + b, 0) + bubbleGap * (turns.length - 1);
    // (the last bubble's tail hangs below the stack, so it counts too)
    const tailSz = Math.max(2, Math.round(th * 0.9));
    let ya = Math.round(box.cy - (stackH + tailSz) / 2);
    // B: one framed strip, a role tag at the start of every turn, centred
    const totalRows = rows.reduce((a, b) => a + b, 0);
    const stripH = (totalRows - 1) * pitch + th + framePad * 2;
    const stripY = Math.round(box.cy - stripH / 2);
    let rowB = 0;

    // the strip frame closes in around the merged text
    const fk = easeOut(range(0.3, 0.56, p));
    if (fk > 0) {
      // whole-cell steps keep the outline crisp while it closes in
      const o = Math.round((1 - fk) * th * 1.5) - edge(lw);
      strokeRound(g, sx - o, stripY - o, stripW + o * 2, stripH + o * 2, th * 0.6, lw, INK(0.95 * fk));
    }

    const on = blink(t);
    for (let j = 0; j < turns.length; j++) {
      const user = j % 2 === 0;
      const bw = widths[j] + padX * 2;
      const ch = bh[j] - padY * 2;
      // token origin: inside the bubble (A) → after the tag column (B)
      const ax = (user ? x0 + maxW - bw : x0) + padX;
      const ay = ya + padY;
      ya += bh[j] + bubbleGap;
      const yB = stripY + framePad + rowB * pitch;
      rowB += rows[j];

      const s0 = M0 + j * M_STAGGER;
      const m = easeInOut(range(s0, s0 + M_LEN, p));
      // whole-cell steps: the tokens stay crisp blocks at any scroll position
      const ox = Math.round(lerp(ax, textX, m));
      const oy = Math.round(lerp(ay, yB, m));

      // the bubble shrink-wraps its tokens as it docks, then dissolves
      const outA = 0.9 * (1 - range(0.55, 1, m));
      if (outA > 0.01) {
        const px = Math.round(lerp(padX, 2, m));
        const py = Math.round(lerp(padY, 1, m));
        const bx = ox - px;
        const by = oy - py;
        const w = widths[j] + px * 2;
        const h = ch + py * 2;
        const rad = lerp(th * 0.9, th * 0.5, m);
        if (user) fillRound(g, bx, by, w, h, rad, INK(0.2 * (1 - range(0.2, 0.7, m))));
        const e = edge(lw);
        strokeRound(g, bx + e, by + e, w - e * 2, h - e * 2, rad, lw, INK(outA));
        const ta = 0.95 * (1 - range(0, 0.3, m));
        if (ta > 0.01) {
          // the tail: a solid wedge under the bubble's outer corner
          const sz = tailSz;
          const dir = user ? 1 : -1;
          const tx = user ? bx + w - Math.round(th * 1.2) : bx + Math.round(th * 1.2);
          const ty = by + h - 1;
          g.beginPath();
          g.moveTo(tx - sz * 0.6 * dir, ty);
          g.lineTo(tx + sz * 0.6 * dir, ty);
          g.lineTo(tx + sz * 1.0 * dir, ty + sz + 0.5);
          g.closePath();
          g.fillStyle = INK(ta);
          g.fill();
        }
      }

      // the role tag slides out at the start of the turn
      const tk = easeOut(range(s0 + M_LEN * 0.8, s0 + M_LEN + 0.12, p));
      if (tk > 0) tag(g, sx + framePad, yB, Math.round(Math.max(th, tagW(j) * tk)), th, ACC(1));

      // tokens ride along inside their bubble
      for (let i = 0; i < turns[j]; i++) token(g, ox + xs[j][i], oy + rs[j][i] * pitch, ws[j][i], th, INK(0.88));
      if (turns[j] === 0) caret(g, ox, oy, th, cw, on);
    }

    g.globalAlpha = 1;
    r.commit();
  },
};

export default scene;
