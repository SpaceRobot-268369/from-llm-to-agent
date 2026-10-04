/**
 * Something pops paint into: the frame's PopBuffer, or a pen wrapped around it
 * (live.ts records each pop's drawn box and crumbles pops that hurry out).
 */
export type Pen = {
  /** grid size in cells */
  readonly w: number;
  readonly h: number;
  /** Light the cell under (x, y) at v (0..1, max blend), in ink or accent. Off-grid points are ignored. */
  dot(x: number, y: number, v: number, accent?: boolean): void;
  /** Knock out the field under (x, y) by v (0..1, max blend). */
  punch(x: number, y: number, v: number): void;
};

/** Where the click landed: the chapter of the section under the viewport centre (a chapter card counts as its chapter). */
export type PopCtx = 'hero' | 'model' | 'memory' | 'harness' | 'finale';

/** One way to lay a pop out. */
export type Fit = {
  /** facing / travel direction: +1 as drawn (rightward), -1 mirrored */
  dir: 1 | -1;
  /** -1 = tight (smaller travel / rise), 0 = normal, 1 = roomy */
  size: -1 | 0 | 1;
};

/** A pop's worst-case reach for a Fit: [x0, y0, x1, y1] in cells, inclusive, relative to the clicked cell, drift included. */
export type Reach = [number, number, number, number];

export type PopState = {
  /** Paint target (whole grid). Write only through it: dot() / punch(), or the helpers. */
  b: Pen;
  /** The click point in grid units (fractional cells; the clicked cell C is floor(x), floor(y)). */
  x: number;
  y: number;
  /** Effective seconds since the click: real time, minus the pauses of boops and tickles. */
  age: number;
  /** age / life, 0 → 1. */
  k: number;
  /** Stable per-click integer seed: pick variants, mirroring, small shape changes with it (helpers.rnd). */
  seed: number;
  /** The layout live.ts chose (it fits on screen, clear of text and diagrams). */
  dir: 1 | -1;
  size: -1 | 0 | 1;
  /**
   * Dev override for the seeded variant (debug hooks only): its index in the
   * order the pop's header lists its variants. Pops pick from `seed` when
   * undefined.
   */
  variant?: number;
  /** True while a boop or tickle pauses the pop (under reduced motion too: a face change is not motion): show its squint / happy face. */
  squint: boolean;
  /** True where the accent renders as paper (chapter cards, full-bleed signature sections): blush turns to ink. */
  paper: boolean;
  /** The chapter where the click landed. */
  ctx: PopCtx;
  /** The mouse in grid units, or null (touch, or no pointer). */
  pointer: { x: number; y: number } | null;
  /** The combo only: effective seconds (since the combo spawned) at which each ring was added; [0] for the first. */
  ringT: readonly number[];
  /** Grid size in cells, for keeping things on screen. */
  cols: number;
  rows: number;
  /** Current cell size in CSS px. */
  cell: number;
  mobile: boolean;
  /** prefers-reduced-motion: nothing moves — a still frame that appears and fades or crumbles in place. */
  reduced: boolean;
};

/** What a pop's length can depend on. */
export type LifeState = { ringT: readonly number[]; reduced: boolean; ctx: PopCtx };

/**
 * A pop: a small pixel animation played where the visitor clicks empty space.
 * A pure painter like a scene — no DOM, no state between frames; everything
 * derives from the state (`age`, `seed`, the chosen layout).
 */
export type Pop = {
  /** Seconds on screen. */
  life: number;
  /** Seconds on screen under reduced motion (defaults to `life`). */
  reducedLife?: number;
  /** Seconds on screen for this state, when it isn't fixed (the combo grows with its rings). Overrides life / reducedLife. */
  lifeOf?: (s: LifeState) => number;
  /**
   * Under reduced motion, the effective age where the still begins (default
   * 0). A boop restarts the still's hold from here — the combo's still is
   * its reward, after the rings.
   */
  holdStart?: (s: LifeState) => number;
  /**
   * The layouts to try, most preferred first, each with its worst-case reach.
   * `side` is the side with more free room (+1 = right); pops that travel
   * sideways prefer to face it. live.ts takes the first that fits.
   */
  layouts(seed: number, side: 1 | -1): { fit: Fit; reach: Reach }[];
  paint(s: PopState): void;
};
