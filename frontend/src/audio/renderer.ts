/**
 * Schedule an Arrangement on Tone.Transport.
 *
 * Three layers, each opt-in EXCEPT melody:
 *   1. melody    — ALWAYS plays. User's hummed notes on the pluck synth at
 *                  their detected onset times.
 *   2. chord pad — only if chord_progression is non-empty. Sustained voicing
 *                  re-struck every half note as a soft strum on its own voice.
 *   3. drums     — only if drums layer is present.
 *
 * Pure layout in `planEvents()` is fully unit-tested. The Tone.js application
 * layer is `play()`.
 */

import * as Tone from "tone";
import type { Arrangement } from "@shared/types";
import { chordToMidi, midiToNoteName } from "./chord";
import { parsePattern } from "./pattern";
import type { Instruments } from "./sampler";

const BAR_STEPS = 16;
const TOTAL_BARS = 4;

export type Target = "kick" | "snare" | "hat" | "melody" | "chord-pad";

export interface PlannedEvent {
  time: number;
  target: Target;
  /** MIDI notes. Empty for snare. */
  notes: number[];
  velocity: number;
  duration: number;
}

interface PlanResult {
  events: PlannedEvent[];
  loopSeconds: number;
}

export function planEvents(arrangement: Arrangement): PlanResult {
  const stepSeconds = 60 / arrangement.tempo / 4;
  const barSeconds = BAR_STEPS * stepSeconds;
  const loopSeconds = TOTAL_BARS * barSeconds;

  const events: PlannedEvent[] = [];

  // 1. MELODY — always.
  for (const note of arrangement.melody) {
    const duration = Math.max(note.end - note.start, 0.12);
    events.push({
      time: note.start,
      target: "melody",
      notes: [note.midi],
      velocity: Math.max(note.velocity, 0.55),
      duration,
    });
  }

  // 2. CHORDS — opt-in. Use Claude's guitar.rhythm pattern so the strum
  // feel matches the agent's stated rhythmic intent. Falls back to a steady
  // eighth-note strum if no rhythm is set.
  if (arrangement.chord_progression.length > 0) {
    const chordMidis = arrangement.chord_progression.map(chordToMidi);
    const rhythmDsl = arrangement.guitar?.rhythm ?? "x.x.x.x.x.x.x.x.";
    let rhythmSteps;
    try {
      rhythmSteps = parsePattern(rhythmDsl);
    } catch {
      rhythmSteps = parsePattern("x.x.x.x.x.x.x.x.");
    }
    for (let bar = 0; bar < TOTAL_BARS; bar++) {
      const chord = chordMidis[bar % chordMidis.length];
      for (let i = 0; i < BAR_STEPS; i++) {
        const step = rhythmSteps[i];
        if (step.kind !== "hit") continue;
        events.push({
          time: bar * barSeconds + i * stepSeconds,
          target: "chord-pad",
          notes: chord,
          velocity: step.velocity * 0.7,
          duration: stepSeconds * 4, // ring for one beat
        });
      }
    }
  }

  // 3. DRUMS — opt-in.
  if (arrangement.drums) {
    const kickSteps = parsePattern(arrangement.drums.pattern.kick);
    const snareSteps = parsePattern(arrangement.drums.pattern.snare);
    const hatSteps = parsePattern(arrangement.drums.pattern.hat);
    for (let bar = 0; bar < TOTAL_BARS; bar++) {
      for (let i = 0; i < BAR_STEPS; i++) {
        const t = bar * barSeconds + i * stepSeconds;
        const k = kickSteps[i];
        if (k.kind === "hit") {
          events.push({ time: t, target: "kick", notes: [36], velocity: k.velocity, duration: stepSeconds });
        }
        const s = snareSteps[i];
        if (s.kind === "hit") {
          events.push({ time: t, target: "snare", notes: [], velocity: s.velocity, duration: stepSeconds });
        }
        const h = hatSteps[i];
        if (h.kind === "hit") {
          events.push({ time: t, target: "hat", notes: [72], velocity: h.velocity, duration: stepSeconds });
        }
      }
    }
  }

  events.sort((a, b) => a.time - b.time);
  return { events, loopSeconds };
}

export interface PlaybackHandle {
  stop(): void;
}

export interface PlayOptions {
  /** Keep Tone.Transport at its current position. Use this when swapping
   *  arrangements in-place (e.g. removing a layer) so the loop doesn't
   *  jump back to bar 1. */
  keepPosition?: boolean;
}

export function play(
  arrangement: Arrangement,
  instr: Instruments,
  options: PlayOptions = {},
): PlaybackHandle {
  const { events, loopSeconds } = planEvents(arrangement);

  if (!options.keepPosition) {
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    Tone.Transport.position = 0;
  } else {
    // Cancel only pending events, not the position.
    Tone.Transport.cancel(Tone.Transport.seconds);
  }
  Tone.Transport.bpm.value = arrangement.tempo;

  const part = new Tone.Part<PlannedEvent>((time, ev) => {
    fire(instr, ev, time);
  }, events);

  part.loop = true;
  part.loopEnd = loopSeconds;
  part.start(0);

  if (Tone.Transport.state !== "started") {
    Tone.Transport.start();
  }

  return {
    stop() {
      part.stop();
      part.dispose();
      Tone.Transport.stop();
      Tone.Transport.cancel(0);
    },
  };
}

function fire(instr: Instruments, ev: PlannedEvent, time: number): void {
  switch (ev.target) {
    case "kick":
      instr.drums.kick.triggerAttackRelease("C2", ev.duration, time, ev.velocity);
      return;
    case "snare":
      instr.drums.snare.triggerAttackRelease(ev.duration, time, ev.velocity);
      return;
    case "hat":
      instr.drums.hat.triggerAttackRelease("C5", ev.duration, time, ev.velocity);
      return;
    case "melody": {
      // Sampler-based voices handle chord arrays fine; PluckSynth is mono.
      // Hum melody is monophonic, but the array form works for both.
      const names = ev.notes.map(midiToNoteName);
      if (names.length === 1) {
        instr.melody.triggerAttackRelease(names[0], ev.duration, time, ev.velocity);
      } else {
        instr.melody.triggerAttackRelease(names, ev.duration, time, ev.velocity);
      }
      return;
    }
    case "chord-pad": {
      const names = ev.notes.map(midiToNoteName);
      instr.chordPad.triggerAttackRelease(names, ev.duration, time, ev.velocity);
      return;
    }
  }
}
