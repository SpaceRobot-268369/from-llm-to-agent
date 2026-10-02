/**
 * agent — an agent is a while-loop, and it knows when to stop.
 *
 * A thick pixel ring (the loop) with three nodes: think (an ellipsis), act (a
 * gear) and observe (an eye). A bright runner with a fading tail goes around
 * it and lights each node it passes. Inside the ring, the message list grows:
 * the system prompt and the goal, then one row per lap (its tag is typed at
 * ACT — the tool call — and its text at OBSERVE — the result). Above the ring,
 * left: a STEPS gauge, one slot per lap, with a solid cap after the last slot
 * (the max-steps limit). Right: a closed gate on a short exit track from the
 * think node, and an empty answer box behind it.
 *
 * p (scene progress) tells the story, in step with the watch captions:
 *   0           the read act: the runner laps on time alone (t); the loop
 *               is idle, nothing counted yet.
 *   0    – 0.02 the runner hurries on to THINK.
 *   0.02 – 0.80 four laps (starting at 0.02 / 0.2 / 0.42 / 0.62, in step
 *               with the captions), slowing at each node. Each lap appends
 *               a row (tool call at ACT, result at OBSERVE) and fills a
 *               STEPS slot as it closes — 4 of 6, under the cap.
 *   0.80 – 0.84 the runner waits at THINK while the last caption arrives.
 *   0.84 – 0.88 the gate lifts (no tool call this time: the model answers).
 *   0.88 – 0.95 the runner leaves the ring along the exit track into the
 *               answer box, which fills with DONE (accent). The ring is
 *               still from here on.
 * t only animates the read-act lap at p = 0; with t = 0 the runner waits at
 * THINK. Every stage reads without motion.
 *
 * Layout: the ring sits low enough for a header row above it (gauge · think
 * node · gate + answer box); the scale is the largest that fits the box
 * (cached per box size), and wide boxes (the centred watch box) give the
 * gauge and the answer box room for their pixel-font labels. On small phones
 * the message list keeps only the rows that fit inside the ring, scrolling
 * the oldest off the top like a chat.
 */
import { clamp, easeInOut, easeOut, range } from '../noise';
import type { Box, Scene } from './types';
import { ACC, INK, fillCircle, fillRound, pixelText, pixelTextWidth, strokeArc } from './helpers';

// ── shared "hands & loops" vocabulary (same numbers in tools / agent / subagents)
/** Height of a token / text pill, in design units (min 2 cells). */
const PILL = 0.085;
/** Thickness of a loop ring, in design units. */
const RING = 0.15;

const TAU = Math.PI * 2;

// ── beats ────────────────────────────────────────────────────────────────
/** Where each lap starts and the last one ends (p): in step with the captions at 0.2 / 0.42 / 0.62. */
const LAP_AT = [0.02, 0.2, 0.42, 0.62, 0.8];
const LAP_COUNT = LAP_AT.length - 1;
/** The limit the STEPS gauge shows (the loop stays under it). */
const MAX_STEPS = 6;
/**
 * The gate lifts over this span; the runner then exits along the track. It
 * starts once the last caption (at 0.82, fading in over 0.035) is readable, so
 * the stop is seen with the words that explain it.
 */
const GATE: [number, number] = [0.84, 0.88];
const EXIT: [number, number] = [0.88, 0.95];

const STEPS = 'STEPS';
const MAX = 'MAX';
const DONE = 'DONE';

/**
 * A loop track: a thick halftone band with solid rims (rims only when the
 * band is wide enough to hold them), drawn as arcs that skip `gaps` (angles,
 * each ±gapHalf) so nodes can sit on it.
 */
function track(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  T: number,
  gaps: number[],
  gapHalf: number,
) {
  const rim = T >= 4.5 ? 1.25 : 0;
  const sorted = [...gaps].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    const a0 = sorted[i] + gapHalf;
    const a1 = (i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + TAU) - gapHalf;
    g.lineCap = 'butt';
    strokeArc(g, cx, cy, R, T, INK(rim ? 0.45 : 0.6), a0, a1);
    if (rim) {
      strokeArc(g, cx, cy, R + T / 2 - rim / 2, rim, INK(1), a0, a1);
      strokeArc(g, cx, cy, R - T / 2 + rim / 2, rim, INK(1), a0, a1);
    }
    g.lineCap = 'round';
  }
}

/**
 * The runner: a bright head with a tail that fades behind it (clockwise),
 * `tail` radians long. Without rims it is drawn a little wider than the band
 * so it covers it fully.
 */
