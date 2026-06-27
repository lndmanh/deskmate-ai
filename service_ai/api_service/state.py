from chatbot import DeskMateCoach
from event_store import EventStore
from mood_tracking import MoodStore
from posture_tracking import PostureAnalyzer


class ApiState:
    def __init__(self) -> None:
        self.coach = DeskMateCoach()
        self.mood_store = MoodStore()
        self.posture_analyzers: dict[str, PostureAnalyzer] = {}
        self.event_store = EventStore()


api_state = ApiState()
