"""
ICM Workspace Builder — AI Improvement Backend
FastAPI service that accepts wizard answers and returns an improved spec via Claude.

Usage:
  1. Create a .env file: ANTHROPIC_API_KEY=sk-ant-...
  2. pip install -r requirements.txt
  3. python app.py  (runs on http://localhost:8000)

The static frontend detects this server on startup.
If it is not running, AI features are disabled — the wizard still works fully.
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Literal

import anthropic
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

# Always load from the .env file next to this script, regardless of cwd.
# override=True ensures this beats any stale system environment variable.
load_dotenv(Path(__file__).parent / ".env", override=True)

# ── APP SETUP ──────────────────────────────────────────────────────────────────

app = FastAPI(title="ICM Workspace Builder API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tighten in production to your Netlify domain
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ── SCHEMA ─────────────────────────────────────────────────────────────────────


class StageSpec(BaseModel):
    id: str
    slug: str
    label: str
    description: str = ""
    task: str = ""
    note: str = ""


class AnswersPayload(BaseModel):
    project_name: str
    description: str = ""
    archetype: str = "custom"
    stages: list[StageSpec] = []
    voice_patterns: str = ""
    writing_prohibitions: str = ""
    team_size: str = "Just me"

    # Allow extra fields (formats, audience, etc.) without rejecting them
    model_config = {"extra": "allow"}

    @field_validator("project_name")
    @classmethod
    def slug_safe(cls, v: str) -> str:
        slug = re.sub(r"[^a-z0-9\-]", "-", v.lower()).strip("-")
        if not slug:
            raise ValueError("project_name must produce a valid slug")
        return slug

    @field_validator("stages")
    @classmethod
    def stage_count(cls, v: list) -> list:
        if not (2 <= len(v) <= 7):
            raise ValueError("stages must have between 2 and 7 entries")
        return v


class ImproveRequest(BaseModel):
    answers: dict[str, Any]


class ChangeLogEntry(BaseModel):
    field: str
    type: str       # "improved" | "filled" | "note"
    message: str


class ImproveResponse(BaseModel):
    improvedAnswers: dict[str, Any]
    changeLog: list[ChangeLogEntry]
    warnings: list[str]


# ── Chat-first conversation schema ─────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class FromConversationRequest(BaseModel):
    messages: list[ChatMessage]
    round: int = 0   # 0 = first user message; incremented each trip


class FromConversationResponse(BaseModel):
    needs_more: bool
    follow_up: str | None = None    # set when needs_more=True
    answers: dict | None = None     # set when needs_more=False
    summary: str | None = None      # brief recap when answers returned
    round: int                      # next round number (echoed back to client)


# ── Skill improvement schema ────────────────────────────────────────────────────

class ImproveSkillRequest(BaseModel):
    name: str
    purpose: str = ""
    trigger: str = ""
    reads: list[str] = []
    output: str = ""
    constraints: list[str] = []
    archetype: str = "custom"
    stages: list[dict] = []   # [{label, slug}, ...]
    project_name: str = ""


class ImproveSkillResponse(BaseModel):
    name: str
    purpose: str
    trigger: str
    reads: list[str]
    output: str
    constraints: list[str]


# ── HELPERS ────────────────────────────────────────────────────────────────────

_PROMPTS_DIR = Path(__file__).parent / "prompts"


def _load_prompt(name: str) -> str:
    """Load a prompt from backend/prompts/<name>.md.

    Reads the file on every call so edits take effect on the next request
    without restarting the server. Raises RuntimeError if the file is missing.
    """
    path = _PROMPTS_DIR / f"{name}.md"
    try:
        return path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        raise RuntimeError(
            f"Prompt file not found: {path}\n"
            f"Expected: backend/prompts/{name}.md"
        )

_ARCHETYPE_STAGE_DEFAULTS: dict[str, list[tuple[str, str]]] = {
    "content":    [("Research", "research"), ("Script / Draft", "script"), ("Production", "production")],
    "freelancer": [("Discovery", "discovery"), ("Build", "build"), ("Review", "review"), ("Handoff", "handoff")],
    "developer":  [("Planning", "planning"), ("Build", "build"), ("Docs", "docs")],
    "smallbiz":   [("Intake", "intake"), ("Process", "process"), ("Deliver", "deliver")],
    "custom":     [("Stage 1", "stage-1"), ("Stage 2", "stage-2"), ("Stage 3", "stage-3")],
}


def _call_claude_conversation(
    messages: list[dict], round_num: int
) -> FromConversationResponse:
    client = _build_client()

    system = _load_prompt("conversation")
    if round_num >= 3:
        system += (
            "\n\nFINAL ROUND: You MUST return needs_more=false and produce a complete "
            "answers object now, even if some fields need reasonable defaults."
        )

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=system,
        messages=messages,
    )

    raw = message.content[0].text.strip()

    # Strip accidental markdown fences
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw.strip())

    try:
        result = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Claude returned non-JSON: {exc}") from exc

    next_round = round_num + 1
    needs_more = bool(result.get("needs_more", False))

    # Force extraction after MAX_ROUNDS
    if round_num >= 3:
        needs_more = False

    if needs_more:
        return FromConversationResponse(
            needs_more=True,
            follow_up=result.get("follow_up", "Can you tell me more about your workflow?"),
            round=next_round,
        )

    # ── Build and validate the answers object ───────────────────────────────
    answers: dict = result.get("answers") or {}

    # project_name — slug-safe
    raw_name = str(answers.get("project_name") or "my-workspace")
    slug = re.sub(r"[^a-z0-9\-]", "-", raw_name.lower()).strip("-")
    answers["project_name"] = slug or "my-workspace"

    # archetype — must be one of the valid IDs
    valid_archetypes = {"content", "freelancer", "developer", "smallbiz", "custom"}
    if answers.get("archetype") not in valid_archetypes:
        answers["archetype"] = "custom"

    # stages — validate count and clean slugs; fall back to archetype defaults
    stages = answers.get("stages")
    if not isinstance(stages, list) or len(stages) < 2:
        defaults = _ARCHETYPE_STAGE_DEFAULTS.get(answers["archetype"], _ARCHETYPE_STAGE_DEFAULTS["custom"])
        stages = [
            {
                "id": str(i + 1).zfill(2),
                "slug": s_slug,
                "label": s_label,
                "description": "",
                "task": "",
                "note": "",
            }
            for i, (s_label, s_slug) in enumerate(defaults)
        ]
    else:
        cleaned = []
        for i, stage in enumerate(stages):
            raw_slug = stage.get("slug", "") or ""
            clean_slug = re.sub(r"[^a-z0-9\-]", "-", raw_slug.lower()).strip("-")[:32]
            if not clean_slug:
                clean_slug = re.sub(r"[^a-z0-9\-]", "-", stage.get("label", "stage").lower()).strip("-")[:24]
            cleaned.append({
                "id": str(i + 1).zfill(2),
                "slug": clean_slug or f"stage-{i + 1}",
                "label": stage.get("label") or f"Stage {i + 1}",
                "description": stage.get("description") or "",
                "task": stage.get("task") or "",
                "note": stage.get("note") or "",
            })
        stages = cleaned
    answers["stages"] = stages

    # Required string fields — ensure they exist
    for field, default in [
        ("description", ""),
        ("voice_patterns", ""),
        ("writing_prohibitions", ""),
        ("team_size", "Just me"),
    ]:
        if not answers.get(field):
            answers[field] = default

    return FromConversationResponse(
        needs_more=False,
        answers=answers,
        summary=result.get("summary"),
        round=next_round,
    )


def _build_client() -> anthropic.Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. "
            "Add it to backend/.env or your environment variables."
        )
    return anthropic.Anthropic(api_key=api_key)


def _call_claude(answers: dict) -> tuple[dict, list[dict], list[str]]:
    client = _build_client()

    user_message = json.dumps(answers, ensure_ascii=False, indent=2)

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=_load_prompt("improve"),
        messages=[{"role": "user", "content": user_message}],
    )

    raw = message.content[0].text.strip()

    # Strip accidental markdown fences
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw.strip())

    try:
        result = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Claude returned non-JSON response: {exc}") from exc

    improved_answers = result.get("improvedAnswers", {})
    change_log = result.get("changeLog", [])
    warnings: list[str] = []

    # Validate improved answers minimally
    if not improved_answers.get("project_name"):
        improved_answers["project_name"] = answers.get("project_name", "workspace")
        warnings.append("project_name was missing in AI response — original restored.")

    stages = improved_answers.get("stages", [])
    if not isinstance(stages, list) or len(stages) < 2:
        improved_answers["stages"] = answers.get("stages", [])
        warnings.append("Stage data from AI was invalid — original stages restored.")
    else:
        # Enforce slug safety on each stage
        for stage in stages:
            raw_slug = stage.get("slug", "") or ""
            clean = re.sub(r"[^a-z0-9\-]", "-", raw_slug.lower()).strip("-")[:32]
            if not clean:
                clean = re.sub(r"[^a-z0-9\-]", "-", stage.get("label", "stage").lower()).strip("-")[:24]
            stage["slug"] = clean or "stage"

    return improved_answers, change_log, warnings


def _call_claude_improve_skill(req: "ImproveSkillRequest") -> ImproveSkillResponse:
    client = _build_client()

    payload = {
        "name": req.name,
        "purpose": req.purpose,
        "trigger": req.trigger,
        "reads": req.reads,
        "output": req.output,
        "constraints": req.constraints,
        "archetype": req.archetype,
        "stages": req.stages,
        "project_name": req.project_name,
    }

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=_load_prompt("improve-skill"),
        messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False, indent=2)}],
    )

    raw = message.content[0].text.strip()

    if raw.startswith("```"):
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw.strip())

    try:
        result = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Claude returned non-JSON: {exc}") from exc

    # Ensure required fields are present and lists are lists
    return ImproveSkillResponse(
        name=result.get("name") or req.name,
        purpose=result.get("purpose") or req.purpose or "",
        trigger=result.get("trigger") or req.trigger or "",
        reads=result.get("reads") if isinstance(result.get("reads"), list) else (req.reads or ["CLAUDE.md"]),
        output=result.get("output") or req.output or "",
        constraints=result.get("constraints") if isinstance(result.get("constraints"), list) else (req.constraints or []),
    )


# ── ROUTES ─────────────────────────────────────────────────────────────────────


@app.get("/api/health")
def health():
    api_key_set = bool(os.getenv("ANTHROPIC_API_KEY"))
    return {
        "status": "ok",
        "api_key_configured": api_key_set,
        "message": "ICM backend ready" if api_key_set else "API key not configured — set ANTHROPIC_API_KEY in backend/.env",
    }


@app.post("/api/improve", response_model=ImproveResponse)
def improve(req: ImproveRequest):
    answers = req.answers

    if not answers.get("project_name"):
        raise HTTPException(status_code=422, detail="answers.project_name is required")
    if not isinstance(answers.get("stages"), list) or len(answers["stages"]) < 2:
        raise HTTPException(status_code=422, detail="answers.stages must have at least 2 stages")

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY is not configured on the server. Add it to backend/.env and restart.",
        )

    try:
        improved_answers, change_log, warnings = _call_claude(answers)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except anthropic.APIStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {exc.message}") from exc
    except anthropic.AuthenticationError as exc:
        raise HTTPException(status_code=502, detail="Invalid Anthropic API key. Check ANTHROPIC_API_KEY in backend/.env.") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}") from exc

    return ImproveResponse(
        improvedAnswers=improved_answers,
        changeLog=[ChangeLogEntry(**entry) for entry in change_log if isinstance(entry, dict)],
        warnings=warnings,
    )


@app.post("/api/from-conversation", response_model=FromConversationResponse)
def from_conversation(req: FromConversationRequest):
    if not req.messages:
        raise HTTPException(status_code=422, detail="messages must not be empty")

    # Must have at least one user message
    user_msgs = [m for m in req.messages if m.role == "user"]
    if not user_msgs:
        raise HTTPException(status_code=422, detail="messages must contain at least one user message")

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY is not configured on the server. Add it to backend/.env and restart.",
        )

    # Build message list for Anthropic API (must start with a user message)
    api_messages = [{"role": m.role, "content": m.content} for m in req.messages]
    # Drop any leading assistant messages — Anthropic requires user turn first
    while api_messages and api_messages[0]["role"] != "user":
        api_messages.pop(0)

    if not api_messages:
        raise HTTPException(status_code=422, detail="No user message found after filtering")

    try:
        return _call_claude_conversation(api_messages, req.round)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except anthropic.APIStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {exc.message}") from exc
    except anthropic.AuthenticationError as exc:
        raise HTTPException(
            status_code=502, detail="Invalid Anthropic API key. Check ANTHROPIC_API_KEY in backend/.env."
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}") from exc


@app.post("/api/improve-skill", response_model=ImproveSkillResponse)
def improve_skill(req: ImproveSkillRequest):
    if not req.name.strip():
        raise HTTPException(status_code=422, detail="name is required")

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY is not configured on the server. Add it to backend/.env and restart.",
        )

    try:
        return _call_claude_improve_skill(req)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except anthropic.APIStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {exc.message}") from exc
    except anthropic.AuthenticationError as exc:
        raise HTTPException(
            status_code=502, detail="Invalid Anthropic API key. Check ANTHROPIC_API_KEY in backend/.env."
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}") from exc


# ── ENTRY POINT ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"ICM backend starting on http://localhost:{port}")
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
