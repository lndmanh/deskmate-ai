from chatbot import DeskMateCoach
from mood_tracking import MoodStore
from posture_tracking import PostureAnalyzer


class ApiState:
    def __init__(self) -> None:
        self.coach = DeskMateCoach()
        self.mood_store = MoodStore()
        self.posture_analyzers: dict[str, PostureAnalyzer] = {}


api_state = ApiState()
