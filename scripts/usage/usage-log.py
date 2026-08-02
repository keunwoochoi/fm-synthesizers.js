#!/usr/bin/env python3
"""Usage log for the fm-synthesizers.js build.

Owner-requested (2026-08-02): record how much token budget this sibling cost to
build, how many times the owner and the agent exchanged messages, the model, and
the opencode version -- so the build has a number attached to it rather than a
memory.

Reads the opencode session database at ~/.local/share/opencode/opencode.db.

    python3 scripts/usage/usage-log.py                # current session, human text
    python3 scripts/usage/usage-log.py --json         # machine-readable
    python3 scripts/usage/usage-log.py --session ID   # a specific session

This is a reporting tool, never a gate. If the database or session is missing,
exit non-zero with a plain message.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from pathlib import Path

DB_PATH = Path.home() / ".local/share/opencode/opencode.db"


def default_session_id(here: str, db: sqlite3.Connection) -> str | None:
    """Most recently updated session whose directory covers this repo (or its
    parent), falling back to the newest session overall."""
    env = os.environ.get("OPENCODE_SESSION_ID")
    if env:
        return env
    rows = db.execute(
        "SELECT id, directory FROM session ORDER BY time_updated DESC LIMIT 50"
    ).fetchall()
    for sid, directory in rows:
        if directory and (here.startswith(directory) or directory.startswith(here)):
            return sid
    return rows[0][0] if rows else None


def query(session_id: str, db: sqlite3.Connection) -> dict:
    row = db.execute("SELECT * FROM session WHERE id = ?", (session_id,)).fetchone()
    if row is None:
        raise ValueError(f"session {session_id} not found in {DB_PATH}")
    cols = [d[0] for d in db.execute("SELECT * FROM session").description]
    s = dict(zip(cols, row))

    user = db.execute(
        "SELECT count(*) FROM message WHERE session_id = ? "
        "AND json_extract(data, '$.role') = 'user'",
        (session_id,),
    ).fetchone()[0]
    agent = db.execute(
        "SELECT count(*) FROM message WHERE session_id = ? "
        "AND json_extract(data, '$.role') = 'assistant'",
        (session_id,),
    ).fetchone()[0]
    tools = db.execute(
        "SELECT count(*) FROM part WHERE session_id = ? "
        "AND json_extract(data, '$.type') = 'tool'",
        (session_id,),
    ).fetchone()[0]

    try:
        model = json.loads(s["model"] or "{}")
        model_label = f"{model['id']} ({model['providerID']})" if model.get("id") else "unknown"
    except json.JSONDecodeError:
        model_label = "unknown"

    return {
        "sessionId": s["id"],
        "title": s["title"],
        "directory": s["directory"],
        "created": __import__("datetime").datetime.fromtimestamp(
            s["time_created"] / 1000).isoformat(),
        "updated": __import__("datetime").datetime.fromtimestamp(
            s["time_updated"] / 1000).isoformat(),
        "opencodeVersion": s["version"],
        "model": model_label,
        "costUsd": s["cost"] or 0,
        "tokensInput": s["tokens_input"] or 0,
        "tokensOutput": s["tokens_output"] or 0,
        "tokensReasoning": s["tokens_reasoning"] or 0,
        "tokensCacheRead": s["tokens_cache_read"] or 0,
        "tokensCacheWrite": s["tokens_cache_write"] or 0,
        "messages": {"owner": user, "agent": agent, "toolCalls": tools},
    }


def human(s: dict) -> str:
    total = sum(s[k] for k in ("tokensInput", "tokensOutput", "tokensReasoning",
                               "tokensCacheRead", "tokensCacheWrite"))
    return (
        "fm-synthesizers.js build usage log\n"
        "=================================\n"
        f"session          {s['sessionId']}\n"
        f"title            {s['title']}\n"
        f"created          {s['created']}\n"
        f"updated          {s['updated']}\n"
        f"opencode         {s['opencodeVersion']}\n"
        f"model            {s['model']}\n\n"
        f"cost             ${s['costUsd']:.4f}\n"
        f"tokens in        {s['tokensInput']:,}\n"
        f"tokens out       {s['tokensOutput']:,}\n"
        f"tokens reasoning {s['tokensReasoning']:,}\n"
        f"cache read       {s['tokensCacheRead']:,}\n"
        f"cache write      {s['tokensCacheWrite']:,}\n"
        f"tokens total     {total:,}\n\n"
        f"owner messages   {s['messages']['owner']}\n"
        f"agent messages   {s['messages']['agent']}\n"
        f"tool calls       {s['messages']['toolCalls']}\n"
        f"exchanges (owner -> agent)  {s['messages']['owner']}\n"
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--session", default=None)
    args = ap.parse_args()

    if not DB_PATH.exists():
        print(f"usage-log: no opencode database at {DB_PATH}", file=sys.stderr)
        return 1
    db = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    try:
        sid = args.session or default_session_id(os.getcwd(), db)
        if not sid:
            print("usage-log: no opencode session found for this directory", file=sys.stderr)
            return 1
        s = query(sid, db)
    finally:
        db.close()

    if args.json:
        print(json.dumps(s, indent=2))
    else:
        print(human(s))
    return 0


if __name__ == "__main__":
    sys.exit(main())
