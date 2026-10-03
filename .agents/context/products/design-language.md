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
mark, sized by intensity (squares, dashes or crosses by chapter; see
**Chapters**). Nothing else on the page draws pixels.

**Reference:** [`src/engine/PixelField.tsx`](../../../src/engine/PixelField.tsx)

Each frame:

1. Pick the current section's scene, and the next one while it slides in.
2. Paint each into a grid-resolution [`Raster`](../../../src/engine/raster.ts)
   (two channels, `ink` and `acc`, plus an optional colour tag, `col`; see
   **Ink & accent channels**).
3. Clip each to its art box, combine with the **dissolve** (topics) or
   **wipe** (chapters), apply the act's visibility, and add **dust** and the
   **pointer halo**.
4. Draw with the **halftone** renderer.

**Key knobs.** `BASE_CELL_DESKTOP` = 9px and `BASE_CELL_MOBILE` = 7px in
[`layout.ts`](../../../src/engine/layout.ts). `EDGE` (dissolve and wipe
front width) is in [`wipe.ts`](../../../src/engine/wipe.ts);
`POINTER_RADIUS` is in `PixelField.tsx`.

## Cell & grid

**What it means.** The canvas is divided into `cell`-px squares, centred in
the viewport. Scenes paint in **grid units** (1 unit = 1 cell), never in CSS
px, so they render at any resolution. Every scene paints at the base cell
size. (The optional `scene.cell(p, base)` hook is still consulted by
`PixelField.tsx` and `debug.ts`, but no scene defines it.)

## Art box

**What it means.** The region where a scene composes its picture (`state.box`,
in cells). It moves with the section's act:

| Act | Desktop box (fractions of the viewport) |
|-----|------------------------------------------|
| Read, diagram **right** | x .52–.94, y .13–.87 |
| Read, diagram **left** | x .06–.48, y .13–.87 |
| Watch (**focus**) | x .08–.92, y .075–.795 — centred, larger; the strip below is for captions |
| Hero (**center**) | x .015–.965, y .06–.98 — on every screen size; the frames sit around `heroHole` inside it |

On mobile the box (except the hero's) always stays in the top band
(y 7.5–44.5%) — no focus glide; watch captions flow as a list under a clear
window.
`state.full` is the whole grid, for scenes that need the entire screen (the
scaling question beat). The box glides between positions, so scenes must
compose relative to `box`, never to fixed cells.

**Reference:** `artRect()` / `grid()` / `toGrid()` in
[`src/engine/layout.ts`](../../../src/engine/layout.ts).

## Hero

**What it means.** The opener: a centred headline framed by a **compact
ring band**: up to four concentric pixel rectangles (`HERO_RINGS`, 0 / 2 /
4 / 7 cells out from the text, solid → fine dots). The band hugs `heroHole`,
the headline's real extent, which `Hero.tsx` re-measures on resize and font
load; it keeps only the rings that fit inside the art box and clear of the
HUD (`heroHole.rings`). The innermost frame carries accent corner brackets;
the core stays empty, because the headline is the model. Scrolling peels the
rings off outward, outermost first, each drifting out a few cells as it
fades.

- **Chapter chips.** Under the lede, *Model · Memory · Harness* are three
  solid ink chips (Silkscreen, background-coloured text, a hard accent
  shadow), built from `CHAPTERS`. Each jumps to its chapter card. They come
  before the stickers in the DOM, so Tab reaches them first.
- **Buzzword stickers.** `HERO_WORDS` are pixel stickers *scattered* around
  the band (seeded best-candidate sampling, so the same scatter on every
  visit, never touching the band, the HUD, the scroll cue or each other; on
  small screens the lowest-priority ones are left out). Each floats in place
  and is a button that jumps to the section that explains it (`to`).
- **Intro.** The loader fills 16 pixel cells (fonts ready, ~1.1s minimum),
  then collapses into one square and fades. As the fade starts (`intro.at`),
  the stickers **burst** out of the headline's centre (staggered, overshooting,
  but never past the free area). Scrolling pulls them back in, one after
  another. Reduced motion: no burst, no float.
- **Leaving.** As Chapter 1 wipes in, the whole hero fades out, gone by
  blend 0.2, before its text can slide under the top bar. The ticker writes
  `--leave` (the blend, 0 → 1) on the current section; the hero's sticky
  stage reads it.

