/**
 * The big pulsing-blob hum button — the hero element.
 *
 * Four motion states (locked in /plan-design-review):
 *   idle       slow breathe (3s loop)
 *   recording  tight pulse driven by live mic level
 *   processing irregular shimmer while basic-pitch + Claude run
 *   playing    beat-synced pulse driven by Tone.Transport
 *
 * Microcopy below the button switches contextually. Press-and-hold to record;
 * release to send. Min duration is enforced by the parent.
 */
import { useEffect, useState } from "react";
import * as Tone from "tone";

export type HumButtonState =
  | "idle"
  | "recording"
  | "processing"
  | "playing"
  | "denied";

interface Props {
  state: HumButtonState;
  level: number;
  onPressDown(): void;
  onPressUp(): void;
}

const SIZE_PX = 360;

export function HumButton({ state, level, onPressDown, onPressUp }: Props) {
  const [beatPulse, setBeatPulse] = useState(0);

  // Drive the playing-state pulse off Tone.Transport, so the blob moves with
  // the actual song instead of a free-running animation.
  useEffect(() => {
    if (state !== "playing") return;
    let mounted = true;
    const id = Tone.Transport.scheduleRepeat((time) => {
      Tone.Draw.schedule(() => {
        if (mounted) setBeatPulse((n) => n + 1);
      }, time);
    }, "4n");
    return () => {
      mounted = false;
      Tone.Transport.clear(id);
    };
  }, [state]);

  const scale = computeScale(state, level, beatPulse);
  const ringOpacity = computeRingOpacity(state);
  const showX = state === "denied";

  return (
    <button
      type="button"
      className="hum-button"
      aria-label="Press and hold to hum"
      onPointerDown={(e) => {
        e.preventDefault();
        onPressDown();
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        onPressUp();
      }}
      onPointerCancel={(e) => {
        e.preventDefault();
        onPressUp();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span
        className={`blob blob--${state}`}
        style={{
          width: SIZE_PX,
          height: SIZE_PX,
          transform: `scale(${scale.toFixed(3)})`,
          opacity: ringOpacity,
        }}
      >
        {showX && (
          <svg
            className="blob-x"
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            <line x1="32" y1="32" x2="68" y2="68" />
            <line x1="68" y1="32" x2="32" y2="68" />
          </svg>
        )}
      </span>
    </button>
  );
}

function computeScale(
  state: HumButtonState,
  level: number,
  beat: number,
): number {
  switch (state) {
    case "idle":
      // Driven by CSS keyframes; transform here stays neutral.
      return 1;
    case "recording":
      // 0..1 mic level mapped to 1.0..1.18
      return 1 + Math.min(level, 1) * 0.18;
    case "processing":
      // Cheap pseudo-random shimmer derived from time so different mounts diverge
      return 1 + 0.06 * Math.sin(beat * 1.7 + Date.now() / 220);
    case "playing":
      // Beat-driven thump. `beat` increments once per quarter.
      return 1 + 0.07 * ((beat % 2) === 0 ? 1 : 0.4);
    case "denied":
      return 0.92;
  }
}

function computeRingOpacity(state: HumButtonState): number {
  switch (state) {
    case "idle":
      return 0.45;
    case "recording":
      return 0.85;
    case "processing":
      return 0.7;
    case "playing":
      return 0.65;
    case "denied":
      return 0.35;
  }
}
