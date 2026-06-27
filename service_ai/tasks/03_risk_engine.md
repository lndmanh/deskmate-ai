# Task 03 — Risk & Baseline Engine

**Priority:** HIGH — Engineering Depth proof  
**Tool:** Claude Code  
**Blocked by:** Task 02 (Event Store)

## Goal

Deterministic scoring from event logs. Judges must see this is **not** just an LLM prompt — it's a real rule-based engine with personal baseline comparison. Output feeds the mascot nudge (Task 05) and daily report (Task 04).

## Constraints (from AGENTS.MD)

- No disease language. Use: "posture risk", "break debt", "fatigue risk" — never "injury", "pain condition", "stress disorder".
- No `any` types.
- Keep scoring logic deterministic (no LLM calls in this module).

## Files to Create

```
service_ai/
  risk_engine/
    __init__.py       # exports RiskEngine
    engine.py         # Core scoring logic
    baseline.py       # 7-day baseline comparison
    types.py          # RiskScore, BaselineComparison, RiskState
```

## Files to Modify

```
api_service/state.py    # Add risk_engine: RiskEngine to ApiState
api_service/main.py     # Add GET /risk/current, GET /risk/baseline
api_service/schemas.py  # Add RiskStateResponse schema
```

## Scoring Rules

Implement these as pure functions — deterministic, testable, no LLM.

### posture_strain (str: "low" | "medium" | "high")

```python
def compute_posture_strain(posture_events_today: list[EventRecord]) -> str:
    high_count = sum(1 for e in posture_events_today if e.severity == "high")
    medium_count = sum(1 for e in posture_events_today if e.severity == "medium")
    if high_count >= 5:
        return "high"
    if high_count >= 2 or medium_count >= 5:
        return "medium"
    return "low"
```

### break_debt (str: "low" | "medium" | "high")

```python
def compute_break_debt(workday_events_today: list[EventRecord], active_time_minutes: int) -> str:
    break_events = [e for e in workday_events_today if e.type == "break.started"]
    expected_breaks = active_time_minutes // 60  # 1 break per hour minimum
    actual_breaks = len(break_events)
    deficit = max(0, expected_breaks - actual_breaks)
    if deficit >= 3:
        return "high"
    if deficit >= 1:
        return "medium"
    return "low"
```

### fatigue_risk (str: "low" | "medium" | "high")

```python
def compute_fatigue_risk(posture_events_today: list[EventRecord], longest_session_minutes: int) -> str:
    stillness_events = [e for e in posture_events_today if e.type == "posture.stillness"]
    drowsiness_events = [e for e in posture_events_today if e.type in ("fatigue.low_movement", "fatigue.possible_drowsiness")]
    if drowsiness_events or longest_session_minutes > 120:
        return "high"
    if stillness_events or longest_session_minutes > 90:
        return "medium"
    return "low"
```

### desk_health_score (int: 0–100)

```python
def compute_desk_health_score(posture_strain: str, break_debt: str, fatigue_risk: str) -> int:
    strain_penalty  = {"low": 0, "medium": 15, "high": 30}
    debt_penalty    = {"low": 0, "medium": 10, "high": 20}
    fatigue_penalty = {"low": 0, "medium": 10, "high": 20}
    score = 100 - strain_penalty[posture_strain] - debt_penalty[break_debt] - fatigue_penalty[fatigue_risk]
    return max(0, min(100, score))
```

### high_risk_period detection

Find the 30-minute window with the highest density of high-severity posture events.

## Baseline (7-day comparison)

```python
# risk_engine/baseline.py

@dataclass
class BaselineComparison:
    average_breaks_per_day: float
    average_active_time_minutes: float
    usual_fatigue_window: str | None          # e.g. "14:00–16:00"
    posture_risk_usually_after_minutes: int | None  # e.g. 60
    days_available: int                        # how many days of data (0–7)

def compute_baseline(recent_summaries: list[dict]) -> BaselineComparison:
    """Compute baseline from up to 7 daily summaries from event_store.get_recent_summaries()."""
```

## RiskEngine Public API

```python
# risk_engine/engine.py

class RiskEngine:
    def __init__(self, event_store: EventStore) -> None: ...

    def recompute(self) -> RiskState:
        """Re-read today's events from store and recompute all scores."""

    def current_state(self) -> RiskState:
        """Return last computed state without re-reading store."""

    def should_nudge(self) -> bool:
        """True when posture_strain==high or break_debt==high or longest_session > 90m."""

@dataclass
class RiskState:
    posture_strain: str       # low|medium|high
    break_debt: str
    fatigue_risk: str
    desk_health_score: int    # 0–100
    longest_session_minutes: int
    active_time_minutes: int
    break_count: int
    high_risk_period: str | None   # "14:10–15:35" or None
    baseline: BaselineComparison | None
    computed_at: str          # ISO timestamp
```

## API Endpoints to Add

```python
# GET /risk/current   → RiskState (recomputes from today's events)
# GET /risk/baseline  → BaselineComparison (last 7 days)
```

## Definition of Done

- [ ] All four scoring functions are pure/deterministic (no LLM)
- [ ] `recompute()` reads from event store and returns a full `RiskState`
- [ ] `should_nudge()` fires correctly based on thresholds
- [ ] Baseline handles 0–7 days of data gracefully (no crash on empty store)
- [ ] `GET /risk/current` returns valid `RiskState` JSON
- [ ] Demo event stream triggers score changes visibly during playback
