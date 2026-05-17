import type { Arrangement, Note } from "@shared/types";

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
};
const CHORD_RE = /^([A-G][#b]?)(.*)$/;

export function transposeArrangement(
  arrangement: Arrangement,
  semitones: number,
): Arrangement {
  if (semitones === 0) return arrangement;

  return {
    ...arrangement,
    melody: arrangement.melody.map((note) => transposeNote(note, semitones)),
    key: {
      ...arrangement.key,
      tonic: transposePitchClass(arrangement.key.tonic, semitones),
    },
    chord_progression: arrangement.chord_progression.map((chord) =>
      transposeChordSymbol(chord, semitones),
    ),
    rationale: buildEditRationale(arrangement.rationale, `Transposed ${semitones > 0 ? "up" : "down"} ${Math.abs(semitones)} semitone${Math.abs(semitones) === 1 ? "" : "s"}.`),
  };
}

export function nudgeTempo(arrangement: Arrangement, delta: number): Arrangement {
  const tempo = clamp(arrangement.tempo + delta, 60, 180);
  if (tempo === arrangement.tempo) return arrangement;

  return {
    ...arrangement,
    tempo,
    rationale: buildEditRationale(
      arrangement.rationale,
      `Tempo nudged to ${tempo} BPM.`,
    ),
  };
}

function transposeNote(note: Note, semitones: number): Note {
  return {
    ...note,
    midi: clamp(note.midi + semitones, 0, 127),
  };
}

function transposeChordSymbol(symbol: string, semitones: number): string {
  const match = CHORD_RE.exec(symbol);
  if (!match) return symbol;
  const [, root, quality] = match;
  return `${transposePitchClass(root, semitones)}${quality}`;
}

function transposePitchClass(name: string, semitones: number): string {
  const normalized = FLAT_TO_SHARP[name] ?? name;
  const index = SHARP_NAMES.indexOf(normalized);
  if (index === -1) return name;
  return SHARP_NAMES[mod(index + semitones, 12)];
}

function buildEditRationale(current: string, suffix: string): string {
  return current.includes(suffix) ? current : `${current} ${suffix}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mod(value: number, base: number): number {
  return ((value % base) + base) % base;
}
