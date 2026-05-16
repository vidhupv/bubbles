/**
 * Tests the pure `planEvents()` transform from arrangement → ordered events.
 *
 * The Tone.js application layer (`play()`) needs a real AudioContext and is
 * smoke-tested in the browser — Playwright E2E coverage lands Day 6-7.
 */
import { describe, expect, it } from "vitest";
import type { Arrangement } from "@shared/types";
import { planEvents } from "../src/audio/renderer";

function makeArrangement(overrides: Partial<Arrangement> = {}): Arrangement {
  return {
    tempo: 96,
    key: { tonic: "A", mode: "minor" },
    chord_progression: ["Am", "F", "C", "G"],
    guitar: {
      voicing: "open-strum",
      rhythm: "x...............",
      sample_set: "electric-clean",
    },
    drums: {
      kit: "rock",
      pattern: {
        kick: "x...............",
        snare: "................",
        hat: "................",
      },
    },
    rationale: "test",
    ...overrides,
  };
}

describe("planEvents", () => {
  it("returns one event per active step across all 4 bars", () => {
    // Single kick + single guitar strum on the downbeat of every bar.
    const arr = makeArrangement();
    const events = planEvents(arr);
    // 4 kicks (1 per bar) + 4 guitars (1 per bar) = 8.
    expect(events).toHaveLength(8);
    expect(events.filter((e) => e.target === "kick")).toHaveLength(4);
    expect(events.filter((e) => e.target === "guitar")).toHaveLength(4);
  });

  it("rotates chord_progression by bar number", () => {
    const arr = makeArrangement({
      // guitar fires once on the downbeat of each bar
      guitar: {
        voicing: "open-strum",
        rhythm: "x...............",
        sample_set: "electric-clean",
      },
    });
    const events = planEvents(arr).filter((e) => e.target === "guitar");
    expect(events).toHaveLength(4);
    // Am @ bar 0: MIDI 57, 60, 64
    expect(events[0].notes).toEqual([57, 60, 64]);
    // F @ bar 1: MIDI 53, 57, 60
    expect(events[1].notes).toEqual([53, 57, 60]);
    // C @ bar 2: MIDI 48, 52, 55
    expect(events[2].notes).toEqual([48, 52, 55]);
    // G @ bar 3: MIDI 55, 59, 62
    expect(events[3].notes).toEqual([55, 59, 62]);
  });

  it("encodes pattern velocities into PlannedEvent.velocity", () => {
    const arr = makeArrangement({
      drums: {
        kit: "rock",
        pattern: { kick: "Xxo.............", snare: "................", hat: "................" },
      },
    });
    const kicks = planEvents(arr).filter((e) => e.target === "kick");
    // first bar: accent + normal + ghost; 4 bars → 12 kicks total
    expect(kicks).toHaveLength(12);
    expect(kicks[0].velocity).toBe(1.0); // X accent
    expect(kicks[1].velocity).toBe(0.7); // x normal
    expect(kicks[2].velocity).toBe(0.3); // o ghost
  });

  it("ignores sustain (`-`) and rest (`.`) steps for drums", () => {
    const arr = makeArrangement({
      drums: {
        kit: "rock",
        pattern: { kick: "x---x---x---x---", snare: "................", hat: "................" },
      },
    });
    const kicks = planEvents(arr).filter((e) => e.target === "kick");
    // Only `x` is a hit; `-` is sustain (no event). 4 hits per bar * 4 bars = 16.
    expect(kicks).toHaveLength(16);
  });

  it("schedules total events across 64 steps", () => {
    const arr = makeArrangement({
      drums: {
        kit: "rock",
        pattern: {
          kick: "x...x...x...x...",
          snare: "....X.......X...",
          hat: "xxxxxxxxxxxxxxxx",
        },
      },
      guitar: {
        voicing: "open-strum",
        rhythm: "x...x...x...x...",
        sample_set: "electric-clean",
      },
    });
    const events = planEvents(arr);
    // Per bar: 4 kicks + 2 snares + 16 hats + 4 guitars = 26. Over 4 bars = 104.
    expect(events).toHaveLength(104);
    // Steps stay within [0, 63]
    expect(Math.max(...events.map((e) => e.step))).toBeLessThan(64);
    expect(Math.min(...events.map((e) => e.step))).toBeGreaterThanOrEqual(0);
  });
});
