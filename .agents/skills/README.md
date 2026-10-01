# Skills

Storage for all reusable agent workflows. Skills range from **low-freedom,
deterministic procedures** that must be followed exactly to **judgment-driven
capabilities** that adapt their approach to the task.

Each skill follows the open Agent Skills format: it lives in its own folder
with a required `SKILL.md` containing `name` and trigger-focused `description`
frontmatter. Supporting templates or helpers stay beside it, for example
`draft-pr/SKILL.md` plus `draft-pr/template.md`.

Deterministic skills declare their low-freedom execution style in the body and
retain every approval gate. Do not create a parallel `commands/` taxonomy.

## Prerequisite handling (applies to every skill here)

Before doing its work, verify the skill's prerequisites. **If any prerequisite
is unmet, do not proceed.** Instead:

1. Tell the developer exactly which prerequisite failed.
2. Guide them on how to set it up, pointing to
   [`../context/dev-spec/prerequisites.md`](../context/dev-spec/prerequisites.md).
3. Stop; never partially execute with missing prerequisites.
