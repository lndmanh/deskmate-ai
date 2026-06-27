# Task 05 — Activity Tracker

**Priority:** HIGH — completes the event pipeline  
**Tool:** Claude Code  
**Blocked by:** Task 02 (Event Store)

## Goal

Track real computer activity (keyboard/mouse) and emit workday events to the event store. This is what makes the pipeline genuinely event-driven rather than posture-only. Keep it minimal — no app category tracking needed for MVP.

## Constraints (from AGENTS.MD)

- No employer monitoring. This is a personal tool only.
- No raw keystroke logging. Only activity presence (active vs idle).
- No `any` types.
- Must run as a background thread (non-blocking to FastAPI).

## Files to Create

```
service_ai/
  activity_tracker/
    __init__.py       # exports ActivityTracker
    tracker.py        # Main tracker using pynput
    types.py          # WorkdaySession dataclass
```

## Files to Modify

```
api_service/state.py    # Add activity_tracker: ActivityTracker to ApiState, start on app startup
api_service/main.py     # Add GET /activity/status
api_service/schemas.py  # Add ActivityStatusResponse schema
requirements-api.txt    # Add: pynput>=1.7.0
```

## Events to Emit

All events written to `event_store.append(event)` immediately when they occur.

| Event type | When |
|---|---|
| `work_session.started` | First activity after idle/startup |
| `work_session.ended` | After `IDLE_THRESHOLD` of no activity |
| `work_session.continuous` | Every 30 min of uninterrupted activity |
| `idle.started` | After 5 min of no keyboard/mouse input |
| `idle.ended` | First input after idle |
| `break.started` | Alias for `idle.started` when session > 30 min |
| `break.ended` | Alias for `idle.ended` after a break |

## Thresholds

```python
IDLE_THRESHOLD_SECONDS = 300       # 5 min no input → idle
BREAK_MIN_SESSION_SECONDS = 1800   # session must be > 30 min to count idle as break
CONTINUOUS_INTERVAL_SECONDS = 1800 # emit work_session.continuous every 30 min
```

## Tracker Implementation Sketch

```python
# activity_tracker/tracker.py
import threading
import time
import uuid
from datetime import datetime, timezone
from pynput import keyboard, mouse

class ActivityTracker:
    def __init__(self, event_store) -> None:
        self._event_store = event_store
        self._last_activity: float = time.monotonic()
        self._session_start: float | None = None
        self._is_idle: bool = False
        self._running: bool = False
        self._kb_listener: keyboard.Listener | None = None
        self._mouse_listener: mouse.Listener | None = None
        self._monitor_thread: threading.Thread | None = None

    def start(self) -> None:
        """Start listeners and monitor loop. Call once on app startup."""
        self._running = True
        self._kb_listener = keyboard.Listener(on_press=self._on_activity)
        self._mouse_listener = mouse.Listener(on_move=self._on_activity, on_click=self._on_activity)
        self._kb_listener.start()
        self._mouse_listener.start()
        self._monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._monitor_thread.start()

    def stop(self) -> None:
        self._running = False
        if self._kb_listener:
            self._kb_listener.stop()
        if self._mouse_listener:
            self._mouse_listener.stop()

    def _on_activity(self, *args) -> None:
        now = time.monotonic()
        if self._is_idle:
            self._emit_idle_ended()
            self._is_idle = False
        if self._session_start is None:
            self._session_start = now
            self._emit_session_started()
        self._last_activity = now

    def _monitor_loop(self) -> None:
        last_continuous = time.monotonic()
        while self._running:
            now = time.monotonic()
            idle_seconds = now - self._last_activity
            if idle_seconds >= IDLE_THRESHOLD_SECONDS and not self._is_idle:
                self._is_idle = True
                session_duration = int(now - self._session_start) if self._session_start else 0
                self._emit_idle_started(session_duration)
                if session_duration >= BREAK_MIN_SESSION_SECONDS:
                    self._emit_break_started()
                self._emit_session_ended(session_duration)
                self._session_start = None
            if not self._is_idle and self._session_start and (now - last_continuous) >= CONTINUOUS_INTERVAL_SECONDS:
                self._emit_continuous(int(now - self._session_start))
                last_continuous = now
            time.sleep(10)

    def _make_event(self, event_type: str, **kwargs) -> dict:
        return {
            "id": f"evt_{uuid.uuid4().hex[:12]}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "activity_tracker",
            "type": event_type,
            **kwargs,
        }

    def _emit_session_started(self) -> None:
        self._event_store.append(self._make_event("work_session.started"))

    def _emit_session_ended(self, duration_seconds: int) -> None:
        self._event_store.append(self._make_event("work_session.ended", duration_seconds=duration_seconds))

    def _emit_continuous(self, duration_seconds: int) -> None:
        self._event_store.append(self._make_event("work_session.continuous", duration_seconds=duration_seconds))

    def _emit_idle_started(self, session_duration: int) -> None:
        self._event_store.append(self._make_event("idle.started", metadata={"prior_session_seconds": session_duration}))

    def _emit_idle_ended(self) -> None:
        self._event_store.append(self._make_event("idle.ended"))

    def _emit_break_started(self) -> None:
        self._event_store.append(self._make_event("break.started"))
```

## API Endpoint to Add

```python
# GET /activity/status → {"running": bool, "is_idle": bool, "session_active": bool, "session_duration_minutes": int | None}
```

## Definition of Done

- [ ] `ActivityTracker` starts on FastAPI app startup (lifespan or startup event)
- [ ] `idle.started` / `idle.ended` fire correctly after 5 min of inactivity
- [ ] `work_session.started` fires on first activity after idle
- [ ] `work_session.continuous` fires every 30 min during active session
- [ ] All events appear in SQLite event store (verifiable via `GET /events`)
- [ ] `GET /activity/status` shows current session state
- [ ] Tracker stops cleanly when app shuts down (no zombie threads)
