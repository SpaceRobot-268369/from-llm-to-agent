---
name: capture-ui
description: Capture screenshots of affected sections of the page at desktop and mobile sizes for review or visual verification. Use when a PR touches the page or the user asks to see the current UI.
---

# Skill: capture-ui

Capture screenshots of the page at the scroll positions affected by a change,
for PR reviews or visual verification.

This is a **skill**: the agent decides which sections and scroll positions
show the change best.

## When to use

- Invoked by the `draft-pr` skill when a PR touches `src/`, `index.html`, or
  styles.
- Or directly, when the user wants screenshots of the current UI.

## Prerequisites

> Requires Node/npm with `node_modules/` installed and browser/preview tooling
> for screenshots. If unmet, tell the developer and guide setup via
> [`../../context/dev-spec/prerequisites.md`](../../context/dev-spec/prerequisites.md),
> then stop.

## Steps

1. **Identify affected sections.** Use the changed files: a scene file maps to
   its section; `sections.ts` diffs name the section ids; engine or style
   changes affect everything (sample hero, scaling law, one mid section, and
   the finale).
2. **Run the page** via [`start-local-dev`](../start-local-dev/SKILL.md).
3. **Scroll and capture.** In dev, position with
   `window.__goto('<section-id>', p)` (p = 0..1 through the section), wait
   ~800 ms, then capture. Points per section (see
   [`phases.ts`](../../../src/engine/phases.ts)):
   - every section: **headline** p≈0.04 and **read** p≈0.3 (read-only
     sections: also p≈0.7, where their story has played);
   - sections with `watch` captions (chat, RAG, agent, MCP, finale):
     **watch** p≈0.65 and p≈0.88;
   - scaling law: p≈0.2, 0.5, and 0.92 (the plateau question).
   Viewports: desktop 1440×900 and 1280×720; mobile 390×844 (the flowing
   layout). If the emulated viewport is larger than the preview pane,
   screenshots can look scaled into a corner — confirm geometry with
   `getBoundingClientRect` before calling it a bug.
4. **Save** images to `./.pr-screenshots/` (git-ignored — never commit
   screenshots).
5. **Return** the list of image paths with a one-line caption each.

## Embedding in a PR

`gh pr create` cannot upload local images. Ask the user to drag the images
into the PR description, or reference already-hosted URLs. Never block the PR
on screenshots; list the local paths if hosting isn't possible.

## Failure handling

Report the reason if capture fails: dev server didn't start, section id not
found, or no browser tooling. Do not invent screenshots.
