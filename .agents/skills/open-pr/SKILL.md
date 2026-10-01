---
name: open-pr
description: Get the current branch pull request into open, ready-for-review status after explicit approval. Use when the user asks to send, open, publish, or promote a PR for review, whether or not a draft already exists.
---

# Skill: open-pr

Get the current branch's pull request to **open** status (ready for review).
Complements [`draft-pr`](../draft-pr/SKILL.md), which only creates drafts.

It never pushes or opens/promotes a PR without explicit user approval
(Principle 5).

## Prerequisites

> Requires `gh` authenticated and a git repo with an `origin` remote. If
> unmet, tell the developer and guide setup via
> [`../../context/dev-spec/prerequisites.md`](../../context/dev-spec/prerequisites.md),
> then stop.

## Steps

### 1. Detect an existing PR

```bash
git rev-parse --abbrev-ref HEAD
gh pr view --json number,state,isDraft,url 2>/dev/null
```

- **Draft exists** → Step 2.
- **Already open** → report its URL and stop.
- **None** → Step 3.

### 2. Promote the draft

Confirm with the user, then run `gh pr ready <number>`. Report the URL and its
new `OPEN` status.

### 3. Compose and open

Reuse the `draft-pr` composition ([`template.md`](../draft-pr/template.md),
file tree, and [`capture-ui`](../capture-ui/SKILL.md) for UI changes). After
approval:

1. `git push -u origin <branch>` (never `--force`).
2. `gh pr create --base main --title "<title>" --body "<body>"` (no
   `--draft`).
3. Return the PR URL.

## Approval gate (required)

Opening a PR signals "ready for review." **Do not push, create, or promote
until the user explicitly approves.**

## Failure handling

Report the reason: `gh` not authenticated, no commits ahead of `main`, push
rejected, or `gh pr ready` failing because no PR exists (then fall back to
Step 3).
