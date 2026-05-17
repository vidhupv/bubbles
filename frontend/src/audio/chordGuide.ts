import type { Arrangement, Note } from "@shared/types";

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
};

const DEGREE_QUALITIES = {
  major: ["", "m", "m", "", "", "m", "dim"],
  minor: ["m", "dim", "", "m", "m", "", ""],
} as const;

const DEGREE_OFFSETS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
} as const;

const DEGREE_WEIGHTS = {
  major: [5, 1, 2, 4, 4, 3, 0],
  minor: [5, 0, 3, 4, 4, 3, 2],
} as const;

export function buildArrangementFromChordGuide(
  arrangement: Arrangement,
  guideNotes: Note[],
  guideKeyEstimate: string,
): Arrangement {
  const tonic = normalizePitchClass(guideKeyEstimate.split(/\s+/)[0] || arrangement.key.tonic);
  const mode = arrangement.key.mode === "major" ? "major" : "minor";
  const progression = chooseProgression(tonic, mode, guideNotes);

  return {
    ...arrangement,
    key: { ...arrangement.key, tonic },
    chord_progression: progression,
    guitar: {
      voicing: "fingerpick",
      rhythm: "x...x...x...x...",
      sample_set: "acoustic",
    },
    rationale:
      "Added chords from your hummed harmony guide. Refine further with the voice mic or rehumm the guide if it needs a different shape.",
  };
}

function chooseProgression(
  tonic: string,
  mode: "major" | "minor",
  notes: Note[],
): string[] {
  const palette = buildPalette(tonic, mode);
  const totalDuration = Math.max(...notes.map((note) => note.end), 0.01);
  const barDuration = totalDuration / 4;

  return Array.from({ length: 4 }, (_, index) => {
    const start = index * barDuration;
    const end = index === 3 ? totalDuration + 0.001 : (index + 1) * barDuration;
    const slice = notes.filter((note) => note.end > start && note.start < end);
    return pickBestChord(palette, slice, mode);
  });
}

function buildPalette(tonic: string, mode: "major" | "minor") {
  const tonicPc = pitchClassIndex(tonic);
  return DEGREE_OFFSETS[mode].map((offset, index) => {
    const rootPc = (tonicPc + offset) % 12;
    const root = SHARP_NAMES[rootPc];
    const quality = DEGREE_QUALITIES[mode][index];
    const triad = triadPitchClasses(rootPc, quality);
    return {
      symbol: `${root}${quality}`,
      triad,
      weight: DEGREE_WEIGHTS[mode][index],
    };
  });
}

function pickBestChord(
  palette: Array<{ symbol: string; triad: number[]; weight: number }>,
  notes: Note[],
  mode: "major" | "minor",
): string {
  if (notes.length === 0) {
    return mode === "major" ? palette[0].symbol : palette[0].symbol;
  }

  let best = palette[0];
  let bestScore = -1;

  for (const chord of palette) {
    const coverage = notes.reduce((score, note) => {
      const pc = note.midi % 12;
      return score + (chord.triad.includes(pc) ? 2 : 0);
    }, 0);
    const score = coverage + chord.weight;
    if (score > bestScore) {
      best = chord;
      bestScore = score;
    }
  }

  return best.symbol;
}

function triadPitchClasses(rootPc: number, quality: string): number[] {
  const third = quality.startsWith("m") || quality === "dim" ? 3 : 4;
  const fifth = quality === "dim" ? 6 : 7;
  return [rootPc, (rootPc + third) % 12, (rootPc + fifth) % 12];
}

function normalizePitchClass(name: string): string {
  const normalized = FLAT_TO_SHARP[name] ?? name;
  return SHARP_NAMES.includes(normalized) ? normalized : "C";
}

function pitchClassIndex(name: string): number {
  return SHARP_NAMES.indexOf(normalizePitchClass(name));
}
