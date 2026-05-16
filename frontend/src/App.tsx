/**
 * Bubbles main app.
 *
 * Flow:
 *   1. Press + hold blob → hum → release.
 *   2. Backend pitch-detects and returns a melody-only Arrangement.
 *   3. Frontend plays the hum back on a Karplus-Strong pluck (placeholder
 *      for real guitar samples).
 *   4. Layers panel lets you + chords / + drums / regenerate / remove.
 *   5. Voice mic + vibe presets refine whatever exists.
 *   6. Stop button halts playback; replay restarts.
 *   7. Bottom-right export.wav downloads a 60s WAV.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Arrangement } from "@shared/types";
import { ApiError, arrangeFromHum, refineArrangement } from "./api";
import { play, type PlaybackHandle } from "./audio/renderer";
import { loadInstruments, unlockAudio, type Instruments } from "./audio/sampler";
import { ExportLink } from "./components/ExportLink";
import { HumButton, type HumButtonState } from "./components/HumButton";
import { Layers } from "./components/Layers";
import { MobileFallback } from "./components/MobileFallback";
import { NotesDebug } from "./components/NotesDebug";
import { PlaybackControls } from "./components/PlaybackControls";
import { RationaleChat } from "./components/RationaleChat";
import { VibePresets } from "./components/VibePresets";
import { VoiceMic } from "./components/VoiceMic";
import { useHumRecorder } from "./hooks/useHumRecorder";
import { useVoiceCommand } from "./hooks/useVoiceCommand";

const MIN_HUM_MS = 1500;
const TOO_SHORT_MSG = "Hum a bit longer — at least 1.5 seconds.";
const IDLE_COPY = "Press and hold. Hum any melody.";
const REC_COPY = "Listening…";
const PROC_COPY_INITIAL = "Hearing your hum.";
const PROC_COPY_REFINE = "Bubbles is thinking.";
const DENIED_COPY = "Mic blocked — click to retry.";
const STOPPED_COPY = "Stopped. Replay or hum again.";

type Phase =
  | "idle"
  | "recording"
  | "processing-initial"
  | "processing-refine"
  | "playing"
  | "stopped"
  | "denied";

export function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [arrangement, setArrangement] = useState<Arrangement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const recorder = useHumRecorder();
  const voice = useVoiceCommand();
  const instrumentsRef = useRef<Instruments | null>(null);
  const playbackRef = useRef<PlaybackHandle | null>(null);
  const pressStartRef = useRef<number>(0);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    return () => {
      playbackRef.current?.stop();
      instrumentsRef.current?.dispose();
    };
  }, []);

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

  const stopPlayback = useCallback(() => {
    playbackRef.current?.stop();
    playbackRef.current = null;
    setPhase("stopped");
  }, []);

  const replay = useCallback(async () => {
    if (!arrangement) return;
    await renderArrangement(arrangement);
    setPhase("playing");
  }, [arrangement, renderArrangement]);

  const handlePressDown = useCallback(async () => {
    if (phase === "processing-initial" || phase === "processing-refine") return;
    setErrorMsg(null);
    // Implicit stop — pressing the blob always starts fresh.
    if (playbackRef.current) {
      playbackRef.current.stop();
      playbackRef.current = null;
    }
    pressStartRef.current = Date.now();
    try {
      await recorder.start();
      setPhase("recording");
    } catch {
      /* state mirrored via effect */
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

    setPhase("processing-initial");
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

  const refine = useCallback(
    async (intent: string) => {
      if (!arrangement) return;
      setErrorMsg(null);
      setPhase("processing-refine");
      try {
        const next = await refineArrangement({
          notes: arrangement.melody,
          intent,
          prior: arrangement,
          bpm_hint: arrangement.tempo,
        });
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

  // Client-side layer removal — no Claude call needed.
  const removeChords = useCallback(async () => {
    if (!arrangement) return;
    const next: Arrangement = {
      ...arrangement,
      chord_progression: [],
      guitar: null,
    };
    setArrangement(next);
    await renderArrangement(next);
    setPhase("playing");
  }, [arrangement, renderArrangement]);

  const removeDrums = useCallback(async () => {
    if (!arrangement) return;
    const next: Arrangement = { ...arrangement, drums: null };
    setArrangement(next);
    await renderArrangement(next);
    setPhase("playing");
  }, [arrangement, renderArrangement]);

  const handleVoicePressDown = useCallback(() => {
    if (!voice.supported || phase.startsWith("processing")) return;
    voice.start();
  }, [voice, phase]);

  const handleVoicePressUp = useCallback(async () => {
    if (!voice.supported) return;
    const transcript = await voice.stop();
    if (transcript.trim().length > 0) {
      await refine(transcript);
    }
  }, [voice, refine]);

  if (isMobile) return <MobileFallback />;

  const humState: HumButtonState =
    phase === "denied"
      ? "denied"
      : phase === "recording"
        ? "recording"
        : phase === "processing-initial" || phase === "processing-refine"
          ? "processing"
          : phase === "playing"
            ? "playing"
            : "idle";

  const copy =
    errorMsg !== null
      ? errorMsg
      : phase === "recording"
        ? REC_COPY
        : phase === "processing-initial"
          ? PROC_COPY_INITIAL
          : phase === "processing-refine"
            ? PROC_COPY_REFINE
            : phase === "denied"
              ? DENIED_COPY
              : phase === "stopped"
                ? STOPPED_COPY
                : IDLE_COPY;

  const hasArrangement = arrangement !== null;
  const processing =
    phase === "processing-initial" || phase === "processing-refine";

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
          <div className="controls">
            <PlaybackControls
              playing={phase === "playing"}
              disabled={processing}
              onStop={stopPlayback}
              onReplay={replay}
            />

            <Layers
              arrangement={arrangement!}
              disabled={processing}
              onRegenerateChords={() => refine("regenerate the chords")}
              onRemoveChords={removeChords}
              onAddChords={() => refine("add chords")}
              onRegenerateDrums={() => refine("regenerate the drums")}
              onRemoveDrums={removeDrums}
              onAddDrums={() => refine("add drums")}
            />

            <VibePresets disabled={processing} onPick={refine} />

            <VoiceMic
              listening={voice.listening}
              supported={voice.supported}
              disabled={processing}
              onPressDown={handleVoicePressDown}
              onPressUp={handleVoicePressUp}
            />
            {voice.listening && (
              <span className="microcopy" style={{ fontSize: "0.9rem" }}>
                {voice.transcript || "Listening for your refinement…"}
              </span>
            )}

            <NotesDebug
              notes={arrangement!.melody}
              tempo={arrangement!.tempo}
              keyLabel={`${arrangement!.key.tonic} ${arrangement!.key.mode}`}
            />

            <p className="placeholder-note">
              <em>Sound is a placeholder pluck synth. Real guitar samples land in v1.1.</em>
            </p>
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
