/**
 * Dev-only pop inspection (imported by engine/debug.ts, never by the app).
 * DOM-free: it runs wherever Vite's import.meta.env is defined (the dev page,
 * or Node through Vite's SSR loader).
 *
 *   popAscii('box-cat', { k: 0.3 })          → ASCII of the cells around the click
 *   popAscii('box-cat', { age: 0.2, mobile: true, reduced: true, seed: 3 })
 *   popAscii('goldfish', { k: 0.4, v: { dir: -1, size: -1 } })   → force a layout / state
 *   popCells('box-cat', { age: 0.57 }, [[0, -10]])  → the glyph at cells relative to the click
 *   popBench('box-cat')                      → avg ms per paint across its life
 *   popAudit('box-cat')                      → the paint contract, swept (see below)
 *
 * Legend: ink '@' 1, '#' .75, '+' .5, ':' .25, '.' .15 (any other ramp glyph
 * of " .:-=+*#%@" is an off-ladder value, which popAudit flags); accent "O"
 * from .75 up, "o" .5 and below; "_" = punched (the field is knocked out,
 * nothing drawn); "+" also marks the click cell when it is empty. Each cell is
 * two characters wide by default, so shapes keep their aspect.
 */
import { BASE_CELL_DESKTOP, BASE_CELL_MOBILE, grid } from '../layout';
import { PopBuffer } from './buffer';
import { COMBO, POPS, type PopId } from './index';
import type { PopState, Reach } from './types';
import { comboReach } from './wrap-it-up';

/** state overrides: the layout, a forced variant, and the context live.ts would pass */
type Over = Partial<Pick<PopState, 'dir' | 'size' | 'variant' | 'squint' | 'paper' | 'ctx' | 'pointer' | 'ringT'>>;

type Opts = {
  /** progress 0..1 (ignored when `age` is given) */
  k?: number;
  /** seconds since the click */
  age?: number;
  mobile?: boolean;
  reduced?: boolean;
  seed?: number;
  /** viewport in CSS px (default 1440×900, mobile 390×844) */
  W?: number;
  H?: number;
  /** click point in CSS px (default: the viewport centre) */
  x?: number;
  y?: number;
  /** half-size of the window shown, in cells (default 16) */
  r?: number;
  /** one character per cell instead of two */
  narrow?: boolean;
  /** state overrides (default: the pop's first layout, dir +1, no squint, not paper, ctx 'model', no pointer, ringT [0]) */
  v?: Over;
};

const RAMP = ' .:-=+*#%@';

/** one cell as a glyph (see the legend above); '·' off the grid */
function glyph(b: PopBuffer, x: number, y: number): string {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return '·';
  const i = y * b.w + x;
  const ink = b.ink[i];
  const acc = b.acc[i];
  // 'O' from the .75 step up, 'o' for .5 and below
  if (acc > ink && acc > 0.02) return acc >= 0.7 ? 'O' : 'o';
  if (ink > 0.02) return RAMP[Math.max(1, Math.min(RAMP.length - 1, Math.round(ink * (RAMP.length - 1))))];
  if (b.hole[i] > 0.3) return '_';
  return ' ';
}

