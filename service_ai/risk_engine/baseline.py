from .types import BaselineComparison


def _as_float(value: object) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    return 0.0


def compute_baseline(recent_summaries: list[dict]) -> BaselineComparison:
    """Compute a personal baseline from up to 7 daily summary rows.

    Each summary is a row dict from ``event_store.get_recent_summaries()``.
    Must never crash on an empty store — 0 days of data yields zeroed
    averages and ``days_available == 0``.
    """
    days_available = len(recent_summaries)

    if days_available == 0:
        return BaselineComparison(
            average_breaks_per_day=0.0,
            average_active_time_minutes=0.0,
            usual_fatigue_window=None,
            posture_risk_usually_after_minutes=None,
            days_available=0,
        )

    total_breaks = sum(_as_float(s.get("break_count")) for s in recent_summaries)
    total_active = sum(_as_float(s.get("active_time_minutes")) for s in recent_summaries)

    return BaselineComparison(
        average_breaks_per_day=round(total_breaks / days_available, 2),
        average_active_time_minutes=round(total_active / days_available, 2),
        usual_fatigue_window=None,
        posture_risk_usually_after_minutes=None,
        days_available=days_available,
    )
