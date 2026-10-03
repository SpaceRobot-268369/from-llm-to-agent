/**
 * Section phases — the single source of timing for each section's scroll.
 *
 * Chapter openers (kind 'part') are one full-screen card that holds, then
 * leaves. Every topic opens with a centred HEADLINE card on a clean
 * background (no diagram), then a READ act: the text column beside the
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
  /** chapter opener: the card holds for most of the scroll (the buffer), then leaves */
  part: {
    headOut: [0.7, 0.86],
    readIn: [2, 2],
    scene: [0, 1],
  },
  /** headline → read; the story plays while you read, then a still hold before the next topic */
  read: {
    headOut: [0.12, 0.2],
    readIn: [0.18, 0.26],
    scene: [0.24, 0.84],
  },
  /**
   * headline → read → watch; the scene holds still while you read, then
   * performs — its clock starts only once the glide and the caption strip have
   * arrived, and it ends early so the last frame holds before the hand-off.
   * The glide to the centre starts only once the copy has fully faded, so the
   * moving diagram never crosses text.
   */
  watch: {
    headOut: [0.1, 0.17],
    readIn: [0.15, 0.22],
    readOut: [0.44, 0.5],
    focus: [0.5, 0.58],
    scene: [0.58, 0.9],
  },
  /** the scaling stage keeps its own timeline (SCALING.phases) after its headline card */
  scaling: {
    headOut: [0.025, 0.05],
    readIn: [0.05, 0.075],
    scene: [0, 1],
  },
} as const satisfies Record<string, Timing>;

/**
 * Phones: a READ section's art band is in clear view only before its copy
 * scrolls over it, so there its story loops in time instead of following the
 * scroll — wait, play, hold the finished picture, cut back to the start. The
 * ticker starts each section's clock as its clear top reaches the art band
 * (mobileScene). Seconds.
 */
export const MOBILE_LOOP = { wait: 0.8, play: 8, hold: 3 } as const;

/** Scene progress `s` seconds into a phone READ section's loop. */
export function mobileLoop(s: number): number {
  const { wait, play, hold } = MOBILE_LOOP;
  const k = s % (wait + play + hold);
  return k < wait ? 0 : Math.min(1, (k - wait) / play);
}

export type Mode = keyof typeof PHASES;

export function modeOf(s: Section): Mode | null {
  if (s.kind === 'hero') return null;
  if (s.kind === 'part') return 'part';
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

/**
 * How visible the diagram is: nothing at all while a headline card is up
 * (a ghost behind a title confuses), fading in as the text arrives.
 */
export function visibility(s: Section, p: number): number {
  const t = timing(s);
  if (!t) return 1;
  return smoothstep(t.readIn[0], t.readIn[1], p);
}

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
    return { sec, side: sec.art === 'center' ? 'center' : 'right', focus: 0, sp: ms ?? p, light: 1 };
  }
  return {
    sec,
    side: sec.art ?? 'right',
    focus: focus(sec, p),
    sp: sceneProgress(sec, p),
    light: visibility(sec, p),
  };
}
