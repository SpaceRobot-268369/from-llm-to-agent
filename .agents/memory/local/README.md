# Agent Memory (local)

Per-user, **git-ignored** agent memory (see `.gitignore`). Notes stay on your
machine and are never committed.

Suggested file: `work-log.md` — a dated running log of what you were doing,
decisions made mid-task, and where you left off. Create it on first use:

```bash
printf '# Work log\n\n' > .agents/memory/local/work-log.md
```

Only this `README.md` is tracked. Everything else in this folder is ignored.

For notes meant to be shared, use [`../shared/`](../shared/) instead.
