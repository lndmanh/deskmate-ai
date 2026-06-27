# Claude Code Prompts — DeskMate AI

Paste one prompt per Claude Code session. Open Claude Code from inside `service_ai/`.

```bash
cd /path/to/deskmate-ai/service_ai
claude
```

---

## PROMPT 02 — Event Store (START HERE)

```
Read tasks/02_event_store.md in full before writing any code.

Implement the SQLite event store exactly as specified:

1. Create event_store/__init__.py, store.py, types.py, schema.sql
2. EventStore.__init__ must create the SQLite file and run schema.sql on first run
3. append() must route events to the correct table based on type prefix:
   - posture.* → posture_events
   - work_session.* | break.* | idle.* → workday_events  
   - nudge.* → nudge_events
4. privacy_counters() must ALWAYS return raw_frames_stored=0 — this is a hard invariant, never store or increment this value
5. delete_all() wipes all rows in all tables
6. Add event_store: EventStore to api_service/state.py (instantiate in ApiState.__init__)
7. Add these endpoints to api_service/main.py:
   GET  /events                  (params: date, type, limit)
   GET  /events/privacy-counters
   DELETE /events
8. Add the corresponding Pydantic schemas to api_service/schemas.py

Style rules (from AGENTS.MD):
- No `any` types, no non-null assertions, no type assertions
- Follow the pattern in mood_tracking/store.py exactly
- Use stdlib sqlite3 only — no ORM

After implementing, verify by running:
  python -c "from event_store.store import EventStore; s = EventStore('data/test.db'); s.append({'id':'t1','timestamp':'2026-06-27T09:00:00Z','source':'demo','type':'posture.forward_head','severity':'high','confidence':0.9}); print(s.privacy_counters()); s.delete_all()"

Fix any import errors before finishing.
```

---

## PROMPT 01 — Demo Mode

```
Read tasks/01_demo_mode.md in full before writing any code.
Also read api_service/state.py to understand the current ApiState structure.

Implement the demo event player:

1. Create demo/__init__.py and demo/event_stream.py
2. DemoEventPlayer takes event_store and risk_engine in __init__
3. start() launches a daemon thread that appends one event every 3 seconds
4. Each appended event calls event_store.append() then risk_engine.recompute()
5. stop() sets _running = False cleanly
6. is_running property returns bool
7. Add demo_player: DemoEventPlayer to api_service/state.py
8. Add to api_service/main.py:
   POST /demo/start  → {"ok": true, "message": "Demo mode started"}
   POST /demo/stop   → {"ok": true, "message": "Demo mode stopped"}
   GET  /demo/status → {"running": bool, "events_played": int}

The DEMO_EVENTS list is defined in the task file — copy it exactly into demo/event_stream.py.

Dependency note: this task requires event_store (Task 02) and risk_engine (Task 03) to be present in ApiState. If risk_engine is not yet implemented, make recompute() a no-op call that is safely skipped when risk_engine is None.

Verify by starting the server and calling:
  curl -X POST http://127.0.0.1:8000/demo/start
  curl http://127.0.0.1:8000/demo/status
  # wait 10s
  curl http://127.0.0.1:8000/events?limit=5
```

---

## PROMPT 03 — Risk Engine

