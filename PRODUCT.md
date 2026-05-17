# Bubbles — Product Spec for UI Design

> Paste this into Claude (or any design tool) to generate a fresh UI direction.
> Everything below is the current state of the working prototype — features,
> interactions, screen states, copy. The current UI is intentionally minimal
> (one big circle + a layers panel). We want to explore richer layouts.

## What Bubbles is

**Bubbles is an AI-native music app where you hum a melody and the agent turns
it into a song.** Voice-first, browser-only, designed for non-musicians who
have tunes in their head but can't play an instrument.

The core magic: you hum, the app hears your *actual notes* and plays them back
as a real instrument. From there, you progressively layer in chords, drums,
or change instruments — by clicking, by speaking, or by beatboxing the drums
yourself.

The competition (Suno, Udio) is one-shot prompt-to-song with no control.
GarageBand is a flight deck you have to learn for 6 months. Bubbles is the
middle: the user supplies the melody and intent; the AI handles the rest.

## User flow

1. **Hum.** The user presses and holds a large central button, hums for at
   least 1.5 seconds, then releases.
2. **Hear the melody back.** Within ~2 seconds the app plays back the exact
   notes that were detected on a piano voice.
3. **Layer.** A "Layers" panel appears with three rows: melody (always),
   chords (empty by default), drums (empty by default). The user can:
   - Add chords (AI picks a 4-chord progression that fits).
   - Add drums (AI picks a pattern *or* the user beatboxes their own pattern
     and the backend converts the onsets to kick/snare/hat).
   - Pick the instrument for each layer (piano, acoustic guitar, electric
     guitar, pluck synth, pad).
   - Regenerate any individual layer (Claude rolls a new chord progression /
     drum pattern, keeps everything else).
   - Remove any layer (just turns it off — no Claude call).
4. **Refine by voice.** A small mic icon next to the layers — press and hold,
   speak a free-form intent ("make it sadder", "double-time the drums",
   "change the third chord to a minor seven"), release. Claude updates the
   arrangement.
5. **Replay or stop.** Stop button halts playback. Replay restarts the same
   loop. Pressing the big hum button again starts a fresh recording.
6. **Export.** A corner link downloads the current arrangement as a 60-second
   WAV (two 4-bar loops + 200 ms fade).

## Audience and target context

- **Primary user**: someone who hums in the shower, has song ideas they can't
  realize, doesn't know music theory, isn't going to learn a DAW.
- **Form factor**: desktop browser. Mobile shows a "use a laptop" fallback
  page (mic + Web Audio quirks make mobile a real engineering project; v1.1).
- **Vibe**: instrument, not dashboard. Closer to an Ableton Push pad or a
  Teenage Engineering OP-1 than a SaaS card grid. Voice-first means the UI
  should disappear once you know how to use it.

## Buttons & interactive elements

A complete list of every interactive thing in the app right now, with the
intended behavior:

### Hero — the hum button
- **Big amber circle**, ~360 px diameter, centered.
- **Press-and-hold to record.** Release to send.
- **Four motion states:**
  - *Idle*: slow breathe (scale 0.96 ↔ 1.02 over ~3 s).
  - *Recording*: tight pulse synced to live audio peaks from the mic.
  - *Processing*: irregular shimmer + slight color shift while pitch
    detection + Claude run (~1-3 s).
  - *Playing*: beat-synced pulse driven off Tone.Transport.
  - *Denied*: small X overlay, red tint. Click to re-request mic permission.

### Microcopy line (below the hum button)
A single italic line that swaps based on phase:
- `Press and hold. Hum any melody.` (idle)
- `Listening…` (recording)
- `Hearing your hum.` (processing initial)
- `Bubbles is thinking.` (processing refine)
- `Reading your drums.` (processing drum hum)
- `Stopped. Replay or hum again.` (stopped)
- `Mic blocked — click to retry.` (permission denied)
- `Hum a bit longer — at least 1.5 seconds.` (error: too short)

### Rationale chat bubble (below microcopy, after first hum)
- Monospace text, type-on character animation at ~30 chars/sec, blinking
  cursor while streaming.
- Shows the agent's 1-2 sentence explanation: *"I went with i-VI-III-VII
  because your melody outlined A minor pentatonic. Drums kept simple to let
  the guitar breathe."*

### Playback controls
- **■ stop** when playing → halts the loop.
- **▶ replay** when stopped → restarts the loop from the top.

### Layers panel
Three rows, each showing a layer's status. Each row contains:
- Status dot (●/○): filled = present, hollow = empty.
- Layer name (lowercase): `melody` / `chords` / `drums`.
- Detail (mono): for melody → `7 notes · A minor · A2–B3`; for chords →
  `Am · F · C · G`; for drums → `rock kit`.
- Instrument picker (melody and chords): small native `<select>` dropdown.
  Options: `piano` (default melody), `acoustic guitar` (default chords),
  `electric guitar`, `pluck`, `pad`. Loading state shows `·loading` next to
  the select while samples download (one-time, ~6 small MP3s).
