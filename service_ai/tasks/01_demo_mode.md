# Task 01 — Demo Mode & Simulated Event Stream

**Priority:** CRITICAL — do this first  
**Tool:** Claude Code  
**Blocks:** Everything else needs a running pipeline to test against

## Goal

Build a demo mode that plays the pre-defined event stream through the **real** pipeline (event store → risk engine → UI state), without requiring a webcam. This eliminates the biggest demo failure risk.

## Constraints (from AGENTS.MD)

- Do not modify or create migration SQL files manually.
- Follow existing code style and patterns.
- No `any` types, no non-null assertions.
- Reuse existing types from `posture_tracking/types.py`, `mood_tracking/types.py`.

## Files to Create

```
service_ai/
  demo/
    __init__.py
    event_stream.py     # The simulated events + player logic
    types.py            # DemoEvent union type if needed
```

## Files to Modify

```
api_service/main.py     # Add POST /demo/start, POST /demo/stop, GET /demo/status
api_service/schemas.py  # Add DemoStatusResponse schema
```

## Simulated Event Stream

Use this exact JSON array as the seed data (already defined in `deskmate-ai-agents.md` §15):

```python
DEMO_EVENTS = [
    {"id": "evt_demo_001", "timestamp_offset_s": 0,    "source": "demo", "type": "work_session.started"},
    {"id": "evt_demo_002", "timestamp_offset_s": 15,   "source": "demo", "type": "work_session.continuous", "duration_seconds": 4500},
    {"id": "evt_demo_003", "timestamp_offset_s": 30,   "source": "demo", "type": "posture.forward_head",    "severity": "high",   "confidence": 0.87, "duration_seconds": 900,  "metadata": {"neck_angle_degrees": 34, "stillness_seconds": 2520}},
    {"id": "evt_demo_004", "timestamp_offset_s": 45,   "source": "demo", "type": "work_session.continuous", "duration_seconds": 5760},
    {"id": "evt_demo_005", "timestamp_offset_s": 60,   "source": "demo", "type": "nudge.sent",             "nudge_type": "neck_reset", "mode": "focus_friendly", "message": "Bạn đã tập trung 76 phút rồi. Cổ bạn đang hơi căng. Nghỉ 90 giây để reset nhé?"},
    {"id": "evt_demo_006", "timestamp_offset_s": 75,   "source": "demo", "type": "posture.stillness",      "severity": "medium", "confidence": 0.81, "duration_seconds": 420},
    {"id": "evt_demo_007", "timestamp_offset_s": 90,   "source": "demo", "type": "break.started"},
    {"id": "evt_demo_008", "timestamp_offset_s": 105,  "source": "demo", "type": "break.ended"},
    {"id": "evt_demo_009", "timestamp_offset_s": 120,  "source": "demo", "type": "posture.head_tilt",      "severity": "low",    "confidence": 0.72, "metadata": {"head_tilt_degrees": 12}},
    {"id": "evt_demo_010", "timestamp_offset_s": 135,  "source": "demo", "type": "work_session.ended",     "duration_seconds": 7200},
]
```

## Demo Player Logic

```python
# demo/event_stream.py
import asyncio
import threading
from datetime import datetime, timezone

class DemoEventPlayer:
    def __init__(self, event_store, risk_engine):
        self._running = False
        self._thread: threading.Thread | None = None
        self.event_store = event_store      # injected from api_state
        self.risk_engine = risk_engine      # injected from api_state

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._play, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False

    @property
    def is_running(self) -> bool:
        return self._running

    def _play(self) -> None:
        import time
        for event in DEMO_EVENTS:
            if not self._running:
                break
            # Write to event store
            self.event_store.append(event)
            # Recompute risk after each event
            self.risk_engine.recompute()
            time.sleep(3)  # 3s between events so UI updates are visible
        self._running = False
```

## API Endpoints to Add

```python
# POST /demo/start   → {"ok": true, "message": "Demo mode started"}
# POST /demo/stop    → {"ok": true, "message": "Demo mode stopped"}
# GET  /demo/status  → {"running": bool, "events_played": int}
```

## Definition of Done

- [ ] `POST /demo/start` begins streaming events at ~3s intervals
- [ ] Each event is written to the event store (Task 02)
- [ ] Risk engine recomputes after each event (Task 03)
- [ ] `GET /demo/status` shows events played count
- [ ] `POST /demo/stop` halts playback cleanly
- [ ] Demo survives full 10-event run without crash
