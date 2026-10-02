/**
 * ALL page copy lives here. Mirrors .agents/context/products/content-outline.md —
 * change the outline first (approval-gated), then this file.
 *
 * Three chapters, nothing else at the top level:
 *   1 · Model   — where the intelligence comes from
 *   2 · Memory  — AI doesn't have memory; it only has context
 *   3 · Harness — how AI touches the world
 * Every topic is nested in a chapter and numbered chapter.topic (2.3).
 */
import type { Side } from '../engine/layout';
import type { SceneId } from '../engine/scenes/types';

export type Palette = {
  /** page background */
  bg: string;
  /** text colour */
  ink: string;
  /** pixel (halftone) colour */
  px: string;
  /** highlighted pixels, formula chip, code tags */
  accent: string;
};

export type Code = { lang?: string; text: string };

/** A WATCH-act caption: shown from scene progress `at` until the next one. */
export type Caption = { at: number; text: string };

/** Halftone mark shape — each chapter has its own texture. */
export type Mark = 'square' | 'dash' | 'cross';

export type Chapter = {
  n: 1 | 2 | 3;
  name: string;
  /** one-line thesis */
  line: string;
  mark: Mark;
};

export const CHAPTERS: Chapter[] = [
  { n: 1, name: 'Model', line: 'Where the intelligence comes from.', mark: 'square' },
  { n: 2, name: 'Memory', line: 'AI doesn’t have memory. It only has context.', mark: 'dash' },
  { n: 3, name: 'Harness', line: 'A model is a brain with no hands. The harness is how it touches the world.', mark: 'cross' },
];

/** One product in the Agent apps switcher; `at` = scene progress where it takes over. */
export type Product = { at: number; name: string; by: string; where: string };

export type Section = {
  id: string;
  /** 'part' = a chapter opener card */
  kind: 'hero' | 'part' | 'concept' | 'scaling' | 'finale';
  /** short label for the HUD / progress rail */
  label: string;
  scene: SceneId;
  palette: Palette;
  /** desktop section height in vh (sticky phase = length − 100) */
  length: number;
  /** signature colour section that breaks the light → dark journey */
  highlight?: boolean;
  /** stack-trail wrapper added by this section (see StackTrail) */
  wrap?: string;
  /** which chapter this section belongs to (hero / finale: none) */
  chapter?: 1 | 2 | 3;
  /** "2.3" for topics, "2" for chapter openers — assigned below */
  num?: string;
  kicker: string;
  title: string;
  /** plain-English analogy shown on the headline card */
  analogy?: string;
  lede?: string;
  body?: string[];
  demo?: 'next-token';
  steps?: string[];
  code?: Code;
  /** Agent apps: the product switcher, synced to the scene */
  products?: Product[];
  note?: string;
  formula?: string;
  /**
   * Only the important sections get a WATCH act: the diagram takes the stage
   * and these captions narrate it, synced to the scene's progress.
   */
  watch?: Caption[];
  /** diagram side in the READ act — assigned below (concepts alternate) */
  art?: Side;
};

const PAPER = '#F2EFE7';
const INK_DARK = '#121212';
const INK_WARM = '#16130E';
const INK_LIGHT = '#F0ECE3';

/** section heights (vh): read-only sections are shorter than watch sections */
const READ = 250;
const WATCH = 340;

