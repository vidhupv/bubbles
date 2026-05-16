"""Smoke tests for the pitch endpoint.

These hit the real basic-pitch model — slow (~3-5s on M-series Macs). Keep the
suite small.
"""

import io

import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _make_tone_wav(freq_hz: float, duration_s: float, sr: int = 22050) -> bytes:
    """Generate a sine-wave WAV in memory."""
    t = np.linspace(0, duration_s, int(sr * duration_s), endpoint=False)
    samples = (0.4 * np.sin(2 * np.pi * freq_hz * t)).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, samples, sr, format="WAV")
    return buf.getvalue()


def test_health() -> None:
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_pitch_a4() -> None:
    wav = _make_tone_wav(440.0, 2.0)
    r = client.post("/pitch", files={"audio": ("hum.wav", wav, "audio/wav")})
    assert r.status_code == 200, r.text

    data = r.json()
    assert data["duration"] > 1.5
    assert len(data["notes"]) >= 1
    # 440Hz = MIDI 69 (A4)
    midi_numbers = [n["midi"] for n in data["notes"]]
    assert 69 in midi_numbers, f"Expected MIDI 69 (A4), got {midi_numbers}"
    # Tonic from a single A note should be A
    assert data["key_estimate"].startswith("A")


def test_pitch_empty() -> None:
    r = client.post("/pitch", files={"audio": ("empty.wav", b"", "audio/wav")})
    assert r.status_code == 400


def test_pitch_silence_returns_422() -> None:
    # 1 second of silence
    silence = _make_tone_wav(0.0, 1.0)  # 0 Hz → all zeros
    r = client.post("/pitch", files={"audio": ("silent.wav", silence, "audio/wav")})
    assert r.status_code == 422


def test_merge_sustained_notes() -> None:
    """Regression for the 'one held Saaaa → 5 short attacks' bug."""
    from app.pitch import _merge_sustained_notes
    from app.schemas import Note as PNote

    # Three fragments of MIDI 69, each ~80ms apart — should collapse to one
    fragments = [
        PNote(midi=69, start=0.00, end=0.20, velocity=0.6),
        PNote(midi=69, start=0.28, end=0.45, velocity=0.7),
        PNote(midi=69, start=0.52, end=0.70, velocity=0.5),
    ]
    merged = _merge_sustained_notes(fragments)
    assert len(merged) == 1
    assert merged[0].start == 0.00
    assert merged[0].end == 0.70
    assert merged[0].velocity == 0.7  # max wins


def test_merge_keeps_distinct_pitches() -> None:
    """Different MIDI numbers must NOT merge, even if adjacent."""
    from app.pitch import _merge_sustained_notes
    from app.schemas import Note as PNote

    notes = [
        PNote(midi=69, start=0.0, end=0.3, velocity=0.7),
        PNote(midi=71, start=0.31, end=0.6, velocity=0.7),
    ]
    merged = _merge_sustained_notes(notes)
    assert len(merged) == 2


def test_merge_keeps_distant_same_pitch_separate() -> None:
    """Same pitch with a big gap is a distinct note, not a fragment."""
    from app.pitch import _merge_sustained_notes
    from app.schemas import Note as PNote

    notes = [
        PNote(midi=69, start=0.0, end=0.3, velocity=0.7),
        PNote(midi=69, start=1.0, end=1.3, velocity=0.7),  # 700ms gap
    ]
    merged = _merge_sustained_notes(notes)
    assert len(merged) == 2
