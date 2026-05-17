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

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.arrange import agent_refine, build_melody_only_arrangement
from app.chords import detect_chord_progression
from app.drums import detect_drum_pattern_from_bytes
from app.library import delete as library_delete
from app.library import list_all as library_list
from app.library import save as library_save
from app.pitch import detect_pitch_from_bytes
from app.schemas import Arrangement, Drums, Guitar, Note, PitchResult

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
    log.info(
        "/arrange-from-hum: %d notes, %.1f BPM, key=%s",
        len(pitch.notes), pitch.bpm, pitch.key_estimate,
    )
    return build_melody_only_arrangement(
        pitch.notes, bpm=pitch.bpm, key_estimate=pitch.key_estimate
    )


class ArrangeRequest(BaseModel):
    notes: list[Note]
    intent: str
    prior: Arrangement | None = None
    bpm_hint: float | None = None
    key_hint: str | None = None


class DrumsFromHumResponse(BaseModel):
    drums: Drums
    tempo: float


@app.post("/drums-from-hum", response_model=DrumsFromHumResponse)
async def drums_from_hum(audio: UploadFile = File(...)) -> DrumsFromHumResponse:
    """Beatbox / tap into the mic → drum pattern (kick / snare / hat).

    No Claude call. Pure librosa onset detection + spectral classification.
    """
    audio_bytes = await audio.read()
    suffix = _read_audio(audio, audio_bytes)
    try:
        pattern, tempo = detect_drum_pattern_from_bytes(audio_bytes, suffix=suffix)
    except Exception as exc:
        log.exception("Drum detection failed")
        raise HTTPException(
            status_code=500,
            detail=f"Drum detection failed: {exc.__class__.__name__}",
        ) from exc

    has_any_hit = any(
        ch != "." for ch in pattern.kick + pattern.snare + pattern.hat
    )
    if not has_any_hit:
        raise HTTPException(
            status_code=422,
            detail="No drum hits detected. Try tapping more clearly.",
        )

    return DrumsFromHumResponse(drums=Drums(kit="rock", pattern=pattern), tempo=tempo)


class ChordsFromHumResponse(BaseModel):
    chord_progression: list[str]
    guitar: Guitar


@app.post("/chords-from-hum", response_model=ChordsFromHumResponse)
async def chords_from_hum(
    audio: UploadFile = File(...),
    tonic: str = Form("A"),
    mode: str = Form("minor"),
) -> ChordsFromHumResponse:
    """Hum 4 chord roots → chord progression.

    The client passes the current melody's tonic + mode so we can apply
    diatonic chord qualities. No Claude call.
    """
    audio_bytes = await audio.read()
    suffix = _read_audio(audio, audio_bytes)
    try:
        symbols, _bpm = detect_chord_progression(
            audio_bytes, suffix=suffix, tonic=tonic, mode=mode,
        )
    except Exception as exc:
        log.exception("Chord detection failed")
        raise HTTPException(
            status_code=500,
            detail=f"Chord detection failed: {exc.__class__.__name__}",
        ) from exc

    if len(symbols) != 4:
        raise HTTPException(
            status_code=422,
            detail="Couldn't pick out 4 chord roots from that hum. Try humming "
            "4 distinct sustained notes, one per chord.",
        )

    guitar = Guitar(
        voicing="open-strum",
        rhythm="x.x.x.x.x.x.x.x.",
        sample_set="acoustic",
    )
    return ChordsFromHumResponse(chord_progression=symbols, guitar=guitar)


class SaveLibraryRequest(BaseModel):
    arrangement: Arrangement
    title: str | None = None


@app.post("/library")
async def library_save_endpoint(req: SaveLibraryRequest) -> dict:
    """Save an arrangement to the local taste library."""
    return library_save(req.arrangement, req.title)


@app.get("/library")
async def library_list_endpoint() -> dict:
    return {"items": library_list()}


@app.delete("/library/{entry_id}")
async def library_delete_endpoint(entry_id: str) -> dict:
    removed = library_delete(entry_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Library entry not found.")
    return {"deleted": entry_id}


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
        return await agent_refine(
            req.notes,
            req.intent,
            req.prior,
            bpm_hint=req.bpm_hint,
            key_hint=req.key_hint,
        )
    except Exception as exc:
        log.exception("Arrangement failed")
        raise HTTPException(
            status_code=500, detail=f"Arrangement failed: {exc.__class__.__name__}"
        ) from exc
