# References

> Every number, date, and attribution on the page must trace to an entry here
> (content rule in [`content-outline.md`](content-outline.md)). This list is
> **internal** — for fact-checking only. The page shows no reference list,
> just two small credit lines in the footer: the source video and the two
> blog posts.

## Content inspiration

| Source | Used for |
|--------|----------|
| Lucas — [*AI Agents: Memory, Harness, Model*](https://lucascanoblog.com/archives/2412) (2026-08-26) | The three-part structure (Model · Memory · Harness). Memory is built into the system prompt; build your own with agent files and/or RAG. The harness as a brain/CPU's peripherals; the harness list; chopsticks vs. spoon; CLI over GUI. Thinking is built in, effort is external. |
| Lucas — [*Build the Superpower*](https://lucascanoblog.com/archives/2366) (2026-07-16) | 2.4 Agent files (the Memory chapter's knowledge base): AGENTS.md / CLAUDE.md as the project's index, kept concise to avoid context pollution; `.agents/` with context, memory and skills; agents write the updates themselves; "how smart an agent can be depends on the model and its agent files". (The post's worktree half is not used.) |
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
| 1.3 | "Chain of thought": showing a model a few worked examples that write out intermediate steps improves arithmetic, commonsense and symbolic reasoning ("maths and logic"); the gains appear in sufficiently large models ("big models"), 2022 | [Wei et al., 2022 — Chain-of-Thought Prompting Elicits Reasoning in LLMs](https://arxiv.org/abs/2201.11903) |
| 1.3 | Reasoning models produce internal reasoning tokens before the answer; the raw tokens are not shown ("not visible via the API"; at most a summary is) — "you usually don't see"; a reasoning-effort setting | [OpenAI — Reasoning models guide](https://developers.openai.com/api/docs/guides/reasoning) (`reasoning.effort`, `summary`) |
| 1.3 | Thinking budget / effort settings; thinking comes back as a summary | [Anthropic — Extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking) (`budget_tokens`, `effort`, summarized thinking blocks) |
| 1.3 | Thinking is built into the model; reasoning effort is controlled from outside ("have the habit built in … dialed from outside") | blog 2412 |
| 2.2 | The hidden text is layered: rules from the model's maker (system), the app's developer, then the user; users typically see only their own messages and the replies, not developer or system messages | [OpenAI — Model Spec (2026-08-18), "The chain of command"](https://model-spec.openai.com/2026-08-18.html) |
| 2.2 | The company's own system prompt gives the model up-to-date information such as the current date at the start of every conversation (and is published) | [Anthropic — System prompts release notes](https://platform.claude.com/docs/en/release-notes/system-prompts) |
| 2.2 | The app's own part includes its tools: the system prompt and the tool definitions are sent with every request | [Claude Agent SDK — How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop) ("What consumes context": system prompt and tool definitions load on every request) |
| 2.2 | Your settings: custom instructions apply to all your chats; saved memory is carried between chats | [OpenAI — ChatGPT Custom Instructions](https://help.openai.com/en/articles/8096356-chatgpt-custom-instructions) · [OpenAI — Memory in ChatGPT](https://help.openai.com/en/articles/8590148-memory-in-chatgpt) (saved memories and custom instructions used to personalize future responses) · blog 2412 (memory is put into the system prompt) |
| 2.3 | GPT-3 context window: 2,048 tokens | [Brown et al., 2020](https://arxiv.org/abs/2005.14165) |
| 2.3 | Many models take hundreds of thousands of tokens | [Anthropic — Context windows](https://platform.claude.com/docs/en/build-with-claude/context-windows) (e.g. 200K-token windows) |
| 2.3 | Some models take a million tokens | [Google, Feb 2024 — Gemini 1.5](https://blog.google/technology/ai/google-gemini-next-generation-model-february-2024/) (up to 1M tokens) |
| 2.4 | "Remembering" is saved text read back in: each session starts with a fresh context; CLAUDE.md / AGENTS.md are read at the start of every session; the agent also writes its own memory notes; other files (subfolder instructions, memory topic files, skills) load on demand; keep the files short (longer ones use more context and are followed less) | [Claude Code — How Claude remembers your project](https://code.claude.com/docs/en/memory) · [agents.md](https://agents.md) ("a README for agents") |
| 2.4 | The `.agents/` knowledge base (context, memory, skills) behind a short index; agents write the updates; "how smart an agent can be depends on the model and its agent files" — the blog's own convention and opinion, hence "Agents *can* keep theirs…" | blog 2366 |
| 2.5 | Retrieval-Augmented Generation | [Lewis et al., 2020 — RAG for Knowledge-Intensive NLP](https://arxiv.org/abs/2005.11401) |
| 3.2 | Think → act → observe loop (ReAct) | [Yao et al., 2022 — ReAct](https://arxiv.org/abs/2210.03629) |
| 3.2 | The loop is a `while` loop that continues while the model asks for a tool (`stop_reason: "tool_use"`) and exits on any other stop reason, e.g. `"end_turn"` — a final answer. (The note's "the job is done, or it needs to ask you something" glosses this: any reply without a tool call ends the loop, and that reply can be a question back to you.) | [Anthropic — How tool use works (the agentic loop)](https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works) |
| 3.2 | Limits stop the loop: a maximum number of turns (`maxTurns`) and a spending cap (`maxBudgetUsd`); without them it runs until the model finishes on its own | [Claude Agent SDK — How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop) ("Turns and budget") |
| 3.3 | Analogy: English became the common language between speakers of different first languages (the dominant global lingua franca by the end of the 20th century) | [Wikipedia — English as a lingua franca](https://en.wikipedia.org/wiki/English_as_a_lingua_franca) |
| 3.3 | Model Context Protocol, Anthropic, Nov 2024; JSON-RPC; `tools/list`, `tools/call` | [Anthropic — Introducing MCP](https://www.anthropic.com/news/model-context-protocol) · [modelcontextprotocol.io](https://modelcontextprotocol.io) |
| 3.4 | Agent Skills: `SKILL.md` with name + description; progressive disclosure | [Anthropic — Agent Skills](https://www.anthropic.com/news/skills) · [agentskills.io](https://agentskills.io) |
| 3.5 | A sub-agent starts with a fresh conversation (no prior history), does not see the parent's turns, and only its final response returns to the parent; the main agent's context grows by that summary only | [Claude Agent SDK — How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop) ("Use subagents for subtasks") |
| 3.5 | "One tool call": the main agent starts a sub-agent through a tool (the `Agent` tool); the only thing passed in is that tool's prompt (the brief); a sub-agent can have its own, narrower set of tools; the parent gets back a concise summary | [Claude Agent SDK — Subagents](https://code.claude.com/docs/en/agent-sdk/subagents) ("What subagents inherit", "Tool restrictions") |
| 3.6 | Claude Code: Anthropic's agentic coding tool; terminal, IDE, desktop, browser; CLAUDE.md, MCP, skills, sub-agents | [Claude Code overview](https://code.claude.com/docs/en/overview) |
| 3.6 | Codex: OpenAI's coding agent — open-source terminal CLI (Apr 2025) and a cloud agent; reads AGENTS.md | [github.com/openai/codex](https://github.com/openai/codex) · [Codex CLI docs](https://developers.openai.com/codex/cli) · [Wikipedia — OpenAI Codex (AI agent)](https://en.wikipedia.org/wiki/OpenAI_Codex_(AI_agent)) |
| 3.6 | "The same parts … agent files with memory and skills" — Claude Code: CLAUDE.md, auto memory, skills, MCP | [Claude Code overview](https://code.claude.com/docs/en/overview) · [Claude Code — memory](https://code.claude.com/docs/en/memory) |
| 3.6 | Codex: AGENTS.md (project guidance), memories, skills, MCP, sub-agents | [Codex docs — Customization](https://learn.chatgpt.com/docs/customization/overview) (formerly developers.openai.com/codex/concepts/customization) |
| 3.6 | OpenClaw agent files: a workspace with AGENTS.md and SOUL.md loaded every session, a MEMORY.md of long-term memory, and a skills folder | [OpenClaw docs — Agent workspace](https://github.com/openclaw/openclaw/blob/main/docs/concepts/agent-workspace.md) |
| 3.6 | OpenClaw: self-hosted; chat channels; 30-minute heartbeat; security debate | [openclaw.ai](https://openclaw.ai) · [GitHub](https://github.com/openclaw/openclaw) · [DigitalOcean explainer](https://www.digitalocean.com/resources/articles/what-is-openclaw) · [Trajectory-based safety audit (arXiv)](https://arxiv.org/abs/2602.14364) · [Pure AI, Feb 2026 — From Clawdbot to Moltbot to OpenClaw](https://pureai.com/articles/2026/02/03/from-clawdbot-to-moltbot-to-openclaw.aspx) (early-2026 rise) |

## Illustrative (not factual) content

- §1.1 next-token demo — the continuation (` mat` `.` ` It` ` purred`) and
  every probability at each step (` mat` 41%, …) are made up; labeled
  *illustrative* on the page.
- §1.2 loss-chart curve shape — schematic power law, not fitted data.
- §1.2 the brain's colour (none for GPT-1/2, a full multi-colour map at the
  frontier) — a picture of "bigger = more capable", not a measurement; no
  numbers are shown.
- §1.3 the `<thinking>` example (17 × 24) — a made-up illustration of the
  format, not real model output.
- §2.2 the system-prompt stack (`<company>` / `<app>` / `<settings>` /
  `<memory>` lines, "Today is Friday", the cooking app) — a made-up
  illustration of how the parts stack (no numbers, so no on-page label);
  real apps word and order their parts differently.
- §3.2 the loop code (`over_limit()`, `llm()`, `run()`) — simplified
  pseudo-code, not a real SDK.
- §3.3 analogy — people "settling on" one shared language is an everyday
  picture of adopting a standard (the English fact itself is sourced above),
  not a claim about how or when it happened.
- §3.3 the services in the MCP diagram (Notion, Google Drive, OneDrive,
  Slack, and a generic calendar that joins last) illustrate the idea of
  adopting one standard; the page does not claim each ships an official MCP
  server.
