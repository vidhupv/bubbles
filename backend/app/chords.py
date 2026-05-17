"""Detect a chord progression from a hummed audio clip.

The user hums chord roots in time — typically ~1 second per chord for a
4-chord progression in a 4-second recording. We:

1. basic-pitch the audio → MIDI notes.
2. Bucket notes into 4 equal time segments.
3. For each segment, take the most-prominent pitch class (the chord root).
4. Apply mode-appropriate chord quality (i.e. minor mode → minor chord by
   default, with diatonic adjustments for scale degree).

Returns 4 chord symbols.
"""

from __future__ import annotations

import logging
from collections import Counter

from app.pitch import detect_pitch_from_bytes
from app.schemas import Note

log = logging.getLogger(__name__)

PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Diatonic chord qualities by scale degree. Index = semitones above tonic.
# `m` = minor, `` = major, `dim` = diminished. Sparse keys (non-scale degrees)
# fall back to major (won't usually happen with reasonable input).
_MAJOR_QUALITIES = {0: "", 2: "m", 4: "m", 5: "", 7: "", 9: "m", 11: "dim"}
_MINOR_QUALITIES = {0: "m", 2: "dim", 3: "", 5: "m", 7: "m", 8: "", 10: ""}
_DORIAN_QUALITIES = {0: "m", 2: "m", 3: "", 5: "", 7: "m", 9: "dim", 10: ""}


def detect_chord_progression(
    audio_bytes: bytes,
    suffix: str,
    tonic: str,
    mode: str,
) -> tuple[list[str], float]:
    """Returns (chord_symbols, detected_bpm)."""
    pitch_result = detect_pitch_from_bytes(audio_bytes, suffix=suffix)
    if not pitch_result.notes:
        return [], pitch_result.bpm

    duration = pitch_result.duration if pitch_result.duration > 0 else 1.0
    notes = pitch_result.notes
    segment_len = duration / 4.0

    roots: list[int] = []
    for i in range(4):
        lo = i * segment_len
        hi = (i + 1) * segment_len
        bucket = [n for n in notes if n.start < hi and n.end > lo]
        if not bucket:
            # Carry the previous root forward when a bucket is empty.
            roots.append(roots[-1] if roots else _midi_pc(notes[0].midi))
            continue
        # Weight by overlap duration with the segment, biased toward lower
        # (root-like) notes when ties exist.
        weights: dict[int, float] = {}
        for n in bucket:
            pc = _midi_pc(n.midi)
            overlap = max(0.0, min(n.end, hi) - max(n.start, lo))
            weights[pc] = weights.get(pc, 0.0) + overlap
        best_pc = max(weights, key=lambda p: (weights[p], -p))
        roots.append(best_pc)

    tonic_pc = _pitch_class_index(tonic)
    qualities = _qualities_for_mode(mode)
    symbols: list[str] = []
    for root_pc in roots:
        scale_degree = (root_pc - tonic_pc) % 12
        suffix_q = qualities.get(scale_degree)
        if suffix_q is None:
            # Out-of-scale root — pick quality by mode default.
            suffix_q = "m" if mode == "minor" else ""
        symbols.append(f"{PITCH_CLASSES[root_pc]}{suffix_q}")

    log.info(
        "detect_chord_progression: roots=%s, tonic=%s %s -> %s",
        [PITCH_CLASSES[r] for r in roots], tonic, mode, symbols,
    )
    return symbols, pitch_result.bpm


def _midi_pc(midi: int) -> int:
    return midi % 12


def _pitch_class_index(name: str) -> int:
    name = name.strip()
    if name in PITCH_CLASSES:
        return PITCH_CLASSES.index(name)
    # Try common synonyms (Bb -> A#)
    flats = {"Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"}
    if name in flats:
        return PITCH_CLASSES.index(flats[name])
    # Fallback: assume A
    return 9


def _qualities_for_mode(mode: str) -> dict[int, str]:
    mode = mode.lower()
    if mode == "major":
        return _MAJOR_QUALITIES
    if mode == "dorian":
        return _DORIAN_QUALITIES
    return _MINOR_QUALITIES


def _majority_pitch_class(notes: list[Note]) -> int:
    """Used by tests."""
    pcs = [n.midi % 12 for n in notes]
    return Counter(pcs).most_common(1)[0][0]
