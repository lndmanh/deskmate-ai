import json
from pathlib import Path

from user_data import user_data_path


def _default_data() -> dict:
    return {
        "mood": {"checkins": []},
        "posture": {"sessions": []},
    }


class AppDataStore:
    """Nguồn dữ liệu JSON duy nhất cho frontend (mood + posture).

    Frontend fetch endpoint /data để lấy toàn bộ nội dung file này.
    """

    def __init__(self, path: Path | None = None) -> None:
        self._path = path or user_data_path("app_data.json")
        self._path.parent.mkdir(parents=True, exist_ok=True)

        if not self._path.exists():
            self._write(_default_data())

    def _read(self) -> dict:
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return _default_data()

        if not isinstance(data, dict):
            return _default_data()

        mood = data.get("mood")
        if not isinstance(mood, dict) or not isinstance(mood.get("checkins"), list):
            data["mood"] = {"checkins": []}

        posture = data.get("posture")
        if not isinstance(posture, dict) or not isinstance(posture.get("sessions"), list):
            data["posture"] = {"sessions": []}

        return data

    def _write(self, data: dict) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def append_mood(self, checkin: dict) -> None:
        data = self._read()
        data["mood"]["checkins"].append(checkin)
        self._write(data)

    def get_mood(self, limit: int | None = 20) -> list[dict]:
        checkins = sorted(
            self._read()["mood"]["checkins"],
            key=lambda item: item.get("timestamp_ms", 0),
            reverse=True,
        )

        if limit is None:
            return checkins

        return checkins[:limit]

    def append_posture_session(self, session: dict) -> None:
        data = self._read()
        data["posture"]["sessions"].append(session)
        self._write(data)

    def get_posture_sessions(self, limit: int | None = 10) -> list[dict]:
        sessions = sorted(
            self._read()["posture"]["sessions"],
            key=lambda item: item.get("started_at", ""),
            reverse=True,
        )

        if limit is None:
            return sessions

        return sessions[:limit]

    def get_all(self) -> dict:
        return self._read()

    def delete_all(self) -> None:
        self._write(_default_data())
