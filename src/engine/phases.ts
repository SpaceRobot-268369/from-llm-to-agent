/**
 * Section phases — the single source of timing for each section's scroll.
 *
 * Every section after the hero opens with a centred HEADLINE card (the
 * diagram is a dim ghost), then a READ act: the text column beside the
 * diagram, whose story plays as you read.
 *
 * Only the important sections add a WATCH act (they have `watch` captions):
 * the text leaves, the diagram glides to centre, grows, and plays its story
 * with step captions. Not every animation needs its own stage.
 *
 * All values are fractions of the section's sticky progress p (0..1). The
 * ticker writes them to :root as CSS variables (--ph-<mode>-*), so the
 * stylesheet reads the same numbers.
 */
import { SCALING, SECTIONS, type Section } from '../content/sections';
import type { Side } from './layout';
import { range, smoothstep } from './noise';

type Span = readonly [number, number];
type Timing = { headOut: Span; readIn: Span; readOut?: Span; focus?: Span; scene: Span };

export const PHASES = {
  /** headline → read; the scene's story plays while you read */
  read: {
    headOut: [0.08, 0.16],
    readIn: [0.14, 0.22],
    scene: [0.2, 0.9],
  },
  /**
   * headline → read → watch; the scene holds still while you read, then
   * performs — its clock starts only once the glide and the caption strip
   * have finished arriving, so the first caption gets real reading time.
   */
  watch: {
    headOut: [0.07, 0.13],
    readIn: [0.12, 0.18],
    readOut: [0.43, 0.49],
    focus: [0.44, 0.55],
    scene: [0.55, 0.95],
  },
  /** the scaling stage keeps its own timeline after its headline card */
  scaling: {
    headOut: [0.035, 0.07],
    readIn: [0.07, 0.1],
    scene: [0, 1],
  },
} as const satisfies Record<string, Timing>;

export type Mode = keyof typeof PHASES;

export function modeOf(s: Section): Mode | null {
  if (s.kind === 'hero') return null;
  if (s.kind === 'scaling') return 'scaling';
  return s.watch ? 'watch' : 'read';
}

function timing(s: Section): Timing | null {
  const m = modeOf(s);
  return m ? PHASES[m] : null;
}

/** 1 while the headline card owns the screen, → 0 as it leaves. */
export function headline(s: Section, p: number): number {
  const t = timing(s);
  return t ? 1 - smoothstep(t.headOut[0], t.headOut[1], p) : 0;
}

/** 0 = diagram beside the text, 1 = diagram centred and enlarged. */
export function focus(s: Section, p: number): number {
  const t = timing(s);
  return t?.focus ? smoothstep(t.focus[0], t.focus[1], p) : 0;
}

/** The progress handed to the scene. */
export function sceneProgress(s: Section, p: number): number {
  const t = timing(s);
  return t ? range(t.scene[0], t.scene[1], p) : p;
}

/**
 * Write every phase number as a CSS variable on :root — including the
 * scaling stage's own beats (SCALING.phases), so CSS never duplicates them.
 */
export function writePhaseVars(style: CSSStyleDeclaration) {
  for (const [mode, t] of Object.entries(PHASES) as [Mode, Timing][]) {
    for (const [key, span] of Object.entries(t) as [string, Span][]) {
      style.setProperty(`--ph-${mode}-${key}-a`, String(span[0]));
      style.setProperty(`--ph-${mode}-${key}-b`, String(span[1]));
    }
  }
  for (const [key, v] of Object.entries(SCALING.phases)) style.setProperty(`--ph-scaling-${key}`, String(v));
}

/** brightness of a scene while the headline card is up */
const GHOST = 0.16;

/** Where a section's scene sits, what progress it sees, how bright it is. */
export function placement(
  index: number,
  p: number,
  f: { mobile: boolean; mobileScene: (number | null)[] },
): { sec: Section; side: Side; focus: number; sp: number; light: number } {
  const sec = SECTIONS[index];
  if (f.mobile) {
    // mobile: the art stays in the top band; WATCH scenes play while their steps are read
    const ms = f.mobileScene[index];
    return { sec, side: 'right', focus: 0, sp: ms ?? p, light: 1 };
  }
  const h = headline(sec, p);
  return {
    sec,
    side: sec.art ?? 'right',
    focus: focus(sec, p),
    sp: sceneProgress(sec, p),
    light: 1 - (1 - GHOST) * h,
  };
}
