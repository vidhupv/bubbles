"""Tests for the arrangement helpers.

We test pure functions only — the live Agent SDK call would be slow and
non-deterministic.
"""

from app.arrange import (
    _estimate_tonic,
    _extract_json,
    _round_tempo,
    _summarize_notes,
    build_melody_only_arrangement,
)
from app.schemas import Note


def test_extract_plain_json() -> None:
    text = '{"tempo": 92, "rationale": "ok"}'
    assert _extract_json(text) == {"tempo": 92, "rationale": "ok"}


def test_extract_json_with_code_fence() -> None:
    text = '```json\n{"tempo": 100}\n```'
    assert _extract_json(text) == {"tempo": 100}


def test_extract_json_with_chatty_prefix() -> None:
    text = 'Sure! Here it is:\n\n{"tempo": 88, "x": [1, 2]}\n\nLet me know.'
    assert _extract_json(text) == {"tempo": 88, "x": [1, 2]}


def test_melody_only_arrangement_no_chords_no_drums() -> None:
    notes = [
        Note(midi=69, start=0.0, end=0.5, velocity=0.7),
        Note(midi=71, start=0.5, end=1.0, velocity=0.7),
    ]
    arr = build_melody_only_arrangement(notes, bpm=92.0)
    assert arr.tempo == 92
    assert arr.chord_progression == []
    assert arr.guitar is None
    assert arr.drums is None
    assert arr.melody == notes
    # Tonic guess: A (MIDI 69) appears once, B (MIDI 71) once — first wins.
    assert arr.key.tonic in {"A", "B"}


def test_melody_only_with_no_notes_defaults_to_A() -> None:
    arr = build_melody_only_arrangement([])
    assert arr.key.tonic == "A"
    assert arr.melody == []


def test_estimate_tonic_picks_most_common_pitch_class() -> None:
    # Three As (MIDI 69), one C (MIDI 60). A wins.
    notes = [
        Note(midi=69, start=0, end=1, velocity=0.7),
        Note(midi=69, start=1, end=2, velocity=0.7),
        Note(midi=69, start=2, end=3, velocity=0.7),
        Note(midi=60, start=3, end=4, velocity=0.7),
    ]
    assert _estimate_tonic(notes) == "A"


def test_round_tempo_clamps_to_range() -> None:
    assert _round_tempo(45) == 60
    assert _round_tempo(220) == 180
    assert _round_tempo(92.7) == 93


def test_summarize_truncates_long_input() -> None:
    notes = [
        Note(midi=60 + (i % 24), start=i * 0.1, end=i * 0.1 + 0.05, velocity=0.7)
        for i in range(80)
    ]
    summary = _summarize_notes(notes)
    assert "and 32 more notes" in summary