export const SECTIONS: Section[] = [
  {
    id: 'hero',
    kind: 'hero',
    label: 'Start',
    scene: 'hero',
    palette: { bg: PAPER, ink: INK_DARK, px: INK_DARK, accent: '#E8582A' },
    length: 210,
    kicker: 'A scrolling field guide',
    title: 'From LLM to Agent',
    lede: 'A new AI word every month. Most are the same model in a new box.',
  },

  // ── Chapter 1 — Model: where the intelligence comes from ──────────────
  {
    id: 'part-model',
    kind: 'part',
    label: 'Model',
    scene: 'part',
    palette: { bg: '#5DCB8A', ink: '#0B140E', px: '#0B0F0C', accent: PAPER },
    length: 240,
    chapter: 1,
    kicker: 'Chapter 1 of 3',
    title: 'Model',
  },
  {
    id: 'next-token',
    chapter: 1,
    kind: 'concept',
    label: 'Next token',
    scene: 'tokens',
    palette: { bg: '#EEEAE0', ink: INK_DARK, px: '#1B1B1B', accent: '#138A4E' },
    length: READ,
    wrap: 'LLM',
    kicker: 'Next-token prediction',
    title: 'An LLM does exactly one thing',
    analogy: 'Think of your phone’s autocomplete — trained on a library’s worth of text, and very, very good at guessing.',
    body: [
      'It reads a sequence of tokens and predicts the next one. Then it appends its guess and does it again. Chat, code, poems, “reasoning” — all of it is this one step on repeat.',
      'Tokens are word-pieces — in English, roughly ¾ of a word each. The model never sees letters, only numbers that stand for tokens.',
    ],
    demo: 'next-token',
    formula: 'LLM(tokens) → next token',
  },
  {
    id: 'scaling-law',
    chapter: 1,
    kind: 'scaling',
    label: 'Scaling law',
    scene: 'scaling',
    palette: { bg: '#5DCB8A', ink: '#0B140E', px: '#0B0F0C', accent: PAPER },
    length: 1000,
    highlight: true,
    wrap: 'LLM',
    kicker: 'Scaling law',
    title: 'Make it bigger. It gets better — predictably.',
    analogy: 'Like a photo gaining pixels: the same picture, sharper at every step.',
    body: [
      'In 2020, researchers at OpenAI found that a language model’s error falls along a smooth power law as you scale up three things together: parameters (the model’s adjustable numbers — its “size”), training data, and compute (the computing power spent on training). You could draw the curve before training the model.',
    ],
    formula: 'L(N) ≈ (N_c / N)^0.076',
  },
  {
    id: 'thinking',
    chapter: 1,
    kind: 'concept',
    label: 'Chain of thought',
    scene: 'thinking',
    palette: { bg: '#E9E5DA', ink: INK_DARK, px: '#1B1B1B', accent: '#138A4E' },
    length: READ,
    kicker: 'Chain of thought',
    title: 'It can’t stop to think, so it thinks on paper',
    analogy: 'Like showing your work on a maths test: more steps on paper, fewer careless answers.',
    body: [
      'A model can’t pause to think — it only ever writes the next token. So it thinks on paper: write the steps out, and each new token can build on the ones before. Showing big models how to write out this “chain of thought” made them clearly better at maths and logic problems (2022).',
      'Reasoning models have the habit built in: before replying, they write “thinking” tokens you usually don’t see. How much they think can be dialed from outside with a “reasoning effort” setting.',
    ],
    code: {
      text: `<thinking>  17 × 24 … 17 × 20 = 340, 17 × 4 = 68,
            340 + 68 = 408.
</thinking>
<answer>    408`,
    },
    formula: 'Chain of thought = next tokens, spent before the answer',
  },

  // ── Chapter 2 — Memory: AI doesn't have memory, it only has context ──
  {
    id: 'part-memory',
    kind: 'part',
    label: 'Memory',
    scene: 'part',
    palette: { bg: '#8FB4E3', ink: '#0B1526', px: '#0B1526', accent: PAPER },
    length: 240,
    chapter: 2,
    kicker: 'Chapter 2 of 3',
    title: 'Memory',
  },
  {
    id: 'chat',
    chapter: 2,
    kind: 'concept',
    label: 'Chat',
    scene: 'chat',
    palette: { bg: '#E8E1D1', ink: INK_WARM, px: '#1D1912', accent: '#2F67C9' },
    length: WATCH,
    wrap: 'chat',
    lede: 'We now have a huge next-token predictor. It can’t remember you, read your files, look anything up, or press a single button. Everything from here on is a box built around it.',
    kicker: 'Chat',
    title: 'The model forgets you after every reply',
    analogy: 'Like a pen pal with no memory, who rereads every letter before replying.',
    body: [
      'Each request starts from zero. To fake a conversation, the app re-sends the whole chat so far — every turn — as one long text, and asks for what comes next.',
    ],
    code: {
      text: `<user>       What's a token?
<assistant>  A word-piece, about ¾ of a word.
<user>       How many fit in one request?
<assistant>  ▌`,
    },
    formula: 'Chat = LLM(history + new message)',
    watch: [
      { at: 0, text: 'Four messages, back and forth. It looks like a conversation.' },
      { at: 0.18, text: 'Every turn slides into one column — it’s really one long text.' },
      { at: 0.4, text: 'Each turn is tagged with who said it, and the whole strip is sent again.' },
      { at: 0.7, text: 'This strip is all the model ever sees. No strip, no memory.' },
    ],
  },
  {
    id: 'system-prompt',
    chapter: 2,
    kind: 'concept',
    label: 'System prompt',
    scene: 'system',
    palette: { bg: '#E0D7C3', ink: INK_WARM, px: '#1D1912', accent: '#2F67C9' },
    length: READ,
    wrap: 'system',
    kicker: 'System prompt',
    title: 'The prompt before your prompt',
    analogy: 'Like a waiter’s briefing before you sit down: house rules, today’s specials, a note about your allergy — you never see it.',
    body: [
      'Before your message, the app sends the model hidden text, put together from several parts: rules from the company that runs the model (safety, today’s date), the app’s own instructions (its job, its tools, its format), your settings, plus anything it saved about you. You can’t see it, but the model reads all of it before every reply.',
    ],
    code: {
      text: `<company>   Be helpful and safe. Today is Friday.
<app>       Help people cook. Tools: search.
<settings>  Metric units. Keep it short.
<memory>    Vegetarian.
# ── above this line: hidden from you ──
<user>      What can I cook tonight?`,
    },
    formula: 'Assistant = LLM(company + app + settings + memory + chat)',
  },
  {
    id: 'context-window',
    chapter: 2,
    kind: 'concept',
    label: 'Context window',
    scene: 'window',
    palette: { bg: '#D7CDB7', ink: INK_WARM, px: '#1D1912', accent: '#2A5DB8' },
    length: READ,
    wrap: 'window',
    kicker: 'Context window',
    title: 'The strip has a maximum length',
    analogy: 'Like a desk: only what fits on it can be worked on.',
    body: [
      'Everything the model considers at once — instructions, history, notes, documents — has to fit in its context window. GPT-3 (2020) took 2,048 tokens; many models today take hundreds of thousands, some a million. Overflow, and the oldest parts get dropped or summarized.',
    ],
    note: 'Choosing what goes into the window is called context engineering. It’s most of the job from here on.',
    formula: 'what the model knows right now ≤ context window',
  },
  {
    // Agent files live in Memory (not Harness): they are how an agent keeps memory.
    id: 'agent-files',
    chapter: 2,
    kind: 'concept',
    label: 'Agent files',
    scene: 'agentfiles',
    palette: { bg: '#CDC2A8', ink: INK_WARM, px: '#1A160F', accent: '#2753A6' },
    length: READ,
    wrap: 'memory',
    kicker: 'Agent files',
    title: 'Memory is just files, read back in',
    analogy: 'Like an onboarding binder for a new teammate: read the index first, open the rest when needed.',
    body: [
      'When an assistant “remembers” you, nothing inside the model changed: the app saved some text and pastes it back next time. Agents can keep theirs as a knowledge base of files — a short AGENTS.md (or CLAUDE.md) index, read first every session, plus folders of context to read, memory to update and skills to run, opened only when needed.',
    ],
    code: {
      text: `AGENTS.md        ← the index, read first
.agents/
├── context/     ← specs, product, setup
├── memory/      ← notes the agent keeps
└── skills/      ← procedures it can run`,
    },
    note: 'Keep the index short — a long one pollutes the context. How smart an agent can be depends on two things: the model, and its agent files.',
    formula: 'Memory = save text to files, read it back when needed',
  },
  {
    id: 'rag',
    chapter: 2,
    kind: 'concept',
    label: 'RAG',
    scene: 'rag',
    palette: { bg: '#8FB4E3', ink: '#0B1526', px: '#0B1526', accent: PAPER },
    length: WATCH,
    highlight: true,
    wrap: 'rag',
    kicker: 'RAG',
    title: 'RAG is an open-book exam',
    analogy: 'Like asking an expert a question — after handing them the three most relevant pages.',
    body: [
      'Retrieval-Augmented Generation: before answering, the app searches your documents for the passages most relevant to the question and pastes the best few into the prompt. The model “knows” your handbook because someone handed it the right page.',
    ],
    steps: [
      'Split documents into chunks',
      'Turn each chunk into a list of numbers that captures its meaning (an “embedding”)',
      'Do the same to the question, and find the chunks closest in meaning',
      'Paste them into the prompt, then ask',
    ],
    formula: 'RAG = search + paste into prompt',
    watch: [
      { at: 0, text: 'Your documents, split into chunks. Below: the prompt, holding your question.' },
      { at: 0.12, text: 'The search sweeps every chunk, comparing it with the question.' },
      { at: 0.32, text: 'The three closest matches light up.' },
      { at: 0.46, text: 'They’re pasted into the prompt, ahead of your question.' },
      { at: 0.78, text: 'Now the model answers from what it was handed — an open-book exam.' },
    ],
  },

  // ── Chapter 3 — Harness: how AI touches the world ─────────────────────
  {
    id: 'part-harness',
    kind: 'part',
    label: 'Harness',
    scene: 'part',
    palette: { bg: '#E8582A', ink: '#0E0E0E', px: '#0E0E0E', accent: PAPER },
    length: 240,
    chapter: 3,
    kicker: 'Chapter 3 of 3',
    title: 'Harness',
  },
  {
    id: 'tool-calling',
    chapter: 3,
    kind: 'concept',
    label: 'Tool calling',
    scene: 'tools',
    palette: { bg: '#5A564E', ink: INK_LIGHT, px: '#F0ECE3', accent: '#FF8A4C' },
    length: READ,
    wrap: 'tools',
    lede: 'On its own, a model can only think in text. The harness is everything around it — tools, the loop, MCP, skills, sub-agents — each coming up next. It turns a chatbot into an agent.',
    kicker: 'Tool calling',
    title: 'The model can’t run code. It can ask.',
    analogy: 'The model is a brain. Tools are its hands and feet: hands to do things (edit a file, run a program), feet to go and fetch things (search the web, open a page).',
    body: [
      'The prompt lists tools — a name, a description, and a fill-in-the-blanks form for the inputs. When a tool would help, the model fills in that form (below) instead of writing prose. Your program runs it and pastes the result back.',
    ],
    code: {
      lang: 'js',
      text: `// the model writes:
{ "tool": "get_weather", "args": { "city": "Sydney" } }
// your code runs it, then appends:
<tool_result> 19°C, light rain </tool_result>`,
    },
    note: 'Pick the right tool: soup is easier with a spoon than with chopsticks. Models are best with text, so a command line usually beats clicking around a screen.',
    formula: 'Tool use = LLM writes a request + your code runs it',
  },
  {
    id: 'agent',
    chapter: 3,
    kind: 'concept',
    label: 'Agent loop',
    scene: 'agent',
    palette: { bg: '#E8582A', ink: '#0E0E0E', px: '#0E0E0E', accent: PAPER },
    length: WATCH,
    highlight: true,
    wrap: 'loop',
    kicker: 'Agent loop',
    title: 'An agent is a while-loop',
    analogy: 'Like fixing something yourself: try, look at what happened, try again — until it works.',
    body: [
      'Put tool calling in a loop and let the model decide when it’s finished: think, act, observe, repeat. Coding agents, browser agents, research assistants — the same loop with different tools.',
    ],
    code: {
      lang: 'py',
      text: `messages = [system_prompt, user_goal]
while not over_limit():              # steps, budget
    reply = llm(messages, tools)
    messages.append(reply)           # think + act
    if not reply.tool_calls:
        break                        # done → answer
    for call in reply.tool_calls:
        messages.append(run(call))   # observe
print(reply.text)`,
    },
    note: 'When does it stop? When the model replies without asking for a tool — the job is done, or it needs to ask you something. Or when a limit cuts it off: too many steps, or the budget runs out.',
    formula: 'Agent = loop(LLM + tools) until done',
    watch: [
      { at: 0, text: 'Three stops on a ring: think, act, observe. The bright dot is the agent going around.' },
      { at: 0.2, text: 'Each lap, the model asks for a tool, the harness runs it, and the result lands in the list.' },
      { at: 0.42, text: 'The message list inside the ring keeps growing — the agent’s record of what it has done.' },
      { at: 0.62, text: 'A counter ticks every lap. Hit the limit — too many steps, or too much spent — and the loop is cut off.' },
      { at: 0.82, text: 'This time the model answers without asking for a tool: done. The dot leaves the ring with the answer.' },
    ],
  },
  {
    id: 'mcp',
    chapter: 3,
    kind: 'concept',
    label: 'MCP',
    scene: 'mcp',
    palette: { bg: '#4A4740', ink: INK_LIGHT, px: '#F0ECE3', accent: '#FF8A4C' },
    length: WATCH,
    wrap: 'mcp',
    kicker: 'MCP',
    title: 'MCP is one language every tool can speak',
    analogy: 'Like people from many countries settling on one shared language: English became the common standard, so nobody needs a phrasebook for every pair.',
    body: [
      'Every app used to wire up tools its own way — N apps × M tools meant N×M integrations. The Model Context Protocol (Anthropic, 2024) is one shared standard: a tool provider (an “MCP server”) lists its tools in one format, and any app that speaks MCP can use them. It doesn’t make the model smarter. It makes tools reusable.',
    ],
    code: {
      text: `→ {"method": "tools/list"}
← {"tools": [{"name": "search_issues", "inputSchema": {…}}]}
→ {"method": "tools/call", "params": {"name": "search_issues", …}}`,
    },
    formula: 'MCP = tool calling, standardized',
    watch: [
      { at: 0, text: 'Notion, Google Drive, OneDrive, Slack… every service speaks its own language.' },
      { at: 0.2, text: 'MCP is the shared language — one written spec for listing tools and calling them. Each service learns it once.' },
      { at: 0.45, text: 'Now any app that speaks MCP can talk to any of them — no custom wiring.' },
      { at: 0.76, text: 'A new service that speaks MCP works with every app on day one.' },
    ],
  },
  {
    id: 'skill',
    chapter: 3,
    kind: 'concept',
    label: 'Skill',
    scene: 'skill',
    palette: { bg: '#3D3B36', ink: INK_LIGHT, px: '#EDE8DD', accent: '#FF8A4C' },
    length: READ,
    wrap: 'skills',
    kicker: 'Skill',
    title: 'A Skill is a folder of know-how',
    analogy: 'Like a recipe card the cook only pulls out when that dish is ordered.',
    body: [
      'A Skill packages a procedure: a SKILL.md with a name, a one-line description and step-by-step instructions, plus any scripts or templates it needs. Only the descriptions sit in the context; the full instructions load when a task matches. Tools give an agent hands. Skills give it a playbook.',
    ],
    code: {
      text: `pdf-report/
├── SKILL.md        ← name, description, steps
├── template.html
└── scripts/render.py`,
    },
    formula: 'Skill = prompt + files, loaded on demand',
  },
  {
    id: 'multi-agent',
    chapter: 3,
    kind: 'concept',
    label: 'Multi-agent',
    scene: 'subagents',
    palette: { bg: '#302E2A', ink: INK_LIGHT, px: '#E6E1D6', accent: '#FF8A4C' },
    length: READ,
    wrap: 'sub-agents',
    kicker: 'Multi-agent',
    title: 'A sub-agent is just another tool',
    analogy: 'Like a manager handing a task to a colleague with a clean desk — and getting back a one-page summary.',
    body: [
      'For big jobs, the main agent hands a piece to a sub-agent. Picture it opening another chat session: the main agent writes a brief, a fresh session with a clean context window and its own tools works on it, and only a short summary comes back. To the main agent, that whole session was one tool call.',
    ],
    formula: 'Sub-agent = a fresh chat session, wrapped as a tool',
  },
  {
    id: 'agent-apps',
    chapter: 3,
    kind: 'concept',
    label: 'Agent apps',
    scene: 'agents',
    palette: { bg: '#1C1A17', ink: INK_LIGHT, px: '#EDE8DD', accent: '#FF6B3D' },
    length: 300,
    highlight: true,
    wrap: 'app',
    kicker: 'Agent apps',
    title: 'Every agent app is the same loop',
    analogy: 'Like one actor in three costumes.',
    body: [
      'Open any of them and you find the same parts: a model, the loop, tools (often over MCP), and agent files with memory and skills. What changes is the shell — where it runs, what it can touch, and when it wakes up.',
    ],
    products: [
      { at: 0, name: 'Claude Code', by: 'Anthropic', where: 'In your terminal, editor or browser — reads, edits and runs your code.' },
      { at: 0.34, name: 'Codex', by: 'OpenAI', where: 'In your terminal or in the cloud — reads, edits and runs your code.' },
      { at: 0.67, name: 'OpenClaw', by: 'open source', where: 'In your chat apps — wakes every 30 minutes to work through a to-do list.' },
    ],
    note: 'That shell is also where the risk lives: an always-on agent holds the keys to your accounts.',
    formula: 'Agent app = model + loop + tools + agent files, in a different shell',
  },

  // ── Finale ─────────────────────────────────────────────────────────────
  {
    id: 'unwrap',
    kind: 'finale',
    label: 'Unwrap',
    scene: 'unwrap',
    palette: { bg: '#0A0A09', ink: PAPER, px: PAPER, accent: '#E8582A' },
    length: WATCH,
    kicker: 'Unwrap',
    title: 'Every new word, unwrapped',
    analogy: 'Peel the boxes off one at a time, and the same thing is always inside.',
    formula: 'Agent = Model + Memory + Harness',
    watch: [
      { at: 0, text: 'Harness — what can it touch, and who runs the loop?' },
      { at: 0.25, text: 'Memory — what text is in the context window?' },
      { at: 0.5, text: 'Model — where does the intelligence come from?' },
      { at: 0.75, text: 'Next month’s new word? Usually the same model, in a new box.' },
    ],
  },
];

