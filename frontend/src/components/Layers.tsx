/**
 * Layers panel — shows what's currently in the arrangement and lets the user
 * regenerate, remove, or swap instruments per layer.
 *
 *   Melody   →  always present (it IS the hum). Instrument picker.
 *   Chords   →  shows the progression if present. ↻ / × / instrument picker.
 *   Drums    →  shows the kit name if present. ↻ / × / "● hum" button.
 */
import type { Arrangement } from "@shared/types";
import type { InstrumentId } from "../audio/instruments";
import { InstrumentPicker } from "./InstrumentPicker";

interface Props {
  arrangement: Arrangement;
  disabled: boolean;
  melodyInstrument: InstrumentId;
  chordInstrument: InstrumentId;
  melodyLoading: boolean;
  chordLoading: boolean;
  drumsRecording: boolean;
  onMelodyInstrumentChange(id: InstrumentId): void;
  onChordInstrumentChange(id: InstrumentId): void;
  onRegenerateChords(): void;
  onRemoveChords(): void;
  onAddChords(): void;
  onRegenerateDrums(): void;
  onRemoveDrums(): void;
  onAddDrums(): void;
  onHumDrumsPressDown(): void;
  onHumDrumsPressUp(): void;
}

const PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function Layers(props: Props) {
  const {
    arrangement,
    disabled,
    melodyInstrument,
    chordInstrument,
    melodyLoading,
    chordLoading,
    drumsRecording,
    onMelodyInstrumentChange,
    onChordInstrumentChange,
    onRegenerateChords,
    onRemoveChords,
    onAddChords,
    onRegenerateDrums,
    onRemoveDrums,
    onAddDrums,
    onHumDrumsPressDown,
    onHumDrumsPressUp,
  } = props;

  const hasChords = arrangement.chord_progression.length > 0;
  const hasDrums = arrangement.drums !== null;

  return (
    <section className="layers" aria-label="Arrangement layers">
      <div className="layers__row">
        <span className="layers__dot" aria-hidden="true">●</span>
        <span className="layers__name">melody</span>
        <span className="layers__detail">{summarizeMelody(arrangement)}</span>
        <span className="layers__instrument">
          <InstrumentPicker
            value={melodyInstrument}
            loading={melodyLoading}
            disabled={disabled}
            onChange={onMelodyInstrumentChange}
          />
        </span>
        <span className="layers__actions" />
      </div>

      <div className={`layers__row ${hasChords ? "" : "layers__row--empty"}`}>
        <span className="layers__dot" aria-hidden="true">{hasChords ? "●" : "○"}</span>
        <span className="layers__name">chords</span>
        <span className="layers__detail">
          {hasChords ? arrangement.chord_progression.join(" · ") : "—"}
        </span>
        <span className="layers__instrument">
          {hasChords && (
            <InstrumentPicker
              value={chordInstrument}
              loading={chordLoading}
              disabled={disabled}
              onChange={onChordInstrumentChange}
            />
          )}
        </span>
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
        <span className="layers__detail">
          {hasDrums ? `${arrangement.drums!.kit} kit` : "—"}
        </span>
        <span className="layers__instrument" />
        <span className="layers__actions">
          {hasDrums ? (
            <>
              <button
                type="button"
                className="layers__btn"
                disabled={disabled}
                onClick={onRegenerateDrums}
                aria-label="Regenerate drums"
                title="Regenerate with AI"
              >
                ↻
              </button>
              <button
                type="button"
                className={`layers__btn ${drumsRecording ? "layers__btn--rec" : ""}`}
                disabled={disabled}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onHumDrumsPressDown();
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  onHumDrumsPressUp();
                }}
                onPointerCancel={(e) => {
                  e.preventDefault();
                  onHumDrumsPressUp();
                }}
                aria-label="Hum drums (press and hold)"
                title="Hum drums"
              >
                ◉
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
            <span style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="layers__add"
                disabled={disabled}
                onClick={onAddDrums}
              >
                + AI
              </button>
              <button
                type="button"
                className={`layers__add ${drumsRecording ? "layers__add--rec" : ""}`}
                disabled={disabled}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onHumDrumsPressDown();
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  onHumDrumsPressUp();
                }}
                onPointerCancel={(e) => {
                  e.preventDefault();
                  onHumDrumsPressUp();
                }}
                title="Press and hold to beatbox a drum pattern"
              >
                ◉ hum
              </button>
            </span>
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
  if (arr.melody.length === 0) return `${n} notes`;
  const midis = arr.melody.map((m) => m.midi);
  const lo = Math.min(...midis);
  const hi = Math.max(...midis);
  const range =
    lo === hi
      ? `${PITCH_NAMES[lo % 12]}${Math.floor(lo / 12) - 1}`
      : `${PITCH_NAMES[lo % 12]}${Math.floor(lo / 12) - 1}–${PITCH_NAMES[hi % 12]}${Math.floor(hi / 12) - 1}`;
  return `${n} notes · ${tonic} ${arr.key.mode} · ${range}`;
}
