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


class ChatHistoryMessageSchema(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    question: str
    context: ChatContextSchema | None = None
    history: list[ChatHistoryMessageSchema] = Field(default_factory=list)


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


class MoodAnalyzeTextRequest(BaseModel):
    text: str
    save_checkin: bool = False


class MoodCheckInResponse(BaseModel):
    id: str
    timestamp_ms: int
    mood: str
    energy: int
    stress: int
    note: str | None = None
    source: str
    camera_emotion_detection: bool = False


class MoodAnalyzeTextResponse(BaseModel):
    mood: str
    energy: int
    stress: int
    confidence: float
    reason: str
    used_llm: bool
    source: str
    saved_checkin_id: str | None = None
    camera_emotion_detection: bool = False


class MoodSummaryResponse(BaseModel):
    total_checkins: int
    latest_mood: str | None = None
    latest_note: str | None = None
    average_energy: float | None = None
    average_stress: float | None = None
    mood_counts: dict[str, int]
    source: str = "self_report"
    camera_emotion_detection: bool = False


class DeleteMoodHistoryResponse(BaseModel):
    ok: bool
    deleted: bool
