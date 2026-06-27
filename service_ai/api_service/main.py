from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from posture_tracking import PostureAnalyzer, create_posture_calibration

from .config import load_environment

load_environment()

from .converters import posture_result_to_dict, to_chat_context, to_pose_frame
from .schemas import (
    AnalyzePostureRequest,
    AnalyzePostureResponse,
    BaselineComparisonResponse,
    CalibrationRequest,
    CalibrationResponse,
    ChatRequest,
    ChatResponseSchema,
    DeleteEventsResponse,
    DeleteMoodHistoryResponse,
    DemoStartStopResponse,
    DemoStatusResponse,
    EventRecordSchema,
    HealthResponse,
    MoodCheckInRequest,
    MoodCheckInResponse,
    MoodSummaryResponse,
    PrivacyCountersResponse,
    RagSearchRequest,
    RagSearchResponse,
    ResetSessionResponse,
    RetrievedDocumentResponse,
    RiskStateResponse,
)
from .state import api_state

app = FastAPI(
    title="DeskMate AI API",
    description="FastAPI service for posture tracking and DeskMate chatbot.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(ok=True, service="deskmate-ai-api")


@app.post("/posture/calibrate", response_model=CalibrationResponse)
def calibrate_posture(request: CalibrationRequest) -> CalibrationResponse:
    frames = [to_pose_frame(frame) for frame in request.frames]
    calibration_result = create_posture_calibration(frames)

    if not calibration_result.ok or calibration_result.calibration is None:
        return CalibrationResponse(
            ok=False,
            reason=calibration_result.reason,
            session_id=request.session_id,
        )

    api_state.posture_analyzers[request.session_id] = PostureAnalyzer(calibration_result.calibration)

    return CalibrationResponse(
        ok=True,
        session_id=request.session_id,
        calibrated_at_ms=calibration_result.calibration.calibrated_at_ms,
    )


@app.post("/posture/analyze", response_model=AnalyzePostureResponse)
def analyze_posture(request: AnalyzePostureRequest) -> AnalyzePostureResponse:
    analyzer = api_state.posture_analyzers.get(request.session_id)

    if analyzer is None:
        raise HTTPException(
            status_code=400,
            detail="Session chưa được hiệu chuẩn. Hãy gọi /posture/calibrate trước.",
        )

    frame = to_pose_frame(request.frame)
    result = analyzer.analyze(frame)
    event = analyzer.to_event(result)
    return AnalyzePostureResponse(**posture_result_to_dict(result, event))


@app.delete("/posture/session/{session_id}", response_model=ResetSessionResponse)
def reset_posture_session(session_id: str) -> ResetSessionResponse:
    api_state.posture_analyzers.pop(session_id, None)
    return ResetSessionResponse(ok=True, session_id=session_id)


@app.post("/chat", response_model=ChatResponseSchema)
def chat(request: ChatRequest) -> ChatResponseSchema:
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Câu hỏi không được để trống.")

    chat_context = to_chat_context(request.context)
    mood_summary_data = api_state.mood_store.summarize(limit=20)

    if chat_context.latest_mood is None and mood_summary_data.latest_mood is not None:
        chat_context = chat_context.__class__(
            active_time=chat_context.active_time,
            longest_session=chat_context.longest_session,
            current_session_minutes=chat_context.current_session_minutes,
            break_count=chat_context.break_count,
            posture_status=chat_context.posture_status,
            posture_score=chat_context.posture_score,
            posture_confidence=chat_context.posture_confidence,
            posture_risk_events=chat_context.posture_risk_events,
            high_risk_period=chat_context.high_risk_period,
            cloud_mode=chat_context.cloud_mode,
            raw_images_stored=chat_context.raw_images_stored,
            latest_mood=mood_summary_data.latest_mood,
            latest_mood_note=mood_summary_data.latest_note,
            average_energy=mood_summary_data.average_energy,
            average_stress=mood_summary_data.average_stress,
            extra_events=chat_context.extra_events,
        )

    response = api_state.coach.ask(request.question, chat_context)

    return ChatResponseSchema(
        answer=response.answer,
        used_llm=response.used_llm,
        retrieved_documents=[
            RetrievedDocumentResponse(
                source=document.source,
                title=document.title,
                content=document.content,
                score=document.score,
            )
            for document in response.retrieved_documents
        ],
    )


@app.post("/mood/check-in", response_model=MoodCheckInResponse)
def mood_check_in(request: MoodCheckInRequest) -> MoodCheckInResponse:
    allowed_moods = {"good", "tired", "stressed", "focused", "distracted", "calm", "overwhelmed", "neutral"}

    if request.mood not in allowed_moods:
        raise HTTPException(
            status_code=400,
            detail=f"Mood không hợp lệ. Chọn một trong: {', '.join(sorted(allowed_moods))}",
        )

    checkin = api_state.mood_store.add_checkin(
        mood=request.mood,
        energy=request.energy,
        stress=request.stress,
        note=request.note,
        timestamp_ms=request.timestamp_ms,
    )

    return MoodCheckInResponse(
        id=checkin.id,
        timestamp_ms=checkin.timestamp_ms,
        mood=checkin.mood,
        energy=checkin.energy,
        stress=checkin.stress,
        note=checkin.note,
        source=checkin.source,
        camera_emotion_detection=False,
    )


@app.get("/mood/recent", response_model=list[MoodCheckInResponse])
def recent_mood_checkins(limit: int = 10) -> list[MoodCheckInResponse]:
    checkins = api_state.mood_store.list_checkins(limit=limit)
    return [
        MoodCheckInResponse(
            id=checkin.id,
            timestamp_ms=checkin.timestamp_ms,
            mood=checkin.mood,
            energy=checkin.energy,
            stress=checkin.stress,
            note=checkin.note,
            source=checkin.source,
            camera_emotion_detection=False,
        )
        for checkin in checkins
    ]


@app.get("/mood/summary", response_model=MoodSummaryResponse)
def mood_summary(limit: int = 20) -> MoodSummaryResponse:
    summary = api_state.mood_store.summarize(limit=limit)
    return MoodSummaryResponse(
        total_checkins=summary.total_checkins,
        latest_mood=summary.latest_mood,
        latest_note=summary.latest_note,
        average_energy=summary.average_energy,
        average_stress=summary.average_stress,
        mood_counts=summary.mood_counts,
        source="self_report",
        camera_emotion_detection=False,
    )


@app.delete("/mood/history", response_model=DeleteMoodHistoryResponse)
def delete_mood_history() -> DeleteMoodHistoryResponse:
    api_state.mood_store.delete_all()
    return DeleteMoodHistoryResponse(ok=True, deleted=True)


@app.post("/demo/start", response_model=DemoStartStopResponse)
def demo_start() -> DemoStartStopResponse:
    api_state.demo_player.start()
    return DemoStartStopResponse(ok=True, message="Demo mode started")


@app.post("/demo/stop", response_model=DemoStartStopResponse)
def demo_stop() -> DemoStartStopResponse:
    api_state.demo_player.stop()
    return DemoStartStopResponse(ok=True, message="Demo mode stopped")


@app.get("/demo/status", response_model=DemoStatusResponse)
def demo_status() -> DemoStatusResponse:
    return DemoStatusResponse(
        running=api_state.demo_player.is_running,
        events_played=api_state.demo_player.events_played,
    )


def _baseline_to_schema(baseline: object | None) -> BaselineComparisonResponse | None:
    if baseline is None:
        return None
    return BaselineComparisonResponse(
        average_breaks_per_day=baseline.average_breaks_per_day,
        average_active_time_minutes=baseline.average_active_time_minutes,
        usual_fatigue_window=baseline.usual_fatigue_window,
        posture_risk_usually_after_minutes=baseline.posture_risk_usually_after_minutes,
        days_available=baseline.days_available,
    )


@app.get("/risk/current", response_model=RiskStateResponse)
def risk_current() -> RiskStateResponse:
    state = api_state.risk_engine.recompute()
    return RiskStateResponse(
        posture_strain=state.posture_strain,
        break_debt=state.break_debt,
        fatigue_risk=state.fatigue_risk,
        desk_health_score=state.desk_health_score,
        longest_session_minutes=state.longest_session_minutes,
        active_time_minutes=state.active_time_minutes,
        break_count=state.break_count,
        high_risk_period=state.high_risk_period,
        baseline=_baseline_to_schema(state.baseline),
        computed_at=state.computed_at,
    )


@app.get("/risk/baseline", response_model=BaselineComparisonResponse)
def risk_baseline() -> BaselineComparisonResponse:
    state = api_state.risk_engine.recompute()
    schema = _baseline_to_schema(state.baseline)
    if schema is None:
        return BaselineComparisonResponse(
            average_breaks_per_day=0.0,
            average_active_time_minutes=0.0,
            usual_fatigue_window=None,
            posture_risk_usually_after_minutes=None,
            days_available=0,
        )
    return schema


@app.get("/events", response_model=list[EventRecordSchema])
def list_events(
    date: str | None = None,
    type: str | None = None,
    limit: int = 100,
) -> list[EventRecordSchema]:
    records = api_state.event_store.list_events(date=date, event_type=type, limit=limit)
    return [
        EventRecordSchema(
            id=r.id,
            timestamp=r.timestamp,
            source=r.source,
            type=r.type,
            severity=r.severity,
            confidence=r.confidence,
            duration_seconds=r.duration_seconds,
            metadata=r.metadata,
        )
        for r in records
    ]


@app.get("/events/privacy-counters", response_model=PrivacyCountersResponse)
def get_privacy_counters() -> PrivacyCountersResponse:
    c = api_state.event_store.privacy_counters()
    return PrivacyCountersResponse(
        webcam_processing=c.webcam_processing,
        cloud_processing=c.cloud_processing,
        raw_frames_stored=c.raw_frames_stored,
        data_shared_with_employer=c.data_shared_with_employer,
        camera_emotion_detection=False,
        emotion_inference_from_face=False,
        posture_events_saved=c.posture_events_saved,
        workday_events_saved=c.workday_events_saved,
        nudge_events_saved=c.nudge_events_saved,
    )


@app.delete("/events", response_model=DeleteEventsResponse)
def delete_events() -> DeleteEventsResponse:
    api_state.event_store.delete_all()
    return DeleteEventsResponse(ok=True, deleted=True)


@app.post("/rag/search", response_model=RagSearchResponse)
def rag_search(request: RagSearchRequest) -> RagSearchResponse:
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query không được để trống.")

    documents = api_state.coach.rag_store.search(request.query, limit=request.limit)

    return RagSearchResponse(
        mode=api_state.coach.rag_store.last_mode,
        documents=[
            RetrievedDocumentResponse(
                source=document.source,
                title=document.title,
                content=document.content,
                score=document.score,
            )
            for document in documents
        ],
    )
