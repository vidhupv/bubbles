/**
 * Typed wrappers around the local backend.
 *
 * All responses cross the Zod validators in `audio/validate.ts` so the rest
 * of the app can trust their shape.
 */

import type { Arrangement, Drums, Guitar, Note } from "@shared/types";
import {
  ArrangementSchema,
  DrumsSchema,
  GuitarSchema,
  PitchResultSchema,
} from "./audio/validate";
import { z } from "zod";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function readError(r: Response): Promise<never> {
  let detail = r.statusText;
  try {
    const body = await r.json();
    if (typeof body?.detail === "string") detail = body.detail;
  } catch {
    /* response wasn't JSON */
  }
  throw new ApiError(r.status, detail);
}

/** POST /pitch — upload a hum, get MIDI back. */
export async function detectPitch(audio: Blob) {
  const form = new FormData();
  form.append("audio", audio, "hum.webm");
  const r = await fetch("/api/pitch", { method: "POST", body: form });
  if (!r.ok) await readError(r);
  return PitchResultSchema.parse(await r.json());
}

/** POST /arrange-from-hum — pitch + melody-only Arrangement in one round-trip. */
export async function arrangeFromHum(audio: Blob): Promise<Arrangement> {
  const form = new FormData();
  form.append("audio", audio, "hum.webm");
  const r = await fetch("/api/arrange-from-hum", { method: "POST", body: form });
  if (!r.ok) await readError(r);
  return ArrangementSchema.parse(await r.json());
}

const DrumsFromHumResponseSchema = z.object({
  drums: DrumsSchema,
  tempo: z.number().positive(),
});

/** POST /drums-from-hum — beatbox into the mic, get a drum pattern. */
export async function drumsFromHum(
  audio: Blob,
): Promise<{ drums: Drums; tempo: number }> {
  const form = new FormData();
  form.append("audio", audio, "drums.webm");
  const r = await fetch("/api/drums-from-hum", { method: "POST", body: form });
  if (!r.ok) await readError(r);
  return DrumsFromHumResponseSchema.parse(await r.json());
}

/** POST /arrange — refine an Arrangement using a free-form intent (Claude call). */
export async function refineArrangement(args: {
  notes: Note[];
  intent: string;
  prior: Arrangement | null;
  bpm_hint?: number | null;
  key_hint?: string | null;
}): Promise<Arrangement> {
  const r = await fetch("/api/arrange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) await readError(r);
  return ArrangementSchema.parse(await r.json());
}

const ChordsFromHumResponseSchema = z.object({
  chord_progression: z.array(z.string()).length(4),
  guitar: GuitarSchema,
});

/** POST /chords-from-hum — hum 4 chord roots → chord progression. */
export async function chordsFromHum(
  audio: Blob,
  tonic: string,
  mode: string,
): Promise<{ chord_progression: string[]; guitar: Guitar }> {
  const form = new FormData();
  form.append("audio", audio, "chords.webm");
  form.append("tonic", tonic);
  form.append("mode", mode);
  const r = await fetch("/api/chords-from-hum", { method: "POST", body: form });
  if (!r.ok) await readError(r);
  return ChordsFromHumResponseSchema.parse(await r.json());
}

// --- Library ---

const LibraryEntrySchema = z.object({
  id: z.string(),
  saved_at: z.number(),
  title: z.string(),
  arrangement: ArrangementSchema,
});

export type LibraryEntry = z.infer<typeof LibraryEntrySchema>;

export async function saveToLibrary(
  arrangement: Arrangement,
  title?: string,
): Promise<LibraryEntry> {
  const r = await fetch("/api/library", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ arrangement, title: title ?? null }),
  });
  if (!r.ok) await readError(r);
  return LibraryEntrySchema.parse(await r.json());
}

export async function listLibrary(): Promise<LibraryEntry[]> {
  const r = await fetch("/api/library");
  if (!r.ok) await readError(r);
  const body = (await r.json()) as { items: unknown[] };
  return z.array(LibraryEntrySchema).parse(body.items);
}

export async function deleteLibrary(id: string): Promise<void> {
  const r = await fetch(`/api/library/${id}`, { method: "DELETE" });
  if (!r.ok) await readError(r);
}
