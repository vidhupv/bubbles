/**
 * Runtime validation for network responses.
 *
 * TypeScript types in `@shared/types` are compile-time only — they can't catch
 * Claude returning a malformed Arrangement. Zod is the source of truth at
 * runtime; any JSON crossing the wire goes through these schemas.
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

export const ArrangementSchema = z.object({
  tempo: z.number().int().min(60).max(180),
  key: KeySchema,
  chord_progression: z.array(z.string()).length(4, "Need exactly 4 chord symbols."),
  guitar: GuitarSchema,
  drums: DrumsSchema,
  rationale: z.string().min(1),
});

export type ValidatedArrangement = z.infer<typeof ArrangementSchema>;
export type ValidatedPitchResult = z.infer<typeof PitchResultSchema>;
