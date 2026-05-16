/**
 * Three text-button vibe presets for users who don't want to speak.
 *
 * Plain Fraunces italic words, underlined, accent on hover. Each maps to a
 * pre-formed free-form intent the backend sends straight to Claude.
 */
import type { ReactNode } from "react";

interface Props {
  disabled: boolean;
  onPick(intent: string): void;
}

const PRESETS: Array<{ label: ReactNode; intent: string }> = [
  { label: "sadder", intent: "make it sadder" },
  { label: "heavier", intent: "make it heavier" },
  { label: "simpler", intent: "make it simpler" },
];

export function VibePresets({ disabled, onPick }: Props) {
  return (
    <div className="vibe-presets" role="group" aria-label="Refinement presets">
      {PRESETS.map((p) => (
        <button
          key={p.intent}
          type="button"
          className="vibe"
          disabled={disabled}
          onClick={() => onPick(p.intent)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
