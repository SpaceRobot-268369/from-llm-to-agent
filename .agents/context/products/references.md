# References

> Every number, date, and attribution on the page must trace to an entry here
> (content rule in [`content-outline.md`](content-outline.md)). This list is
> **internal** — for fact-checking only. The page shows no reference list,
> just two small credit lines in the footer: the source video and the blog
> post.

## Content inspiration

| Source | Used for |
|--------|----------|
| Lucas — [*AI Agents: Memory, Harness, Model*](https://lucascanoblog.com/archives/2412) (2026-08-26) | The three-part structure (Model · Memory · Harness). Memory is built into the system prompt; build your own with agent files and/or RAG. The harness as a brain/CPU's peripherals; the harness list; chopsticks vs. spoon; CLI over GUI. Thinking is built in, effort is external. |
| 飞天闪客 — 《名词诈骗！一口气拆穿 Skill/MCP/RAG/Agent/OpenClaw 底层逻辑》 — [YouTube](https://www.youtube.com/watch?v=O9b8tLXCTYU) · [Bilibili](https://www.bilibili.com/video/BV1ojfDBSEPv/) | Overall stance: buzzwords are wrappers around LLM + prompt. Concept lineup (Skill, MCP, RAG, Agent, OpenClaw). The video has no captions; the narrative was cross-checked against written summaries of it ([Tencent Cloud](https://cloud.tencent.com/developer/article/2643926), [Juejin](https://juejin.cn/post/7605494530016821288)). |

## Facts by section

| § | Claim on the page | Source |
|---|-------------------|--------|
| 01 | A token is roughly ¾ of an English word | [OpenAI — What are tokens](https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them) |
| 02 | Loss falls as a power law in parameters, data, compute; `α_N ≈ 0.076` | [Kaplan et al., 2020 — Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361) |
| 02 | GPT-1, 2018, 117M parameters | [Radford et al., 2018](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) |
| 02 | GPT-2, 2019, 1.5B parameters; staged release | [Radford et al., 2019](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) · [Wikipedia — GPT-2](https://en.wikipedia.org/wiki/GPT-2) |
| 02 | GPT-3, 2020, 175B parameters, 300B training tokens, few-shot learning | [Brown et al., 2020 — Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165) |
| 02 | Chinchilla, 2022, 70B parameters, 1.4T tokens, beat 280B Gopher | [Hoffmann et al., 2022 — Training Compute-Optimal LLMs](https://arxiv.org/abs/2203.15556) |
| 02 | Frontier labs stopped publishing model sizes | [OpenAI, 2023 — GPT-4 Technical Report](https://arxiv.org/abs/2303.08774) (declines to report architecture or size) |
| 02 | Llama 3.1, 2024, 405B parameters, 15T+ tokens | [Llama Team, 2024 — The Llama 3 Herd of Models](https://arxiv.org/abs/2407.21783) |
| 03 | Writing out intermediate steps improves answers | [Wei et al., 2022 — Chain-of-Thought Prompting](https://arxiv.org/abs/2201.11903) |
| 03 | Reasoning models produce reasoning tokens before the answer; a reasoning-effort setting | [OpenAI — Reasoning models guide](https://developers.openai.com/api/docs/guides/reasoning) (`reasoning.effort`) |
| 03 | Thinking budget / effort settings | [Anthropic — Extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking) (`budget_tokens`, `effort`) |
| 06 | GPT-3 context window: 2,048 tokens | [Brown et al., 2020](https://arxiv.org/abs/2005.14165) |
| 06 | Some models take a million tokens | [Google, Feb 2024 — Gemini 1.5](https://blog.google/technology/ai/google-gemini-next-generation-model-february-2024/) (up to 1M tokens) |
| 07 | Project memory files: AGENTS.md, CLAUDE.md | [agents.md](https://agents.md) · [Claude Code — memory](https://docs.claude.com/en/docs/claude-code/memory) |
| 08 | Retrieval-Augmented Generation | [Lewis et al., 2020 — RAG for Knowledge-Intensive NLP](https://arxiv.org/abs/2005.11401) |
| 10 | Think → act → observe loop (ReAct) | [Yao et al., 2022 — ReAct](https://arxiv.org/abs/2210.03629) |
| 11 | Model Context Protocol, Anthropic, Nov 2024; JSON-RPC; `tools/list`, `tools/call` | [Anthropic — Introducing MCP](https://www.anthropic.com/news/model-context-protocol) · [modelcontextprotocol.io](https://modelcontextprotocol.io) |
| 12 | Agent Skills: `SKILL.md` with name + description; progressive disclosure | [Anthropic — Agent Skills](https://www.anthropic.com/news/skills) · [agentskills.io](https://agentskills.io) |
| 14 | OpenClaw, formerly Clawdbot → Moltbot; self-hosted; chat channels; 30-minute heartbeat; security debate | [openclaw.ai](https://openclaw.ai) · [GitHub](https://github.com/openclaw/openclaw) · [DigitalOcean explainer](https://www.digitalocean.com/resources/articles/what-is-openclaw) · [Trajectory-based safety audit (arXiv)](https://arxiv.org/abs/2602.14364) · [Pure AI, Feb 2026 — From Clawdbot to Moltbot to OpenClaw](https://pureai.com/articles/2026/02/03/from-clawdbot-to-moltbot-to-openclaw.aspx) (early-2026 rise) |

## Illustrative (not factual) content

- §01 next-token probabilities (` mat` 41%, …) — labeled *illustrative* on the
  page.
- §03 the `<thinking>` example (17 × 24) — a made-up illustration of the
  format, not real model output.
- §02 loss-chart curve shape — schematic power law, not fitted data.
