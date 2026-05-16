"""Tests for the arrangement endpoint.

We don't hit the real Agent SDK in tests — auth isn't guaranteed and a model
call costs latency we don't want in the unit suite. We test the pure helpers
(JSON extraction, fallback shape, prompt assembly).
"""

from app.arrange import _extract_json, _fallback_arrangement, _summarize_notes
from app.schemas import Note


def test_extract_plain_json() -> None:
    text = '{"tempo": 92, "rationale": "ok"}'
    out = _extract_json(text)
    assert out == {"tempo": 92, "rationale": "ok"}


def test_extract_json_with_code_fence() -> None:
    text = '```json\n{"tempo": 100}\n```'
    out = _extract_json(text)
    assert out == {"tempo": 100}


def test_extract_json_with_chatty_prefix() -> None:
    text = 'Sure! Here is the arrangement:\n\n{"tempo": 88, "x": [1, 2]}\n\nLet me know.'
    out = _extract_json(text)
    assert out == {"tempo": 88, "x": [1, 2]}


def test_fallback_arrangement_validates() -> None:
    notes = [
        Note(midi=69, start=0.0, end=0.5, velocity=0.7),
        Note(midi=72, start=0.5, end=1.0, velocity=0.7),
    ]
    arr = _fallback_arrangement(notes)
    # Most common pitch class wins; A=9, C=0. Both appear once each — either OK.
    assert arr.tempo == 92
    assert len(arr.chord_progression) == 4
    assert len(arr.guitar.rhythm) == 16
    for pat in [arr.drums.pattern.kick, arr.drums.pattern.snare, arr.drums.pattern.hat]:
        assert len(pat) == 16


def test_fallback_with_no_notes() -> None:
    arr = _fallback_arrangement([])
    assert arr.key.tonic == "A"


def test_summarize_truncates_long_input() -> None:
    notes = [
        Note(midi=60 + i, start=i * 0.1, end=i * 0.1 + 0.05, velocity=0.7)
        for i in range(50)
    ]
    summary = _summarize_notes(notes)
    assert "and 26 more notes" in summary
