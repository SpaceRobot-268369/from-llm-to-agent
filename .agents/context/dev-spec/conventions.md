# Conventions & Architecture

The project's architecture and conventions in one human- and agent-readable
reference.

---

## Stack

- **React 19 + TypeScript**, built with **Vite**. One page, no router.
- **Lenis** for smooth scrolling. No other runtime dependencies. There is no
  animation library: every scroll-linked effect runs in our own single
  `requestAnimationFrame` ticker.
- Fonts via Google Fonts in `index.html`: **Archivo** (variable width, for
  display and body), **JetBrains Mono** (code and labels), **Silkscreen**
  (pixel numerals).

## Architecture

```
.
├── index.html                # fonts, root element
├── vite.config.ts
├── src/
│   ├── main.tsx              # React bootstrap
│   ├── App.tsx               # page composition: PixelField + HUD + sections
│   ├── content/
│   │   └── sections.ts       # ALL page copy, analogies, watch captions, palettes, scene ids
│   ├── engine/
│   │   ├── ticker.ts         # the one rAF loop: Lenis, section geometry, progress, palette vars
│   │   ├── phases.ts         # 3-act timing (headline → read → watch), shared with CSS via --ph-* vars
│   │   ├── layout.ts         # cell sizes, grid geometry, art box (side ↔ focus)
│   │   ├── color.ts          # hex/mix/contrast helpers
│   │   ├── noise.ts          # hash + value noise + fbm + easing
│   │   ├── raster.ts         # grid-resolution buffer (ink + accent channels)
│   │   ├── halftone.ts       # buffer → quantized halftone squares on the canvas
│   │   ├── PixelField.tsx    # fixed full-screen canvas; blends scenes by scroll
│   │   ├── debug.ts          # DEV ONLY: window.__scene / __sceneBench / __goto
│   │   └── scenes/           # types.ts, helpers.ts, one file per scene, index.ts registry
│   ├── components/
│   │   ├── Section.tsx       # hero + concept section; HeadlineCard + Watch (shared)
│   │   ├── ScalingSection.tsx# sticky stage: milestones, counters, chart, plateau question
│   │   ├── Finale.tsx        # unwrap ladder, three-questions watch act, credit line
│   │   ├── Hud.tsx           # TopBar, ProgressRail, StackTrail
│   │   └── CodeBlock.tsx, Formula.tsx, TokenDemo.tsx
│   └── styles/
│       └── global.css        # tokens, layout, reveal rules, responsive rules
└── .agents/                  # agent knowledge base (see AGENTS.md)
```

### Data flow (one frame)

1. `ticker.ts` advances Lenis, reads the scroll position, and computes:
   - the current section `cur`, its local progress `p` (0→1 across its
     sticky phase), and `blend` (0→1 as the next section slides in);
   - the global progress.
2. It writes `--p` on every section element near the viewport (CSS reveals
   read it), and the blended palette (`--bg`, `--ink`, `--px`, `--accent`) on
   `:root`.
3. `PixelField` paints scene `cur` (and scene `next` while blending) into
   grid-resolution rasters, dissolves them together, and draws halftone
   squares.
4. HUD components update text through refs. **No React state changes per
   frame.**

## Conventions & gotchas

- **Copy lives only in `src/content/sections.ts`.** Components never hardcode
  user-facing text — section copy, captions, scaling labels, and the small
  interface labels (`UI`: "In plain words", "Scroll", aria labels) all live
  there. The file must match
  [`content-outline.md`](../products/content-outline.md).
- **Scenes are pure painters.** A scene receives `{ r, box, p, t, cell }` and
  paints into the raster. It holds no DOM refs and no React state. Normalize
  every coordinate to `box`, so it works at any grid size. See
  [`design-language.md`](../products/design-language.md#scene).
- **Ink vs. accent channels.** Paint ordinary pixels with `INK(a)` and
  highlighted pixels with `ACC(a)`. Never hardcode a color in a scene; colors
  come from the section palette.
- **One ticker.** Never add another `requestAnimationFrame` loop or scroll
  listener. Subscribe to `ticker.onFrame` instead.
- **Palettes follow the color journey.** Backgrounds darken monotonically,
  except for the named highlight sections. Body-text contrast must be **≥ 4.5:1**
  against its own section background. The ticker picks whichever section ink
  contrasts more during a blend.
- **Reduced motion.** With `prefers-reduced-motion: reduce`: Lenis off, scene
  time frozen, reveals shown immediately. Keep that path working.
- **Responsive.** Below 900px wide, or under 640px tall, sections stop being
  sticky (except the scaling stage, which keeps its sticky stage). The art
  stays in the top band (no focus glide); copy and headline cards scroll over
  solid panels. Watch steps flow as a list below a clear window, and the
  ticker drives those scenes from the list's position (`mobileScene`).
- **Desktop fit.** Each concept's read-act copy must fit 1280×720. Trim the
  copy before shrinking the type.
- **Phase timing has one source.** Act timings live in
  `src/engine/phases.ts` (`PHASES`), and the scaling stage's beats in
  `SCALING.phases` (`sections.ts`). `writePhaseVars()` writes both to `:root`
  (`--ph-<mode>-<phase>-a/b`, `--ph-scaling-<beat>`) at module load; CSS reads
  only those variables. Never hardcode a duplicate number in CSS.
- **Canvas is decorative.** It is `aria-hidden`, and all meaning is in the DOM
  text. Headings are semantic (`h1` hero, `h2` per section).
- **Performance budget.** The Pixel Field should paint in < 6 ms per frame on
  a 2020 laptop at 1440×900; each scene's paint ≤ 1.5 ms. Measure with
  `window.__sceneBench(id, { p })` (dev only) before adding per-cell work.
  Bake expensive noise into lookup textures, as `scenes/scaling.ts` does.
- **Debug hooks are dev-only.** `src/engine/debug.ts` is loaded through a
  dynamic import behind `import.meta.env.DEV`, so it never ships.

## Commands

Reuse a dev server already running on port 5173; never start a second one.

| Task | Command |
|------|---------|
| Install | `npm install` |
| Dev server | `npm run dev` (port 5173) |
| Type check | `npm run typecheck` |
| Production build | `npm run build` |
| Preview build | `npm run preview` |
