# Task 06 — UI Shell + Privacy Dashboard

**Priority:** CRITICAL — judges need to see a UI  
**Tool:** Claude Code  
**Blocked by:** Task 02 (Event Store) for live data; build with mock data first

## Goal

A working demo UI with 5 screens. Build with **mock data first**, then wire real API calls. This is the most visible hackathon output — it must look polished and run without crashing.

## Approach

Use **Streamlit** — it's already available in the Python ecosystem, no separate build step, and can be served alongside FastAPI. Start it as a separate process.

Alternative if Streamlit feels too slow: serve a single-page HTML/JS UI from FastAPI's static files.

## Files to Create

```
service_ai/
  ui/
    __init__.py
    app.py              # Main Streamlit app (multi-page)
    pages/
      1_Home.py         # Dashboard: score, active time, session, posture status
      2_Posture.py      # Live posture panel (reads /posture/analyze)
      3_Timeline.py     # Workday timeline (reads /events)
      4_Nudge.py        # Mascot nudge popup state
      5_Privacy.py      # Privacy dashboard
    components/
      score_card.py     # Reusable score display
      event_log.py      # Event table component
    mock_data.py        # Hardcoded demo data for offline mode
```

## Screen Specs

### Screen 1 — Home Dashboard

Displays (poll `GET /risk/current` every 5s):

```
┌─────────────────────────────────────────────────────┐
│  DeskMate AI                          🟢 Đang theo dõi │
├─────────────────────────────────────────────────────┤
│  Điểm sức khỏe hôm nay                              │
│           72 / 100                                   │
├──────────┬──────────┬──────────┬────────────────────┤
│ Thời gian│ Phiên dài│ Số lần   │ Trạng thái          │
│ làm việc │ nhất     │ nghỉ     │ tư thế              │
│  4h 12m  │  96 phút │    3     │ ⚠️ Nguy cơ TB       │
├──────────┴──────────┴──────────┴────────────────────┤
│ Nợ nghỉ: TRUNG BÌNH  │ Nguy cơ mệt: THẤP            │
└─────────────────────────────────────────────────────┘
```

### Screen 2 — Live Posture Panel

- Reads `GET /posture/analyze` (pass demo landmarks or live landmarks)
- Shows: posture status, score, confidence, active alerts
- In demo mode: cycles through mock posture states every 10s

### Screen 3 — Workday Timeline

- Reads `GET /events?date=today&limit=50`
- Renders event blocks as a horizontal timeline
- Color coding: green=break, orange=posture risk, red=high risk, blue=work session

### Screen 4 — Mascot Nudge

- Polls `GET /risk/current` — shows nudge when `should_nudge == true`
- Nudge card with:
  - Message: "Bạn đã tập trung 76 phút rồi. Cổ bạn đang hơi căng. Nghỉ 90 giây để reset nhé?"
  - ✅ Đã làm (mark done → `POST /nudge/done`)
  - 😴 Nhắc sau 10 phút (snooze → `POST /nudge/snooze`)
- Add `POST /nudge/done` and `POST /nudge/snooze` endpoints to FastAPI

### Screen 5 — Privacy Dashboard ⭐

This screen wins trust. Must be pixel-perfect.

```
┌──────────────────────────────────────────────────┐
│  🔒 Bảo mật & Quyền riêng tư                    │
├──────────────────────────────────────────────────┤
│  ✅ Webcam xử lý:          Hoàn toàn cục bộ     │
│  ✅ Gửi lên cloud:         Tắt                  │
│  ✅ Ảnh webcam được lưu:   0 ảnh                │
│  ✅ Chia sẻ với công ty:   Không bao giờ        │
├──────────────────────────────────────────────────┤
│  Sự kiện đã lưu hôm nay:                        │
│    Tư thế: 12  │  Làm việc: 8  │  Nhắc nhở: 3  │
├──────────────────────────────────────────────────┤
│  AI chỉ nhận tóm tắt dạng văn bản, không nhận  │
│  hình ảnh hoặc video webcam.                    │
├──────────────────────────────────────────────────┤
│  [ 🗑️  Xóa toàn bộ dữ liệu ]  ← danger button  │
└──────────────────────────────────────────────────┘
```

Reads from `GET /events/privacy-counters`. Delete button calls `DELETE /events`.

## Mock Data (for offline/demo-first build)

```python
# ui/mock_data.py
MOCK_RISK_STATE = {
    "posture_strain": "medium",
    "break_debt": "medium",
    "fatigue_risk": "low",
    "desk_health_score": 72,
    "longest_session_minutes": 96,
    "active_time_minutes": 252,
    "break_count": 3,
    "high_risk_period": "14:10–15:35",
    "computed_at": "2026-06-27T14:40:00Z",
}

MOCK_PRIVACY_COUNTERS = {
    "webcam_processing": "local",
    "cloud_processing": False,
    "raw_frames_stored": 0,
    "data_shared_with_employer": False,
    "posture_events_saved": 12,
    "workday_events_saved": 8,
    "nudge_events_saved": 3,
}

MOCK_EVENTS = [
    {"timestamp": "09:30", "type": "work_session.started", "severity": None},
    {"timestamp": "10:45", "type": "work_session.continuous", "severity": None},
    {"timestamp": "14:12", "type": "posture.forward_head", "severity": "high"},
    {"timestamp": "14:38", "type": "nudge.sent", "severity": None},
    {"timestamp": "14:40", "type": "break.started", "severity": None},
    {"timestamp": "14:45", "type": "break.ended", "severity": None},
]
```

## How to Run

```bash
# Terminal 1
uvicorn api_service.main:app --host 127.0.0.1 --port 8000

# Terminal 2
streamlit run ui/app.py
```

## Definition of Done

- [ ] All 5 screens render without error (mock data mode)
- [ ] Home dashboard shows score, active time, posture status
- [ ] Timeline shows at least mock event blocks
- [ ] Nudge card appears when `should_nudge == true`; snooze/done buttons work
- [ ] Privacy dashboard shows `raw_frames_stored: 0` — hardcoded invariant
- [ ] Delete button triggers `DELETE /events` and resets counters to 0
- [ ] UI auto-refreshes every 5s on Home and Privacy screens
- [ ] No crashes on empty data (event store empty on first run)
