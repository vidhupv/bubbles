"""Bubbles backend entrypoint.

Run with:
    uv run uvicorn main:app --port 5001 --reload

Endpoints:
    GET  /health
    POST /pitch     hum audio → MIDI notes + BPM + key
    POST /arrange   MIDI + intent → Arrangement (Claude Agent SDK, TODO)
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.pitch import detect_pitch_from_bytes
from app.schemas import PitchResult

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("bubbles")

app = FastAPI(title="Bubbles", version="0.1.0")

# Local-only: Vite runs on :3000, backend on :5001. Tighten if we ever deploy.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# 30 seconds at 48 kHz, 16-bit mono ≈ 2.9 MB. Generous upper bound.
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

    # basic-pitch reads by file path and detects format by extension. Pass
    # through whatever the browser sent (webm, mp4, wav).
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
        # Not a 500 — the hum was silent or atonal. Let the client show a toast.
        raise HTTPException(
            status_code=422,
            detail="No clear melody detected. Try humming a steady pitch.",
        )

    return result
