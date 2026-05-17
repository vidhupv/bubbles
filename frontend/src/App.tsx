/**
 * Hummingbird main app.
 *
 * Disc is the central control. Click to toggle:
 *   idle → recording → processing → playing ↔ paused
 *
 * "Hum again" link re-records from any non-processing state.
 * Vibe buttons + voice refinement reshape the arrangement.
 * Per-layer mute filters the rendered arrangement client-side.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import type { Arrangement, Drums as DrumsType } from "@shared/types";
import {
  ApiError,
  arrangeFromHum,
  chordsFromHum,
  drumsFromHum,
  refineArrangement,
  saveToLibrary,
} from "./api";
import { nudgeTempo, transposeArrangement } from "./audio/edit";
import type { InstrumentId } from "./audio/instruments";
import { play, type PlaybackHandle } from "./audio/renderer";
import {
  DEFAULT_CHORD_INSTRUMENT,
  DEFAULT_MELODY_INSTRUMENT,
  loadInstruments,
  unlockAudio,
  type Instruments,
} from "./audio/sampler";
import { Brand } from "./components/Brand";
import { EditorControls } from "./components/EditorControls";
import { ExportLink } from "./components/ExportLink";
import { HumButton, type HumButtonState } from "./components/HumButton";
import { Icon } from "./components/Icon";
import { Layers } from "./components/Layers";
import { Library } from "./components/Library";
import { MobileFallback } from "./components/MobileFallback";
import { RationaleChat } from "./components/RationaleChat";
import { VoiceMic } from "./components/VoiceMic";
import { useHumDrums } from "./hooks/useHumDrums";
import { useHumRecorder } from "./hooks/useHumRecorder";
import { useVoiceCommand } from "./hooks/useVoiceCommand";

type Phase =
  | "idle"
  | "recording"
  | "processing"
  | "playing"
  | "paused"
  | "denied";

const MIN_HUM_MS = 1500;
const TOO_SHORT_MSG = "Hum a bit longer — at least 1.5 seconds.";
const SHOW_RATIONALE_KEY = "hummingbird:showRationale";

type Muted = { melody: boolean; chords: boolean; drums: boolean };

export function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [arrangement, setArrangement] = useState<Arrangement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showRationale] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(SHOW_RATIONALE_KEY);
    return v === null ? true : v === "true";
  });

  const [melodyInstrument, setMelodyInstrument] = useState<InstrumentId>(
    DEFAULT_MELODY_INSTRUMENT,
  );
  const [chordInstrument, setChordInstrument] = useState<InstrumentId>(
    DEFAULT_CHORD_INSTRUMENT,
  );
  const [melodyLoading, setMelodyLoading] = useState(false);
  const [chordLoading, setChordLoading] = useState(false);

  const [muted, setMuted] = useState<Muted>({
    melody: false,
    chords: false,
    drums: false,
  });

  const recorder = useHumRecorder();
  const drumRecorder = useHumDrums();
  const chordRecorder = useHumDrums();
  const voice = useVoiceCommand();

  const [librarySignal, setLibrarySignal] = useState(0);
  const [saving, setSaving] = useState(false);

  const instrumentsRef = useRef<Instruments | null>(null);
  const playbackRef = useRef<PlaybackHandle | null>(null);
  const recordStartRef = useRef<number>(0);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    localStorage.setItem(SHOW_RATIONALE_KEY, String(showRationale));
  }, [showRationale]);

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
      void instrumentsRef.current.melody.ready().catch(() => undefined);
      void instrumentsRef.current.chordPad.ready().catch(() => undefined);
    }
    return instrumentsRef.current;
  }, []);

  const renderArrangement = useCallback(
    async (arr: Arrangement, m: Muted = muted) => {
      const instr = await ensureInstruments();
      const effective = applyMute(arr, m);
      playbackRef.current?.stop();
      playbackRef.current = play(effective, instr);
    },
    [ensureInstruments, muted],
  );

  /** Swap arrangement in-place — keep the Transport at its current position
   *  so removing/changing a layer doesn't restart the loop from bar 1. */
  const swapArrangement = useCallback(
    async (arr: Arrangement, m: Muted = muted) => {
      const instr = await ensureInstruments();
      const effective = applyMute(arr, m);
      playbackRef.current?.stop();
      playbackRef.current = play(effective, instr, { keepPosition: true });
    },
    [ensureInstruments, muted],
  );

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    if (playbackRef.current) {
      playbackRef.current.stop();
      playbackRef.current = null;
    }
    try {
      await recorder.start();
      recordStartRef.current = Date.now();
      setPhase("recording");
    } catch {
      /* state mirrored via effect */
    }
  }, [recorder]);

  const finishRecording = useCallback(async () => {
    const heldMs = Date.now() - recordStartRef.current;
    const blob = await recorder.stop();
    if (!blob || heldMs < MIN_HUM_MS) {
      setPhase(arrangement ? "paused" : "idle");
      setErrorMsg(TOO_SHORT_MSG);
      return;
    }
    setPhase("processing");
    try {
      const arr = await arrangeFromHum(blob);
      setArrangement(arr);
      await renderArrangement(arr);
      setPhase("playing");
    } catch (err) {
      setPhase(arrangement ? "paused" : "idle");
      setErrorMsg(humanizeError(err));
    }
  }, [arrangement, recorder, renderArrangement]);

  const onDiscClick = useCallback(async () => {
    if (phase === "processing") return;
    if (phase === "recording") {
      await finishRecording();
      return;
    }
    if (phase === "playing") {
      Tone.Transport.pause();
      setPhase("paused");
      return;
    }
    if (phase === "paused" && arrangement) {
      Tone.Transport.start();
      setPhase("playing");
      return;
    }
    await startRecording();
  }, [phase, arrangement, startRecording, finishRecording]);

  const humAgain = useCallback(async () => {
    if (phase === "processing" || phase === "recording") return;
    await startRecording();
  }, [phase, startRecording]);

  /** Tool-routing layer.
   *
   *  The voice agent dispatches free-form intents to client-side tools
   *  (transpose, nudgeTempo) before falling back to the Claude API. This
   *  saves a network round-trip on common edits AND keeps the
   *  determinism the user expects for explicit commands. Anything that
   *  doesn't map to a local tool flows to /arrange so Claude can
   *  reinterpret musically.
   */
  const tryLocalTool = useCallback(
    (intent: string, arr: Arrangement): Arrangement | null => {
      const text = intent.toLowerCase();
      // Transpose: "transpose up 2", "up 2 semitones", "down a half-step",
      // "shift up an octave", etc.
      const transposeMatch =
        /(?:transpose|shift|move|pitch)\s+(up|down|higher|lower)\s+(?:by\s+)?(\d+|an?\s+octave|a?\s*half[- ]?step)/.exec(text) ??
        /^(up|down|higher|lower)\s+(\d+|an?\s+octave|a?\s*half[- ]?step)/.exec(text);
      if (transposeMatch) {
        const dir = /up|higher/.test(transposeMatch[1]) ? 1 : -1;
        const amt = transposeMatch[2];
        let semis = 1;
        if (/octave/.test(amt)) semis = 12;
        else if (/half/.test(amt)) semis = 1;
        else semis = parseInt(amt, 10) || 1;
        return transposeArrangement(arr, dir * semis);
      }
      // Tempo nudges: "faster", "slower", "speed up", "slow down", "X bpm"
      const tempoMatch = /(\d+)\s*bpm/.exec(text);
      if (tempoMatch) {
        const target = parseInt(tempoMatch[1], 10);
        return nudgeTempo(arr, target - arr.tempo);
      }
      if (/faster|speed\s*up|quicker/.test(text)) return nudgeTempo(arr, 8);
      if (/slower|slow\s*down|relax/.test(text)) return nudgeTempo(arr, -8);
      return null;
    },
    [],
  );

  const refine = useCallback(
    async (intent: string) => {
      if (!arrangement) return;
      setErrorMsg(null);

      // Agentic fast path: try client-side tools first.
      const local = tryLocalTool(intent, arrangement);
      if (local) {
        setArrangement(local);
        await swapArrangement(local);
        setPhase("playing");
        return;
      }

      setPhase("processing");
      try {
        const next = await refineArrangement({
          notes: arrangement.melody,
          intent,
          prior: arrangement,
          bpm_hint: arrangement.tempo,
          key_hint: `${arrangement.key.tonic} ${arrangement.key.mode}`,
        });
        setArrangement(next);
        await swapArrangement(next);
        setPhase("playing");
      } catch (err) {
        setPhase("playing");
        setErrorMsg(humanizeError(err));
      }
    },
    [arrangement, swapArrangement, tryLocalTool],
  );

  const handleTranspose = useCallback(
    async (semitones: number) => {
      if (!arrangement) return;
      const next = transposeArrangement(arrangement, semitones);
      setArrangement(next);
      await swapArrangement(next);
      setPhase("playing");
    },
    [arrangement, swapArrangement],
  );

  const handleTempoNudge = useCallback(
    async (delta: number) => {
      if (!arrangement) return;
      const next = nudgeTempo(arrangement, delta);
      setArrangement(next);
      await swapArrangement(next);
      setPhase("playing");
    },
    [arrangement, swapArrangement],
  );

  const removeChords = useCallback(async () => {
    if (!arrangement) return;
    const next: Arrangement = {
      ...arrangement,
      chord_progression: [],
      guitar: null,
    };
    setArrangement(next);
    await swapArrangement(next);
    setPhase("playing");
  }, [arrangement, swapArrangement]);

  const removeDrums = useCallback(async () => {
    if (!arrangement) return;
    const next: Arrangement = { ...arrangement, drums: null };
    setArrangement(next);
    await swapArrangement(next);
    setPhase("playing");
  }, [arrangement, swapArrangement]);

  const toggleHumChords = useCallback(async () => {
    if (!arrangement) return;
    if (chordRecorder.recording) {
      const blob = await chordRecorder.stop();
      if (!blob) return;
      setPhase("processing");
      try {
        const { chord_progression, guitar } = await chordsFromHum(
          blob,
          arrangement.key.tonic,
          arrangement.key.mode,
        );
        const next: Arrangement = {
          ...arrangement,
          chord_progression,
          guitar,
        };
        setArrangement(next);
        await swapArrangement(next);
        setPhase("playing");
      } catch (err) {
        setPhase("playing");
        setErrorMsg(humanizeError(err));
      }
    } else {
      setErrorMsg(null);
      try {
        await chordRecorder.start();
      } catch {
        /* error mirrored */
      }
    }
  }, [arrangement, chordRecorder, swapArrangement]);

  const handleSave = useCallback(async () => {
    if (!arrangement || saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await saveToLibrary(arrangement);
      setLibrarySignal((n) => n + 1);
    } catch (err) {
      setErrorMsg(humanizeError(err));
    } finally {
      setSaving(false);
    }
  }, [arrangement, saving]);

  const loadFromLibrary = useCallback(
    async (arr: Arrangement) => {
      setErrorMsg(null);
      setArrangement(arr);
      await renderArrangement(arr);
      setPhase("playing");
    },
    [renderArrangement],
  );

  const toggleHumDrums = useCallback(async () => {
    if (!arrangement) return;
    if (drumRecorder.recording) {
      const blob = await drumRecorder.stop();
      if (!blob) return;
      setPhase("processing");
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
    } else {
      setErrorMsg(null);
      try {
        await drumRecorder.start();
      } catch {
        /* error mirrored */
      }
    }
  }, [arrangement, drumRecorder, renderArrangement]);

  const toggleVoice = useCallback(async () => {
    if (!voice.supported || phase === "processing") return;
    if (voice.listening) {
      const transcript = await voice.stop();
      if (transcript.trim().length > 0) {
        await refine(transcript);
      }
    } else {
      voice.start();
    }
  }, [voice, phase, refine]);

  const toggleMute = useCallback(
    async (layer: "melody" | "chords" | "drums") => {
      const next: Muted = { ...muted, [layer]: !muted[layer] };
      setMuted(next);
      if (arrangement && (phase === "playing" || phase === "paused")) {
        await swapArrangement(arrangement, next);
        if (phase === "paused") {
          Tone.Transport.pause();
        }
      }
    },
    [muted, arrangement, phase, swapArrangement],
  );

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
      } catch {
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
      } catch {
        setErrorMsg(`Couldn't load ${id} — try again.`);
        setChordInstrument(instr.chordId);
      } finally {
        setChordLoading(false);
      }
    },
    [arrangement, ensureInstruments, renderArrangement],
  );

  if (isMobile) return <MobileFallback />;

  const humState: HumButtonState = phase;
  const hasArrangement = arrangement !== null;
  const processing = phase === "processing";
  const discSize = hasArrangement ? 260 : 360;

  return (
    <>
      <header className="topbar">
        <Brand />
        <div className="topbar__right">
          {hasArrangement && (
            <button
              type="button"
              className="export"
              onClick={handleSave}
              disabled={saving}
              aria-label="Save to library"
            >
              {saving ? (
                <>
                  <span className="spinner" /> Saving
                </>
              ) : (
                <>
                  <Icon name="check" size={16} /> Save
                </>
              )}
            </button>
          )}
          {hasArrangement && <ExportLink arrangement={arrangement} />}
        </div>
      </header>

      <main className={`stage ${hasArrangement ? "stage--active" : "stage--empty"}`}>
        <HumButton
          state={humState}
          arrangement={arrangement}
          size={discSize}
          onClick={onDiscClick}
        />

        {hasArrangement && (
          <div className="hum-again">
            <button
              type="button"
              className="text-link"
              onClick={humAgain}
              disabled={processing || phase === "recording"}
            >
              {phase === "recording" ? "Tap the disc to finish" : "Hum again"}
            </button>
          </div>
        )}

        {errorMsg && (
          <p className="microcopy error" role="alert">
            {errorMsg}
          </p>
        )}

        {hasArrangement && showRationale && arrangement && (
          <RationaleChat key={arrangement.rationale} text={arrangement.rationale} />
        )}

        {hasArrangement && arrangement && (
          <Layers
            arrangement={arrangement}
            disabled={processing}
            melodyInstrument={melodyInstrument}
            chordInstrument={chordInstrument}
            melodyLoading={melodyLoading}
            chordLoading={chordLoading}
            drumsRecording={drumRecorder.recording}
            chordsRecording={chordRecorder.recording}
            muted={muted}
            onToggleMute={toggleMute}
            onMelodyInstrumentChange={handleMelodyInstrumentChange}
            onChordInstrumentChange={handleChordInstrumentChange}
            onRegenerateChords={() => refine("regenerate the chords")}
            onRemoveChords={removeChords}
            onAddChords={() => refine("add chords")}
            onToggleHumChords={toggleHumChords}
            onRegenerateDrums={() => refine("regenerate the drums")}
            onRemoveDrums={removeDrums}
            onAddDrums={() => refine("add drums")}
            onToggleHumDrums={toggleHumDrums}
          />
        )}

        {hasArrangement && (
          <div className="vibes" role="group" aria-label="Refine vibe">
            <button
              type="button"
              className="vibe"
              onClick={() => refine("make it sadder")}
              disabled={processing}
            >
              Sadder
            </button>
            <span className="vibes__sep" aria-hidden="true">·</span>
            <button
              type="button"
              className="vibe"
              onClick={() =>
                refine("make the drums heavier and the bass louder")
              }
              disabled={processing}
            >
              Heavier
            </button>
            <span className="vibes__sep" aria-hidden="true">·</span>
            <button
              type="button"
              className="vibe"
              onClick={() =>
                refine("simplify — just root chords, lighter drums")
              }
              disabled={processing}
            >
              Simpler
            </button>
          </div>
        )}

        {hasArrangement && arrangement && (
          <EditorControls
            disabled={processing}
            tempo={arrangement.tempo}
            onTranspose={handleTranspose}
            onTempo={handleTempoNudge}
          />
        )}

        {hasArrangement && (
          <VoiceMic
            listening={voice.listening}
            supported={voice.supported}
            disabled={processing}
            transcript={voice.transcript}
            onToggle={toggleVoice}
          />
        )}

        <Library refreshSignal={librarySignal} onLoad={loadFromLibrary} />
      </main>
    </>
  );
}

function applyMute(arr: Arrangement, m: Muted): Arrangement {
  return {
    ...arr,
    melody: m.melody ? [] : arr.melody,
    chord_progression: m.chords ? [] : arr.chord_progression,
    guitar: m.chords ? null : arr.guitar,
    drums: m.drums ? null : arr.drums,
  };
}

function humanizeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 422)
      return "I couldn't pick that up — try humming more clearly.";
    if (err.status === 413)
      return "That hum was too long — try under 30 seconds.";
    return err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}
