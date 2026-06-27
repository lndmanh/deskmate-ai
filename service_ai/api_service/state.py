from chatbot import DeskMateCoach
from local_store.store import AppDataStore
from mood_tracking import MoodStore
from posture_tracking import PostureAnalyzer
from reporting import ReportGenerator


class ApiState:
    def __init__(self) -> None:
        self.coach = DeskMateCoach()
        self.mood_store = MoodStore()
        self.posture_analyzers: dict[str, PostureAnalyzer] = {}
        self.app_data = AppDataStore()
        # Reuse the coach's RAG store + AI client for the report generator.
        self.report_generator = ReportGenerator(self.coach.rag_store)


api_state = ApiState()
