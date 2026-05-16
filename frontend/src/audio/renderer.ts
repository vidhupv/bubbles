/**
 * Schedule an Arrangement on Tone.Transport.
 *
 * Loop structure (4 bars total): bar i plays chord_progression[i], repeating
 * forever until stop(). Within each bar: guitar plays the 16-step rhythm
 * pattern against the current chord; drums play kick/snare/hat in parallel.
 *
 * The pure step → event mapping lives in `planEvents()` and is fully unit
 * tested; the Tone.js application layer is `play()`.
 */

import * as Tone from "tone";
import type { Arrangement } from "@shared/types";
import { chordToMidi, midiToNoteName } from "./chord";
import { parsePattern } from "./pattern";
import type { Instruments } from "./sampler";

const BAR_STEPS = 16;
const TOTAL_BARS = 4;
const TOTAL_STEPS = BAR_STEPS * TOTAL_BARS;

export type Target = "kick" | "snare" | "hat" | "guitar";

export interface PlannedEvent {
  step: number; // 0..63
  target: Target;
  /** MIDI note numbers — empty for drum hits that don't carry pitch (snare). */
  notes: number[];
  velocity: number;
}

/**
 * Pure transform: arrangement → ordered events. No Tone.js. No timing — the
 * caller schedules each `step` at the appropriate Transport position.
 */
export function planEvents(arrangement: Arrangement): PlannedEvent[] {
  const guitarSteps = parsePattern(arrangement.guitar.rhythm);
  const kickSteps = parsePattern(arrangement.drums.pattern.kick);
  const snareSteps = parsePattern(arrangement.drums.pattern.snare);
  const hatSteps = parsePattern(arrangement.drums.pattern.hat);

  const chordMidis = arrangement.chord_progression.map(chordToMidi);
  const events: PlannedEvent[] = [];

  for (let step = 0; step < TOTAL_STEPS; step++) {
    const bar = Math.floor(step / BAR_STEPS);
    const inBar = step % BAR_STEPS;
    const chord = chordMidis[bar % chordMidis.length];

    const kick = kickSteps[inBar];
    if (kick.kind === "hit") {
      events.push({ step, target: "kick", notes: [36], velocity: kick.velocity });
    }
    const snare = snareSteps[inBar];
    if (snare.kind === "hit") {
      events.push({ step, target: "snare", notes: [], velocity: snare.velocity });
    }
    const hat = hatSteps[inBar];
    if (hat.kind === "hit") {
      events.push({ step, target: "hat", notes: [72], velocity: hat.velocity });
    }
    const gtr = guitarSteps[inBar];
    if (gtr.kind === "hit") {
      events.push({ step, target: "guitar", notes: chord, velocity: gtr.velocity });
    }
  }

  return events;
}

export interface PlaybackHandle {
  stop(): void;
}

/**
 * Apply the planned events to Tone.js and start the Transport.
 *
 * Calling `play()` while a previous handle is alive is undefined behavior —
 * stop the old one first.
 */
export function play(arrangement: Arrangement, instr: Instruments): PlaybackHandle {
  const events = planEvents(arrangement);

  Tone.Transport.stop();
  Tone.Transport.cancel(0);
  Tone.Transport.position = 0;
  Tone.Transport.bpm.value = arrangement.tempo;

  // Tone.Part accepts {time, ...value} objects OR [time, value] tuples at
  // runtime. The TS types are stricter than the runtime — pass objects with
  // an inline `time` field to satisfy both.
  const scheduled = events.map((ev) => ({ time: `${ev.step}*16n`, ...ev }));
  const part = new Tone.Part<typeof scheduled[number]>((time, ev) => {
    fire(instr, ev, time);
  }, scheduled);

  part.loop = true;
  part.loopEnd = `${TOTAL_STEPS}*16n`;
  part.start(0);
  Tone.Transport.start();

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
      instr.drums.kick.triggerAttackRelease("C2", "16n", time, ev.velocity);
      return;
    case "snare":
      instr.drums.snare.triggerAttackRelease("16n", time, ev.velocity);
      return;
    case "hat":
      instr.drums.hat.triggerAttackRelease("C5", "16n", time, ev.velocity);
      return;
    case "guitar": {
      const notes = ev.notes.map(midiToNoteName);
      instr.guitar.triggerAttackRelease(notes, "8n", time, ev.velocity);
      return;
    }
  }
}
