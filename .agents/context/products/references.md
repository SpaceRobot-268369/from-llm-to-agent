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
| Lucas — [*Build the Superpower*](https://lucascanoblog.com/archives/2366) (2026-07-16) | 3.5 Agent files: AGENTS.md / CLAUDE.md as the project's index, kept concise to avoid context pollution; `.agents/` with context, memory and skills; "how smart an agent can be depends on the model and its agent files". (The post's worktree half is not used.) |
| 飞天闪客 — 《名词诈骗！一口气拆穿 Skill/MCP/RAG/Agent/OpenClaw 底层逻辑》 — [YouTube](https://www.youtube.com/watch?v=O9b8tLXCTYU) · [Bilibili](https://www.bilibili.com/video/BV1ojfDBSEPv/) | Overall stance: buzzwords are wrappers around LLM + prompt. Concept lineup (Skill, MCP, RAG, Agent, OpenClaw). The video has no captions; the narrative was cross-checked against written summaries of it ([Tencent Cloud](https://cloud.tencent.com/developer/article/2643926), [Juejin](https://juejin.cn/post/7605494530016821288)). |

## Facts by section

| § | Claim on the page | Source |
|---|-------------------|--------|
| 1.1 | A token is roughly ¾ of an English word | [OpenAI — What are tokens](https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them) |
| 1.2 | Loss falls as a power law in parameters, data, compute; `α_N ≈ 0.076` | [Kaplan et al., 2020 — Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361) |
| 1.2 | GPT-1, 2018, 117M parameters | [Radford et al., 2018](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) |
| 1.2 | GPT-2, 2019, 1.5B parameters; staged release | [Radford et al., 2019](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) · [Wikipedia — GPT-2](https://en.wikipedia.org/wiki/GPT-2) |
| 1.2 | GPT-3, 2020, 175B parameters, 300B training tokens, few-shot learning | [Brown et al., 2020 — Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165) |
| 1.2 | Chinchilla, 2022, 70B parameters, 1.4T tokens, beat 280B Gopher | [Hoffmann et al., 2022 — Training Compute-Optimal LLMs](https://arxiv.org/abs/2203.15556) |
| 1.2 | Kimi K3, 2026: 2.8T total parameters, 104B activated per token (Mixture-of-Experts), open weights; pre-training token count not stated | [Kimi Team, 2026 — Kimi K3: Open Frontier Intelligence (arXiv 2607.24653)](https://arxiv.org/abs/2607.24653) · [Hugging Face — moonshotai/Kimi-K3](https://huggingface.co/moonshotai/Kimi-K3) |
| 1.2 | The biggest closed (frontier) models don't publish their sizes | [OpenAI, 2023 — GPT-4 Technical Report](https://arxiv.org/abs/2303.08774) (declines to report architecture or size) |
| 1.2 | Llama 3.1, 2024, 405B parameters, 15T+ tokens | [Llama Team, 2024 — The Llama 3 Herd of Models](https://arxiv.org/abs/2407.21783) |
| 1.3 | Writing out intermediate steps improves answers | [Wei et al., 2022 — Chain-of-Thought Prompting](https://arxiv.org/abs/2201.11903) |
| 1.3 | Reasoning models produce reasoning tokens before the answer; a reasoning-effort setting | [OpenAI — Reasoning models guide](https://developers.openai.com/api/docs/guides/reasoning) (`reasoning.effort`) |
| 1.3 | Thinking budget / effort settings | [Anthropic — Extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking) (`budget_tokens`, `effort`) |
| 2.3 | GPT-3 context window: 2,048 tokens | [Brown et al., 2020](https://arxiv.org/abs/2005.14165) |
| 2.3 | Many models take hundreds of thousands of tokens | [Anthropic — Context windows](https://platform.claude.com/docs/en/build-with-claude/context-windows) (e.g. 200K-token windows) |
| 2.3 | Some models take a million tokens | [Google, Feb 2024 — Gemini 1.5](https://blog.google/technology/ai/google-gemini-next-generation-model-february-2024/) (up to 1M tokens) |
| 2.4 | Project memory files: AGENTS.md, CLAUDE.md | [agents.md](https://agents.md) · [Claude Code — memory](https://docs.claude.com/en/docs/claude-code/memory) |
| 2.5 | Retrieval-Augmented Generation | [Lewis et al., 2020 — RAG for Knowledge-Intensive NLP](https://arxiv.org/abs/2005.11401) |
| 3.2 | Think → act → observe loop (ReAct) | [Yao et al., 2022 — ReAct](https://arxiv.org/abs/2210.03629) |
| 3.3 | Model Context Protocol, Anthropic, Nov 2024; JSON-RPC; `tools/list`, `tools/call` | [Anthropic — Introducing MCP](https://www.anthropic.com/news/model-context-protocol) · [modelcontextprotocol.io](https://modelcontextprotocol.io) |
| 3.4 | Agent Skills: `SKILL.md` with name + description; progressive disclosure | [Anthropic — Agent Skills](https://www.anthropic.com/news/skills) · [agentskills.io](https://agentskills.io) |
| 3.5 | AGENTS.md / CLAUDE.md are read automatically at the start of a session; keep them concise | [agents.md](https://agents.md) · [Claude Code — memory](https://docs.claude.com/en/docs/claude-code/memory) |
| 3.7 | Claude Code: Anthropic's agentic coding tool; terminal, IDE, desktop, browser; CLAUDE.md, MCP, skills, sub-agents | [Claude Code overview](https://code.claude.com/docs/en/overview) |
| 3.7 | Codex: OpenAI's coding agent — open-source terminal CLI (Apr 2025) and a cloud agent; reads AGENTS.md | [github.com/openai/codex](https://github.com/openai/codex) · [Codex CLI docs](https://developers.openai.com/codex/cli) · [Wikipedia — OpenAI Codex (AI agent)](https://en.wikipedia.org/wiki/OpenAI_Codex_(AI_agent)) |
| 3.7 | OpenClaw: self-hosted; chat channels; 30-minute heartbeat; security debate | [openclaw.ai](https://openclaw.ai) · [GitHub](https://github.com/openclaw/openclaw) · [DigitalOcean explainer](https://www.digitalocean.com/resources/articles/what-is-openclaw) · [Trajectory-based safety audit (arXiv)](https://arxiv.org/abs/2602.14364) · [Pure AI, Feb 2026 — From Clawdbot to Moltbot to OpenClaw](https://pureai.com/articles/2026/02/03/from-clawdbot-to-moltbot-to-openclaw.aspx) (early-2026 rise) |

## Illustrative (not factual) content

- §1.1 next-token probabilities (` mat` 41%, …) — labeled *illustrative* on the
  page.
- §1.3 the `<thinking>` example (17 × 24) — a made-up illustration of the
  format, not real model output.
- §1.2 loss-chart curve shape — schematic power law, not fitted data.
- §3.3 the services in the MCP diagram (Notion, Google Drive, OneDrive,
  Slack, and a generic calendar that joins last) illustrate the idea of adopting one standard; the page does
  not claim each ships an official MCP server.
