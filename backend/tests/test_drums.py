"""Tests for the drum detection pipeline.

Hits librosa for real, but synthetic input keeps it fast (<1s).
"""

import io

import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient

from app.drums import _classify, _collapse_to_one_bar
from main import app

client = TestClient(app)


def _make_clicks(sr: int = 22050, times_s: list[float] | None = None) -> bytes:
    """Generate a short audio clip with broadband clicks at given times."""
    times_s = times_s or [0.0, 0.5, 1.0, 1.5]
    duration = max(times_s) + 0.3
    samples = np.zeros(int(sr * duration), dtype=np.float32)
    for t in times_s:
        idx = int(t * sr)
        # 10ms exponentially-decaying noise burst
        burst_len = int(sr * 0.01)
        burst = (np.random.randn(burst_len) * np.exp(-np.arange(burst_len) / (burst_len * 0.3))).astype(np.float32)
        samples[idx : idx + burst_len] += burst * 0.8
    buf = io.BytesIO()
    sf.write(buf, samples, sr, format="WAV")
    return buf.getvalue()


def test_classify_buckets() -> None:
    assert _classify(200.0) == "kick"
    assert _classify(1500.0) == "snare"
    assert _classify(4000.0) == "hat"


def test_collapse_or_folds_four_bars() -> None:
    # 64 step buffer with one hit in bar 2 (index 18)
    buf = bytearray(b"." * 64)
    buf[18] = ord("x")
    folded = _collapse_to_one_bar(buf)
    # Step 18 wraps to step 2 in a 16-step bar
    assert folded[2] == "x"
    assert len(folded) == 16


def test_drums_from_hum_returns_pattern() -> None:
    wav = _make_clicks()
    r = client.post("/drums-from-hum", files={"audio": ("kicks.wav", wav, "audio/wav")})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "drums" in data
    assert "tempo" in data
    # The detector should have caught at least one onset somewhere.
    pat = data["drums"]["pattern"]
    total_hits = sum(c != "." for c in pat["kick"] + pat["snare"] + pat["hat"])
    assert total_hits >= 1


def test_merge_close_onsets_collapses_overfires() -> None:
    """4 distinct 'du' beats over-fire to ~12 onsets — must collapse to 4."""
    from app.drums import _merge_close_onsets

    # Simulate one beat producing 3 onsets within 50ms each, 4 beats 0.5s apart
    times = []
    lanes = []
    for beat in range(4):
        for delta in (0.0, 0.03, 0.07):
            times.append(beat * 0.5 + delta)
            lanes.append("kick")
    merged_t, merged_l = _merge_close_onsets(times, lanes, 0.12)
    assert len(merged_t) == 4
    assert merged_l == ["kick"] * 4
    # First-onset of each cluster wins → 0.0, 0.5, 1.0, 1.5
    for actual, expected in zip(merged_t, [0.0, 0.5, 1.0, 1.5], strict=True):
        assert abs(actual - expected) < 1e-9


def test_merge_keeps_genuinely_distinct_onsets() -> None:
    """Onsets at 0.5s apart at 120 BPM must NOT merge."""
    from app.drums import _merge_close_onsets

    times = [0.0, 0.5, 1.0, 1.5]
    merged_t, _ = _merge_close_onsets(times, ["kick"] * 4, 0.12)
    assert len(merged_t) == 4


def test_tempo_from_onsets_matches_quarter_note_gap() -> None:
    """4 onsets at 0.5s spacing → tempo should be 120 BPM (quarter notes)."""
    from app.drums import _tempo_from_onsets

    bpm = _tempo_from_onsets([0.0, 0.5, 1.0, 1.5], fallback=90.0)
    assert bpm == 120.0


def test_drums_from_hum_silence_returns_422() -> None:
    silent = np.zeros(22050, dtype=np.float32)
    buf = io.BytesIO()
    sf.write(buf, silent, 22050, format="WAV")
    r = client.post(
        "/drums-from-hum",
        files={"audio": ("silent.wav", buf.getvalue(), "audio/wav")},
    )
    assert r.status_code == 422
