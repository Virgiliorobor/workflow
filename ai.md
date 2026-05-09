# AI Integration Reference

All Claude API calls in this project happen in `backend/app.py`.  
There are two independent AI features, each with its own prompt and endpoint.

---

## Overview

| Feature | Endpoint | Trigger | Prompt file |
|---------|----------|---------|-------------|
| Improve workspace spec | `POST /api/improve` | "✦ Improve with AI" button in Results screen | `backend/prompts/improve.md` |
| Chat → pre-fill wizard | `POST /api/from-conversation` | Chat screen (up to 3 rounds) | `backend/prompts/conversation.md` |
| Improve skill starter | `POST /api/improve-skill` | "✦ Improve with AI" button in Skill Creator modal | `backend/prompts/improve-skill.md` |

All features use **Claude Sonnet 4.6** (`claude-sonnet-4-6`) via the official Anthropic Python SDK (`anthropic` package).

---

## Feature 1: Improve with AI (`/api/improve`)

### What it does
Takes the user's completed wizard answers (already in the Results screen) and returns an improved version: better stage descriptions, task triggers, routing notes, and filled-in voice patterns — without changing the user's intent.

### How it calls the API

```python
# in _call_claude(answers: dict)
message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=4096,
    system=SYSTEM_PROMPT,
    messages=[{"role": "user", "content": json.dumps(answers, ensure_ascii=False, indent=2)}],
)
```

- **System prompt:** `SYSTEM_PROMPT` (static, never changes between calls)
- **User message:** The full `answers` dict serialised to pretty-printed JSON
- **Max tokens:** 4096 (enough for the full spec + changelog)
- **Single turn:** One user message → one Claude response. No history.

### Request shape (from frontend)

```json
{
  "answers": {
    "project_name": "my-project",
    "description": "...",
    "archetype": "content",
    "stages": [ { "id": "01", "slug": "research", "label": "Research", "description": "", "task": "", "note": "" } ],
    "voice_patterns": "",
    "writing_prohibitions": "",
    "team_size": "Just me",
    "formats": ["Blog posts / articles"],
    "...": "any other archetype-specific fields"
  }
}
```

### Expected Claude response shape

```json
{
  "improvedAnswers": { "...": "same structure as answers, with improvements applied" },
  "changeLog": [
    { "field": "stages[0].task", "type": "filled", "message": "Added a task trigger phrase." }
  ]
}
```

### Validation applied after Claude responds

1. Strip accidental markdown fences (` ```json ... ``` `)
2. Parse JSON — raise `ValueError` if invalid
3. If `improvedAnswers.project_name` is missing → restore original `project_name` + add warning
4. If `improvedAnswers.stages` is invalid or has fewer than 2 entries → restore original stages + add warning
5. Clean every stage slug: lowercase-hyphenated, max 32 chars; derive from label if slug is empty

---

### `SYSTEM_PROMPT` — `backend/prompts/improve.md`

```
You are an expert in the Interpretable Context Methodology (ICM), a system for structuring AI workspaces using layered markdown files. Your job is to improve a user's workspace specification without changing their intent.

You will receive a JSON object representing the user's answers to a workspace wizard. Return ONLY valid JSON matching the same structure, with these improvements:

1. stage.description — if empty or vague, write a crisp 1-sentence description.
2. stage.task — if empty, write a natural-language trigger the user would say to Claude to start that stage (e.g. "Start the research phase for [topic]").
3. stage.note — if empty and the stage has a notable constraint, add a brief note.
4. description (root workspace description) — if short or unclear, expand to 1-2 clear sentences without inventing domain-specific claims.
5. voice_patterns — if sparse, add structure without inventing a voice.
6. writing_prohibitions — if empty, add 3 sensible defaults.
7. stage.slug — normalize to lowercase-hyphenated, max 24 chars; only change if currently invalid or empty.
8. Preserve all other fields exactly as they are — do NOT change archetype, formats, audience, project_name, team_size, or any field not listed above.

Return a JSON object with two keys:
- "improvedAnswers": the full answers object with your improvements applied.
- "changeLog": array of objects { "field": string, "type": "improved"|"filled"|"note", "message": string } describing each change made (max 12 entries; skip unchanged fields).

Return ONLY the JSON. No markdown fences, no explanations outside the JSON.
```

