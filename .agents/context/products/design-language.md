# From LLM to Agent — Design Language

> A shared vocabulary for the page's look and feel. When we name an effect in
> conversation ("give it the dissolve", "make it a highlight section"), the
> definition lives here: what it means, where it lives in code, and its key
> knobs.
>
> Keep this in sync with the code it points at. This is an agent file under
> `.agents/`, so edits stay approval-gated under Principle 1.

**Visual references:** the alkor-style green halftone creature (solid black
pixel blocks with dotted halftone falloff) and the orange "Lanyard 3D" dot
silhouettes (sparse print-style dots and checker textures on paper). Both are
1-bit pixel art, shaded by halftone density rather than by colour.

---

## Pixel Field

**What it means.** The single fixed, full-screen canvas behind the page. It
draws every scene as a grid of square "cells". Each cell shows one quantized
square, sized by intensity. Nothing else on the page draws pixels.

**Reference:** [`src/engine/PixelField.tsx`](../../../src/engine/PixelField.tsx)

Each frame:

1. Pick the current section's scene, and the next one while it slides in.
2. Paint each into a grid-resolution [`Raster`](../../../src/engine/raster.ts)
   (two channels: `ink` and `acc`).
3. Combine with the **dissolve**, apply the **ghost** brightness, and add
   **dust** and the **pointer halo**.
4. Draw with the **halftone** renderer.

**Key knobs.** `BASE_CELL_DESKTOP` = 9px and `BASE_CELL_MOBILE` = 7px in
[`layout.ts`](../../../src/engine/layout.ts). `EDGE` (dissolve front width)
and `POINTER_RADIUS` are in `PixelField.tsx`.

## Cell & grid

**What it means.** The canvas is divided into `cell`-px squares, centred in
the viewport. Scenes paint in **grid units** (1 unit = 1 cell), never in CSS
px, so they render at any resolution. A scene may ask for a different cell
size via `scene.cell(p, base)`. This is how the scaling law gets literally
finer as the model grows.

## Art box

**What it means.** The region where a scene composes its picture (`state.box`,
in cells). It moves with the section's act:

| Act | Desktop box (fractions of the viewport) |
|-----|------------------------------------------|
| Headline / Read, diagram **right** | x .52–.94, y .13–.87 |
| Headline / Read, diagram **left** | x .06–.48, y .13–.87 |
| Watch (**focus**) | x .08–.92, y .075–.795 — centred, larger; the strip below is for captions |

On mobile the box always stays in the top band (y 7.5–44.5%) — no focus
glide; watch captions flow as a list under a clear window.
`state.full` is the whole grid, for scenes that need the entire screen (the
scaling question beat). The box glides between positions, so scenes must
compose relative to `box`, never to fixed cells.

**Reference:** `artRect()` / `grid()` / `toGrid()` in
[`src/engine/layout.ts`](../../../src/engine/layout.ts).

## Acts: headline → read (→ watch)

**What it means.** Every section after the hero scrolls through acts, so the
reader looks at one thing at a time:

1. **Headline** — the centred *headline card* alone; the diagram is a
   *ghost* (16% brightness).
2. **Read** — the text column beside the diagram (sides *alternate*). In
   read-only sections the diagram's story plays here, while you read.
3. **Watch** — **only for key sections** (those with `watch` captions:
   chat, RAG, agent, MCP, finale). The column slides out, and the diagram
   glides to the centre (*focus*), grows, and plays its story with *watch
   captions*. Not every animation needs its own stage.

**Reference:** timings in [`src/engine/phases.ts`](../../../src/engine/phases.ts)
(`PHASES.read`, `PHASES.watch`, `PHASES.scaling`; `modeOf(section)`). The
ticker module writes them to `:root` at load as `--ph-<mode>-<phase>-a/b`
(plus the scaling stage's beats from `SCALING.phases` as
`--ph-scaling-<beat>`). Each section gets
a `mode-*` class that maps them to local variables (`--h-*`, `--ri-*`,
`--ro-*`, `--sc-*`). Scene progress is remapped to the act where the story
plays (`sceneProgress()`).

## Headline card

**What it means.** The centred opener of every section: optional part label
and part thesis (first section of each part) → kicker → huge title (Archivo
78% width, ~6.4vw) → "In plain words" analogy.
It owns the screen for the first ~10% of the section, then lifts away.