// Numbering (2.3) and alternating diagram sides (right, left, …; restarting
// at each chapter so every chapter opens the same way).
{
  let left = false;
  let topic = 0;
  for (const s of SECTIONS) {
    if (s.kind === 'part') {
      topic = 0;
      left = false;
      s.num = String(s.chapter);
    } else if (s.chapter) {
      topic += 1;
      s.num = `${s.chapter}.${topic}`;
    }
    if (s.kind === 'concept') {
      s.art = left ? 'left' : 'right';
      left = !left;
    } else {
      s.art = s.kind === 'hero' ? 'center' : 'right';
    }
  }
}

export const chapterOf = (s: Section): Chapter | undefined => CHAPTERS.find((c) => c.n === s.chapter);

/** Topics inside a chapter, for the chapter card's contents list. */
export const topicsOf = (n: number): Section[] => SECTIONS.filter((s) => s.chapter === n && s.kind !== 'part');

// ── Section-specific content ────────────────────────────────────────────

export type Milestone = {
  model: string;
  year: string;
  /** parameter count, or null when undisclosed */
  params: number | null;
  /** training tokens, or null when unpublished/undisclosed */
  tokens: number | null;
  /** display override for the tokens figure, e.g. "15T+" */
  tokensLabel?: string;
  caption: string;
};

