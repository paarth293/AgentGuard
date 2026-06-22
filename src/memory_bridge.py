#!/usr/bin/env python3
"""
AgentGuard Memory Bridge
========================
CLI bridge between the AgentGuard VS Code extension and the TrueMemory
local SQLite database (~/.truememory/memories.db).

All output is JSON so TypeScript can parse it with JSON.parse().

Commands:
    warmup                             Pre-warm the embedding model (call on extension activate)
    add-memory <content> [<meta_json>] Store a session/checkpoint log
    add-directive <content>            Store a persistent coding rule (directive)
    delete-memory <id>                 Delete a memory by its integer DB id
    get-directives                     List all active directives stored by AgentGuard
    get-stats                          Return memory DB statistics
    recall [<query>]                   Return directives + recent sessions + semantic results

Usage (called by memory.ts via child_process.exec):
    python memory_bridge.py warmup
    python memory_bridge.py add-directive "Always use arrow functions"
    python memory_bridge.py add-memory "Refactored auth middleware" "{\"files\":[\"src/auth.ts\"]}"
    python memory_bridge.py get-directives
    python memory_bridge.py delete-memory 3
    python memory_bridge.py recall "coding preferences and recent sessions"
"""
from __future__ import annotations

import json
import sys
import os


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

AGENTGUARD_USER = "agentguard"


def out(data) -> None:
    """Print JSON result to stdout and flush."""
    print(json.dumps(data, default=str), flush=True)


def err(message: str, code: int = 1) -> None:
    """Print JSON error to stdout and exit."""
    out({"error": message})
    sys.exit(code)


def get_memory():
    """Load the TrueMemory Memory instance, creating the DB if needed."""
    try:
        from truememory import Memory  # type: ignore
        return Memory()
    except ImportError:
        err(
            "truememory package not found. "
            "Run: pip install -e 'C:/Users/paart/OneDrive/Desktop/TrueMemory'"
        )
    except Exception as e:
        err(f"Failed to initialise TrueMemory: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Commands
# ─────────────────────────────────────────────────────────────────────────────

def cmd_warmup(m) -> None:
    """Pre-warm the embedding model so the first real call is instant."""
    try:
        m.search("warmup ping", user_id=AGENTGUARD_USER, limit=1)
        out({"status": "ready", "db": str(m._engine.db_path)})
    except Exception as e:
        # Not fatal — model will warm on first real use
        out({"status": "ready", "note": str(e)})


def cmd_add_memory(m, argv) -> None:
    if len(argv) < 3:
        err("add-memory requires <content> and optionally <metadata_json>")
    content = argv[2]
    metadata: dict = {}
    if len(argv) > 3:
        try:
            metadata = json.loads(argv[3])
        except json.JSONDecodeError:
            pass  # ignore bad metadata
    result = m.add(content, user_id=AGENTGUARD_USER, metadata=metadata)
    out(result)


def cmd_add_directive(m, argv) -> None:
    if len(argv) < 3:
        err("add-directive requires <content>")
    content = argv[2]
    result = m.add(content, user_id=AGENTGUARD_USER, directive=True)
    out(result)


def cmd_delete_memory(m, argv) -> None:
    if len(argv) < 3:
        err("delete-memory requires <id>")
    try:
        memory_id = int(argv[2])
    except ValueError:
        err(f"id must be an integer, got: {argv[2]}")
    deleted = m.delete(memory_id)
    out({"deleted": deleted, "id": memory_id})


def cmd_get_directives(m) -> None:
    """Return all directives (rules) stored by AgentGuard."""
    m._engine._ensure_connection()
    cur = m._engine.conn.execute(
        """SELECT id, content, timestamp FROM messages
           WHERE directive = 1
             AND (sender = ? OR sender = 'user')
           ORDER BY timestamp DESC""",
        (AGENTGUARD_USER,),
    )
    rows = cur.fetchall()
    directives = [{"id": r[0], "content": r[1], "timestamp": r[2]} for r in rows]
    out(directives)


def cmd_get_stats(m) -> None:
    stats = m.stats()
    out(stats)


def cmd_recall(m, argv) -> None:
    """Return directives + recent session logs + semantic search results."""
    query = argv[2] if len(argv) > 2 else "coding preferences recent session history"

    # 1. Directives
    m._engine._ensure_connection()
    cur = m._engine.conn.execute(
        """SELECT id, content, timestamp FROM messages
           WHERE directive = 1
             AND (sender = ? OR sender = 'user')
           ORDER BY timestamp DESC""",
        (AGENTGUARD_USER,),
    )
    directives = [{"id": r[0], "content": r[1], "timestamp": r[2]} for r in cur.fetchall()]

    # 2. Recent non-directive session logs from AgentGuard
    cur2 = m._engine.conn.execute(
        """SELECT id, content, timestamp, metadata FROM messages
           WHERE directive = 0 AND sender = ?
           ORDER BY timestamp DESC LIMIT 5""",
        (AGENTGUARD_USER,),
    )
    sessions = []
    for r in cur2.fetchall():
        meta = {}
        try:
            meta = json.loads(r[3]) if r[3] else {}
        except Exception:
            pass
        sessions.append({"id": r[0], "content": r[1], "timestamp": r[2], "metadata": meta})

    # 3. Semantic search results
    search_results = []
    try:
        raw = m.search(query, user_id=AGENTGUARD_USER, limit=5)
        search_results = [
            {"id": r.get("id"), "content": r.get("content", ""), "score": r.get("score")}
            for r in raw
        ]
    except Exception:
        pass  # search is best-effort

    out({
        "directives": directives,
        "sessions": sessions,
        "search_results": search_results,
    })


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    if len(sys.argv) < 2:
        err("No command provided. Valid commands: warmup, add-memory, add-directive, "
            "delete-memory, get-directives, get-stats, recall")

    command = sys.argv[1]
    m = get_memory()

    dispatch = {
        "warmup": lambda: cmd_warmup(m),
        "add-memory": lambda: cmd_add_memory(m, sys.argv),
        "add-directive": lambda: cmd_add_directive(m, sys.argv),
        "delete-memory": lambda: cmd_delete_memory(m, sys.argv),
        "get-directives": lambda: cmd_get_directives(m),
        "get-stats": lambda: cmd_get_stats(m),
        "recall": lambda: cmd_recall(m, sys.argv),
    }

    handler = dispatch.get(command)
    if handler is None:
        err(f"Unknown command: '{command}'")

    try:
        handler()
    except Exception as e:
        err(str(e))


if __name__ == "__main__":
    main()