**Reference:** `HeadlineCard` in
[`src/components/Section.tsx`](../../../src/components/Section.tsx); `.card`
in `global.css`.

## Ghost

**What it means.** A scene drawn at low brightness behind the headline card
(`GHOST` = 0.16 in `PixelField.tsx`). The halftone turns it into sparse fine
dots, a hint of what's coming that never competes with the title.

## Alternating sides

**What it means.** Concept sections alternate the diagram's side in the read
act: right, left, right… (assigned in `sections.ts` after the list). The text
column takes the other side and exits toward its own edge.

## Watch captions

**What it means.** Numbered plain-words steps (`1/4 …`) under the centred
diagram. Each is shown from its `at` (scene progress) until the next one's.
The formula chip appears at the end. Captions must describe what is
*currently on screen*.

**Reference:** `Watch` in `Section.tsx`; data `watch: [{ at, text }]` in
`sections.ts`; `--sp` (scene progress) in CSS.

## Halftone levels

**What it means.** An intensity 0..1 becomes one of five square sizes:
`LEVELS = [0, .24, .42, .64, 1]` × cell. Values between two levels are
**ordered-dithered** with a 4×4 Bayer matrix. That produces the checker and
dot textures of print halftone. Level 4 fills the whole cell, so dense areas
merge into solid pixel blocks.

**Reference:** [`src/engine/halftone.ts`](../../../src/engine/halftone.ts)

**Painting guide** (alpha you pass to `INK(a)` / `ACC(a)`):

| Alpha | Reads as |
|-------|----------|
| 1 | solid pixel block — primary shapes |
| 0.5–0.7 | mid dots / checker — secondary shapes |
| 0.15–0.3 | sparse fine dots — texture, fog, "far away" |

Strokes thinner than ~1 cell break into faint dots. Draw primary outlines at
`lineWidth` ≥ 1 cell, pixel-aligned (`x + 0.5` for 1-cell lines).

## Ink & accent channels

**What it means.** Scenes paint ordinary pixels in the **ink** channel with
`INK(a)`, and the one highlighted idea of the section in the **accent**
channel with `ACC(a)`. The renderer draws ink cells in the section's `px`
colour and accent cells in its `accent` colour. Scenes never name a colour.

**Rule.** Accent is for the **one new idea** of the section: the newest
token, the retrieved pages, the agent's runner, the matched skill, the hidden
system band.

## Scene

**What it means.** A pure painter, one per section, in
`src/engine/scenes/<id>.ts`, registered in
[`scenes/index.ts`](../../../src/engine/scenes/index.ts).

```ts
type Scene = {
  paint(s: { r: Raster; box: Box; full: Box; p: number; t: number; cell: number; mobile: boolean }): void;
  cell?: (p: number, base: number) => number;
};
```

- `p` is the **scene progress**: the section's sticky progress remapped by
  `sceneProgress()` to the act where the story plays (`PHASES[mode].scene`);
  raw section progress on mobile, or the steps-list position for mobile
  watch sections. **p = 0 must be a complete composition**: it is shown
  through the headline act (as a ghost), during the dissolve in, and — for
  watch sections — through the whole read act. Spread the story across
  ~0..0.9.
- `t` is time in seconds, frozen at 0 under reduced motion. Motion is
  ambient; the meaning must survive `t = 0`.
- Budget: **≤ 1.5 ms per paint** on the desktop grid.

**Tools.** Helpers in
[`scenes/helpers.ts`](../../../src/engine/scenes/helpers.ts) (`space`,
`fillRound`, `strokeRound`, `line`, `textLines`, `dust`, `field`,
`nestedBoxes`, …). In dev, `window.__scene(id, { p, t, mobile })` prints an
ASCII render of the art box, and `window.__sceneBench(id, { p })` times a
paint. See [`src/engine/debug.ts`](../../../src/engine/debug.ts).

## Dissolve

**What it means.** The transition between two scenes. While the next section
slides up one viewport height (`blend` 0→1), each cell flips from scene A to
scene B. Each cell flips when its own noise threshold is crossed. The noise is
62% **4×4-block** noise and 38% per-cell noise, so the image breaks apart in
pixel chunks rather than cross-fading.

