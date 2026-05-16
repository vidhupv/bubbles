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
