# ICM Workspace Builder — Development Notes

This document is the single source of truth for any agent or developer picking up this codebase.
It describes the full system as it currently stands — architecture, every module, every design decision, what is done, and what comes next.

---

## What This Is

A two-part system:

1. **Static web app** (`index.html` + `js/` + `css/`) — a guided wizard that asks diagnostic questions and generates a fully populated AI workspace folder structure based on the **Interpretable Context Methodology (ICM)**.
2. **Python backend** (`backend/app.py`) — a FastAPI server that calls Claude to improve the wizard spec. Optional — the frontend works fully without it.

**ICM** is a system developed by Eduba / Clief Notes for structuring AI workflows using layered markdown files (CLAUDE.md, CONTEXT.md, stage contracts, _config/ references, skill starters).

The frontend is a zero-dependency static app: no npm, no bundler, no Node. It runs with `python -m http.server 3000` and deploys by pointing Netlify at the repo root.

---

## Full File Structure

```
Workflow/
├── index.html                  ← Entry point. Three screen layouts. CDN scripts loaded here.
├── css/
│   └── styles.css              ← All styling. Dark theme. CSS custom properties. Responsive.
├── js/
│   ├── questions.js            ← Question content, archetype definitions, ICM teaching text
│   ├── generator.js            ← Turns answers into populated markdown file strings
│   ├── diagram.js              ← D3.js force-directed architecture diagram
│   └── app.js                  ← Wizard flow, state, live editing, AI flow, skill tools
├── backend/
│   ├── app.py                  ← FastAPI server. /api/health + /api/improve endpoints.
│   ├── requirements.txt        ← Python deps: fastapi, uvicorn, anthropic, python-dotenv, pydantic
│   ├── .env                    ← Local secrets (gitignored). Contains ANTHROPIC_API_KEY.
│   ├── .env.example            ← Template for .env
│   └── README.md               ← Backend setup and endpoint docs
├── References/                 ← Source materials. NOT deployed. NOT served publicly.
├── README.md                   ← User-facing README
└── DEVELOPMENT.md              ← This file
```

**CDN dependencies (loaded in `index.html`):**
- JSZip 3.10.1 — ZIP generation for download
- D3 7.9.0 — force simulation for architecture diagram

---

## Architecture: Four Screens

### Screen 1 — Home (`screen-home`)
- "Build a new workspace" → clears state, goes to archetype selection
- "✦ Build with AI conversation" → goes to the chat screen (disabled when backend is offline)
- Re-open existing project → drag/drop or file-picker loads `workspace-state.json` (v1 or v2 format)
- Resume banner → shown if localStorage has a wizard in progress
- Layer explainer showing L0–L5 with color-coded badges

### Screen 2 — Chat (`screen-chat`)
- Conversational entry point. User describes their project; Claude asks up to 3 targeted follow-ups.
- On completion, calls `POST /api/from-conversation` and hands the returned `answers` object to `app.enterWizardWithAnswers()`, which opens the wizard with all fields pre-filled.
- Chat messages are transient (not persisted to localStorage).
- Back button returns to home without saving anything.

### Screen 3 — Wizard (`screen-wizard`)
- Step 1: Archetype selection (5 options, rendered separately before the question loop)
- Steps 2–N: Flat question list, one at a time with progress bar
- Each question: input area + blue teaching box + optional hint
- State written to `localStorage` after every answer
- Back button restores the previous answer
- When entered from the chat flow, all fields are pre-filled from the AI answers — the user reviews and adjusts before clicking "Generate Workspace".

### Screen 4 — Results (`screen-results`)
- **Header**: project name, Edit Answers button, ✦ Improve with AI button, ⬇ Download button
- **Left panel**: file tree with layer badges and green dot on manually edited files. Header has "✦ Skill" (creator) and "↑ Import" (upload) buttons.
- **Right panel — File Preview tab**: click any file to preview; Edit / Reset / Copy buttons; full in-panel textarea editor
- **Right panel — Architecture Diagram tab**: D3 force graph, draggable nodes, hover tooltips, click to open file in preview

---

## Module Details

### `js/questions.js`