function setup(id: PopId, o: Opts) {
  const pop = POPS[id];
  if (!pop) throw new Error(`unknown pop "${id}" — known: ${Object.keys(POPS).join(', ')}`);
  const mobile = !!o.mobile;
  const W = o.W ?? (mobile ? 390 : 1440);
  const H = o.H ?? (mobile ? 844 : 900);
  const cell = mobile ? BASE_CELL_MOBILE : BASE_CELL_DESKTOP;
  const g = grid(W, H, cell);
  const b = new PopBuffer();
  b.resize(g.cols, g.rows);
  const seed = o.seed ?? 1;
  const reduced = !!o.reduced;
  const ringT = o.v?.ringT ?? [0];
  const ctx = o.v?.ctx ?? 'model';
  const life = pop.lifeOf ? pop.lifeOf({ ringT, reduced, ctx }) : reduced ? (pop.reducedLife ?? pop.life) : pop.life;
  const age = o.age ?? (o.k ?? 0) * life;
  const fit = pop.layouts(seed, 1)[0]?.fit ?? { dir: 1, size: 0 };
  const state: PopState = {
    b,
    x: ((o.x ?? W / 2) - g.offX) / cell,
    y: ((o.y ?? H / 2) - g.offY) / cell,
    age,
    k: Math.min(1, age / life),
    seed,
    dir: fit.dir,
    size: fit.size,
    squint: false,
    paper: false,
    ctx: 'model',
    pointer: null,
    ringT,
    cols: g.cols,
    rows: g.rows,
    cell,
    mobile,
    reduced,
    ...o.v,
  };
  return { pop, b, state, life };
}

export function popAscii(id: PopId, o: Opts = {}): string {
  const { pop, b, state, life } = setup(id, o);
  pop.paint(state);
  const r = o.r ?? 16;
  const cx = Math.floor(state.x);
  const cy = Math.floor(state.y);
  const lines: string[] = [];
  for (let y = cy - r; y <= cy + r; y++) {
    let s = '';
    for (let x = cx - r; x <= cx + r; x++) {
      let ch = glyph(b, x, y);
      if (x === cx && y === cy && ch === ' ') ch = '+';
      s += o.narrow ? ch : ch + ch;
    }
    lines.push(s.replace(/\s+$/, ''));
  }
  const used = b.empty
    ? 'nothing drawn'
    : `drawn x ${b.x0 - cx}..${b.x1 - 1 - cx}, y ${b.y0 - cy}..${b.y1 - 1 - cy} (${b.x1 - b.x0}×${b.y1 - b.y0})`;
  const over = o.v ? ` v=${JSON.stringify(o.v)}` : '';
  const header = `pop=${id} k=${state.k.toFixed(3)} age=${state.age.toFixed(3)}s life=${life.toFixed(2)}s seed=${state.seed} dir=${state.dir} size=${state.size}${state.mobile ? ' mobile' : ''}${state.reduced ? ' reduced' : ''}${over} · ${used} · window ±${r} around the click (+)`;
  return `${header}\n${lines.join('\n')}`;
}

/** The glyphs at cells relative to the click, e.g. [[-7, 0], [0, 1]] → { '-7,0': '@', '0,1': 'O' } (' ' = empty). */
export function popCells(id: PopId, o: Opts, cells: readonly (readonly [number, number])[]): Record<string, string> {
  const { pop, b, state } = setup(id, o);
  pop.paint(state);
  const cx = Math.floor(state.x);
  const cy = Math.floor(state.y);
  const out: Record<string, string> = {};
  for (const [x, y] of cells) out[`${x},${y}`] = glyph(b, cx + x, cy + y);
  return out;
}

export function popBench(id: PopId, o: Opts = {}, n = 400): { msPerPaint: number } {
  const { pop, b, state, life } = setup(id, o);
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    b.clear();
    const age = (i / n) * life;
    pop.paint({ ...state, age, k: age / life });
  }
  return { msPerPaint: +((performance.now() - t0) / n).toFixed(4) };
}

/** the exact halftone steps (plus the '.' speckle) a pop may draw */
const TONES = [1, 0.75, 0.5, 0.25, 0.15];
/** what else live.ts may hand a pop: a squinting face on a paper section, and the finale */
const STATES: Over[] = [{}, { squint: true, paper: true }, { ctx: 'finale' }];
/** the combo's ring times: one to four rings, at a steady pace and as fast as a visitor can click */
const RING_SETS = [[0], [0, 0.3], [0, 0.3, 0.6], [0, 0.3, 0.6, 0.9], [0, 0.05, 0.1, 0.15]];

