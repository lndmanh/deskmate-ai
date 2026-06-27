# Task 02 — SQLite Event Store

**Priority:** CRITICAL  
**Tool:** Claude Code  
**Blocks:** Risk engine (Task 03), Privacy dashboard (Task 06), Daily report (Task 04)

## Goal

Local SQLite persistence for all DeskMate events. This is the central source of truth for the entire pipeline. The privacy counter (`raw_frames_stored = 0`) must always be enforced at the store level.

## Constraints (from AGENTS.MD)

- No `any` types, no non-null assertions.
- Follow existing patterns — look at `mood_tracking/store.py` for the style reference.
- Use `sqlite3` from stdlib (no external ORM needed for MVP).

## Files to Create

```
service_ai/
  event_store/
    __init__.py         # exports EventStore
    store.py            # SQLite implementation
    types.py            # EventRecord, PrivacyCounters, DailySummaryRecord
    schema.sql          # CREATE TABLE statements (read by store.py on init)
    seed.py             # 7-day baseline seed data for demo (Task 07 uses this)
```

## Files to Modify

```
api_service/state.py    # Add event_store: EventStore to ApiState
api_service/main.py     # Add GET /events, DELETE /events (delete all)
api_service/schemas.py  # Add EventRecord, PrivacyCountersResponse schemas
```

## Database Schema

```sql
-- event_store/schema.sql

CREATE TABLE IF NOT EXISTS posture_events (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'local_vision',
    type TEXT NOT NULL,
    severity TEXT,
    confidence REAL,
    duration_seconds INTEGER,
    metadata TEXT  -- JSON blob
);

CREATE TABLE IF NOT EXISTS workday_events (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'activity_tracker',
    type TEXT NOT NULL,
    duration_seconds INTEGER,
    metadata TEXT  -- JSON blob
);

CREATE TABLE IF NOT EXISTS nudge_events (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'nudge',
    type TEXT NOT NULL,
    nudge_type TEXT,
    mode TEXT,
    message TEXT,
    snooze_minutes INTEGER
);

CREATE TABLE IF NOT EXISTS daily_summaries (
    date TEXT PRIMARY KEY,  -- YYYY-MM-DD
    active_time_minutes INTEGER,
    longest_session_minutes INTEGER,
    break_count INTEGER,
    idle_time_minutes INTEGER,
    posture_risk_events INTEGER,
    posture_strain TEXT,     -- low|medium|high
    break_debt TEXT,
    fatigue_risk TEXT,
    score INTEGER,
    baseline_json TEXT,      -- JSON blob of baseline comparison
    privacy_json TEXT        -- JSON blob: {webcam_processing, cloud_processing, raw_frames_stored, data_shared_with_employer}
);

-- Privacy invariant: raw_frames_stored is always 0.
-- This is enforced at the application layer, not stored.
```

## EventStore Python API

```python
# event_store/store.py
from pathlib import Path
from .types import EventRecord, PrivacyCounters

class EventStore:
    def __init__(self, db_path: str | Path = "data/events.db") -> None: ...

    # Write
    def append(self, event: dict) -> None:
        """Route event dict to the correct table by type prefix."""
        # posture.* → posture_events
        # work_session.* | break.* | idle.* → workday_events
        # nudge.* → nudge_events

    # Read
    def list_events(self, date: str | None = None, event_type: str | None = None, limit: int = 100) -> list[EventRecord]: ...
    def count_posture_events(self, date: str | None = None) -> int: ...
    def count_workday_events(self, date: str | None = None) -> int: ...

    # Privacy
    def privacy_counters(self) -> PrivacyCounters:
        """Always returns raw_frames_stored=0."""

    # Delete
    def delete_all(self) -> None:
        """Wipe all tables. Used by privacy dashboard delete-all-data action."""

    # Daily summary
    def save_daily_summary(self, summary: dict) -> None: ...
    def get_daily_summary(self, date: str) -> dict | None: ...
    def get_recent_summaries(self, days: int = 7) -> list[dict]: ...
```

## Types

```python
# event_store/types.py
from dataclasses import dataclass

@dataclass
class EventRecord:
    id: str
    timestamp: str
    source: str
    type: str
    severity: str | None = None
    confidence: float | None = None
    duration_seconds: int | None = None
    metadata: dict | None = None

@dataclass
class PrivacyCounters:
    webcam_processing: str = "local"
    cloud_processing: bool = False
    raw_frames_stored: int = 0          # ALWAYS 0 — invariant
    data_shared_with_employer: bool = False
    posture_events_saved: int = 0
    workday_events_saved: int = 0
    nudge_events_saved: int = 0
```

## API Endpoints to Add

```python
# GET  /events                   → list of EventRecord (filtered by ?date=&type=&limit=)
# GET  /events/privacy-counters  → PrivacyCounters (raw_frames_stored always 0)
# DELETE /events                 → {"ok": true, "deleted": true}
```

## Definition of Done

- [ ] `EventStore` initialises SQLite file and creates tables on first run
- [ ] `append()` routes correctly for posture/workday/nudge event type prefixes
- [ ] `privacy_counters()` always returns `raw_frames_stored=0`
- [ ] `delete_all()` wipes all rows across all tables
- [ ] `GET /events/privacy-counters` returns correct counts
- [ ] `DELETE /events` calls `delete_all()` and returns `{"ok": true}`
- [ ] `api_state` exposes `event_store` so demo player and risk engine can use it
