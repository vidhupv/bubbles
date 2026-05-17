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

# basic-pitch defaults match the Spotify online demo's accuracy. Lowering
# onset_threshold causes sustained notes to be re-triggered (fragmenting one
# held "Saaaa" into 5 short attacks) — keep it at the default. We compensate
# with `_merge_sustained_notes()` below to glue any same-pitch fragments
# back together.
_ONSET_THRESHOLD = 0.5
_FRAME_THRESHOLD = 0.3
_MIN_NOTE_LEN_MS = 127.7

# Max gap (seconds) between two same-pitch notes that we consider one held
# note that basic-pitch fragmented.
_MERGE_GAP_S = 0.15

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
        _model_output, _midi_data, note_events = predict(
            str(tmp_path),
            onset_threshold=_ONSET_THRESHOLD,
            frame_threshold=_FRAME_THRESHOLD,
            minimum_note_length=_MIN_NOTE_LEN_MS,
        )
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
    notes = _merge_sustained_notes(notes)

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


def _merge_sustained_notes(notes: list[Note]) -> list[Note]:
    """Glue same-pitch consecutive notes back together.

    basic-pitch reliably detects pitch but tends to fragment held notes into
    several short attacks (the "Saaaa → dudududu" effect the user noticed).
    This walk-merge fixes that without re-running the model.

    Two notes merge when:
      - Same MIDI number
      - Gap between A.end and B.start is < _MERGE_GAP_S
    Result keeps the earliest start, the latest end, and the max velocity.
    """
    if not notes:
        return notes
    merged: list[Note] = [notes[0]]
    for n in notes[1:]:
        prev = merged[-1]
        if n.midi == prev.midi and (n.start - prev.end) < _MERGE_GAP_S:
            # Extend the prior note; keep its onset.
            merged[-1] = Note(
                midi=prev.midi,
                start=prev.start,
                end=max(prev.end, n.end),
                velocity=max(prev.velocity, n.velocity),
            )
        else:
            merged.append(n)
    return merged


def _estimate_key(notes: list[Note]) -> str:
    """Estimate key as 'TONIC MODE' using Krumhansl-style pitch-class weights.

    Picks the tonic that has the highest correlation with either the major
    or minor scale profile. This is much better than always defaulting to
    minor — works correctly on happy/major melodies.
    """
    if not notes:
        return "C minor"

    # Pitch-class histogram weighted by note duration (longer notes matter more)
    weights = [0.0] * 12
    for n in notes:
        weights[n.midi % 12] += max(n.end - n.start, 0.05)

    # Krumhansl-Kessler major / minor profiles (simplified to integer-ish).
    # Higher values = pitches that are characteristic of that mode.
    major_profile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    minor_profile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

    best_score = -1.0
    best_tonic = 0
    best_mode = "minor"
    for tonic in range(12):
        # Rotate profile so index 0 = tonic
        for mode, profile in (("major", major_profile), ("minor", minor_profile)):
            score = sum(
                weights[(tonic + i) % 12] * profile[i] for i in range(12)
            )
            if score > best_score:
                best_score = score
                best_tonic = tonic
                best_mode = mode

    return f"{_PITCH_CLASSES[best_tonic]} {best_mode}"


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
