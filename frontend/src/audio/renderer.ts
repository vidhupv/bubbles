/**
 * Schedule an Arrangement on Tone.Transport.
 *
 * Three layers, each opt-in EXCEPT the melody:
 *   1. melody  — ALWAYS plays. The user's hummed notes on guitar, at their
 *                detected onset times.
 *   2. chords  — only if chord_progression is non-empty. Soft sustained
 *                voicing once per bar, layered under the melody.
 *   3. drums   — only if drums is present.
 *
 * The pure layout (Arrangement → list of PlannedEvents) lives in
 * `planEvents()` and is fully unit-tested. The Tone.js application layer is
 * `play()`.
 */

import * as Tone from "tone";
import type { Arrangement, Note } from "@shared/types";
import { chordToMidi, midiToNoteName } from "./chord";
import { parsePattern } from "./pattern";
import type { Instruments } from "./sampler";

const BAR_STEPS = 16;
const TOTAL_BARS = 4;

export type Target = "kick" | "snare" | "hat" | "guitar" | "chord-pad";

export interface PlannedEvent {
  /** Time in seconds from loop start. */
  time: number;
  target: Target;
  /** MIDI notes. Empty for snare. */
  notes: number[];
  velocity: number;
  /** Duration in seconds. Used for guitar/chord notes. */
  duration: number;
}

interface PlanResult {
  events: PlannedEvent[];
  /** Loop length in seconds (for Tone.Part loopEnd). */
  loopSeconds: number;
}

/** Pure transform: arrangement → ordered events. No Tone.js. */
export function planEvents(arrangement: Arrangement): PlanResult {
  const stepSeconds = 60 / arrangement.tempo / 4; // 16th notes
  const barSeconds = BAR_STEPS * stepSeconds;
  const loopSeconds = TOTAL_BARS * barSeconds;

  const events: PlannedEvent[] = [];

  // 1. MELODY — always. Play the user's notes at their original times.
  for (const note of arrangement.melody) {
    const duration = Math.max(note.end - note.start, 0.08);
    events.push({
      time: note.start,
      target: "guitar",
      notes: [note.midi],
      velocity: Math.max(note.velocity, 0.5),
      duration,
    });
  }

  // 2. CHORDS — optional. One sustained chord per bar.
  if (arrangement.chord_progression.length > 0) {
    const chordMidis = arrangement.chord_progression.map(chordToMidi);
    for (let bar = 0; bar < TOTAL_BARS; bar++) {
      const chord = chordMidis[bar % chordMidis.length];
      events.push({
        time: bar * barSeconds,
        target: "chord-pad",
        notes: chord,
        velocity: 0.35,
        duration: barSeconds * 0.95,
      });
    }
  }

  // 3. DRUMS — optional. 16-step patterns repeated each bar.
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

/** Apply planned events to Tone.js and start the Transport. */
export function play(arrangement: Arrangement, instr: Instruments): PlaybackHandle {
  const { events, loopSeconds } = planEvents(arrangement);

  Tone.Transport.stop();
  Tone.Transport.cancel(0);
  Tone.Transport.position = 0;
  Tone.Transport.bpm.value = arrangement.tempo;

  // Tone.Part requires a `time` field on each event; PlannedEvent already
  // has one, so we hand the list over directly.
  const part = new Tone.Part<PlannedEvent>((time, ev) => {
    fire(instr, ev, time);
  }, events);

  part.loop = true;
  part.loopEnd = loopSeconds;
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
      instr.drums.kick.triggerAttackRelease("C2", ev.duration, time, ev.velocity);
      return;
    case "snare":
      instr.drums.snare.triggerAttackRelease(ev.duration, time, ev.velocity);
      return;
    case "hat":
      instr.drums.hat.triggerAttackRelease("C5", ev.duration, time, ev.velocity);
      return;
    case "guitar": {
      const names = ev.notes.map(midiToNoteName);
      instr.guitar.triggerAttackRelease(names, ev.duration, time, ev.velocity);
      return;
    }
    case "chord-pad": {
      const names = ev.notes.map(midiToNoteName);
      instr.guitar.triggerAttackRelease(names, ev.duration, time, ev.velocity);
      return;
    }
  }
}

// Re-export for tests that previously imported these.
export type { Note };
