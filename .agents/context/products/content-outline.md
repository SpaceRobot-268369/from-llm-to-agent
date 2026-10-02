# From LLM to Agent — Content Outline

> **The content design for the whole page.** This is the narrative source of
> truth: every section's purpose, copy, scene, palette, and formula. The live
> copy in [`src/content/sections.ts`](../../../src/content/sections.ts) must
> match this file. Change the story here first (approval-gated under
> Principle 1), then mirror it in code.

---

## Thesis

> **Every new AI word is the same model in a new box.**
> **Every AI product = Model + Memory + Harness.**

An LLM does exactly one thing: predict the next token. Everything else is a
box built around it, and the boxes fall into three chapters:

| Chapter | Name | One-line thesis |
|---------|------|-----------------|
| 1 | **Model** | Where the intelligence comes from. |
| 2 | **Memory** | AI doesn't have memory. It only has context. |
| 3 | **Harness** | A model is a brain with no hands. The harness is how it touches the world. |

The three-part frame comes from the author's own post,
[*AI Agents: Memory, Harness, Model*](https://lucascanoblog.com/archives/2412).
Its key claims are used here:

- **Memory:** LLMs are autoregressive and keep nothing between sessions.
  Apparent memory is constructed and put into the system prompt. Projects
  should build their own memory: agent files, RAG, or both.
- **Harness:** the model is a brain or CPU that needs peripherals. The harness
  covers tool use, multi-agents, the agent loop, MCP, skills, error handling,
  and context management. It separates chatbots from agents. Pick the right
  tool (chopsticks vs. spoon for soup); models are best with text, so a CLI
  often beats a GUI.
- **Model:** scaling laws (e.g. Chinchilla). Thinking ability is built into
  the model; reasoning effort can be controlled from outside.

The "buzzword fraud" stance and the concept lineup come from 飞天闪客,
[《名词诈骗！一口气拆穿 Skill/MCP/RAG/Agent/OpenClaw 底层逻辑》](https://www.youtube.com/watch?v=O9b8tLXCTYU)
(also on [Bilibili](https://www.bilibili.com/video/BV1ojfDBSEPv/)). Concepts
are in strict build order: each section may only use ideas introduced above
it.

## Audience

**The general public**, and people with a little background, who keep hearing
these words. No math beyond one formula. Every concept gets a plain-English
**analogy**, a short explanation with a tiny example, and an **animated
diagram**. Readers who skip the text should still get the idea from the
diagram.

## Page mechanics

- **One page**, scroll-linked. A global pixel/halftone canvas (the *Pixel
  Field*) morphs from one scene to the next as you scroll. See
  [`design-language.md`](design-language.md).
- **Three chapters, nothing else at the top level.** The page is Hero →
  Chapter 1 *Model* → Chapter 2 *Memory* → Chapter 3 *Harness* → Finale.
  Every topic is nested inside a chapter and numbered `chapter.topic`
  (1.1, 2.3, 3.6). Numbers are assigned automatically from the order in
  `sections.ts`; kickers never carry a number of their own.
- **Chapter openers.** Each chapter starts with a full-screen *chapter card*
  in the chapter's signature colour: a giant pixel numeral, the chapter name,
  its one-line thesis, and a mini table of contents of its topics — each
  entry jumps to its topic (inert once the card has lifted away). No
  diagram — the card is the only thing on screen. It **holds** for most of a
  screen of scrolling before it leaves (the *buffer*).
- **Chapters look different.** Each chapter has its own colour family and
  its own **pixel mark** in the halftone: Model = squares, Memory = dashes
  (like lines of text), Harness = crosses. Chapter changes use a directional
  pixel *wipe*; topic changes inside a chapter use the blocky *dissolve*.
- **Every topic opens with a centred headline card** (number, title, "In
  plain words" analogy) on a clean background — **no diagram at all** until
  the headline leaves.
- **Read act:** the text column sits beside the diagram; in read-only topics
  the diagram's story plays as you read (watch topics save it for the watch
  act). **Sides alternate** topic by topic, restarting on the right in each
  chapter. Diagrams are clipped to their own region and never overlap the
  text.
- **Watch act — only for the key animations.** Chat, RAG, Agent loop, MCP,
  and the finale add a third act: the text leaves, the diagram glides to the
  centre, grows, and plays its story with numbered captions, ending on the
  formula.
- **Buffers.** Headlines hold before they leave, and every section ends on a
  still frame before the next one slides in.
- **Formula chip** at the end of every topic: one line that shows the new
  box wrapped around the old one.
- **HUD:** top-right shows `Chapter · topic`; the right-edge progress rail is
  grouped into the three chapters; the bottom-left stack trail counts the
  boxes around the model; once you've scrolled most of a screen (0.8 of the
  viewport height), an **↑ Top** button bottom-right scrolls back to the hero.
- **Calm motion.** Cursors pulse slowly and never hard-blink. The mouse halo
  is faint.
- **No reference list on the page.** Sources live in
  [`references.md`](references.md) for fact-checking only. The footer carries
  two small credit lines (the video and the blog post).

## Chapters

| # | Chapter | Thesis | Colour family | Pixel mark |
|---|---------|--------|---------------|-----------|
| 1 | **Model** | Where the intelligence comes from. | paper & cream, signature **green** | squares |
| 2 | **Memory** | AI doesn't have memory. It only has context. | sand, signature **blue** | dashes |
| 3 | **Harness** | A model is a brain with no hands. The harness is how it touches the world. | graphite, signature **orange** | crosses |

## Structure at a glance

| # | id | Chapter | Acts | Background | Scene |
|---|----|---------|------|------------|-------|
| — | hero | — | (own) | paper `#F2EFE7` | `hero` |
| 1 | part-model | Model | chapter card | green `#5DCB8A` | `part` (empty) |
| 1.1 | next-token | Model | read | `#EEEAE0` | `tokens` |
| 1.2 | scaling-law ★ | Model | (own stage) | green `#5DCB8A` | `scaling` |
| 1.3 | thinking (Chain of thought) | Model | read | `#E9E5DA` | `thinking` |
| 2 | part-memory | Memory | chapter card | blue `#8FB4E3` | `part` (empty) |
| 2.1 | chat | Memory | **watch** | `#E8E1D1` | `chat` |
| 2.2 | system-prompt | Memory | read | `#E0D7C3` | `system` |
| 2.3 | context-window | Memory | read | `#D7CDB7` | `window` |
| 2.4 | agent-files | Memory | read | `#CDC2A8` | `agentfiles` |
| 2.5 | rag ★ | Memory | **watch** | blue `#8FB4E3` | `rag` |
| 3 | part-harness | Harness | chapter card | orange `#E8582A` | `part` (empty) |
| 3.1 | tool-calling | Harness | read | `#5A564E` | `tools` |
| 3.2 | agent ★ | Harness | **watch** | orange `#E8582A` | `agent` |
| 3.3 | mcp | Harness | **watch** | `#4A4740` | `mcp` |
| 3.4 | skill | Harness | read | `#3D3B36` | `skill` |
| 3.5 | multi-agent | Harness | read | `#302E2A` | `subagents` |
| 3.6 | agent-apps ★ | Harness | read | `#1C1A17` | `agents` |
| — | unwrap | finale | **watch** | night `#0A0A09` | `unwrap` |

---

## Sections

Canonical English copy. Watch captions are listed in order; their `at`
timings (scene progress) live in `sections.ts` beside the text and are tuned
to each scene's beats.

### hero

- **Loader (before the hero):** a bar of 16 pixel cells fills as the page
  gets ready (fonts loaded, never under ~1.1 s so it doesn't flicker), with a
  *Loading tokens 000%* readout. When it completes, the bar collapses into
  one accent square, the overlay fades, the headline fades up — and the
  stickers **burst out of the centre** to their spots.
- **Layout:** the headline sits **in the centre**, framed by a compact band
  of concentric pixel rectangles (scene `hero`, up to four — as many as fit
  before the HUD) that hug the text; accent corner brackets mark the
  innermost box — the headline is the model, in its box.
- **Buzzword soup:** terms from the page (LLM, MCP, RAG, Agent, Skill,
  OpenClaw, Token, Memory, Claude Code, Codex, Context window, Thinking,
  AGENTS.md, …) as pixel stickers **scattered all around the headline** (not
  orbiting). Each floats in place, hops now and then, and some have blinking
  pixel eyes. The scatter is seeded best-candidate sampling: evenly spread,
  the same on every visit, never touching the headline, the HUD, or another
  sticker. On small screens the lowest-priority terms are left out. Every
  sticker is a button that **jumps to the topic that explains it** (e.g.
  MCP → 3.3; Memory and AGENTS.md → 2.4; Thinking → 1.3; Claude Code, Codex,
  OpenClaw → 3.6). Scrolling pulls each sticker back into the headline (the
  burst, reversed); then the boxes peel away outward.
- **Kicker:** A SCROLLING FIELD GUIDE · **Title:** From LLM to Agent
- **Lede (short — the details come later):** A new AI word every month. Most
  are the same model in a new box.
- **Line:** Model · Memory · Harness — three solid black chips; each jumps
  to its chapter card.

### Chapter 1 — Model · *Where the intelligence comes from.*

- **Chapter card (`part-model`):** giant pixel numeral `01`, kicker
  *Chapter 1 of 3*, title **Model**, thesis, and contents: 1.1 Next token ·
  1.2 Scaling law · 1.3 Chain of thought.

### 1.1 · next-token (read)

- **Scene `tokens`:** the demo's sentence as token blocks (one block per
  token, widths follow the words) and a framed list of the top three
  candidates with their bars. Scrolling picks the likeliest, lifts it into the
  slot, appends it (the newest generated token in accent) and asks again — the
  autoregressive loop, in step with the demo beside it.
- **Analogy:** Think of your phone's autocomplete — trained on a library's
  worth of text, and very, very good at guessing.
- **Title:** An LLM does exactly one thing
- **Body:** It reads a sequence of tokens and predicts the next one. Then it
  appends its guess and does it again. Chat, code, poems, "reasoning" — all of
  it is this one step on repeat. / Tokens are word-pieces — in English, roughly
  ¾ of a word each. The model never sees letters, only numbers that stand for
  tokens.
- **Demo (scroll-linked, in step with the scene):** the text so far, a `?`
  slot, and probability bars for the candidates. Each step the bars grow in,
  the top candidate highlights, it is appended, and the `?` moves on. Four
  appended tokens, then the next question stays open — all labeled
  *illustrative*:
  1. `The cat sat on the` → ` mat` 41%, ` floor` 17%, ` sofa` 12%,
     ` windowsill` 6%, ` keyboard` 4%
  2. `… mat` → `.` 46%, ` and` 21%, `,` 12%, ` while` 5%, ` with` 3%
  3. `… mat.` → ` It` 31%, ` The` 19%, ` She` 8%, ` Then` 6%, ` He` 4%
  4. `… It` → ` purred` 26%, ` was` 21%, ` looked` 8%, ` yawned` 6%,
     ` fell` 4%
  5. `… It purred` → `.` 38%, ` softly` 17%, ` happily` 9%, ` loudly` 7%,
     `,` 6% (left open)
- **Formula:** `LLM(tokens) → next token`

### 1.2 · scaling-law ★ (headline card, then its own stage)

- **Scene `scaling`:** pixels **fly in from every direction and converge
  on the centre**, settling into the shape of a brain. The more pixels have
  arrived (the bigger the model), the clearer the brain gets. No face. As it
  grows, the brain also **lights up in colour**, fold by fold (blue, violet,
  magenta, crimson, orange; the rim stays dark): a small model is plain ink,
  the frontier brain a full multi-colour map — more colour, more
  intelligence.
- **Analogy:** Like a photo gaining pixels: the same picture, sharper at
  every step.
- **Title:** Make it bigger. It gets better — predictably.
- **Body:** In 2020, researchers at OpenAI found that a language model's
  error falls along a smooth power law as you scale up three things together:
  parameters (the model's adjustable numbers — its "size"), training data, and
  compute (the computing power spent on training). You could draw the curve
  before training the model.
- **Formula:** `L(N) ≈ (N_c / N)^0.076` (`_c` renders as a subscript),
  glossed underneath as "L = error, N = parameters · Kaplan et al., 2020".
  The chart's axes read *scale (log)* and *error (log)*.
- **Milestones** (counters interpolate log-linearly, resting on exact values):

  | Model | Year | Parameters | Training tokens | Caption |
  |-------|------|-----------:|----------------:|---------|
  | GPT-1 | 2018 | 117M | — | Writes text that looks like sentences. |
  | GPT-2 | 2019 | 1.5B | — | Coherent paragraphs. Released in stages over misuse concerns. |
  | GPT-3 | 2020 | 175B | 300B | Learns a new task from a few examples in the prompt. |
  | Chinchilla | 2022 | 70B | 1.4T | Smaller, fed far more data — and beat the 280B Gopher. Data matters as much as size. |
  | Llama 3.1 | 2024 | 405B | 15T+ | Free to download — its weights (the trained numbers) are public — and it rivals the best. |
  | Kimi K3 | 2026 | 2.8T (104B active) | not stated | 2.8 trillion parameters, free to download — though each token only uses 104 billion of them (a "mixture of experts"). |
  | Frontier | now | undisclosed | undisclosed | The biggest closed (not downloadable) models don't publish their sizes. |

- **Closing (no answer, by design):** the copy steps aside for **Would the
  scaling law plateau?** — *No answer here. Hold the question and keep
  scrolling.* The chart's line forks at the frontier into two dashed branches
  (one keeps falling, one flattens). Then, with more scrolling: the question
  and the brain fade, and **the chart zooms to the centre** and holds; with
  more scrolling still, the chart leaves and the next topic comes in. Never
  add hints or a verdict.

### 1.3 · thinking — Chain of thought (read)

- **Scene `thinking`:** a solid question row, a dashed (usually hidden)
  scratchpad of accent "working" tokens, and the answer's slot below. An
  effort meter on the right rises as you scroll; the scratchpad is written
  out row by row and pushes the answer's slot down. The answer stays a faint
  slot while the working is written, and lands solid once it is done — the
  thinking tokens come first.
- **Label / kicker:** Chain of thought (section id stays `thinking`).
- **Analogy:** Like showing your work on a maths test: more steps on paper,
  fewer careless answers.
- **Title:** It can't stop to think, so it thinks on paper
- **Body:** A model can't pause to think — it only ever writes the next
  token. So it thinks on paper: write the steps out, and each new token can
  build on the ones before. Showing big models how to write out this "chain
  of thought" made them clearly better at maths and logic problems (2022). /
  Reasoning models have the habit built in: before replying, they write
  "thinking" tokens you usually don't see. How much they think can be
  dialed from outside with a "reasoning effort" setting.
- **Code:** `<thinking> 17 × 24 … 17 × 20 = 340, 17 × 4 = 68, 340 + 68 = 408.
  </thinking> <answer> 408`
- **Formula:** `Chain of thought = next tokens, spent before the answer`

### Chapter 2 — Memory · *AI doesn't have memory. It only has context.*

- **Chapter card (`part-memory`):** numeral `02`, kicker *Chapter 2 of 3*,
  title **Memory**, thesis, and contents: 2.1 Chat · 2.2 System prompt ·
  2.3 Context window · 2.4 Agent files · 2.5 RAG.

### 2.1 · chat (read → **watch**)

- **Scene `chat`:** two parts.
  - **Read act — the problem, on a loop** (time-driven, while you read): a
    short conversation builds up under "SESSION 1"; a **NEW SESSION** starts,
    the old bubbles vanish, "what did I ask?" is sent — and the model can
    only answer **?**. Then it repeats. (Reduced motion: the "?" moment.)
  - **Watch act — the fix:** four chat bubbles slide into one column, get
    role tags, and a single frame closes around them: the whole history,
    re-sent as one strip of text.
- **Lede:** We now have a huge next-token predictor. It can't remember you,
  read your files, look anything up, or press a single button. Everything from
  here on is a box built around it.
- **Analogy:** Like a pen pal with no memory, who rereads every letter before
  replying.
- **Title:** The model forgets you after every reply
- **Body:** Each request starts from zero. To fake a conversation, the app
  re-sends the whole chat so far — every turn — as one long text, and asks for
  what comes next.
- **Code:** `<user> What's a token? / <assistant> A word-piece, about ¾ of a
  word. / <user> How many fit in one request? / <assistant> ▌`
- **Formula:** `Chat = LLM(history + new message)`
- **Watch:** Four messages, back and forth. It looks like a conversation. →
  Every turn slides into one column — it's really one long text. → Each turn
  is tagged with who said it, and the whole strip is sent again. → This strip
  is all the model ever sees. No strip, no memory.

### 2.2 · system-prompt (read)

- **Scene `system`:** several file cards — COMPANY, APP, SETTINGS, MEMORY —
  slide in one by one and stack into the prompt behind a curtain; on the
  user's side of the curtain the screen shows only their own message, while
  the model reads the whole stack.
- **Analogy:** Like a waiter's briefing before you sit down: house rules,
  today's specials, a note about your allergy — you never see it.
- **Title:** The prompt before your prompt
- **Body:** Before your message, the app sends the model hidden text, put
  together from several parts: rules from the company that runs the model
  (safety, today's date), the app's own instructions (its job, its tools, its
  format), your settings, plus anything it saved about you. You can't see
  it, but the model reads all of it before every reply.
- **Code (illustrative):** `<company> Be helpful and safe. Today is Friday. /
  <app> Help people cook. Tools: search. / <settings> Metric units. Keep it
  short. / <memory> Vegetarian. / # ── above this line: hidden from you ── /
  <user> What can I cook tonight?`
- **Formula:** `Assistant = LLM(company + app + settings + memory + chat)`

### 2.3 · context-window (read)

- **Scene `window`:** a long token strip slides through a fixed bright frame;
  tokens that leave it dim and dissolve.
- **Analogy:** Like a desk: only what fits on it can be worked on.
- **Title:** The strip has a maximum length
- **Body:** Everything the model considers at once — instructions, history,
  notes, documents — has to fit in its context window. GPT-3 (2020)
  took 2,048 tokens; many models today take hundreds of thousands, some a
  million. Overflow, and the oldest parts get dropped or summarized.
- **Note:** Choosing what goes into the window is called context engineering.
  It's most of the job from here on.
- **Formula:** `what the model knows right now ≤ context window`

### 2.4 · agent-files (read)

- **Placement:** the agent-files scene now sits in the **Memory** chapter
  (sand palette, dash mark) — agent files are how agents keep memory. It is
  not repeated in Harness.
- **Scene `agentfiles`:** a pixel file tree beside the agent, drawn as a
  session window that starts empty. The `AGENTS.MD` index card lights up
  first and streams into the agent (loaded first); then the agent opens one
  folder at a time — `CONTEXT`, then `SKILLS` — while the others stay closed
  (on demand); finally it writes a new note back into `MEMORY`, which glows.
- **Analogy:** Like an onboarding binder for a new teammate: read the index
  first, open the rest when needed.
- **Title:** Memory is just files, read back in
- **Body:** When an assistant "remembers" you, nothing inside the model
  changed: the app saved some text and pastes it back next time. Agents can
  keep theirs as a knowledge base of files — a short AGENTS.md (or CLAUDE.md)
  index, read first every session, plus folders of context to read, memory to
  update and skills to run, opened only when needed.
- **Code:** `AGENTS.md ← the index, read first / .agents/ / ├── context/ ←
  specs, product, setup / ├── memory/ ← notes the agent keeps / └── skills/
  ← procedures it can run`
- **Note:** Keep the index short — a long one pollutes the context. How smart
  an agent can be depends on two things: the model, and its agent files.
- **Formula:** `Memory = save text to files, read it back when needed`
- **Kept short on purpose:** the blog's worktree half (parallel agents on one
  repo) is left out — the page is about concepts, and 3.5 already covers
  splitting work across agents.

### 2.5 · rag ★ (read → **watch**)

- **Scene `rag`:** a grid of pages above the prompt strip; a scan line
  sweeps, three pages light up in accent and slide into the strip.
- **Analogy:** Like asking an expert a question — after handing them the
  three most relevant pages.
- **Title:** RAG is an open-book exam
- **Body:** Retrieval-Augmented Generation: before answering, the app
  searches your documents for the passages most relevant to the question and
  pastes the best few into the prompt. The model "knows" your handbook because
  someone handed it the right page.
- **Steps:** Split documents into chunks → Turn each chunk into a list of
  numbers that captures its meaning (an "embedding") → Do the same to the
  question, and find the chunks closest in meaning → Paste them into the
  prompt, then ask.
- **Formula:** `RAG = search + paste into prompt`
- **Watch:** Your documents, split into chunks. Below: the prompt, holding
  your question. → The search sweeps every chunk, comparing it with the
  question. → The three closest matches light up. → They're pasted into the
  prompt, ahead of your question. → Now the model answers from what it was
  handed — an open-book exam.

### Chapter 3 — Harness · *A model is a brain with no hands. The harness is how it touches the world.*

- **Chapter card (`part-harness`):** numeral `03`, kicker *Chapter 3 of 3*,
  title **Harness**, thesis, and contents: 3.1 Tool calling · 3.2 Agent
  loop · 3.3 MCP · 3.4 Skill · 3.5 Multi-agent · 3.6 Agent apps.

### 3.1 · tool-calling (read)

- **Scene `tools`:** a pixel brain (the model) in the middle with tools as
  its limbs: a hand that does things (edits a file, runs a program) and a
  foot that goes out and fetches (to a web page and back), joined to the
  brain by dotted request/result arrows.
- **Lede:** On its own, a model can only think in text. The harness is
  everything around it — tools, the loop, MCP, skills, sub-agents — each
  coming up next. It turns a chatbot into an agent. *(The blog's
  CPU-and-peripherals framing, simplified for a general audience.)*
- **Analogy:** The model is a brain. Tools are its hands and feet: hands to
  do things (edit a file, run a program), feet to go and fetch things
  (search the web, open a page).
- **Title:** The model can't run code. It can ask.
- **Body:** The prompt lists tools — a name, a description, and a
  fill-in-the-blanks form for the inputs. When a tool would help, the model
  fills in that form (below) instead of writing prose. Your program runs it
  and pastes the result back.
- **Code:** the model writes `{ "tool": "get_weather", "args": { "city":
  "Sydney" } }`; your code appends `<tool_result> 19°C, light rain
  </tool_result>`.
- **Note:** Pick the right tool: soup is easier with a spoon than with
  chopsticks. Models are best with text, so a command line usually beats
  clicking around a screen.
- **Formula:** `Tool use = LLM writes a request + your code runs it`

### 3.2 · agent ★ (read → **watch**)

- **Scene `agent`:** a thick pixel ring with think · act · observe nodes; a
  bright runner laps it; the message list inside grows each lap; a small lap
  counter ticks toward a limit; finally the model answers without a tool
  call and the runner leaves the ring through an exit with the answer.
- **Analogy:** Like fixing something yourself: try, look at what happened,
  try again — until it works.
- **Title:** An agent is a while-loop
- **Body:** Put tool calling in a loop and let the model decide when it's
  finished: think, act, observe, repeat. Coding agents, browser agents,
  research assistants — the same loop with different tools.
- **Code:** the 9-line loop: `while not over_limit():` (steps, budget) —
  the reply is appended ("think + act"); `if not reply.tool_calls: break`
  ("done → answer"); then each tool result ("observe").
- **Note:** When does it stop? When the model replies without asking for a
  tool — the job is done, or it needs to ask you something. Or when a limit
  cuts it off: too many steps, or the budget runs out.
- **Formula:** `Agent = loop(LLM + tools) until done`
- **Watch** (at → what the scene shows):
  - `0` — Three stops on a ring: think, act, observe. The bright dot is the
    agent going around. *(ring, nodes, runner starts)*
  - `0.2` — Each lap, the model asks for a tool, the harness runs it, and the
    result lands in the list. *(request out at ACT, result back at OBSERVE)*
  - `0.42` — The message list inside the ring keeps growing — the agent's
    record of what it has done. *(list rows stack up)*
  - `0.62` — A counter ticks every lap. Hit the limit — too many steps, or too
    much spent — and the loop is cut off. *(lap counter / limit bar fills
    toward a marked cap, but stays under it)*
  - `0.82` — This time the model answers without asking for a tool: done. The
    dot leaves the ring with the answer. *(runner exits through a gate into
    an answer box; the loop goes still)*

### 3.3 · mcp (read → **watch**)

- **Scene `mcp`:** an AI app in the middle and real-world services scattered
  around it as pixel tiles with pixel-font labels — **Notion, Google Drive,
  OneDrive, Slack** (tiles read NOTION, DRIVE, ONEDRIVE, SLACK) — **with no
  connecting lines**. Each tile has a
  different-shaped port: they speak different languages. An **MCP
  specification card** appears and stamps every port into the same shape (the
  protocol is a shared spec, not a hub). Then messages — small accent
  envelopes — fly freely between the app and any service. Finally a
  new service pops in already speaking MCP and joins straight away.
- **Analogy:** Like people from many countries settling on one shared
  language: English became the common standard, so nobody needs a phrasebook
  for every pair.
- **Title:** MCP is one language every tool can speak
- **Body:** Every app used to wire up tools its own way — N apps × M tools
  meant N×M integrations. The Model Context Protocol (Anthropic, 2024) is one
  shared standard: a tool provider (an "MCP server") lists its tools in one
  format, and any app that speaks MCP can use them. It doesn't make the model
  smarter. It makes tools reusable.
- **Code:** `tools/list` → `tools/call` JSON-RPC exchange.
- **Formula:** `MCP = tool calling, standardized`
- **Watch:** Notion, Google Drive, OneDrive, Slack… every service speaks its
  own language. → MCP is the shared language — one written spec for listing
  tools and calling them. Each service learns it once. *(the spec card stamps each port)* →
  Now any app that speaks MCP can talk to any of them — no custom wiring.
  *(envelopes fly freely)* → A new service that speaks MCP works with every
  app on day one. *(CALENDAR joins)*

### 3.4 · skill (read)

- **Scene `skill`:** five thin folder bars (descriptions only); one matches,
  turns accent, and expands into a full document.
- **Analogy:** Like a recipe card the cook only pulls out when that dish is
  ordered.
- **Title:** A Skill is a folder of know-how
- **Body:** A Skill packages a procedure: a SKILL.md with a name, a one-line
  description and step-by-step instructions, plus any scripts or templates it
  needs. Only the descriptions sit in the context; the full instructions load
  when a task matches. Tools give an agent hands. Skills give it a playbook.
- **Code:** `pdf-report/` folder tree.
- **Formula:** `Skill = prompt + files, loaded on demand`

### 3.5 · multi-agent (read)

- **Scene `subagents`:** a pixel office. The **manager** (the main agent)
  sits at a desk buried in a tall stack of papers (a full context window).
  Three **workers** (sub-agents) sit at clean, empty desks. The manager sends
  one task card to each worker; as it lands, a **chat bubble** pops up over
  the worker's screen (a fresh chat session; left out on phones, where there
  is no room above the screens); each works on its own screen with its own
  little loop; each sends back a single one-page summary, and the manager's
  desk ends up tidy. Pixel-font labels: MAIN AGENT, SUB-AGENTS.
- **Analogy:** Like a manager handing a task to a colleague with a clean desk
  — and getting back a one-page summary.
- **Title:** A sub-agent is just another tool
- **Body:** For big jobs, the main agent hands a piece to a sub-agent. Picture
  it opening another chat session: the main agent writes a brief, a fresh
  session with a clean context window and its own tools works on it, and only
  a short summary comes back. To the main agent, that whole session was one
  tool call.
- **Formula:** `Sub-agent = a fresh chat session, wrapped as a tool`

### 3.6 · agent-apps ★ (read)

- **Scene `agents`:** the same core in the middle the whole time — a model
  core inside the agent-loop ring — wearing **one shell after another**, each
  appearing as the previous one dissolves. Each shell carries an **iconic
  pixel mark** of its product: **Claude Code** — a radiating spark beside a
  terminal window; **Codex** — a knot-like rosette with a `>_` prompt (and a
  cloud: it also runs remotely); **OpenClaw** — a lobster claw with chat
  bubbles and a heartbeat line. A pixel-font name under each.
- **Product switcher (text column):** the name and one line change in step
  with the diagram:
  - **Claude Code** — Anthropic · in your terminal, editor or browser —
    reads, edits and runs your code.
  - **Codex** — OpenAI · in your terminal or in the cloud — reads, edits and
    runs your code.
  - **OpenClaw** — open source · in your chat apps — wakes every 30 minutes
    to work through a to-do list.
- **Analogy:** Like one actor in three costumes.
- **Title:** Every agent app is the same loop
- **Body:** Open any of them and you find the same parts: a model, the loop,
  tools (often over MCP), and agent files with memory and skills. What changes
  is the shell — where it runs, what it can touch, and when it wakes up.
- **Note:** That shell is also where the risk lives: an always-on agent holds
  the keys to your accounts.
- **Formula:** `Agent app = model + loop + tools + agent files, in a
  different shell`

### unwrap — finale (read → **watch**)

- **Scene `unwrap`:** the hero's nested boxes return and collapse inward,
  outermost first, until only the core is left: the next token.
- **Analogy:** Peel the boxes off one at a time, and the same thing is always
  inside.
- **Title:** Every new word, unwrapped
- **Ladder (read act):** Model → predicts the next token — bigger, and given
  room to think, it predicts better · Memory → there is none — only text
  pasted into the context window · Harness → tools, a loop, a socket, a
  playbook — so the text can act.
- **Closing (read act):** Next month there'll be a new word. Before you're
  impressed, ask one question per part.
- **Watch (while the boxes collapse, outermost first):** Harness — what can it
  touch, and who runs the loop? → Memory — what text is in the context
  window? → Model — where does the intelligence come from? → Next month's new word? Usually the
  same model, in a new box.
- **Formula:** `Agent = Model + Memory + Harness`
- **Footer:** two credit lines: 飞天闪客's video (YouTube · Bilibili) and the
  blog post *AI Agents: Memory, Harness, Model*. No reference list.

---

## Content rules

- **Three chapters, in order.** Every topic belongs to exactly one chapter:
  Model, Memory, or Harness. Nothing else lives at the top level.
- **Build order is sacred.** A section may only rely on concepts introduced
  above it.
- **One new idea per box.** If a section needs two new ideas, split it.
- **Facts carry sources.** Every number, date, or attribution must appear in
  [`references.md`](references.md). Illustrative numbers are labeled
  *illustrative* on the page.
- **Analogies are everyday.** No jargon inside an analogy; it must make sense
  to someone who has never written code.
- **Explain or avoid jargon in body copy.** Terms like JSON, embedding, or
  parameters get a few plain words the first time they appear; protocol
  details stay inside code blocks.
- **Captions get room to read.** Leave at least ~0.12 of scene progress
  between consecutive watch captions.
- **Watch acts are rare.** Only sections whose animation *is* the
  explanation get one; currently chat, RAG, agent loop, MCP, and the finale.
- **Labels inside diagrams** use the 3×5 pixel font (`pixelText`), in
  capitals, a few characters only (NOTION, MAIN AGENT, CODEX).
- **Real products as examples** (Notion, Google Drive, OneDrive, Slack,
  Claude Code, Codex, OpenClaw) are drawn as simple pixel-art nods to their
  icons (Claude's spark, a knot rosette, a lobster claw, an "N" tile…) with
  their names — never as traced or copied logos.
- **Captions describe what is on screen.** Each watch caption names what the
  diagram is doing at that moment, in plain words, in order.
- **Desktop fit.** Each read-act column must fit a 1280×720 viewport. Trim the
  copy before shrinking the type.
- **The plateau question stays unanswered.**
- **Language.** English first. Copy lives in one data file, so a 中文 version
  can be added as a parallel locale without touching layout.
