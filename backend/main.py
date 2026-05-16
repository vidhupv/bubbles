"""Bubbles backend entrypoint.

Run with:
    uv run uvicorn main:app --port 5001 --reload

Endpoints:
    GET  /health
    POST /pitch      hum audio → MIDI notes + BPM + key
    POST /arrange    MIDI + intent → Arrangement (Claude Agent SDK)
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.arrange import arrange_async
from app.pitch import detect_pitch_from_bytes
from app.schemas import Arrangement, Note, PitchResult

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("bubbles")

app = FastAPI(title="Bubbles", version="0.1.0")

# Local-only: Vite on :3000, backend on :5001. Tighten if we ever deploy.
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


@app.post("/pitch", response_model=PitchResult)
async def pitch_endpoint(audio: UploadFile = File(...)) -> PitchResult:
    """Detect pitches from a hummed audio file.

    Accepts WebM/Opus, MP4/AAC, or WAV. Returns MIDI notes, estimated BPM,
    and a best-guess key.
    """
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio upload.")
    if len(audio_bytes) > _MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Audio file too large (>{_MAX_AUDIO_BYTES // 1024 // 1024} MB).",
        )

    suffix = ".wav"
    if audio.filename and "." in audio.filename:
        suffix = "." + audio.filename.rsplit(".", 1)[-1].lower()

    try:
        result = detect_pitch_from_bytes(audio_bytes, suffix=suffix)
    except Exception as exc:
        log.exception("Pitch detection failed")
        raise HTTPException(
            status_code=500,
            detail=f"Pitch detection failed: {exc.__class__.__name__}",
        ) from exc

    if not result.notes:
        raise HTTPException(
            status_code=422,
            detail="No clear melody detected. Try humming a steady pitch.",
        )

    return result


class ArrangeRequest(BaseModel):
    notes: list[Note]
    intent: str | None = None
    prior: Arrangement | None = None


@app.post("/arrange", response_model=Arrangement)
async def arrange_endpoint(req: ArrangeRequest) -> Arrangement:
    """Build (or refine) an Arrangement from the hummed notes + voice intent.

    First call: pass `notes` and optional `intent` (a free-form text like
    "make it sadder"); leave `prior` null.
    Refinement: pass the previous Arrangement as `prior` and the new intent.
    """
    if not req.notes:
        raise HTTPException(
            status_code=400, detail="At least one hummed note is required."
        )
    try:
        return await arrange_async(req.notes, req.intent, req.prior)
    except Exception as exc:
        log.exception("Arrangement failed")
        raise HTTPException(
            status_code=500,
            detail=f"Arrangement failed: {exc.__class__.__name__}",
        ) from exc


# Convenience: combined hum → arrangement in one round-trip. Used by the
# "press hum" path on the frontend so it only makes one network call.
@app.post("/arrange-from-hum", response_model=Arrangement)
async def arrange_from_hum(
    audio: UploadFile = File(...),
    intent: str = Form(""),
) -> Arrangement:
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio upload.")

    suffix = ".wav"
    if audio.filename and "." in audio.filename:
        suffix = "." + audio.filename.rsplit(".", 1)[-1].lower()

    pitch = detect_pitch_from_bytes(audio_bytes, suffix=suffix)
    if not pitch.notes:
        raise HTTPException(
            status_code=422,
            detail="No clear melody detected. Try humming a steady pitch.",
        )

    return await arrange_async(pitch.notes, intent or None, prior=None)
