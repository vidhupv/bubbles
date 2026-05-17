/**
 * Instrument presets.
 *
 * Each preset is either a sampled instrument (Tone.Sampler with CDN-hosted
 * sample files) or a procedural synth. The same `Voice` shape is exposed
 * either way so the renderer doesn't care which it gets.
 *
 * Samples come from nbrosowsky/tonejs-instruments — a community-maintained
 * pack of CC-licensed musical-instrument samples used by the Tone.js
 * community. First use of an instrument triggers a one-time download of
 * 6-10 small MP3s (cached by the browser thereafter).
 */
import * as Tone from "tone";

export type InstrumentId =
  | "piano"
  | "acoustic-guitar"
  | "electric-guitar"
  | "pluck"
  | "pad";

export interface InstrumentMeta {
  id: InstrumentId;
  label: string;
}

export const INSTRUMENTS: InstrumentMeta[] = [
  { id: "piano", label: "piano" },
  { id: "acoustic-guitar", label: "acoustic guitar" },
  { id: "electric-guitar", label: "electric guitar" },
  { id: "pluck", label: "pluck" },
  { id: "pad", label: "pad" },
];

/** Voice abstraction the renderer hands notes to. */
export interface Voice {
  triggerAttackRelease(
    notes: string | string[],
    duration: number,
    time: number,
    velocity: number,
  ): void;
  connect(destination: Tone.ToneAudioNode): void;
  dispose(): void;
  /** Resolves once samples (if any) have loaded. */
  ready(): Promise<void>;
}

const CDN = "https://nbrosowsky.github.io/tonejs-instruments/samples";

interface SamplerPreset {
  baseUrl: string;
  /** Tone.Sampler URL map. */
  urls: Record<string, string>;
  /** Master volume in dB. */
  volumeDb: number;
  release: number;
}

const SAMPLER_PRESETS: Partial<Record<InstrumentId, SamplerPreset>> = {
  piano: {
    baseUrl: `${CDN}/piano/`,
    urls: {
      A1: "A1.mp3",
      A2: "A2.mp3",
      A3: "A3.mp3",
      A4: "A4.mp3",
      A5: "A5.mp3",
      A6: "A6.mp3",
      C2: "C2.mp3",
      C3: "C3.mp3",
      C4: "C4.mp3",
      C5: "C5.mp3",
      C6: "C6.mp3",
      "D#2": "Ds2.mp3",
      "D#3": "Ds3.mp3",
      "D#4": "Ds4.mp3",
      "D#5": "Ds5.mp3",
      "F#2": "Fs2.mp3",
      "F#3": "Fs3.mp3",
      "F#4": "Fs4.mp3",
      "F#5": "Fs5.mp3",
    },
    volumeDb: -2,
    release: 1.2,
  },
  "acoustic-guitar": {
    baseUrl: `${CDN}/guitar-acoustic/`,
    urls: {
      A2: "A2.mp3",
      A3: "A3.mp3",
      A4: "A4.mp3",
      C3: "C3.mp3",
      C4: "C4.mp3",
      C5: "C5.mp3",
      D3: "D3.mp3",
      D4: "D4.mp3",
      D5: "D5.mp3",
      E2: "E2.mp3",
      E3: "E3.mp3",
      E4: "E4.mp3",
      "F#3": "Fs3.mp3",
      "F#4": "Fs4.mp3",
      G3: "G3.mp3",
      G4: "G4.mp3",
    },
    volumeDb: -4,
    release: 1.4,
  },
  "electric-guitar": {
    baseUrl: `${CDN}/guitar-electric/`,
    urls: {
      A2: "A2.mp3",
      A3: "A3.mp3",
      A4: "A4.mp3",
      C3: "C3.mp3",
      C4: "C4.mp3",
      C5: "C5.mp3",
      "D#3": "Ds3.mp3",
      "D#4": "Ds4.mp3",
      E2: "E2.mp3",
      "F#3": "Fs3.mp3",
      "F#4": "Fs4.mp3",
    },
    volumeDb: -6,
    release: 1.0,
  },
};

class SamplerVoice implements Voice {
  private sampler: Tone.Sampler;
  private loadedPromise: Promise<void>;

  constructor(preset: SamplerPreset) {
    let resolveLoaded!: () => void;
    let rejectLoaded!: (e: unknown) => void;
    this.loadedPromise = new Promise<void>((res, rej) => {
      resolveLoaded = res;
      rejectLoaded = rej;
    });

    this.sampler = new Tone.Sampler({
      urls: preset.urls,
      baseUrl: preset.baseUrl,
      release: preset.release,
      onload: () => resolveLoaded(),
      onerror: (err: unknown) => rejectLoaded(err),
    });
    this.sampler.volume.value = preset.volumeDb;
  }

  triggerAttackRelease(
    notes: string | string[],
    duration: number,
    time: number,
    velocity: number,
  ): void {
    this.sampler.triggerAttackRelease(notes, duration, time, velocity);
  }

  connect(destination: Tone.ToneAudioNode): void {
    this.sampler.connect(destination);
  }

  dispose(): void {
    this.sampler.dispose();
  }

  ready(): Promise<void> {
    return this.loadedPromise;
  }
}

class PluckVoice implements Voice {
  private synth: Tone.PluckSynth;

  constructor() {
    this.synth = new Tone.PluckSynth({
      attackNoise: 0.7,
      dampening: 4000,
      resonance: 0.92,
    });
    this.synth.volume.value = -4;
  }

  triggerAttackRelease(
    notes: string | string[],
    duration: number,
    time: number,
    velocity: number,
  ): void {
    const list = Array.isArray(notes) ? notes : [notes];
    for (const n of list) {
      this.synth.triggerAttackRelease(n, duration, time, velocity);
    }
  }
  connect(d: Tone.ToneAudioNode) { this.synth.connect(d); }
  dispose() { this.synth.dispose(); }
  ready() { return Promise.resolve(); }
}

class PadVoice implements Voice {
  private synth: Tone.PolySynth;
  constructor() {
    this.synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1.2,
      modulationIndex: 2.5,
      oscillator: { type: "sine" },
      envelope: { attack: 0.25, decay: 0.4, sustain: 0.6, release: 1.6 },
    });
    this.synth.volume.value = -14;
  }
  triggerAttackRelease(
    notes: string | string[],
    duration: number,
    time: number,
    velocity: number,
  ) {
    this.synth.triggerAttackRelease(notes, duration, time, velocity);
  }
  connect(d: Tone.ToneAudioNode) { this.synth.connect(d); }
  dispose() { this.synth.dispose(); }
  ready() { return Promise.resolve(); }
}

export function makeVoice(id: InstrumentId): Voice {
  const preset = SAMPLER_PRESETS[id];
  if (preset) return new SamplerVoice(preset);
  if (id === "pluck") return new PluckVoice();
  return new PadVoice();
}
