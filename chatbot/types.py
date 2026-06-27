from dataclasses import dataclass, field

from rag import RetrievedDocument


@dataclass(frozen=True)
class ChatMessage:
    role: str
    content: str


@dataclass(frozen=True)
class DeskMateContext:
    active_time: str | None = None
    longest_session: str | None = None
    current_session_minutes: int | None = None
    break_count: int | None = None
    posture_status: str | None = None
    posture_score: int | None = None
    posture_confidence: float | None = None
    posture_risk_events: int | None = None
    high_risk_period: str | None = None
    cloud_mode: bool = False
    raw_images_stored: int = 0
    latest_mood: str | None = None
    latest_mood_note: str | None = None
    average_energy: float | None = None
    average_stress: float | None = None
    extra_events: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class ChatResponse:
    answer: str
    used_llm: bool
    retrieved_documents: list[RetrievedDocument]