```
Read tasks/03_risk_engine.md in full before writing any code.
Also read event_store/store.py and event_store/types.py first.

Implement the deterministic risk scoring engine:

1. Create risk_engine/__init__.py, engine.py, baseline.py, types.py
2. All four scoring functions must be pure Python — no LLM calls, no external HTTP
3. Implement exactly:
   - compute_posture_strain(events) → "low"|"medium"|"high"
   - compute_break_debt(events, active_time_minutes) → "low"|"medium"|"high"
   - compute_fatigue_risk(events, longest_session_minutes) → "low"|"medium"|"high"
   - compute_desk_health_score(strain, debt, fatigue) → int 0–100
4. RiskEngine.recompute() reads today's events from event_store and returns RiskState
5. RiskEngine.should_nudge() returns True when posture_strain=="high" OR break_debt=="high" OR longest_session_minutes > 90
6. BaselineComparison.days_available must handle 0–7 days gracefully — never crash on empty store
7. Add risk_engine: RiskEngine to api_service/state.py
8. Add to api_service/main.py:
   GET /risk/current   → RiskState (always calls recompute())
   GET /risk/baseline  → BaselineComparison

Language rules (from AGENTS.MD):
- Never use: "injury", "pain condition", "disease", "stress disorder"
- Use: "posture_strain", "break_debt", "fatigue_risk"

Verify correctness with a quick unit test:
  python -c "
from risk_engine.engine import compute_posture_strain, compute_desk_health_score
from event_store.types import EventRecord
events = [EventRecord(id='1',timestamp='',source='demo',type='posture.forward_head',severity='high',confidence=0.9)]
strain = compute_posture_strain(events)
score = compute_desk_health_score(strain, 'medium', 'low')
print(f'strain={strain} score={score}')
assert strain == 'low'  # only 1 high event, threshold is 2
print('OK')
"
```

---

## PROMPT 04 — Daily Report Pipeline

```
Read tasks/04_daily_report.md in full before writing any code.
Also read chatbot/llm.py to understand how OpenAI is called in this codebase.

Implement the daily report pipeline:

1. Create report/__init__.py, types.py, aggregator.py, generator.py, prompt.py
2. DailyDeskSummary must always set privacy.raw_frames_stored = 0 in __post_init__
3. aggregate_daily(event_store, risk_engine, date) reads from SQLite and returns DailyDeskSummary
4. build_report_prompt(summary) formats the prompt exactly as shown in the task file — Vietnamese
5. ReportGenerator.generate(summary) calls OpenAI using the same pattern as chatbot/llm.py
6. If OPENAI_API_KEY is not set, return a template fallback string in Vietnamese (same pattern as the chatbot local fallback)
7. Cache: save generated report to event_store.save_daily_summary() so past dates don't re-call OpenAI
8. Add to api_service/main.py:
   GET /report/daily           → today's report
   GET /report/daily/{date}    → specific YYYY-MM-DD

The prompt must NEVER include raw landmark data, pixel values, or image content.
Only structured fields from DailyDeskSummary are passed to OpenAI.

Verify by running:
  curl http://127.0.0.1:8000/report/daily
  # Should return JSON with report_markdown field containing Vietnamese text
```

---

## PROMPT 05 — Activity Tracker

```
Read tasks/05_activity_tracker.md in full before writing any code.

Implement keyboard/mouse activity tracking:

1. Create activity_tracker/__init__.py, tracker.py, types.py
2. Add pynput>=1.7.0 to requirements-api.txt
3. ActivityTracker uses pynput listeners for keyboard and mouse — detect presence only, NOT keystrokes
4. Implement exact thresholds from task file:
   IDLE_THRESHOLD_SECONDS = 300
   BREAK_MIN_SESSION_SECONDS = 1800
   CONTINUOUS_INTERVAL_SECONDS = 1800
5. All events are written via self._event_store.append(event) immediately
6. start() launches daemon threads — must not block FastAPI startup
7. stop() cleans up listeners gracefully
8. Add activity_tracker: ActivityTracker to api_service/state.py, start it in the FastAPI lifespan startup handler
9. Add to api_service/main.py:
   GET /activity/status → {"running": bool, "is_idle": bool, "session_active": bool, "session_duration_minutes": int | None}

Privacy rule: pynput on_press callback receives the key object — do NOT log, store, or transmit the actual key value. Only update self._last_activity timestamp.

If pynput is not available in the environment, add a graceful fallback:
  try:
      from pynput import keyboard, mouse
      PYNPUT_AVAILABLE = True
  except ImportError:
      PYNPUT_AVAILABLE = False
And skip starting listeners if unavailable, while still exposing the status endpoint.

Verify by starting the server, moving the mouse, and checking:
  curl http://127.0.0.1:8000/activity/status
  curl "http://127.0.0.1:8000/events?type=work_session.started&limit=5"
```

