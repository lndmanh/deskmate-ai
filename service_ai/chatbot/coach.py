from pathlib import Path

from rag import HybridRagRetriever, RetrievedDocument

from .llm import OpenAiChatClient
from .prompts import SYSTEM_PROMPT, build_user_prompt
from .types import ChatResponse, DeskMateContext


class DeskMateCoach:
    def __init__(self, knowledge_base_dir: str | Path = "knowledge_base") -> None:
        self.rag_store = HybridRagRetriever(knowledge_base_dir)
        self.llm = OpenAiChatClient()

    def ask(self, question: str, context: DeskMateContext | None = None) -> ChatResponse:
        safe_context = context or DeskMateContext()
        retrieved_documents = self.rag_store.search(question)
        context_block = self._format_context(safe_context)
        retrieved_block = self._format_retrieved_documents(retrieved_documents)
        user_prompt = build_user_prompt(question, context_block, retrieved_block)

        if self.llm.is_available():
            try:
                answer = self.llm.complete(SYSTEM_PROMPT, user_prompt)
                return ChatResponse(
                    answer=answer,
                    used_llm=True,
                    retrieved_documents=retrieved_documents,
                )
            except RuntimeError as error:
                fallback_answer = self._fallback_answer(question, safe_context, retrieved_documents)
                return ChatResponse(
                    answer=f"{fallback_answer}\n\n(Lưu ý: LLM API lỗi nên mình dùng fallback local. Chi tiết: {error})",
                    used_llm=False,
                    retrieved_documents=retrieved_documents,
                )

        return ChatResponse(
            answer=self._fallback_answer(question, safe_context, retrieved_documents),
            used_llm=False,
            retrieved_documents=retrieved_documents,
        )

    def _format_context(self, context: DeskMateContext) -> str:
        lines = [
            f"active_time: {context.active_time or 'unknown'}",
            f"longest_session: {context.longest_session or 'unknown'}",
            f"current_session_minutes: {context.current_session_minutes if context.current_session_minutes is not None else 'unknown'}",
            f"break_count: {context.break_count if context.break_count is not None else 'unknown'}",
            f"posture_status: {context.posture_status or 'unknown'}",
            f"posture_score: {context.posture_score if context.posture_score is not None else 'unknown'}",
            f"posture_confidence: {context.posture_confidence if context.posture_confidence is not None else 'unknown'}",
            f"posture_risk_events: {context.posture_risk_events if context.posture_risk_events is not None else 'unknown'}",
            f"high_risk_period: {context.high_risk_period or 'unknown'}",
            f"cloud_mode: {context.cloud_mode}",
            f"raw_images_stored: {context.raw_images_stored}",
            f"latest_mood: {context.latest_mood or 'unknown'}",
            f"latest_mood_note: {context.latest_mood_note or 'unknown'}",
            f"average_energy: {context.average_energy if context.average_energy is not None else 'unknown'}",
            f"average_stress: {context.average_stress if context.average_stress is not None else 'unknown'}",
        ]

        if context.extra_events:
            lines.append("extra_events:")
            lines.extend(f"- {event}" for event in context.extra_events)

        return "\n".join(lines)

    def _format_retrieved_documents(self, documents: list[RetrievedDocument]) -> str:
        if not documents:
            return "Không tìm thấy tài liệu nội bộ liên quan."

        blocks = []

        for document in documents:
            blocks.append(
                f"Nguồn: {document.source}\nTiêu đề: {document.title}\nNội dung:\n{document.content}"
            )

        return "\n\n---\n\n".join(blocks)

    def _fallback_answer(
        self,
        question: str,
        context: DeskMateContext,
        documents: list[RetrievedDocument],
    ) -> str:
        normalized_question = question.strip().lower()
        lower_question = normalized_question

        if self._is_greeting(lower_question):
            return (
                "Chào bạn 👋 Mình là DeskMate Coach. "
                "Bạn có thể hỏi mình về tư thế hiện tại, nghỉ 90 giây, quyền riêng tư, "
                "hoặc báo cáo ngày làm việc."
            )

        if self._is_thanks(lower_question):
            return "Không có gì nhé. Khi nào cổ/vai hơi căng hoặc làm việc lâu quá thì gọi mình."

        if self._is_capability_question(lower_question):
            return (
                "Mình có thể giúp 4 việc chính:\n"
                "1. Giải thích posture event như cúi đầu, nghiêng đầu, lệch vai.\n"
                "2. Gợi ý bài reset cổ/vai/mắt trong 60–90 giây.\n"
                "3. Trả lời về privacy: webcam local, không lưu ảnh.\n"
                "4. Tóm tắt ngày làm việc và điều chỉnh cách nói theo mood bạn tự check-in."
            )

        if self._is_mood_question(lower_question):
            return self._mood_answer(context)

        if "ảnh" in lower_question or "webcam" in lower_question or "privacy" in lower_question or "riêng tư" in lower_question:
            return (
                "Mặc định DeskMate xử lý webcam local trên máy. Raw frame lưu trữ = 0. "
                "AI không xem ảnh webcam; AI chỉ nhận posture event hoặc summary đã xử lý. "
                "Bạn cũng nên có nút xóa toàn bộ dữ liệu trong app."
            )

        if self._is_reset_question(lower_question):
            return (
                "Bạn thử reset 90 giây nhé:\n"
                "1. Thả lỏng vai và hạ hai vai xuống.\n"
                "2. Đưa cằm nhẹ về sau, giữ cổ trung lập.\n"
                "3. Nhìn xa khoảng 20 giây rồi quay lại làm việc.\n"
                "Mình không chẩn đoán bệnh; đây chỉ là gợi ý ergonomic ngắn dựa trên event hiện tại."
            )

        if self._is_fatigue_question(lower_question) and context.posture_status in ["low_movement", "possible_drowsiness"]:
            status = self._translate_status(context.posture_status)
            score = context.posture_score if context.posture_score is not None else "chưa rõ"
            return (
                f"Mình không thể khẳng định bạn đang ngủ gật. Mình chỉ thấy {status}, "
                f"điểm tư thế khoảng {score}/100.\n"
                "Nếu bạn thấy mệt, thử nghỉ 2 phút: đứng dậy, nhìn xa 20 giây, thả lỏng vai và uống chút nước."
            )

        if self._is_posture_question(lower_question) and (context.posture_status or context.posture_score is not None):
            status = context.posture_status or "chưa rõ"
            score = context.posture_score if context.posture_score is not None else "chưa rõ"
            translated_status = self._translate_status(status)
            return (
                f"Hiện tại trạng thái tư thế là {translated_status}, điểm tư thế khoảng {score}/100. "
                "Nếu điểm thấp hoặc posture risk kéo dài, bạn nên nghỉ ngắn 60–90 giây và chỉnh lại cổ/vai. "
                "Mình chỉ dựa trên event log, không xem ảnh webcam và không chẩn đoán bệnh."
            )

        if self._is_workday_question(lower_question):
            active_time = context.active_time or "chưa rõ"
            longest_session = context.longest_session or "chưa rõ"
            break_count = context.break_count if context.break_count is not None else "chưa rõ"
            high_risk_period = context.high_risk_period or "chưa rõ"
            return (
                "Tóm tắt nhanh theo dữ liệu hiện có:\n"
                f"- Thời gian active: {active_time}\n"
                f"- Phiên dài nhất: {longest_session}\n"
                f"- Số lần nghỉ: {break_count}\n"
                f"- Khung rủi ro cao: {high_risk_period}\n"
                "Nếu muốn mình phân tích sâu hơn, hãy gửi thêm event log hoặc bật LLM bằng OPENAI_API_KEY."
            )

        if documents:
            best_document = documents[0]
            return (
                "Mình tìm thấy tài liệu liên quan trong knowledge base. Tóm tắt nhanh:\n"
                f"{best_document.content[:700]}\n\n"
                "Nếu bạn muốn câu trả lời tự nhiên hơn, hãy set OPENAI_API_KEY để dùng LLM."
            )

        return (
            "Mình chưa hiểu rõ ý bạn. Bạn có thể hỏi kiểu:\n"
            "- Tư thế hiện tại của tôi thế nào?\n"
            "- Cho tôi bài reset cổ vai 90 giây.\n"
            "- Bạn có lưu ảnh webcam không?\n"
            "- Hôm nay tôi làm việc có căng không?"
        )

    def _is_greeting(self, question: str) -> bool:
        greetings = {"hi", "hello", "hey", "chào", "xin chào", "alo", "yo"}
        return question in greetings

    def _is_thanks(self, question: str) -> bool:
        return question in {"thanks", "thank you", "cảm ơn", "cam on", "ok cảm ơn", "oke cảm ơn"}

    def _is_capability_question(self, question: str) -> bool:
        keywords = ["bạn làm được gì", "mày làm được gì", "có thể làm gì", "help", "giúp gì"]
        return any(keyword in question for keyword in keywords)

    def _is_reset_question(self, question: str) -> bool:
        keywords = ["nghỉ", "reset", "mỏi", "căng", "bài tập", "thư giãn", "cổ vai", "mắt"]
        return any(keyword in question for keyword in keywords)

    def _is_posture_question(self, question: str) -> bool:
        keywords = [
            "tư thế",
            "posture",
            "cúi đầu",
            "nghiêng đầu",
            "lệch vai",
            "forward head",
            "head tilt",
            "vai",
            "cổ",
            "điểm",
            "score",
            "khoảng cách",
            "màn hình",
        ]
        return any(keyword in question for keyword in keywords)

    def _is_fatigue_question(self, question: str) -> bool:
        keywords = ["buồn ngủ", "ngủ gật", "mệt", "fatigue", "drowsiness", "ít chuyển động", "low movement"]
        return any(keyword in question for keyword in keywords)

    def _is_workday_question(self, question: str) -> bool:
        keywords = ["hôm nay", "ngày làm việc", "active", "session", "phiên", "break", "nghỉ bao nhiêu"]
        return any(keyword in question for keyword in keywords)

    def _is_mood_question(self, question: str) -> bool:
        keywords = ["mood", "cảm xúc", "tâm trạng", "vui", "buồn", "stress", "căng thẳng", "mệt", "năng lượng"]
        return any(keyword in question for keyword in keywords)

    def _mood_answer(self, context: DeskMateContext) -> str:
        if not context.latest_mood:
            return (
                "Mình chưa có mood check-in nào. Nếu muốn, bạn có thể tự chọn tâm trạng như "
                "ổn, mệt, căng thẳng, tập trung hoặc quá tải. Mình sẽ dùng dữ liệu đó để nói chuyện phù hợp hơn. "
                "Mình không suy đoán cảm xúc từ webcam."
            )

        mood = self._translate_mood(context.latest_mood)
        energy = f"{context.average_energy:.1f}/5" if context.average_energy is not None else "chưa rõ"
        stress = f"{context.average_stress:.1f}/5" if context.average_stress is not None else "chưa rõ"
        note = f" Ghi chú gần nhất: {context.latest_mood_note}." if context.latest_mood_note else ""
        return (
            f"Mood bạn tự check-in gần nhất là {mood}. Năng lượng trung bình: {energy}, "
            f"mức căng thẳng trung bình: {stress}.{note} "
            "Mình sẽ dùng mood này để chọn cách nhắc nhẹ hơn, nhưng không suy đoán cảm xúc từ camera."
        )

    def _translate_mood(self, mood: str) -> str:
        labels = {
            "good": "ổn/tốt",
            "tired": "mệt",
            "stressed": "căng thẳng",
            "focused": "đang tập trung",
            "distracted": "dễ xao nhãng",
            "calm": "bình tĩnh",
            "overwhelmed": "quá tải",
            "neutral": "bình thường",
        }
        return labels.get(mood, mood)

    def _translate_status(self, status: str) -> str:
        labels = {
            "good": "tư thế tốt",
            "forward_head": "cúi đầu / cổ đưa trước",
            "head_tilt": "nghiêng đầu",
            "shoulder_imbalance": "lệch vai",
            "too_close": "ngồi quá gần màn hình",
            "too_far": "ngồi quá xa màn hình",
            "not_visible": "camera chưa thấy rõ đầu và vai",
            "low_movement": "ít chuyển động",
            "possible_drowsiness": "tín hiệu mệt/buồn ngủ có thể xảy ra",
        }
        return labels.get(status, status)
