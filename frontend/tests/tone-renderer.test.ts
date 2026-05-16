/**
 * Tests the pure `planEvents()` transform: arrangement → ordered events.
 *
 * Three layers, each opt-in except melody. These tests cover the layer
 * gating, melody preservation, and event timing.
 */
import { describe, expect, it } from "vitest";
import type { Arrangement } from "@shared/types";
import { planEvents } from "../src/audio/renderer";
import { FULL_ARRANGEMENT, MELODY_ONLY_ARRANGEMENT } from "../src/audio/fixtures";

describe("planEvents — melody only", () => {
  it("emits one guitar event per hummed note and nothing else", () => {
    const { events } = planEvents(MELODY_ONLY_ARRANGEMENT);
    expect(events).toHaveLength(MELODY_ONLY_ARRANGEMENT.melody.length);
    expect(events.every((e) => e.target === "guitar")).toBe(true);
  });

  it("preserves the hum's MIDI numbers verbatim", () => {
    const { events } = planEvents(MELODY_ONLY_ARRANGEMENT);
    const fired = events.map((e) => e.notes[0]);
    expect(fired).toEqual(MELODY_ONLY_ARRANGEMENT.melody.map((n) => n.midi));
  });

  it("preserves the hum's onset times", () => {
    const { events } = planEvents(MELODY_ONLY_ARRANGEMENT);
    const times = events.map((e) => e.time);
    expect(times).toEqual(MELODY_ONLY_ARRANGEMENT.melody.map((n) => n.start));
  });

  it("reports loop length derived from tempo", () => {
    const { loopSeconds } = planEvents(MELODY_ONLY_ARRANGEMENT);
    // 4 bars × 16 steps × (60/96/4)s per step = 10.0s
    expect(loopSeconds).toBeCloseTo(10.0, 1);
  });
});

describe("planEvents — chords opt-in", () => {
  it("adds one chord-pad event per bar when chord_progression is non-empty", () => {
    const { events } = planEvents(FULL_ARRANGEMENT);
    const padEvents = events.filter((e) => e.target === "chord-pad");
    expect(padEvents).toHaveLength(4);
  });

  it("rotates chord_progression by bar", () => {
    const { events } = planEvents(FULL_ARRANGEMENT);
    const pads = events.filter((e) => e.target === "chord-pad");
    // Am F C G in MIDI: 57/60/64, 53/57/60, 48/52/55, 55/59/62
    expect(pads[0].notes).toEqual([57, 60, 64]);
    expect(pads[1].notes).toEqual([53, 57, 60]);
    expect(pads[2].notes).toEqual([48, 52, 55]);
    expect(pads[3].notes).toEqual([55, 59, 62]);
  });

  it("does NOT emit chord pads when chord_progression is empty", () => {
    const { events } = planEvents(MELODY_ONLY_ARRANGEMENT);
    expect(events.some((e) => e.target === "chord-pad")).toBe(false);
  });
});

describe("planEvents — drums opt-in", () => {
  it("emits drum events when drums layer is present", () => {
    const { events } = planEvents(FULL_ARRANGEMENT);
    expect(events.some((e) => e.target === "kick")).toBe(true);
    expect(events.some((e) => e.target === "snare")).toBe(true);
    expect(events.some((e) => e.target === "hat")).toBe(true);
  });

  it("does NOT emit any drum events when drums is null", () => {
    const { events } = planEvents(MELODY_ONLY_ARRANGEMENT);
    for (const drumTarget of ["kick", "snare", "hat"] as const) {
      expect(events.some((e) => e.target === drumTarget)).toBe(false);
    }
  });
});

describe("planEvents — different inputs produce different outputs", () => {
  // Regression for the "two different hums → same arrangement" bug. The
  // melody pipes through verbatim, so distinct hums MUST distinct events.
  it("two hums with different MIDI numbers produce different events", () => {
    const a: Arrangement = {
      ...MELODY_ONLY_ARRANGEMENT,
      melody: [{ midi: 60, start: 0, end: 0.5, velocity: 0.7 }],
    };
    const b: Arrangement = {
      ...MELODY_ONLY_ARRANGEMENT,
      melody: [{ midi: 72, start: 0, end: 0.5, velocity: 0.7 }],
    };
    expect(planEvents(a).events[0].notes).not.toEqual(
      planEvents(b).events[0].notes,
    );
  });
});
