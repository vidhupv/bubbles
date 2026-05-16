/**
 * Bubbles main app — the full hum-driven AI-bandmate loop.
 *
 * Flow:
 *   1. user presses + holds the big hum button (mic permission requested on
 *      first press)
 *   2. release → audio blob → POST /arrange-from-hum (basic-pitch + Claude)
 *   3. while waiting, the blob shimmers and rationale streams in
 *   4. arrangement renders on Tone.js with the hummed melody as guitar lead
 *   5. refine by speaking (Web Speech) or tapping sadder/heavier/simpler
 *   6. corner "export.wav" link runs an offline render to download a WAV
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Arrangement } from "@shared/types";
import { ApiError, arrangeFromHum, refineArrangement } from "./api";
import { play, type PlaybackHandle } from "./audio/renderer";
import { loadInstruments, unlockAudio, type Instruments } from "./audio/sampler";
import { ExportLink } from "./components/ExportLink";
import { HumButton, type HumButtonState } from "./components/HumButton";
import { MobileFallback } from "./components/MobileFallback";
import { RationaleChat } from "./components/RationaleChat";
import { VibePresets } from "./components/VibePresets";
import { VoiceMic } from "./components/VoiceMic";
import { useHumRecorder } from "./hooks/useHumRecorder";
import { useVoiceCommand } from "./hooks/useVoiceCommand";

const MIN_HUM_MS = 1500;
const TOO_SHORT_MSG = "Hum a bit longer — I need ~3 seconds to work with.";
const IDLE_COPY = "Press and hold. Hum any melody.";
const REC_COPY = "Listening…";
const PROC_COPY = "Bubbles is thinking.";
const DENIED_COPY = "Mic blocked — click to retry.";

type Phase = "idle" | "recording" | "processing" | "playing" | "error" | "denied";

export function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [arrangement, setArrangement] = useState<Arrangement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const recorder = useHumRecorder();
  const voice = useVoiceCommand();
  const lastHumRef = useRef<Blob | null>(null);
  const pressStartRef = useRef<number>(0);
  const instrumentsRef = useRef<Instruments | null>(null);
  const playbackRef = useRef<PlaybackHandle | null>(null);

  // Detect ≤768px once on mount; design review locked desktop-only MVP.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Tear down audio on unmount.
  useEffect(() => {
    return () => {
      playbackRef.current?.stop();
      instrumentsRef.current?.dispose();
    };
  }, []);

  // Mirror recorder permission state into our phase.
  useEffect(() => {
    if (recorder.state === "denied") setPhase("denied");
  }, [recorder.state]);

  const renderArrangement = useCallback(async (arr: Arrangement) => {
    await unlockAudio();
    if (!instrumentsRef.current) {
      instrumentsRef.current = loadInstruments();
    }
    playbackRef.current?.stop();
    playbackRef.current = play(arr, instrumentsRef.current);
  }, []);

  const handlePressDown = useCallback(async () => {
    if (phase === "processing") return;
    setErrorMsg(null);
    pressStartRef.current = Date.now();
    try {
      await recorder.start();
      setPhase("recording");
    } catch {
      // recorder hook handles its own error state; mirror via effect above.
    }
  }, [phase, recorder]);

  const handlePressUp = useCallback(async () => {
    if (phase !== "recording") return;
    const heldMs = Date.now() - pressStartRef.current;
    const blob = await recorder.stop();

    if (!blob || heldMs < MIN_HUM_MS) {
      setPhase("idle");
      setErrorMsg(TOO_SHORT_MSG);
      return;
    }

    lastHumRef.current = blob;
    setPhase("processing");

    try {
      const arr = await arrangeFromHum(blob);
      setArrangement(arr);
      await renderArrangement(arr);
      setPhase("playing");
    } catch (err) {
      setPhase("idle");
      setErrorMsg(humanizeError(err));
    }
  }, [phase, recorder, renderArrangement]);

  const handleRefine = useCallback(
    async (intent: string) => {
      if (!arrangement || !lastHumRef.current) return;
      setErrorMsg(null);
      setPhase("processing");
      try {
        // Re-pitch the last hum so the backend has notes to feed Claude with.
        const form = new FormData();
        form.append("audio", lastHumRef.current, "hum.webm");
        form.append("intent", intent);
        const r = await fetch("/api/arrange-from-hum", {
          method: "POST",
          body: form,
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({ detail: r.statusText }));
          throw new ApiError(r.status, body.detail ?? r.statusText);
        }
        const next = (await r.json()) as Arrangement;
        // We aren't using refineArrangement() here because we need to re-run
        // basic-pitch anyway (server is stateless across calls). Same effect.
        void refineArrangement;
        setArrangement(next);
        await renderArrangement(next);
        setPhase("playing");
      } catch (err) {
        setPhase("playing");
        setErrorMsg(humanizeError(err));
      }
    },
    [arrangement, renderArrangement],
  );

  const handleVoicePressDown = useCallback(() => {
    if (!voice.supported || phase === "processing") return;
    voice.start();
  }, [voice, phase]);

  const handleVoicePressUp = useCallback(async () => {
    if (!voice.supported) return;
    const transcript = await voice.stop();
    if (transcript.trim().length > 0) {
      await handleRefine(transcript);
    }
  }, [voice, handleRefine]);

  if (isMobile) return <MobileFallback />;

  const humState: HumButtonState =
    phase === "denied"
      ? "denied"
      : phase === "recording"
        ? "recording"
        : phase === "processing"
          ? "processing"
          : phase === "playing"
            ? "playing"
            : "idle";

  const copy =
    errorMsg !== null
      ? errorMsg
      : phase === "recording"
        ? REC_COPY
        : phase === "processing"
          ? PROC_COPY
          : phase === "denied"
            ? DENIED_COPY
            : IDLE_COPY;

  const hasArrangement = arrangement !== null;

  return (
    <>
      <div className="brand">bubbles</div>
      <main className={`stage ${hasArrangement ? "has-arrangement" : ""}`}>
        <span />
        <HumButton
          state={humState}
          level={recorder.level}
          onPressDown={handlePressDown}
          onPressUp={handlePressUp}
        />
        <p className={`microcopy ${errorMsg ? "error" : ""}`}>{copy}</p>

        {hasArrangement && (
          <RationaleChat
            key={arrangement!.rationale}
            text={arrangement!.rationale}
          />
        )}

        {hasArrangement && (
          <div
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-6)" }}
          >
            <VibePresets
              disabled={phase === "processing"}
              onPick={handleRefine}
            />
            <VoiceMic
              listening={voice.listening}
              supported={voice.supported}
              disabled={phase === "processing"}
              onPressDown={handleVoicePressDown}
              onPressUp={handleVoicePressUp}
            />
            {voice.listening && (
              <span className="microcopy" style={{ fontSize: "0.9rem" }}>
                {voice.transcript || "Listening for your refinement…"}
              </span>
            )}
          </div>
        )}
      </main>
      <ExportLink arrangement={arrangement} />
    </>
  );
}

function humanizeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 422) return "I couldn't pick up a clear melody — try humming a steady pitch.";
    if (err.status === 413) return "That hum was too long — try under 30 seconds.";
    return err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}
