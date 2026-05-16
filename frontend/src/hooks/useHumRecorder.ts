/**
 * Push-to-talk hum recorder.
 *
 * Holds the mic stream alive across multiple presses to keep latency low.
 * Returns the recorded blob on stop. Minimum recording duration is enforced
 * by the caller (a 200 ms tap doesn't count as a hum).
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type MicState =
  | "idle"
  | "requesting"
  | "ready"
  | "recording"
  | "denied"
  | "error";

interface UseHumRecorder {
  state: MicState;
  start(): Promise<void>;
  stop(): Promise<Blob | null>;
  errorMessage: string | null;
  /** Live audio level 0-1 while recording; useful for the blob's pulsing animation. */
  level: number;
}

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

export function useHumRecorder(): UseHumRecorder {
  const [state, setState] = useState<MicState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const resolveStopRef = useRef<((blob: Blob | null) => void) | null>(null);

  // Tear down on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      recorderRef.current?.state === "recording" && recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => undefined);
    };
  }, []);

  const ensureStream = useCallback(async (): Promise<MediaStream> => {
    if (streamRef.current) return streamRef.current;
    setState("requesting");
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      setState("ready");
      return stream;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      // Permission denial errors look like NotAllowedError / SecurityError
      const isDenied =
        err instanceof Error &&
        (err.name === "NotAllowedError" || err.name === "SecurityError");
      setState(isDenied ? "denied" : "error");
      throw err;
    }
  }, []);

  const startLevelMeter = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) {
        const dev = Math.abs(v - 128) / 128;
        if (dev > peak) peak = dev;
      }
      setLevel(peak);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const start = useCallback(async () => {
    const stream = await ensureStream();
    const mime = pickMime();
    const rec = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    chunksRef.current = [];

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: mime ?? "audio/webm",
      });
      chunksRef.current = [];
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setLevel(0);
      const resolve = resolveStopRef.current;
      resolveStopRef.current = null;
      resolve?.(blob.size > 0 ? blob : null);
    };

    rec.start();
    recorderRef.current = rec;
    setState("recording");
    startLevelMeter();
  }, [ensureStream, startLevelMeter]);

  const stop = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "recording") {
      return null;
    }
    return new Promise<Blob | null>((resolve) => {
      resolveStopRef.current = resolve;
      rec.stop();
      setState("ready");
    });
  }, []);

  return { state, start, stop, errorMessage, level };
}
