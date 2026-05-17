/**
 * Push-to-talk recorder dedicated to drum/chord overdub capture.
 *
 * All instances share a single MediaStream via a module-level cache so
 * multiple useHumDrums() callers (one for drums, one for chord overdubs)
 * don't race each other through navigator.mediaDevices.getUserMedia.
 * Previously each instance grabbed its own stream — on Chrome the second
 * call would silently return a tainted stream and MediaRecorder.start()
 * would fire-and-forget without ever emitting data.
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

// Shared across all useHumDrums() callers.
let _sharedStream: MediaStream | null = null;
let _pendingStream: Promise<MediaStream> | null = null;

async function getSharedStream(): Promise<MediaStream> {
  if (_sharedStream && _sharedStream.active) return _sharedStream;
  if (_pendingStream) return _pendingStream;
  _pendingStream = navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  try {
    _sharedStream = await _pendingStream;
    return _sharedStream;
  } finally {
    _pendingStream = null;
  }
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

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const resolveStopRef = useRef<((b: Blob | null) => void) | null>(null);

  useEffect(() => {
    return () => {
      // Stop only this instance's recorder. DO NOT stop the shared stream's
      // tracks — other hook instances may still be using it.
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    };
  }, []);

  const start = useCallback(async () => {
    setErrorMessage(null);
    try {
      const stream = await getSharedStream();
      const mime = pickMime();
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
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
