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

    DATA_PATH = user_data_path("app_data.json")

    def _load(self) -> dict:
        if not self.DATA_PATH.exists():
            return _default_data()

        try:
            data = json.loads(self.DATA_PATH.read_text(encoding="utf-8"))
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

    def _save(self, data: dict) -> None:
        self.DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
        self.DATA_PATH.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def append_mood(self, checkin: dict) -> None:
        data = self._load()
        data["mood"]["checkins"].append(checkin)
        self._save(data)

    def get_mood(self, limit: int = 20) -> list[dict]:
        data = self._load()
        checkins = sorted(
            data["mood"]["checkins"],
            key=lambda item: item.get("timestamp_ms", 0),
            reverse=True,
        )
        return checkins[:limit]

    def append_posture_session(self, session: dict) -> None:
        data = self._load()
        data["posture"]["sessions"].append(session)
        self._save(data)

    def get_posture_sessions(self, limit: int = 10) -> list[dict]:
        data = self._load()
        sessions = sorted(
            data["posture"]["sessions"],
            key=lambda item: item.get("started_at", ""),
            reverse=True,
        )
        return sessions[:limit]

    def get_all(self) -> dict:
        return self._load()

    def delete_all(self) -> None:
        self._save(_default_data())
