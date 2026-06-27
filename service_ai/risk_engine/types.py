from dataclasses import dataclass


@dataclass
class RiskScore:
    posture_strain: str       # low|medium|high
    break_debt: str           # low|medium|high
    fatigue_risk: str         # low|medium|high
    desk_health_score: int    # 0–100


@dataclass
class BaselineComparison:
    average_breaks_per_day: float
    average_active_time_minutes: float
    usual_fatigue_window: str | None              # e.g. "14:00–16:00"
    posture_risk_usually_after_minutes: int | None  # e.g. 60
    days_available: int                            # how many days of data (0–7)


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
