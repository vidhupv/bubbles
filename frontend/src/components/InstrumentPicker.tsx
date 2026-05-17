/**
 * Compact instrument dropdown for a single layer.
 *
 * Uses a native <select> for accessibility + zero JS overhead. Styling makes
 * it look like a tiny inline label rather than a heavy form control.
 */
import { INSTRUMENTS, type InstrumentId } from "../audio/instruments";

interface Props {
  value: InstrumentId;
  loading: boolean;
  disabled: boolean;
  onChange(id: InstrumentId): void;
}

export function InstrumentPicker({ value, loading, disabled, onChange }: Props) {
  return (
    <span className={`instrument-picker ${loading ? "instrument-picker--loading" : ""}`}>
      <select
        className="instrument-picker__select"
        value={value}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value as InstrumentId)}
        aria-label="Choose instrument"
      >
        {INSTRUMENTS.map((i) => (
          <option key={i.id} value={i.id}>
            {i.label}
          </option>
        ))}
      </select>
      {loading && <span className="instrument-picker__spinner">·loading</span>}
    </span>
  );
}
