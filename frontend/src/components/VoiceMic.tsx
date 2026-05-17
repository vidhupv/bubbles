/**
 * "Refine by voice" — pill button toggle.
 *
 * First tap starts listening, button pulses red. Second tap sends the
 * transcript. Live transcript is shown by the parent below the button.
 */
import { Icon } from "./Icon";

interface Props {
  listening: boolean;
  supported: boolean;
  disabled: boolean;
  transcript: string;
  onToggle(): void;
}

export function VoiceMic({
  listening,
  supported,
  disabled,
  transcript,
  onToggle,
}: Props) {
  if (!supported) return null;

  return (
    <div className="voice-refine">
      <button
        type="button"
        className={`voice-btn ${listening ? "voice-btn--on" : ""}`}
        disabled={disabled}
        onClick={onToggle}
        aria-label={listening ? "Stop and send refinement" : "Refine by voice"}
      >
        <Icon name="mic" size={18} />
        <span>{listening ? "Listening — tap to send" : "Refine by voice"}</span>
      </button>
      {listening && transcript && (
        <div className="voice-transcript">"{transcript}"</div>
      )}
    </div>
  );
}
