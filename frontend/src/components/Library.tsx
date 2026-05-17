/**
 * Library panel — accepted songs the user has saved.
 *
 * Saved songs are the taste signal. Hummingbird feeds them back to Claude as
 * in-context examples when generating new chords/drums, so the agent's
 * choices drift toward what the user already accepted.
 */
import { useEffect, useState } from "react";
import type { Arrangement } from "@shared/types";
import { deleteLibrary, listLibrary, type LibraryEntry } from "../api";

interface Props {
  /** Refresh trigger — bump this number to re-fetch the library. */
  refreshSignal: number;
  onLoad(arrangement: Arrangement): void;
}

export function Library({ refreshSignal, onLoad }: Props) {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listLibrary()
      .then((items) => {
        if (!cancelled) setEntries(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  async function handleDelete(id: string) {
    try {
      await deleteLibrary(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (loading && entries.length === 0) {
    return <p className="library__empty">Loading library…</p>;
  }
  if (error && entries.length === 0) {
    return <p className="library__empty error">Library error: {error}</p>;
  }
  if (entries.length === 0) {
    return (
      <p className="library__empty">
        No saved songs yet. Click <em>save</em> once you have an arrangement
        you like — Hummingbird learns from what you keep.
      </p>
    );
  }

  return (
    <section className="library" aria-label="Saved songs">
      <h3 className="library__heading">library · {entries.length}</h3>
      <ul className="library__list">
        {entries.map((entry) => (
          <li key={entry.id} className="library__entry">
            <button
              type="button"
              className="library__title"
              onClick={() => onLoad(entry.arrangement)}
              title="Load this arrangement"
            >
              {entry.title}
            </button>
            <span className="library__detail">
              {entry.arrangement.tempo} bpm ·{" "}
              {entry.arrangement.chord_progression.length > 0
                ? entry.arrangement.chord_progression.join(" ")
                : "melody only"}
            </span>
            <button
              type="button"
              className="library__delete"
              onClick={() => handleDelete(entry.id)}
              aria-label="Delete from library"
              title="Delete"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
