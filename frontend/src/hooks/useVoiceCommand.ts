/**
 * Push-to-talk Web Speech API wrapper for voice refinement intents.
 *
 * Browser support: Chrome/Edge are great. Safari is partial (SpeechRecognition
 * exists but is unreliable). Firefox lacks it entirely. Desktop-only MVP per
 * design review, so Chrome on macOS is the target.
 *
 * If the API isn't available, `supported` is false and the caller should show
 * a tiny "voice not supported in this browser, use the preset buttons" hint.
 */
import { useCallback, useEffect, useRef, useState } from "react";

// SpeechRecognition is a vendor-prefixed BOM type; minimal shim:
type AnySR = {
  new (): {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((e: any) => void) | null;
    onerror: ((e: any) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
  };
};

function getSR(): AnySR | undefined {
  const w = window as any;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as AnySR | undefined;
}

export interface UseVoiceCommand {
  supported: boolean;
  listening: boolean;
  start(): void;
  stop(): Promise<string>;
  transcript: string;
  errorMessage: string | null;
}

export function useVoiceCommand(): UseVoiceCommand {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const SR = getSR();
  const supported = !!SR;

  const recRef = useRef<InstanceType<AnySR> | null>(null);
  const resolveRef = useRef<((value: string) => void) | null>(null);
  const finalRef = useRef<string>("");

  // Tear down on unmount.
  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const start = useCallback(() => {
    if (!SR) {
      setErrorMessage("Voice input isn't supported in this browser.");
      return;
    }
    setErrorMessage(null);
    setTranscript("");
    finalRef.current = "";

    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      let interim = "";
      let final = finalRef.current;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript;
        if (r.isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }
      finalRef.current = final;
      setTranscript((final + interim).trim());
    };

    rec.onerror = (e: any) => {
      const msg =
        typeof e?.error === "string" ? e.error : "Voice recognition error.";
      setErrorMessage(msg);
    };

    rec.onend = () => {
      setListening(false);
      const result = finalRef.current.trim();
      const resolve = resolveRef.current;
      resolveRef.current = null;
      resolve?.(result);
    };

    rec.start();
    recRef.current = rec;
    setListening(true);
  }, [SR]);

  const stop = useCallback(() => {
    return new Promise<string>((resolve) => {
      if (!recRef.current || !listening) {
        resolve(finalRef.current.trim());
        return;
      }
      resolveRef.current = resolve;
      try {
        recRef.current.stop();
      } catch {
        setListening(false);
        resolve(finalRef.current.trim());
      }
    });
  }, [listening]);

  return { supported, listening, start, stop, transcript, errorMessage };
}
