/**
 * Day 2 skeleton — backend wiring + hardcoded Tone.js playback.
 *
 * Real UI per design doc: pulsing-blob hum button, Fraunces display +
 * JetBrains Mono rationale, warm dark theme. That work lands Day 11.
 */
import { useEffect, useRef, useState } from "react";
import type { PitchResult } from "@shared/types";
import { TEST_ARRANGEMENT } from "./audio/fixtures";
import { play, type PlaybackHandle } from "./audio/renderer";
import { loadInstruments, unlockAudio, type Instruments } from "./audio/sampler";

export function App() {
  const [result, setResult] = useState<PitchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  const instrumentsRef = useRef<Instruments | null>(null);
  const playbackRef = useRef<PlaybackHandle | null>(null);

  useEffect(() => {
    return () => {
      playbackRef.current?.stop();
      instrumentsRef.current?.dispose();
    };
  }, []);

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

  async function handlePlay() {
    if (playing) {
      playbackRef.current?.stop();
      playbackRef.current = null;
      setPlaying(false);
      return;
    }
    await unlockAudio();
    if (!instrumentsRef.current) {
      instrumentsRef.current = loadInstruments();
    }
    playbackRef.current = play(TEST_ARRANGEMENT, instrumentsRef.current);
    setPlaying(true);
  }

  return (
    <main className="day1">
      <h1>bubbles</h1>
      <p className="subtitle">Day 2 — Tone.js playback smoke test.</p>
      <p className="note">
        Press play to hear the hardcoded i-VI-III-VII test arrangement on
        placeholder synths. Real samples land Day 10; real UI lands Day 11.
      </p>

      <button onClick={handlePlay} className="play">
        {playing ? "■ stop" : "▶ play test arrangement"}
      </button>

      <hr style={{ borderColor: "rgba(244,240,234,0.1)", margin: "2rem 0" }} />

      <h3 style={{ marginBottom: "0.5rem" }}>Backend wiring check</h3>
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
