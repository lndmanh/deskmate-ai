import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from user_data import user_data_path

from .types import PostureAnalysisResult, PostureEvent

_TIMEZONE = timezone(timedelta(hours=7))


class PostureSessionRecorder:
    """Ghi lại tiến trình một phiên theo dõi tư thế.

    Chỉ lưu kết quả đã tính toán (status, score, features...) — không bao giờ
    lưu raw pixel, landmark thô hay ảnh.
    """

    SNAPSHOT_INTERVAL_S = 30
    DATA_DIR = user_data_path("posture")

    def __init__(self) -> None:
        now = datetime.now(_TIMEZONE)
        self.session_id = "session_" + now.strftime("%Y%m%d_%H%M%S")
        self.started_at = now.isoformat()

        self._events: list[dict] = []
        self._snapshots: list[dict] = []
        self._last_snapshot_ms: int = 0
        self._last_event_type: str | None = None

        self.DATA_DIR.mkdir(parents=True, exist_ok=True)

    def record(self, result: PostureAnalysisResult, event: PostureEvent | None) -> None:
        """Gọi mỗi frame. Ghi event khi đổi loại (tránh spam) và snapshot mỗi 30s."""
        if event is not None and event.type != self._last_event_type:
            self._events.append(
                {
                    "timestamp_ms": event.timestamp_ms,
                    "timestamp_iso": self._iso(event.timestamp_ms),
                    "type": event.type,
                    "severity": event.severity,
                    "confidence": round(event.confidence, 3),
                    "score": event.score,
                    "held_ms": event.held_ms,
                }
            )
            self._last_event_type = event.type
        elif event is None:
            self._last_event_type = None

        elapsed = (result.timestamp_ms - self._last_snapshot_ms) / 1000

        if self._last_snapshot_ms == 0 or elapsed >= self.SNAPSHOT_INTERVAL_S:
            snapshot: dict = {
                "timestamp_ms": result.timestamp_ms,
                "timestamp_iso": self._iso(result.timestamp_ms),
                "status": result.status,
                "score": result.score,
                "confidence": round(result.confidence, 3),
                "stillness_ms": result.stillness_ms,
                "bad_posture_streak_ms": result.bad_posture_streak_ms,
            }

            if result.features is not None:
                snapshot["features"] = {
                    "head_forward_ratio": round(result.features.head_forward_ratio, 4),
                    "head_tilt_degrees": round(result.features.head_tilt_degrees, 2),
                    "shoulder_delta_y": round(result.features.shoulder_delta_y, 4),
                    "face_size": round(result.features.face_size, 4),
                    "visibility_confidence": round(result.features.visibility_confidence, 3),
                }

            self._snapshots.append(snapshot)
            self._last_snapshot_ms = result.timestamp_ms

    def save(self) -> Path:
        """Ghi phiên ra file JSON, kèm summary đã tính toán. Trả về đường dẫn file."""
        ended_at = datetime.now(_TIMEZONE).isoformat()

        scores = [s["score"] for s in self._snapshots]
        good_count = sum(1 for s in self._snapshots if s["status"] == "good")

        event_counts: dict[str, int] = {}
        for stored_event in self._events:
            event_type = stored_event["type"]
            event_counts[event_type] = event_counts.get(event_type, 0) + 1

        payload: dict = {
            "session_id": self.session_id,
            "started_at": self.started_at,
            "ended_at": ended_at,
            "events": self._events,
            "snapshots": self._snapshots,
            "summary": {
                "total_snapshots": len(self._snapshots),
                "average_score": round(sum(scores) / len(scores), 1) if scores else 0,
                "time_good_pct": (
                    round(good_count / len(self._snapshots) * 100, 1) if self._snapshots else 0
                ),
                "event_counts": event_counts,
            },
        }

        out_path = self.DATA_DIR / f"{self.session_id}.json"
        out_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"[DeskMate] Session đã lưu: {out_path}")

        # Đồng bộ summary vào nguồn dữ liệu chung cho frontend; file session là backup.
        from local_store.store import AppDataStore

        AppDataStore().append_posture_session(
            payload["summary"]
            | {
                "session_id": self.session_id,
                "started_at": self.started_at,
                "ended_at": ended_at,
                "event_counts": payload["summary"]["event_counts"],
            }
        )
        return out_path

    def _iso(self, timestamp_ms: int) -> str:
        """Chuyển mốc thời gian epoch (ms) sang chuỗi ISO theo múi giờ UTC+7."""
        return datetime.fromtimestamp(timestamp_ms / 1000, _TIMEZONE).isoformat()
