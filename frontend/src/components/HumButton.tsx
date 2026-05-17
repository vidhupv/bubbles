/**
 * Disc — the central tap-toggle control.
 *
 * Phases:
 *   idle       — "Press to record" prompt
 *   recording  — three pulsing accent rings + "Tap to stop"
 *   processing — rotating arc + animated dots
 *   playing    — song key + BPM, gentle breathing animation
 *   paused     — same content as playing, no animation
 *   denied     — mic-blocked copy
 *
 * Click toggles state (not press-and-hold). Re-recording from a non-idle
 * state is handled by a separate "Hum again" link in the parent.
 */
import type { Arrangement } from "@shared/types";

export type HumButtonState =
  | "idle"
  | "recording"
  | "processing"
  | "playing"
  | "paused"
  | "denied";

interface Props {
  state: HumButtonState;
  arrangement: Arrangement | null;
  size: number;
  onClick(): void;
}

export function HumButton({ state, arrangement, size, onClick }: Props) {
  const hasArr = arrangement !== null;
  const inner = renderInner(state, arrangement, hasArr);

  return (
    <button
      type="button"
      className={`disc disc--${state}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      aria-label={ariaLabel(state)}
    >
      <span className="disc__face" aria-hidden="true" />
      <span className="disc__inner">{inner}</span>
    </button>
  );
}

function renderInner(
  state: HumButtonState,
  arr: Arrangement | null,
  hasArr: boolean,
) {
  if (state === "recording") {
    return (
      <>
        <RecordingRings />
        <div className="disc-stack">
          <div className="disc-eyebrow">Recording</div>
          <div className="disc-cue">Tap to stop</div>
        </div>
      </>
    );
  }
  if (state === "processing") {
    return (
      <>
        <ProcessingArc />
        <div className="disc-stack">
          <div className="disc-eyebrow">Listening</div>
          <ProcessingDots />
        </div>
      </>
    );
  }
  if (state === "denied") {
    return (
      <div className="disc-stack">
        <div className="disc-eyebrow">Mic blocked</div>
        <div className="disc-cue">Tap to retry</div>
      </div>
    );
  }
  if (hasArr && arr) {
    return (
      <div className="disc-stack">
        <div className="disc-key">{formatKey(arr)}</div>
        <div className="disc-bpm">
          {arr.tempo} <span className="disc-bpm__u">BPM</span>
        </div>
        <div className="disc-cue">
          {state === "playing" ? "Tap to pause" : "Tap to play"}
        </div>
      </div>
    );
  }
  return (
    <div className="disc-stack">
      <div className="disc-eyebrow">Press to record</div>
      <div className="disc-cue">Hum any melody</div>
    </div>
  );
}

function RecordingRings() {
  return (
    <span className="rings" aria-hidden="true">
      <span className="ring ring--1" />
      <span className="ring ring--2" />
      <span className="ring ring--3" />
    </span>
  );
}

function ProcessingArc() {
  return (
    <svg className="proc-arc" viewBox="0 0 100 100" aria-hidden="true">
      <circle
        cx="50"
        cy="50"
        r="48"
        stroke="currentColor"
        strokeWidth="0.6"
        fill="none"
        pathLength="100"
        strokeDasharray="22 78"
      />
    </svg>
  );
}

function ProcessingDots() {
  return (
    <span className="proc-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function formatKey(arr: Arrangement): string {
  const tonic = arr.key.tonic.replace(/#/g, "♯").replace(/b/g, "♭");
  return `${tonic} ${arr.key.mode}`;
}

function ariaLabel(state: HumButtonState): string {
  switch (state) {
    case "recording":
      return "Stop recording";
    case "playing":
      return "Pause";
    case "paused":
      return "Play";
    case "processing":
      return "Processing";
    case "denied":
      return "Microphone blocked";
    default:
      return "Start recording";
  }
}
