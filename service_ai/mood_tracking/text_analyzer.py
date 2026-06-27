import json

from ai_client import AIClientError, get_ai_client

from .types import MoodLabel, MoodTextAnalysis

ALLOWED_MOODS: set[MoodLabel] = {
    "good",
    "tired",
    "stressed",
    "focused",
    "distracted",
    "calm",
    "overwhelmed",
    "neutral",
}


class MoodTextAnalyzer:
    def __init__(self) -> None:
        self.client = get_ai_client()

    def analyze(self, text: str) -> MoodTextAnalysis:
        normalized_text = text.strip()

        if not normalized_text:
            raise ValueError("Text is required")

        if not self.client.is_available():
            return self._fallback_analyze(normalized_text, "OPENAI_API_KEY is not set")

        try:
            content = self.client.chat(
                [
                    {
                        "role": "system",
                        "content": (
                            "Bạn phân loại mood self-report từ text tiếng Việt/Anh. "
                            "Không chẩn đoán bệnh. Chỉ trả JSON hợp lệ, không markdown, không giải thích ngoài JSON. "
                            "JSON keys: mood, energy, stress, confidence, reason. "
                            "mood phải là một trong: good, tired, stressed, focused, "
                            "distracted, calm, overwhelmed, neutral. "
                            "energy và stress là số nguyên 1-5. "
                            "confidence là số 0-1. reason là một câu ngắn tiếng Việt."
                        ),
                    },
                    {"role": "user", "content": normalized_text},
                ],
                temperature=0.1,
            )
        except AIClientError as error:
            return self._fallback_analyze(normalized_text, f"OpenAI request failed: {error}")

        try:
            payload = json.loads(content)
        except json.JSONDecodeError:
            return self._fallback_analyze(normalized_text, "OpenAI response was not valid JSON")

        return self._parse_payload(payload)

    def _parse_payload(self, payload: dict) -> MoodTextAnalysis:
        raw_mood = payload.get("mood", "neutral")
        mood: MoodLabel = raw_mood if raw_mood in ALLOWED_MOODS else "neutral"
        energy = self._clamp_rating(payload.get("energy", 3))
        stress = self._clamp_rating(payload.get("stress", 3))
        confidence = self._clamp_float(payload.get("confidence", 0.5), 0.0, 1.0)
        reason = payload.get("reason")

        return MoodTextAnalysis(
            mood=mood,
            energy=energy,
            stress=stress,
            confidence=confidence,
            reason=reason if isinstance(reason, str) and reason.strip() else "Phân tích từ nội dung người dùng nhập.",
            used_llm=True,
            source="openai_text_analysis",
        )

    def _fallback_analyze(self, text: str, reason: str) -> MoodTextAnalysis:
        lower_text = text.lower()

        if any(keyword in lower_text for keyword in ["deadline", "stress", "căng", "áp lực", "quá tải"]):
            return MoodTextAnalysis(
                mood="stressed",
                energy=2,
                stress=4,
                confidence=0.45,
                reason=f"Fallback keyword vì {reason}.",
                used_llm=False,
                source="local_keyword_fallback",
            )

        if any(keyword in lower_text for keyword in ["mệt", "buồn ngủ", "kiệt sức", "tired", "sleepy"]):
            return MoodTextAnalysis(
                mood="tired",
                energy=2,
                stress=3,
                confidence=0.45,
                reason=f"Fallback keyword vì {reason}.",
                used_llm=False,
                source="local_keyword_fallback",
            )

        if any(keyword in lower_text for keyword in ["tập trung", "flow", "focused"]):
            return MoodTextAnalysis(
                mood="focused",
                energy=4,
                stress=2,
                confidence=0.45,
                reason=f"Fallback keyword vì {reason}.",
                used_llm=False,
                source="local_keyword_fallback",
            )

        return MoodTextAnalysis(
            mood="neutral",
            energy=3,
            stress=3,
            confidence=0.3,
            reason=f"Fallback mặc định vì {reason}.",
            used_llm=False,
            source="local_keyword_fallback",
        )

    def _clamp_rating(self, value: object) -> int:
        if not isinstance(value, (int, float)):
            return 3

        return min(max(round(value), 1), 5)

    def _clamp_float(self, value: object, minimum: float, maximum: float) -> float:
        if not isinstance(value, (int, float)):
            return minimum

        return min(max(float(value), minimum), maximum)
