/**
 * Instrument factory.
 *
 * MVP placeholder voices — Day 10 will swap these for real CC-licensed
 * samples behind the same `Instruments` shape.
 *
 * Voice choices:
 *   - melody:  Tone.PluckSynth — Karplus-Strong physical-modeling pluck.
 *              Closer to an acoustic guitar than a triangle-wave PolySynth.
 *   - chordPad: Tone.PolySynth(FMSynth) — soft sustained pad, separated
 *              from the melody so chord and lead don't blur into each other.
 *   - kick / snare / hat: standard Tone synth drums.
 *
 * Tone.start() must be called from a user gesture before any of these make
 * sound. The component layer is responsible for that.
 */

import * as Tone from "tone";

export interface Drums {
  kick: Tone.MembraneSynth;
  snare: Tone.NoiseSynth;
  hat: Tone.MetalSynth;
  dispose(): void;
}

export interface Instruments {
  /** Lead voice. Plays the user's hummed melody. */
  melody: Tone.PluckSynth;
  /** Soft pad layer for chord_progression. Separate voice so it doesn't
   *  collide with the melody. */
  chordPad: Tone.PolySynth;
  drums: Drums;
  master: Tone.Gain;
  dispose(): void;
}

export function loadInstruments(): Instruments {
  const master = new Tone.Gain(0.85).toDestination();

  // PluckSynth is monophonic and gives one bright pluck per triggerAttackRelease.
  // For a chord (multiple notes), the caller has to fire each note separately.
  const melody = new Tone.PluckSynth({
    attackNoise: 0.7,
    dampening: 4000,
    resonance: 0.92,
  }).connect(master);
  melody.volume.value = -4;

  const chordPad = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 1.2,
    modulationIndex: 2.5,
    oscillator: { type: "sine" },
    envelope: { attack: 0.18, decay: 0.4, sustain: 0.6, release: 1.4 },
    modulation: { type: "triangle" },
    modulationEnvelope: { attack: 0.2, decay: 0.4, sustain: 0.3, release: 1.0 },
  }).connect(master);
  chordPad.volume.value = -16;

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.6 },
  }).connect(master);

  const snare = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
  }).connect(master);
  snare.volume.value = -6;

  const hat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.07, release: 0.05 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  }).connect(master);
  hat.volume.value = -22;

  const drums: Drums = {
    kick,
    snare,
    hat,
    dispose() {
      kick.dispose();
      snare.dispose();
      hat.dispose();
    },
  };

  return {
    melody,
    chordPad,
    drums,
    master,
    dispose() {
      melody.dispose();
      chordPad.dispose();
      drums.dispose();
      master.dispose();
    },
  };
}

export async function unlockAudio(): Promise<void> {
  if (Tone.getContext().state !== "running") {
    await Tone.start();
  }
}
