import threading
import time
from datetime import datetime, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from event_store import EventStore

DEMO_EVENTS = [
    {"id": "evt_demo_001", "timestamp_offset_s": 0,   "source": "demo", "type": "work_session.started"},
    {"id": "evt_demo_002", "timestamp_offset_s": 15,  "source": "demo", "type": "work_session.continuous", "duration_seconds": 4500},
    {"id": "evt_demo_003", "timestamp_offset_s": 30,  "source": "demo", "type": "posture.forward_head",    "severity": "high",   "confidence": 0.87, "duration_seconds": 900,  "metadata": {"neck_angle_degrees": 34, "stillness_seconds": 2520}},
    {"id": "evt_demo_004", "timestamp_offset_s": 45,  "source": "demo", "type": "work_session.continuous", "duration_seconds": 5760},
    {"id": "evt_demo_005", "timestamp_offset_s": 60,  "source": "demo", "type": "nudge.sent",             "nudge_type": "neck_reset", "mode": "focus_friendly", "message": "Bạn đã tập trung 76 phút rồi. Cổ bạn đang hơi căng. Nghỉ 90 giây để reset nhé?"},
    {"id": "evt_demo_006", "timestamp_offset_s": 75,  "source": "demo", "type": "posture.stillness",      "severity": "medium", "confidence": 0.81, "duration_seconds": 420},
    {"id": "evt_demo_007", "timestamp_offset_s": 90,  "source": "demo", "type": "break.started"},
    {"id": "evt_demo_008", "timestamp_offset_s": 105, "source": "demo", "type": "break.ended"},
    {"id": "evt_demo_009", "timestamp_offset_s": 120, "source": "demo", "type": "posture.head_tilt",      "severity": "low",    "confidence": 0.72, "metadata": {"head_tilt_degrees": 12}},
    {"id": "evt_demo_010", "timestamp_offset_s": 135, "source": "demo", "type": "work_session.ended",     "duration_seconds": 7200},
]


class DemoEventPlayer:
    def __init__(self, event_store: "EventStore", risk_engine: object | None = None) -> None:
        self._running = False
        self._thread: threading.Thread | None = None
        self._events_played = 0
        self.event_store = event_store
        self.risk_engine = risk_engine

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._events_played = 0
        self._thread = threading.Thread(target=self._play, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def events_played(self) -> int:
        return self._events_played

    def _play(self) -> None:
        for event in DEMO_EVENTS:
            if not self._running:
                break
            stamped = {**event, "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
            stamped.pop("timestamp_offset_s", None)
            self.event_store.append(stamped)
            self._events_played += 1
            if self.risk_engine is not None and hasattr(self.risk_engine, "recompute"):
                self.risk_engine.recompute()
            time.sleep(3)
        self._running = False