function runner(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, T: number, a: number, tail: number) {
  const n = 14;
  const seg = tail / n;
  const w = T >= 4.5 ? T * 0.95 : T + 0.8;
  g.lineCap = 'butt';
  if (tail > 0) {
    for (let i = 0; i < n; i++) {
      const f = i / n;
      strokeArc(g, cx, cy, R, w * (1 - 0.35 * f), ACC(1 - 0.48 * f), a - seg * (i + 1), a - seg * i + 0.004);
    }
  }
  g.lineCap = 'round';
  fillCircle(g, cx + Math.cos(a) * R, cy + Math.sin(a) * R, T * 0.62, ACC(1));
}

/**
 * A loop node: a solid disc with its step cut out of it (even-odd), so it
 * reads at a dozen cells. think = an ellipsis, act = a gear, observe = an eye.
 * With `plain`, just the disc (too small for a cut-out).
 */
function node(g: CanvasRenderingContext2D, kind: number, x: number, y: number, rn: number, plain: boolean, style: string) {
  g.beginPath();
  if (plain) {
    g.arc(x, y, rn, 0, TAU);
  } else if (kind === 0) {
    g.arc(x, y, rn, 0, TAU);
    const d = Math.max(2, Math.round(rn * 0.32));
    const sx = Math.round(rn * 0.52);
    for (let i = -1; i <= 1; i++) {
      const qx = Math.round(x + i * sx - d / 2);
      const qy = Math.round(y - d / 2);
      g.moveTo(qx, qy);
      g.lineTo(qx, qy + d);
      g.lineTo(qx + d, qy + d);
      g.lineTo(qx + d, qy);
      g.closePath();
    }
  } else if (kind === 1) {
    const ro = rn * 1.06;
    const ri = rn * 0.76;
    const teeth = 7;
    for (let i = 0; i < teeth * 2; i++) {
      const a0 = (i / (teeth * 2)) * TAU - Math.PI / 2;
      g.arc(x, y, i % 2 ? ri : ro, a0, a0 + TAU / (teeth * 2));
    }
    g.closePath();
    g.moveTo(x + rn * 0.36, y);
    g.arc(x, y, rn * 0.36, 0, TAU, true);
  } else {
    g.arc(x, y, rn, 0, TAU);
    const w = rn * 0.78;
    const h = rn * 0.5;
    g.moveTo(x - w, y);
    g.quadraticCurveTo(x, y - h * 2, x + w, y);
    g.quadraticCurveTo(x, y + h * 2, x - w, y);
    g.closePath();
    g.moveTo(x + rn * 0.24, y);
    g.arc(x, y, rn * 0.24, 0, TAU);
  }
  g.fillStyle = style;
  g.fill('evenodd');
}

/** Erase to background (both channels). */
function cut(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  if (w <= 0 || h <= 0) return;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#000';
  g.fillRect(x, y, w, h);
  g.globalCompositeOperation = 'lighter';
}

/** Message rows inside the loop: [tag width, text width] in units. */
const ROWS: [number, number][] = [
  [0.1, 0.42], // system prompt
  [0.1, 0.3], // user goal
  [0.16, 0.24], // lap 1: tool call · result
  [0.16, 0.34], // lap 2
  [0.16, 0.2], // lap 3
  [0.16, 0.3], // lap 4
];

/** Node angles (clockwise from the top): think → act → observe. */
const NODES = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];

/** Lap position (laps done + fraction), slowing at each node (0, ⅓, ⅔ of a lap). */
function lapPos(p: number): number {
  if (p >= LAP_AT[LAP_COUNT]) return LAP_COUNT;
  let i = 0;
  while (i < LAP_COUNT - 1 && p >= LAP_AT[i + 1]) i++;
  const f = range(LAP_AT[i], LAP_AT[i + 1], p);
  return i + f - (Math.sin(f * TAU * 3) / (TAU * 3)) * 0.85;
}

type Layout = {
  k: number;
  R: number;
  T: number;
  rn: number;
  /** ring centre offset below the box centre (cells) */
  dy: number;
  /** header box height, and how far each side region reaches from the centre */
  hh: number;
  reach: number;
};

const layoutCache = new Map<string, Layout>();

/**
 * The largest scale whose whole composition fits the box: the header (gauge ·
 * think node · answer box) above the ring, the ring's band at the bottom, and
 * both side regions at least 0.62 units (and 12 cells) wide.
 */
