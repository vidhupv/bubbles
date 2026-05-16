/**
 * Small push-to-talk mic icon for voice refinement.
 *
 * Press-and-hold to speak; release to send transcript. Visual state mirrors
 * the hum button's recording shimmer at smaller scale.
 */
interface Props {
  listening: boolean;
  supported: boolean;
  disabled: boolean;
  onPressDown(): void;
  onPressUp(): void;
}

export function VoiceMic({
  listening,
  supported,
  disabled,
  onPressDown,
  onPressUp,
}: Props) {
  if (!supported) return null;

  return (
    <button
      type="button"
      className={`voice-mic ${listening ? "voice-mic--on" : ""}`}
      aria-label="Press and hold to speak a refinement"
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled) onPressDown();
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        onPressUp();
      }}
      onPointerCancel={(e) => {
        e.preventDefault();
        onPressUp();
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 12a7 7 0 0 0 14 0" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    </button>
  );
}
