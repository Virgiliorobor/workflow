# ICM Workspace Builder

A guided web app that generates fully populated AI workspace folder structures based on the **Interpretable Context Methodology (ICM)** — developed by Eduba / Clief Notes.

Answer a series of questions about your workflow and get a complete, ready-to-use folder system that tells Claude (or any AI) where it is, what to do, and where to put the work — every session, automatically.

You can build your workspace two ways: fill out the guided wizard step by step, or use the **"Build with AI conversation"** entry — describe your project in plain language, Claude asks a couple of follow-ups, and the wizard opens pre-filled and ready to review. The AI conversation entry requires the backend to be running (see below).

## What It Generates

- `CLAUDE.md` — the map (Layer 0, always loaded)
- `CONTEXT.md` — the workflow router (Layer 1)
- Stage contracts (`01_research/CONTEXT.md`, `02_script/CONTEXT.md`, etc.) — Layer 2
- `_config/` files — voice/tone, format patterns, constraints (Layer 3)
- `output/` directories — handoff points between stages (Layer 4)
- `workspace-state.json` — save and re-open your workspace to edit later

## Running Locally

No install required. Just Python (already on your system):

```powershell
cd "C:\Users\jaime\OneDrive\dev\Workflow"
python -m http.server 3000
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## Deploying to Netlify

1. Push to GitHub
2. Connect the repo in Netlify (publish directory: `/`)
3. Every push auto-deploys

## Optional: AI Backend

The frontend works fully without the backend. The backend enables two AI features: **"Improve with AI"** (results screen) and **"Build with AI conversation"** (home screen).

```powershell
# First-time setup
cd "C:\Users\jaime\OneDrive\dev\Workflow\backend"
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env   # then add your ANTHROPIC_API_KEY

# Start backend
python app.py   # runs on http://localhost:8000
```

## Project Structure

```
Workflow/
├── index.html          ← entry point
├── css/
│   └── styles.css      ← all styling
├── js/
│   ├── questions.js    ← question content + ICM teaching text
│   ├── generator.js    ← turns answers into populated MD files
│   ├── diagram.js      ← D3 architecture diagram
│   ├── app.js          ← wizard flow, state, UI
│   └── chat.js         ← conversational entry → pre-filled wizard
├── backend/
│   ├── app.py          ← FastAPI: /api/health, /api/improve, /api/from-conversation
│   └── requirements.txt
├── References/         ← source materials (not deployed)
└── README.md
```

## Based On

- **Interpretable Context Methodology** — eduba.io
- **Clief Notes** — the course and community where this system is taught
- **Vault Toolkit** — the constraint library and architecture examples in `References/Example/`

## Credits

Built for the Clief Notes Weekly Competition #3 — and as a general-purpose tool for anyone who wants a structured AI workspace without knowing where to start.
