# Bubbles

Hum a melody, get a song. AI-native music app, local-only prototype.

The agent listens to your hum, picks chord progressions and drum patterns that
fit, and plays your melody back as a guitar lead over a generated arrangement.
You refine it by speaking ("make it sadder") or tapping a vibe preset.

Two instruments only: guitar + drums. Desktop browser only for MVP.

## Stack

- **Frontend** — Vite + React + TypeScript on `localhost:3000`
- **Backend** — FastAPI + uv (Python 3.11) on `localhost:5001`
  - `POST /pitch` — Spotify's `basic-pitch` (CoreML) for hum → MIDI
  - `POST /arrange-from-hum` — combined: hum audio → MIDI → Claude → Arrangement
  - `POST /arrange` — refine an existing Arrangement with a voice intent
- **Audio** — Tone.js synthesis (real samples land in v1.1)
- **Agent** — Claude Agent SDK (uses your Claude Pro/Max subscription)

## Run locally

You need two terminals.

### Terminal 1 — backend

```bash
cd backend
uv sync                          # one-time
uv run uvicorn main:app --port 5001 --reload
```

The first `/pitch` request triggers basic-pitch's CoreML model load (~2 s).
After that, pitch detection is sub-second.

### Terminal 2 — frontend

```bash
cd frontend
pnpm install                     # one-time
pnpm dev
```

Then open **http://localhost:3000** in **Chrome on a laptop**.

### Claude auth

The Agent SDK rides your Claude Pro/Max subscription if `claude` CLI is logged
in (`claude login`). Otherwise set `ANTHROPIC_API_KEY` in the backend env.

If neither is configured, `/arrange-from-hum` falls back to a deterministic
A-minor placeholder so the rest of the app still demos — the rationale will
say "(Fallback — Claude Agent SDK isn't authenticated…)".

## How to use

1. **Press and hold** the big amber circle.
2. **Hum** any melody for at least 3 seconds.
3. **Release.** The blob shimmers while basic-pitch + Claude work (2–5 s).
4. A **song plays** — your melody as the guitar lead, with chords + drums.
5. **Refine** by tapping *sadder* / *heavier* / *simpler*, or hold the mic
   icon and speak a free-form intent ("make the drums punchier", "speed up").
6. **Export** the loop as a WAV via the corner link.

## Tests

```bash
# Backend (10 tests, ~3 s)
cd backend && uv run pytest tests/

# Frontend (28 tests, <1 s)
cd frontend && pnpm test

# Frontend typecheck
cd frontend && pnpm lint
```

## Design

The full design doc lives at
`~/.gstack/projects/vidhupv-bubbles/vidhupv-main-design-20260516-145340.md`
— produced by `/office-hours` and tightened through `/plan-eng-review`
and `/plan-design-review`.

Visual spec: warm dark (`#0F0E0D`), Fraunces display + JetBrains Mono for
rationale, single amber accent (`#D4892F`). Pulsing-blob hum button with
four motion states (idle breathe, recording-pulse, processing-shimmer,
beat-synced playback). Voice-first interaction; vibe-preset buttons for
the voice-shy.

## Status

Days 1–11 of the 14-day plan are shipped. Deferred:

- Day 6–7: Playwright E2E with mocked mic — contract tests already catch
  the most likely demo-killing failures (Claude JSON schema drift).
- Day 10: Real CC-licensed samples — placeholder synths fill the role; the
  sampler interface is ready for swap.
- Distribution / deploy / mobile — v1.1.