function layout(box: Box): Layout {
  const key = `${box.w.toFixed(1)}|${box.h.toFixed(1)}`;
  const hit = layoutCache.get(key);
  if (hit) return hit;
  const availW = box.w * 0.92;
  const availH = box.h * 0.9;
  const at = (k: number) => {
    const R = 0.7 * k;
    const T = Math.max(2.6, RING * k);
    const rn = Math.max(5, 0.2 * k);
    const hh = Math.max(7, Math.round(0.36 * k));
    const exitY = R + 0.45 * rn; // exit track above the ring centre
    const top = Math.max(exitY + hh / 2, R + rn);
    const bottom = R + T / 2;
    // the side regions (gauge · gate + answer box): 12 cells at least, room
    // for the gauge's six 1-cell slots and its cap
    const inner = Math.max(0.5 * k, rn + 4);
    const side = Math.max(0.62 * k, 12);
    return { R, T, rn, hh, top, bottom, inner, side };
  };
  let best: Layout | null = null;
  for (let k = 60; k >= 8 && !best; k -= 0.25) {
    const { R, T, rn, hh, top, bottom, inner, side } = at(k);
    if (top + bottom > availH || 2 * (inner + side) > availW) continue;
    const reach = Math.min(availW / 2, inner + Math.max(side, Math.min(1.4 * k, 50)));
    best = { k, R, T, rn, dy: (top - bottom) / 2, hh, reach };
  }
  // a box narrower than the side regions' floors (the smallest phones): the
  // largest ring that fits, the header squeezed into what is left beside it
  for (let k = 60; k >= 8 && !best; k -= 0.25) {
    const { R, T, rn, hh, top, bottom } = at(k);
    if (top + bottom > availH || 2 * (R + T) > availW) continue;
    best = { k, R, T, rn, dy: (top - bottom) / 2, hh, reach: availW / 2 };
  }
  best ??= { k: 8, R: 5.6, T: 2.6, rn: 5, dy: 3, hh: 7, reach: box.w / 2 };
  if (layoutCache.size > 32) layoutCache.clear();
  layoutCache.set(key, best);
  return best;
}

