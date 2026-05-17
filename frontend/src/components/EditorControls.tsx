interface Props {
  disabled: boolean;
  tempo: number;
  onTranspose(semitones: number): void;
  onTempo(delta: number): void;
}

export function EditorControls({
  disabled,
  tempo,
  onTranspose,
  onTempo,
}: Props) {
  return (
    <section className="editor-controls" aria-label="Manual editor controls">
      <div className="editor-controls__group">
        <span className="editor-controls__label">pitch</span>
        <div className="editor-controls__actions">
          <button
            type="button"
            className="editor-controls__btn"
            disabled={disabled}
            onClick={() => onTranspose(-1)}
          >
            -1
          </button>
          <button
            type="button"
            className="editor-controls__btn"
            disabled={disabled}
            onClick={() => onTranspose(1)}
          >
            +1
          </button>
          <button
            type="button"
            className="editor-controls__btn"
            disabled={disabled}
            onClick={() => onTranspose(12)}
          >
            +8va
          </button>
        </div>
      </div>

      <div className="editor-controls__group">
        <span className="editor-controls__label">tempo</span>
        <div className="editor-controls__actions">
          <button
            type="button"
            className="editor-controls__btn"
            disabled={disabled}
            onClick={() => onTempo(-5)}
          >
            -5
          </button>
          <span className="editor-controls__value">{tempo} BPM</span>
          <button
            type="button"
            className="editor-controls__btn"
            disabled={disabled}
            onClick={() => onTempo(5)}
          >
            +5
          </button>
        </div>
      </div>
    </section>
  );
}
