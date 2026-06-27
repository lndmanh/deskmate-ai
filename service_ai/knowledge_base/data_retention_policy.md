# Data retention policy

DeskMate nên có chính sách lưu trữ dữ liệu rõ ràng để tạo niềm tin.

## Dữ liệu không lưu

- Raw webcam frames.
- Video webcam.
- Face identity.
- Emotion labels từ khuôn mặt.
- Medical diagnosis.

## Dữ liệu có thể lưu local

- Posture events.
- Work session events.
- Break events.
- Nudge events.
- Daily summaries.
- Baseline aggregates.
- User preferences như nudge mode.

## Retention gợi ý

MVP có thể lưu local không giới hạn cho demo, nhưng product thật nên cho user chọn:

- 7 ngày.
- 30 ngày.
- 90 ngày.
- Xóa thủ công.

## Delete all data

Khi user bấm Delete all data, app nên xóa:

- Event log.
- Daily reports.
- Baseline.
- Nudge history.
- Preferences nếu user chọn reset toàn bộ.

Không cần xóa raw frames vì raw frames không được lưu.

## Export data

Sau MVP, có thể cho export JSON/CSV:

- Daily summary.
- Posture event count.
- Break count.
- Timeline.

Không export ảnh webcam.

## Cloud opt-in

Cloud mode phải là opt-in. Nếu cloud mode bật, UI phải nói rõ dữ liệu nào được gửi. Mặc định cloud processing off.

## Cách chatbot trả lời

Nếu user hỏi “dữ liệu lưu bao lâu?”, chatbot nên nói:

“MVP hiện lưu event local để tạo report và baseline. Raw webcam frames không được lưu. Bạn nên có tùy chọn xóa toàn bộ dữ liệu hoặc đặt retention như 7/30/90 ngày.”
