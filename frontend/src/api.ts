/**
 * Typed wrappers around the local backend.
 *
 * All responses cross the Zod validators in `audio/validate.ts` so the rest
 * of the app can trust their shape.
 */

import type { Arrangement, Note } from "@shared/types";
import { ArrangementSchema, PitchResultSchema } from "./audio/validate";

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

/** POST /arrange — refine an Arrangement using a free-form intent (Claude call). */
export async function refineArrangement(args: {
  notes: Note[];
  intent: string;
  prior: Arrangement | null;
  bpm_hint?: number | null;
}): Promise<Arrangement> {
  const r = await fetch("/api/arrange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) await readError(r);
  return ArrangementSchema.parse(await r.json());
}
