/**
 * 16-step pattern DSL parser.
 *
 * Spec (locked in the design doc):
 *   x = normal hit          (velocity 0.7)
 *   X = accent              (velocity 1.0)
 *   . = rest                (no event)
 *   o = ghost note          (velocity 0.3)
 *   - = sustain previous    (guitar only — repeats the last strike's chord)
 *
 * Patterns are exactly 16 steps. One bar at the arrangement's tempo, where
 * each step is a 16th note.
 */

export type StepEvent =
  | { kind: "rest" }
  | { kind: "hit"; velocity: number }
  | { kind: "sustain" };

const VELOCITIES: Record<string, number> = {
  x: 0.7,
  X: 1.0,
  o: 0.3,
};

export class PatternParseError extends Error {}

const PATTERN_LENGTH = 16;

/**
 * Parse a 16-character pattern string into an array of 16 StepEvents.
 * Throws on wrong length or unknown character.
 */
export function parsePattern(pattern: string): StepEvent[] {
  if (pattern.length !== PATTERN_LENGTH) {
    throw new PatternParseError(
      `Pattern must be exactly ${PATTERN_LENGTH} characters; got ${pattern.length}.`,
    );
  }

  return Array.from(pattern, (ch, idx) => {
    if (ch === ".") return { kind: "rest" as const };
    if (ch === "-") return { kind: "sustain" as const };
    const v = VELOCITIES[ch];
    if (v === undefined) {
      throw new PatternParseError(
        `Unknown pattern character ${JSON.stringify(ch)} at step ${idx}.`,
      );
    }
    return { kind: "hit" as const, velocity: v };
  });
}