**Key knob.** `EDGE` (0.28) sets the width of the soft front.

## Dust

**What it means.** Sparse, slowly twinkling print speckle across the whole
field (~0.9% of cells). It keeps empty areas feeling like paper rather than a
void.

## Pointer halo

**What it means.** On desktop with a mouse, a faint, slow halo: within 90px
of the pointer a few cells thin out or light up, re-rolled 3× a second. It
echoes the cursor disturbance in the alkor reference. It is kept deliberately
subtle so it never pulls the eye while reading. Off on touch and under
reduced motion.

**Key knobs:** `POINTER_RADIUS`, `POINTER_RATE`, `POINTER_STRENGTH` in
`PixelField.tsx`.

## Cursor pulse

**What it means.** Anything cursor-like (the model's core block, the newest
token, `▌` in code) **pulses softly and slowly** (2.4s, never below ~60%).
It never hard-blinks: on/off blinking distracts from reading.

**Reference:** `blink()` in `scenes/helpers.ts`; `@keyframes pulse` in
`global.css`.

## Nested boxes

**What it means.** The page's signature motif: concentric 1-cell square
outlines around a solid blinking core (the model). They appear in the
**hero**, where the boxes peel off outward, and in the **finale**, where they
collapse inward to the core.

**Reference:** `nestedBoxes()` in
[`scenes/helpers.ts`](../../../src/engine/scenes/helpers.ts); used by
`hero.ts` and `unwrap.ts`.

## Color journey

**What it means.** The page background darkens as boxes stack up around the
model:

```
Model:   paper #F2EFE7 → cream #ECE8DD → [GREEN #5DCB8A] → #E9E3D5
Memory:  sand #E6DFCF → #DED5C1 → #D4CAB4 → #C9BEA4 → [BLUE #8FB4E3]
Harness: stone #9C9585 → [ORANGE #E8582A] → graphite #55524C → #3B3934 → #2A2825
         → [LOBSTER #181614 + red pixels]
Finale:  night #0A0A09
```

- **Highlight sections** (brackets) break the gradient on purpose: Scaling
  Law, RAG, Agent, and OpenClaw. They get a bordered kicker square and a
  heavier rail tick.
- **Ink flips** from dark to light at MCP (§11). During a blend, the ticker
  shows whichever section's ink contrasts more with the current background,
  so text is never mid-grey on mid-grey.
- **Contrast floor:** body text ≥ 4.5:1 against its own section background.

**Reference:** palettes in
[`src/content/sections.ts`](../../../src/content/sections.ts); blending in
[`src/engine/ticker.ts`](../../../src/engine/ticker.ts).

## Reveal

**What it means.** Copy appears in step with scrolling, not on a timer. Each
section element carries `--p` (its sticky progress, written by the ticker).
Elements with class `.rv` and an `--at` start point fade and rise in over 6%
of progress, staggered through the read act. Mobile and reduced motion show
everything immediately.

**Reference:** `.rv` in [`src/styles/global.css`](../../../src/styles/global.css).

## Formula chip

**What it means.** The inverted (ink-on-background-swapped) box at the end of
every concept, in the text and again at the end of the watch act:
`RAG = search + paste into prompt`. One line, always in the pattern *new
thing = old box + one new idea*. The small square before it is the accent
colour.

## Stack trail

**What it means.** The bottom-left HUD that shows the wrapping as code, for
example `rag( memory( window( … LLM )))`, plus "N boxes around the model".
Each section can add one `wrap`. The finale unwinds it back to the bare
model.

**Reference:** `StackTrail` in
[`src/components/Hud.tsx`](../../../src/components/Hud.tsx).

## Typography

| Role | Face | Notes |
|------|------|-------|
| Display & titles | Archivo (variable width) | titles `font-stretch: 84%`, weight ~680; hero 70% / 800, uppercase |
| Body | Archivo | 15.5–17.5px, `text-wrap: pretty` |
| Labels, code, HUD | JetBrains Mono | uppercase labels with 0.1–0.14em tracking |
| Numerals & part labels | Silkscreen | the pixel font — parameter counter, step numbers, part tags, wordmark |

## Adding a new term

```markdown
## <Term>

**What it means.** <one-paragraph definition>

**Reference:** <file path(s)> — and the key knobs.
```
