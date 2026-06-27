import json
import time
import uuid
from dataclasses import asdict
from pathlib import Path

from .types import MoodCheckIn, MoodLabel, MoodSummary


class MoodStore:
    def __init__(self, path: str | Path = "data/mood_checkins.json") -> None:
        self.path = Path(path)

    def add_checkin(
        self,
        mood: MoodLabel,
        energy: int,
        stress: int,
        note: str | None = None,
        timestamp_ms: int | None = None,
    ) -> MoodCheckIn:
        safe_energy = min(max(energy, 1), 5)
        safe_stress = min(max(stress, 1), 5)
        checkin = MoodCheckIn(
            id=f"mood_{uuid.uuid4().hex[:12]}",
            timestamp_ms=timestamp_ms or int(time.time() * 1000),
            mood=mood,
            energy=safe_energy,
            stress=safe_stress,
            note=note.strip() if note and note.strip() else None,
        )
        checkins = self.list_checkins()
        checkins.append(checkin)
        self._save(checkins)
        return checkin

    def list_checkins(self, limit: int | None = None) -> list[MoodCheckIn]:
        if not self.path.exists():
            return []

        data = json.loads(self.path.read_text(encoding="utf-8"))
        checkins = [
            MoodCheckIn(
                id=item["id"],
                timestamp_ms=item["timestamp_ms"],
                mood=item["mood"],
                energy=item["energy"],
                stress=item["stress"],
                note=item.get("note"),
                source=item.get("source", "self_report"),
            )
            for item in data.get("checkins", [])
        ]
        sorted_checkins = sorted(checkins, key=lambda checkin: checkin.timestamp_ms, reverse=True)

        if limit is None:
            return sorted_checkins

        return sorted_checkins[:limit]

    def summarize(self, limit: int = 20) -> MoodSummary:
        checkins = self.list_checkins(limit=limit)

        if not checkins:
            return MoodSummary(total_checkins=0)

        mood_counts: dict[str, int] = {}

        for checkin in checkins:
            mood_counts[checkin.mood] = mood_counts.get(checkin.mood, 0) + 1

        latest = checkins[0]

        return MoodSummary(
            total_checkins=len(checkins),
            latest_mood=latest.mood,
            latest_note=latest.note,
            average_energy=sum(checkin.energy for checkin in checkins) / len(checkins),
            average_stress=sum(checkin.stress for checkin in checkins) / len(checkins),
            mood_counts=mood_counts,
        )

    def delete_all(self) -> None:
        if self.path.exists():
            self.path.unlink()

    def _save(self, checkins: list[MoodCheckIn]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"checkins": [asdict(checkin) for checkin in sorted(checkins, key=lambda item: item.timestamp_ms)]}
        self.path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