**Exports via `window.ICM`:**
- `ARCHETYPES` — array of 5 objects: `{ id, label, icon, description, stageDefaults, stageLabels }`
- `UNIVERSAL_QUESTIONS` — 2 questions for every archetype: `project_name`, `description`
- `ARCHETYPE_QUESTIONS` — keyed by archetype id, 5–6 questions each
- `VOICE_QUESTIONS` — 3 questions after archetype questions: `voice_patterns`, `writing_prohibitions`, `team_size`
- `STAGE_CONFIG_QUESTION` — the stage builder question (type: `stage_builder`)

**Question object shape:**
```js
{
  id: 'question_id',
  type: 'text' | 'textarea' | 'radio' | 'checkboxes' | 'stage_builder',
  label: 'The question text',
  placeholder: 'Input placeholder',
  hint: 'Optional hint below question',
  options: ['Option A', 'Option B'],  // radio/checkboxes only
  teaching: {
    title: 'Why this matters',
    body:  'ICM principle explanation...'
  }
}
```

**Stage object shape** (inside `state.answers.stages[]`):
```js
{
  id: '01',            // zero-padded index string
  slug: 'research',    // filesystem-safe folder name
  label: 'Research',   // display name
  description: '',     // one-sentence description of what happens
  task: '',            // task trigger phrase for routing table (e.g. "Start research for [topic]")
  note: ''             // optional routing note
}
```

---

### `js/generator.js`

**Exports via `window.ICM.generator`:**
- `generateAllFiles(answers)` → returns `{ 'project/path/file.md': 'content string', ... }`

**Files generated (always):**

| File | Layer | Content basis |
|------|-------|--------------|
| `CLAUDE.md` | L0 | project_name, description, archetype, stages → routing table, naming conventions |
| `CONTEXT.md` | L1 | All stages → stage map table, connections, review loop |
| `NN_slug/CONTEXT.md` | L2 | Per stage → Inputs / Process / Output / Must include / Must NOT / Done looks like |
| `NN_slug/output/.gitkeep` | L4 | Empty placeholder to create the output directory |
| `_config/voice-and-tone.md` | L3 | voice_patterns, audience |
| `_config/format-patterns.md` | L3 | formats checkboxes → one paragraph per format |
| `_config/constraints.md` | L3 | writing_prohibitions + 12 vault-toolkit hard rules |
| `README.md` | — | All answers → how to use, workflow steps, layer table |
| `workspace-state.json` | — | Base answers only (overrides are added by app.js in ZIP export) |
| `skill-starters/README.md` | L5 | Index of stage skill files |
| `skill-starters/NN_slug.md` | L5 | One skill template per stage |

**Extra files for `freelancer` archetype only:**
- `_config/client-brief.md`, `_config/engagement-terms.md`, `_config/scope-agreement.md`, `_references/README.md`

**Routing table:** `buildRoutingTable(stages)` uses `stage.task` if set; falls back to `"Work in <label>"`. Uses `stage.note` for the Notes column.

**Stage defaults:** `defaultProcess(stage, answers)` has pre-written process steps for slugs: `research`, `script`, `production`, `discovery`, `build`, `review`, `handoff`, `planning`, `intake`, `process`, `deliver`. Falls back to 4 generic steps.

---

### `js/app.js`

**Pattern:** IIFE returning public API `{ init, highlightFile, showToast, enterWizardWithAnswers }`.

**Backend URL config:**
```js
const BACKEND_URL = (window.ICM_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');
```
To override for production, set `window.ICM_BACKEND_URL` in `index.html` before the scripts load.

**State object:**
```js
state = {
  screen: 'home',           // 'home' | 'chat' | 'wizard' | 'results'
  questionIndex: 0,
  questions: [],            // flat question list for current archetype
  answers: {},              // { question_id: value }
  generatedFilesBase: {},   // pure generator output — never contains user edits
  fileOverrides: {},        // user edits: { 'path/file.md': { content, updatedAt } }
  generatedFiles: {},       // computed final: base + overrides merged
  activeFile: null,         // currently previewed file path
  backendAvailable: null    // null = not checked yet, true/false after health check
}
```

