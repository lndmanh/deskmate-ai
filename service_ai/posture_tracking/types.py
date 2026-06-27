from dataclasses import dataclass, field
from typing import Literal

PostureStatus = Literal[
    "good",
    "forward_head",
    "head_tilt",
    "shoulder_imbalance",
    "too_close",
    "too_far",
    "not_visible",
    "low_movement",
    "possible_drowsiness",
]

PostureIssueStatus = Literal[
    "forward_head",
    "head_tilt",
    "shoulder_imbalance",
    "too_close",
    "too_far",
    "low_movement",
    "possible_drowsiness",
]

PostureSeverity = Literal["low", "medium", "high"]

PostureEventType = Literal[
    "posture.forward_head",
    "posture.head_tilt",
    "posture.shoulder_imbalance",
    "posture.face_distance",
    "posture.not_visible",
    "fatigue.low_movement",
    "fatigue.possible_drowsiness",
]


@dataclass(frozen=True)
class PoseLandmark:
    x: float
    y: float
    z: float
    visibility: float


@dataclass(frozen=True)
class PoseFrame:
    timestamp_ms: int
    landmarks: list[PoseLandmark]


@dataclass(frozen=True)
class PostureCalibration:
    shoulder_width: float
    shoulder_balance_y: float
    face_size: float
    eye_distance: float
    head_forward_ratio: float
    head_tilt_degrees: float
    calibrated_at_ms: int


@dataclass(frozen=True)
class PostureFeatures:
    shoulder_width: float
    shoulder_delta_y: float
    face_size: float
    eye_distance: float
    head_forward_ratio: float
    head_tilt_degrees: float
    visibility_confidence: float


@dataclass(frozen=True)
class PostureThresholds:
    min_visibility: float = 0.55
    bad_posture_hold_ms: int = 5_000
    head_forward_ratio_delta: float = 0.18
    head_tilt_degrees_delta: float = 12.0
    shoulder_delta_ratio: float = 0.08
    too_close_face_scale: float = 1.25
    too_far_face_scale: float = 0.78
    stillness_movement_delta: float = 0.025
    low_movement_hold_ms: int = 30_000
    possible_drowsiness_hold_ms: int = 45_000
    drowsiness_head_drop_ratio_delta: float = 0.12


@dataclass(frozen=True)
class PostureIssue:
    status: PostureIssueStatus
    severity: PostureSeverity
    confidence: float
    held_ms: int


@dataclass(frozen=True)
class PostureAlert:
    type: PostureStatus
    severity: PostureSeverity
    confidence: float
    message: str
    held_ms: int


@dataclass(frozen=True)
class PostureAnalysisResult:
    timestamp_ms: int
    status: PostureStatus
    score: int
    confidence: float
    active_issues: list[PostureIssue] = field(default_factory=list)
    features: PostureFeatures | None = None
    alert: PostureAlert | None = None
    stillness_ms: int = 0
    bad_posture_streak_ms: int = 0


@dataclass(frozen=True)
class PostureEvent:
    timestamp_ms: int
    type: PostureEventType
    severity: PostureSeverity
    confidence: float
    score: int
    held_ms: int
