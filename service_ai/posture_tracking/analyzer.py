from dataclasses import dataclass

from .geometry import clamp, extract_posture_features
from .types import (
    PoseFrame,
    PostureAlert,
    PostureAnalysisResult,
    PostureCalibration,
    PostureEvent,
    PostureEventType,
    PostureIssue,
    PostureIssueStatus,
    PostureSeverity,
    PostureStatus,
    PostureThresholds,
)

ALERT_MESSAGES: dict[PostureStatus, str] = {
    "forward_head": "Bạn đang cúi đầu quá lâu. Hãy đưa cổ về vị trí trung lập nhé.",
    "head_tilt": "Đầu đang nghiêng khá lâu. Hãy cân bằng lại cổ và vai.",
    "shoulder_imbalance": "Hai vai đang lệch. Hãy thả lỏng và điều chỉnh vai cân bằng.",
    "too_close": "Bạn đang ngồi quá gần màn hình. Hãy lùi ra một chút để mắt thoải mái hơn.",
    "too_far": "Bạn đang ngồi khá xa màn hình. Hãy điều chỉnh khoảng cách nhìn cho thoải mái.",
    "not_visible": "Webcam chưa thấy rõ phần đầu và vai. Hãy điều chỉnh vị trí ngồi trong khung hình.",
    "low_movement": "Bạn ít chuyển động khá lâu rồi. Nghỉ ngắn 60–90 giây để reset nhé.",
    "possible_drowsiness": "Mình thấy tín hiệu đầu/cổ ít ổn định và ít chuyển động. Nếu bạn thấy mệt, nghỉ 2 phút nhé.",
    "good": "Tư thế hiện tại ổn.",
}


@dataclass(frozen=True)
class IssueState:
    started_at_ms: int
    last_seen_at_ms: int


