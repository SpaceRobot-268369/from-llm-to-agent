---
name: new-branch
description: Commit approved current work, synchronize the latest main, and create a convention-named Git branch after confirming its name. Use when the developer asks to start a new branch or begins work while on main.
---

# Skill: new-branch

Start a new working branch in the single checkout: commit the current work,
sync the latest `main`, then create a properly named branch derived from the
user's prompt.

## Execution style

This is a **low-freedom skill**: execute the steps in order. The only judgment
step is deriving the branch name (step 3), which is always confirmed with the
user before the branch is created. **Never create a Git worktree** (Principle
6).

## Prerequisites

> Requires a git repo (and the `commit` skill's prerequisites for step 1). If
> unmet, tell the developer and guide setup via
> [`../../context/dev-spec/prerequisites.md`](../../context/dev-spec/prerequisites.md),
> then stop.

## Steps

### 1. Handle current work

- **On a feature branch with uncommitted changes:** run the
  [`commit`](../commit/SKILL.md) skill first (it keeps its own approval gate),
  then continue. Don't switch to `main` with uncommitted changes.
- **On `main` with uncommitted changes** (work started before branching):
  don't commit on `main`. Skip step 2, confirm the name (step 3), and create
  the branch from the current HEAD (step 4) — `git checkout -b` carries the
  working tree over. Then offer the `commit` skill on the new branch.
- **Clean tree:** continue.

### 2. Sync main (clean tree only)

```bash
git checkout main
git fetch origin               # skip if there is no origin remote
git pull --ff-only origin main # skip if there is no origin remote
```

### 3. Derive and confirm the branch name

Follow [`git-workflow.md`](../../context/dev-spec/git-workflow.md):

```
scope_name/branch_type/author/feature_name
```

- **scope_name:** `page`, `engine`, `universal`
- **branch_type:** `feature`, `bugfix`, `hotfix`, `refactor`, `test`, `docs`,
  `chore`, `release`, `beautify`, `init`, `review`
- **author:** defaults to `Lucas`
- **feature_name:** short kebab-case summary of the prompt

If a field is unclear, ask instead of guessing. Present the proposed name and
get confirmation.

### 4. Create the branch

```bash
git checkout -b <confirmed-branch-name>
```

### 5. Offer to push (never automatically)

Only after explicit approval (Principle 5):

```bash
git push -u origin <confirmed-branch-name>
```

## Failure handling

Report the failure and reason: commit declined/failed, non-fast-forward on
`main`, branch already exists, or not enough info to name the branch (then
ask).
