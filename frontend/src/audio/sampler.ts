/**
 * Instrument set: melody + chord voices (each swappable) + drums.
 *
 * Default voices:
 *   - melody: piano (Tone.Sampler with CDN samples)
 *   - chord pad: acoustic guitar (Tone.Sampler with CDN samples)
 *   - drums: built-in Tone synths (rock kit)
 *
 * Each layer can be swapped to a different instrument via `setMelodyVoice` /
 * `setChordVoice`. Swap is async — first use of a new instrument downloads
 * its samples (~10 small MP3s).
 */

import * as Tone from "tone";
import { makeVoice, type InstrumentId, type Voice } from "./instruments";

export interface Drums {
  kick: Tone.MembraneSynth;
  snare: Tone.NoiseSynth;
  hat: Tone.MetalSynth;
  dispose(): void;
}

export interface Instruments {
  melody: Voice;
  chordPad: Voice;
  drums: Drums;
  master: Tone.Gain;
  melodyId: InstrumentId;
  chordId: InstrumentId;
  setMelodyVoice(id: InstrumentId): Promise<void>;
  setChordVoice(id: InstrumentId): Promise<void>;
  dispose(): void;
}

export const DEFAULT_MELODY_INSTRUMENT: InstrumentId = "piano";
export const DEFAULT_CHORD_INSTRUMENT: InstrumentId = "acoustic-guitar";

export function loadInstruments(): Instruments {
  const master = new Tone.Gain(0.85).toDestination();

  let melody = makeVoice(DEFAULT_MELODY_INSTRUMENT);
  melody.connect(master);

  let chordPad = makeVoice(DEFAULT_CHORD_INSTRUMENT);
  chordPad.connect(master);

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

  const state: Instruments = {
    get melody() {
      return melody;
    },
    get chordPad() {
      return chordPad;
    },
    drums,
    master,
    melodyId: DEFAULT_MELODY_INSTRUMENT,
    chordId: DEFAULT_CHORD_INSTRUMENT,

    async setMelodyVoice(id: InstrumentId) {
      if (id === state.melodyId) return;
      const next = makeVoice(id);
      next.connect(master);
      try {
        await next.ready();
      } catch (err) {
        next.dispose();
        throw err;
      }
      melody.dispose();
      melody = next;
      state.melodyId = id;
    },

    async setChordVoice(id: InstrumentId) {
      if (id === state.chordId) return;
      const next = makeVoice(id);
      next.connect(master);
      try {
        await next.ready();
      } catch (err) {
        next.dispose();
        throw err;
      }
      chordPad.dispose();
      chordPad = next;
      state.chordId = id;
    },

    dispose() {
      melody.dispose();
      chordPad.dispose();
      drums.dispose();
      master.dispose();
    },
  };

  return state;
}

export async function unlockAudio(): Promise<void> {
  if (Tone.getContext().state !== "running") {
    await Tone.start();
  }
}
