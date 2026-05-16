/**
 * Shared data shapes. Mirrors backend/app/schemas.py — when changes happen
 * here, update the Pydantic models in lockstep.
 *
 * Runtime validation lives in `frontend/src/audio/validate.ts` (Zod). The
 * types here are compile-time only; the validator is the source of truth at
 * runtime for anything coming off the network.
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
 * Full arrangement returned by Claude.
 *
 * Played back as: hummed melody → guitar lead line, chord_progression
 * underneath (strummed/picked per voicing), drums keeping time.
 */
export interface Arrangement {
  tempo: number; // BPM, 60-180
  key: Key;
  /** Exactly 4 chord symbols, looped. */
  chord_progression: string[];
  guitar: Guitar;
  drums: Drums;
  /** 1-3 sentences in plain English. Streamed to the chat bubble. */
  rationale: string;
}

/**
 * A single voice-driven edit operation. Claude picks one or more in response
 * to user intent and returns the new Arrangement with these applied.
 */
export type ArrangementEdit =
  | { op: "mode-shift"; to: Mode }
  | { op: "transpose"; semitones: number }
  | { op: "tempo"; bpm: number }
  | { op: "swap-kit"; kit: DrumKit }
  | { op: "simplify"; lane: "drums" | "guitar" }
  | { op: "intensify"; lane: "drums" | "guitar" }
  | { op: "reharmonize"; vibe: "darker" | "brighter" | "tense" | "resolved" }
  | { op: "voicing"; to: GuitarVoicing };