const scene: Scene = {
  paint({ r, box, p, t }) {
    const g = r.begin();
    const { k, R, T, rn, dy, hh, reach } = layout(box);
    const L = (l: number) => l * k;
    const cx = box.cx;
    const cy = box.cy + dy;
    const pill = Math.max(2, Math.round(L(PILL)));
    const rowGap = Math.max(1, Math.round(L(0.06)));
    const plain = rn < 5;

    // ── story values
    const lp = p <= 0 ? 0 : lapPos(p);
    const laps = Math.min(LAP_COUNT, Math.floor(lp + 1e-6));
    const gate = easeInOut(range(GATE[0], GATE[1], p));
    const exit = range(EXIT[0], EXIT[1], p);

    // runner angle: on time alone in the read act, then handed over to the
    // laps (it hurries forward to THINK over the first 2% of p)
    const think = NODES[0];
    const aTime = think + ((((t / 3.2) % 1) + 1) % 1) * TAU;
    const hand = easeInOut(range(0, LAP_AT[0], p));
    const aLap = think + lp * TAU;
    const a = p < LAP_AT[0] ? aTime + (think + TAU - aTime) * hand : aLap;

    // ── the ring
    const half = (rn + 0.8) / R;
    track(g, cx, cy, R, T, NODES, half);

    // ── runner + fading tail, clipped out of the nodes (it ducks into each one)
    if (exit <= 0) {
      g.save();
      g.beginPath();
      g.rect(0, 0, r.w, r.h);
      for (const na of NODES) {
        const nx = cx + Math.cos(na) * R;
        const ny = cy + Math.sin(na) * R;
        g.moveTo(nx + rn + 0.5, ny);
        g.arc(nx, ny, rn + 0.5, 0, TAU);
      }
      g.clip('evenodd');
      // while it waits at THINK for the gate, the tail shrinks: it has stopped
      const tail = 1.25 * (1 - range(LAP_AT[LAP_COUNT], GATE[1], p));
      runner(g, cx, cy, R, T, a, tail);
      g.restore();
    }

    // ── nodes: think → act → observe; the one the runner is in lights up
    for (let i = 0; i < NODES.length; i++) {
      const na = NODES[i];
      let d = (((a - na) % TAU) + TAU) % TAU;
      if (d > Math.PI) d -= TAU;
      const lit = exit <= 0 && d > -half && d < half + 0.45;
      node(g, i, cx + Math.cos(na) * R, cy + Math.sin(na) * R, rn, plain, lit ? ACC(1) : INK(1));
    }

    // ── the message list: system + goal, then one row per lap
    const step = pill + rowGap;
    const stackH = ROWS.length * step - rowGap;
    // centred, but always clear of the think node at the top of the ring
    const y0 = Math.round(Math.max(cy - stackH / 2 - L(0.01), cy - R + rn + Math.max(1.5, L(0.06))));
    const x0 = Math.round(cx - L(0.29));
    const tagGap = Math.max(1, Math.round(L(0.04)));
    // rows that fit above the ring's bottom (a cell clear of its inner rim, at
    // the list's edge). A small phone box can't hold them all: the list then
    // scrolls like a chat, the oldest rows leaving the top as new ones arrive.
    const inR = R - T / 2 - 1;
    const yMax = cy + Math.sqrt(Math.max(0, inR * inR - (cx - x0) ** 2));
    const fit = Math.max(1, Math.floor((yMax - y0 + rowGap) / step + 0.05));
    let typed = 2;
    for (let j = 0; j < LAP_COUNT; j++) typed += clamp((lp - j - 0.3) / 0.1);
    const scroll = Math.max(0, typed - fit);
    for (let i = 0; i < ROWS.length; i++) {
      const [tw, xw] = ROWS[i];
      if (i < scroll) continue;
      const y = Math.round(y0 + (i - scroll) * step);
      const tag = Math.round(L(tw));
      const text = Math.round(L(xw));
      let ft = 1;
      let fx = 1;
      if (i >= 2) {
        // lap j: the tag is typed at ACT, the text at OBSERVE
        const f = lp - (i - 2);
        ft = clamp((f - 0.3) / 0.1);
        fx = clamp((f - 0.63) / 0.12);
      }
      if (ft <= 0) continue;
      const newTag = ft < 1 || (i >= 2 && lp - (i - 2) < 0.45 && p < LAP_AT[LAP_COUNT]);
      const newText = fx > 0 && (fx < 1 || (i >= 2 && lp - (i - 2) < 0.8 && p < LAP_AT[LAP_COUNT]));
      const tl = Math.max(1, Math.round(tag * easeOut(ft)));
      fillRound(g, x0, y, tl, pill, pill / 2, newTag ? ACC(1) : INK(1));
      if (fx > 0) {
        const xl = Math.round(text * easeOut(fx));
        if (xl > 0) fillRound(g, x0 + tag + tagGap, y, xl, pill, pill / 2, newText ? ACC(1) : INK(0.6));
      }
    }

    // ── header: the exit track, gate and answer box (right), the STEPS gauge (left)
    const ey = Math.round(cy - R - 0.45 * rn);
    const inner = Math.round(cx + Math.max(L(0.5), rn + 4));
    const ax1 = Math.round(cx + reach);
    const doneW = pixelTextWidth(DONE);
    const aw = Math.min(ax1 - inner, Math.max(Math.round(L(0.62)), Math.min(doneW + 8, Math.round(L(0.9)))));
    const ax = ax1 - aw;
    const ah = hh;
    const ay = Math.round(ey - ah / 2);
    const nodeR = Math.round(cx + Math.sqrt(Math.max(0, rn * rn - (ey - (cy - R)) ** 2)));
    // track: dotted from the think node to the box
    const dot = pill >= 3 ? 2 : 1;
    const trackY = Math.round(ey - dot / 2);
    g.fillStyle = INK(1);
    for (let x = nodeR + 1; x < ax - 1; x += 2 * dot) g.fillRect(x, trackY, dot, dot);
    // gate: a solid bar across the track that lifts away
    const gx = Math.round((nodeR + ax) / 2) - 1;
    const gh = Math.max(5, Math.round(ah * 0.8));
    const lift = Math.round(gate * (gh + 2));
    if (gate < 1) {
      cut(g, gx - 1, ey - gh / 2 - lift - 1, 4, gh + 2);
      g.fillStyle = INK(1);
      g.fillRect(gx, Math.round(ey - gh / 2) - lift, 2, gh - Math.min(gh, lift));
    }
    // answer box: an empty outline that fills with DONE once the runner is in
    const fillIn = range(EXIT[1] - 0.01, EXIT[1] + 0.01, p);
    if (fillIn > 0) {
      g.fillStyle = ACC(1);
      g.fillRect(ax, ay, aw, ah);
      const tw = pixelTextWidth(DONE);
      if (tw + 4 <= aw && ah >= 7) {
        // DONE, cut out of the accent box
        g.globalCompositeOperation = 'source-over';
        pixelText(g, DONE, ax + aw / 2, Math.round(ay + (ah - 5) / 2), '#000', { align: 'center' });
        g.globalCompositeOperation = 'lighter';
      } else {
        // too small for the word: a tick
        const tx = Math.round(ax + aw / 2 - 2);
        const ty = Math.round(ay + ah / 2 - 1);
        cut(g, tx, ty + 1, 1, 1);
        cut(g, tx + 1, ty + 2, 1, 1);
        cut(g, tx + 2, ty + 1, 1, 1);
        cut(g, tx + 3, ty, 1, 1);
      }
    } else {
      g.fillStyle = INK(1);
      g.fillRect(ax, ay, aw, 1);
      g.fillRect(ax, ay + ah - 1, aw, 1);
      g.fillRect(ax, ay, 1, ah);
      g.fillRect(ax + aw - 1, ay, 1, ah);
    }
    // the runner on its way out: head + a short trail along the track
    if (exit > 0 && exit < 1) {
      const sx = nodeR - 1;
      const ex = ax + Math.round(aw / 2);
      const hx = sx + (ex - sx) * easeInOut(exit);
      const hr = Math.max(1.5, T * 0.62);
      const trail = Math.max(4, L(0.3));
      cut(g, Math.round(Math.max(sx, hx - trail)), Math.round(ey - hr - 1), Math.round(Math.min(trail, hx - sx)) + 1, Math.round(hr * 2 + 2));
      g.fillStyle = ACC(0.6);
      g.fillRect(Math.round(Math.max(sx, hx - trail)), Math.round(ey - 1), Math.round(Math.min(trail, hx - sx)), 2);
      fillCircle(g, hx, ey, hr, ACC(1));
    }

    // STEPS gauge: MAX_STEPS slots and a solid cap (the limit); one slot fills
    // per lap. With room, "STEPS" over the slots and "MAX" over the cap.
    const slotH = Math.max(3, Math.round(L(0.11)));
    const outer = R + T / 2;
    const inner0 = Math.max(L(0.5), rn + 4);
    // labels need 7 more rows above the slots: they fit where the ring has
    // curved far enough away from the header, if that still leaves the room.
    // "STEPS … MAX" if it fits, else just "STEPS", else none.
    const clear = cy - (ay + 7 + slotH + 2);
    const innerL = Math.max(inner0, Math.sqrt(Math.max(0, outer * outer - clear * clear)));
    const roomL = Math.floor(reach - innerL) - 1;
    const barFor = (w: number) => Math.ceil((w - 2) / MAX_STEPS) - 1;
    const both = pixelTextWidth(STEPS) + 4 + pixelTextWidth(MAX);
    const labels = MAX_STEPS * (barFor(both) + 1) + 2 <= roomL ? 2 : MAX_STEPS * (barFor(pixelTextWidth(STEPS)) + 1) + 2 <= roomL ? 1 : 0;
    const gx1 = Math.round(cx - (labels ? innerL : inner0));
    const room = gx1 - Math.round(cx - reach);
    // slot width: wide enough for the labels above, else a fair share of the room
    const sw = labels
      ? barFor(labels === 2 ? both : pixelTextWidth(STEPS))
      : Math.max(1, Math.min(Math.floor((room - 2) / MAX_STEPS) - 1, Math.max(2, Math.round(L(0.06)))));
    const sg = 1;
    const barW = MAX_STEPS * (sw + sg) - sg + 1 + 2;
    const bx0 = gx1 - barW; // right-aligned toward the ring
    const by = labels ? ay + 7 : Math.round(ey - slotH / 2);
    for (let j = 0; j < MAX_STEPS; j++) {
      const x = bx0 + j * (sw + sg);
      const filled = j < laps;
      // a freshly filled slot glows (accent) for a moment
      const fresh = filled && j === laps - 1 && p < LAP_AT[j + 1] + 0.06;
      if (filled || sw > 2) {
        g.fillStyle = filled ? (fresh ? ACC(1) : INK(1)) : INK(0.32);
        g.fillRect(x, by, sw, slotH);
      } else {
        // narrow slots: an empty one is just its solid base (a bar chart's baseline)
        g.fillStyle = INK(1);
        g.fillRect(x, by + slotH - 1, sw, 1);
      }
    }
    // the cap: taller than the slots, solid
    const capX = bx0 + barW - 2;
    g.fillStyle = INK(1);
    g.fillRect(capX, by - 1, 2, slotH + 2);
    if (labels) pixelText(g, STEPS, bx0, by - 7, INK(1));
    if (labels === 2) pixelText(g, MAX, capX + 2, by - 7, INK(1), { align: 'right' });

    r.commit();
  },
};

export default scene;
