import { describe, expect, it } from "vitest";
import { parsePattern, PatternParseError } from "../src/audio/pattern";

describe("parsePattern", () => {
  it("parses a typical kick pattern", () => {
    const steps = parsePattern("x...x...x...x...");
    expect(steps).toHaveLength(16);
    expect(steps[0]).toEqual({ kind: "hit", velocity: 0.7 });
    expect(steps[1]).toEqual({ kind: "rest" });
    expect(steps[4]).toEqual({ kind: "hit", velocity: 0.7 });
  });

  it("distinguishes accent / hit / ghost velocities", () => {
    const steps = parsePattern("Xxo.............");
    expect(steps[0]).toEqual({ kind: "hit", velocity: 1.0 });
    expect(steps[1]).toEqual({ kind: "hit", velocity: 0.7 });
    expect(steps[2]).toEqual({ kind: "hit", velocity: 0.3 });
    expect(steps[3]).toEqual({ kind: "rest" });
  });

  it("treats `-` as a sustain marker", () => {
    const steps = parsePattern("x---x---x---x---");
    expect(steps[0]).toEqual({ kind: "hit", velocity: 0.7 });
    expect(steps[1]).toEqual({ kind: "sustain" });
    expect(steps[2]).toEqual({ kind: "sustain" });
    expect(steps[3]).toEqual({ kind: "sustain" });
  });

  it("rejects wrong-length patterns", () => {
    expect(() => parsePattern("x.x.x.x.")).toThrow(PatternParseError);
    expect(() => parsePattern("x.x.x.x.x.x.x.x.x")).toThrow(PatternParseError);
  });

  it("rejects unknown characters with the offending index", () => {
    expect(() => parsePattern("x.x.x.x.q.x.x.x.")).toThrow(/step 8/);
  });
});
