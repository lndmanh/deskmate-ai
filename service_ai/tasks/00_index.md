# DeskMate AI — Claude Code Task Index

Hackathon MVP · June 27 2026  
Read `AGENTS.MD` and `README.md` first for project constraints and code style.

---

## Build Order

Tasks marked **PARALLEL** can run simultaneously in separate Claude Code sessions.

```
Phase 1 (do first — unblocks everything):
  02_event_store.md          ← SQLite persistence layer

Phase 2 (parallel after Phase 1):
  01_demo_mode.md            ← simulated event stream through real pipeline
  03_risk_engine.md          ← deterministic scoring from events
  07_performance_and_seed.md ← FPS throttle + 7-day seed data

Phase 3 (parallel after Phase 2):
  04_daily_report.md         ← event aggregate → OpenAI → Markdown report
  05_activity_tracker.md     ← real keyboard/mouse activity events

Phase 4 (wire everything together):
  06_ui_and_privacy_dashboard.md  ← Streamlit UI, 5 screens
```

---

## Task Summary

| # | File | Priority | Blocks | Est. |
|---|------|----------|--------|------|
| 02 | Event Store (SQLite) | 🔴 Critical | everything | 2–3h |
| 01 | Demo Mode | 🔴 Critical | UI testing | 1–2h |
| 03 | Risk Engine | 🟠 High | report, nudge, UI | 2h |
| 07 | Perf Fix + Seed Data | 🟠 High | — | 1–2h |
| 04 | Daily Report Pipeline | 🟠 High | — | 2h |
| 05 | Activity Tracker | 🟠 High | — | 1–2h |
| 06 | UI + Privacy Dashboard | 🔴 Critical | all above | 2–3h |

---

## What's Already Done — Don't Rebuild

| Module | Status | Notes |
|--------|--------|-------|
| `posture_tracking/` | ✅ Complete | Just needs event store wiring |
| `chatbot/` | ✅ Complete | DeskMateCoach with RAG, guardrails |
| `rag/` | ✅ Complete | Hybrid BM25/vector retriever |
| `api_service/` | ✅ Complete | 8 endpoints — add /events, /risk, /report |
| `mood_tracking/` | ✅ Complete | Already wired into chatbot context |
| `knowledge_base/` | ✅ Complete | 20+ docs, no edits needed |

---

## Key Invariants (Never Violate)

1. `raw_frames_stored` is **always 0**. Enforce at event store level.
2. AI (OpenAI) receives **only structured summaries**, never images or landmarks.
3. No disease language: say "posture risk", not "injury" or "pain condition".
4. No employer dashboard. This is a personal tool.
5. Demo mode must use the **same pipeline** as real mode — not fake UI screenshots.

---

## Shared State (api_service/state.py)

All modules share state via `ApiState`. Add these as you implement each task:

```python
@dataclass
class ApiState:
    coach: DeskMateCoach                    # existing
    mood_store: MoodStore                   # existing
    posture_analyzers: dict[str, ...]       # existing
    event_store: EventStore                 # Task 02
    risk_engine: RiskEngine                 # Task 03
    activity_tracker: ActivityTracker       # Task 05
    demo_player: DemoEventPlayer            # Task 01
```

---

## New API Endpoints Needed

Add all of these to `api_service/main.py`:

```
POST   /demo/start
POST   /demo/stop
GET    /demo/status

GET    /events
GET    /events/privacy-counters
DELETE /events

GET    /risk/current
GET    /risk/baseline

GET    /report/daily
GET    /report/daily/{date}

GET    /activity/status

POST   /nudge/done
POST   /nudge/snooze
```

---

## How to Run Everything

```bash
# 1. Seed 7-day baseline (once before demo)
python -m event_store.seed

# 2. Start FastAPI
uvicorn api_service.main:app --host 127.0.0.1 --port 8000

# 3. Start Streamlit UI
streamlit run ui/app.py

# 4. Optional: start posture tracking (real webcam)
python main.py

# 5. Optional: start demo mode via API
curl -X POST http://127.0.0.1:8000/demo/start
```