export const SCALING = {
  milestones: [
    { model: 'GPT-1', year: '2018', params: 117e6, tokens: null, caption: 'Writes text that looks like sentences.' },
    { model: 'GPT-2', year: '2019', params: 1.5e9, tokens: null, caption: 'Coherent paragraphs. Released in stages over misuse concerns.' },
    { model: 'GPT-3', year: '2020', params: 175e9, tokens: 300e9, caption: 'Learns a new task from a few examples in the prompt.' },
    { model: 'Chinchilla', year: '2022', params: 70e9, tokens: 1.4e12, caption: 'Smaller, fed far more data — and beat the 280B Gopher. Data matters as much as size.' },
    { model: 'Llama 3.1', year: '2024', params: 405e9, tokens: 15e12, tokensLabel: '15T+', caption: 'Free to download — its weights (the trained numbers) are public — and it rivals the best.' },
    { model: 'Kimi K3', year: '2026', params: 2.8e12, tokens: null, tokensLabel: 'not stated', caption: '2.8 trillion parameters, free to download — though each token only uses 104 billion of them (a “mixture of experts”).' },
    { model: 'Frontier', year: 'now', params: null, tokens: null, caption: 'The biggest closed (not downloadable) models don’t publish their sizes.' },
  ] satisfies Milestone[],
  labels: {
    params: 'Parameters',
    tokens: 'Training tokens',
    year: 'Year',
    undisclosed: 'undisclosed',
    chartX: 'scale (log)',
    chartY: 'error (log)',
    chartNote: 'schematic power law',
    unknown: '?',
    cite: 'L = error, N = parameters · Kaplan et al., 2020',
  },
  question: 'Would the scaling law plateau?',
  questionSub: 'No answer here. Hold the question and keep scrolling.',
  /**
   * Beats inside the section (0..1 of its sticky progress). Written to CSS as
   * --ph-scaling-<key> by writePhaseVars — never duplicate them in CSS.
   */
  phases: {
    growStart: 0.12,
    growEnd: 0.6,
    copyOut: 0.64,
    questionStart: 0.66,
    questionEnd: 0.78,
    chartZoom: 0.8,
    chartZoomEnd: 0.86,
    chartOut: 0.93,
    chartOutEnd: 0.97,
  },
};

