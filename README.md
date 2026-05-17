# Bubbles

Hum a melody, get a song. AI-native music app, local-only prototype.

See [PRODUCT.md](./PRODUCT.md) for the full feature spec.

## Setup

You need `uv`, `pnpm`, and `claude` CLI authenticated (for the Claude Agent SDK).

```bash
cd backend && uv sync && cd ..
cd frontend && pnpm install && cd ..
```

## Run

Two terminals.

```bash
# Terminal 1
cd backend && uv run uvicorn main:app --port 5001 --reload

# Terminal 2
cd frontend && pnpm dev
```

Open **http://localhost:3000** in Chrome (desktop). Press-and-hold the amber
circle, hum for 1.5 s+, release.

## Test

```bash
cd backend && uv run pytest       # 15+ tests
cd frontend && pnpm test          # 35 tests
cd frontend && pnpm lint          # typecheck
```
