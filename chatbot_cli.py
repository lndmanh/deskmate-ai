from chatbot import DeskMateCoach, DeskMateContext


def main() -> None:
    coach = DeskMateCoach()
    demo_context = DeskMateContext(
        active_time="7h 12m",
        longest_session="96m",
        current_session_minutes=76,
        break_count=4,
        posture_status="head_tilt",
        posture_score=66,
        posture_confidence=1.0,
        posture_risk_events=18,
        high_risk_period="14:10-15:35",
        cloud_mode=False,
        raw_images_stored=0,
        extra_events=[
            "14:12 posture.forward_head severity=high confidence=0.87",
            "14:35 work_session.continuous duration=96m",
            "14:38 nudge.sent type=neck_reset",
        ],
    )

    print("DeskMate Coach đã sẵn sàng. Gõ 'exit' để thoát.")

    while True:
        question = input("\nBạn: ").strip()

        if question.lower() in {"exit", "quit", "thoát"}:
            break

        if not question:
            continue

        response = coach.ask(question, demo_context)
        mode = "LLM" if response.used_llm else "local fallback"
        print(f"\nDeskMate ({mode}): {response.answer}")

        if response.retrieved_documents:
            sources = ", ".join(document.source for document in response.retrieved_documents)
            print(f"\nNguồn RAG: {sources}")


if __name__ == "__main__":
    main()