/**
 * The hero's buzzword soup: terms from the page as pixel stickers scattered
 * around the centred headline (seeded best-candidate placement, Hero.tsx).
 * Scrolling pulls each one into the headline. Listed in priority order — on small screens only the first ones
 * that fit are shown. Clicking one jumps to the topic that explains it (`to`).
 * size 1–3; face = tiny pixel eyes; accent = filled.
 */
/** `to` = the section id the sticker jumps to when clicked */
export type Buzzword = { w: string; to: string; size?: 1 | 2 | 3; face?: boolean; accent?: boolean };

export const HERO_WORDS: Buzzword[] = [
  { w: 'LLM', to: 'next-token', size: 3, face: true },
  { w: 'MCP', to: 'mcp', size: 3, accent: true },
  { w: 'RAG', to: 'rag', size: 3, face: true },
  { w: 'Agent', to: 'agent', size: 3, accent: true, face: true },
  { w: 'Skill', to: 'skill', size: 2 },
  { w: 'OpenClaw', to: 'agent-apps', size: 2, accent: true },
  { w: 'Token', to: 'next-token' },
  { w: 'Memory', to: 'agent-files', size: 2 },
  { w: 'Claude Code', to: 'agent-apps', size: 2 },
  { w: 'Prompt', to: 'system-prompt' },
  { w: 'Harness', to: 'part-harness', size: 2, face: true },
  { w: 'Codex', to: 'agent-apps', size: 2 },
  { w: 'Context window', to: 'context-window' },
  { w: 'Thinking', to: 'thinking', size: 2, face: true },
  { w: 'Tool calling', to: 'tool-calling' },
  { w: 'Scaling law', to: 'scaling-law' },
  { w: 'Sub-agent', to: 'multi-agent' },
  { w: 'Embedding', to: 'rag' },
  { w: 'Agent loop', to: 'agent' },
  { w: 'SKILL.md', to: 'skill' },
  { w: 'System prompt', to: 'system-prompt' },
  { w: 'AGENTS.md', to: 'agent-files' },
];

