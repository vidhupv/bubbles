/**
 * Progressive layer buttons: + chords, + drums.
 *
 * Each maps to a Claude refinement call with a specific intent. Once a layer
 * is added, the button changes label to indicate it's already present (and
 * tapping again re-rolls that layer).
 */

interface Props {
  hasChords: boolean;
  hasDrums: boolean;
  disabled: boolean;
  onAddChords(): void;
  onAddDrums(): void;
}

export function LayerControls({
  hasChords,
  hasDrums,
  disabled,
  onAddChords,
  onAddDrums,
}: Props) {
  return (
    <div className="layer-controls" role="group" aria-label="Add layers">
      <button
        type="button"
        className={`layer ${hasChords ? "layer--on" : ""}`}
        disabled={disabled}
        onClick={onAddChords}
      >
        {hasChords ? "↻ chords" : "+ chords"}
      </button>
      <button
        type="button"
        className={`layer ${hasDrums ? "layer--on" : ""}`}
        disabled={disabled}
        onClick={onAddDrums}
      >
        {hasDrums ? "↻ drums" : "+ drums"}
      </button>
    </div>
  );
}
