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
├── vite.config.ts, tsconfig.json
├── Dockerfile                # node:22 build stage → nginx-unprivileged serving dist/ on :8080
├── compose.yaml              # docker compose up -d --build
├── docker/                   # nginx.conf (caching, gzip, /healthz) + security-headers.conf
├── public/                   # favicon.svg
├── src/
│   ├── main.tsx              # React bootstrap
│   ├── App.tsx               # page composition: PixelField + HUD + sections + Loader
│   ├── content/
│   │   └── sections.ts       # ALL page copy, chapters, palettes, scene ids; numbers topics (2.3)
│   ├── engine/
│   │   ├── ticker.ts         # the one rAF loop: Lenis, section geometry, progress, palette + wipe-split vars
│   │   ├── phases.ts         # modes (part / read / watch / scaling), placement(); --ph-* vars for CSS
│   │   ├── layout.ts         # cell sizes, grid, art box (side ↔ focus, hero centre), heroHole + HERO_RINGS, chartHole (scaling mini chart)
│   │   ├── intro.ts          # loader → hero hand-off: intro.at, sticker BURST timing
│   │   ├── color.ts          # hex/mix/contrast helpers; VIVID (fixed palette for the col tag)
│   │   ├── noise.ts          # hash + value noise + fbm + easing
│   │   ├── raster.ts         # grid-resolution buffer (ink + accent channels, vivid colour tag col)
│   │   ├── halftone.ts       # buffer → halftone marks (square / dash / cross per chapter) in ink / accent / vivid
│   │   ├── PixelField.tsx    # fixed full-screen canvas; topic dissolve, chapter wipe
│   │   ├── wipe.ts           # EDGE, wipeFront(): the wipe front, shared by the canvas and the split chrome
│   │   ├── debug.ts          # DEV ONLY: window.__scene / __sceneBench / __goto / __ticker / __pop*
│   │   ├── pops/             # click pops: live.ts (input, routing, deck, fit, boop, combo), hit.ts (empty-space test),
│   │   │                     # helpers / types / buffer, ascii.ts (dev only), one file per pop
│   │   └── scenes/
│   │       ├── types.ts      # Scene contract, SceneId
│   │       ├── helpers.ts    # shared drawing helpers (INK / ACC, shapes, pixel text)
│   │       ├── index.ts      # SCENES registry
│   │       ├── part.ts       # intentionally empty: chapter cards show no diagram
│   │       └── one file per scene: hero, tokens, scaling, thinking, chat, system, window,
│   │           agentfiles, rag, tools, agent, mcp, skill, subagents, agents, unwrap
│   ├── components/
│   │   ├── Hero.tsx          # centred headline + chapter chips, ring fit, stickers (burst, pull-in, jump)
│   │   ├── ChapterCard.tsx   # full-screen chapter opener: numeral, name, thesis, contents list
│   │   ├── Section.tsx       # topic section; HeadlineCard, Watch, product switcher
│   │   ├── ScalingSection.tsx# sticky stage: milestones, counters, chart, plateau question
│   │   ├── Finale.tsx        # unwrap ladder, three-questions watch act, credit line
│   │   ├── Hud.tsx           # TopBar, ProgressRail, StackTrail, BackToTop
│   │   ├── Loader.tsx        # pixel-cell loading screen; sets intro.at when done
│   │   └── CodeBlock.tsx, Formula.tsx, TokenDemo.tsx
│   └── styles/
│       └── global.css        # tokens, layout, reveal rules, responsive rules
└── .agents/                  # agent knowledge base (see AGENTS.md)
```

### Data flow (one frame)

1. `ticker.ts` advances Lenis, reads the scroll position, and computes:
   - the current section `cur`, its local progress `p` (0→1 across its
     sticky phase), and `blend` (0→1 as the next section slides in);
   - the global progress;
   - on mobile, `mobileScene`: scene progress from where a watch steps list
     (or 1.1's token demo) sits on screen.
2. It writes `--p` on each section element whose progress changed (CSS
   reveals read it), `--leave` (the blend) on the current section, and on
   `:root` the blended palette (`--bg`, `--ink`, `--px`, `--accent`) plus the
   wipe split for fixed chrome (`--bg-l`, `--bg-r`, `--split`, `--split-x`,
   `--split-r`, from `wipeFront()` in `wipe.ts`).
3. `PixelField` paints scene `cur` (and scene `next` while blending) into
   grid-resolution rasters, clips each to its art box, blends them (a blocky
   dissolve between topics, a left → right wipe between chapters), and draws
   halftone marks in the chapter's shape (squares / dashes / crosses), in
   the ink, accent or tagged vivid colour. Live click pops (`pops/live.ts`)
   are painted into a PopBuffer and layered on top before the halftone pass.
4. HUD components update text through refs. **No React state changes per
   frame.**

## Conventions & gotchas

- **Copy lives only in `src/content/sections.ts`.** Components never hardcode
  user-facing text — section copy, captions, scaling labels, and the small
  interface labels (`UI`: "In plain words", "Scroll", aria labels) all live
  there. The file must match
  [`content-outline.md`](../products/content-outline.md).
- **Scenes are pure painters.** A scene receives
  `{ r, box, full, p, t, cell, mobile }` and paints into the raster. It holds
  no DOM refs and no React state. Normalize every coordinate to `box`, so it
  works at any grid size. See
  [`design-language.md`](../products/design-language.md#scene).
- **Ink vs. accent channels.** Paint ordinary pixels with `INK(a)` and
  highlighted pixels with `ACC(a)`. Never hardcode a color in a scene; colors
  come from the section palette. The one exception is a slot of the fixed
  `VIVID` palette, tagged through `Raster.col`, where colour itself is the
  meaning (the scaling brain; see
  [`design-language.md`](../products/design-language.md#ink--accent-channels)).
- **One ticker.** Never add another `requestAnimationFrame` loop or scroll
  listener. Subscribe to `ticker.onFrame` instead.
- **Palettes follow the color journey.** Backgrounds darken monotonically,
  except for the named highlight sections. Body-text contrast must be **≥ 4.5:1**
  against its own section background. The ticker picks whichever section ink
  contrasts more during a blend.
- **Reduced motion.** With `prefers-reduced-motion: reduce`: Lenis off, scene
  time frozen, reveals shown immediately. Keep that path working.
- **Responsive.** Below 900px wide, or under 640px tall, sections stop being
  sticky (except the hero and the scaling stage, which keep their sticky
  stages). The art stays in the top band (no focus glide; the hero keeps its
  centred frame); copy and headline cards scroll over solid panels. Watch
  steps flow as a list below a clear window, and the ticker drives those
  scenes from the list's position (`mobileScene`); 1.1's scene and token demo
  are driven the same way from the demo's position. The other read scenes
  loop in time (`MOBILE_LOOP` in `phases.ts`), because the copy covers the
  art band early. The top bar keeps a solid band behind its labels and a
  matching band rises behind the stack trail and Top button, so flowing copy
  never runs under HUD text; panels split at a chapter wipe's front like the
  HUD.
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
  Each pop's paint ≤ 0.05 ms (`__popBench`); a click's fit search shares its
  DOM probes through one per-click `Page` snapshot.
- **Debug hooks are dev-only.** `src/engine/debug.ts` is loaded through a
  dynamic import behind `import.meta.env.DEV`, so it never ships. It installs
  `window.__scene(id, { p, t, mobile, W, H, focus, side })` (ASCII render;
  vivid-tagged cells show as `1`–`5` / `a`–`e`), `__sceneBench`,
  `__goto(id, progress)`, `__ticker` (the ticker itself), and for the click
  pops `__pop`, `__popBench`, `__popCells`, `__popAudit`, `__popSpawn`,
  `__popClick` and `__pops`. A hidden preview
  pane pauses rAF and `ResizeObserver`, so drive frames by hand with
  `__ticker.tick(now)`, `now` growing ~16 ms per call, and move the scroll
  with `__ticker.lenis.scrollTo(y, { immediate: true, force: true })`: the ticker
  reads Lenis's position, and `window.scrollTo` (which `__goto` uses) is not
  seen while the pane is hidden. Under reduced motion there is no Lenis
  (`lenis` is `null`), so plain `window.scrollTo` works. Full recipe:
  [`capture-ui`](../../skills/capture-ui/SKILL.md#hidden-preview-pane).

## Commands

Reuse a dev server already running on port 5173; never start a second one.

| Task | Command |
|------|---------|
| Install | `npm install` |
| Dev server | `npm run dev` (port 5173) |
| Type check | `npm run typecheck` |
| Production build | `npm run build` |
| Preview build | `npm run preview` |