/**
 * 1.1's scroll-linked demo (and the `tokens` scene, which mirrors it). The
 * prompt is already tokenized (a leading space belongs to the token). Each
 * step is one prediction, likeliest first: the top candidate is appended and
 * the model asks again; the last prediction stays open. All illustrative.
 */
export const NEXT_TOKEN_DEMO = {
  prompt: ['The', ' cat', ' sat', ' on', ' the'],
  steps: [
    [
      { token: ' mat', p: 0.41 },
      { token: ' floor', p: 0.17 },
      { token: ' sofa', p: 0.12 },
      { token: ' windowsill', p: 0.06 },
      { token: ' keyboard', p: 0.04 },
    ],
    [
      { token: '.', p: 0.46 },
      { token: ' and', p: 0.21 },
      { token: ',', p: 0.12 },
      { token: ' while', p: 0.05 },
      { token: ' with', p: 0.03 },
    ],
    [
      { token: ' It', p: 0.31 },
      { token: ' The', p: 0.19 },
      { token: ' She', p: 0.08 },
      { token: ' Then', p: 0.06 },
      { token: ' He', p: 0.04 },
    ],
    [
      { token: ' purred', p: 0.26 },
      { token: ' was', p: 0.21 },
      { token: ' looked', p: 0.08 },
      { token: ' yawned', p: 0.06 },
      { token: ' fell', p: 0.04 },
    ],
    [
      { token: '.', p: 0.38 },
      { token: ' softly', p: 0.17 },
      { token: ' happily', p: 0.09 },
      { token: ' loudly', p: 0.07 },
      { token: ',', p: 0.06 },
    ],
  ],
  note: 'illustrative probabilities',
  spaceNote: '“·” marks a leading space inside the token',
  /** screen-reader labels */
  textLabel: 'Text so far',
  barsLabel: 'Likeliest next tokens',
};

