---
name: capture-ui
description: Capture screenshots of affected sections of the page at desktop and mobile sizes for review or visual verification. Use after changing the page or when the user asks to see the current UI.
---

# Skill: capture-ui

Capture screenshots of the page at the scroll positions affected by a change,
for review or visual verification.

This is a **skill**: the agent decides which sections and scroll positions
show the change best.

## When to use

- After changing `src/`, `index.html`, or styles, before the change is
  committed (see [`git-workflow.md`](../../context/dev-spec/git-workflow.md)).
- Or directly, when the user wants screenshots of the current UI.

## Prerequisites

> Requires Node/npm with `node_modules/` installed and browser/preview tooling
> for screenshots. If unmet, tell the developer and guide setup via
> [`../../context/dev-spec/prerequisites.md`](../../context/dev-spec/prerequisites.md),
> then stop.

## Steps

1. **Identify affected sections.** Use the changed files: a scene file maps to
   its section; `sections.ts` diffs name the section ids; engine or style
   changes affect everything (take the standard set below).
2. **Run the page** via [`start-local-dev`](../start-local-dev/SKILL.md).
3. **Scroll and capture.** In dev, position with
   `window.__goto('<section-id>', p)` (p = 0..1 through the section), wait
   ~800 ms, then capture. If the preview pane is hidden, use the manual
   driver below instead. Standard set (timings: `PHASES` in
   [`phases.ts`](../../../src/engine/phases.ts), `SCALING.phases` in
   [`sections.ts`](../../../src/content/sections.ts)):
   - **hero** `hero`: p = 0 once the loader has gone
     (`<html data-intro="done">`) and the stickers have burst out (~1.6 s
     later); p≈0.3 shows them being pulled back in.
   - **chapter card** `part-model` / `part-memory` / `part-harness`: p≈0.3
     (it holds until 0.7). For the chapter wipe, scroll to the end of the
     section before it plus half a viewport.
   - **read section**, e.g. `next-token` or `agent-files`: headline p≈0.04,
     read p≈0.45 (copy fully revealed, story mid-play), story played p≈0.9.
   - **watch section** `chat` / `rag` / `agent` / `mcp`: headline p≈0.04,
     read p≈0.42 (copy fully revealed; it leaves at 0.44), watch p≈0.65 and
     p≈0.88. Chat's read act loops on time (the forgetful new-session
     loop), so that frame depends on the clock.
   - **scaling stage** `scaling-law`: p≈0.35 (growth), 0.75 (the plateau
     question), 0.9 (chart zoomed to the centre).
   - **agent apps** `agent-apps`: one per shell — p≈0.35 Claude Code, 0.55
     Codex, 0.78 OpenClaw.
   - **finale** `unwrap`: read p≈0.42 (the ladder), watch p≈0.65 and 0.88;
     the credits sit at the very bottom of the page.

   Viewports: desktop 1440×900 and 1280×720; mobile 390×844. The mobile
   layout applies at `(max-width: 900px), (max-height: 640px)`: copy flows,
   the art stays in a top band, and watch scenes play as their steps list
   scrolls by. If the emulated viewport is larger than the preview pane,
   screenshots can look scaled into a corner — confirm geometry with
   `getBoundingClientRect` before calling it a bug.
4. **Save** images to `./.screenshots/` (git-ignored — never commit
   screenshots).
5. **Return** the list of image paths with a one-line caption each.

## Hidden preview pane

A hidden pane pauses `requestAnimationFrame` and `ResizeObserver`. The
ticker stops: the loader never finishes, `--p` stops updating, and
`__goto`'s plain `window.scrollTo` is not seen by Lenis. Drive frames and
scroll by hand through `window.__ticker` (its `tick` and `lenis` are
TypeScript-private but reachable from the page):

```js
const T = window.__ticker;
let now = Math.max(window.__now ?? 0, performance.now()); // keep increasing
const frames = (n) => {
  for (let i = 0; i < n; i++) T.tick((now += 16));
  window.__now = now;
};
const go = (id, p) => { // same target as __goto
  const el = document.getElementById(id);
  const top = el.getBoundingClientRect().top + scrollY;
  const y = top + Math.max(0, el.offsetHeight - innerHeight) * p;
  if (T.lenis) T.lenis.scrollTo(y, { immediate: true, force: true });
  else scrollTo(0, y); // reduced motion: no Lenis
  frames(2);
};
frames(200); // ~3 s of frames: loader done, stickers burst out
go('rag', 0.65);
```

Screenshots of a hidden pane can be stale. Check numbers instead: the
section's `--p` (`el.style.getPropertyValue('--p')`), element
`getBoundingClientRect()`s, `document.documentElement.dataset.intro`.
Resizing the viewport while hidden does not reach the `ResizeObserver`s
(canvas size, hero scatter), so reload at the new size first. Show the pane
for the final screenshots when possible.

## Failure handling

Report the reason if capture fails: dev server didn't start, section id not
found, or no browser tooling. Do not invent screenshots.
