/**
 * Chord symbol → MIDI note numbers.
 *
 * Bubbles supports the standard Western chord vocabulary that Claude is most
 * likely to emit (major, minor, 7, m7, sus, dim, aug). Voicing is intentionally
 * simple: root in octave 3, third + fifth in octave 4. The guitar Sampler
 * interpolates from the loaded note set.
 */

const PITCH_CLASS: Record<string, number> = {
  C: 0, "C#": 1, Db: 1,
  D: 2, "D#": 3, Eb: 3,
  E: 4,
  F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8,
  A: 9, "A#": 10, Bb: 10,
  B: 11,
};

interface ChordQuality {
  intervals: number[];
}

const QUALITIES: Record<string, ChordQuality> = {
  "": { intervals: [0, 4, 7] }, // major triad
  m: { intervals: [0, 3, 7] }, // minor triad
  7: { intervals: [0, 4, 7, 10] },
  m7: { intervals: [0, 3, 7, 10] },
  maj7: { intervals: [0, 4, 7, 11] },
  sus2: { intervals: [0, 2, 7] },
  sus4: { intervals: [0, 5, 7] },
  dim: { intervals: [0, 3, 6] },
  aug: { intervals: [0, 4, 8] },
};

const SYMBOL_RE = /^([A-G][#b]?)(.*)$/;

export class ChordParseError extends Error {}

/**
 * Parse a chord symbol like "Am", "G7", "F#m7" into MIDI note numbers.
 * Root note is in octave 3 (MIDI 48-59); upper notes inherit naturally.
 */
export function chordToMidi(symbol: string): number[] {
  const match = SYMBOL_RE.exec(symbol);
  if (!match) {
    throw new ChordParseError(`Unrecognized chord symbol: ${symbol}`);
  }
  const [, root, qualityStr] = match;
  const rootPc = PITCH_CLASS[root];
  if (rootPc === undefined) {
    throw new ChordParseError(`Unknown root note: ${root}`);
  }
  const quality = QUALITIES[qualityStr] ?? QUALITIES[""];
  const rootMidi = 48 + rootPc; // C3 = 48
  return quality.intervals.map((iv) => rootMidi + iv);
}

/** Convert a MIDI note number to a Tone.js-friendly note string (e.g. 60 → "C4"). */
export function midiToNoteName(midi: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  return `${names[midi % 12]}${octave}`;
}
