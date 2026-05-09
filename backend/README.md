# ICM Workspace Builder — Backend

Small FastAPI service that powers the **"Improve with AI"** feature.

The static frontend works fully without this server. The AI improvement button is automatically disabled when this service is not running.

## Setup

```powershell
# From the Workflow/backend directory
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -r requirements.txt

# Create your .env file
Copy-Item .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

python app.py
# Server starts on http://localhost:8000
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check — returns `{ status, api_key_configured }` |
| POST | `/api/improve` | Send `{ answers }`, receive `{ improvedAnswers, changeLog, warnings }` |

## How it works

1. The frontend sends the wizard `answers` object as JSON.
2. The backend passes it to Claude with a strict prompt that improves stage descriptions, task triggers, routing notes, and voice patterns — without inventing content or changing user intent.
3. Claude returns the improved answers in the same JSON structure.
4. The frontend shows a change log, lets you accept or reject, and regenerates all files from the improved spec.
5. Any files you manually edited (overrides) survive the regeneration.

## Deployment

For production, deploy this as a separate service (Railway, Render, or a small VPS). Set:
- `ANTHROPIC_API_KEY` as an environment variable
- `CORS` in `app.py` to your Netlify URL instead of `*`

The frontend reads `window.ICM_BACKEND_URL` for the backend URL. Set it in `index.html` before the scripts load:
```html
<script>window.ICM_BACKEND_URL = 'https://your-backend.railway.app';</script>
```
