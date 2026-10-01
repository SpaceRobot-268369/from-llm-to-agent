/**
 * memory — a notepad, read back to the model. A spiral notepad fills with
 * lines; three of them are remembered facts, in accent. Scrolling lifts each
 * fact out and drops a copy into the prompt strip below, ahead of your
 * message. The note stays saved; the model just gets it pasted in.
 */
import { clamp, easeInOut, easeOut, lerp, range } from '../noise';
import type { Box, Scene } from './types';
import { ACC, INK, blink } from './helpers';
import { arrowDown, cells, cursor, docKit, erase, fillHeight, outline, ragged, stripFrame, words } from './system';

/** list items in the notepad */
const ITEMS = 6;
/** which items are remembered facts */
const FACTS = [1, 3, 5];

/**
 * Vertical rhythm for a kit and a looseness step e (−1 = packed and −2 =
 * tightest, for short boxes): offsets inside the notepad, its height, the
 * drop to the strip and the total.
 */
function rhythm(row: number, T: number, e: number) {
  const coil = row * 3;
  const cp = row + Math.max(1, 2 + e); // item pitch
  const headY = T + row + 1; // "# memory.md", from the notepad top
  const itemsY = headY + row + cp;
  const nh = itemsY + (ITEMS - 1) * cp + row + (e >= -1 ? row : 0) + T;
  const drop = e >= -1 ? row * 3 + 2 + Math.max(0, e) * 2 : row * 2 + 1;
  const th = row + 1;
  const sh = T * 2 + row * 2 + th;
  return { coil, cp, headY, itemsY, nh, drop, th, sh, total: coil / 2 + nh + drop + sh };
}

function layout(box: Box) {
  const fill = fillHeight(box);
  let kit = docKit(box);
  if (kit.row > 1 && rhythm(kit.row, kit.T, -1).total > fill) kit = docKit(box, true);
  let lay = rhythm(kit.row, kit.T, -2);
  for (let e = -1; e < Math.max(2, kit.row) && rhythm(kit.row, kit.T, e).total <= fill; e++) lay = rhythm(kit.row, kit.T, e);
  return { ...kit, ...lay };
}

