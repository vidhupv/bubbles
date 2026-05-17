/**
 * Rationale — fades in word by word, no typewriter monospace.
 *
 * Reveals one word per 45ms. Inline word spans with raw single-space text
 * nodes between them so word-spacing matches normal flow.
 */
import { Fragment, useEffect, useState } from "react";

interface Props {
  text: string | null;
}

export function RationaleChat({ text }: Props) {
  const [reveal, setReveal] = useState(0);
  const words = text ? text.split(" ") : [];

  useEffect(() => {
    if (!text) {
      setReveal(0);
      return;
    }
    setReveal(0);
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setReveal(i);
      if (i >= words.length) window.clearInterval(id);
    }, 45);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  if (!text) return null;

  return (
    <p className="rationale" role="status" aria-live="polite">
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className={`word ${i < reveal ? "word--on" : ""}`}>{w}</span>
          {i < words.length - 1 ? " " : ""}
        </Fragment>
      ))}
    </p>
  );
}
