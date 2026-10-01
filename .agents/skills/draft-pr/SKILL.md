---
name: draft-pr
description: Draft a pull request from the current branch and, after explicit approval, push and create it as a draft. Use when the user asks to draft, prepare, or open a draft PR for review.
---

# Skill: draft-pr

Draft a pull request for the current branch and, on user approval, create it.

This is a **skill**: the agent decides how to summarize the work into a clear
title and body. It never pushes or opens a PR without explicit user approval
(Principle 5) and never deploys (Principle 3).

## Prerequisites

> Requires `gh` authenticated (`gh auth status`) and a git repo with an
> `origin` remote. If unmet, tell the developer and guide setup via
> [`../../context/dev-spec/prerequisites.md`](../../context/dev-spec/prerequisites.md),
> then stop.

> **Branch must be up to date with `origin/main`.** Fetch, then check
> `git merge-base --is-ancestor origin/main HEAD`. If it's behind, preflight
> with `git merge-tree --write-tree HEAD origin/main`. Show whether the update
> fast-forwards or creates a merge commit, disclose any agent files in the
> incoming delta, and get explicit approval before merging. If conflicts are
> predicted, hand off to [`resolve-conflicts`](../resolve-conflicts/SKILL.md).
> Never `--force`.

## Inputs to gather (read-only)

1. Current branch: `git rev-parse --abbrev-ref HEAD`.
2. Commits vs base: `git log origin/main..HEAD --oneline`.
3. Changed files: `git diff --name-status origin/main...HEAD` and
   `git diff origin/main...HEAD --stat`.
4. Optionally the substantive diff.
5. Parse the branch name (`scope/branch_type/author/feature`) per
   [`git-workflow.md`](../../context/dev-spec/git-workflow.md).
6. Detect whether any changed path is under `src/`, `index.html`, or styles —
   this triggers screenshots.

If there are no commits ahead of `origin/main`, stop: nothing to PR.

## Compose the draft (judgment)

- **Title:** `<branch_type>: <concise summary>`.
- **Body:** fill [`template.md`](template.md):
  - **Summary** — what and why (1–3 sentences).
  - **Changes** — bulleted list.
  - **File changes** — a tree with status markers: `+` added, `~` modified,
    `-` deleted, `>` renamed.
  - **Screenshots** — only for UI changes; see below.
  - **Test plan** — how it was verified. Never invent results.

## UI changes — capture screenshots

If UI paths changed, run [`capture-ui`](../capture-ui/SKILL.md) and embed the
results. If capture fails, note why instead of blocking.

## Approval gate (required)

Present the title and body. **Do not push or create the PR until the user
explicitly approves.**

## On approval

1. Base branch is `main`.
2. `git push -u origin <branch>` (never `--force`).
3. `gh pr create --base main --draft --title "<title>" --body "<body>"`
4. Return the PR URL. Optionally append a dated note to
   `.agents/memory/local/work-log.md`.

> To mark it ready for review, use [`open-pr`](../open-pr/SKILL.md).

## Failure handling

Report the reason: `gh` not authenticated, no commits ahead of `main`, push
rejected / no remote, or a branch name that breaks the convention (warn and
ask).
