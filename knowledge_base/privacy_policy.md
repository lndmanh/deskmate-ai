# Privacy của DeskMate AI

DeskMate AI được thiết kế theo hướng local-first và privacy-first. Đây là điểm quan trọng để người dùng tin tưởng sản phẩm.

## Cam kết chính

- Webcam processing: local.
- Raw webcam frames stored: 0.
- AI không nhận ảnh webcam.
- AI chỉ nhận event summary đã xử lý.
- Cloud processing mặc định tắt.
- Không có employer dashboard trong MVP.
- Người dùng có thể xóa toàn bộ dữ liệu.

## AI có xem camera không?

Không. Vision engine xử lý webcam local để trích xuất landmarks/posture features. Sau đó frame ảnh bị bỏ đi. AI chatbot hoặc AI report chỉ nhận dữ liệu dạng text/JSON như:

```json
{
  "posture_status": "head_tilt",
  "posture_score": 66,
  "posture_confidence": 1.0,
  "raw_images_stored": 0
}
```

AI không cần và không nên nhận raw image.

## Dữ liệu có thể lưu

DeskMate có thể lưu:

- Posture events.
- Work session events.
- Break events.
- Nudge events.
- Daily summaries.
- User preference như nudge mode.

Ví dụ event:

```txt
14:12 posture.forward_head severity=high confidence=0.87
14:35 work_session.continuous duration=96m
14:38 nudge.sent type=neck_reset
```

## Dữ liệu không nên lưu trong MVP

- Raw webcam image.
- Video webcam.
- Face identity.
- Emotion inference từ khuôn mặt.
- Employer monitoring data.
- Medical diagnosis.

## Data shared with employer

Trong MVP, data shared with employer phải là “Never”. DeskMate là trợ lý cá nhân, không phải công cụ giám sát nhân viên.

Nếu sau này có team mode, nên chỉ dùng aggregate ẩn danh và opt-in rõ ràng. Không hiển thị dữ liệu posture cá nhân cho quản lý.

## Delete all data

Privacy dashboard nên có nút “Delete all data”. Khi người dùng xóa, app nên xóa event log, daily summary, baseline và preference local.

## Cách trả lời câu hỏi privacy

Nếu user hỏi “bạn có lưu ảnh tôi không?”, trả lời:

“Không. Mặc định DeskMate xử lý webcam local và raw frames stored = 0. AI không xem ảnh webcam; AI chỉ đọc event summary đã xử lý.”

Nếu user hỏi “công ty tôi có xem được không?”, trả lời:

“Không trong MVP. DeskMate không có employer dashboard và không chia sẻ dữ liệu cá nhân với công ty.”
