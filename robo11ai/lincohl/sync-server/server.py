#!/usr/bin/env python3
"""
Lincohl Sync Server
FastAPI server for multi-device state synchronization.

Devices (Pi, phone, Mac dashboard) post events here.
The dashboard connects via WebSocket for real-time updates.
Conversation history is stored in SQLite.

Run: uvicorn server:app --host 0.0.0.0 --port 8420
"""

import os
import json
import sqlite3
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Lincohl Sync Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.getenv("LINCOHL_DB", "lincohl.db")

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device TEXT NOT NULL,
            event_type TEXT NOT NULL,
            data TEXT,
            timestamp TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            device TEXT NOT NULL,
            started_at TEXT,
            ended_at TEXT,
            messages TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS device_status (
            device TEXT PRIMARY KEY,
            status TEXT NOT NULL DEFAULT 'idle',
            last_seen TEXT,
            metadata TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
        CREATE INDEX IF NOT EXISTS idx_events_device ON events(device);
        CREATE INDEX IF NOT EXISTS idx_conversations_device ON conversations(device);
    """)
    conn.close()


init_db()

# ---------------------------------------------------------------------------
# WebSocket manager
# ---------------------------------------------------------------------------


class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class EventPayload(BaseModel):
    device: str
    event: str
    timestamp: Optional[str] = None
    data: Optional[dict] = None


class DeviceStatusPayload(BaseModel):
    device: str
    status: str
    metadata: Optional[dict] = None


# ---------------------------------------------------------------------------
# REST API
# ---------------------------------------------------------------------------


@app.get("/")
async def root():
    return {"service": "lincohl-sync", "version": "1.0.0", "status": "running"}


@app.post("/api/events")
async def post_event(payload: EventPayload):
    """Receive an event from any device and broadcast to WebSocket clients."""
    ts = payload.timestamp or datetime.now(timezone.utc).isoformat()

    conn = get_db()
    conn.execute(
        "INSERT INTO events (device, event_type, data, timestamp) VALUES (?, ?, ?, ?)",
        (payload.device, payload.event, json.dumps(payload.data or {}), ts),
    )

    # Update device status
    status_map = {
        "hotword_detected": "listening",
        "conversation_started": "active",
        "conversation_ended": "idle",
        "user_transcript": "active",
        "agent_response": "active",
    }
    new_status = status_map.get(payload.event, "idle")
    conn.execute(
        """INSERT INTO device_status (device, status, last_seen)
           VALUES (?, ?, ?)
           ON CONFLICT(device) DO UPDATE SET status=?, last_seen=?""",
        (payload.device, new_status, ts, new_status, ts),
    )

    # Save conversation if ended
    if payload.event == "conversation_ended" and payload.data:
        conv_id = payload.data.get("conversation_id", "")
        messages = payload.data.get("messages", [])
        started = messages[0]["timestamp"] if messages else ts
        conn.execute(
            """INSERT OR REPLACE INTO conversations (id, device, started_at, ended_at, messages)
               VALUES (?, ?, ?, ?, ?)""",
            (conv_id, payload.device, started, ts, json.dumps(messages)),
        )

    conn.commit()
    conn.close()

    # Broadcast to dashboard
    await manager.broadcast({
        "type": payload.event,
        "device": payload.device,
        "data": payload.data,
        "timestamp": ts,
    })

    return {"ok": True}


@app.get("/api/devices")
async def get_devices():
    """Get status of all known devices."""
    conn = get_db()
    rows = conn.execute("SELECT * FROM device_status ORDER BY last_seen DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/api/conversations")
async def get_conversations(limit: int = 50, device: Optional[str] = None):
    """Get recent conversations, optionally filtered by device."""
    conn = get_db()
    if device:
        rows = conn.execute(
            "SELECT * FROM conversations WHERE device = ? ORDER BY ended_at DESC LIMIT ?",
            (device, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM conversations ORDER BY ended_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    conn.close()

    results = []
    for r in rows:
        d = dict(r)
        d["messages"] = json.loads(d["messages"]) if d["messages"] else []
        results.append(d)
    return results


@app.get("/api/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get a single conversation by ID."""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM conversations WHERE id = ?", (conversation_id,)
    ).fetchone()
    conn.close()

    if not row:
        raise HTTPException(404, "Conversation not found")

    d = dict(row)
    d["messages"] = json.loads(d["messages"]) if d["messages"] else []
    return d


@app.get("/api/events/recent")
async def get_recent_events(limit: int = 100):
    """Get recent events across all devices."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM events ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()

    results = []
    for r in rows:
        d = dict(r)
        d["data"] = json.loads(d["data"]) if d["data"] else {}
        results.append(d)
    return results


# ---------------------------------------------------------------------------
# WebSocket for real-time dashboard
# ---------------------------------------------------------------------------


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        # Send current device status on connect
        conn = get_db()
        devices = conn.execute("SELECT * FROM device_status").fetchall()
        conn.close()
        await ws.send_json({
            "type": "initial_state",
            "devices": [dict(d) for d in devices],
        })

        # Keep alive, receive any commands from dashboard
        while True:
            data = await ws.receive_text()
            msg = json.loads(data)

            # Dashboard can send commands to devices (future)
            if msg.get("type") == "ping":
                await ws.send_json({"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(ws)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8420)
