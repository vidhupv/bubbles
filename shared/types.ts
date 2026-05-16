/**
 * Shared data shapes. Mirrors backend/app/schemas.py — when changes happen
 * here, update the Pydantic models in lockstep.
 *
 * Runtime validation lives in `frontend/src/audio/validate.ts` (Zod).
 */

export type Mode = "major" | "minor" | "dorian" | "mixolydian";
export type GuitarVoicing = "open-strum" | "power" | "fingerpick" | "muted-chuck";
export type DrumKit = "rock" | "lofi";
export type SampleSet = "acoustic" | "electric-clean" | "electric-dirty";

/** A single hummed note returned by POST /pitch. */
export interface Note {
  midi: number;
  start: number;
  end: number;
  velocity: number;
}

/** Output of POST /pitch — hum → MIDI + tempo + key guess. */
export interface PitchResult {
  notes: Note[];
  bpm: number;
  key_estimate: string;
  duration: number;
}

export interface Key {
  tonic: string;
  mode: Mode;
}

export interface Guitar {
  voicing: GuitarVoicing;
  /** 16-step pattern DSL: `x` strike, `X` accent, `.` rest, `-` sustain. */
  rhythm: string;
  sample_set: SampleSet;
}

export interface DrumPattern {
  /** 16-step strings per drum lane. */
  kick: string;
  snare: string;
  hat: string;
}

export interface Drums {
  kit: DrumKit;
  pattern: DrumPattern;
}

/**
 * Arrangement built from the user's hum.
 *
 * `melody` is the source-of-truth lead line — pitch-detected from the hum,
 * preserved verbatim. The agent picks tempo, key, and OPTIONAL
 * chord_progression / drums layers when the user explicitly asks.
 *
 * First playback: melody only. The user opts into chords + drums.
 */
export interface Arrangement {
  tempo: number;
  key: Key;
  /** The hummed melody — always present. */
  melody: Note[];
  /** Empty array when the user hasn't asked for chords yet. */
  chord_progression: string[];
  /** Null when chord_progression is empty. */
  guitar: Guitar | null;
  /** Null until the user adds drums. */
  drums: Drums | null;
  rationale: string;
}
