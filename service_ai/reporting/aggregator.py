"""Deterministic aggregation of raw signals into report statistics.

Pure functions only — no I/O, no LLM. These power both the client charts and the
factual grounding handed to the LLM, and they are the sole data source for the
local fallback report.
"""

import time
from collections import Counter
from datetime import datetime

from .types import (
    ActivityDayInput,
    ActivityStats,
    MoodStats,
    NamedCount,
    PostureStats,
    ReportRequest,
    ReportScope,
    ReportStats,
    TrendPoint,
)

_DAY_MS = 24 * 60 * 60 * 1000


# --------------------------------------------------------------------------- #
# Time helpers
# --------------------------------------------------------------------------- #
def _now_ms() -> int:
    return int(time.time() * 1000)


def _fmt_date(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000).strftime("%Y-%m-%d")


def _fmt_datetime(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000).strftime("%m-%d %H:%M")


def _iso_to_ms(value: str | None) -> int | None:
    if not value:
        return None
    try:
        return int(datetime.fromisoformat(value).timestamp() * 1000)
    except (ValueError, TypeError):
        return None


def _day_to_ms(date_str: str) -> int | None:
    try:
        return int(datetime.fromisoformat(f"{date_str}T00:00:00").timestamp() * 1000)
    except (ValueError, TypeError):
        return None


def resolve_period(request: ReportRequest) -> tuple[int, int, str]:
    """Return ``(from_ms, to_ms, label)`` for the requested window."""
    now_ms = request.reference_ms or _now_ms()

    if request.from_ms is not None and request.to_ms is not None:
        from_ms, to_ms = request.from_ms, request.to_ms
    elif request.scope == "today":
        start_of_day = datetime.fromtimestamp(now_ms / 1000).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        from_ms, to_ms = int(start_of_day.timestamp() * 1000), now_ms
    elif request.scope == "7d":
        from_ms, to_ms = now_ms - 7 * _DAY_MS, now_ms
    else:  # all
        from_ms, to_ms = 0, now_ms

    label = _period_label(request.scope, from_ms, to_ms)
    return from_ms, to_ms, label


def _period_label(scope: ReportScope, from_ms: int, to_ms: int) -> str:
    if scope == "today":
        return f"Today ({_fmt_date(to_ms)})"
    if scope == "7d":
        return f"Last 7 days ({_fmt_date(from_ms)} → {_fmt_date(to_ms)})"
    return f"All available data (through {_fmt_date(to_ms)})"


def _in_window(ms: int | None, from_ms: int, to_ms: int) -> bool:
    if ms is None:
        return from_ms <= 0  # keep undated records only for the "all" window
    return from_ms <= ms <= to_ms


# --------------------------------------------------------------------------- #
# Filtering
# --------------------------------------------------------------------------- #
def filter_mood(checkins: list[dict], from_ms: int, to_ms: int) -> list[dict]:
    return [c for c in checkins if _in_window(c.get("timestamp_ms"), from_ms, to_ms)]


def filter_posture(sessions: list[dict], from_ms: int, to_ms: int) -> list[dict]:
    return [
        s for s in sessions if _in_window(_iso_to_ms(s.get("started_at")), from_ms, to_ms)
    ]


def filter_activity(
    days: list[ActivityDayInput], from_ms: int, to_ms: int
) -> list[ActivityDayInput]:
    kept: list[ActivityDayInput] = []
    for day in days:
        day_ms = _day_to_ms(day.date)
        if day_ms is None:
            kept.append(day)  # cannot date it — trust the client's selection
        elif day_ms <= to_ms and day_ms + _DAY_MS > from_ms:
            kept.append(day)
    return kept