- Actions on the right side of each row:
  - **Melody**: no actions (the user's hum is the source of truth — they
    can't remove or regenerate it, only change its instrument).
  - **Chords (empty)**: `+ add` button (calls Claude).
  - **Chords (present)**: `↻` regenerate (calls Claude) and `×` remove
    (client-side, no Claude call).
  - **Drums (empty)**: `+ AI` (Claude picks) and `◉ hum` (press-and-hold to
    beatbox a pattern; backend uses librosa to detect onsets and classify
    them as kick/snare/hat by spectral centroid).
  - **Drums (present)**: `↻` regenerate (AI), `◉` hum-record-replace,
    `×` remove.

### Voice mic
Small mic icon below the layers. Press-and-hold to speak a refinement intent;
release to send. Uses Web Speech API for STT. The transcript appears as a
tiny line below while listening.

### Notes debug panel
A collapsible diagnostic showing exactly what basic-pitch detected:
- Header: `▸ 7 notes detected · A minor · 92 BPM`
- Expanded: a 3-column list of each note with its onset time, pitch name
  (`C4`, `D#4`, etc.), and duration.
Used to debug when pitch detection feels wrong — the user can see whether
the issue is upstream (pitch detection missed notes) or downstream (Claude
made odd choices given correct notes).

### Brand mark
Top-left corner: small "bubbles" wordmark in editorial typeface.

### Export link
Bottom-right corner: `export.wav` text link in accent color, italic. Visible
only after an arrangement exists. Click → 60-second WAV download.

### Placeholder note
Small italic line at the bottom of the controls: "Drum sounds are still
synth placeholders. Real drum samples land in v1.1." Honest about current
limitations so the user knows what's a bug vs a known gap.

## Screens / states

The app has effectively one screen with two major states.

### A) Empty state (first load, no arrangement yet)
Just the hum button centered vertically, brand mark in corner, microcopy
beneath the button saying `Press and hold. Hum any melody.` Nothing else.
Maximum focus on the one action that matters.

### B) Active arrangement
Hum button shrinks ~22 % (`--hum-scale: 0.78`) and shifts up. Below it:
microcopy → rationale chat → playback controls → layers panel → voice mic
→ notes debug → placeholder note. Export link appears in the corner.

### C) Mobile fallback
≤768 px viewport shows a centered "Bubbles needs a laptop for now" message
with the brand mark and no interactive elements. Voice-first interaction
on mobile is a real engineering project; deferred to v1.1.

## Visual design tokens (current)

- **Background**: `#0F0E0D` (warm off-black).
- **Foreground**: `#F4F0EA` (bone white).
- **Accent**: `#D4892F` (warm amber). One accent only.
- **Danger / denied**: `#C8553D` (rust red).
- **Display font**: Fraunces (Google Fonts) — editorial serif with strong
  italic. Used for headings and microcopy.
- **Mono font**: JetBrains Mono — used for rationale chat (typed feel),
  layer details, and the instrument picker.
- **Motion**: ease-out `cubic-bezier(0.16, 1, 0.3, 1)`, ease-in
  `cubic-bezier(0.6, 0, 1, 0.4)`. Idle blob breathe = 3.4 s. Type-on cursor
  blink = 1.05 s.
- **Spacing scale**: 0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 3 / 4 rem.

## Open design questions

These are real product/UX gaps where a designer's input would matter most:

1. **Empty state is currently boring.** It's just a button with no context.
   A first-time user has no idea what this app is. Is there a non-text way
   to telegraph "hum into the button → song" without violating the
   voice-first minimalism?
2. **Rationale bubble + layers + voice mic + notes debug** are stacking
   vertically into a long-scrolling page. Probably want a 2-column or
   tabbed layout once the arrangement is live.
3. **Drum hum vs AI drum** is currently two side-by-side buttons. Probably
   wants a single "drum" affordance with a mode toggle.
4. **No way to see the song structure.** A piano-roll-like timeline of the
   melody + chord changes + drum hits would help the user understand what's
   happening. But that risks turning Bubbles into a DAW. Where's the line?
5. **Instrument picker is a native `<select>`.** Functional but ugly.
   A custom popover with tiny instrument illustrations would feel much more
   instrument-like.
6. **No mute per layer.** You can remove a layer, but you can't temporarily
   silence one. Probably want mute toggles per row.
7. **Export is buried in a corner.** Once the user has a song they love,
   sharing/exporting should feel celebratory, not nearly-hidden.

## What we want from the design pass

- A layout that scales gracefully from empty state to full arrangement
  without large dead space (current build has a regression there).
- A treatment for the layers panel that feels instrument-like — buttons,
  knobs, cards, *something* — rather than a flat table of rows.
- Empty-state copy/iconography that explains the magic in <3 seconds.
- A celebratory export moment.
- Visual hierarchy that makes the rationale chat feel like a conversation,
  not a status bar.

Keep the warm dark mode and the amber accent. Editorial type can stay or
be replaced. The pulsing-blob hum button is sacred — it's the brand.

## Tech context (for designers who care)

- React + Vite frontend, plain CSS (no Tailwind, no styled-components).
- Tone.js for audio scheduling. Tone.Sampler loads real instrument samples
  from a CDN at runtime (one-time download, ~10 small MP3s per instrument).
- Python FastAPI backend on `localhost:5001`. Pitch detection via
  Spotify's `basic-pitch` (CoreML on Apple Silicon). Drum detection via
  `librosa.onset.onset_detect` + spectral centroid classification.
- Arrangement generation via Claude Agent SDK (rides the user's Claude
  Pro/Max subscription, no API key needed for the local dev flow).
- Desktop-only MVP. Local-only — no deploy, no auth, no save state.
