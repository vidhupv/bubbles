/**
 * Layers panel — shows what's currently in the arrangement and lets the user
 * regenerate or remove each layer individually.
 *
 *   Melody  →  always present (it IS the hum). No actions.
 *   Chords  →  shows the progression if present; ↻ regenerates via Claude,
 *              × removes (client-side state only, no Claude call).
 *   Drums   →  shows the kit name if present; same controls.
 *   Add row →  + chords and + drums when not yet present.
 *
 * Note: the audio synthesis in this build is a Karplus-Strong pluck (closer
 * to acoustic guitar) for melody and an FM pad for chords. Real CC-licensed
 * samples land later.
 */
import type { Arrangement } from "@shared/types";

interface Props {
  arrangement: Arrangement;
  disabled: boolean;
  onRegenerateChords(): void;
  onRemoveChords(): void;
  onAddChords(): void;
  onRegenerateDrums(): void;
  onRemoveDrums(): void;
  onAddDrums(): void;
}

const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function Layers({
  arrangement,
  disabled,
  onRegenerateChords,
  onRemoveChords,
  onAddChords,
  onRegenerateDrums,
  onRemoveDrums,
  onAddDrums,
}: Props) {
  const hasChords = arrangement.chord_progression.length > 0;
  const hasDrums = arrangement.drums !== null;

  const melodySummary = summarizeMelody(arrangement);
  const chordSummary = arrangement.chord_progression.join(" · ") || null;
  const drumSummary = arrangement.drums ? `${arrangement.drums.kit} kit` : null;

  return (
    <section className="layers" aria-label="Arrangement layers">
      <div className="layers__row">
        <span className="layers__dot" aria-hidden="true">●</span>
        <span className="layers__name">melody</span>
        <span className="layers__detail">{melodySummary}</span>
        <span className="layers__actions" />
      </div>

      <div className={`layers__row ${hasChords ? "" : "layers__row--empty"}`}>
        <span className="layers__dot" aria-hidden="true">{hasChords ? "●" : "○"}</span>
        <span className="layers__name">chords</span>
        <span className="layers__detail">{chordSummary ?? "—"}</span>
        <span className="layers__actions">
          {hasChords ? (
            <>
              <button
                type="button"
                className="layers__btn"
                disabled={disabled}
                onClick={onRegenerateChords}
                aria-label="Regenerate chords"
                title="Regenerate"
              >
                ↻
              </button>
              <button
                type="button"
                className="layers__btn"
                disabled={disabled}
                onClick={onRemoveChords}
                aria-label="Remove chords"
                title="Remove"
              >
                ×
              </button>
            </>
          ) : (
            <button
              type="button"
              className="layers__add"
              disabled={disabled}
              onClick={onAddChords}
            >
              + add
            </button>
          )}
        </span>
      </div>

      <div className={`layers__row ${hasDrums ? "" : "layers__row--empty"}`}>
        <span className="layers__dot" aria-hidden="true">{hasDrums ? "●" : "○"}</span>
        <span className="layers__name">drums</span>
        <span className="layers__detail">{drumSummary ?? "—"}</span>
        <span className="layers__actions">
          {hasDrums ? (
            <>
              <button
                type="button"
                className="layers__btn"
                disabled={disabled}
                onClick={onRegenerateDrums}
                aria-label="Regenerate drums"
                title="Regenerate"
              >
                ↻
              </button>
              <button
                type="button"
                className="layers__btn"
                disabled={disabled}
                onClick={onRemoveDrums}
                aria-label="Remove drums"
                title="Remove"
              >
                ×
              </button>
            </>
          ) : (
            <button
              type="button"
              className="layers__add"
              disabled={disabled}
              onClick={onAddDrums}
            >
              + add
            </button>
          )}
        </span>
      </div>
    </section>
  );
}

function summarizeMelody(arr: Arrangement): string {
  const n = arr.melody.length;
  if (n === 0) return "—";
  const tonic = arr.key.tonic;
  const range = noteRange(arr);
  return `${n} notes · ${tonic} ${arr.key.mode}${range}`;
}

function noteRange(arr: Arrangement): string {
  if (arr.melody.length === 0) return "";
  const midis = arr.melody.map((m) => m.midi);
  const lo = Math.min(...midis);
  const hi = Math.max(...midis);
  if (lo === hi) return ` · ${PITCH_NAMES[lo % 12]}${Math.floor(lo / 12) - 1}`;
  return ` · ${PITCH_NAMES[lo % 12]}${Math.floor(lo / 12) - 1}–${PITCH_NAMES[hi % 12]}${Math.floor(hi / 12) - 1}`;
}
