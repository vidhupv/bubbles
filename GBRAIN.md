# Bubbles + gbrain — Integration Analysis

> User asked: is there a non-marginal way to integrate gbrain that could blow
> minds at the demo? Below is the result of thinking hard about this.

## What gbrain is (working assumption)

gbrain (github.com/garrytan/gbrain) is a local semantic search + code
knowledge tool that:

- Indexes a corpus locally (PGLite or Supabase backed).
- Exposes search/query APIs over that index (CLI + MCP server).
- Designed to be called as a tool by AI agents (Claude Code, etc.).
- The gstack ecosystem uses it to give Claude grounded retrieval over a
  codebase: `gbrain search`, `gbrain code-def`, etc.

The point of gbrain is **grounded recall for an LLM**. Anywhere a Claude-driven
flow needs to remember things that don't fit in context, gbrain is the answer.

## The bad ideas first (so we know what we're rejecting)

To not bury good ideas, I considered and discarded these:

1. **gbrain to help me code Bubbles.** Sure, useful for dev. Not a product
   feature. Skip.
2. **Index music theory textbooks.** Claude already knows music theory.
   Marginal lift. Skip.
3. **Index the Bubbles source code so the agent can reason about its own
   tools.** Cute for self-modifying behavior but Bubbles' agent doesn't have
   tool calls today — it does one structured-JSON response per turn. Adding
   tool-use just to add gbrain is putting the cart before the horse.
4. **Voice intent → gbrain → matching pre-built arrangement template.** A
   template library could live in a config file; gbrain is overkill.

## The good idea: **gbrain as personal music memory**

This is the demo-worthy integration. One sentence:

> Every hum you've ever made becomes a searchable fragment, so you can
> conversationally remix your own creative history.

### The demo (script)

User has been using Bubbles for a few weeks. Their gbrain index has ~50
arrangements: each one tagged with the hum's note contour, the agent's
rationale, the user's edits, and a short auto-generated description like
*"melancholy minor-key piano lead with sparse fingerpicked acoustic, 84 BPM,
felt like a rainy Sunday."*

Live demo:

1. **User hums** a 4-bar melody. Bubbles plays it back on piano.
2. **User speaks**, free-form, into the voice mic:
   *"This sounds kind of like that thing I made last week about my dog —
   what chords did I use on that one?"*
3. **Claude calls gbrain.search**(*query="dog song melancholy melody recent"*).
   Gets back the matching arrangement from 8 days ago. Surfaces the chord
   progression in the rationale: *"Last Tuesday you used Bm–G–D–F#m on the
   verse of 'dog song' — want me to try that here?"*
4. **User**: *"Yeah but make it more like the bridge from my coffee song —
   the one where I added that surprising minor 9th."*
5. **Claude calls gbrain.search** again, finds "coffee song", reads its
   bridge chord progression, applies the minor-9 substitution from there.
6. **User**: *"Now give it the drum pattern from that Thursday hip-hop thing
   I beatboxed."*
7. **gbrain.search** finds the Thursday session, returns its drum pattern,
   Claude swaps it in.
8. **User**: *"Perfect. Save this one as 'dog meets coffee, hip-hop drums.'"*
   New entry written to gbrain. The agent says: *"Saved. That's your 47th
   song this month. Want me to show you the others where you used i-VI?"*

The user just **stitched together a brand-new song from their own past
creative fragments by talking to it.** No DAW could do this. Suno cannot do
this. The reason it works: the AI has *persistent memory of you specifically*
that it can semantically retrieve.

### Why this isn't marginal

Three reasons it blows minds:

1. **It only works *because* of gbrain.** A naive implementation would dump
   every prior arrangement into the context window — broken at the 10th
   song. gbrain lets Claude pull just the relevant arrangements per turn,
   so the system scales to hundreds of past sessions without bloating
   latency or cost.

2. **It's the difference between "tool" and "instrument."** A tool you
   open, use, close. An instrument knows you — your taste, your tendencies,
   your history. After 50 sessions, Bubbles+gbrain is *your* instrument in a
   way Suno never can be.

