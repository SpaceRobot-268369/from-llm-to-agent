/**
 * Dev-only scene inspection hooks (never loaded in production builds).
 *
 *   window.__scene('rag', { p: 0.5 })        → ASCII render of the art box
 *   window.__scene('rag', { p: 0.5, full: true, mobile: true })
 *   window.__scene('rag', { p: 0.5, focus: 1 })  → the centred WATCH box
 *   window.__sceneBench('rag', { p: 0.5 })   → avg ms per paint
 *
 * ASCII legend: " .:-=+*#%@" = ink intensity (0 → 1); "o" / "O" = accent
 * pixels (mid / strong); "1"–"3" / "a"–"c" = ink cells tagged with a vivid
 * colour (Raster.col → VIVID[0..2] in color.ts: blue, violet, magenta),
 * strong / mid. Rows are squashed 2:1 so shapes keep their aspect.
 *
 * The scaling scene reads the live mini-chart rects (layout.chartHole: at
 * rest and at full zoom, in viewport fractions, measured at the window's
 * size): pass W / H equal to the window's for a faithful layout.
 * window.__chartHole shows them.
 */
import { artRect, BASE_CELL_DESKTOP, BASE_CELL_MOBILE, chartHole, grid, toGrid, type Side } from './layout';
import { Raster } from './raster';
import { SCENES } from './scenes';
import type { SceneId } from './scenes/types';
import { ticker } from './ticker';

type Opts = {
  p?: number;
  t?: number;
  mobile?: boolean;
  full?: boolean;
  W?: number;
  H?: number;
  squash?: boolean;
  /** diagram side in the READ phase (default 'right') */
  side?: Side;
  /** 0 = side box, 1 = centred WATCH box */
  focus?: number;
};

const RAMP = ' .:-=+*#%@';
/** vivid colour slot k (1-based) → strong / mid glyph */
const VIVID_STRONG = '123';
const VIVID_MID = 'abc';

function paint(id: SceneId, o: Opts) {
  const mobile = !!o.mobile;
  const W = o.W ?? (mobile ? 390 : 1440);
  const H = o.H ?? (mobile ? 844 : 900);
  const base = mobile ? BASE_CELL_MOBILE : BASE_CELL_DESKTOP;
  const scene = SCENES[id];
  if (!scene) throw new Error(`unknown scene "${id}" — known: ${Object.keys(SCENES).join(', ')}`);
  const p = o.p ?? 0.5;
  const cell = scene.cell ? scene.cell(p, base) : base;
  const gr = grid(W, H, cell);
  const box = toGrid(artRect(W, H, mobile, o.side ?? 'right', o.focus ?? 0), cell, gr.offX, gr.offY);
  const g = { ...gr, box };
  const r = new Raster();
  r.resize(g.cols, g.rows);
  r.clear();
  const state = { r, box, full: g.full, p, t: o.t ?? 1.25, cell, mobile };
  return { r, g, scene, state };
}

function ascii(id: SceneId, o: Opts = {}): string {
  const { r, g, scene, state } = paint(id, o);
  scene.paint(state);
  const b = o.full ? g.full : g.box;
  const x0 = Math.max(0, Math.floor(b.x));
  const y0 = Math.max(0, Math.floor(b.y));
  const x1 = Math.min(r.w, Math.ceil(b.x + b.w));
  const y1 = Math.min(r.h, Math.ceil(b.y + b.h));
  const squash = o.squash ?? true;
  const lines: string[] = [];
  for (let y = y0; y < y1; y += squash ? 2 : 1) {
    let s = '';
    for (let x = x0; x < x1; x++) {
      let ink = 0;
      let acc = 0;
      let col = 0;
      for (let dy = 0; dy < (squash ? 2 : 1); dy++) {
        const yy = y + dy;
        if (yy >= r.h) continue;
        const i = yy * r.w + x;
        if (r.ink[i] > ink) {
          ink = r.ink[i];
          col = r.col[i];
        }
        acc = Math.max(acc, r.acc[i]);
      }
      if (acc > ink && acc > 0.08) s += acc > 0.6 ? 'O' : 'o';
      else if (col && ink > 0.08) s += (ink > 0.6 ? VIVID_STRONG : VIVID_MID)[col - 1] ?? '?';
      else s += RAMP[Math.min(RAMP.length - 1, Math.round(ink * (RAMP.length - 1)))];
    }
    lines.push(s.replace(/\s+$/, ''));
  }
  const header = `scene=${id} p=${o.p ?? 0.5} t=${o.t ?? 1.25} grid=${r.w}x${r.h} box=${[g.box.x, g.box.y, g.box.w, g.box.h].map((v) => v.toFixed(1)).join(',')}`;
  return `${header}\n${lines.join('\n')}`;
}

function bench(id: SceneId, o: Opts = {}, n = 120): { msPerPaint: number; cells: number } {
  const { r, scene, state } = paint(id, o);
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    r.clear();
    scene.paint({ ...state, t: (o.t ?? 1.25) + i / 60 });
  }
  return { msPerPaint: +((performance.now() - t0) / n).toFixed(3), cells: r.w * r.h };
}

declare global {
  interface Window {
    __scene?: typeof ascii;
    __sceneBench?: typeof bench;
    __goto?: (id: string, progress: number) => void;
    __ticker?: typeof ticker;
    __chartHole?: typeof chartHole;
  }
}

export function installDebugHooks() {
  window.__scene = ascii;
  window.__ticker = ticker;
  window.__chartHole = chartHole;
  window.__sceneBench = bench;
  window.__goto = (id, progress) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`no section #${id}`);
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + Math.max(0, el.offsetHeight - window.innerHeight) * progress);
  };
}