**Reference:** [`Hero.tsx`](../../../src/components/Hero.tsx),
[`Loader.tsx`](../../../src/components/Loader.tsx),
[`scenes/hero.ts`](../../../src/engine/scenes/hero.ts), `heroHole` /
`HERO_RINGS` / `heroRing()` in `layout.ts`, `intro` / `BURST` in
[`intro.ts`](../../../src/engine/intro.ts), `.hero__chapter` and
`.sec--hero .sec__sticky` in `global.css`.

## Chapters

**What it means.** The page has exactly three chapters, **Model**, **Memory**
and **Harness**, and every topic nests inside one (numbered `2.3`). Each
chapter has:

- a **chapter card** (`kind: 'part'`, [`ChapterCard.tsx`](../../../src/components/ChapterCard.tsx)):
  a full-screen card in the chapter's signature colour, with a giant pixel
  numeral, the chapter name, its thesis, and a clickable contents list. There
  is no diagram. It **holds** for ~70% of its scroll (the *buffer*), then lifts away;
- a **colour family** (Model: paper + green; Memory: sand + blue; Harness:
  graphite + orange);
- a **mark**: mid-tone halftone cells are drawn as squares (Model), dashes
  (Memory) or crosses (Harness). Solid cells are always full squares. See
  `CHAPTERS` in `sections.ts` and `MARK` in `halftone.ts`.

Switching chapters uses a left → right pixel **wipe**; switching topics inside
a chapter uses the blocky **dissolve** (`PixelField.tsx`).

## Acts: headline → read (→ watch)

**What it means.** Every topic scrolls through acts, so the reader looks at
one thing at a time:

1. **Headline** — the centred *headline card* alone on a clean background.
   **No diagram at all**; it fades in only as the text arrives.
2. **Read** — the text column beside the diagram (sides *alternate*). In
   read-only topics the diagram's story plays here; afterwards the last frame
   holds before the next topic (the *buffer*).
3. **Watch** — **only for key topics** (those with `watch` captions: chat,
   RAG, agent loop, MCP, finale). The column slides out, and the diagram glides
   to the centre (*focus*), grows, and plays with *watch captions*.

**Reference:** timings in [`src/engine/phases.ts`](../../../src/engine/phases.ts)
(`PHASES.part`, `.read`, `.watch`, `.scaling`; `modeOf()`, `visibility()`,
`placement()`). The ticker module writes them to `:root` at load as
`--ph-<mode>-<phase>-a/b` (plus the scaling stage's beats from
`SCALING.phases` as `--ph-scaling-<beat>`). Each section gets a `mode-*`
class that maps them to local variables (`--h-*`, `--ri-*`, `--ro-*`,
`--sc-*`).

## Clipping

**What it means.** Every scene is clipped to its art box (+1 cell) before
blending, so a diagram can never overlap the text column. A scene may return
`unclipped(p) = true` only when no text sits beside it. The only user is the
scaling stage's centred ending.

## Headline card

**What it means.** The centred opener of every topic: number + kicker
(`2.3 · Context window`) → huge title (Archivo 78% width, ~6.4vw) → "In plain
words" analogy, on a clean background. Chapter openers use the chapter card
instead.
It owns the screen for the first ~10% of the section, then lifts away.

**Reference:** `HeadlineCard` in
[`src/components/Section.tsx`](../../../src/components/Section.tsx); `.card`
in `global.css`.

## Alternating sides

**What it means.** Concept sections alternate the diagram's side in the read
act: right, left, right… (assigned in `sections.ts` after the list), restarting
on the right at each chapter card. The text column takes the other side and
exits toward its own edge.

## Watch captions

**What it means.** Numbered plain-words steps (`1/4 …`) under the centred
diagram. Each is shown from its `at` (scene progress) until the next one's.
The formula chip appears at the end. Captions must describe what is
*currently on screen*.

**Reference:** `Watch` in `Section.tsx`; data `watch: [{ at, text }]` in
`sections.ts`; `--sp` (scene progress) in CSS.

## Halftone levels