# --------------------------------------------------------------------------- #
# Per-domain statistics
# --------------------------------------------------------------------------- #
def compute_mood_stats(checkins: list[dict]) -> MoodStats:
    if not checkins:
        return MoodStats()

    ordered = sorted(checkins, key=lambda c: c.get("timestamp_ms", 0))
    energies = [c["energy"] for c in ordered if c.get("energy") is not None]
    stresses = [c["stress"] for c in ordered if c.get("stress") is not None]
    counts: Counter[str] = Counter(c.get("mood", "neutral") for c in ordered)
    latest = ordered[-1]

    return MoodStats(
        total_checkins=len(ordered),
        latest_mood=latest.get("mood"),
        latest_note=latest.get("note"),
        average_energy=round(sum(energies) / len(energies), 2) if energies else None,
        average_stress=round(sum(stresses) / len(stresses), 2) if stresses else None,
        mood_counts=dict(counts),
        energy_trend=[
            TrendPoint(label=_fmt_datetime(c["timestamp_ms"]), value=float(c["energy"]))
            for c in ordered
            if c.get("timestamp_ms") and c.get("energy") is not None
        ],
        stress_trend=[
            TrendPoint(label=_fmt_datetime(c["timestamp_ms"]), value=float(c["stress"]))
            for c in ordered
            if c.get("timestamp_ms") and c.get("stress") is not None
        ],
        timeline=[
            {
                "id": c.get("id"),
                "timestamp_ms": c.get("timestamp_ms"),
                "mood": c.get("mood"),
                "energy": c.get("energy"),
                "stress": c.get("stress"),
                "note": c.get("note"),
            }
            for c in ordered
        ],
    )


def compute_posture_stats(sessions: list[dict]) -> PostureStats:
    if not sessions:
        return PostureStats()

    ordered = sorted(sessions, key=lambda s: _iso_to_ms(s.get("started_at")) or 0)
    scores = [s["average_score"] for s in ordered if s.get("average_score") is not None]
    good_pcts = [s["time_good_pct"] for s in ordered if s.get("time_good_pct") is not None]
    total_snapshots = sum(s.get("total_snapshots", 0) for s in ordered)

    event_counts: Counter[str] = Counter()
    for s in ordered:
        for event_type, count in (s.get("event_counts") or {}).items():
            event_counts[event_type] += count

    return PostureStats(
        total_sessions=len(ordered),
        total_snapshots=total_snapshots,
        average_score=round(sum(scores) / len(scores), 1) if scores else None,
        time_good_pct=round(sum(good_pcts) / len(good_pcts), 1) if good_pcts else None,
        event_counts=dict(event_counts),
        score_trend=[
            TrendPoint(
                label=(
                    _fmt_datetime(_iso_to_ms(s["started_at"]))
                    if _iso_to_ms(s.get("started_at"))
                    else s.get("session_id", "session")
                ),
                value=float(s["average_score"]),
            )
            for s in ordered
            if s.get("average_score") is not None
        ],
        sessions=[
            {
                "session_id": s.get("session_id"),
                "started_at": s.get("started_at"),
                "ended_at": s.get("ended_at"),
                "average_score": s.get("average_score"),
                "total_snapshots": s.get("total_snapshots"),
                "time_good_pct": s.get("time_good_pct"),
                "event_counts": s.get("event_counts") or {},
            }
            for s in ordered
        ],
    )


def compute_activity_stats(days: list[ActivityDayInput]) -> ActivityStats:
    if not days:
        return ActivityStats()

    ordered = sorted(days, key=lambda d: d.date)
    total_active = sum(d.activeMs for d in ordered)

    category_ms: Counter[str] = Counter()
    app_ms: Counter[str] = Counter()
    for day in ordered:
        for usage in day.appUsage:
            category_ms[usage.category] += usage.activeMs
            app_ms[usage.app] += usage.activeMs

    return ActivityStats(
        days_count=len(ordered),
        total_active_ms=total_active,
        total_idle_ms=sum(d.idleMs for d in ordered),
        total_break_count=sum(d.breakCount for d in ordered),
        longest_session_ms=max((d.longestSessionMs for d in ordered), default=0),
        total_context_switches=sum(d.contextSwitches for d in ordered),
        total_late_night_ms=sum(d.lateNightMs for d in ordered),
        avg_active_ms_per_day=round(total_active / len(ordered), 1) if ordered else 0.0,
        by_category=[
            NamedCount(name=name, value=float(value))
            for name, value in category_ms.most_common()
        ],
        top_apps=[
            NamedCount(name=name, value=float(value))
            for name, value in app_ms.most_common(8)
        ],
        active_trend=[
            TrendPoint(label=d.date, value=float(d.activeMs)) for d in ordered
        ],
    )


def compute_stats(
    mood_checkins: list[dict],
    posture_sessions: list[dict],
    activity_days: list[ActivityDayInput],
) -> ReportStats:
    return ReportStats(
        mood=compute_mood_stats(mood_checkins),
        posture=compute_posture_stats(posture_sessions),
        activity=compute_activity_stats(activity_days),
    )
