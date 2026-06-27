from pydantic import BaseModel, Field


class PoseLandmarkSchema(BaseModel):
    x: float
    y: float
    z: float
    visibility: float = Field(default=1.0, ge=0.0, le=1.0)


class PoseFrameSchema(BaseModel):
    timestamp_ms: int
    landmarks: list[PoseLandmarkSchema]


class CalibrationRequest(BaseModel):
    session_id: str = "default"
    frames: list[PoseFrameSchema]


class CalibrationResponse(BaseModel):
    ok: bool
    reason: str | None = None
    session_id: str
    calibrated_at_ms: int | None = None


class AnalyzePostureRequest(BaseModel):
    session_id: str = "default"
    frame: PoseFrameSchema


class PostureFeatureResponse(BaseModel):
    shoulder_width: float
    shoulder_delta_y: float
    face_size: float
    eye_distance: float
    head_forward_ratio: float
    head_tilt_degrees: float
    visibility_confidence: float


class PostureIssueResponse(BaseModel):
    status: str
    severity: str
    confidence: float
    held_ms: int


class PostureAlertResponse(BaseModel):
    type: str
    severity: str
    confidence: float
    message: str
    held_ms: int


class PostureEventResponse(BaseModel):
    timestamp_ms: int
    type: str
    severity: str
    confidence: float
    score: int
    held_ms: int


class AnalyzePostureResponse(BaseModel):
    timestamp_ms: int
    status: str
    score: int
    confidence: float
    features: PostureFeatureResponse | None = None
    active_issues: list[PostureIssueResponse]
    alert: PostureAlertResponse | None = None
    event: PostureEventResponse | None = None
    stillness_ms: int = 0
    bad_posture_streak_ms: int = 0


class ChatContextSchema(BaseModel):
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
    extra_events: list[str] = Field(default_factory=list)


class ChatRequest(BaseModel):
    question: str
    context: ChatContextSchema | None = None


class RetrievedDocumentResponse(BaseModel):
    source: str
    title: str
    content: str
    score: float


class RagSearchRequest(BaseModel):
    query: str
    limit: int = Field(default=5, ge=1, le=20)


class RagSearchResponse(BaseModel):
    mode: str
    documents: list[RetrievedDocumentResponse]


class ChatResponseSchema(BaseModel):
    answer: str
    used_llm: bool
    retrieved_documents: list[RetrievedDocumentResponse]


class HealthResponse(BaseModel):
    ok: bool
    service: str


class ResetSessionResponse(BaseModel):
    ok: bool
    session_id: str


class MoodCheckInRequest(BaseModel):
    mood: str
    energy: int = Field(ge=1, le=5)
    stress: int = Field(ge=1, le=5)
    note: str | None = None
    timestamp_ms: int | None = None


class MoodCheckInResponse(BaseModel):
    id: str
    timestamp_ms: int
    mood: str
    energy: int
    stress: int
    note: str | None = None
    source: str


class MoodSummaryResponse(BaseModel):
    total_checkins: int
    latest_mood: str | None = None
    latest_note: str | None = None
    average_energy: float | None = None
    average_stress: float | None = None
    mood_counts: dict[str, int]


class EventRecordSchema(BaseModel):
    id: str
    timestamp: str
    source: str
    type: str
    severity: str | None = None
    confidence: float | None = None
    duration_seconds: int | None = None
    metadata: dict | None = None


class PrivacyCountersResponse(BaseModel):
    webcam_processing: str
    cloud_processing: bool
    raw_frames_stored: int
    data_shared_with_employer: bool
    posture_events_saved: int
    workday_events_saved: int
    nudge_events_saved: int


class DeleteEventsResponse(BaseModel):
    ok: bool
    deleted: bool


class DemoStartStopResponse(BaseModel):
    ok: bool
    message: str


class DemoStatusResponse(BaseModel):
    running: bool
    events_played: int


class BaselineComparisonResponse(BaseModel):
    average_breaks_per_day: float
    average_active_time_minutes: float
    usual_fatigue_window: str | None = None
    posture_risk_usually_after_minutes: int | None = None
    days_available: int


class RiskStateResponse(BaseModel):
    posture_strain: str
    break_debt: str
    fatigue_risk: str
    desk_health_score: int
    longest_session_minutes: int
    active_time_minutes: int
    break_count: int
    high_risk_period: str | None = None
    baseline: BaselineComparisonResponse | None = None
    computed_at: str