**What it means.** An intensity 0..1 becomes one of five mark sizes:
`LEVELS = [0, .24, .42, .64, 1]` × cell (mid-tones take the chapter's mark). Values between two levels are
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
system-prompt cards.

**The one exception: vivid colour.** Where colour itself is the meaning —
sparks firing along the scaling brain's folds as the model grows (more
sparks = more intelligence) — a scene tags ink cells with a slot of the
fixed `VIVID` palette ([`color.ts`](../../../src/engine/color.ts)) through
`Raster.col`. Colour stays sparse: dots, tiny clusters and a few short
paths in the folds of an ink body (about 7% of the brain's cells at the
frontier), never whole areas. The
three hues — electric blue, violet, magenta — sit opposite the scaling green
and stay legible on it, on the paper backgrounds and on the dark ink, so a
coloured cell never reads as ink; warm hues are left out (muddy or invisible
on the green). The tag is cleared every frame and travels through the
dissolve like the accent does, so scenes that never write it are unaffected.
The halftone renderer draws one path per tone (`TONE_INK`, `TONE_ACC`, then
`TONE_VIVID + k` in `halftone.ts`). `__scene` shows tagged cells as `1`–`3`
(strong) / `a`–`c` (mid).

## Scene

**What it means.** A pure painter, one per section (the chapter cards share
the intentionally empty `part`), in `src/engine/scenes/<id>.ts`, registered
in [`scenes/index.ts`](../../../src/engine/scenes/index.ts).

```ts
type Scene = {
  paint(s: { r: Raster; box: Box; full: Box; p: number; t: number; cell: number; mobile: boolean }): void;
  unclipped?: (p: number) => boolean; // true = paint the whole screen at p (see Clipping)
  cell?: (p: number, base: number) => number; // unused: no scene defines it
};
```

- `p` is the **scene progress**: the section's sticky progress remapped by
  `sceneProgress()` to the act where the story plays (`PHASES[mode].scene`);
  on mobile, the steps-list position for watch sections, the next-token
  demo's position for 1.1 (so its steps play while the whole demo is on
  screen), and a loop in time for the other read sections (`MOBILE_LOOP` in
  `phases.ts`: wait, play, hold the finished picture, restart), whose clock
  starts as the section's clear top reaches the art band. **p = 0 must be a complete composition**: on desktop it is
  the frame shown as the diagram fades in with the read act (nothing, not
  even a ghost, shows behind a headline card) and, for watch sections, the
  one held through the whole read act. On mobile, where the art band stays
  at full strength, it is also the frame shown while a section dissolves
  in. Spread the story across ~0..0.9.
- `t` is time in seconds, frozen at 0 under reduced motion. Motion is
  ambient; the meaning must survive `t = 0`. The exception is **chat**: at
  p = 0 (its read act) it loops the forgetful new-session story on `t`
  every 9s, and at `t = 0` it holds the "?" frame. On phones every read
  scene loops in time (see `p`), because the copy covers the art band early;
  under reduced motion it holds the finished picture.
- Budget: **≤ 1.5 ms per paint** on the desktop grid.

**Tools.** Helpers in
[`scenes/helpers.ts`](../../../src/engine/scenes/helpers.ts) (`space`,
`fillRound`, `strokeRound`, `line`, `textLines`, `dust`, `field`,
`nestedBoxes`, …). In dev, `window.__scene(id, { p, t, mobile })` returns an
ASCII render of the art box, and `window.__sceneBench(id, { p })` times a
paint. See [`src/engine/debug.ts`](../../../src/engine/debug.ts).

## Dissolve

**What it means.** The transition between two sections in the same chapter.
While the next section slides up one viewport height (`blend` 0→1), each cell
flips from scene A to scene B. Each cell flips when its own noise threshold is
crossed. The noise is 62% **4×4-block** noise and 38% per-cell noise, so the
image breaks apart in pixel chunks rather than cross-fading. On desktop the
incoming topic opens on its headline card (no diagram), so the old diagram
breaks apart into a clean background.

**Key knob.** `EDGE` (0.28, in `wipe.ts`, shared with the wipe) sets the
width of the soft front.

## Chapter wipe

**What it means.** The transition whenever the chapter changes (hero →
Model, Model → Memory, Memory → Harness, Harness → finale). Same flip rule as
the dissolve, but the threshold is 82% horizontal position plus 18%
**2×2-block** noise, so a ragged pixel front sweeps **left → right**. The
background splits at the front: the new chapter's colour fills in behind it
(left), the old one stays ahead of it (right), instead of the usual colour
blend. Each cell takes the new chapter's halftone mark as it flips.

