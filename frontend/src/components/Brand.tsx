/**
 * Top-left wordmark: hummingbird silhouette + lowercase wordmark.
 */

interface Props {
  size?: number;
}

export function Brand({ size = 32 }: Props) {
  return (
    <div className="brand">
      <HummingbirdMark size={size} />
      <span className="brand__text">hummingbird</span>
    </div>
  );
}

export function HummingbirdMark({ size = 32 }: Props) {
  return (
    <svg
      className="mark"
      width={size * 1.5}
      height={size}
      viewBox="0 0 84 56"
      fill="currentColor"
      aria-hidden="true"
    >
      {/* tail — small forked fan, behind body (left) */}
      <path d="M 11 26 L 0 19 L 9 27 Z" />
      <path d="M 10 30 L 0 30 L 10 32 Z" />
      <path d="M 11 34 L 0 41 L 9 33 Z" />

      {/* body — sleek horizontal tear-drop */}
      <path
        d="M 10 30
           C 10 22, 24 18, 36 20
           C 44 21, 50 24, 50 28
           C 50 32, 44 35, 36 36
           C 24 38, 10 38, 10 30 Z"
      />

      {/* beak — long needle extending right */}
      <path d="M 49 28 L 82 26.4 L 82 28 L 49 29.6 Z" />

      {/* eye — punched out */}
      <circle cx="43" cy="26.5" r="1.15" fill="var(--bg)" />

      {/* wing — sickle shape, sweeping up and back (left) like a hover pose */}
      <path
        d="M 26 22
           C 18 14, 10 6, 14 2
           C 22 6, 30 14, 32 22
           C 32 24, 28 24, 26 22 Z"
      />
    </svg>
  );
}