---

## Feature 2: Chat → pre-fill wizard (`/api/from-conversation`)

### What it does
Receives the user's conversational description of their project (and any follow-up messages), extracts all wizard fields it can, and either asks one or two follow-up questions or returns a complete `answers` object that pre-fills the wizard. Capped at 3 rounds — after round 3 it is forced to return answers regardless.

### How it calls the API

```python
# in _call_claude_conversation(messages: list[dict], round_num: int)
message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=2048,
    system=system,   # CONVERSATION_SYSTEM_PROMPT (+ FINAL ROUND suffix if round_num >= 3)
    messages=messages,   # full conversation history in Anthropic format
)
```

- **System prompt:** `CONVERSATION_SYSTEM_PROMPT`, with an extra `"\n\nFINAL ROUND: ..."` paragraph appended when `round_num >= 3`
- **User messages:** Full conversation history so far, in `[{"role": "user"|"assistant", "content": "..."}]` format
- **Max tokens:** 2048
- **Multi-turn:** Messages array grows each round — history is sent in full each time

### Message filtering before the API call

The Anthropic API requires the first message in the `messages` array to be a `user` message. Any leading `assistant` messages are stripped before calling:

```python
while api_messages and api_messages[0]["role"] != "user":
    api_messages.pop(0)
```

### Request shape (from frontend `js/chat.js`)

```json
{
  "messages": [
    { "role": "user", "content": "I want to build a YouTube channel about personal finance..." },
    { "role": "assistant", "content": "What formats do you mainly create?" },
    { "role": "user", "content": "Mostly long-form videos and a monthly newsletter." }
  ],
  "round": 1
}
```

- `round` starts at 0 (first user message), increments each trip
- The frontend keeps the full `messages` array in memory (not `localStorage`) and appends to it

### Expected Claude response shapes

**When more info is needed (`needs_more: true`):**
```json
{
  "needs_more": true,
  "follow_up": "Got it! What stages does your content go through — for example, research, scripting, recording?",
  "round": 1
}
```

**When Claude has enough info (`needs_more: false`):**
```json
{
  "needs_more": false,
  "answers": {
    "project_name": "finance-channel",
    "description": "A YouTube channel covering personal finance for young professionals.",
    "archetype": "content",
    "formats": ["YouTube long-form video", "Newsletter"],
    "process": "idea → research → script → record → edit → publish",
    "audience": "Young professionals aged 25–35 managing their first salary",
    "reference_material": "",
    "rejection_criteria": "",
    "stages": [
      { "id": "01", "slug": "research",    "label": "Research",    "description": "Gather data and sources for the topic.", "task": "Start research for [topic]", "note": "" },
      { "id": "02", "slug": "script",      "label": "Script",      "description": "Write and refine the video script.",    "task": "Write a script for [topic]", "note": "" },
      { "id": "03", "slug": "production",  "label": "Production",  "description": "Record, edit, and publish the video.",  "task": "Prep production checklist for [video]", "note": "" }
    ],
    "voice_patterns": "",
    "writing_prohibitions": "",
    "team_size": "Just me"
  },
  "summary": "A personal finance YouTube channel with newsletter, covering research through production.",
  "round": 2
}
```

### Validation applied after Claude responds

1. Strip accidental markdown fences
2. Parse JSON — raise `ValueError` if invalid
3. If `round_num >= 3`, override `needs_more` to `False` (force extraction)
4. If `needs_more: false` → validate and clean `answers`:
   - **`project_name`**: regex-clean to `[a-z0-9-]`, strip leading/trailing `-`, default `"my-workspace"`
   - **`archetype`**: must be one of `{content, freelancer, developer, smallbiz, custom}`, default `"custom"`
   - **`stages`**: if missing or fewer than 2 → replace with archetype-specific defaults from `_ARCHETYPE_STAGE_DEFAULTS`; otherwise clean each slug (lowercase-hyphenated, max 32 chars; derive from label if empty)
   - **Required string fields**: `description`, `voice_patterns`, `writing_prohibitions`, `team_size` — set empty defaults if absent

### Archetype stage defaults (used as fallback)