/**
 * Check a pop against the paint contract, across seeds 1..`seeds`, both
 * sides, every layout it offers, normal and reduced motion, the STATES (and
 * for the combo every RING_SETS entry), every 10 ms of its life:
 *   reach   — every drawn cell (ink, accent or punch) lies inside the layout's declared reach
 *             (the combo: inside comboReach for its ring count, which live.ts fits it with)
 *   overlap — ink and accent never share a cell in a frame
 *   first   — something is drawn on the very first frame (age 0)
 *   tones   — every drawn value sits on the exact ladder (1 / .75 / .5 / .25, or the .15 speckle);
 *             anything between is Bayer-dithered by position and shimmers on a moving sprite
 * Returns the problems found (empty = clean) and the worst frame's cost.
 */
export function popAudit(id: PopId, o: { seeds?: number; mobile?: boolean } = {}) {
  const problems: string[] = [];
  /** off-ladder values seen → how many cell-frames */
  const offTone = new Map<string, number>();
  let worstMs = 0;
  for (const reduced of [false, true]) {
    for (let seed = 1; seed <= (o.seeds ?? 8); seed++) {
      for (const side of [1, -1] as const) {
        for (const layout of POPS[id].layouts(seed, side)) {
          for (const state of STATES) {
            for (const ringT of id === COMBO ? RING_SETS : [[0]]) {
              const { fit } = layout;
              const reach: Reach = id === COMBO ? comboReach(ringT.length) : layout.reach;
              const v: Over = { dir: fit.dir, size: fit.size, ringT, ...state };
              const tag = `seed=${seed} side=${side} ${JSON.stringify(v)}${reduced ? ' reduced' : ''}`;
              const { pop, b, state: s, life } = setup(id, { seed, reduced, mobile: o.mobile, v });
              const cx = Math.floor(s.x);
              const cy = Math.floor(s.y);
              let x0 = Infinity;
              let y0 = Infinity;
              let x1 = -Infinity;
              let y1 = -Infinity;
              let overlaps = 0;
              for (let age = 0; age < life; age += 0.01) {
                b.clear();
                const t0 = performance.now();
                pop.paint({ ...s, age, k: age / life });
                worstMs = Math.max(worstMs, performance.now() - t0);
                if (age === 0 && b.empty) problems.push(`${tag}: nothing drawn at age 0`);
                if (b.empty) continue;
                x0 = Math.min(x0, b.x0 - cx);
                y0 = Math.min(y0, b.y0 - cy);
                x1 = Math.max(x1, b.x1 - 1 - cx);
                y1 = Math.max(y1, b.y1 - 1 - cy);
                for (let y = b.y0; y < b.y1; y++) {
                  for (let x = b.x0; x < b.x1; x++) {
                    const i = y * b.w + x;
                    if (b.ink[i] > 0.02 && b.acc[i] > 0.02) overlaps++;
                    for (const v of [b.ink[i], b.acc[i]]) {
                      if (v <= 0.02 || TONES.some((t) => Math.abs(v - t) < 1e-3)) continue;
                      const key = v.toFixed(3);
                      offTone.set(key, (offTone.get(key) ?? 0) + 1);
                    }
                  }
                }
              }
              if (x0 < reach[0] || y0 < reach[1] || x1 > reach[2] || y1 > reach[3]) {
                problems.push(`${tag}: drew x ${x0}..${x1}, y ${y0}..${y1} — outside reach [${reach.join(', ')}]`);
              }
              if (overlaps) problems.push(`${tag}: ${overlaps} cell-frames with ink and accent in one cell`);
            }
          }
        }
      }
    }
  }
  if (offTone.size) {
    const list = [...offTone].map(([v, n]) => `${v} ×${n}`).join(', ');
    problems.push(`off-ladder tones (value ×cell-frames): ${list}`);
  }
  return { problems: [...new Set(problems)], worstMs: +worstMs.toFixed(4) };
}