**The three-layer file model (critical to understand):**
```
answers
  └─ generator.generateAllFiles(answers)
       └─ state.generatedFilesBase   (pure, never edited)
            + state.fileOverrides    (user edits)
                 = state.generatedFiles  (final — used for preview and ZIP)
```
- `computeFinalFiles()` merges base + overrides into `state.generatedFiles`. Called after any edit, any AI improvement, or any regeneration.
- On page refresh: `generatedFilesBase` is NOT persisted (it's transient). `answers` and `fileOverrides` ARE persisted to localStorage. On init, base is regenerated from answers and overrides are re-applied.
- `generatedFilesBase` is never touched after `finishWizard()` or `loadStateFile()` until the next regeneration. This is what makes "Reset to generated" possible — it just deletes the override entry.

**localStorage persistence:**
```js
// Saved:    screen, questionIndex, questions, answers, fileOverrides, activeFile
// NOT saved: generatedFilesBase (regenerated from answers on load)
//            generatedFiles (computed)
//            backendAvailable (re-checked on load)
```

**workspace-state.json v2 format:**
```json
{
  "answers": { "project_name": "...", "stages": [...], ... },
  "overrides": {
    "project/CLAUDE.md": { "content": "...", "updatedAt": "2026-05-08T..." }
  }
}
```
- Re-open flow in `loadStateFile()` detects v2 by checking `loaded.answers.project_name`. v1 (answers-only) files are still supported.
- The ZIP export always writes v2 format — `downloadZip()` overrides the `workspace-state.json` entry in the final files before zipping.

**Question pipeline:**
```
UNIVERSAL_QUESTIONS         (2 — always)
+ ARCHETYPE_QUESTIONS[id]   (5–6 depending on archetype)
+ STAGE_CONFIG_QUESTION     (1 — stage builder)
+ VOICE_QUESTIONS           (3 — always)
= 11–12 questions total
```

**Stage builder fields** (rendered as a grid inside `stage_builder` question):
- Name → auto-generates slug (slug field tracks `dataset.manuallyEdited` for override)
- Slug → filesystem folder name
- Description → one sentence
- Task trigger → populates routing table "Task" column
- Routing note → populates routing table "Notes" column

**Live file editing flow:**
1. `highlightFile(path)` — renders view mode: `<pre>` + Edit / Copy / Reset buttons
2. "Edit" click → `renderPreviewEditor(preview, path, content)` — replaces `<pre>` with `<textarea>`
3. "Save" → `state.fileOverrides[path] = { content, updatedAt }` → `computeFinalFiles()` → `saveState()` → re-renders view
4. "Cancel" → re-renders view without saving
5. "Reset to generated" → `delete state.fileOverrides[path]` → `computeFinalFiles()` → re-renders
6. File tree re-renders after any override change to update the green dot

**AI improvement flow:**
1. "✦ Improve with AI" click → `showAIImproveFlow()`
2. `POST /api/improve` with `{ answers: state.answers }`
3. Modal shows spinner → change log → Accept / Reject
4. Accept → `applyAIImprovements(improvedAnswers)`:
   - Saves current `fileOverrides`
   - Replaces `state.answers` with `improvedAnswers`
   - Regenerates `generatedFilesBase`
   - Re-applies saved overrides (user edits survive)
   - Refreshes tree, title, destroys/resets diagram
5. Backend health check runs once on results screen load (`checkBackendHealth()`). Result cached in `state.backendAvailable`. Button auto-disables if backend is not reachable.

**Skill tools (file tree header buttons):**
- "✦ Skill" → `showSkillCreatorModal()` — guided form: name, purpose, trigger, reads, output, constraints → generates a `skill-starters/<slug>.md` file as an override
- "↑ Import" → file picker → `handleSkillUpload()` — reads `.md` files → adds to `skill-starters/imported/<name>` in both `generatedFilesBase` and `fileOverrides`

**Key functions reference:**

| Function | What it does |
|----------|-------------|
| `computeFinalFiles()` | Merges base + overrides → generatedFiles |
| `finishWizard()` | Clears overrides, generates base, computes final, goes to results |
| `enterWizardWithAnswers(answers)` | Pre-fills wizard from AI chat answers; normalises archetype and stage slugs |
| `loadStateFile(file)` | Reads workspace-state.json (v1 or v2), regenerates base, re-applies overrides |
| `renderResults()` | Wires header buttons, creates AI button, calls renderFileTree() |
| `renderFileTree()` | Builds tree HTML; creates header with skill buttons on first call |
| `highlightFile(path)` | Shows file in preview; detects override; shows Edit/Reset buttons |
| `renderPreviewView(...)` | View mode: pre + action buttons |
| `renderPreviewEditor(...)` | Edit mode: textarea + Save/Cancel |
| `downloadZip()` | Uses generatedFiles (final), overrides workspace-state.json with v2 format |
| `showAIImproveFlow()` | Opens modal, calls backend, shows change log |
| `applyAIImprovements(improved)` | Applies improved answers, re-generates, re-applies overrides |
| `showSkillCreatorModal()` | Guided form → builds skill file content → saves as override |
| `handleSkillUpload(e)` | Reads uploaded .md files → saves to skill-starters/imported/ |
| `checkBackendHealth()` | GET /api/health with 3s timeout → sets state.backendAvailable |
| `updateChatEntryButton(available)` | Enables/disables `#btn-chat` on home screen based on health check |

---

### `js/chat.js`

**Exports via `window.ICM.chat`:**
- `show()` — switches to `screen-chat`, resets message history, displays hardcoded greeting
- `back()` — switches back to home without saving anything
- `send(text)` — appends user message, calls `POST /api/from-conversation`, handles response
- `applyAnswers(answers)` — delegates to `window.ICM.app.enterWizardWithAnswers(answers)`
- `init()` — wires the `#chat-send-btn`, `#chat-input` (Enter key), and `#chat-back-btn` DOM listeners

**Conversation state (local, not persisted):**
```js
messages = [];       // [{ role: 'user'|'assistant', content: string }, ...]
                     // tracks turns sent to/from the API (greeting not included)
currentRound = 0;    // incremented each round-trip; capped at MAX_ROUNDS (3)
isSending = false;   // guard against double-submit
```

**Round logic:**
- `currentRound` starts at 0 (first user message).
- Each call to `/api/from-conversation` passes `{ messages, round: currentRound }` and returns `round: currentRound + 1`.
- If `needs_more: true` → display `follow_up` as an assistant bubble; keep chat open.
- If `needs_more: false` → display `summary` + handoff message; call `applyAnswers(answers)` after a 1.5 s delay.
- Error recovery: the failed user message is popped from `messages` so the user can retry.

---

### `js/diagram.js`

**Exports via `window.ICM.diagram`:**
- `render(containerId, answers)` — builds and attaches D3 SVG
- `destroy(containerId)` — stops simulation, removes SVG and tooltips

**Layer colors (also in CSS `--l0` through `--l5`):**

| Layer | Color | CSS var | Represents |
|-------|-------|---------|------------|
| L0 | `#7c3aed` purple | `--l0` | CLAUDE.md |
| L1 | `#2563eb` blue | `--l1` | CONTEXT.md |
| L2 | `#0891b2` teal | `--l2` | Stage contracts |
| L3 | `#d97706` amber | `--l3` | _config/ files |
| L4 | `#6b7280` gray | `--l4` | output/ directories |
| L5 | `#10b981` green | `--l5` | skill-starters/ |

**Diagram nodes:** CLAUDE.md (L0) → CONTEXT.md (L1) → stage folders (L2) + output/ (L4) + _config/ files (L3) + skill-starters/ (L5). Clicking a node with a `fileKey` calls `window.ICM.app.highlightFile(fileKey)`.

**Timing:** renders inside `requestAnimationFrame` on tab click to avoid zero-width container problem.

---

### `backend/app.py`

**Stack:** FastAPI + Uvicorn + Anthropic Python SDK + python-dotenv + Pydantic v2.

**Prompt files:** System prompts are stored as plain-text Markdown files in `backend/prompts/` (not inline in `app.py`). They are read from disk on every request via `_load_prompt(name)`, so edits take effect immediately without restarting the server. See [`ai.md`](ai.md) for the full prompt text and field reference.

| File | Used by |
|------|---------|
| `backend/prompts/improve.md` | `POST /api/improve` → `_call_claude()` |
| `backend/prompts/conversation.md` | `POST /api/from-conversation` → `_call_claude_conversation()` |
| `backend/prompts/improve-skill.md` | `POST /api/improve-skill` → `_call_claude_improve_skill()` |

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Returns `{ status, api_key_configured, message }`. Always 200. |
| POST | `/api/improve` | Accepts `{ answers }`. Returns `{ improvedAnswers, changeLog, warnings }`. |
| POST | `/api/from-conversation` | Accepts `{ messages, round }`. Returns `{ needs_more, follow_up?, answers?, summary?, round }`. |
| POST | `/api/improve-skill` | Accepts `{ name, purpose, trigger, reads[], output, constraints[], archetype, stages, project_name }`. Returns `{ name, purpose, trigger, reads[], output, constraints[] }`. |

**`/api/improve` flow:**
1. Validates `answers.project_name` and `answers.stages` (min 2)
2. Checks `ANTHROPIC_API_KEY` is set (503 if missing)
3. Calls `_call_claude(answers)` which sends the answers JSON to `claude-sonnet-4-6` with a strict system prompt
4. Strips markdown fences from response, parses JSON
5. Validates output: restores `project_name` and `stages` if missing/invalid, enforces slug safety on each stage
6. Returns `ImproveResponse`

**System prompt intent:** improve stage descriptions, task triggers, routing notes, voice patterns — without inventing content or changing user intent. Returns `{ improvedAnswers, changeLog }` in JSON only.

**`/api/from-conversation` flow:**
1. Validates that `messages` is non-empty and has at least one user message
2. Checks `ANTHROPIC_API_KEY` is set (503 if missing)
3. Strips any leading assistant messages before sending to Anthropic (API requires user-first)
4. Calls `_call_claude_conversation(messages, round)`:
   - If `round >= 3`, appends a "FINAL ROUND" instruction forcing extraction
   - Claude decides: if enough info → `needs_more: false` + full `answers`; otherwise → `needs_more: true` + `follow_up`
   - Strips markdown fences, parses JSON
   - Validates and cleans `answers`: slug-safe `project_name`, valid `archetype`, stage slug safety, fallback to archetype defaults if stages invalid
5. Returns `FromConversationResponse`

**CORS:** `allow_origins=["*"]` for local dev. Tighten to your Netlify domain in production.

**Model:** `claude-sonnet-4-6` — good balance of speed and quality for this task. Change in `_call_claude()` if needed.

**Hot reload:** server starts with `uvicorn app:app ... reload=True`, watches the whole `Workflow/` directory for file changes.

**`.env` loading:** `load_dotenv(Path(__file__).parent / ".env", override=True)` — the path is relative to the script file, not the working directory. `override=True` ensures the file beats any stale `ANTHROPIC_API_KEY` already set in the system environment. This is critical: if the backend is launched from the parent `Workflow/` directory (as uvicorn's hot-reload mode does), a bare `load_dotenv()` would look in the wrong directory and fall back to the system env, giving 401 errors even with a correctly written `.env` file. **Always run the backend from the `backend/` folder** — see the Running section below.

**See also:** [`ai.md`](ai.md) — full documentation of all Claude prompts, API call structure, and response validation.

---

## Key Design Decisions

### Why static files, no framework
Consistent with the existing UPCI viewer project in this workspace. No npm, no bundler, no Node. Runs with `python -m http.server 3000`. Deploys to Netlify by pointing at the repo root. CDN-loaded JSZip and D3 are the only runtime dependencies.

### Why the three-layer file model (base + overrides + final)
The generator is a pure function: same answers always produce the same files. This makes re-generation safe. User edits are stored separately so they can survive answer changes (AI improve, Edit Answers → regenerate). `computeFinalFiles()` is the only place where the two are merged. Nothing else reads from base or overrides directly.

### Why `generatedFilesBase` is not persisted to localStorage
It can always be regenerated from `answers` in milliseconds. Persisting it would double the localStorage payload and create a sync problem (base could diverge from answers after a refresh). On init, if screen is `results`, the base is regenerated and overrides are re-applied.

### Why `workspace-state.json` is v2 but backward-compatible
The re-open mechanism must restore the full editing state. Adding `overrides` to the JSON enables this. The `loadStateFile()` function detects the format: if `loaded.answers.project_name` exists it's v2; if `loaded.project_name` exists it's v1. This means old exports still open correctly.

### Why the backend is optional and separate
API keys must not appear in client-side JS. The static app must remain fully functional without the backend (for offline use, for users without API keys, for deployment before the backend is set up). The frontend's `checkBackendHealth()` runs once on results screen load and caches the result — the button disables gracefully if unreachable.

### Why AI improvements re-apply overrides after regeneration
The user's manual edits represent final intent. The AI is improving the spec (answers), not the files. After `applyAIImprovements()`, `generatedFilesBase` is fresh from the improved answers, then `fileOverrides` is re-merged on top. A file the user manually edited will retain their edits unless they explicitly "Reset to generated".

### Why the chat entry pre-fills the wizard instead of skipping it
The wizard's blue teaching boxes do educational work — they explain the ICM principles behind each field. The chat path produces a filled spec, but the user still reviews it question-by-question through the wizard before generating. This means they understand what was decided and can correct any misunderstanding. The wizard becomes a confirmation step instead of a data-entry step. Skipping it entirely (chat → results directly) would require the user to trust the AI's interpretation without any structured review.

### Why chat history is not persisted to localStorage
Chat messages are transient input — the valuable artifact is the `answers` object, which is persisted once the wizard starts (the same path as a manual wizard run). Persisting chat history would add complexity for a one-time flow. If the user refreshes during the chat, they start over; if they're in the wizard, the existing resume banner handles it.

### Why `enterWizardWithAnswers` clears `fileOverrides`
Entering the wizard from chat is equivalent to starting a fresh generation — there are no previous edits to preserve. Clearing overrides ensures `computeFinalFiles()` produces a clean base when `finishWizard()` runs.

### Why the diagram renders on tab click
The D3 container is inside a hidden tab panel. `container.clientWidth` is 0 when `display: none`. `requestAnimationFrame` after the tab becomes visible gives the browser time to lay out. This avoids the zero-size SVG problem.

### Why stage slugs are separate from labels
`label: "Research & Discovery"` (display name) vs `slug: "research-discovery"` (folder name, filesystem-safe). Auto-generated from label but manually overridable. Tracked via `dataset.manuallyEdited` on the slug input so auto-generation doesn't clobber a manual slug after the user changes the label.

---

## Running the Full System

### Frontend only (wizard + download, no AI)
```powershell
# From Workflow/
python -m http.server 3000
# Open http://localhost:3000
```

### With AI backend
```powershell
# Terminal 1 — frontend
cd C:\Users\jaime\OneDrive\dev\Workflow
python -m http.server 3000

# Terminal 2 — backend (run from the backend/ folder so relative paths resolve correctly)
cd C:\Users\jaime\OneDrive\dev\Workflow\backend
.\.venv\Scripts\python.exe app.py
# Runs on http://localhost:8000 with hot-reload
```

**API key setup:** edit `backend/.env` and set:
```
ANTHROPIC_API_KEY=sk-ant-api03-...your-key...
```
The server reloads automatically when the file is saved.

### First-time backend setup
```powershell
cd C:\Users\jaime\OneDrive\dev\Workflow\backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env   # then add your ANTHROPIC_API_KEY
python app.py
```

---

## Deployment

### Frontend (Netlify)
1. Git repo already initialized in `Workflow/`. `.gitignore` is in place:
   ```
   References/
   backend/.venv/
   backend/.env
   backend/__pycache__/
   ```
2. Push to GitHub
4. Connect to Netlify — publish directory: root (`/`)
5. For production backend URL, add to `index.html` before the app scripts:
   ```html
   <script>window.ICM_BACKEND_URL = 'https://your-backend.railway.app';</script>
   ```

### Backend (Railway / Render / VPS)
- Set `ANTHROPIC_API_KEY` as an environment variable
- Change CORS in `app.py` from `allow_origins=["*"]` to your Netlify domain
- Point the service at `backend/app.py`

---

## What Is Not Yet Built

| Feature | Notes |
|---------|-------|
| **GitHub/Netlify deployment** | Not initialized. See Deployment section above. |
| **More archetypes** | "Developer" archetype is broad. Could split into frontend/backend/fullstack sub-archetypes. |
| **MCP server questions** | The wizard does not yet ask which MCP servers the user uses. Would feed into skill starters. |
| **Protected blocks** | `<!-- ICM:PROTECT:start/end -->` markers that merge into regenerated files instead of the user losing their edits. Phase 2 of the override system. |
| **Import from existing folder** | Parse an existing workspace folder back into answers. Re-open currently only works from `workspace-state.json`. |
| **Multi-workspace mode** | Generate multiple workspaces inside a larger project (community + production + writing room pattern). One workspace at a time currently. |
| **Skill import from GitHub URL** | File upload works. Fetching skill files from a public repo URL requires a backend endpoint (`/api/skill-from-repo`). |
| **AI skill generator** | Backend endpoint `POST /api/skill-from-brief` — describe a task in plain language, get a skill file back. |
| **Streaming chat responses** | `/api/from-conversation` is currently one-shot per round. Streaming would make the chat feel faster for long responses. |
| **Persist chat to localStorage** | Chat messages are transient. A "resume chat" banner is not shown — users start over if they refresh mid-chat. |

---

## Known Issues

| Issue | Where | Status |
|-------|-------|--------|
| Layer badge CSS uses concatenated class names (`layer-badgel0`) | `css/styles.css` | Intentional — `'L0'.toLowerCase()` → `'l0'` → class `layer-badgel0` |
| Diagram renders blank if tab opened before container has width | `js/diagram.js` | Fixed with `requestAnimationFrame` on tab click + fallback `width: 800` |
| `&&` not valid in PowerShell for command chaining | Dev environment | Use `;` or separate commands |
| `#screen-wizard` and `#screen-results` need `display: flex` not `display: block` | `css/styles.css` | Fixed with `#screen-wizard.active { display: flex }` etc. |
| Preview textarea height is `min-height: 320px` not fill-height | `css/styles.css` | Minor. `#file-preview` is a flex column and `.preview-editor-wrap` has `flex: 1`, but scroll parent breaks full fill. Usable as-is. |
| `load_dotenv()` without explicit path finds wrong `.env` | `backend/app.py` | Fixed — now uses `Path(__file__).parent / ".env"` with `override=True`. Running the backend from `Workflow/` instead of `backend/` would silently fall back to a stale system env var, causing 401 from Anthropic even with a valid key in `.env`. |
| Unescaped double quotes in chat handoff string | `js/chat.js` | Fixed — replaced `"Generate Workspace"` inside a double-quoted string with Unicode curly-quote escapes (`\u201c`, `\u201d`). Was causing `SyntaxError: unexpected token: identifier` on load. |

---

## Testing Checklist

Before pushing to GitHub/Netlify, verify:

**Chat entry flow**
- [ ] "✦ Build with AI conversation" button is disabled when backend is not running (tooltip shows)
- [ ] Button is enabled when backend is running and API key is set
- [ ] Clicking the button opens the chat screen with the greeting message
- [ ] Back button returns to home without saving anything
- [ ] Typing a description and pressing Enter (or clicking Send) fires the request
- [ ] Shift+Enter adds a newline instead of sending
- [ ] Claude's follow-up appears as an assistant bubble with the round indicator updated
- [ ] After a final response, the wizard opens with all fields pre-filled
- [ ] Pre-filled wizard: project name, description, archetype match what was discussed
- [ ] Pre-filled wizard: stages are correct with labels, slugs, and descriptions
- [ ] Error in API call shows a user-friendly error bubble; the failed message is popped so the user can retry
- [ ] After 3 follow-up rounds (round >= 3), the server forces extraction and opens the wizard

**Wizard**
- [ ] Home screen loads with correct layout and L0–L5 layer explainer
- [ ] "Build a new workspace" → archetype selection
- [ ] All 5 archetypes selectable and advance to questions
- [ ] Progress bar advances; Back button restores previous answer
- [ ] Stage builder: rename → slug auto-generates; manual slug edit is preserved; add/remove work; task and note fields save
- [ ] "Generate Workspace" → results screen

**Results — core**
- [ ] File tree shows all expected files with correct layer badges
- [ ] Clicking a file shows populated content in preview
- [ ] Copy button works
- [ ] Architecture Diagram tab renders on first click (not blank), nodes draggable, tooltips show, clicking node highlights file
- [ ] Download .zip produces valid zip with correct folder structure and v2 `workspace-state.json`
- [ ] Edit Answers → re-generate produces updated files (overrides cleared on fresh generation)

**Live editing**
- [ ] Edit button appears on `.md` files
- [ ] Editing and saving creates green dot in file tree and "Manually edited" notice in preview
- [ ] Edited content is in the downloaded ZIP
- [ ] Reset to generated removes the green dot and restores base content
- [ ] Page refresh restores edited files (localStorage)
- [ ] Re-opening `workspace-state.json` (v2) restores manual edits

**Re-open**
- [ ] Dragging v2 `workspace-state.json` to home screen restores both answers and overrides
- [ ] Dragging v1 `workspace-state.json` (answers-only) still works

**AI improve**
- [ ] Button disabled (with tooltip) when backend is not running
- [ ] Button enabled when backend running and API key set
- [ ] Clicking opens modal with spinner
- [ ] Accept applies improved answers, regenerates files, preserves overrides
- [ ] Reject closes modal with no changes

**Skills**
- [ ] "✦ Skill" opens creator modal; filling fields and clicking Create adds file to skill-starters/ and opens it in preview
- [ ] "↑ Import" uploads .md files to skill-starters/imported/ and shows in tree

---

*Last updated: 2026-05-08*
*Built by: Cursor agent (Claude Sonnet 4.6)*
*Based on: ICM / Interpretable Context Methodology — eduba.io / Clief Notes*

---

### Changelog (2026-05-08 — session 2)

- Added chat-first entry (`screen-chat`, `js/chat.js`, `css/styles.css` additions)
- Added `POST /api/from-conversation` backend endpoint with 3-round cap and answer validation
- Added `app.enterWizardWithAnswers()` and `updateChatEntryButton()` in `js/app.js`
- Home screen now shows "✦ Build with AI conversation" button (disabled when backend offline)
- Backend health check now runs at startup (not only on results screen) to gate chat button
- Architecture updated: Three Screens → Four Screens
- **Bug fix:** `js/chat.js` — `SyntaxError` caused by unescaped double quotes in `handoffMsg` string; fixed with Unicode escapes
- **Bug fix:** `backend/app.py` — `load_dotenv()` was resolving `.env` relative to cwd, not script dir; fixed with `Path(__file__).parent / ".env"` and `override=True`
- **Prompt improvement:** `CONVERSATION_SYSTEM_PROMPT` rewritten to list all archetype-specific field IDs, types, and valid enum values; ensures complete wizard pre-fill (not just `project_name`)
- Added `.gitignore` (`References/`, `backend/.venv/`, `backend/.env`, `backend/__pycache__/`)
- Git repository initialized and all changes committed
- Created `ai.md` documenting all Claude prompts and API call structure
- Moved inline system prompts out of `app.py` into `backend/prompts/improve.md` and `backend/prompts/conversation.md`; loaded per-request via `_load_prompt()` — edit and save to iterate without restarting the backend
- Added "✦ Improve with AI" to the Skill Creator modal: new `POST /api/improve-skill` endpoint, `_call_claude_improve_skill()` helper, `ImproveSkillRequest/Response` Pydantic models, and `backend/prompts/improve-skill.md` prompt; button is disabled when backend is offline
