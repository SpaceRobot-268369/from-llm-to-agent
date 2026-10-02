---
name: commit
description: Inspect, stage, and commit the current Git changes with a Conventional Commits message after explicit user approval. Use when the user asks to commit the current work; never push as part of this skill.
---

# Skill: commit

Create a git commit for the current changes, with a message the agent composes
from the actual diff.

This is a **skill**: the agent decides how to group changes and word the
message. It operates within the Principles in `AGENTS.md`. It **never commits
without explicit user approval** (Principle 5), never uses `--force` or
rewrites history, and never pushes. Pushing is a separate, explicitly approved
action.

## Prerequisites

> Requires a git repo with changes to commit. If unmet (not a repo, or nothing
> to commit), tell the developer and guide setup via
> [`../../context/dev-spec/prerequisites.md`](../../context/dev-spec/prerequisites.md),
> then stop.

> Commits go directly on `main` (Principle 6). If HEAD is detached or another
> branch is checked out (`git branch --show-current` is not `main`), stop and
> ask the developer.

## Steps

1. **Inspect (read-only):** `git status`, `git diff`, `git diff --staged`, and
   `git log --no-merges --format='%s' -10` for style reference.
2. **Stage tracked changes.** If nothing is staged, stage modified/deleted
   tracked files. Show the staged list in the approval gate so the user can
   veto.
3. **Decide on untracked files (judgment):**
   - **Do NOT commit** (add to `.gitignore` instead): per-user/local config,
     env files, build output (`dist/`), caches, `node_modules/`,
     `.screenshots/`, local memory under `.agents/memory/local/` (except its
     `README.md`), and OS cruft (`.DS_Store`).
   - **Commit:** source, docs, agent files, shared config.
   - **When unsure**, ask.
4. **Assess scope.** If changes span unrelated concerns (for example a new
   scene *and* a dependency bump), suggest splitting.
5. **Compose the message** from the diff.

## Commit message format — Conventional Commits

```
<type>(<scope>): <subject>

<optional body — what & why, wrapped ~72 cols>

<co-author trailer>
```

- **type:** `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `perf`,
  `style`, `build`, `ci`.
- **scope:** optional, for example `engine`, `scene-rag`, `content`, `hud`,
  `agent-files` (full list in
  [`git-workflow.md`](../../context/dev-spec/git-workflow.md#commit-messages)).
- **subject:** imperative, lowercase, no trailing period.
- **co-author trailer:** attribute the agent that actually made the commit
  when its standard identity is known. Never guess or invent one.

## Approval gate (required)

Show the staged file list and the proposed message. **Do not commit until the
user explicitly approves.**

## On approval

```bash
git commit -m "<subject>" -m "<body + trailer>"
```

Do not push. Report the resulting commit hash.

## Failure handling

Report the reason: nothing to commit, hook rejected the commit (include its
output), or a merge/rebase in progress.
