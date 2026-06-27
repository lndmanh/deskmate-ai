import json
from pathlib import Path

DATA_PATH = Path("data/user/app_data.json")

_DEFAULTS: dict = {"mood": {"checkins": []}, "posture": {"sessions": []}}


class AppDataStore:
    def __init__(self, path: Path = DATA_PATH) -> None:
        self._path = path
        self._path.parent.mkdir(parents=True, exist_ok=True)
        if not self._path.exists():
            self._path.write_text(json.dumps(_DEFAULTS, ensure_ascii=False, indent=2), encoding="utf-8")

    def _read(self) -> dict:
        return json.loads(self._path.read_text(encoding="utf-8"))

    def _write(self, data: dict) -> None:
        self._path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def append_mood(self, checkin: dict) -> None:
        data = self._read()
        data["mood"]["checkins"].append(checkin)
        self._write(data)

    def get_mood(self) -> list[dict]:
        return self._read()["mood"]["checkins"]

    def append_posture_session(self, session: dict) -> None:
        data = self._read()
        data["posture"]["sessions"].append(session)
        self._write(data)

    def get_posture_sessions(self) -> list[dict]:
        return self._read()["posture"]["sessions"]

    def get_all(self) -> dict:
        return self._read()

    def delete_all(self) -> None:
        self._write(_DEFAULTS)
