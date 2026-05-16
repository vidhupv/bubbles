import { describe, expect, it } from "vitest";
import { chordToMidi, ChordParseError, midiToNoteName } from "../src/audio/chord";

describe("chordToMidi", () => {
  it("parses a major triad (C → C3 E3 G3)", () => {
    expect(chordToMidi("C")).toEqual([48, 52, 55]);
  });

  it("parses a minor triad (Am → A3 C4 E4)", () => {
    expect(chordToMidi("Am")).toEqual([57, 60, 64]);
  });

  it("parses 7ths (G7)", () => {
    expect(chordToMidi("G7")).toEqual([55, 59, 62, 65]);
  });

  it("parses m7 (Dm7 → D3 F3 A3 C4)", () => {
    expect(chordToMidi("Dm7")).toEqual([50, 53, 57, 60]);
  });

  it("handles flats (Bb → B♭3 D4 F4)", () => {
    expect(chordToMidi("Bb")).toEqual([58, 62, 65]);
  });

  it("handles sharps (F#m)", () => {
    expect(chordToMidi("F#m")).toEqual([54, 57, 61]);
  });

  it("throws on garbage input", () => {
    expect(() => chordToMidi("zzz")).toThrow(ChordParseError);
  });
});

describe("midiToNoteName", () => {
  it("converts MIDI 60 to C4", () => {
    expect(midiToNoteName(60)).toBe("C4");
  });
  it("converts MIDI 69 to A4", () => {
    expect(midiToNoteName(69)).toBe("A4");
  });
  it("uses sharps for black keys", () => {
    expect(midiToNoteName(61)).toBe("C#4");
  });
});
