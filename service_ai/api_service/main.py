from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from posture_tracking import PostureAnalyzer, create_posture_calibration

from .config import load_environment

load_environment()

from .converters import posture_result_to_dict, to_chat_context, to_pose_frame
from .schemas import (
    AnalyzePostureRequest,
    AnalyzePostureResponse,
    CalibrationRequest,
    CalibrationResponse,
    ChatRequest,
    ChatResponseSchema,
    DeleteMoodHistoryResponse,
    HealthResponse,
    MoodAnalyzeTextRequest,
    MoodAnalyzeTextResponse,
    MoodCheckInRequest,
    MoodCheckInResponse,
    MoodSummaryResponse,
    RagSearchRequest,
    RagSearchResponse,
    ResetSessionResponse,
    RetrievedDocumentResponse,
)
from .state import api_state

from reporting import ReportRequest, ReportResponse

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


@app.post("/mood/analyze-text", response_model=MoodAnalyzeTextResponse)
def analyze_mood_text(request: MoodAnalyzeTextRequest) -> MoodAnalyzeTextResponse:
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text không được để trống.")

    analysis = api_state.mood_text_analyzer.analyze(request.text)
    saved_checkin_id = None

    if request.save_checkin:
        checkin = api_state.mood_store.add_checkin(
            mood=analysis.mood,
            energy=analysis.energy,
            stress=analysis.stress,
            note=request.text,
        )
        saved_checkin_id = checkin.id

    return MoodAnalyzeTextResponse(
        mood=analysis.mood,
        energy=analysis.energy,
        stress=analysis.stress,
        confidence=analysis.confidence,
        reason=analysis.reason,
        used_llm=analysis.used_llm,
        source=analysis.source,
        saved_checkin_id=saved_checkin_id,
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


@app.get("/data")
def get_data() -> dict:
    return api_state.app_data.get_all()


@app.delete("/data")
def delete_data() -> dict:
    api_state.app_data.delete_all()
    return {"ok": True}


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


@app.post("/report", response_model=ReportResponse)
def generate_report(request: ReportRequest) -> ReportResponse:
    """Build a comprehensive desk-health report.

    Aggregates the user's mood + posture (from the app data store) and the
    activity-tracker data supplied in the request, retrieves relevant
    knowledge-base context, and returns a fixed-structure analysis + ratings +
    suggestions (AI-written when ``OPENAI_API_KEY`` is set, otherwise computed
    locally).
    """
    return api_state.report_generator.generate(
        request=request,
        mood_checkins=api_state.app_data.get_mood(),
        posture_sessions=api_state.app_data.get_posture_sessions(),
    )
