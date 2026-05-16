/**
 * Hardcoded arrangements for Day 2 playback testing. These go away once the
 * Agent SDK returns real arrangements (Day 3-4).
 */
import type { Arrangement } from "@shared/types";

export const TEST_ARRANGEMENT: Arrangement = {
  tempo: 96,
  key: { tonic: "A", mode: "minor" },
  chord_progression: ["Am", "F", "C", "G"],
  guitar: {
    voicing: "open-strum",
    rhythm: "x...x..xx...x..x",
    sample_set: "electric-clean",
  },
  drums: {
    kit: "rock",
    pattern: {
      kick: "x.......x.......",
      snare: "....X.......X...",
      hat: "x.x.x.x.x.x.x.x.",
    },
  },
  rationale: "Day-2 placeholder: i-VI-III-VII over a basic rock backbeat.",
};
