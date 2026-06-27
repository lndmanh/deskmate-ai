from dataclasses import dataclass, field


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
    raw_frames_stored: int = 0  # ALWAYS 0 — invariant
    data_shared_with_employer: bool = False
    posture_events_saved: int = 0
    workday_events_saved: int = 0
    nudge_events_saved: int = 0


@dataclass
class DailySummaryRecord:
    date: str
    active_time_minutes: int | None = None
    longest_session_minutes: int | None = None
    break_count: int | None = None
    idle_time_minutes: int | None = None
    posture_risk_events: int | None = None
    posture_strain: str | None = None
    break_debt: str | None = None
    fatigue_risk: str | None = None
    score: int | None = None
    baseline_json: str | None = None
    privacy_json: str | None = None
