import json
from datetime import datetime
from pathlib import Path

from .types import PostureAnalysisResult, PostureEvent, PostureFeatures

_SNAPSHOT_INTERVAL_MS = 30_000


class PostureSessionRecorder:
    """Ghi lại tiến trình một phiên theo dõi tư thế.

    Chỉ lưu kết quả đã tính toán (status, score, features...) — không bao giờ
    lưu raw pixel hay landmark thô.
    """

    def __init__(self, base_dir: str | Path = "data/posture_sessions") -> None:
        now = datetime.now()
        self.session_id = now.strftime("session_%Y%m%d_%H%M%S")
        self._created_at = now.isoformat(timespec="seconds")
        self._session_dir = Path(base_dir)
        self._session_dir.mkdir(parents=True, exist_ok=True)

        self._events: list[dict[str, object]] = []
        self._snapshots: list[dict[str, object]] = []
        self._last_event_type: str | None = None
        self._last_snapshot_ms: int | None = None

    def record(self, result: PostureAnalysisResult, event: PostureEvent | None) -> None:
        """Gọi mỗi frame. Ghi event khi đổi loại (tránh spam) và snapshot mỗi 30s."""
        # Event: chỉ ghi khi type thay đổi so với lần trước.
        if event is None:
            # Quay lại trạng thái tốt → reset để lần xấu kế tiếp được ghi lại.
            self._last_event_type = None
        elif event.type != self._last_event_type:
            self._events.append(self._event_to_dict(event))
            self._last_event_type = event.type

        # Snapshot: lấy mẫu đầu tiên ngay lập tức, sau đó mỗi 30s theo result.timestamp_ms.
        if (
            self._last_snapshot_ms is None
            or result.timestamp_ms - self._last_snapshot_ms >= _SNAPSHOT_INTERVAL_MS
        ):
            self._snapshots.append(self._snapshot_to_dict(result))
            self._last_snapshot_ms = result.timestamp_ms

    def save(self) -> Path:
        """Ghi phiên ra file JSON, kèm summary đã tính toán. Trả về đường dẫn file."""
        payload: dict[str, object] = {
            "session_id": self.session_id,
            "created_at": self._created_at,
            "summary": self._summarize(),
            "events": self._events,
            "snapshots": self._snapshots,
        }

        path = self._session_dir / f"{self.session_id}.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Đã lưu phiên theo dõi tư thế: {path.resolve()}")
        return path

    def _summarize(self) -> dict[str, object]:
        scores: list[int] = []
        good_count = 0

        for snapshot in self._snapshots:
            score_value = snapshot.get("score")
            if isinstance(score_value, int):
                scores.append(score_value)
            if snapshot.get("status") == "good":
                good_count += 1

        total_snapshots = len(self._snapshots)
        average_score = round(sum(scores) / len(scores), 1) if scores else 0.0
        time_good_pct = round(good_count / total_snapshots * 100, 1) if total_snapshots else 0.0

        event_counts: dict[str, int] = {}
        for stored_event in self._events:
            event_type = stored_event.get("type")
            if isinstance(event_type, str):
                event_counts[event_type] = event_counts.get(event_type, 0) + 1

        return {
            "total_snapshots": total_snapshots,
            "average_score": average_score,
            "time_good_pct": time_good_pct,
            "event_counts": event_counts,
        }

    @staticmethod
    def _snapshot_to_dict(result: PostureAnalysisResult) -> dict[str, object]:
        snapshot: dict[str, object] = {
            "timestamp_ms": result.timestamp_ms,
            "status": result.status,
            "score": result.score,
            "confidence": round(result.confidence, 3),
            "stillness_ms": result.stillness_ms,
            "bad_posture_streak_ms": result.bad_posture_streak_ms,
        }
        if result.features is not None:
            snapshot["features"] = PostureSessionRecorder._features_to_dict(result.features)
        return snapshot

    @staticmethod
    def _features_to_dict(features: PostureFeatures) -> dict[str, float]:
        return {
            "shoulder_width": features.shoulder_width,
            "shoulder_delta_y": features.shoulder_delta_y,
            "face_size": features.face_size,
            "eye_distance": features.eye_distance,
            "head_forward_ratio": features.head_forward_ratio,
            "head_tilt_degrees": features.head_tilt_degrees,
            "visibility_confidence": features.visibility_confidence,
        }

    @staticmethod
    def _event_to_dict(event: PostureEvent) -> dict[str, object]:
        return {
            "timestamp_ms": event.timestamp_ms,
            "type": event.type,
            "severity": event.severity,
            "confidence": round(event.confidence, 3),
            "score": event.score,
            "held_ms": event.held_ms,
        }
