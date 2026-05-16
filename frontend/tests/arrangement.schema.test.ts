/**
 * Contract test for the Arrangement schema.
 *
 * This is the highest-leverage test in the suite — it catches the moment
 * Claude's structured-output prompt drifts from the schema, before that drift
 * crashes Tone.js mid-demo.
 */

import { describe, expect, it } from "vitest";
import { ArrangementSchema, PitchResultSchema } from "../src/audio/validate";

const goldenArrangement = {
  tempo: 92,
  key: { tonic: "A", mode: "minor" as const },
  chord_progression: ["Am", "F", "C", "G"],
  guitar: {
    voicing: "open-strum" as const,
    rhythm: "x---x---x---x---",
    sample_set: "electric-clean" as const,
  },
  drums: {
    kit: "rock" as const,
    pattern: {
      kick: "x...x...x...x...",
      snare: "....X.......X...",
      hat: "xxxxxxxxxxxxxxxx",
    },
  },
  rationale: "Minor pentatonic outline → i-VI-III-VII keeps the melody floating.",
};

describe("ArrangementSchema", () => {
  it("accepts the golden fixture", () => {
    const r = ArrangementSchema.safeParse(goldenArrangement);
    expect(r.success).toBe(true);
  });

  it("rejects out-of-range tempo", () => {
    const bad = { ...goldenArrangement, tempo: 240 };
    expect(ArrangementSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects wrong chord-progression length", () => {
    const bad = { ...goldenArrangement, chord_progression: ["Am", "F", "C"] };
    expect(ArrangementSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a drum pattern of wrong length", () => {
    const bad = {
      ...goldenArrangement,
      drums: {
        ...goldenArrangement.drums,
        pattern: { ...goldenArrangement.drums.pattern, kick: "x.x.x.x." },
      },
    };
    expect(ArrangementSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown drum kit", () => {
    const bad = {
      ...goldenArrangement,
      drums: { ...goldenArrangement.drums, kit: "jazz" },
    };
    expect(ArrangementSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an empty rationale", () => {
    const bad = { ...goldenArrangement, rationale: "" };
    expect(ArrangementSchema.safeParse(bad).success).toBe(false);
  });
});

describe("PitchResultSchema", () => {
  it("accepts a valid pitch result", () => {
    const valid = {
      notes: [{ midi: 69, start: 0.0, end: 1.5, velocity: 0.62 }],
      bpm: 90,
      key_estimate: "A minor",
      duration: 1.5,
    };
    expect(PitchResultSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects out-of-range MIDI numbers", () => {
    const bad = {
      notes: [{ midi: 200, start: 0, end: 1, velocity: 0.5 }],
      bpm: 90,
      key_estimate: "A minor",
      duration: 1,
    };
    expect(PitchResultSchema.safeParse(bad).success).toBe(false);
  });
});
