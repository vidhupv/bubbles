/**
 * Offline render an Arrangement to a WAV blob.
 *
 * Two loops back-to-back at the arrangement tempo, plus a 200ms fade.
 * Plays melody on guitar (always), plus chord pad / drums when present.
 * Stereo, 44.1 kHz, 16-bit.
 */
import * as Tone from "tone";
import type { Arrangement } from "@shared/types";
import { midiToNoteName } from "./chord";
import { planEvents } from "./renderer";

const SAMPLE_RATE = 44_100;
const FADE_OUT_S = 0.2;
const LOOP_PASSES = 2;

export async function renderToWav(arrangement: Arrangement): Promise<Blob> {
  const { events, loopSeconds } = planEvents(arrangement);
  const totalSeconds = loopSeconds * LOOP_PASSES + FADE_OUT_S;

  const buffer = await Tone.Offline(
    ({ transport }) => {
      const master = new Tone.Gain(0.85).toDestination();
      const fade = new Tone.Gain(1).connect(master);
      fade.gain.setValueAtTime(1, totalSeconds - FADE_OUT_S);
      fade.gain.linearRampToValueAtTime(0, totalSeconds);

      const melody = new Tone.PluckSynth({
        attackNoise: 0.7,
        dampening: 4000,
        resonance: 0.92,
      }).connect(fade);
      melody.volume.value = -4;

      const chordPad = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 1.2,
        modulationIndex: 2.5,
        oscillator: { type: "sine" },
        envelope: { attack: 0.18, decay: 0.4, sustain: 0.6, release: 1.4 },
      }).connect(fade);
      chordPad.volume.value = -16;

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

      for (let pass = 0; pass < LOOP_PASSES; pass++) {
        for (const ev of events) {
          const time = pass * loopSeconds + ev.time;
          switch (ev.target) {
            case "kick":
              kick.triggerAttackRelease("C2", ev.duration, time, ev.velocity);
              break;
            case "snare":
              snare.triggerAttackRelease(ev.duration, time, ev.velocity);
              break;
            case "hat":
              hat.triggerAttackRelease("C5", ev.duration, time, ev.velocity);
              break;
            case "melody": {
              for (const midi of ev.notes) {
                melody.triggerAttackRelease(
                  midiToNoteName(midi),
                  ev.duration,
                  time,
                  ev.velocity,
                );
              }
              break;
            }
            case "chord-pad": {
              const names = ev.notes.map(midiToNoteName);
              chordPad.triggerAttackRelease(names, ev.duration, time, ev.velocity);
              break;
            }
          }
        }
      }

      transport.start();
    },
    totalSeconds,
    2,
  );

  return audioBufferToWav(buffer.get() as AudioBuffer);
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(buffer.numberOfChannels, 2);
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const total = 44 + dataSize;
  const ab = new ArrayBuffer(total);
  const view = new DataView(ab);

  writeString(view, 0, "RIFF");
  view.setUint32(4, total - 8, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
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
