/**
 * Hardcoded test arrangements used in unit tests.
 */
import type { Arrangement } from "@shared/types";

const SIMPLE_MELODY = [
  { midi: 69, start: 0.0, end: 0.5, velocity: 0.7 },
  { midi: 72, start: 0.5, end: 1.0, velocity: 0.7 },
  { midi: 71, start: 1.0, end: 1.5, velocity: 0.7 },
  { midi: 69, start: 1.5, end: 2.0, velocity: 0.7 },
];

/** Melody-only arrangement (no chords, no drums). The default first-press shape. */
export const MELODY_ONLY_ARRANGEMENT: Arrangement = {
  tempo: 96,
  key: { tonic: "A", mode: "minor" },
  melody: SIMPLE_MELODY,
  chord_progression: [],
  guitar: null,
  drums: null,
  rationale: "Test arrangement: melody only.",
};

/** Full arrangement with chords + drums for testing all layers. */
export const FULL_ARRANGEMENT: Arrangement = {
  tempo: 96,
  key: { tonic: "A", mode: "minor" },
  melody: SIMPLE_MELODY,
  chord_progression: ["Am", "F", "C", "G"],
  guitar: {
    voicing: "open-strum",
    rhythm: "x...............",
    sample_set: "electric-clean",
  },
  drums: {
    kit: "rock",
    pattern: {
      kick: "x...x...x...x...",
      snare: "....X.......X...",
      hat: "xxxxxxxxxxxxxxxx",
    },
  },
  rationale: "Test arrangement with everything.",
};
