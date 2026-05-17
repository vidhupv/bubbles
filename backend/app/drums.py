"""Detect a drum pattern from a beatboxed / tapped audio clip.

Approach:
  1. Load audio at 22050 Hz mono.
  2. librosa.onset.onset_detect → onset times in seconds.
  3. librosa.beat.beat_track → tempo estimate.
  4. Snap each onset to the nearest 16th note in a 4-bar window.
  5. Spectral centroid per onset roughly classifies kick (low) vs snare
     (mid) vs hat (high). The thresholds are coarse — non-musicians who
     beatbox "boom-tss-boom-tss" will get plausibly-correct lanes.

Returns a DrumPattern (three 16-step strings) plus the detected tempo.
"""

from __future__ import annotations

import logging
import tempfile
from pathlib import Path

import librosa
import numpy as np

from app.schemas import DrumPattern

log = logging.getLogger(__name__)

_SR = 22_050
_TOTAL_STEPS = 64  # 4 bars × 16 steps
_STEPS_PER_BAR = 16

# Coarse centroid thresholds (Hz) to bucket onsets into drum lanes.
# Tuned for typical beatboxing: low "boom" ≈ 100-600Hz, snare "tk/ka" ≈
# 800-2500Hz, hat "ts" ≈ 3000Hz+.
_KICK_MAX_HZ = 800.0
_SNARE_MAX_HZ = 2500.0


def detect_drum_pattern_from_bytes(
    audio_bytes: bytes, suffix: str = ".wav"
) -> tuple[DrumPattern, float]:
    """Returns (pattern, tempo_bpm)."""
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = Path(tmp.name)

    try:
        y, sr = librosa.load(str(tmp_path), sr=_SR, mono=True)
    finally:
        tmp_path.unlink(missing_ok=True)

    if y.size == 0:
        return _empty_pattern(), 90.0

    # Onset detection — `backtrack=True` aligns to the energy floor so the
    # snap-to-grid math doesn't drift forward.
    onset_frames = librosa.onset.onset_detect(
        y=y, sr=sr, units="frames", backtrack=True
    )
    if onset_frames.size == 0:
        return _empty_pattern(), _safe_tempo(y, sr)

    onset_times = librosa.frames_to_time(onset_frames, sr=sr)
    tempo = _safe_tempo(y, sr)

    # Centroid per onset → drum lane
    centroids = _onset_centroids(y, sr, onset_frames)
    lanes = [_classify(c) for c in centroids]

    step_seconds = 60.0 / tempo / 4.0  # 16th notes
    bar_seconds = step_seconds * _STEPS_PER_BAR

    # Snap each onset to the nearest 16th in a 4-bar window. Wrap with modulo
    # so longer recordings fold into the loop.
    kick = bytearray(b"." * _TOTAL_STEPS)
    snare = bytearray(b"." * _TOTAL_STEPS)
    hat = bytearray(b"." * _TOTAL_STEPS)

    for t, lane in zip(onset_times, lanes, strict=False):
        loop_t = t % (bar_seconds * 4)
        step = int(round(loop_t / step_seconds)) % _TOTAL_STEPS
        target = kick if lane == "kick" else snare if lane == "snare" else hat
        # `x` = normal hit; first hit of bar accents to "X"
        target[step] = ord("x") if target[step] == ord(".") else target[step]

    log.info(
        "detect_drum_pattern: %d onsets, tempo=%.1f BPM, lanes=%s",
        len(onset_times),
        tempo,
        {"kick": lanes.count("kick"), "snare": lanes.count("snare"), "hat": lanes.count("hat")},
    )

    # Fold each lane down from 64 steps to one 16-step pattern that loops
    # across all four bars. We OR the four bars together so a sparse hum
    # ("boom on beat 1 only") still produces a usable loop.
    pattern = DrumPattern(
        kick=_collapse_to_one_bar(kick),
        snare=_collapse_to_one_bar(snare),
        hat=_collapse_to_one_bar(hat),
    )
    return pattern, tempo


def _safe_tempo(y: np.ndarray, sr: int) -> float:
    try:
        tempo, _beats = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(np.atleast_1d(tempo)[0])
    except Exception:  # noqa: BLE001
        bpm = 90.0
    while bpm < 60:
        bpm *= 2
    while bpm > 180:
        bpm /= 2
    return round(bpm, 1)


def _onset_centroids(
    y: np.ndarray, sr: int, onset_frames: np.ndarray
) -> list[float]:
    """Centroid frequency around each onset (10ms window)."""
    centroid_full = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    n_frames = centroid_full.shape[0]
    out: list[float] = []
    for f in onset_frames:
        idx = min(max(int(f), 0), n_frames - 1)
        # Average a tiny window of frames around the onset for stability.
        lo = max(idx - 1, 0)
        hi = min(idx + 2, n_frames)
        out.append(float(centroid_full[lo:hi].mean()))
    return out


def _classify(centroid_hz: float) -> str:
    if centroid_hz < _KICK_MAX_HZ:
        return "kick"
    if centroid_hz < _SNARE_MAX_HZ:
        return "snare"
    return "hat"


def _collapse_to_one_bar(four_bars: bytearray) -> str:
    """OR-fold a 64-step bytearray down to 16 steps."""
    out = bytearray(b"." * _STEPS_PER_BAR)
    for i in range(_TOTAL_STEPS):
        if four_bars[i] != ord("."):
            slot = i % _STEPS_PER_BAR
            if out[slot] == ord("."):
                out[slot] = four_bars[i]
    return out.decode("ascii")


def _empty_pattern() -> DrumPattern:
    return DrumPattern(kick="." * 16, snare="." * 16, hat="." * 16)
