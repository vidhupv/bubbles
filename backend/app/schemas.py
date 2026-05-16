"""Shared data shapes for the Bubbles backend.

These mirror `shared/types.ts` on the frontend. When changes happen here,
update the frontend types in lockstep. The Arrangement schema is the contract
Claude must produce — see app/arrange.py.
"""

from typing import Literal

from pydantic import BaseModel, Field


class Note(BaseModel):
    """A single note detected from the hummed audio."""

    midi: int = Field(..., ge=0, le=127, description="MIDI note number (0-127).")
    start: float = Field(..., ge=0, description="Start time in seconds.")
    end: float = Field(..., ge=0, description="End time in seconds.")
    velocity: float = Field(default=0.7, ge=0, le=1, description="Normalized velocity.")


class PitchResult(BaseModel):
    """The output of POST /pitch."""

    notes: list[Note]
    bpm: float = Field(..., description="Estimated tempo in BPM.")
    key_estimate: str = Field(
        ..., description="Best-guess key, like 'A minor' or 'C major'."
    )
    duration: float = Field(..., ge=0, description="Source audio duration in seconds.")


# --- Arrangement (returned by /arrange, written by Claude) -------------------

Mode = Literal["major", "minor", "dorian", "mixolydian"]
GuitarVoicing = Literal["open-strum", "power", "fingerpick", "muted-chuck"]
DrumKit = Literal["rock", "lofi"]
SampleSet = Literal["acoustic", "electric-clean", "electric-dirty"]


class Key(BaseModel):
    tonic: str
    mode: Mode


class Guitar(BaseModel):
    voicing: GuitarVoicing
    rhythm: str = Field(..., description="16-step pattern DSL string for guitar strikes.")
    sample_set: SampleSet


class DrumPattern(BaseModel):
    kick: str
    snare: str
    hat: str


class Drums(BaseModel):
    kit: DrumKit
    pattern: DrumPattern


class Arrangement(BaseModel):
    """Full musical arrangement returned by Claude.

    Played back as: hummed melody as the guitar's lead line, with
    chord_progression underneath, and drums keeping time.
    """

    tempo: int = Field(..., ge=60, le=180)
    key: Key
    chord_progression: list[str] = Field(
        ..., min_length=4, max_length=4, description="Exactly 4 chords, looped."
    )
    guitar: Guitar
    drums: Drums
    rationale: str = Field(..., description="1-3 sentences explaining the musical choice.")


# --- ArrangementEdit (voice intents) -----------------------------------------

EditOpName = Literal[
    "mode-shift",
    "transpose",
    "tempo",
    "swap-kit",
    "simplify",
    "intensify",
    "reharmonize",
    "voicing",
]


class ArrangementEdit(BaseModel):
    """A single edit op chosen by Claude in response to user intent."""

    op: EditOpName
    # Loose: each op uses a different subset of the remaining fields. Validation
    # is delegated to Claude's structured-output prompt.
    to: str | None = None
    semitones: int | None = None
    bpm: int | None = None
    kit: DrumKit | None = None
    lane: Literal["drums", "guitar"] | None = None
    vibe: Literal["darker", "brighter", "tense", "resolved"] | None = None
