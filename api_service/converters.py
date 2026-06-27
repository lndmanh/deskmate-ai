from chatbot import DeskMateContext
from posture_tracking import PoseFrame, PoseLandmark
from posture_tracking.types import (
    PostureAlert,
    PostureAnalysisResult,
    PostureEvent,
    PostureFeatures,
    PostureIssue,
)

from .schemas import (
    ChatContextSchema,
    PoseFrameSchema,
    PostureAlertResponse,
    PostureEventResponse,
    PostureFeatureResponse,
    PostureIssueResponse,
)


def to_pose_frame(frame: PoseFrameSchema) -> PoseFrame:
    return PoseFrame(
        timestamp_ms=frame.timestamp_ms,
        landmarks=[
            PoseLandmark(
                x=landmark.x,
                y=landmark.y,
                z=landmark.z,
                visibility=landmark.visibility,
            )
            for landmark in frame.landmarks
        ],
    )


def to_chat_context(context: ChatContextSchema | None) -> DeskMateContext:
    if context is None:
        return DeskMateContext()

    return DeskMateContext(
        active_time=context.active_time,
        longest_session=context.longest_session,
        current_session_minutes=context.current_session_minutes,
        break_count=context.break_count,
        posture_status=context.posture_status,
        posture_score=context.posture_score,
        posture_confidence=context.posture_confidence,
        posture_risk_events=context.posture_risk_events,
        high_risk_period=context.high_risk_period,
        cloud_mode=context.cloud_mode,
        raw_images_stored=context.raw_images_stored,
        latest_mood=context.latest_mood,
        latest_mood_note=context.latest_mood_note,
        average_energy=context.average_energy,
        average_stress=context.average_stress,
        extra_events=context.extra_events,
    )


def feature_to_response(features: PostureFeatures | None) -> PostureFeatureResponse | None:
    if features is None:
        return None

    return PostureFeatureResponse(
        shoulder_width=features.shoulder_width,
        shoulder_delta_y=features.shoulder_delta_y,
        face_size=features.face_size,
        eye_distance=features.eye_distance,
        head_forward_ratio=features.head_forward_ratio,
        head_tilt_degrees=features.head_tilt_degrees,
        visibility_confidence=features.visibility_confidence,
    )


def issue_to_response(issue: PostureIssue) -> PostureIssueResponse:
    return PostureIssueResponse(
        status=issue.status,
        severity=issue.severity,
        confidence=issue.confidence,
        held_ms=issue.held_ms,
    )


def alert_to_response(alert: PostureAlert | None) -> PostureAlertResponse | None:
    if alert is None:
        return None

    return PostureAlertResponse(
        type=alert.type,
        severity=alert.severity,
        confidence=alert.confidence,
        message=alert.message,
        held_ms=alert.held_ms,
    )


def event_to_response(event: PostureEvent | None) -> PostureEventResponse | None:
    if event is None:
        return None

    return PostureEventResponse(
        timestamp_ms=event.timestamp_ms,
        type=event.type,
        severity=event.severity,
        confidence=event.confidence,
        score=event.score,
        held_ms=event.held_ms,
    )


def posture_result_to_dict(result: PostureAnalysisResult, event: PostureEvent | None) -> dict[str, object]:
    return {
        "timestamp_ms": result.timestamp_ms,
        "status": result.status,
        "score": result.score,
        "confidence": result.confidence,
        "features": feature_to_response(result.features),
        "active_issues": [issue_to_response(issue) for issue in result.active_issues],
        "alert": alert_to_response(result.alert),
        "event": event_to_response(event),
        "stillness_ms": result.stillness_ms,
        "bad_posture_streak_ms": result.bad_posture_streak_ms,
    }
