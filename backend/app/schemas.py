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
    """Musical arrangement built from the user's hum.

    `melody` is the source-of-truth lead line — pitch-detected from the hum,
    never invented by the agent. The agent picks tempo, key, and OPTIONAL
    chord_progression / drums layers when the user asks for them.

    First playback after a hum: melody only. The user opts into chords + drums
    via explicit intents.
    """

    tempo: int = Field(..., ge=60, le=180)
    key: Key
    melody: list[Note] = Field(
        ..., description="Pitch-detected notes from the user's hum. Required."
    )
    chord_progression: list[str] = Field(
        default_factory=list,
        description="Exactly 4 chord symbols when present; empty when the user hasn't asked for chords.",
    )
    guitar: Guitar | None = Field(
        default=None,
        description="Guitar accompaniment voicing/rhythm. Null when chord_progression is empty.",
    )
    drums: Drums | None = Field(
        default=None,
        description="Drums layer. Null when the user hasn't asked for drums.",
    )
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
