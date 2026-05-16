/**
 * Instrument factory.
 *
 * Day 2 ships with synthesized placeholders so we can hear sound today without
 * shipping audio fixtures. Day 10 swaps these for real CC-licensed samples
 * (Karoryfer / Freesound) via Tone.Sampler + an AudioBuffer cache; the public
 * shape returned here doesn't change.
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
  guitar: Tone.PolySynth;
  drums: Drums;
  master: Tone.Gain;
  dispose(): void;
}

/**
 * Build the instrument set and route everything through a master Gain node.
 * Idempotent at the module level — callers should hold on to the returned
 * object and call `dispose()` when tearing down.
 */
export function loadInstruments(): Instruments {
  const master = new Tone.Gain(0.85).toDestination();

  // Guitar: PluckSynth-flavored polysynth. Cheap, glassy, fine for Day 2.
  const guitar = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.2, release: 0.7 },
  }).connect(master);
  guitar.volume.value = -8;

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
    guitar,
    drums,
    master,
    dispose() {
      guitar.dispose();
      drums.dispose();
      master.dispose();
    },
  };
}

/** Resume the AudioContext if it's suspended. Must run inside a user gesture. */
export async function unlockAudio(): Promise<void> {
  if (Tone.getContext().state !== "running") {
    await Tone.start();
  }
}
