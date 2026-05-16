"""Pitch detection: hum WAV → MIDI notes + BPM + key estimate.

Uses Spotify's `basic-pitch` model via CoreML (Apple Silicon) for fast local
inference. BPM and key estimation are deliberately simple heuristics here —
the agent (Claude) makes the real musical decisions downstream.
"""

from __future__ import annotations

import logging
import tempfile
from collections import Counter
from pathlib import Path

from basic_pitch.inference import predict

from app.schemas import Note, PitchResult

log = logging.getLogger(__name__)

# MIDI note number → letter name (sharps; flat-equivalence handled by Claude).
_PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Default BPM when we can't infer one. Mid-tempo, comfortable for both rock
# and lofi vibes. The agent can override via the tempo edit op.
_DEFAULT_BPM = 90.0


def detect_pitch_from_bytes(audio_bytes: bytes, suffix: str = ".wav") -> PitchResult:
    """Run basic-pitch on an uploaded audio blob.

    The audio bytes are written to a temp file because basic-pitch's
    `predict()` reads from a path (not a buffer).
    """
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = Path(tmp.name)

    try:
        _model_output, _midi_data, note_events = predict(str(tmp_path))
    finally:
        tmp_path.unlink(missing_ok=True)

    # `note_events` is a list of (start_s, end_s, midi, velocity, pitch_bends)
    notes: list[Note] = []
    for ev in note_events:
        start, end, midi, velocity = ev[0], ev[1], int(ev[2]), float(ev[3])
        notes.append(
            Note(midi=midi, start=float(start), end=float(end), velocity=velocity)
        )
    notes.sort(key=lambda n: n.start)

    duration = max((n.end for n in notes), default=0.0)
    key_estimate = _estimate_key(notes)
    bpm = _estimate_bpm(notes, duration)

    log.info(
        "detect_pitch: %d notes, %.2fs duration, %.1f BPM, key=%s",
        len(notes), duration, bpm, key_estimate,
    )

    return PitchResult(
        notes=notes,
        bpm=bpm,
        key_estimate=key_estimate,
        duration=duration,
    )


def _estimate_key(notes: list[Note]) -> str:
    """Cheap key guess: most-common pitch class is the tonic; mode defaults to minor.

    Claude refines this anyway via the arrangement's `key` field — this is a
    nudge, not a hard call.
    """
    if not notes:
        return "C minor"
    pitch_classes = [n.midi % 12 for n in notes]
    tonic_idx, _count = Counter(pitch_classes).most_common(1)[0]
    return f"{_PITCH_CLASSES[tonic_idx]} minor"


def _estimate_bpm(notes: list[Note], duration: float) -> float:
    """Cheap BPM guess from inter-onset intervals.

    If we can't infer (one note, no clear rhythm), return the default. Claude
    can override via the tempo edit op.
    """
    if len(notes) < 4 or duration < 1.5:
        return _DEFAULT_BPM

    onsets = sorted(n.start for n in notes)
    gaps = [b - a for a, b in zip(onsets, onsets[1:], strict=False) if b - a > 0.05]
    if not gaps:
        return _DEFAULT_BPM

    # Median gap → assume quarter-note interval at the source tempo.
    gaps.sort()
    median_gap = gaps[len(gaps) // 2]
    bpm = 60.0 / median_gap

    # Snap into a sane range — humming rarely produces extreme tempos.
    while bpm < 60:
        bpm *= 2
    while bpm > 180:
        bpm /= 2
    return round(bpm, 1)
