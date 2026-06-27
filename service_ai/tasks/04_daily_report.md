# Task 04 — Daily Report Pipeline

**Priority:** HIGH — OpenAI Transformation proof  
**Tool:** Claude Code  
**Blocked by:** Task 02 (Event Store), Task 03 (Risk Engine)

## Goal

End-to-end pipeline: Event Store → daily aggregate → `DailyDeskSummary` struct → OpenAI prompt → Markdown report. This is the primary proof that OpenAI is doing real work in the product — it receives only a structured summary, never images.

## Constraints (from AGENTS.MD)

- AI must never receive raw images or video. Only the `DailyDeskSummary` JSON struct.
- Report must be in Vietnamese by default.
- No disease language. No certainty claims.
- Reuse the existing `chatbot/llm.py` OpenAI client pattern.

## Files to Create

```
service_ai/
  report/
    __init__.py
    aggregator.py     # Event Store → DailyDeskSummary
    generator.py      # DailyDeskSummary → Markdown via OpenAI
    types.py          # DailyDeskSummary dataclass
    prompt.py         # The report prompt template
```

## Files to Modify

```
api_service/main.py     # Add GET /report/daily, GET /report/daily/{date}
api_service/schemas.py  # Add DailyReportResponse schema
```

## DailyDeskSummary Struct

```python
# report/types.py
from dataclasses import dataclass

@dataclass
class DailyDeskSummary:
    date: str                              # YYYY-MM-DD
    active_time_minutes: int
    longest_session_minutes: int
    break_count: int
    idle_time_minutes: int
    posture_risk_events: int
    high_risk_period: str | None           # "14:10–15:35" or None
    posture_strain: str                    # low|medium|high
    break_debt: str
    fatigue_risk: str
    score: int                             # 0–100
    baseline: dict | None                  # BaselineComparison as dict if available
    privacy: dict = None                   # Always: {webcam_processing: "local", raw_frames_stored: 0, ...}

    def __post_init__(self) -> None:
        self.privacy = {
            "webcam_processing": "local",
            "cloud_processing": False,
            "raw_frames_stored": 0,
            "data_shared_with_employer": False,
        }
```

## Aggregator Logic

```python
# report/aggregator.py

def aggregate_daily(event_store: EventStore, risk_engine: RiskEngine, date: str | None = None) -> DailyDeskSummary:
    """
    date defaults to today (YYYY-MM-DD).
    Reads events from store, computes totals, calls risk_engine.current_state() for scores.
    """
```

Key calculations:
- `active_time_minutes`: sum of `work_session.ended.duration_seconds` / 60
- `longest_session_minutes`: max single session duration
- `break_count`: count of `break.started` events
- `idle_time_minutes`: sum of `idle.started` to `idle.ended` gaps
- `posture_risk_events`: count of all `posture.*` events

## Report Prompt Template

```python
# report/prompt.py

REPORT_SYSTEM_PROMPT = """
Bạn là DeskMate Coach, trợ lý AI sức khỏe làm việc cá nhân.
Viết báo cáo cuối ngày bằng tiếng Việt dựa trên dữ liệu event log được cung cấp.

Quy tắc bắt buộc:
- Chỉ dựa vào dữ liệu trong JSON summary. Không suy đoán thêm.
- Không chẩn đoán bệnh. Không dùng từ "chấn thương", "bệnh", "đau mãn tính".
- Dùng: "tư thế có nguy cơ", "nợ nghỉ", "tín hiệu mệt mỏi" — không dùng từ y tế.
- Nếu dữ liệu ít hơn 7 ngày, ghi rõ "dữ liệu baseline còn ít".
- Webcam xử lý local. AI không xem ảnh webcam. Ghi rõ nếu hỏi.
- Tone: thân thiện, ngắn gọn, cụ thể, không hù dọa.
""".strip()

def build_report_prompt(summary: DailyDeskSummary) -> str:
    import json
    data = {
        "date": summary.date,
        "active_time_minutes": summary.active_time_minutes,
        "longest_session_minutes": summary.longest_session_minutes,
        "break_count": summary.break_count,
        "posture_risk_events": summary.posture_risk_events,
        "high_risk_period": summary.high_risk_period,
        "posture_strain": summary.posture_strain,
        "break_debt": summary.break_debt,
        "fatigue_risk": summary.fatigue_risk,
        "score": summary.score,
        "baseline": summary.baseline,
        "privacy": summary.privacy,
    }
    return f"""Dữ liệu ngày làm việc hôm nay:
{json.dumps(data, ensure_ascii=False, indent=2)}

Viết báo cáo theo format:
# Báo cáo sức khỏe làm việc — {{date}}
## Điểm hôm nay: {{score}}/100
(1–2 câu tóm tắt)

## Điểm nổi bật
- ...

## Nguyên nhân chính
- ...

## Gợi ý cho ngày mai
- ...

## Ghi chú bảo mật
(1 câu xác nhận webcam xử lý local, raw frames = 0)
"""
```

## API Endpoints to Add

```python
# GET /report/daily          → today's report (generate + cache in daily_summaries)
# GET /report/daily/{date}   → report for specific YYYY-MM-DD
```

Response schema:
```python
class DailyReportResponse(BaseModel):
    date: str
    score: int
    report_markdown: str
    summary: dict          # DailyDeskSummary as dict
    generated_at: str
```

## Caching Behaviour

- On first call for a date, generate report and save markdown to `daily_summaries` table.
- On subsequent calls for the same date, return cached markdown (no re-call to OpenAI).
- Today's report is always regenerated (not cached) to reflect current data.

## Definition of Done

- [ ] `aggregate_daily()` produces correct `DailyDeskSummary` from event store
- [ ] Report prompt never includes image data or raw landmarks
- [ ] `GET /report/daily` returns a valid Markdown report in Vietnamese
- [ ] Report includes score, highlights, causes, suggestions, privacy note
- [ ] Caching works: second call for past date does not hit OpenAI again
- [ ] Falls back to template text if OpenAI key is not set (same BM25 fallback pattern as chatbot)
