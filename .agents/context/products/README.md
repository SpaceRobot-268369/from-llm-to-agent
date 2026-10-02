# From LLM to Agent — Product Docs

> **Index book** for the product docs: what the page says, how it looks, and
> where its facts come from. These are agent-context files under `.agents/`;
> all edits stay approval-gated under Principle 1.

## Contents

| Doc | What it covers |
|-----|----------------|
| [`content-outline.md`](content-outline.md) | **The content design.** Thesis, audience, chapters, and every section's copy, scene, palette, and formula. Source of truth for `src/content/sections.ts`. |
| [`design-language.md`](design-language.md) | Named visual terms (*Pixel Field*, *halftone levels*, *dissolve*, *color journey*, …) with canonical code references and key knobs. |
| [`references.md`](references.md) | Sources for every fact on the page, plus what is explicitly illustrative. |

## The one-sentence product

A single scroll-linked page that unwraps today's AI buzzwords — from the bare
LLM to always-on agents — and shows that each is the same model in one more
box, told in pixels that get darker as the boxes stack up.

## Maintenance

When a section is added, removed, or reordered, update
[`content-outline.md`](content-outline.md) first, then
`src/content/sections.ts`, then any new facts in
[`references.md`](references.md) — in the same approved change. Use the
[`add-concept-section`](../../skills/add-concept-section/SKILL.md) skill.
