---
name: add-concept-section
description: Add, split, reorder, or rewrite a concept section of the page end-to-end — content outline, section data, Pixel Field scene, palette, and sources. Use when the user wants to explain a new AI concept or change an existing section.
---

# Skill: add-concept-section

Add or change one concept on the page while keeping the story, code, visuals,
and sources in sync.

This is a **judgment-driven skill**: the agent decides where the concept sits
in the build order, what the one new idea is, what the scene draws, and which
palette it takes. It operates within the Principles in `AGENTS.md`. The
content outline is an agent file, so the outline change needs **explicit
approval before it is written** (Principle 1).

## Prerequisites

> Requires Node/npm with `node_modules/` installed, so the result can be
> verified. If unmet, tell the developer and guide setup via
> [`../../context/dev-spec/prerequisites.md`](../../context/dev-spec/prerequisites.md),
> then stop.

## Steps

1. **Place it in build order.** Read
   [`content-outline.md`](../../context/products/content-outline.md). Decide
   which earlier section this concept wraps and which later section depends on
   it. The concept may only use ideas introduced above it. If it brings two
   new ideas, propose splitting it.
2. **Draft the section spec** in the outline's format: id, palette (bg/ink),
   scene description, kicker, title, **analogy** (everyday words, no jargon),
   body, optional code or steps, and formula. Add **watch captions** only if
   the animation *is* the explanation (watch acts are rare — see the
   outline's content rules): a few plain-words steps (RAG uses 5) describing
   what the animation shows, in order, at least ~0.12 scene progress apart.
   Without captions the section is headline → read and uses the shorter
   `READ` length. Formula pattern: `<New thing> = <old box> + <one new
   idea>`.
3. **Pick the palette** from the color journey in
   [`design-language.md`](../../context/products/design-language.md#color-journey).
   It must be darker than the section above and lighter than the one below,
   unless this is a named highlight. Check body-text contrast is ≥ 4.5:1.
4. **Source every fact.** Add new claims to
   [`references.md`](../../context/products/references.md) (internal only —
   the page shows no reference list). Run the
   [`fact-check`](../fact-check/SKILL.md) skill on the new copy.
5. **Approval gate (agent files).** Present the outline diff and any
   `references.md` diff. **Do not write them until the user approves.**
6. **Implement.**
   - Add the entry to `src/content/sections.ts` (copy verbatim from the
     outline).
   - Create `src/engine/scenes/<scene>.ts` following the *Scene* contract in
     the design language. Add the id to the `SceneId` union in
     `src/engine/scenes/types.ts`, then register it in
     `src/engine/scenes/index.ts`.
   - Time the `watch` captions (`at` = scene progress 0..1) to the scene's
     beats: render `window.__scene(id, { p, focus: 1 })` at each `at` and
     check the caption matches what is on screen.
   - If the order changed, renumber: kickers (`NN · …`), OpenClaw's
     `unwrap[].ref` values, the § headings and structure table in
     `content-outline.md`, and the § column in `references.md`. Check the
     finale ladder still summarises the three parts.
7. **Verify.**
   - `npm run typecheck` and `npm run build` pass.
   - The read-act copy fits 1280×720 without overflow; the mobile layout
     reads at 390×844.
   - The acts work: centred headline card → text beside the diagram (on the
     alternating side), plus — only if the section has `watch` captions — the
     diagram centred with captions, each caption readable for a real stretch
     of scroll.
   - The scene morphs cleanly in and out of its neighbours (no blank frames).
   - With `prefers-reduced-motion`, the page still reads and the scene is
     static.
   - Capture screenshots with [`capture-ui`](../capture-ui/SKILL.md).

## Failure handling

Stop and report if the concept cannot be placed without breaking build order,
if a fact has no reliable source, or if verification fails (include the
error or the screenshot that shows the problem).
