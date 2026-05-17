/**
 * Layers panel — 5-column row per layer (status dot, name, detail, picker, actions).
 *
 *   Melody — always present. Instrument picker. No actions.
 *   Chords — instrument picker + regen/remove, or + Add when empty.
 *   Drums  — mic re-hum + regen/remove, or + Add + Hum when empty.
 *
 * Status dot toggles client-side mute (does not call the backend).
 */
import type { Arrangement } from "@shared/types";
import type { InstrumentId } from "../audio/instruments";
import { Icon } from "./Icon";
import { InstrumentPicker } from "./InstrumentPicker";

interface Props {
  arrangement: Arrangement;
  disabled: boolean;
  melodyInstrument: InstrumentId;
  chordInstrument: InstrumentId;
  melodyLoading: boolean;
  chordLoading: boolean;
  drumsRecording: boolean;
  chordsRecording: boolean;
  muted: { melody: boolean; chords: boolean; drums: boolean };
  onToggleMute(layer: "melody" | "chords" | "drums"): void;
  onMelodyInstrumentChange(id: InstrumentId): void;
  onChordInstrumentChange(id: InstrumentId): void;
  onRegenerateChords(): void;
  onRemoveChords(): void;
  onAddChords(): void;
  onToggleHumChords(): void;
  onRegenerateDrums(): void;
  onRemoveDrums(): void;
  onAddDrums(): void;
  onToggleHumDrums(): void;
}

export function Layers(props: Props) {
  const {
    arrangement,
    disabled,
    melodyInstrument,
    chordInstrument,
    melodyLoading,
    chordLoading,
    drumsRecording,
    chordsRecording,
    muted,
    onToggleMute,
    onMelodyInstrumentChange,
    onChordInstrumentChange,
    onRegenerateChords,
    onRemoveChords,
    onAddChords,
    onToggleHumChords,
    onRegenerateDrums,
    onRemoveDrums,
    onAddDrums,
    onToggleHumDrums,
  } = props;

  const hasChords = arrangement.chord_progression.length > 0;
  const hasDrums = arrangement.drums !== null;

  return (
    <section className="layers" aria-label="Layers">
      <Row
        name="Melody"
        present
        muted={muted.melody}
        detail={summarizeMelody(arrangement)}
        disabled={disabled}
        onToggleMute={() => onToggleMute("melody")}
      >
        <span className="row__instr">
          <InstrumentPicker
            value={melodyInstrument}
            loading={melodyLoading}
            disabled={disabled}
            onChange={onMelodyInstrumentChange}
          />
        </span>
        <span className="row__actions" />
      </Row>

      <Row
        name="Chords"
        present={hasChords}
        muted={muted.chords}
        detail={hasChords ? arrangement.chord_progression.join(" · ") : null}
        disabled={disabled}
        onToggleMute={() => onToggleMute("chords")}
      >
        <span className="row__instr">
          {hasChords && (
            <InstrumentPicker
              value={chordInstrument}
              loading={chordLoading}
              disabled={disabled}
              onChange={onChordInstrumentChange}
            />
          )}
        </span>
        <span className="row__actions">
          {hasChords ? (
            <>
              <button
                type="button"
                className={`icon-btn ${chordsRecording ? "icon-btn--rec" : ""}`}
                disabled={disabled}
                onClick={onToggleHumChords}
                aria-label={chordsRecording ? "Stop humming chords" : "Hum chord roots"}
                title={chordsRecording ? "Stop" : "Hum chord roots"}
              >
                <Icon name="mic" size={16} />
              </button>
              <button
                type="button"
                className="icon-btn"
                disabled={disabled}
                onClick={onRegenerateChords}
                aria-label="Regenerate chords"
                title="Regenerate"
              >
                <Icon name="regen" size={16} />
              </button>
              <button
                type="button"
                className="icon-btn"
                disabled={disabled}
                onClick={onRemoveChords}
                aria-label="Remove chords"
                title="Remove"
              >
                <Icon name="x" size={16} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="ghost-btn"
                disabled={disabled}
                onClick={onAddChords}
              >
                <Icon name="plus" size={14} /> Add
              </button>
              <button
                type="button"
                className={`ghost-btn ${chordsRecording ? "ghost-btn--rec" : ""}`}
                disabled={disabled}
                onClick={onToggleHumChords}
              >
                <Icon name="mic" size={14} /> {chordsRecording ? "Stop" : "Hum"}
              </button>
            </>
          )}
        </span>
      </Row>

      <Row
        name="Drums"
        present={hasDrums}
        muted={muted.drums}
        detail={hasDrums ? `${arrangement.drums!.kit} kit` : null}
        disabled={disabled}
        onToggleMute={() => onToggleMute("drums")}
      >
        <span className="row__instr" />
        <span className="row__actions">
          {hasDrums ? (
            <>
              <button
                type="button"
                className={`icon-btn ${drumsRecording ? "icon-btn--rec" : ""}`}
                disabled={disabled}
                onClick={onToggleHumDrums}
                aria-label={drumsRecording ? "Stop humming drums" : "Hum drums"}
                title={drumsRecording ? "Stop" : "Hum drums"}
              >
                <Icon name="mic" size={16} />
              </button>
              <button
                type="button"
                className="icon-btn"
                disabled={disabled}
                onClick={onRegenerateDrums}
                aria-label="Regenerate drums"
                title="Regenerate with AI"
              >
                <Icon name="regen" size={16} />
              </button>
              <button
                type="button"
                className="icon-btn"
                disabled={disabled}
                onClick={onRemoveDrums}
                aria-label="Remove drums"
                title="Remove"
              >
                <Icon name="x" size={16} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="ghost-btn"
                disabled={disabled}
                onClick={onAddDrums}
              >
                <Icon name="plus" size={14} /> Add
              </button>
              <button
                type="button"
                className={`ghost-btn ${drumsRecording ? "ghost-btn--rec" : ""}`}
                disabled={disabled}
                onClick={onToggleHumDrums}
              >
                <Icon name="mic" size={14} /> {drumsRecording ? "Stop" : "Hum"}
              </button>
            </>
          )}
        </span>
      </Row>
    </section>
  );
}

interface RowProps {
  name: string;
  present: boolean;
  muted: boolean;
  detail: string | null;
  disabled: boolean;
  onToggleMute(): void;
  children: React.ReactNode;
}

function Row({
  name,
  present,
  muted,
  detail,
  disabled,
  onToggleMute,
  children,
}: RowProps) {
  return (
    <div
      className={`row ${present ? "row--on" : "row--off"} ${muted ? "row--muted" : ""}`}
    >
      <button
        type="button"
        className="row__status"
        onClick={onToggleMute}
        disabled={!present || disabled}
        aria-label={muted ? `Unmute ${name}` : `Mute ${name}`}
      >
        <span className="row__status-dot" />
      </button>
      <div className="row__name">{name}</div>
      <div className="row__detail">
        {present && detail ? (
          detail
        ) : (
          <span className="row__detail-empty">—</span>
        )}
      </div>
      {children}
    </div>
  );
}

function summarizeMelody(arr: Arrangement): string {
  const n = arr.melody.length;
  if (n === 0) return "—";
  return `${n} notes`;
}
