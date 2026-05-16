/**
 * Offline render an Arrangement to a WAV blob.
 *
 * Two 4-bar loops back-to-back at the arrangement tempo. Stereo, 44.1 kHz,
 * 16-bit. Adds a 200 ms fade-out at the tail so the file doesn't end on a
 * cliff. The instruments are re-instantiated inside the offline context —
 * Tone.Offline gives us a sandboxed render that doesn't touch the live audio
 * graph.
 */
import * as Tone from "tone";
import type { Arrangement } from "@shared/types";
import { midiToNoteName } from "./chord";
import { planEvents } from "./renderer";

const SAMPLE_RATE = 44_100;
const FADE_OUT_S = 0.2;

export async function renderToWav(arrangement: Arrangement): Promise<Blob> {
  // 64 steps × (60 / bpm / 4) seconds per step → one loop duration.
  // Two loops back-to-back + fade.
  const stepSeconds = 60 / arrangement.tempo / 4;
  const loopSeconds = 64 * stepSeconds;
  const totalSeconds = loopSeconds * 2 + FADE_OUT_S;

  const events = planEvents(arrangement);

  const buffer = await Tone.Offline(({ transport }) => {
    const master = new Tone.Gain(0.85).toDestination();
    const fade = new Tone.Gain(1).connect(master);
    // Fade-out near the end
    fade.gain.setValueAtTime(1, totalSeconds - FADE_OUT_S);
    fade.gain.linearRampToValueAtTime(0, totalSeconds);

    const guitar = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0.2, release: 0.7 },
    }).connect(fade);
    guitar.volume.value = -8;

    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.6 },
    }).connect(fade);

    const snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
    }).connect(fade);
    snare.volume.value = -6;

    const hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.07, release: 0.05 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }).connect(fade);
    hat.volume.value = -22;

    transport.bpm.value = arrangement.tempo;

    // Two passes: bar 0..3 and bar 4..7 (which loop back to chord 0..3).
    for (let pass = 0; pass < 2; pass++) {
      for (const ev of events) {
        const time = pass * loopSeconds + ev.step * stepSeconds;
        switch (ev.target) {
          case "kick":
            kick.triggerAttackRelease("C2", "16n", time, ev.velocity);
            break;
          case "snare":
            snare.triggerAttackRelease("16n", time, ev.velocity);
            break;
          case "hat":
            hat.triggerAttackRelease("C5", "16n", time, ev.velocity);
            break;
          case "guitar": {
            const notes = ev.notes.map(midiToNoteName);
            guitar.triggerAttackRelease(notes, "8n", time, ev.velocity);
            break;
          }
        }
      }
    }

    transport.start();
  }, totalSeconds, 2);

  return audioBufferToWav(buffer.get() as AudioBuffer);
}

/** Encode an AudioBuffer to a 16-bit PCM stereo WAV. */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(buffer.numberOfChannels, 2);
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const total = 44 + dataSize;
  const ab = new ArrayBuffer(total);
  const view = new DataView(ab);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, total - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Channel data (interleaved)
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      let s = channels[c][i];
      s = Math.max(-1, Math.min(1, s));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([ab], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
