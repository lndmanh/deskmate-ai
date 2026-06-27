import json
import sqlite3
from pathlib import Path

from .types import DailySummaryRecord, EventRecord, PrivacyCounters

_SCHEMA_PATH = Path(__file__).parent / "schema.sql"

_WORKDAY_PREFIXES = ("work_session.", "break.", "idle.")


def _event_table(event_type: str) -> str:
    if event_type.startswith("posture."):
        return "posture_events"
    if any(event_type.startswith(p) for p in _WORKDAY_PREFIXES):
        return "workday_events"
    if event_type.startswith("nudge."):
        return "nudge_events"
    raise ValueError(f"Unknown event type prefix: {event_type!r}")


class EventStore:
    def __init__(self, db_path: str | Path = "data/events.db") -> None:
        self._path = Path(db_path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self._path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._apply_schema()

    def _apply_schema(self) -> None:
        schema = _SCHEMA_PATH.read_text(encoding="utf-8")
        self._conn.executescript(schema)
        self._conn.commit()

    # ------------------------------------------------------------------ write

    def append(self, event: dict) -> None:
        event_type: str = event.get("type", "")
        table = _event_table(event_type)

        if table == "posture_events":
            self._conn.execute(
                "INSERT OR REPLACE INTO posture_events "
                "(id, timestamp, source, type, severity, confidence, duration_seconds, metadata) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    event.get("id"),
                    event.get("timestamp"),
                    event.get("source", "local_vision"),
                    event_type,
                    event.get("severity"),
                    event.get("confidence"),
                    event.get("duration_seconds"),
                    json.dumps(event.get("metadata")) if event.get("metadata") is not None else None,
                ),
            )
        elif table == "workday_events":
            self._conn.execute(
                "INSERT OR REPLACE INTO workday_events "
                "(id, timestamp, source, type, duration_seconds, metadata) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    event.get("id"),
                    event.get("timestamp"),
                    event.get("source", "activity_tracker"),
                    event_type,
                    event.get("duration_seconds"),
                    json.dumps(event.get("metadata")) if event.get("metadata") is not None else None,
                ),
            )
        else:  # nudge_events
            self._conn.execute(
                "INSERT OR REPLACE INTO nudge_events "
                "(id, timestamp, source, type, nudge_type, mode, message, snooze_minutes) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    event.get("id"),
                    event.get("timestamp"),
                    event.get("source", "nudge"),
                    event_type,
                    event.get("nudge_type"),
                    event.get("mode"),
                    event.get("message"),
                    event.get("snooze_minutes"),
                ),
            )

        self._conn.commit()

    # ------------------------------------------------------------------ read

    def list_events(
        self,
        date: str | None = None,
        event_type: str | None = None,
        limit: int = 100,
    ) -> list[EventRecord]:
        tables_to_query: list[str] = []

        if event_type is not None:
            try:
                tables_to_query = [_event_table(event_type)]
            except ValueError:
                return []
        else:
            tables_to_query = ["posture_events", "workday_events", "nudge_events"]

        results: list[EventRecord] = []

        for table in tables_to_query:
            conditions: list[str] = []
            params: list[str | int] = []

            if date is not None:
                conditions.append("timestamp LIKE ?")
                params.append(f"{date}%")
            if event_type is not None:
                conditions.append("type = ?")
                params.append(event_type)

            where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
            params.append(limit)
            rows = self._conn.execute(
                f"SELECT * FROM {table} {where} ORDER BY timestamp DESC LIMIT ?",
                params,
            ).fetchall()

            for row in rows:
                metadata_raw = row["metadata"] if "metadata" in row.keys() else None
                results.append(
                    EventRecord(
                        id=row["id"],
                        timestamp=row["timestamp"],
                        source=row["source"],
                        type=row["type"],
                        severity=row["severity"] if "severity" in row.keys() else None,
                        confidence=row["confidence"] if "confidence" in row.keys() else None,
                        duration_seconds=row["duration_seconds"] if "duration_seconds" in row.keys() else None,
                        metadata=json.loads(metadata_raw) if metadata_raw else None,
                    )
                )

        results.sort(key=lambda e: e.timestamp, reverse=True)
        return results[:limit]

    def count_posture_events(self, date: str | None = None) -> int:
        if date is not None:
            row = self._conn.execute(
                "SELECT COUNT(*) FROM posture_events WHERE timestamp LIKE ?",
                (f"{date}%",),
            ).fetchone()
        else:
            row = self._conn.execute("SELECT COUNT(*) FROM posture_events").fetchone()
        return int(row[0])

    def count_workday_events(self, date: str | None = None) -> int:
        if date is not None:
            row = self._conn.execute(
                "SELECT COUNT(*) FROM workday_events WHERE timestamp LIKE ?",
                (f"{date}%",),
            ).fetchone()
        else:
            row = self._conn.execute("SELECT COUNT(*) FROM workday_events").fetchone()
        return int(row[0])

    # ---------------------------------------------------------------- privacy

    def privacy_counters(self) -> PrivacyCounters:
        posture = self.count_posture_events()
        workday = self.count_workday_events()
        nudge_row = self._conn.execute("SELECT COUNT(*) FROM nudge_events").fetchone()
        nudge = int(nudge_row[0])
        return PrivacyCounters(
            webcam_processing="local",
            cloud_processing=False,
            raw_frames_stored=0,
            data_shared_with_employer=False,
            camera_emotion_detection=False,
            emotion_inference_from_face=False,
            posture_events_saved=posture,
            workday_events_saved=workday,
            nudge_events_saved=nudge,
        )

    # ----------------------------------------------------------------- delete

    def delete_all(self) -> None:
        self._conn.executescript(
            "DELETE FROM posture_events;"
            "DELETE FROM workday_events;"
            "DELETE FROM nudge_events;"
            "DELETE FROM daily_summaries;"
        )
        self._conn.commit()

    # ----------------------------------------------------------- daily summary

    def save_daily_summary(self, summary: dict) -> None:
        self._conn.execute(
            "INSERT OR REPLACE INTO daily_summaries "
            "(date, active_time_minutes, longest_session_minutes, break_count, "
            "idle_time_minutes, posture_risk_events, posture_strain, break_debt, "
            "fatigue_risk, score, baseline_json, privacy_json) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                summary.get("date"),
                summary.get("active_time_minutes"),
                summary.get("longest_session_minutes"),
                summary.get("break_count"),
                summary.get("idle_time_minutes"),
                summary.get("posture_risk_events"),
                summary.get("posture_strain"),
                summary.get("break_debt"),
                summary.get("fatigue_risk"),
                summary.get("score"),
                json.dumps(summary.get("baseline_json")) if summary.get("baseline_json") is not None else None,
                json.dumps(summary.get("privacy_json")) if summary.get("privacy_json") is not None else None,
            ),
        )
        self._conn.commit()

    def get_daily_summary(self, date: str) -> dict | None:
        row = self._conn.execute(
            "SELECT * FROM daily_summaries WHERE date = ?", (date,)
        ).fetchone()
        if row is None:
            return None
        return dict(row)

    def get_recent_summaries(self, days: int = 7) -> list[dict]:
        rows = self._conn.execute(
            "SELECT * FROM daily_summaries ORDER BY date DESC LIMIT ?", (days,)
        ).fetchall()
        return [dict(row) for row in rows]
