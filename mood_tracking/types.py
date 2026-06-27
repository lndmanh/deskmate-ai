from dataclasses import dataclass, field
from typing import Literal

MoodLabel = Literal[
    "good",
    "tired",
    "stressed",
    "focused",
    "distracted",
    "calm",
    "overwhelmed",
    "neutral",
]


@dataclass(frozen=True)
class MoodCheckIn:
    id: str
    timestamp_ms: int
    mood: MoodLabel
    energy: int
    stress: int
    note: str | None = None
    source: str = "self_report"


@dataclass(frozen=True)
class MoodSummary:
    total_checkins: int
    latest_mood: MoodLabel | None = None
    latest_note: str | None = None
    average_energy: float | None = None
    average_stress: float | None = None
    mood_counts: dict[str, int] = field(default_factory=dict)
