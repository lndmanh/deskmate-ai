from dataclasses import dataclass, field


@dataclass(frozen=True)
class EmotionDetectionResult:
    dominant_emotion: str | None
    confidence: float
    scores: dict[str, float] = field(default_factory=dict)
    available: bool = True
    reason: str | None = None
