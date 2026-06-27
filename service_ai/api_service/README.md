# DeskMate AI FastAPI Service

FastAPI service này bọc hai module hiện có:

- `posture_tracking/`: hiệu chuẩn và phân tích posture landmarks.
- `chatbot/`: DeskMate Coach + RAG + OpenAI optional.

## Cài dependency

```bash
pip install fastapi uvicorn pydantic
```

Nếu dùng OpenAI chatbot:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

Nếu không có API key, chatbot vẫn chạy bằng fallback local.

## Chạy API

Từ thư mục `C:\AI_codex`:

```bash
python -m uvicorn api_service.main:app --reload --host 127.0.0.1 --port 8000
```

Mở docs:

```txt
http://127.0.0.1:8000/docs
```

## Endpoints

### Health

```http
GET /health
```

### Chatbot

```http
POST /chat
```

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

### RAG search

```http
POST /rag/search
```

Body:

```json
{
  "query": "Nó có soi mặt tôi không?",
  "limit": 5
}
```

Response:

```json
{
  "mode": "bm25",
  "documents": [
    {
      "source": "privacy_policy.md#3",
      "title": "Privacy của DeskMate AI",
      "content": "...",
      "score": 9.6
    }
  ]
}
```

`mode` có thể là:

- `vector`: đang dùng OpenAI embeddings + local JSON vector index.
- `bm25`: fallback local vì chưa có API key hoặc chưa có vector index.
- `bm25_fallback`: đã thử vector nhưng lỗi, nên fallback BM25.

Tạo vector index:

```powershell
$env:OPENAI_API_KEY="sk-..."
python -m rag.index_knowledge_base
```

### Mood check-in

Mood là dữ liệu user tự nhập, không phải detect từ webcam. DeskMate không detect vui, buồn, tức giận hoặc stress qua khuôn mặt.

```http
POST /mood/check-in
```

Body:

```json
{
  "mood": "tired",
  "energy": 2,
  "stress": 4,
  "note": "ngủ ít, đang chạy deadline"
}
```

Mood hợp lệ:

```txt
good, tired, stressed, focused, distracted, calm, overwhelmed, neutral
```

Xem mood gần đây:

```http
GET /mood/recent?limit=10
```

Xem mood summary:

```http
GET /mood/summary?limit=20
```

Xóa mood history local:

```http
DELETE /mood/history
```

Chatbot `/chat` sẽ tự dùng mood summary gần nhất nếu request chưa gửi mood context.

Các response mood luôn có:

```json
{
  "source": "self_report",
  "camera_emotion_detection": false
}
```

Privacy counters cũng expose rõ:

```json
{
  "camera_emotion_detection": false,
  "emotion_inference_from_face": false
}
```

### Posture calibration

```http
POST /posture/calibrate
```

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

Lưu ý: BlazePose cần đủ 33 landmarks. Ví dụ trên chỉ minh họa shape JSON.

### Posture analyze

```http
POST /posture/analyze
```

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

`landmarks` cần là 33 điểm từ MediaPipe/BlazePose.

### Reset posture session

```http
DELETE /posture/session/{session_id}
```

## Gợi ý tích hợp

Frontend hoặc app webcam nên:

1. Thu 5 giây landmarks khi user ngồi thẳng.
2. Gọi `/posture/calibrate`.
3. Với mỗi frame tiếp theo, gọi `/posture/analyze`.
4. Lưu `event` nếu response có event.
5. Gửi summary/event context vào `/chat` khi user hỏi chatbot.