const scene: Scene = {
  paint({ r, box, p, t, mobile }) {
    const g = r.begin();
    const { X, Y, L, T, row, unit, coil, cp, headY, itemsY, nh, drop, th, sh, total } = layout(box);

    // --- placement: notepad on top, prompt strip below
    const nw = Math.round(L(mobile ? 0.8 : 0.62) * 2);
    const sw = Math.round(Math.min(box.w * 0.86, L(1.1) * 2, nw + 2 * (row * 3 + T))); // a little wider than the pad
    const ny = Math.round(Y(0) - total / 2 + coil / 2);
    const nx = Math.round(X(0) - nw / 2);
    const sy = ny + nh + drop;
    const sx = Math.round(X(0) - sw / 2);

    // --- the strip's contents: [facts…] [<user> message] [cursor]
    const tx = sx + T + row + 1;
    const tw = sw - 2 * (T + row + 1);
    const ty = sy + T + row;
    const gapF = row + 1;
    const msgW = Math.round(tw * 0.24);
    const fw = Math.floor((tw - msgW - (row + 2) - 3 * gapF) / 3);

    // --- story: write the notes, then lift each fact into the strip
    const written = 2.5 + (ITEMS - 2.5) * range(0.04, 0.26, p);
    const flight = FACTS.map((_, n) => range(0.28 + n * 0.11, 0.5 + n * 0.11, p));

    // notepad: outline, spiral coils, faint ruled lines
    const ix = nx + T + row + 1;
    const iw = nw - 2 * (T + row + 1);
    outline(g, nx, ny, nw, nh, T, INK(0.95));
    const coils = Math.floor((nw - row * 4) / (row * 3 + 2)) + 1;
    const step = (nw - row * 4) / Math.max(1, coils - 1);
    for (let c = 0; c < coils; c++) {
      cells(g, nx + row * 2 + c * step - row / 2, ny - coil / 2, row, coil, INK(1));
    }
    if (cp - row > 1) {
      for (let k = 0; k < ITEMS; k++) cells(g, nx + T, ny + itemsY + k * cp + row, nw - 2 * T, 1, INK(0.16));
    }

    // header: "# memory.md"
    cells(g, ix, ny + headY, row, row, INK(0.95));
    words(g, ix + row + 1, ny + headY, iw * 0.5, row, unit, 3, 1, 1, INK(0.85));

    // items: bullet + words; facts in accent
    const bodyX = ix + row * 2;
    const bodyW = iw - row * 2;
    let pen = -1;
    let penY = 0;
    for (let k = 0; k < ITEMS; k++) {
      const lp = clamp(written - k);
      if (lp <= 0) break;
      const y = ny + itemsY + k * cp;
      const n = FACTS.indexOf(k);
      const fact = n >= 0;
      const lifted = fact && flight[n] > 0;
      const style = fact ? ACC(lifted ? 0.45 : 1) : INK(0.55);
      cells(g, ix, y, row, row, fact ? style : INK(0.9));
      const end = words(g, bodyX, y, bodyW, row, unit, 20 + k, ragged(k, 6, 0.55), lp, style);
      if (lp < 1) {
        pen = end;
        penY = y;
      }
    }
    if (pen >= 0) cells(g, pen + 1, penY, Math.max(2, row), row, INK(blink(t)));

    // the way in: notes flow down into the prompt
    const slotsW = 3 * fw + 2 * gapF;
    arrowDown(g, tx + slotsW / 2, ny + nh + row, sy - row, row + 1, INK(0.6), t * 4);

    // prompt strip: landed facts push the message right
    stripFrame(g, sx, sy, sw, sh, T, INK(0.95));
    let shift = 0;
    for (let n = 0; n < FACTS.length; n++) shift += (fw + gapF) * easeInOut(range(0.3, 0.85, flight[n]));
    const mx = Math.round(tx + shift);
    cells(g, mx, ty, unit + 1, th, INK(0.9));
    const msgEnd = words(g, mx + unit + 2, ty, msgW - unit - 2, th, unit, 9, 1, 1, INK(0.55));
    cursor(g, msgEnd + 1, ty, th, t);

    // the facts: pulled out of the notepad, then dropped into their slot.
    // Landed ones are plain text in the strip; ones in flight float above the
    // paper with a clean margin (a second pass, after erasing beneath them).
    const flying: [number, number, number, number, number][] = [];
    for (let n = 0; n < FACTS.length; n++) {
      const f = flight[n];
      if (f <= 0) continue;
      const k = FACTS[n];
      const srcY = ny + itemsY + k * cp;
      const srcW = bodyW * ragged(k, 6, 0.55);
      const pull = easeOut(range(0, 0.25, f)) * (1 - easeInOut(range(0.25, 1, f)));
      const go = easeInOut(range(0.25, 1, f));
      const x = Math.round(lerp(bodyX, tx + n * (fw + gapF), go) + pull * row * 3);
      const y = Math.round(lerp(srcY, ty, go) - pull * Math.ceil(row / 2));
      const w = Math.round(lerp(srcW, fw, go));
      const h = Math.round(lerp(row, th, go));
      if (f < 1) flying.push([x, y, w, h, k]);
      else words(g, x, y, w, h, unit, 20 + k, 1, 1, ACC(1));
    }
    r.commit();
    if (flying.length) {
      for (const [x, y, w, h] of flying) erase(r, x - 1, y - 1, w + 2, h + 2);
      const g2 = r.begin();
      for (const [x, y, w, h, k] of flying) words(g2, x, y, w, h, unit, 20 + k, 1, 1, ACC(1));
      r.commit();
    }
  },
};

export default scene;