/** Small interface labels (kept here so all user-facing words live in one file). */
export const UI = {
  plainWords: 'In plain words',
  watchLabel: 'What the diagram shows',
  scroll: 'Scroll',
  tokensRead: 'Tokens read',
  railLabel: 'Sections',
  boxes: (n: number) => (n <= 0 ? 'the bare model' : `${n} ${n === 1 ? 'box' : 'boxes'} around the model`),
  codeLabel: 'Code example',
  chapterContents: 'In this chapter',
  wordmark: { from: 'llm', to: 'agent', sr: ' to ' },
  chapter: (n: number, name: string) => `Chapter ${n} · ${name}`,
  productsLabel: 'Agent apps',
  goTo: (w: string) => `Jump to: ${w}`,
  heroChaptersLabel: 'The three chapters',
  goToChapter: (n: number, name: string) => `Jump to chapter ${n}: ${name}`,
  backToTop: 'Top',
  backToTopLabel: 'Back to the top',
  loading: 'Loading tokens',
  loadingLabel: 'Loading the page',
};

export const FINALE = {
  /** the three parts, collapsed into one line each */
  ladder: [
    { word: 'Model', is: 'predicts the next token — bigger, and given room to think, it predicts better' },
    { word: 'Memory', is: 'there is none — only text pasted into the context window' },
    { word: 'Harness', is: 'tools, a loop, a socket, a playbook — so the text can act' },
  ],
  closing: 'Next month there’ll be a new word. Before you’re impressed, ask one question per part.',
  watchLabel: 'one question per part',
  credit: {
    lead: 'Inspired by',
    author: '飞天闪客',
    title: '名词诈骗！一口气拆穿 Skill/MCP/RAG/Agent/OpenClaw 底层逻辑',
    youtube: 'https://www.youtube.com/watch?v=O9b8tLXCTYU',
    youtubeLabel: 'YouTube',
    bilibiliLabel: 'Bilibili',
    bilibili: 'https://www.bilibili.com/video/BV1ojfDBSEPv/',
    blogLead: 'Built on the blog posts',
    blogs: [
      { title: 'AI Agents: Memory, Harness, Model', href: 'https://lucascanoblog.com/archives/2412' },
      { title: 'Build the Superpower', href: 'https://lucascanoblog.com/archives/2366' },
    ],
    deeperLead: 'Go deeper with',
    deeperTitle: 'Stanford CS229 · Building Large Language Models (LLMs)',
    deeperBy: 'Yann Dubois',
    deeper: 'https://www.youtube.com/watch?v=9vM4p9NN0Ts',
  },
};
