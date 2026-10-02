# From LLM to Agent

A single-page, scroll-linked field guide to AI buzzwords, for a general
audience. Every new word is **one more box around the same model**. The page
is told in three chapters:

- **Model** — where the intelligence comes from.
- **Memory** — AI doesn't have memory, only context.
- **Harness** — how AI touches the world.

The page is drawn in pixels: a halftone canvas morphs from scene to scene as
you scroll, and the colours run from paper-white to near-black as the boxes
stack up.

Structure from [*AI Agents: Memory, Harness, Model*](https://lucascanoblog.com/archives/2412);
inspired by 飞天闪客 —
[《名词诈骗！一口气拆穿 Skill/MCP/RAG/Agent/OpenClaw 底层逻辑》](https://www.youtube.com/watch?v=O9b8tLXCTYU).

## Quick start

Requires Node `^20.19 || >=22.12` (Vite 8).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
|---------|--------------|
| `npm run dev` | Vite dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | type check + production build to `dist/` |
| `npm run preview` | serve the production build |

## Where things live

- **Copy:** [`src/content/sections.ts`](src/content/sections.ts) (designed
  in [`content-outline.md`](.agents/context/products/content-outline.md)).
- **Pixel engine:** [`src/engine/`](src/engine/) — ticker, Pixel Field,
  halftone renderer, one scene per topic in `scenes/` (the chapter cards
  share an empty `part` scene).
- **Layout & HUD:** [`src/components/`](src/components/) and
  [`src/styles/global.css`](src/styles/global.css).

## For agents

[`AGENTS.md`](AGENTS.md) is the index; details live in [`.agents/`](.agents/).
`CLAUDE.md` simply imports `AGENTS.md`.
