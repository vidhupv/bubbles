# Bubbles

Hum a melody, get a song. AI-native music app, local-only prototype.

The agent listens to your hum, picks chord progressions and drum patterns that fit, and plays your melody back as a guitar lead over a generated arrangement. You refine it by speaking ("make it sadder") or tapping a vibe preset.

Two instruments only: guitar + drums.

## Stack

- **Frontend:** Vite + React + TypeScript on `localhost:3000`
- **Backend:** FastAPI + uv on `localhost:5001`
  - `POST /pitch` — Spotify's `basic-pitch` for hum → MIDI
  - `POST /arrange` — Claude Agent SDK for MIDI + intent → musical arrangement
- **Audio:** Tone.js + sampled guitar + drum kit

Design doc: `~/.gstack/projects/vidhupv-bubbles/vidhupv-main-design-20260516-145340.md`

## Local dev

```bash
# Backend (Python 3.11 via uv)
cd backend && uv sync && uv run uvicorn main:app --port 5001 --reload

# Frontend
cd frontend && pnpm install && pnpm dev
```

Then open `http://localhost:3000`.

## Status

Day 1 — backend scaffolding + basic-pitch endpoint.
