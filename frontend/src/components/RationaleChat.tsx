/**
 * The streaming rationale chat bubble.
 *
 * Per design review: JetBrains Mono 16px, typed-feel character streaming at
 * ~30 chars/sec, blinking cursor while active. The Agent SDK doesn't stream
 * here (the backend returns a full arrangement); we fake the type-on effect
 * client-side so the user has something to look at during the audio boot-up.
 */
import { useEffect, useRef, useState } from "react";

interface Props {
  /** Full text to display. Whenever this changes, the type-on resets. */
  text: string | null;
  /** Chars per second. Default 30. */
  cps?: number;
}

export function RationaleChat({ text, cps = 30 }: Props) {
  const [shown, setShown] = useState("");
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (text === null) {
      setShown("");
      return;
    }
    setShown("");
    let startedAt: number | null = null;
    const tick = (t: number) => {
      if (startedAt === null) startedAt = t;
      const elapsedMs = t - startedAt;
      const chars = Math.min(
        text.length,
        Math.floor((elapsedMs / 1000) * cps),
      );
      setShown(text.slice(0, chars));
      if (chars < text.length) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [text, cps]);

  if (text === null) return null;

  const streaming = shown.length < text.length;
  return (
    <div className="rationale" role="status" aria-live="polite">
      <span>{shown}</span>
      {streaming && <span className="cursor">█</span>}
    </div>
  );
}
