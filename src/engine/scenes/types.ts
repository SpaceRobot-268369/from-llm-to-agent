import type { Raster } from '../raster';

/** A rectangle in grid units (cells), plus convenience centre and short side. */
export type Box = {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  /** min(w, h) */
  s: number;
};

export type SceneState = {
  /** Paint target, already cleared. Size: r.w × r.h cells. */
  r: Raster;
  /** The art region (right half on desktop, top band on mobile), in cells. */
  box: Box;
  /** The whole grid as a box, for scenes that need the full screen. */
  full: Box;
  /**
   * Scene progress 0 → 1: the section's sticky progress remapped by
   * sceneProgress() to the act where the story plays (raw section progress on
   * mobile, or the steps-list position for mobile WATCH sections). Nothing is drawn while the headline card is up;
   * p = 0 is the frame the diagram fades in on (and, for watch sections, the
   * frame held through the read act), so it must be a complete composition.
   */
  p: number;
  /** Seconds since start. Frozen at 0 with prefers-reduced-motion. */
  t: number;
  /** Current cell size in CSS px (≈ how many px one cell covers). */
  cell: number;
  mobile: boolean;
};

export type Scene = {
  paint(s: SceneState): void;
  /** Optional desired cell size (CSS px) at progress p. Defaults to `base`. */
  cell?: (p: number, base: number) => number;
  /**
   * Every scene is clipped to its art box (+1 cell) so it can never overlap
   * the text column. Return true to paint the whole screen at progress p —
   * only for moments when no text sits beside the art (e.g. a centred finale).
   */
  unclipped?: (p: number) => boolean;
};

export type SceneId =
  | 'hero'
  | 'tokens'
  | 'scaling'
  | 'thinking'
  | 'chat'
  | 'system'
  | 'window'
  | 'memory'
  | 'rag'
  | 'tools'
  | 'agent'
  | 'mcp'
  | 'skill'
  | 'agentfiles'
  | 'subagents'
  | 'agents'
  | 'part'
  | 'unwrap';