**Split chrome.** The fixed chrome splits at the same front, so no old-colour
box sits on the new canvas: the top bar's backdrop, the Top button and the
stack trail. `wipeFront(blend)` gives the front's position for both the
canvas and the ticker. The ticker writes `--bg-l` (new chapter, left),
`--bg-r` (old chapter, right) and the front: `--split` (% of the width, for
full-width chrome via `--bg-split`) and `--split-x` / `--split-r` (px from
the left / right edge, so small chrome places it inside its own box;
`background-attachment: fixed` is ignored on iOS and on transformed boxes).
Outside a wipe both colours are the blended `--bg` and the front sits at the
right edge.

**Reference:** the `wipe` branch in
[`PixelField.tsx`](../../../src/engine/PixelField.tsx);
[`wipe.ts`](../../../src/engine/wipe.ts) (`EDGE`, `wipeFront()`); the split
vars in `ticker.ts`; `.topbar::before`, `.totop` and `.trail` in
`global.css`.

## Dust

**What it means.** Sparse, slowly twinkling print speckle across the field
(~0.9% of cells). It keeps empty areas feeling like paper rather than a
void. On desktop it skips the zone where the page text currently sits
(`textZone()` in `PixelField.tsx`), so it never reads as stray punctuation.

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
outlines around a solid blinking core (the model). Only the **finale** draws
them: they collapse inward, outermost first, until only the core is left. The
hero has its own variant: rectangles framing the headline (see **Hero**).

**Reference:** `nestedBoxes()` in
[`scenes/helpers.ts`](../../../src/engine/scenes/helpers.ts); used only by
`unwrap.ts`.

## Color journey

**What it means.** The page background darkens as boxes stack up around the
model:

```
Hero:      paper #F2EFE7
Chapter 1: [GREEN card] → #EEEAE0 → [GREEN scaling] → #E9E5DA        accent green
Chapter 2: [BLUE card]  → #E8E1D1 → #E0D7C3 → #D7CDB7 → #CDC2A8 → [BLUE RAG]   accent blue
Chapter 3: [ORANGE card] → #5A564E → [ORANGE agent] → #4A4740 → #3D3B36 → #302E2A → #1C1A17   accent orange
Finale:    night #0A0A09
```

- **Signature colours** (brackets): each chapter card, plus the chapter's key
  topic (Scaling law, RAG, Agent loop), uses the chapter colour full-bleed.
- **Agent files** (2.4) is Memory's darkest sand, `#CDC2A8`, just before
  RAG; Harness steps straight from Skill to Multi-agent.
- **Ink flips** from dark to light at the Harness chapter. During a blend, the ticker
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

## Back to top

**What it means.** A small pixel-font "Top" button, bottom-right, that
appears once you have scrolled ~80% of a viewport and jumps back to the hero.
Its background splits with a chapter wipe (see **Chapter wipe**), as does
the stack trail's.

**Reference:** `BackToTop` in
[`src/components/Hud.tsx`](../../../src/components/Hud.tsx); `.totop` in
`global.css`.

## Typography

| Role | Face | Notes |
|------|------|-------|
| Display & titles | Archivo (variable width) | titles `font-stretch: 84%`, weight ~680; hero 70% / 800, uppercase |
| Body | Archivo | 15.5–17.5px, `text-wrap: pretty` |
| Labels, code, HUD | JetBrains Mono | uppercase labels with 0.1–0.14em tracking |
| Numerals & pixel labels | Silkscreen | the pixel font — numbers (parameter counter, step and watch numbers, chapter numerals, contents, rail and product numbers), hero stickers, hero chapter chips, chart fork labels, loader readout, Top button, wordmark |

## Pixel font

**What it means.** A 3×5 bitmap font for **labels inside diagrams**
(NOTION, MAIN AGENT, CODEX…), drawn cell-aligned so it stays crisp.
Capitals, digits and a few symbols.

**Reference:** `pixelText()` / `pixelTextWidth()` in
[`scenes/helpers.ts`](../../../src/engine/scenes/helpers.ts).

## Product switcher

**What it means.** In *Agent apps* (3.6), the text column shows one product
at a time (Claude Code → Codex → OpenClaw). It changes in step with the
diagram, whose shell dissolves into the next while the core loop stays put.
Data: `products: [{ at, name, by, where }]`, timed on scene progress like
watch captions; the diagram is the `agents` scene
([`scenes/agents.ts`](../../../src/engine/scenes/agents.ts)).

## Adding a new term

```markdown
## <Term>

**What it means.** <one-paragraph definition>

**Reference:** <file path(s)> — and the key knobs.
```
