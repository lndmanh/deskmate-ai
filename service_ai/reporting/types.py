"""Schema contract for the comprehensive DeskMate AI report.

Everything the ``/report`` endpoint accepts and returns is defined here. The
report has a *fixed structure* so the desktop client can parse it consistently
regardless of whether it was produced by the LLM or by the deterministic local
fallback.

Layering note: this module only depends on ``pydantic`` so the ``reporting``
package stays free of any ``api_service`` imports. ``api_service`` re-uses these
models for its ``response_model`` declarations.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ReportScope = Literal["today", "7d", "all"]
Severity = Literal["info", "low", "medium", "high"]
Priority = Literal["low", "medium", "high"]
DimensionStatus = Literal["good", "warning", "risk", "unknown"]
DataLevel = Literal["rich", "limited", "sparse"]


# --------------------------------------------------------------------------- #
# Request — activity data is supplied by the Electron client (camelCase), since
# the desktop activity tracker lives in the renderer/main process, not here.
# --------------------------------------------------------------------------- #
class ActivityAppUsageInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    app: str = "Unknown"
    category: str = "other"
    activeMs: int = 0
    focusCount: int = 0


class ActivitySessionInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str | None = None
    start: str | None = None
    end: str | None = None
    activeMs: int = 0
    appSwitches: int = 0
    topApp: str | None = None
    topCategory: str | None = None
    lateNight: bool = False


class ActivityDayInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    date: str
    activeMs: int = 0
    idleMs: int = 0
    breakCount: int = 0
    longestSessionMs: int = 0
    contextSwitches: int = 0
    lateNightMs: int = 0
    appUsage: list[ActivityAppUsageInput] = Field(default_factory=list)
    sessions: list[ActivitySessionInput] = Field(default_factory=list)


class ReportRequest(BaseModel):
    """Inputs for a report. ``from_ms``/``to_ms`` are authoritative when sent;
    otherwise the window is derived from ``scope`` + ``reference_ms``."""

    scope: ReportScope = "all"
    from_ms: int | None = None
    to_ms: int | None = None
    reference_ms: int | None = None
    activity_days: list[ActivityDayInput] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Deterministic statistics — always computed locally, used both to draw charts
# on the client and as grounding facts in the LLM prompt.
# --------------------------------------------------------------------------- #
class TrendPoint(BaseModel):
    label: str
    value: float


class NamedCount(BaseModel):
    name: str
    value: float


class MoodStats(BaseModel):
    total_checkins: int = 0
    latest_mood: str | None = None
    latest_note: str | None = None
    average_energy: float | None = None
    average_stress: float | None = None
    mood_counts: dict[str, int] = Field(default_factory=dict)
    energy_trend: list[TrendPoint] = Field(default_factory=list)
    stress_trend: list[TrendPoint] = Field(default_factory=list)
    timeline: list[dict] = Field(default_factory=list)


class PostureStats(BaseModel):
    total_sessions: int = 0
    total_snapshots: int = 0
    average_score: float | None = None
    time_good_pct: float | None = None
    event_counts: dict[str, int] = Field(default_factory=dict)
    score_trend: list[TrendPoint] = Field(default_factory=list)
    sessions: list[dict] = Field(default_factory=list)


class ActivityStats(BaseModel):
    days_count: int = 0
    total_active_ms: int = 0
    total_idle_ms: int = 0
    total_break_count: int = 0
    longest_session_ms: int = 0
    total_context_switches: int = 0
    total_late_night_ms: int = 0
    avg_active_ms_per_day: float = 0.0
    by_category: list[NamedCount] = Field(default_factory=list)
    top_apps: list[NamedCount] = Field(default_factory=list)
    active_trend: list[TrendPoint] = Field(default_factory=list)


class ReportStats(BaseModel):
    mood: MoodStats = Field(default_factory=MoodStats)
    posture: PostureStats = Field(default_factory=PostureStats)
    activity: ActivityStats = Field(default_factory=ActivityStats)


# --------------------------------------------------------------------------- #
# Analytical report — the part the LLM fills in (or the local fallback builds).
# --------------------------------------------------------------------------- #
class ReportMetric(BaseModel):
    label: str
    value: str
    hint: str | None = None


class ReportDimension(BaseModel):
    key: str
    label: str
    score: int = Field(ge=0, le=100)
    grade: str
    status: DimensionStatus = "unknown"
    summary: str
    metrics: list[ReportMetric] = Field(default_factory=list)


class ReportFinding(BaseModel):
    title: str
    detail: str
    severity: Severity = "info"
    category: str = "general"
    evidence: list[str] = Field(default_factory=list)


class ReportSuggestion(BaseModel):
    title: str
    detail: str
    priority: Priority = "medium"
    category: str = "general"
    timeframe: str | None = None
    effort: str | None = None


class DataQuality(BaseModel):
    level: DataLevel = "limited"
    note: str = ""
    sources_used: list[str] = Field(default_factory=list)


class AiReport(BaseModel):
    overall_score: int = Field(ge=0, le=100)
    overall_grade: str
    overall_status: DimensionStatus = "unknown"
    headline: str
    summary: str
    dimensions: list[ReportDimension] = Field(default_factory=list)
    key_findings: list[ReportFinding] = Field(default_factory=list)
    correlations: list[str] = Field(default_factory=list)
    suggestions: list[ReportSuggestion] = Field(default_factory=list)
    positives: list[str] = Field(default_factory=list)
    watch_outs: list[str] = Field(default_factory=list)
    data_quality: DataQuality = Field(default_factory=DataQuality)
    privacy_note: str = ""
    disclaimer: str = ""


# --------------------------------------------------------------------------- #
# Envelope
# --------------------------------------------------------------------------- #
class RagDocument(BaseModel):
    source: str
    title: str
    content: str
    score: float


class ReportPeriod(BaseModel):
    scope: ReportScope
    from_ms: int
    to_ms: int
    label: str


class ReportResponse(BaseModel):
    ok: bool = True
    used_llm: bool
    mode: Literal["llm", "fallback_local", "fallback_error"]
    generated_at_ms: int
    period: ReportPeriod
    report: AiReport
    stats: ReportStats
    retrieved_documents: list[RagDocument] = Field(default_factory=list)
    notice: str | None = None
