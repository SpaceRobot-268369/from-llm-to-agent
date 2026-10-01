# Agent Knowledge Base

This directory is the provider-neutral agent knowledge base for
**From LLM to Agent**. [`AGENTS.md`](../AGENTS.md) is its authoritative index
and policy entry point.

| Area | Purpose |
|------|---------|
| [`skills/`](skills/) | Open `SKILL.md` workflows, from deterministic procedures to judgment-driven capabilities. |
| [`agents/`](agents/) | Reserved for future provider-neutral custom subagent definitions; currently empty. |
| [`context/`](context/) | Dev spec, content design, design language, and references. |
| [`memory/`](memory/) | Shared committed memory plus git-ignored machine-local notes. |
| [`hooks/`](hooks/) | Provider-neutral hook guidance and future shared scripts. |

Provider-specific configuration must remain a thin adapter and must never
become a competing knowledge source. Currently only `.claude/launch.json` is
tracked.