---

## PROMPT 06 — UI + Privacy Dashboard

```
Read tasks/06_ui_and_privacy_dashboard.md in full before writing any code.

Build the Streamlit demo UI. Start with mock data so it works before the API is fully wired.

1. Create ui/app.py as the Streamlit entry point
2. Create ui/mock_data.py with MOCK_RISK_STATE, MOCK_PRIVACY_COUNTERS, MOCK_EVENTS — copy from task file
3. Create ui/pages/1_Home.py — dashboard with score, active time, session, posture status
4. Create ui/pages/2_Posture.py — live posture panel (mock cycles every 10s)
5. Create ui/pages/3_Timeline.py — workday timeline as colored event blocks
6. Create ui/pages/4_Nudge.py — mascot nudge card with snooze/done buttons
7. Create ui/pages/5_Privacy.py — privacy dashboard exactly matching the spec in the task file

For all API calls use a helper that falls back to mock data if the API is not reachable:
  def get_risk_state() -> dict:
      try:
          r = requests.get("http://127.0.0.1:8000/risk/current", timeout=1)
          return r.json()
      except Exception:
          return MOCK_RISK_STATE

Privacy dashboard requirements (non-negotiable):
- raw_frames_stored is ALWAYS shown as 0 — hardcode this display value even if API is down
- "Ảnh webcam được lưu: 0 ảnh" must always be visible
- Delete button must call DELETE http://127.0.0.1:8000/events and then st.rerun()

Add these two endpoints to api_service/main.py for the nudge buttons:
  POST /nudge/done   → {"ok": true}  (writes nudge.completed event to store)
  POST /nudge/snooze → {"ok": true, "snooze_minutes": 10}  (writes nudge.snoozed event)

Add streamlit to requirements-api.txt.

To run:
  streamlit run ui/app.py

Verify all 5 pages load without error in mock mode before wiring real API calls.
```

---

## PROMPT 07A — Performance Fix

```
Read tasks/07_performance_and_seed.md Part A before writing any code.
Also read main.py in full first to understand the current capture loop structure.

Fix the MediaPipe performance bottleneck in main.py:

1. Add INFERENCE_INTERVAL_MS = 100 constant (10 FPS cap for inference)
2. Add last_inference_ms: float = 0.0 before the capture loop
3. In the loop: skip inference if elapsed < INFERENCE_INTERVAL_MS, display last_display_frame instead
4. Add resize_for_inference(frame) that resizes to max 640px width before passing to MediaPipe
5. Add LOG_INTERVAL_S = 5.0 and throttle all print() calls to fire at most every 5 seconds
6. Add overlay caching: only redraw text overlay when posture_status changes

Important: the display loop should still run at full webcam FPS for a smooth preview window. Only the MediaPipe inference call is throttled.

Do not change the posture scoring logic or any module outside main.py.

Verify by running main.py and checking CPU usage drops below 50% within 10 seconds of opening.
```

---

## PROMPT 07B — Baseline Seed Data

```
Read tasks/07_performance_and_seed.md Part B before writing any code.
Also read event_store/store.py to understand how append() works.

Create the seed script:

1. Create event_store/seed.py exactly as specified in the task file
2. The script must be runnable as: python -m event_store.seed
3. Seed 7 days of events with realistic variation (use random.randint for session lengths)
4. Each day must include: work_session.started, posture.forward_head (medium severity), work_session.continuous, break.started, break.ended, work_session.ended
5. Print a confirmation line after seeding: "✅ Seeded 7 days of baseline events."

After seeding, verify the baseline engine works:
  python -m event_store.seed
  curl http://127.0.0.1:8000/risk/baseline
  # Should return days_available: 7 and non-null average values
```

