import { describe, expect, it } from "vitest";
import type { Arrangement } from "@shared/types";
import { nudgeTempo, transposeArrangement } from "../src/audio/edit";

const arrangement: Arrangement = {
  tempo: 96,
  key: { tonic: "C", mode: "minor" },
  melody: [
    { midi: 60, start: 0, end: 0.5, velocity: 0.8 },
    { midi: 63, start: 0.5, end: 1, velocity: 0.7 },
  ],
  chord_progression: ["Cm", "Ab", "F", "G"],
  guitar: {
    voicing: "fingerpick",
    rhythm: "x...x...x...x...",
    sample_set: "acoustic",
  },
  drums: null,
  rationale: "Seed arrangement.",
};

describe("transposeArrangement", () => {
  it("transposes melody, key, and chord roots together", () => {
    const next = transposeArrangement(arrangement, 2);

    expect(next.melody.map((note) => note.midi)).toEqual([62, 65]);
    expect(next.key.tonic).toBe("D");
    expect(next.chord_progression).toEqual(["Dm", "A#", "G", "A"]);
  });

  it("clamps melody notes into MIDI range", () => {
    const next = transposeArrangement(
      {
        ...arrangement,
        melody: [{ midi: 125, start: 0, end: 0.5, velocity: 0.8 }],
      },
      6,
    );

    expect(next.melody[0].midi).toBe(127);
  });
});

describe("nudgeTempo", () => {
  it("clamps tempo to the supported renderer range", () => {
    expect(nudgeTempo({ ...arrangement, tempo: 178 }, 10).tempo).toBe(180);
    expect(nudgeTempo({ ...arrangement, tempo: 62 }, -10).tempo).toBe(60);
  });
});
