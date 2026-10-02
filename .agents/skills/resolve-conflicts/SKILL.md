---
name: resolve-conflicts
description: Diagnose, group, resolve, and verify Git conflicts from merges, rebases, cherry-picks, or stash operations without committing. Use when an operation hits conflicts or the user asks to resolve or fix a merge conflict.
---

# Skill: resolve-conflicts

Turn a wall of conflict markers into a **grouped, reasoned report**, then
resolve safely. The flow is always: diagnose → report → resolve → verify →
hand back.

This skill resolves and stages conflicts. Continuing a merge, rebase, or
cherry-pick may create commits, so that step needs its own explicit approval.
It never pushes.

## Prerequisites

> Requires an in-flight git operation with conflicts, and Node/npm for the
> sanity checks. If unmet, tell the developer and guide setup via
> [`../../context/dev-spec/prerequisites.md`](../../context/dev-spec/prerequisites.md).

## Hard guardrails

- **Report before touching anything.**
- **Default side = `main`** for non-trivial conflicts the developer hasn't
  weighed in on — but surface the choice and ask first.
- **Never** resolve a whole file with `--ours`/`--theirs` without
  understanding both sides.
- **Never** `--abort` without explicit confirmation. Never `--no-verify`,
  never `--force`.
- **Agent files** (`AGENTS.md`, `CLAUDE.md`, `.agents/**`,
  `.claude/launch.json`) are always complex and need approval (Principle 1).
  Keep the union of real entries (skills, principles, sections).
- **Ours/theirs swap during rebase/cherry-pick.** Confirm the direction first.

## Pipeline

1. **Detect context:** `git status`; which operation is in flight; which side
   is "ours".
2. **Inventory:** `git diff --name-only --diff-filter=U` and the conflict
   types.
3. **Diagnose** each file: what each side intended, the cost of keeping
   `main`, and the cost of keeping the branch. Project special cases:
   - `src/content/sections.ts` — section order must match
     `content-outline.md`. Merge both sides' sections in build order; the
     code numbers topics itself, so renumber only the outline and
     `references.md` by hand.
   - `src/engine/scenes/index.ts` — registry: keep the union.
   - `package-lock.json` — don't hand-merge. Take `main`'s version, then run
     `npm install`.
4. **Group** files that conflict for the same reason; tag each group
   *trivial* or *complex*.
5. **Present** a table: group · files · conflicting changes · if keep main ·
   if keep branch · recommendation · class.
6. **Resolve:** auto-apply trivial groups; apply complex groups only as
   confirmed.
7. **Verify:** `git diff --check`; no conflict markers left; then
   `npm run typecheck && npm run build`.
8. **Stage and stop.** Show the staged paths, the check results, and the exact
   continuation command (`git merge --continue` / `git rebase --continue` /
   `git cherry-pick --continue`). Run it only after explicit approval, then
   report the resulting commit hashes.
