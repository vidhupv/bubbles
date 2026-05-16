"""Generate an Arrangement from a hummed melody using the Claude Agent SDK.

The SDK rides the user's Claude Pro/Max subscription (or falls back to
ANTHROPIC_API_KEY) — see the design doc. We use it as a single-turn LLM with
no tool calls, just structured JSON output.

If the SDK auth isn't configured or the model returns malformed JSON, we
return a sensible fallback arrangement so the prototype still demos. That
fallback is documented and intentional for the local-only dev flow.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    TextBlock,
    query,
)
from pydantic import ValidationError

from app.schemas import (
    Arrangement,
    DrumPattern,
    Drums,
    Guitar,
    Key,
    Note,
)

log = logging.getLogger(__name__)

# Single-turn, no tool calls. We just want structured JSON back.
_AGENT_OPTIONS = ClaudeAgentOptions(
    system_prompt=(
        "You are Bubbles, an AI session musician with strong musical taste. "
        "A user hums a melody and you reply with a complete arrangement of "
        "guitar + drums that plays under their hum.\n\n"
        "Hard rules:\n"
        "- Reply with ONLY a JSON object. No markdown fences, no commentary.\n"
        "- Schema:\n"
        "  {\n"
        '    "tempo": int 60-180,\n'
        '    "key": {"tonic": "A"|"B"|"C"|"D"|"E"|"F"|"G"|"A#"|"C#"|...,\n'
        '            "mode": "major"|"minor"|"dorian"|"mixolydian"},\n'
        '    "chord_progression": [4 chord symbols],\n'
        '    "guitar": {"voicing": "open-strum"|"power"|"fingerpick"|"muted-chuck",\n'
        '               "rhythm": "<16-step DSL>",\n'
        '               "sample_set": "acoustic"|"electric-clean"|"electric-dirty"},\n'
        '    "drums": {"kit": "rock"|"lofi",\n'
        '              "pattern": {"kick": "<16-step>",\n'
        '                          "snare": "<16-step>",\n'
        '                          "hat": "<16-step>"}},\n'
        '    "rationale": "1-3 plain English sentences explaining your choices"\n'
        "  }\n\n"
        "16-step DSL: x=normal hit, X=accent, o=ghost, .=rest, -=sustain.\n"
        "Each pattern must be exactly 16 characters.\n"
        "Each chord_progression entry is one chord symbol like 'Am' or 'G7'.\n"
        "Be decisive. Pick choices that fit the melody and the user's intent."
    ),
    allowed_tools=[],
    max_turns=1,
    permission_mode="bypassPermissions",
)


async def arrange_async(
    hum_notes: list[Note],
    intent: str | None,
    prior: Arrangement | None,
) -> Arrangement:
    """Call the Agent SDK; return a validated Arrangement.

    Falls back to a deterministic placeholder if the SDK is unauthenticated or
    returns malformed JSON twice in a row. This keeps the rest of the
    prototype working when the user runs without Claude auth.
    """
    user_msg = _build_user_message(hum_notes, intent, prior)

    for attempt in (1, 2):
        try:
            text = await _query_agent(user_msg)
            payload = _extract_json(text)
            return Arrangement.model_validate(payload)
        except (ValidationError, json.JSONDecodeError) as exc:
            log.warning("Arrange attempt %d failed validation: %s", attempt, exc)
            user_msg = (
                f"{user_msg}\n\nYour previous response was not valid against the "
                "schema. Reply with ONLY a JSON object matching the schema exactly."
            )
        except Exception as exc:  # noqa: BLE001 — log everything else, fall through
            log.warning("Arrange attempt %d failed: %s", attempt, exc)
            break

    log.warning("Falling back to deterministic placeholder arrangement.")
    return _fallback_arrangement(hum_notes)


async def _query_agent(prompt: str) -> str:
    """Run one turn through the Agent SDK and collect the text response."""
    chunks: list[str] = []
    async for message in query(prompt=prompt, options=_AGENT_OPTIONS):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    chunks.append(block.text)
    return "".join(chunks).strip()


def _build_user_message(
    notes: list[Note],
    intent: str | None,
    prior: Arrangement | None,
) -> str:
    """Compose the user-side prompt with hum notes + optional context."""
    note_summary = _summarize_notes(notes)
    parts: list[str] = [
        "Hum input:",
        note_summary,
    ]

    if prior is not None:
        parts.append("\nThe user already heard this arrangement:")
        parts.append(prior.model_dump_json(indent=2))

    if intent:
        parts.append(f'\nUser intent (free-form): "{intent}"')
        if prior is not None:
            parts.append(
                "Modify the prior arrangement to satisfy that intent. "
                "Preserve what still fits; change what doesn't. Keep the "
                "hummed melody as the guitar's lead line."
            )
        else:
            parts.append("Apply that intent to the arrangement you build.")
    else:
        parts.append("\nBuild a fresh arrangement with the hummed melody as the guitar lead.")

    parts.append("\nReply with ONLY a JSON object matching the schema.")
    return "\n".join(parts)


def _summarize_notes(notes: list[Note]) -> str:
    """Compact representation of hum notes for the prompt."""
    if not notes:
        return "(no clear notes detected)"
    lines = [
        f"  midi={n.midi} start={n.start:.2f}s end={n.end:.2f}s vel={n.velocity:.2f}"
        for n in notes[:24]
    ]
    if len(notes) > 24:
        lines.append(f"  ...and {len(notes) - 24} more notes")
    return "\n".join(lines)


_JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json(text: str) -> dict[str, Any]:
    """Pull the first JSON object out of the model's response.

    Claude usually obeys the 'only JSON' instruction, but sometimes wraps in
    code fences or adds a stray sentence. This is defensive.
    """
    text = text.strip()
    if text.startswith("```"):
        # Strip a leading code fence if present.
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].lstrip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = _JSON_BLOCK_RE.search(text)
        if not match:
            raise
        return json.loads(match.group(0))


def _fallback_arrangement(notes: list[Note]) -> Arrangement:
    """Deterministic placeholder when the Agent SDK is unavailable.

    Picks i-VI-III-VII in A minor with a simple rock backbeat. Good enough to
    keep the demo flowing while the user gets SDK auth sorted out.
    """
    tonic = "A"
    if notes:
        pitch_classes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
        # Most-common pitch class as tonic guess
        counts: dict[int, int] = {}
        for n in notes:
            counts[n.midi % 12] = counts.get(n.midi % 12, 0) + 1
        tonic_idx = max(counts, key=counts.get)
        tonic = pitch_classes[tonic_idx]

    return Arrangement(
        tempo=92,
        key=Key(tonic=tonic, mode="minor"),
        chord_progression=[f"{tonic}m", "F", "C", "G"],
        guitar=Guitar(
            voicing="open-strum",
            rhythm="x...x..xx...x..x",
            sample_set="electric-clean",
        ),
        drums=Drums(
            kit="rock",
            pattern=DrumPattern(
                kick="x.......x.......",
                snare="....X.......X...",
                hat="x.x.x.x.x.x.x.x.",
            ),
        ),
        rationale=(
            f"Set in {tonic} minor with a steady backbeat. (Fallback — Claude "
            "Agent SDK isn't authenticated; run `claude login` to get the real "
            "musical decisions.)"
        ),
    )


def arrange_sync(
    hum_notes: list[Note],
    intent: str | None,
    prior: Arrangement | None,
) -> Arrangement:
    """Sync wrapper so FastAPI handlers don't have to manage the event loop."""
    return asyncio.run(arrange_async(hum_notes, intent, prior))
