# Git Workflow

## One branch, one checkout

All work happens directly on **`main`** in this one checkout (Principle 6).
There are no feature branches, no pull requests, and **no Git worktrees**. If
a task seems to need a parallel checkout, finish or commit the current work
first, then start the next one.

Commits still matter: they are the project's history and its undo button.
Keep each one small and about one thing.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/):
`<type>(<scope>): <subject>`, with an imperative, lowercase subject and no
trailing period. The full format lives in the
[`commit`](../../skills/commit/SKILL.md) skill.

- **type:** `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `perf`,
  `style`, `build`, `ci`.
- **scope** (optional; leave it off for repo-wide changes):

| Scope | Covers |
|-------|--------|
| `content` | Page copy, chapters, palettes and labels in `src/content/`. |
| `sections` | Section layouts under `src/components/` (hero, chapter card, finale). |
| `hud` | Top bar, progress rail, stack trail. |
| `styles` | Global CSS in `src/styles/`. |
| `engine` | Pixel Field, ticker, phases, halftone and palette logic in `src/engine/`. |
| `scene-<id>` | One scene, e.g. `scene-rag`. |
| `tooling` | Dependencies, config, build. |
| `agent-files` | `AGENTS.md`, `CLAUDE.md`, `.agents/`, `.claude/launch.json`. |
| `docs` | `README.md` and other human-facing docs. |

Examples: `feat(scene-rag): add the retrieval shelf`,
`fix(engine): stop the chapter wipe flickering on resize`,
`docs(agent-files): work directly on main`.

## The commit loop

1. Make one logical change on `main`.
2. Verify: `npm run typecheck`, `npm run build`, and a visual check via
   [`capture-ui`](../../skills/capture-ui/SKILL.md) when the page changed.
3. Commit through the [`commit`](../../skills/commit/SKILL.md) skill. It shows
   the staged files and the message, and **commits only after explicit
   approval** (Principle 5).

## Remote and pushing

There is no remote yet. Adding one, and every push, needs explicit approval
(Principles 3 and 5). **Never `--force`**, never rewrite history.

## Conflicts

Rare on a single branch. They mostly come from `git stash pop`, a future
`git pull` once a remote exists, or a revert or cherry-pick. Resolve them with
[`resolve-conflicts`](../../skills/resolve-conflicts/SKILL.md).
