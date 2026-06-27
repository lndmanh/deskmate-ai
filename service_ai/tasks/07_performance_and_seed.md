# Task 07 — Performance Fix & Baseline Seed Data

**Priority:** HIGH  
**Tool:** Claude Code  
**Can run in parallel with:** Tasks 03, 04

## Part A — Performance Fix (main.py)

### Goal

`main.py` runs MediaPipe at full webcam FPS with a heavy overlay drawn every frame. On stage this causes lag and high CPU. Fix it so the demo runs smoothly.

### Files to Modify

```
main.py
posture_tracking/analyzer.py   (if throttle logic goes here)
```

### Changes Required

#### 1. Throttle inference FPS

```python
# main.py — add at top of capture loop

INFERENCE_INTERVAL_MS = 100  # run MediaPipe at max 10 FPS

last_inference_ms: float = 0.0

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    now_ms = time.monotonic() * 1000
    if now_ms - last_inference_ms < INFERENCE_INTERVAL_MS:
        # Skip inference — just display last known overlay
        cv2.imshow("DeskMate AI", last_display_frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
        continue
    last_inference_ms = now_ms
    # ... rest of inference code
```

#### 2. Resize frame before inference

```python
INFERENCE_WIDTH = 640   # MediaPipe doesn't need full resolution

def resize_for_inference(frame: np.ndarray) -> np.ndarray:
    h, w = frame.shape[:2]
    if w <= INFERENCE_WIDTH:
        return frame
    scale = INFERENCE_WIDTH / w
    return cv2.resize(frame, (INFERENCE_WIDTH, int(h * scale)))

# In loop:
inference_frame = resize_for_inference(frame)
# Pass inference_frame to MediaPipe, draw overlay on original frame
```

#### 3. Throttle terminal/stdout logs

```python
LOG_INTERVAL_S = 5.0  # only print status every 5 seconds
last_log_s: float = 0.0

# In loop, replace print() calls:
now_s = time.monotonic()
if now_s - last_log_s >= LOG_INTERVAL_S:
    print(f"[DeskMate] score={posture_score} status={posture_status}")
    last_log_s = now_s
```

#### 4. Move overlay text to a cached surface (optional but good)

Only redraw text overlay when posture status actually changes, not every frame.

```python
last_status: str = ""
last_overlay_frame = None

if posture_status != last_status or last_overlay_frame is None:
    last_overlay_frame = draw_overlay(frame.copy(), posture_result)
    last_status = posture_status

last_display_frame = last_overlay_frame
```

### Expected Result

- CPU usage drops from ~80% to ~30% during demo
- Webcam display remains smooth (display at full FPS, inference at 10 FPS)
- No log spam in terminal during demo

---

## Part B — 7-Day Baseline Seed Data

### Goal

Seed the SQLite event store with realistic 7-day history so the baseline engine has data and produces meaningful insights. Without this, baseline shows "dữ liệu baseline còn ít" during demo.

### Files to Create

```
event_store/seed.py    # Seed script — run once before demo
```

### Files to Modify

```
api_service/main.py    # Add POST /dev/seed endpoint (dev-only, guarded)
```

### Seed Script

```python
# event_store/seed.py
"""
Run: python -m event_store.seed
Seeds 7 days of realistic posture + workday events into the local SQLite store.
Safe to re-run — checks if seed already applied.
"""
import uuid
from datetime import datetime, timedelta, timezone
from event_store.store import EventStore

def seed_baseline(event_store: EventStore, days: int = 7) -> None:
    today = datetime.now(timezone.utc).date()

    for day_offset in range(days, 0, -1):
        day = today - timedelta(days=day_offset)
        day_str = day.isoformat()
        base_ts = datetime(day.year, day.month, day.day, 9, 0, 0, tzinfo=timezone.utc)

        def ts(offset_minutes: int) -> str:
            return (base_ts + timedelta(minutes=offset_minutes)).isoformat()

        def make(event_type: str, offset_minutes: int, **kwargs) -> dict:
            return {
                "id": f"seed_{uuid.uuid4().hex[:10]}",
                "timestamp": ts(offset_minutes),
                "source": "demo",
                "type": event_type,
                **kwargs,
            }

        # Typical workday pattern (varies slightly by day)
        import random
        session_length = random.randint(55, 100)       # minutes before first break
        bad_posture_at = random.randint(45, 70)        # when bad posture starts
        break_count = random.randint(3, 5)

        events = [
            make("work_session.started", 0),
            make("posture.forward_head", bad_posture_at,
                 severity="medium", confidence=0.80,
                 metadata={"neck_angle_degrees": random.randint(25, 38)}),
            make("work_session.continuous", session_length, duration_seconds=session_length * 60),
            make("idle.started", session_length + 5),
            make("break.started", session_length + 5),
            make("break.ended", session_length + 15),
            make("idle.ended", session_length + 15),
            make("work_session.started", session_length + 16),
            make("posture.stillness", session_length + 70,
                 severity="low", confidence=0.75, duration_seconds=600),
            make("work_session.continuous", session_length + 90, duration_seconds=5400),
            make("work_session.ended", session_length + 120 + break_count * 20,
                 duration_seconds=(session_length + 120) * 60),
        ]

        for event in events:
            event_store.append(event)

    print(f"✅ Seeded {days} days of baseline events.")

if __name__ == "__main__":
    store = EventStore()
    seed_baseline(store)
```

### Expected Baseline Output After Seeding

```json
{
  "average_breaks_per_day": 3.7,
  "average_active_time_minutes": 420,
  "posture_risk_usually_after_minutes": 58,
  "usual_fatigue_window": "14:00–16:00",
  "days_available": 7
}
```

This enables the chatbot to say: "Tư thế xấu của bạn thường xuất hiện sau khoảng 58 phút làm việc liên tục."

## Definition of Done

**Part A:**
- [ ] Inference throttled to 10 FPS
- [ ] Frame resized to 640px width before MediaPipe
- [ ] Terminal logs throttled to 1 per 5 seconds
- [ ] Demo runs < 40% CPU on a modern laptop

**Part B:**
- [ ] `python -m event_store.seed` runs without error
- [ ] 7 days of events appear in SQLite (verifiable via `GET /events?limit=100`)
- [ ] `GET /risk/baseline` returns a `BaselineComparison` with `days_available: 7`
- [ ] Chatbot produces personalised insights referencing baseline data
