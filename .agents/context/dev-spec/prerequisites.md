# Prerequisites & Setup

Central setup reference for every tool the agent skills depend on. When a
skill detects an unmet prerequisite, it points the developer here (see the
prerequisite-handling policy in
[`../../skills/README.md`](../../skills/README.md)).

For each tool: how to **check** it's ready, and how to **set it up** if not.

---

## Node.js + npm

Used by every frontend task (`start-local-dev`, `capture-ui`, builds).

- **Check:** `node -v` reports **≥ 20.19** (Vite 8 requirement; 22 LTS or newer
  recommended), `npm -v` works, and `node_modules/` exists at the repo root.
- **Set up:** install Node from nodejs.org or `brew install node`, then run
  `npm install` from the repo root.

## Git

Used by `commit`, `new-branch`, `draft-pr`, `open-pr`, `resolve-conflicts`.

- **Check:** `git --version`, and `git rev-parse --is-inside-work-tree` prints
  `true`.
- **Set up:** if the project is not a repository yet, ask the developer before
  running `git init` and before the first commit (the only commit allowed
  directly on `main`, per Principle 6). Worktrees are not used in this
  project.

## GitHub CLI (`gh`)

Used by `draft-pr` and `open-pr`.

- **Check:** `gh auth status` (authenticated) and an `origin` remote
  (`git remote -v`).
- **Set up:** `brew install gh`, then `gh auth login`. Adding a remote is a
  developer decision; ask first.

## Browser / preview tooling

Used by `capture-ui` and visual verification.

- **Check:** the agent has some browser capability (for example Claude's
  Desktop Preview, driven by [`.claude/launch.json`](../../../.claude/launch.json),
  or another provider's browser tool).
- **Set up:** none in the repo. If no browser capability exists, report the
  limitation and give manual verification steps; never invent screenshots.
