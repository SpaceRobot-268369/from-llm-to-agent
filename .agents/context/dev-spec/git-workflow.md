# Git Workflow & Branch Naming

## One workflow: single checkout, branches only

This project uses **one checkout that switches branches**. **Do not create Git
worktrees** (Principle 6). If a task seems to need parallel checkouts, finish
or commit the current work first, then switch branches.

> The repository is initialised: `main` holds the initial scaffold commit,
> the one commit made directly on `main` (with explicit approval). Every later
> change goes on a branch.

## Branch syntax

```
scope_name/branch_type/author/feature_name
```

- **scope_name:**
  - `page` — section copy, section layout, HUD, and React components under
    `src/components/` and `src/content/`.
  - `engine` — the Pixel Field, scenes, scroll ticker, and palette logic under
    `src/engine/`.
  - `universal` — repo-wide work: tooling, config, dependencies, docs, and
    agent files.
- **branch_type:** `feature`, `bugfix`, `hotfix`, `refactor`, `test`, `docs`,
  `chore`, `release`, `beautify`, `init`, `review` (see the table below).
- **author:** your name (default `Lucas`).
- **feature_name:** short kebab-case description of the work.

Examples: `page/feature/Lucas/rag-section`,
`engine/beautify/Lucas/dissolve-easing`, `universal/docs/Lucas/agent-files`.

## Branch types

| branch_type | Use it for |
|-------------|------------|
| `feature`   | New user-facing content or capability (a new section, a new scene). |
| `bugfix`    | Fixing a defect through the normal review cycle. |
| `hotfix`    | Urgent fix to a live deployment. |
| `refactor`  | Restructuring code without changing what the page shows. |
| `test`      | Adding or improving tests only. |
| `docs`      | Documentation-only changes — README, dev-spec, agent files, comments. |
| `chore`     | Maintenance — dependencies, config, build, CI, tooling. |
| `release`   | Release preparation — version bumps, changelog, tagging. |
| `beautify`  | Purely visual polish (palette, spacing, easing) with no story change. |
| `init`      | Initial scaffolding. |
| `review`    | Reviewing another author's branch/PR and adjusting where needed. |

## Workflow

1. Start from the latest `main`:
   `git checkout main && git fetch origin && git pull --ff-only origin main`
   (skip fetch/pull if there is no remote yet).
2. Create your branch with the [`new-branch`](../../skills/new-branch/SKILL.md)
   skill. Do not commit directly to `main`.
3. Develop and verify locally (`npm run typecheck`, `npm run build`, visual
   check via [`capture-ui`](../../skills/capture-ui/SKILL.md)). Create each
   commit through the approval-gated [`commit`](../../skills/commit/SKILL.md)
   skill.
4. Before merging, fetch `origin/main`, preflight the update, and synchronize
   only with approval. Resolve conflicts with
   [`resolve-conflicts`](../../skills/resolve-conflicts/SKILL.md). **Never
   `--force`** onto shared history.
5. Open a pull request ([`draft-pr`](../../skills/draft-pr/SKILL.md) →
   [`open-pr`](../../skills/open-pr/SKILL.md)) and wait for review.
