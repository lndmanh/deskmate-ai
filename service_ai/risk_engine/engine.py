from datetime import datetime, timedelta, timezone

from event_store import EventStore
from event_store.types import EventRecord

from .baseline import compute_baseline
from .types import BaselineComparison, RiskScore, RiskState

_POSTURE_PREFIX = "posture."
_WORKDAY_PREFIXES = ("work_session.", "break.", "idle.")
_HIGH_RISK_WINDOW = timedelta(minutes=30)
_MAX_EVENTS_PER_DAY = 100_000


# --------------------------------------------------------------------- scoring


def compute_posture_strain(posture_events_today: list[EventRecord]) -> str:
    high_count = sum(1 for e in posture_events_today if e.severity == "high")
    medium_count = sum(1 for e in posture_events_today if e.severity == "medium")
    if high_count >= 5:
        return "high"
    if high_count >= 2 or medium_count >= 5:
        return "medium"
    return "low"


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


def compute_fatigue_risk(posture_events_today: list[EventRecord], longest_session_minutes: int) -> str:
    stillness_events = [e for e in posture_events_today if e.type == "posture.stillness"]
    drowsiness_events = [
        e for e in posture_events_today
        if e.type in ("fatigue.low_movement", "fatigue.possible_drowsiness")
    ]
    if drowsiness_events or longest_session_minutes > 120:
        return "high"
    if stillness_events or longest_session_minutes > 90:
        return "medium"
    return "low"


def compute_desk_health_score(posture_strain: str, break_debt: str, fatigue_risk: str) -> int:
    strain_penalty = {"low": 0, "medium": 15, "high": 30}
    debt_penalty = {"low": 0, "medium": 10, "high": 20}
    fatigue_penalty = {"low": 0, "medium": 10, "high": 20}
    score = 100 - strain_penalty[posture_strain] - debt_penalty[break_debt] - fatigue_penalty[fatigue_risk]
    return max(0, min(100, score))


# ----------------------------------------------------------- derived workday metrics


def _parse_timestamp(timestamp: str) -> datetime | None:
    """Parse an ISO-8601 timestamp, tolerating a trailing ``Z`` and empty values."""
    if not timestamp:
        return None
    normalized = timestamp.replace("Z", "+00:00") if timestamp.endswith("Z") else timestamp
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    # Normalize offset-aware timestamps to UTC so the windowing and HH:MM
    # rendering stay consistent with the engine's UTC domain.
    return parsed.astimezone(timezone.utc)


def compute_active_time_minutes(workday_events_today: list[EventRecord]) -> int:
    """Sum of completed-session durations (`work_session.ended`), in minutes.

    Mirrors the daily-report aggregator (Task 04) so the report and risk
    engine never disagree on the same day's numbers.
    """
    total_seconds = sum(
        max(e.duration_seconds or 0, 0)
        for e in workday_events_today
        if e.type == "work_session.ended"
    )
    return total_seconds // 60


def compute_longest_session_minutes(workday_events_today: list[EventRecord]) -> int:
    """Longest single session, in minutes.

    Includes ``work_session.continuous`` (mid-session snapshots), not just
    ``.ended``, so fatigue risk and the desk-health score move visibly while
    a long session is still in progress — e.g. during demo playback.
    """
    durations = [
        max(e.duration_seconds or 0, 0)
        for e in workday_events_today
        if e.type in ("work_session.continuous", "work_session.ended")
    ]
    if not durations:
        return 0
    return max(durations) // 60


def compute_break_count(workday_events_today: list[EventRecord]) -> int:
    return sum(1 for e in workday_events_today if e.type == "break.started")


def compute_high_risk_period(posture_events_today: list[EventRecord]) -> str | None:
    """The 30-minute window with the highest density of high-severity posture events.

    Returns ``"HH:MM–HH:MM"`` for the densest window, or ``None`` when there
    are no high-severity posture events with parseable timestamps.
    """
    moments = sorted(
        m for m in (
            _parse_timestamp(e.timestamp)
            for e in posture_events_today
            if e.severity == "high"
        )
        if m is not None
    )
    if not moments:
        return None

    best_start = moments[0]
    best_count = 0
    for start in moments:
        window_end = start + _HIGH_RISK_WINDOW
        count = sum(1 for m in moments if start <= m < window_end)
        if count > best_count:
            best_count = count
            best_start = start

    end = best_start + _HIGH_RISK_WINDOW
    return f"{best_start:%H:%M}–{end:%H:%M}"


# ----------------------------------------------------------------------- engine


class RiskEngine:
    def __init__(self, event_store: EventStore) -> None:
        self._event_store = event_store
        self._last_state: RiskState | None = None

    def recompute(self) -> RiskState:
        """Re-read today's events from the store and recompute every score."""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        events = self._event_store.list_events(date=today, limit=_MAX_EVENTS_PER_DAY)

        posture_events = [e for e in events if e.type.startswith(_POSTURE_PREFIX)]
        workday_events = [
            e for e in events if any(e.type.startswith(p) for p in _WORKDAY_PREFIXES)
        ]

        active_time_minutes = compute_active_time_minutes(workday_events)
        longest_session_minutes = compute_longest_session_minutes(workday_events)
        break_count = compute_break_count(workday_events)

        score = self._score(posture_events, workday_events, active_time_minutes, longest_session_minutes)
        baseline = self._baseline()

        state = RiskState(
            posture_strain=score.posture_strain,
            break_debt=score.break_debt,
            fatigue_risk=score.fatigue_risk,
            desk_health_score=score.desk_health_score,
            longest_session_minutes=longest_session_minutes,
            active_time_minutes=active_time_minutes,
            break_count=break_count,
            high_risk_period=compute_high_risk_period(posture_events),
            baseline=baseline,
            computed_at=datetime.now(timezone.utc).isoformat(),
        )
        self._last_state = state
        return state

    def current_state(self) -> RiskState:
        """Return the last computed state, computing once lazily if needed."""
        if self._last_state is None:
            return self.recompute()
        return self._last_state

    def should_nudge(self) -> bool:
        """True when posture strain is high, break debt is high, or the longest
        session has run past 90 minutes."""
        state = self.current_state()
        return (
            state.posture_strain == "high"
            or state.break_debt == "high"
            or state.longest_session_minutes > 90
        )

    def _score(
        self,
        posture_events: list[EventRecord],
        workday_events: list[EventRecord],
        active_time_minutes: int,
        longest_session_minutes: int,
    ) -> RiskScore:
        posture_strain = compute_posture_strain(posture_events)
        break_debt = compute_break_debt(workday_events, active_time_minutes)
        fatigue_risk = compute_fatigue_risk(posture_events, longest_session_minutes)
        desk_health_score = compute_desk_health_score(posture_strain, break_debt, fatigue_risk)
        return RiskScore(
            posture_strain=posture_strain,
            break_debt=break_debt,
            fatigue_risk=fatigue_risk,
            desk_health_score=desk_health_score,
        )

    def _baseline(self) -> BaselineComparison:
        recent = self._event_store.get_recent_summaries(days=7)
        return compute_baseline(recent)
