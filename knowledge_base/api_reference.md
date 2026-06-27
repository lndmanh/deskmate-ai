# API reference DeskMate AI

FastAPI service expose API cho chatbot và posture tracking.

Base URL local:

```txt
http://127.0.0.1:8000
```

Docs:

```txt
http://127.0.0.1:8000/docs
```

## GET /health

Kiểm tra server sống hay không.

Response:

```json
{
  "ok": true,
  "service": "deskmate-ai-api"
}
```

## POST /chat

Gửi câu hỏi cho DeskMate Coach.

Body:

```json
{
  "question": "Bạn có lưu ảnh webcam không?",
  "context": {
    "active_time": "7h 12m",
    "longest_session": "96m",
    "current_session_minutes": 76,
    "posture_status": "head_tilt",
    "posture_score": 66,
    "posture_confidence": 1.0,
    "cloud_mode": false,
    "raw_images_stored": 0
  }
}
```

Response:

```json
{
  "answer": "...",
  "used_llm": false,
  "retrieved_documents": []
}
```

## POST /posture/calibrate

Hiệu chuẩn posture session bằng nhiều frame landmarks.

Body:

```json
{
  "session_id": "demo-user",
  "frames": [
    {
      "timestamp_ms": 1782478000000,
      "landmarks": [
        { "x": 0.5, "y": 0.2, "z": 0.0, "visibility": 0.99 }
      ]
    }
  ]
}
```

Thực tế cần đủ 33 landmarks từ BlazePose/MediaPipe.

## POST /posture/analyze

Phân tích một frame sau khi đã calibration.

Body:

```json
{
  "session_id": "demo-user",
  "frame": {
    "timestamp_ms": 1782478005000,
    "landmarks": []
  }
}
```

Response gồm:

- status
- score
- confidence
- features
- active_issues
- alert
- event

## DELETE /posture/session/{session_id}

Xóa analyzer session khỏi memory. Dùng khi user muốn calibration lại.

## Flow frontend tích hợp

```txt
1. Webcam/MediaPipe lấy landmarks.
2. Thu 5 giây frame khi user ngồi thẳng.
3. POST /posture/calibrate.
4. Với mỗi frame tiếp theo, POST /posture/analyze.
5. Nếu response có event, lưu vào event store.
6. Khi user hỏi chatbot, gửi summary vào POST /chat.
```
