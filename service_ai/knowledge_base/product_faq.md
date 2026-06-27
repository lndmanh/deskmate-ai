# DeskMate AI FAQ

## DeskMate AI là gì?

DeskMate AI là trợ lý local-first giúp người làm việc với máy tính nhận ra khi ngồi quá lâu, sai tư thế, ít nghỉ hoặc có break debt cao. Sản phẩm tập trung vào thói quen làm việc và ergonomic, không phải chẩn đoán y tế.

## DeskMate khác gì app nhắc nghỉ thông thường?

App nhắc nghỉ thông thường chủ yếu đếm giờ. DeskMate kết hợp nhiều tín hiệu:

- Work session length.
- Break frequency.
- Posture risk events.
- Stillness duration.
- Fatigue signals như low movement hoặc possible drowsiness, nhưng không chẩn đoán ngủ gật.
- Personal baseline.
- Nudge history.

Nhờ đó, DeskMate nhắc theo ngữ cảnh hơn: ví dụ posture risk tăng sau phiên làm việc dài 60–90 phút.

## DeskMate có phải app y tế không?

Không. DeskMate không chẩn đoán bệnh, không thay thế bác sĩ và không đưa kết luận y tế.

DeskMate chỉ nói theo hướng:

- “có tín hiệu posture risk”,
- “nên nghỉ ngắn”,
- “tư thế đang lệch so với lúc hiệu chuẩn”,
- “break debt cao hơn bình thường”.

## AI có xem camera không?

Không. Vision engine xử lý webcam local để tạo posture event. AI chỉ nhận summary như active time, longest session, posture risk events và high-risk period.

## Vì sao cần AI?

AI giúp giải thích dữ liệu ngày làm việc bằng ngôn ngữ tự nhiên, tạo daily report và gợi ý hành động cụ thể. AI không thay thế deterministic risk scoring.

Ví dụ AI nên nói:

“Posture risk tăng rõ sau phiên làm việc dài nhất 96 phút. Ngày mai bạn nên nghỉ lần đầu trước khi phiên làm việc vượt 60 phút.”

## Demo mode là gì?

Demo mode phát event giả lập qua cùng pipeline để trình diễn khi webcam hoặc ánh sáng không ổn định. Demo mode không phải screenshot giả; nó vẫn đi qua event store, risk engine và UI.

## First user là ai?

First user phù hợp:

- Software engineers.
- Nhân viên văn phòng làm laptop nhiều giờ.
- Remote workers.
- Freelancers.
- Support/call-center workers.
- Sinh viên mới đi làm hoặc học online dài giờ.

## Wedge của sản phẩm là gì?

Wedge của DeskMate là “private ergonomic assistant”: giúp cá nhân tự chăm sóc trong ngày làm việc mà không tạo cảm giác bị giám sát.

## Khi nào chatbot nên nói chưa đủ dữ liệu?

Nếu không có posture_score, active_time, session hoặc event log, chatbot nên nói:

“Mình chưa có đủ event để kết luận. Bạn có thể bật tracking vài phút hoặc gửi summary ngày làm việc để mình phân tích cụ thể hơn.”