3. **The "remix yesterday's stuff" demo is shareable on Twitter.** The
   first time someone sees Bubbles pull a chord progression from their own
   past hum by name, it's a real moment. That moment is the marketing.

### Beyond the obvious: what else gbrain unlocks

Three secondary wins that fall out of the same architecture:

- **Taste profiling.** gbrain accumulates everything you *accept* and
  everything you *reject* (the user removing a chord progression is a
  data point). Future generations bias toward your taste. The agent gets
  smarter on *you* specifically over time — exactly what the gstack ethos
  pushes ("welcome back" tiers).

- **Cross-song retrieval as composition.** Past arrangements become
  building blocks. "Play me something in the vibe of my November stuff but
  with the energy of my hackathon song" composes a brand-new arrangement
  from references the agent already understands.

- **Public corpus optionality.** Once the architecture works against the
  user's own arrangements, swapping in a public MIDI corpus (with proper
  licensing) gives the agent thousands of exemplar arrangements to ground
  its choices on. "Your hum sounds like the verse of [actual song] — here's
  what its progression does" becomes a real teaching moment.

## What it would take to ship

The integration is meaningful work but not insane. Phases:

### Phase 1: Local persistence (foundation)
- Arrangements need to survive page reload. Add a `~/.bubbles/sessions/`
  directory or IndexedDB store.
- Each saved arrangement: original hum audio (small webm), the
  Arrangement JSON, the rationale, a timestamp, an optional title.
- Auto-title generator: Claude takes the rationale + key/tempo/mood
  signals and produces a short evocative name ("dog song", "coffee bridge").
- Maybe 1-2 days.

### Phase 2: gbrain wiring
- gbrain CLI/server installed locally (via gstack ecosystem or direct).
- A small Python adapter on the backend that:
  - Indexes each saved arrangement when it's written (title + rationale +
    metadata as searchable text; hum-MIDI as structured payload).
  - Exposes a `search_arrangements(query)` Python function.
- ~1 day.

### Phase 3: Voice agent loop
- Today's voice mic does one-shot intent → refine. We need a real
  multi-turn dialogue mode.
- Claude Agent SDK gives us this for free — switch from
  `max_turns=1, allowed_tools=[]` to `max_turns=8, allowed_tools=[gbrain_search,
  apply_chord_progression, apply_drums, ...]`.
- The agent gets gbrain as a tool, plus a small set of arrangement
  mutators.
- UI: a dedicated "talk to bubbles" mode that keeps the mic open and
  shows a chat-like transcript.
- 2-3 days.

### Phase 4: Demo polish
- Auto-titling tuned for evocativeness, not accuracy.
- The "your 47th song this month" stats touch — gbrain trivially exposes
  counts.
- A small "history" panel that lists past arrangements you can click into.
- Half a day.

**Total estimate: ~1 week.** Real work, but the demo would be unique.

## What I'd build if you said go

1. Start with Phase 1 — local persistence. Without that, nothing else
   matters and it's the smallest, lowest-risk piece.
2. Title generator with a calibrated prompt — "evocative two-word name
   for a song that sounds like [rationale]." The titles are 80% of the
   demo charm.
3. Phase 2 — gbrain wiring against the persistence layer.
4. Phase 3 — voice agent mode, gated behind a single button so the
   current single-shot interaction still works.
5. Phase 4 — polish, then film a 60-second demo.

If you want to go in this direction, say the word and I'll start with
Phase 1. If you'd rather keep the current scope and ship a clean v0.4
first, that's also fine — gbrain is a v1.0 feature, not a v0.4 one.

## What I'd skip

If we don't do the personal-music-memory angle, **don't bother with gbrain
at all.** A code-search tool indexing a music app's codebase isn't a feature;
it's a dev tool. The integration is only mind-blowing in the personal-memory
direction, and adding gbrain for any lesser reason would be incidental
complexity for marginal value.