```python
_ARCHETYPE_STAGE_DEFAULTS = {
    "content":    [("Research", "research"), ("Script / Draft", "script"), ("Production", "production")],
    "freelancer": [("Discovery", "discovery"), ("Build", "build"), ("Review", "review"), ("Handoff", "handoff")],
    "developer":  [("Planning", "planning"), ("Build", "build"), ("Docs", "docs")],
    "smallbiz":   [("Intake", "intake"), ("Process", "process"), ("Deliver", "deliver")],
    "custom":     [("Stage 1", "stage-1"), ("Stage 2", "stage-2"), ("Stage 3", "stage-3")],
}
```

---

### `CONVERSATION_SYSTEM_PROMPT` — `backend/prompts/conversation.md`

```
You are collecting information to build an ICM (Interpretable Context Methodology) workspace spec. Your goal: extract enough from the conversation to fill as many wizard fields as possible, then return them as a single JSON answers object.

=== FIELDS REQUIRED FOR EVERY ARCHETYPE ===

project_name         string   lowercase-hyphenated (e.g. "my-content-studio")
description          string   1-2 sentences: what this workspace does
archetype            string   exactly one of: "content" | "freelancer" | "developer" | "smallbiz" | "custom"
                              content    = Content creators: videos, articles, newsletters, social posts
                              freelancer = Freelancers/consultants delivering client projects
                              developer  = Software developers: planning, coding, testing, deploying
                              smallbiz   = Small business with recurring operational workflows
                              custom     = Anything else
stages               array    2-5 stages, each object: {id, slug, label, description, task, note}
                              id   = zero-padded index ("01", "02", …)
                              slug = lowercase-hyphenated folder name (e.g. "research")
                              label = display name (e.g. "Research")
                              description = one sentence what happens here
                              task = trigger phrase (e.g. "Start research for [topic]")
                              note = routing note or ""
voice_patterns       string   3 patterns that describe the user's natural writing/communication style
writing_prohibitions string   AI writing patterns to avoid (em dashes, filler phrases, etc.)
team_size            string   exactly one of: "Just me" | "2–3 people" | "4+ people"

=== ARCHETYPE-SPECIFIC FIELDS — include ALL of these for the chosen archetype ===

archetype "content":
  formats             array    pick any from: ["YouTube long-form video", "YouTube Shorts / Reels",
                               "Blog posts / articles", "Newsletter", "Podcast", "LinkedIn posts",
                               "Twitter / X threads", "Instagram content", "TikTok",
                               "Course / educational content", "Other"]
  process             string   user's 2-4 step creation process (idea → published)
  audience            string   specific description of who the content is for
  reference_material  string   brand guides, style rules, topic lists reused across content
  rejection_criteria  string   patterns that would make the user immediately reject a draft

archetype "freelancer":
  deliverable         string   what they deliver to clients (format, length, structure)
  discovery           string   how engagements start / discovery process
  review_process      string   how client review works, revision policy
  failure_modes       string   recurring problems in engagements
  reference_material  string   templates, frameworks, prior work reused across clients
  post_delivery       string   what happens after delivery

archetype "developer":
  app_description     string   what they're building and what it does
  tech_stack          string   frontend, backend, database, deploy stack
  work_modes          array    pick any from: ["Planning / spec writing", "Writing code", "Testing",
                               "Documentation", "Code review", "Deployment / DevOps",
                               "Bug investigation", "Architecture design"]
  code_standards      string   naming conventions, patterns, rules the codebase follows
  rejection_criteria  string   what would make them reject AI-generated code

archetype "smallbiz":
  core_work           string   what the business does repeatedly
  intake              string   how work comes in and what information arrives with it
  process_steps       string   steps from work arriving to client receiving deliverable
  scope_boundaries    string   what they do and explicitly don't do
  quality_bar         string   what a good deliverable looks like

archetype "custom":
  what_you_do         string   what they do in this workspace
  reference_material  string   stable reference material used across all work
  failure_modes       string   what goes wrong; what the system should prevent

=== DECISION RULE ===

You MUST have project_name, description, archetype, and stages (≥2) to produce output.
For everything else: infer from context or leave as "" / []. Do NOT ask follow-up questions about voice_patterns, writing_prohibitions, or archetype-specific details — fill with sensible defaults or leave empty so the user can complete them in the wizard.

Ask follow-ups ONLY when you are missing project_name, archetype, or stages. Ask at most 1-2 targeted questions per round in a single, friendly message. Hard cap: after 3 rounds, produce output regardless.

=== RESPONSE FORMAT — JSON only, no markdown, no text outside the JSON ===

When you need more info:
{"needs_more": true, "follow_up": "your message", "round": <current_round + 1>}

When you have enough (or are forced to produce output):
{
  "needs_more": false,
  "answers": {
    "project_name": "...",
    "description": "...",
    "archetype": "...",
    [all archetype-specific fields for the chosen archetype],
    "stages": [...],
    "voice_patterns": "...",
    "writing_prohibitions": "...",
    "team_size": "Just me"
  },
  "summary": "1-2 sentence recap of the workspace",
  "round": <current_round + 1>
}
```

