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
   [`content-outline.md`](../../context/products/content-outline.md). Pick
   its chapter (Model · Memory · Harness — every topic belongs to exactly
   one), which earlier section this concept wraps, and which later section
   depends on it. The concept may only use ideas introduced above it. If it
   brings two new ideas, propose splitting it.
2. **Draft the section spec** in the outline's format: a
   `### <chapter>.<topic> · <id> (read)` heading (`(read → **watch**)` for
   a watch section), its row in *Structure at a glance* and its entry in
   the chapter card's contents line (the outline lists it by hand), then scene
   description, **analogy** (everyday words, no jargon), title, body,
   optional code, steps or note, and formula. Also settle the kicker (the
   bare concept name — no number) and a short HUD label. Add **watch
   captions** only if the animation *is* the explanation (watch acts are
   rare — see the outline's content rules): a few plain-words steps (RAG
   uses 5) describing what the animation shows, in order, at least ~0.12
   scene progress apart. Without captions the section is headline → read
   and uses the shorter `READ` length. Formula pattern: `<New thing> =
   <old box> + <one new idea>`.
3. **Pick the palette** from the chapter's colour family in the
   [color journey](../../context/products/design-language.md#color-journey).
   It must be darker than the topic above and lighter than the one below
   (chapter cards and signature-colour highlights excepted). Check
   body-text contrast is ≥ 4.5:1.
4. **Source every fact.** Add new claims to
   [`references.md`](../../context/products/references.md) (internal only —
   the page shows no reference list). Run the
   [`fact-check`](../fact-check/SKILL.md) skill on the new copy.
5. **Approval gate (agent files).** Present the outline diff and any
   `references.md` diff. **Do not write them until the user approves.**
6. **Implement.**
   - Add the entry to `src/content/sections.ts` (copy verbatim from the
     outline), inside its chapter's block. Fields (see the `Section` type):
     - required: `id` (the DOM anchor), `kind: 'concept'`, `label` (HUD,
       progress rail and chapter-card contents), `scene`, `palette`
       (`bg` / `ink` / `px` / `accent`), `length` (desktop height in vh:
       `READ` or `WATCH`; `agent-apps` sets its own), `kicker`, `title`;
     - every topic: `chapter` (1 | 2 | 3) — it groups the topic, gives it
       the chapter's halftone mark, and decides wipe vs dissolve;
     - `wrap` only if the section adds a new box to the stack trail
       (`thinking` adds none; `scaling-law` repeats `LLM`, shown once);
     - optional: `highlight`, `analogy`, `lede`, `body`, `steps`, `code`,
       `note`, `formula`, `watch`, `products`, `demo`.
   - Never set `num` or `art`: the loop after `SECTIONS` numbers topics
     `chapter.topic` and alternates the diagram side (right, left, …),
     restarting at each chapter card. The chapter card's contents list
     (`topicsOf`) picks the new topic up by itself.
   - Optionally add a hero sticker to `HERO_WORDS` (`to` = the new id). The
     list is in priority order: stickers that find no room on a small screen
     are left out, lowest priority first.
   - Create `src/engine/scenes/<scene>.ts` following the `Scene` contract in
     [`scenes/types.ts`](../../../src/engine/scenes/types.ts) and the
     design language's *Scene* section. p = 0 must be a complete
     composition: no diagram shows behind the headline card, so p = 0 is the
     frame the diagram fades in on (and, in watch sections, holds through
     the read act); read sections play the story while you read. The
     optional hooks are rarely needed (`unclipped` is used only by
     `scaling`; no scene sets `cell`). Add the id to the `SceneId` union in
     `types.ts`, then register it in `src/engine/scenes/index.ts`.
   - Time the `watch` captions (`at` = scene progress 0..1) to the scene's
     beats: render `window.__scene('<scene>', { p, focus: 1 })` at each `at`
     and check the caption matches what is on screen.
   - If the order changed, the code renumbers itself; renumber the docs by
     hand: in `content-outline.md` the `### N.N` headings, the chapter
     cards' contents lines, the *Structure at a glance* table and in-text
     numbers (e.g. the hero's "MCP → 3.3"); in `references.md` every §
     number (table and illustrative list). Check the finale ladder
     (`FINALE.ladder`) still summarises the three chapters.
7. **Verify.**
   - `npm run typecheck` and `npm run build` pass.
   - The read-act copy fits 1280×720 without overflow; the mobile layout
     reads at 390×844.
   - The acts work: centred headline card with no diagram behind it → text
     beside the diagram (on the alternating side), plus — only if the
     section has `watch` captions — the diagram centred with captions, each
     caption readable for a real stretch of scroll.
   - The chapter card lists the topic with its number and jumps to it.
   - The scene morphs cleanly in and out of its neighbours — a blocky
     dissolve inside a chapter, a left → right wipe at a chapter boundary —
     with no blank frames.
   - With `prefers-reduced-motion`, the page still reads and the scene is
     static.
   - Capture screenshots with [`capture-ui`](../capture-ui/SKILL.md).

## Failure handling

Stop and report if the concept cannot be placed without breaking build order,
if a fact has no reliable source, or if verification fails (include the
error or the screenshot that shows the problem).
