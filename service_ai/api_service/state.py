from chatbot import DeskMateCoach
from demo import DemoEventPlayer
from event_store import EventStore
from mood_tracking import MoodStore
from posture_tracking import PostureAnalyzer
from risk_engine import RiskEngine


class ApiState:
    def __init__(self) -> None:
        self.coach = DeskMateCoach()
        self.mood_store = MoodStore()
        self.posture_analyzers: dict[str, PostureAnalyzer] = {}
        self.event_store = EventStore()
        self.risk_engine = RiskEngine(self.event_store)
        self.demo_player = DemoEventPlayer(event_store=self.event_store, risk_engine=self.risk_engine)


api_state = ApiState()
