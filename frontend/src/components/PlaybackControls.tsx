/**
 * Pill-style transport controls — pause/play + restart-from-top.
 *
 * Lives below the disc so the user always has an explicit handle on
 * playback, even when the disc-click is occupied by recording.
 */
import { Icon } from "./Icon";

interface Props {
  playing: boolean;
  paused: boolean;
  disabled: boolean;
  onPlayPause(): void;
  onRestart(): void;
}

export function PlaybackControls({
  playing,
  paused,
  disabled,
  onPlayPause,
  onRestart,
}: Props) {
  return (
    <div className="playback-bar" role="group" aria-label="Playback">
      <button
        type="button"
        className="playback-pill"
        disabled={disabled}
        onClick={onPlayPause}
        aria-label={playing ? "Pause" : "Play"}
      >
        <Icon name={playing ? "pause" : "play"} size={14} />
        <span>{playing ? "Pause" : paused ? "Resume" : "Play"}</span>
      </button>
      <button
        type="button"
        className="playback-pill playback-pill--ghost"
        disabled={disabled}
        onClick={onRestart}
        aria-label="Restart from top"
        title="Restart from top"
      >
        <Icon name="regen" size={14} />
      </button>
    </div>
  );
}
