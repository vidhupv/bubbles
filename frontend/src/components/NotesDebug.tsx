/**
 * Tiny diagnostic panel showing the notes basic-pitch detected.
 *
 * Lets the user tell whether a bad result is upstream (pitch detection)
 * or downstream (agent). Toggle-collapsible, off by default.
 */
import { useState } from "react";
import type { Note } from "@shared/types";

const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToName(midi: number): string {
  const oct = Math.floor(midi / 12) - 1;
  return `${PITCH_NAMES[midi % 12]}${oct}`;
}

interface Props {
  notes: Note[];
  tempo: number;
  keyLabel: string;
}

export function NotesDebug({ notes, tempo, keyLabel }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="notes-debug">
      <button
        type="button"
        className="notes-debug__toggle"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "▾" : "▸"} {notes.length} notes detected · {keyLabel} · {tempo} BPM
      </button>
      {open && (
        <ul className="notes-debug__list">
          {notes.map((n, i) => (
            <li key={i}>
              <span className="notes-debug__time">
                {n.start.toFixed(2)}s
              </span>
              <span className="notes-debug__name">{midiToName(n.midi)}</span>
              <span className="notes-debug__dur">
                {(n.end - n.start).toFixed(2)}s
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
