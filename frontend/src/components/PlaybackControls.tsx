/**
 * Stop / replay control. Shown only when an arrangement is loaded.
 *
 * Stop: halts Tone.Transport and disposes the part.
 * Replay: restarts the same arrangement from the top.
 */

interface Props {
  playing: boolean;
  disabled: boolean;
  onStop(): void;
  onReplay(): void;
}

export function PlaybackControls({ playing, disabled, onStop, onReplay }: Props) {
  return (
    <div className="playback-controls">
      {playing ? (
        <button
          type="button"
          className="playback-btn"
          disabled={disabled}
          onClick={onStop}
          aria-label="Stop playback"
        >
          ■ stop
        </button>
      ) : (
        <button
          type="button"
          className="playback-btn"
          disabled={disabled}
          onClick={onReplay}
          aria-label="Replay arrangement"
        >
          ▶ replay
        </button>
      )}
    </div>
  );
}
