"""Local arrangement library — taste memory for Hummingbird.

Stores saved arrangements at `~/.hummingbird/library.jsonl` (one JSON line per
song). Used for two things:

1. Show the user their accepted songs in a "library" panel.
2. Inform Claude's chord/drum choices by passing past accepted arrangements
   with similar melody features as in-context examples. This is the lite
   version of "personal music memory" described in GBRAIN.md — local file,
   no separate gbrain process yet, but the shape is right for swapping in
   gbrain later.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from pathlib import Path

from app.schemas import Arrangement

log = logging.getLogger(__name__)

_LIBRARY_DIR = Path.home() / ".hummingbird"
_LIBRARY_PATH = _LIBRARY_DIR / "library.jsonl"


def _ensure_dir() -> None:
    _LIBRARY_DIR.mkdir(parents=True, exist_ok=True)


def save(arrangement: Arrangement, title: str | None = None) -> dict:
    """Append an arrangement to the library."""
    _ensure_dir()
    entry = {
        "id": uuid.uuid4().hex[:12],
        "saved_at": time.time(),
        "title": title or _auto_title(arrangement),
        "arrangement": arrangement.model_dump(),
    }
    with _LIBRARY_PATH.open("a") as f:
        f.write(json.dumps(entry) + "\n")
    log.info("library.save: %s (%s)", entry["title"], entry["id"])
    return entry


def list_all() -> list[dict]:
    if not _LIBRARY_PATH.exists():
        return []
    out: list[dict] = []
    with _LIBRARY_PATH.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    # Newest first
    out.sort(key=lambda e: e.get("saved_at", 0), reverse=True)
    return out


def delete(entry_id: str) -> bool:
    if not _LIBRARY_PATH.exists():
        return False
    kept: list[str] = []
    removed = False
    with _LIBRARY_PATH.open() as f:
        for line in f:
            stripped = line.strip()
            if not stripped:
                continue
            try:
                obj = json.loads(stripped)
            except json.JSONDecodeError:
                continue
            if obj.get("id") == entry_id:
                removed = True
                continue
            kept.append(stripped)
    if removed:
        with _LIBRARY_PATH.open("w") as f:
            f.write("\n".join(kept) + ("\n" if kept else ""))
    return removed


def find_similar(
    key_tonic: str, key_mode: str, tempo: int, limit: int = 3
) -> list[dict]:
    """Find past arrangements in the same/adjacent key + similar tempo.

    Used as in-context examples for Claude when generating new chords or
    drums. The matching is intentionally simple — exact key match is best,
    same mode is second-best, anything else loses.
    """
    library = list_all()
    if not library:
        return []

    def score(entry: dict) -> float:
        arr = entry.get("arrangement", {})
        key = arr.get("key", {})
        tonic_match = key.get("tonic") == key_tonic
        mode_match = key.get("mode") == key_mode
        tempo_diff = abs(arr.get("tempo", 90) - tempo)
        return (
            (10.0 if tonic_match else 0.0)
            + (5.0 if mode_match else 0.0)
            - (tempo_diff / 20.0)
        )

    scored = [(score(e), e) for e in library]
    scored.sort(key=lambda x: x[0], reverse=True)
    # Only return entries that pass a minimum score floor — no point feeding
    # totally-unrelated examples to Claude.
    return [e for s, e in scored[:limit] if s > 0]


def _auto_title(arrangement: Arrangement) -> str:
    """Short evocative title from the arrangement's character."""
    parts = [arrangement.key.tonic, arrangement.key.mode]
    if arrangement.chord_progression:
        parts.append(arrangement.chord_progression[0])
    parts.append(f"{arrangement.tempo}bpm")
    return " · ".join(parts)
