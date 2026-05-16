/**
 * Runtime validation for network responses.
 *
 * Any JSON crossing the wire goes through these Zod schemas before downstream
 * code sees it. Compile-time types in `@shared/types` are intent; these are
 * truth.
 */

import { z } from "zod";

// --- Pitch result ------------------------------------------------------------

export const NoteSchema = z.object({
  midi: z.number().int().min(0).max(127),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  velocity: z.number().min(0).max(1),
});

export const PitchResultSchema = z.object({
  notes: z.array(NoteSchema),
  bpm: z.number().positive(),
  key_estimate: z.string(),
  duration: z.number().nonnegative(),
});

// --- Arrangement ------------------------------------------------------------

export const ModeSchema = z.enum(["major", "minor", "dorian", "mixolydian"]);
export const GuitarVoicingSchema = z.enum([
  "open-strum",
  "power",
  "fingerpick",
  "muted-chuck",
]);
export const DrumKitSchema = z.enum(["rock", "lofi"]);
export const SampleSetSchema = z.enum(["acoustic", "electric-clean", "electric-dirty"]);

export const KeySchema = z.object({
  tonic: z.string().min(1),
  mode: ModeSchema,
});

const PatternStringSchema = z
  .string()
  .length(16, "Drum/guitar pattern must be exactly 16 steps.");

export const GuitarSchema = z.object({
  voicing: GuitarVoicingSchema,
  rhythm: PatternStringSchema,
  sample_set: SampleSetSchema,
});

export const DrumPatternSchema = z.object({
  kick: PatternStringSchema,
  snare: PatternStringSchema,
  hat: PatternStringSchema,
});

export const DrumsSchema = z.object({
  kit: DrumKitSchema,
  pattern: DrumPatternSchema,
});

// chord_progression must be empty OR exactly 4 entries
const ChordProgressionSchema = z
  .array(z.string())
  .refine((arr) => arr.length === 0 || arr.length === 4, {
    message: "chord_progression must be empty or exactly 4 chords.",
  });

export const ArrangementSchema = z.object({
  tempo: z.number().int().min(60).max(180),
  key: KeySchema,
  melody: z.array(NoteSchema),
  chord_progression: ChordProgressionSchema,
  guitar: GuitarSchema.nullable(),
  drums: DrumsSchema.nullable(),
  rationale: z.string().min(1),
});

export type ValidatedArrangement = z.infer<typeof ArrangementSchema>;
export type ValidatedPitchResult = z.infer<typeof PitchResultSchema>;
