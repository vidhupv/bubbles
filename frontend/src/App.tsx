/**
 * Day 1 skeleton — just enough to verify the backend wiring.
 *
 * Real UI per design doc: pulsing-blob hum button, Fraunces display + JetBrains
 * Mono rationale, warm dark theme. That work lands on Day 11 (UI polish).
 */
import { useState } from "react";
import type { PitchResult } from "@shared/types";

export function App() {
  const [result, setResult] = useState<PitchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append("audio", file);
      const r = await fetch("/api/pitch", { method: "POST", body: form });
      if (!r.ok) {
        const body = await r.json().catch(() => ({ detail: r.statusText }));
        throw new Error(body.detail ?? `HTTP ${r.status}`);
      }
      setResult((await r.json()) as PitchResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="day1">
      <h1>bubbles</h1>
      <p className="subtitle">Day 1 — backend wiring smoke test.</p>
      <p className="note">
        Upload a hum (WAV / WebM / MP4). The backend runs basic-pitch and returns
        MIDI notes. The real UI ships on Day 11.
      </p>

      <input type="file" accept="audio/*" onChange={handleFile} disabled={loading} />

      {loading && <p>Bubbles is listening…</p>}
      {error && <p className="error">Error: {error}</p>}
      {result && (
        <section className="result">
          <h2>{result.key_estimate}</h2>
          <p>
            {result.notes.length} notes · {result.bpm} BPM · {result.duration.toFixed(2)}s
          </p>
          <ul>
            {result.notes.slice(0, 12).map((n, i) => (
              <li key={i}>
                MIDI {n.midi} · {n.start.toFixed(2)}s → {n.end.toFixed(2)}s
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
