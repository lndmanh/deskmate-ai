# DeskMate AI Knowledge Base

Folder này là nguồn dữ liệu cho RAG của DeskMate Coach.

## Chủ đề hiện có

- `posture_basics.md`: giải thích posture risk, score, confidence, face distance.
- `nudge_routines.md`: bài reset cổ/vai/mắt và cách viết nudge.
- `privacy_policy.md`: local-first, raw frames stored = 0, AI không xem ảnh.
- `product_faq.md`: FAQ sản phẩm, differentiation, first users.
- `event_schema.md`: posture/workday/nudge events và daily summary.
- `workday_timeline.md`: active time, session, break debt, high-risk period.
- `daily_report_guidelines.md`: cấu trúc daily report và nguyên tắc viết.
- `personal_baseline.md`: baseline 7 ngày và personalization.
- `vietnam_context.md`: tác động và bối cảnh Việt Nam.
- `judge_qna.md`: câu hỏi giám khảo và câu trả lời demo.
- `chatbot_guardrails.md`: giới hạn an toàn của chatbot.
- `tone_profile.md`: cách nói của DeskMate Coach.
- `ergonomic_setup.md`: setup bàn ghế, màn hình, laptop, ánh sáng.
- `camera_and_calibration.md`: calibration, camera, confidence, lý do đo sai.
- `troubleshooting.md`: lỗi webcam, MediaPipe, FastAPI, API key, encoding.
- `api_reference.md`: endpoint FastAPI và flow tích hợp frontend.
- `business_model.md`: first customer, pricing, wedge, expansion path.
- `competitor_analysis.md`: so sánh với timer, screen time, posture app, employer monitoring.
- `data_retention_policy.md`: lưu gì, không lưu gì, xóa dữ liệu, cloud opt-in.
- `demo_script.md`: flow demo 5 phút và fallback nếu webcam lỗi.
- `mood_checkin.md`: mood self-report, labels, guardrails và cách chatbot dùng mood.

## Cách viết tài liệu để RAG dễ tìm

- Dùng heading rõ ràng.
- Lặp lại các keyword quan trọng theo cách tự nhiên.
- Mỗi section nên tập trung một ý.
- Viết bằng tiếng Việt nếu chatbot trả lời tiếng Việt.
- Tránh trộn quá nhiều chủ đề trong một section.

## Guardrail quan trọng

Knowledge base không được hướng chatbot tới chẩn đoán bệnh, phân tích cảm xúc hoặc employer surveillance.
