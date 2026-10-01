---
name: called-out-dev-panel
description: Scaffold a local-development-only control panel for live-tuning Pixel Field, scene, or palette parameters. Use when the developer asks for sliders, controls, or a called-out dev panel to tune something in the running page.
---

# Skill: called-out-dev-panel

Scaffold a **dev-only control panel** that lets the developer live-tune
parameters — cell size, halftone levels, dissolve width, scene timings,
palette colors — in the running page. No code→save→reload round-trip.

This is a **skill**: the agent decides which parameters are worth exposing,
which control type fits each, and where to dock the panel.

## Prerequisites

> Requires Node/npm with `node_modules/` installed and a runnable dev server.
> If unmet, tell the developer what's missing, point to
> [`../../context/dev-spec/prerequisites.md`](../../context/dev-spec/prerequisites.md),
> and stop.

## Mechanism (in-house, no new dependency)

- A reusable **`DevPanel`** component in `src/components/dev/DevPanel.tsx`.
  Create it once and reuse it.
- **Gated with `import.meta.env.DEV`** so production builds tree-shake it out.
  Never import its state on a production path.
- Parameters come from a typed config: `label`, `type` (`slider` | `number` |
  `color` | `toggle` | `select`), `min`/`max`/`step`, `default`.
- **Feed values through the ticker, not React state.** The Pixel Field reads
  live values each frame from a mutable `devParams` object, so tuning causes
  no re-renders.
- Optional `localStorage` persistence for long sessions. Clear it when the
  values are finalized.

### Placement — never cover what it tunes

- Fixed, **collapsible** dock. Collapsed, it shows only a small handle.
- Docks on the side **opposite the art box**. The art alternates sides per
  section (`section.art`) and centres in watch acts, so expose
  `side: 'left' | 'right' | 'auto'` and let `'auto'` dock opposite the
  current section's `art` each frame, collapsing to a corner handle while a
  watch act has the diagram centred.

## Steps

1. **Identify** the target and the smallest useful parameter set. Ask if the
   intent is unclear.
2. **Scaffold or reuse** `DevPanel`; keep it `import.meta.env.DEV`-gated.
3. **Wire** each parameter to a control with a sane default and range.
4. **Verify live**: change a control and confirm the canvas updates; confirm
   the panel and art box don't overlap; confirm the panel is absent in
   `npm run build` output (search `dist/` for its label).
5. **Bake back**: once values settle, write them as real defaults (for example
   in `halftone.ts` or the section palette), then remove the binding. Never
   ship a `DevPanel` wired to production code.
