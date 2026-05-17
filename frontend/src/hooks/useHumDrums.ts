/**
 * Push-to-talk recorder dedicated to drum-pattern capture.
 *
 * Mostly mirrors `useHumRecorder`, but kept separate so callers can record
 * pitched and percussive content in parallel without state collisions.
 */
import { useCallback, useEffect, useRef, useState } from "react";

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

export interface UseHumDrums {
  recording: boolean;
  start(): Promise<void>;
  stop(): Promise<Blob | null>;
  errorMessage: string | null;
}

export function useHumDrums(): UseHumDrums {
  const [recording, setRecording] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const resolveStopRef = useRef<((b: Blob | null) => void) | null>(null);

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = useCallback(async () => {
    setErrorMessage(null);
    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      }
      const mime = pickMime();
      const rec = mime
        ? new MediaRecorder(streamRef.current, { mimeType: mime })
        : new MediaRecorder(streamRef.current);
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime ?? "audio/webm" });
        chunksRef.current = [];
        const resolve = resolveStopRef.current;
        resolveStopRef.current = null;
        resolve?.(blob.size > 0 ? blob : null);
      };

      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "recording") return Promise.resolve(null);
    return new Promise<Blob | null>((resolve) => {
      resolveStopRef.current = resolve;
      rec.stop();
      setRecording(false);
    });
  }, []);

  return { recording, start, stop, errorMessage };
}
