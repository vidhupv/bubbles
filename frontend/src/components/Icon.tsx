/**
 * Inline 24×24 stroke icons. 1.5 stroke, round caps/joins, currentColor.
 */

export type IconName =
  | "play"
  | "pause"
  | "stop"
  | "record"
  | "regen"
  | "x"
  | "plus"
  | "mic"
  | "caret"
  | "download"
  | "check";

interface Props {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 18, className = "" }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (name) {
    case "play":
      return (
        <svg {...common}>
          <polygon points="7,5 19,12 7,19" fill="currentColor" stroke="none" />
        </svg>
      );
    case "pause":
      return (
        <svg {...common}>
          <rect x="6" y="5" width="4" height="14" rx="0.5" fill="currentColor" stroke="none" />
          <rect x="14" y="5" width="4" height="14" rx="0.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "stop":
      return (
        <svg {...common}>
          <rect x="6" y="6" width="12" height="12" rx="0.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "record":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "regen":
      return (
        <svg {...common}>
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <polyline points="21 4 21 9 16 9" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
    case "mic":
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <line x1="12" y1="18" x2="12" y2="21" />
        </svg>
      );
    case "caret":
      return (
        <svg {...common}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M12 4v12" />
          <polyline points="7 11 12 16 17 11" />
          <line x1="5" y1="20" x2="19" y2="20" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <polyline points="4 12 10 18 20 6" />
        </svg>
      );
  }
}
