"""Bubbles backend entrypoint.

Run with:
    uv run uvicorn main:app --port 5001 --reload

Endpoints:
    GET  /health
    POST /pitch              hum audio → MIDI notes + BPM + key
    POST /arrange-from-hum   hum audio → melody-only Arrangement (no Claude call)
    POST /arrange            refine an Arrangement via Claude (add chords, drums, etc.)
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.arrange import agent_refine, build_melody_only_arrangement
from app.pitch import detect_pitch_from_bytes
from app.schemas import Arrangement, Note, PitchResult

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("bubbles")

app = FastAPI(title="Bubbles", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_MAX_AUDIO_BYTES = 20 * 1024 * 1024  # 20 MB


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _read_audio(audio: UploadFile, audio_bytes: bytes) -> str:
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio upload.")
    if len(audio_bytes) > _MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Audio too large (>{_MAX_AUDIO_BYTES // 1024 // 1024} MB).",
        )
    suffix = ".wav"
    if audio.filename and "." in audio.filename:
        suffix = "." + audio.filename.rsplit(".", 1)[-1].lower()
    return suffix


@app.post("/pitch", response_model=PitchResult)
async def pitch_endpoint(audio: UploadFile = File(...)) -> PitchResult:
    """Detect pitches from a hummed audio file."""
    audio_bytes = await audio.read()
    suffix = _read_audio(audio, audio_bytes)
    try:
        result = detect_pitch_from_bytes(audio_bytes, suffix=suffix)
    except Exception as exc:
        log.exception("Pitch detection failed")
        raise HTTPException(
            status_code=500, detail=f"Pitch detection failed: {exc.__class__.__name__}"
        ) from exc
    if not result.notes:
        raise HTTPException(
            status_code=422,
            detail="No clear melody detected. Try humming a steady pitch.",
        )
    return result


@app.post("/arrange-from-hum", response_model=Arrangement)
async def arrange_from_hum(audio: UploadFile = File(...)) -> Arrangement:
    """Hum → melody-only Arrangement.

    This is the fast first-call path. NO Claude call — the agent only runs
    when the user asks for chords or drums via /arrange.
    """
    audio_bytes = await audio.read()
    suffix = _read_audio(audio, audio_bytes)
    pitch = detect_pitch_from_bytes(audio_bytes, suffix=suffix)
    if not pitch.notes:
        raise HTTPException(
            status_code=422,
            detail="No clear melody detected. Try humming a steady pitch.",
        )
    log.info("/arrange-from-hum: %d notes, %.1f BPM", len(pitch.notes), pitch.bpm)
    return build_melody_only_arrangement(pitch.notes, bpm=pitch.bpm)


class ArrangeRequest(BaseModel):
    notes: list[Note]
    intent: str
    prior: Arrangement | None = None
    bpm_hint: float | None = None


@app.post("/arrange", response_model=Arrangement)
async def arrange_endpoint(req: ArrangeRequest) -> Arrangement:
    """Refine an Arrangement using a free-form intent. Calls Claude.

    Examples:
      intent="add chords"  → returns Arrangement with chord_progression filled.
      intent="add drums"   → returns Arrangement with drums filled.
      intent="make it sadder" → tweaks key/tempo/chords; keeps drums if present.
    """
    if not req.notes:
        raise HTTPException(status_code=400, detail="notes is required.")
    if not req.intent.strip():
        raise HTTPException(status_code=400, detail="intent is required.")
    try:
        return await agent_refine(req.notes, req.intent, req.prior, req.bpm_hint)
    except Exception as exc:
        log.exception("Arrangement failed")
        raise HTTPException(
            status_code=500, detail=f"Arrangement failed: {exc.__class__.__name__}"
        ) from exc
