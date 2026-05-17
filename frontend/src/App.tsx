/**
 * Bubbles main app.
 *
 * Flow:
 *   1. Press + hold blob → hum → release.
 *   2. Backend pitch-detects and returns a melody-only Arrangement.
 *   3. Frontend plays the hum back on piano (default).
 *   4. Layers panel: + add chords, + add drums (AI), ◉ hum drums (yourself).
 *   5. Per-layer instrument picker (piano, acoustic guitar, electric guitar…).
 *   6. Voice mic for free-form refinement intents.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Arrangement, Drums as DrumsType } from "@shared/types";
import { ApiError, arrangeFromHum, drumsFromHum, refineArrangement } from "./api";
import type { InstrumentId } from "./audio/instruments";
import { play, type PlaybackHandle } from "./audio/renderer";
import {
  DEFAULT_CHORD_INSTRUMENT,
  DEFAULT_MELODY_INSTRUMENT,
  loadInstruments,
  unlockAudio,
  type Instruments,
} from "./audio/sampler";
import { ExportLink } from "./components/ExportLink";
import { HumButton, type HumButtonState } from "./components/HumButton";
import { Layers } from "./components/Layers";
import { MobileFallback } from "./components/MobileFallback";
import { NotesDebug } from "./components/NotesDebug";
import { PlaybackControls } from "./components/PlaybackControls";
import { RationaleChat } from "./components/RationaleChat";
import { VoiceMic } from "./components/VoiceMic";
import { useHumDrums } from "./hooks/useHumDrums";
import { useHumRecorder } from "./hooks/useHumRecorder";
import { useVoiceCommand } from "./hooks/useVoiceCommand";

const MIN_HUM_MS = 1500;
const TOO_SHORT_MSG = "Hum a bit longer — at least 1.5 seconds.";
const IDLE_COPY = "Press and hold. Hum any melody.";
const REC_COPY = "Listening…";
const PROC_COPY_INITIAL = "Hearing your hum.";
const PROC_COPY_REFINE = "Bubbles is thinking.";
const PROC_COPY_DRUMS = "Reading your drums.";
const DENIED_COPY = "Mic blocked — click to retry.";
const STOPPED_COPY = "Stopped. Replay or hum again.";

type Phase =
  | "idle"
  | "recording"
  | "processing-initial"
  | "processing-refine"
  | "processing-drums"
  | "playing"
  | "stopped"
  | "denied";

export function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [arrangement, setArrangement] = useState<Arrangement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const [melodyInstrument, setMelodyInstrument] = useState<InstrumentId>(
    DEFAULT_MELODY_INSTRUMENT,
  );
  const [chordInstrument, setChordInstrument] = useState<InstrumentId>(
    DEFAULT_CHORD_INSTRUMENT,
  );
  const [melodyLoading, setMelodyLoading] = useState(false);
  const [chordLoading, setChordLoading] = useState(false);

  const recorder = useHumRecorder();
  const drumRecorder = useHumDrums();
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

  const ensureInstruments = useCallback(async (): Promise<Instruments> => {
    await unlockAudio();
    if (!instrumentsRef.current) {
      instrumentsRef.current = loadInstruments();
      // Kick off sample preload for default melody (piano)
      void instrumentsRef.current.melody.ready().catch(() => undefined);
      void instrumentsRef.current.chordPad.ready().catch(() => undefined);
    }
    return instrumentsRef.current;
  }, []);

  const renderArrangement = useCallback(
    async (arr: Arrangement) => {
      const instr = await ensureInstruments();
      playbackRef.current?.stop();
      playbackRef.current = play(arr, instr);
    },
    [ensureInstruments],
  );

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
    if (phase.startsWith("processing")) return;
    setErrorMsg(null);
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

  const handleHumDrumsPressDown = useCallback(async () => {
    if (!arrangement) return;
    setErrorMsg(null);
    try {
      await drumRecorder.start();
    } catch {
      /* error mirrored */
    }
  }, [arrangement, drumRecorder]);

  const handleHumDrumsPressUp = useCallback(async () => {
    if (!arrangement) return;
    const blob = await drumRecorder.stop();
    if (!blob) return;
    setPhase("processing-drums");
    try {
      const { drums } = await drumsFromHum(blob);
      const next: Arrangement = { ...arrangement, drums: drums as DrumsType };
      setArrangement(next);
      await renderArrangement(next);
      setPhase("playing");
    } catch (err) {
      setPhase("playing");
      setErrorMsg(humanizeError(err));
    }
  }, [arrangement, drumRecorder, renderArrangement]);

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

  const handleMelodyInstrumentChange = useCallback(
    async (id: InstrumentId) => {
      const instr = await ensureInstruments();
      setMelodyLoading(true);
      setMelodyInstrument(id);
      try {
        await instr.setMelodyVoice(id);
        if (arrangement && playbackRef.current) {
          await renderArrangement(arrangement);
          setPhase("playing");
        }
      } catch (err) {
        setErrorMsg(`Couldn't load ${id} — try again.`);
        setMelodyInstrument(instr.melodyId);
      } finally {
        setMelodyLoading(false);
      }
    },
    [arrangement, ensureInstruments, renderArrangement],
  );

  const handleChordInstrumentChange = useCallback(
    async (id: InstrumentId) => {
      const instr = await ensureInstruments();
      setChordLoading(true);
      setChordInstrument(id);
      try {
        await instr.setChordVoice(id);
        if (arrangement && playbackRef.current) {
          await renderArrangement(arrangement);
          setPhase("playing");
        }
      } catch (err) {
        setErrorMsg(`Couldn't load ${id} — try again.`);
        setChordInstrument(instr.chordId);
      } finally {
        setChordLoading(false);
      }
    },
    [arrangement, ensureInstruments, renderArrangement],
  );

  if (isMobile) return <MobileFallback />;

  const humState: HumButtonState =
    phase === "denied"
      ? "denied"
      : phase === "recording"
        ? "recording"
        : phase.startsWith("processing")
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
            : phase === "processing-drums"
              ? PROC_COPY_DRUMS
              : phase === "denied"
                ? DENIED_COPY
                : phase === "stopped"
                  ? STOPPED_COPY
                  : IDLE_COPY;

  const hasArrangement = arrangement !== null;
  const processing = phase.startsWith("processing");

  return (
    <>
      <div className="brand">bubbles</div>
      <main className={`stage ${hasArrangement ? "has-arrangement" : ""}`}>
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
              melodyInstrument={melodyInstrument}
              chordInstrument={chordInstrument}
              melodyLoading={melodyLoading}
              chordLoading={chordLoading}
              drumsRecording={drumRecorder.recording}
              onMelodyInstrumentChange={handleMelodyInstrumentChange}
              onChordInstrumentChange={handleChordInstrumentChange}
              onRegenerateChords={() => refine("regenerate the chords")}
              onRemoveChords={removeChords}
              onAddChords={() => refine("add chords")}
              onRegenerateDrums={() => refine("regenerate the drums")}
              onRemoveDrums={removeDrums}
              onAddDrums={() => refine("add drums")}
              onHumDrumsPressDown={handleHumDrumsPressDown}
              onHumDrumsPressUp={handleHumDrumsPressUp}
            />

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
              <em>Drum sounds are still synth placeholders. Real drum samples land in v1.1.</em>
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
    if (err.status === 422) return "I couldn't pick that up — try humming more clearly.";
    if (err.status === 413) return "That hum was too long — try under 30 seconds.";
    return err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}