---

---

## Feature 3: Improve Skill Starter (`/api/improve-skill`)

### What it does
Takes a partially-filled skill definition from the Skill Creator modal and returns improved or completed values for all fields: a clearer purpose, a natural-language trigger phrase, suggested files to read, specific output description, and relevant safety constraints — all tailored to the workspace's archetype and stages.

### How it calls the API

```python
# in _call_claude_improve_skill(req: ImproveSkillRequest)
message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    system=_load_prompt("improve-skill"),
    messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False, indent=2)}],
)
```

- **System prompt:** `backend/prompts/improve-skill.md`
- **User message:** JSON object with all skill fields + workspace context (`archetype`, `stages`, `project_name`)
- **Max tokens:** 1024 (response is a small JSON object)
- **Single turn:** One user message → one Claude response

### Request shape (from `js/app.js` skill creator modal)

```json
{
  "name": "Draft YouTube script",
  "purpose": "",
  "trigger": "",
  "reads": [],
  "output": "",
  "constraints": [],
  "archetype": "content",
  "stages": [
    { "label": "Research", "slug": "research" },
    { "label": "Script", "slug": "script" },
    { "label": "Production", "slug": "production" }
  ],
  "project_name": "finance-channel"
}
```

### Expected Claude response shape

```json
{
  "name": "Draft YouTube script",
  "purpose": "Start the scripting stage with the right context — reads research output and applies voice and format patterns to produce a complete, publishable script.",
  "trigger": "Write a script for [topic] using the research in 01-research/output/",
  "reads": [
    "CLAUDE.md",
    "02-script/CONTEXT.md",
    "_config/voice-and-tone.md",
    "_config/constraints.md"
  ],
  "output": "A complete script in 02-script/output/, named [topic]-script.md",
  "constraints": [
    "Load _config/constraints.md before producing any written output.",
    "Do not invent facts not present in the research output.",
    "Follow the voice and format patterns in _config/voice-and-tone.md."
  ]
}
```

### Validation applied after Claude responds

1. Strip accidental markdown fences
2. Parse JSON — raise `ValueError` if invalid
3. `name` — falls back to request `name` if missing
4. `reads` / `constraints` — must be lists; falls back to request values if not
5. All string fields default to empty string if missing

### UX flow in the modal

1. User opens "✦ Skill" modal, types the skill name (required) and any other fields they know
2. Clicks "✦ Improve with AI" — button shows spinner and is disabled
3. On success: all form fields update in place with AI-improved values; toast confirms
4. On error: toast shows the error message; form fields unchanged; user can retry
5. User reviews the improved fields and clicks "Create Skill File →"

The "✦ Improve with AI" button is disabled when `state.backendAvailable` is `false` (same gate as all other AI features).

### `IMPROVE_SKILL_PROMPT` — `backend/prompts/improve-skill.md`

