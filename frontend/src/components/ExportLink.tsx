/**
 * Bottom-right corner "export.wav" text link.
 *
 * Only renders when an arrangement exists. Click triggers Tone.Offline render
 * → AudioBuffer → WAV blob → browser download. The render runs at 44.1 kHz
 * stereo for 60 seconds (two 4-bar loops back-to-back) with a 200 ms fade.
 */
import { useState } from "react";
import * as Tone from "tone";
import type { Arrangement } from "@shared/types";
import { renderToWav } from "../audio/export";

interface Props {
  arrangement: Arrangement | null;
}

export function ExportLink({ arrangement }: Props) {
  const [busy, setBusy] = useState(false);

  if (!arrangement) return null;

  async function handleClick() {
    if (!arrangement || busy) return;
    setBusy(true);
    try {
      // Ensure the AudioContext is unlocked — required even for offline render
      // to ensure timestamping math is consistent.
      if (Tone.getContext().state !== "running") {
        await Tone.start();
      }
      const blob = await renderToWav(arrangement);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const name = `bubbles-${arrangement.key.tonic}-${arrangement.tempo}bpm-${Date.now()}.wav`;
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="export-link"
      onClick={handleClick}
      disabled={busy}
      aria-label="Export the current arrangement as a WAV file"
    >
      {busy ? "rendering…" : "export.wav"}
    </button>
  );
}
