/**
 * Contract test for the Arrangement Zod schema.
 *
 * Highest-leverage test — catches the moment Claude's output drifts from
 * the schema, before that drift breaks playback.
 */

import { describe, expect, it } from "vitest";
import {
  ArrangementSchema,
  PitchResultSchema,
} from "../src/audio/validate";

const melodyOnly = {
  tempo: 92,
  key: { tonic: "A", mode: "minor" as const },
  melody: [{ midi: 69, start: 0, end: 0.5, velocity: 0.7 }],
  chord_progression: [],
  guitar: null,
  drums: null,
  rationale: "Just your hum.",
};

const fullArrangement = {
  tempo: 92,
  key: { tonic: "A", mode: "minor" as const },
  melody: [{ midi: 69, start: 0, end: 0.5, velocity: 0.7 }],
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
  rationale: "Minor pentatonic outline → i-VI-III-VII.",
};

describe("ArrangementSchema", () => {
  it("accepts a melody-only arrangement", () => {
    expect(ArrangementSchema.safeParse(melodyOnly).success).toBe(true);
  });

  it("accepts a full arrangement", () => {
    expect(ArrangementSchema.safeParse(fullArrangement).success).toBe(true);
  });

  it("rejects out-of-range tempo", () => {
    expect(
      ArrangementSchema.safeParse({ ...fullArrangement, tempo: 240 }).success,
    ).toBe(false);
  });

  it("rejects chord_progression of length 3", () => {
    expect(
      ArrangementSchema.safeParse({
        ...fullArrangement,
        chord_progression: ["Am", "F", "C"],
      }).success,
    ).toBe(false);
  });

  it("accepts empty chord_progression (melody only path)", () => {
    expect(
      ArrangementSchema.safeParse({
        ...fullArrangement,
        chord_progression: [],
        guitar: null,
      }).success,
    ).toBe(true);
  });

  it("rejects a drum pattern of wrong length", () => {
    expect(
      ArrangementSchema.safeParse({
        ...fullArrangement,
        drums: {
          ...fullArrangement.drums,
          pattern: { ...fullArrangement.drums.pattern, kick: "x.x.x.x." },
        },
      }).success,
    ).toBe(false);
  });

  it("rejects an empty rationale", () => {
    expect(
      ArrangementSchema.safeParse({ ...fullArrangement, rationale: "" }).success,
    ).toBe(false);
  });

  it("requires the melody field to be present", () => {
    const { melody, ...withoutMelody } = fullArrangement;
    void melody;
    expect(ArrangementSchema.safeParse(withoutMelody).success).toBe(false);
  });
});

describe("PitchResultSchema", () => {
  it("accepts a valid pitch result", () => {
    expect(
      PitchResultSchema.safeParse({
        notes: [{ midi: 69, start: 0.0, end: 1.5, velocity: 0.62 }],
        bpm: 90,
        key_estimate: "A minor",
        duration: 1.5,
      }).success,
    ).toBe(true);
  });

  it("rejects out-of-range MIDI numbers", () => {
    expect(
      PitchResultSchema.safeParse({
        notes: [{ midi: 200, start: 0, end: 1, velocity: 0.5 }],
        bpm: 90,
        key_estimate: "A minor",
        duration: 1,
      }).success,
    ).toBe(false);
  });
});