```
You are an expert in the Interpretable Context Methodology (ICM), a system for structuring AI workspaces using layered markdown files.

Your job is to improve or complete a skill starter definition. A skill starter is a reusable prompt template that tells Claude how to perform a specific, repeatable task inside a workspace. It lives in the skill-starters/ folder (ICM Layer 5).

You will receive a JSON object with these fields:
- name         — the skill's name (always present)
- purpose      — what this skill does (may be empty)
- trigger      — the phrase the user says to start this skill (may be empty)
- reads        — file paths to read before starting (may be empty)
- output       — what the skill produces and where (may be empty)
- constraints  — safety rules and constraints (may be empty)
- archetype    — the workspace type: "content" | "freelancer" | "developer" | "smallbiz" | "custom"
- stages       — array of {label, slug} for the workspace stages (may be empty)
- project_name — the workspace project name (may be empty)

Apply these improvements:

1. purpose — if empty or vague, write a clear 1-2 sentence description of what this skill does and when it produces good results.
2. trigger — if empty, write a natural-language phrase using [brackets] for variable parts.
3. reads — if empty, suggest files Claude should read first (always CLAUDE.md, relevant stage CONTEXT.md, voice/constraints configs).
4. output — if empty, describe what this skill produces and where (format and location).
5. constraints — if empty, add 2-4 relevant safety rules as an array of strings.
6. Preserve name exactly.

Return ONLY valid JSON: { "name", "purpose", "trigger", "reads": [], "output", "constraints": [] }
No markdown fences, no text outside the JSON.
```

---

## Round cap and FINAL ROUND injection

When `round_num >= 3`, the backend appends this paragraph to `CONVERSATION_SYSTEM_PROMPT` before calling the API:

```
FINAL ROUND: You MUST return needs_more=false and produce a complete answers object now, even if some fields need reasonable defaults.
```

The frontend (`js/chat.js`) also has `MAX_ROUNDS = 3` and displays a round indicator in the chat UI.

---

## Error handling

Both endpoints follow the same error-handling pattern:

| Exception | HTTP status | Surfaced to user |
|-----------|-------------|-----------------|
| `anthropic.AuthenticationError` | 502 | "Invalid Anthropic API key. Check ANTHROPIC_API_KEY in backend/.env." |
| `anthropic.APIStatusError` | 502 | The Anthropic error message (includes status code) |
| `ValueError` (JSON parse fail) | 502 | "Claude returned non-JSON: ..." |
| `ANTHROPIC_API_KEY` not set | 503 | "ANTHROPIC_API_KEY is not configured on the server." |
| Any other exception | 500 | "Unexpected error: ..." |

The frontend (`js/chat.js` and `js/app.js`) catches non-2xx responses and displays a user-friendly error bubble, then pops the failed message from history so the user can retry.

---

## Configuration

| Setting | Where | Default | Notes |
|---------|-------|---------|-------|
| Model | `backend/app.py` `_call_claude` / `_call_claude_conversation` | `claude-sonnet-4-6` | Change here to switch model for both features |
| Max tokens (improve) | `_call_claude` | `4096` | Enough for full spec + changelog |
| Max tokens (chat) | `_call_claude_conversation` | `2048` | Lower; only one round's JSON output |
| Max rounds | `backend/app.py` (`round_num >= 3`) and `js/chat.js` (`MAX_ROUNDS = 3`) | `3` | Must be kept in sync |
| Backend URL | `js/chat.js` → `window.ICM_BACKEND_URL` or `http://localhost:8000` | `http://localhost:8000` | Override via `<script>window.ICM_BACKEND_URL = '...';</script>` in `index.html` |
| API key | `backend/.env` → `ANTHROPIC_API_KEY` | — | Never exposed to the frontend |

---

## How to modify the prompts

Prompts live as plain-text Markdown files in `backend/prompts/`. They are **read from disk on every request** — no restart or reload required.

| Prompt | File |
|--------|------|
| Improve with AI | `backend/prompts/improve.md` |
| Chat → pre-fill wizard | `backend/prompts/conversation.md` |

**Workflow:**
1. Open the relevant file in any editor (or directly in Cursor).
2. Edit the prompt text.
3. Save.
4. Trigger the feature in the browser — the next request will use the updated prompt immediately.
5. Update this file if the change affects fields, decision rules, or the response format.

**How loading works (`_load_prompt` in `backend/app.py`):**
```python
def _load_prompt(name: str) -> str:
    path = Path(__file__).parent / "prompts" / f"{name}.md"
    return path.read_text(encoding="utf-8").strip()
```
The path is always relative to `app.py`, so it works regardless of which directory the server is launched from. If a file is missing, the server raises a `RuntimeError` with the expected path.

---

*Last updated: 2026-05-09*  
*See also: [`DEVELOPMENT.md`](DEVELOPMENT.md) for full architecture, module details, and changelog.*