class PostureAnalyzer:
    def __init__(
        self,
        calibration: PostureCalibration | None = None,
        thresholds: PostureThresholds | None = None,
    ) -> None:
        self.calibration = calibration
        self.thresholds = thresholds or PostureThresholds()
        self.issue_states: dict[PostureIssueStatus, IssueState] = {}
        self.last_alert_type: PostureStatus | None = None
        self.previous_features = None
        self.stillness_started_at_ms: int | None = None
        self.bad_posture_streak_started_at_ms: int | None = None

    def set_calibration(self, calibration: PostureCalibration) -> None:
        self.calibration = calibration
        self.issue_states = {}
        self.last_alert_type = None
        self.previous_features = None
        self.stillness_started_at_ms = None
        self.bad_posture_streak_started_at_ms = None

    def analyze(self, frame: PoseFrame) -> PostureAnalysisResult:
        features = extract_posture_features(frame.landmarks)

        if features is None or features.visibility_confidence < self.thresholds.min_visibility:
            confidence = features.visibility_confidence if features is not None else 0.0
            return PostureAnalysisResult(
                timestamp_ms=frame.timestamp_ms,
                status="not_visible",
                score=0,
                confidence=confidence,
                features=features,
                active_issues=[],
                alert=PostureAlert(
                    type="not_visible",
                    severity="medium",
                    confidence=confidence,
                    message=ALERT_MESSAGES["not_visible"],
                    held_ms=0,
                ),
                stillness_ms=0,
                bad_posture_streak_ms=0,
            )

        if self.calibration is None:
            return PostureAnalysisResult(
                timestamp_ms=frame.timestamp_ms,
                status="good",
                score=100,
                confidence=features.visibility_confidence,
                features=features,
                active_issues=[],
                stillness_ms=0,
                bad_posture_streak_ms=0,
            )

        detected_issues = self._detect_issues(frame.timestamp_ms, features)
        stillness_ms = self._update_stillness(frame.timestamp_ms, features)
        detected_issues.extend(self._detect_fatigue_issues(frame.timestamp_ms, features, detected_issues, stillness_ms))
        active_issues = self._update_issue_state(frame.timestamp_ms, detected_issues)
        score = self._calculate_score(active_issues)
        status = self._pick_primary_status(active_issues)
        bad_posture_streak_ms = self._update_bad_posture_streak(frame.timestamp_ms, active_issues)
        alert = self._create_alert(status, active_issues)

        return PostureAnalysisResult(
            timestamp_ms=frame.timestamp_ms,
            status=status,
            score=score,
            confidence=features.visibility_confidence,
            features=features,
            active_issues=active_issues,
            alert=alert,
            stillness_ms=stillness_ms,
            bad_posture_streak_ms=bad_posture_streak_ms,
        )

    def to_event(self, result: PostureAnalysisResult) -> PostureEvent | None:
        if result.status == "good":
            return None

        if result.status == "not_visible":
            return PostureEvent(
                timestamp_ms=result.timestamp_ms,
                type="posture.not_visible",
                severity="medium",
                confidence=result.confidence,
                score=result.score,
                held_ms=0,
            )

        if result.status == "low_movement":
            issue = next((active_issue for active_issue in result.active_issues if active_issue.status == "low_movement"), None)
            return PostureEvent(
                timestamp_ms=result.timestamp_ms,
                type="fatigue.low_movement",
                severity=issue.severity if issue is not None else "medium",
                confidence=issue.confidence if issue is not None else result.confidence,
                score=result.score,
                held_ms=issue.held_ms if issue is not None else result.stillness_ms,
            )

        if result.status == "possible_drowsiness":
            issue = next((active_issue for active_issue in result.active_issues if active_issue.status == "possible_drowsiness"), None)
            return PostureEvent(
                timestamp_ms=result.timestamp_ms,
                type="fatigue.possible_drowsiness",
                severity=issue.severity if issue is not None else "medium",
                confidence=issue.confidence if issue is not None else result.confidence,
                score=result.score,
                held_ms=issue.held_ms if issue is not None else result.stillness_ms,
            )

        issue = next((active_issue for active_issue in result.active_issues if active_issue.status == result.status), None)

        if issue is None:
            return None

        return PostureEvent(
            timestamp_ms=result.timestamp_ms,
            type=self._to_event_type(issue.status),
            severity=issue.severity,
            confidence=issue.confidence,
            score=result.score,
            held_ms=issue.held_ms,
        )

    def _detect_issues(self, timestamp_ms: int, features) -> list[PostureIssue]:
        calibration = self.calibration
        if calibration is None:
            return []

        issues: list[PostureIssue] = []
        shoulder_delta_limit = max(
            calibration.shoulder_width * self.thresholds.shoulder_delta_ratio,
            calibration.shoulder_balance_y * 1.6,
        )
        head_forward_delta = features.head_forward_ratio - calibration.head_forward_ratio
        head_tilt_delta = abs(features.head_tilt_degrees - calibration.head_tilt_degrees)
        face_scale = features.face_size / calibration.face_size if calibration.face_size != 0 else 1.0

        if head_forward_delta > self.thresholds.head_forward_ratio_delta:
            issues.append(
                self._create_instant_issue(
                    "forward_head",
                    head_forward_delta / self.thresholds.head_forward_ratio_delta,
                    timestamp_ms,
                )
            )

        if head_tilt_delta > self.thresholds.head_tilt_degrees_delta:
            issues.append(
                self._create_instant_issue(
                    "head_tilt",
                    head_tilt_delta / self.thresholds.head_tilt_degrees_delta,
                    timestamp_ms,
                )
            )

        if features.shoulder_delta_y > shoulder_delta_limit:
            issues.append(
                self._create_instant_issue(
                    "shoulder_imbalance",
                    features.shoulder_delta_y / shoulder_delta_limit,
                    timestamp_ms,
                )
            )

        if face_scale > self.thresholds.too_close_face_scale:
            issues.append(
                self._create_instant_issue(
                    "too_close",
                    face_scale / self.thresholds.too_close_face_scale,
                    timestamp_ms,
                )
            )

        if face_scale < self.thresholds.too_far_face_scale:
            issues.append(
                self._create_instant_issue(
                    "too_far",
                    self.thresholds.too_far_face_scale / max(face_scale, 0.01),
                    timestamp_ms,
                )
            )

        return issues

    def _detect_fatigue_issues(
        self,
        timestamp_ms: int,
        features,
        posture_issues: list[PostureIssue],
        stillness_ms: int,
    ) -> list[PostureIssue]:
        issues: list[PostureIssue] = []

        if stillness_ms >= self.thresholds.low_movement_hold_ms:
            issues.append(
                PostureIssue(
                    status="low_movement",
                    severity="medium" if stillness_ms < self.thresholds.possible_drowsiness_hold_ms else "high",
                    confidence=0.72,
                    held_ms=stillness_ms,
                )
            )

        if stillness_ms < self.thresholds.possible_drowsiness_hold_ms:
            return issues

        calibration = self.calibration
        if calibration is None:
            return issues

        head_drop_signal = features.head_forward_ratio - calibration.head_forward_ratio
        has_head_posture_issue = any(issue.status in ["forward_head", "head_tilt"] for issue in posture_issues)

        if has_head_posture_issue or head_drop_signal > self.thresholds.drowsiness_head_drop_ratio_delta:
            issues.append(
                PostureIssue(
                    status="possible_drowsiness",
                    severity="medium" if stillness_ms < 90_000 else "high",
                    confidence=0.68,
                    held_ms=stillness_ms,
                )
            )

        return issues

    def _create_instant_issue(
        self,
        status: PostureIssueStatus,
        strength: float,
        timestamp_ms: int,
    ) -> PostureIssue:
        return PostureIssue(
            status=status,
            severity=self._severity_from_strength(strength),
            confidence=clamp(0.55 + strength * 0.2, 0.0, 0.98),
            held_ms=timestamp_ms,
        )

    def _update_issue_state(self, timestamp_ms: int, detected_issues: list[PostureIssue]) -> list[PostureIssue]:
        next_states: dict[PostureIssueStatus, IssueState] = {}
        active_issues: list[PostureIssue] = []

        for issue in detected_issues:
            previous_state = self.issue_states.get(issue.status)
            state = (
                IssueState(started_at_ms=previous_state.started_at_ms, last_seen_at_ms=timestamp_ms)
                if previous_state is not None
                else IssueState(started_at_ms=timestamp_ms, last_seen_at_ms=timestamp_ms)
            )

            next_states[issue.status] = state
            active_issues.append(
                PostureIssue(
                    status=issue.status,
                    severity=issue.severity,
                    confidence=issue.confidence,
                    held_ms=issue.held_ms if issue.status in ["low_movement", "possible_drowsiness"] else timestamp_ms - state.started_at_ms,
                )
            )

        self.issue_states = next_states
        return active_issues

    def _calculate_score(self, active_issues: list[PostureIssue]) -> int:
        penalty = 0

        for issue in active_issues:
            if issue.status == "low_movement":
                severity_penalty = 8 if issue.severity == "medium" else 12
            elif issue.status == "possible_drowsiness":
                severity_penalty = 14 if issue.severity == "medium" else 20
            else:
                severity_penalty = 24 if issue.severity == "high" else 16 if issue.severity == "medium" else 9
            duration_penalty = 10 if issue.held_ms >= self.thresholds.bad_posture_hold_ms else 0
            penalty += severity_penalty + duration_penalty

        return round(clamp(100 - penalty, 0, 100))

    def _pick_primary_status(self, active_issues: list[PostureIssue]) -> PostureStatus:
        if not active_issues:
            return "good"

        sorted_issues = sorted(
            active_issues,
            key=lambda issue: (self._status_priority(issue.status), self._severity_weight(issue.severity), issue.held_ms),
            reverse=True,
        )
        return sorted_issues[0].status

    def _create_alert(
        self,
        status: PostureStatus,
        active_issues: list[PostureIssue],
    ) -> PostureAlert | None:
        if status in ["good", "not_visible"]:
            return None

        issue = next((active_issue for active_issue in active_issues if active_issue.status == status), None)

        if issue is None or issue.held_ms < self.thresholds.bad_posture_hold_ms:
            return None

        if self.last_alert_type == status:
            return None

        self.last_alert_type = status

        return PostureAlert(
            type=status,
            severity=issue.severity,
            confidence=issue.confidence,
            message=ALERT_MESSAGES[status],
            held_ms=issue.held_ms,
        )

    def _update_stillness(self, timestamp_ms: int, features) -> int:
        if self.previous_features is None:
            self.previous_features = features
            self.stillness_started_at_ms = timestamp_ms
            return 0

        movement_delta = self._feature_movement_delta(self.previous_features, features)
        self.previous_features = features

        if movement_delta <= self.thresholds.stillness_movement_delta:
            if self.stillness_started_at_ms is None:
                self.stillness_started_at_ms = timestamp_ms
            return timestamp_ms - self.stillness_started_at_ms

        self.stillness_started_at_ms = timestamp_ms
        return 0

    def _feature_movement_delta(self, previous, current) -> float:
        return (
            abs(previous.head_forward_ratio - current.head_forward_ratio)
            + abs(previous.head_tilt_degrees - current.head_tilt_degrees) / 180
            + abs(previous.shoulder_delta_y - current.shoulder_delta_y)
            + abs(previous.face_size - current.face_size)
        )

    def _update_bad_posture_streak(self, timestamp_ms: int, active_issues: list[PostureIssue]) -> int:
        has_bad_posture_issue = any(
            issue.status not in ["low_movement", "possible_drowsiness"] for issue in active_issues
        )

        if has_bad_posture_issue:
            if self.bad_posture_streak_started_at_ms is None:
                self.bad_posture_streak_started_at_ms = timestamp_ms
            return timestamp_ms - self.bad_posture_streak_started_at_ms

        self.bad_posture_streak_started_at_ms = None
        return 0

    def _severity_from_strength(self, strength: float) -> PostureSeverity:
        if strength >= 1.8:
            return "high"
        if strength >= 1.25:
            return "medium"
        return "low"

    def _severity_weight(self, severity: PostureSeverity) -> int:
        if severity == "high":
            return 3
        if severity == "medium":
            return 2
        return 1

    def _status_priority(self, status: PostureIssueStatus) -> int:
        priorities = {
            "possible_drowsiness": 6,
            "forward_head": 5,
            "head_tilt": 4,
            "shoulder_imbalance": 3,
            "too_close": 3,
            "too_far": 2,
            "low_movement": 1,
        }
        return priorities.get(status, 0)

    def _to_event_type(self, status: PostureIssueStatus) -> PostureEventType:
        if status == "forward_head":
            return "posture.forward_head"
        if status == "head_tilt":
            return "posture.head_tilt"
        if status == "shoulder_imbalance":
            return "posture.shoulder_imbalance"
        if status == "low_movement":
            return "fatigue.low_movement"
        if status == "possible_drowsiness":
            return "fatigue.possible_drowsiness"
        return "posture.face_distance"
