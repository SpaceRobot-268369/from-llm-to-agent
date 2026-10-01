---
name: fact-check
description: Audit the page copy for unsourced or outdated claims — numbers, dates, attributions, product facts — against references.md and primary sources. Use before publishing, after editing copy, or when the user asks whether something on the page is accurate.
---

# Skill: fact-check

Make sure every factual claim on the page traces to a source and is still
true.

This is a **judgment-driven skill**: the agent decides what counts as a claim
and how strong a source must be. It never silently rewrites copy. Fixes are
proposed, and copy changes follow the approval rules in `AGENTS.md`.

## Prerequisites

> Requires read access to `src/content/` and
> [`references.md`](../../context/products/references.md). Live re-verification
> also needs web access; if it's unavailable, say so and audit only against
> `references.md`.

## Steps

1. **Extract claims** from `src/content/sections.ts` (and any copy in
   components): every number, date, version, size, "first/only/most",
   attribution ("Anthropic, 2024"), and product behaviour ("every 30
   minutes").
2. **Match each claim** to a row in `references.md`. Classify it:
   - ✅ sourced and consistent;
   - ⚠️ sourced, but the copy says more than the source supports;
   - ❌ unsourced;
   - 🕒 time-sensitive (product facts, "today", "now") — re-verify against a
     primary source when web access exists.
3. **Check labels.** Illustrative numbers must be labeled *illustrative* on
   the page and listed under "Illustrative" in `references.md`.
4. **Check the rules** in
   [`content-outline.md`](../../context/products/content-outline.md#content-rules),
   especially that the scaling-law plateau question stays unanswered.
5. **Report** a table — claim · location · status · source · proposed fix.
   Prefer primary sources (papers, official docs) over blog posts.

## Output

The report only. Applying fixes is a separate, approved step: copy changes go
through [`add-concept-section`](../add-concept-section/SKILL.md) when they
alter the outline.
