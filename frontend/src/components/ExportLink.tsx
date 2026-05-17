/**
 * Export pill — lives in the top-right corner.
 *
 * States: idle → doing (spinner + "Rendering") → done (check + "Exported")
 * Returns to idle ~2.3s after rendering finishes.
 */
import { useState } from "react";
import * as Tone from "tone";
import type { Arrangement } from "@shared/types";
import { renderToWav } from "../audio/export";
import { Icon } from "./Icon";

type Phase = "idle" | "doing" | "done";

interface Props {
  arrangement: Arrangement | null;
}

export function ExportLink({ arrangement }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");

  if (!arrangement) return null;

  async function handleClick() {
    if (!arrangement || phase !== "idle") return;
    setPhase("doing");
    try {
      if (Tone.getContext().state !== "running") {
        await Tone.start();
      }
      const blob = await renderToWav(arrangement);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const name = `hummingbird-${arrangement.key.tonic}-${arrangement.tempo}bpm-${Date.now()}.wav`;
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPhase("done");
      window.setTimeout(() => setPhase("idle"), 2300);
    } catch {
      setPhase("idle");
    }
  }

  return (
    <button
      type="button"
      className={`export export--${phase}`}
      onClick={handleClick}
      disabled={phase !== "idle"}
      aria-label="Export the current arrangement as a WAV file"
    >
      {phase === "done" ? (
        <>
          <Icon name="check" size={16} /> Exported
        </>
      ) : phase === "doing" ? (
        <>
          <span className="spinner" /> Rendering
        </>
      ) : (
        <>
          <Icon name="download" size={16} /> Export
        </>
      )}
    </button>
  );
}
