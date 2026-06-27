# DeskMate AI MVP

DeskMate AI là MVP trợ lý local-first cho người làm việc với máy tính. App hiện có các phần chính:

- Theo dõi tư thế bằng webcam + MediaPipe/BlazePose landmarks.
- Tính posture score, posture status, stillness và fatigue signal nhẹ.
- Chatbot tiếng Việt có RAG từ knowledge base nội bộ.
- FastAPI service để gọi chatbot, RAG, posture analysis và mood check-in.
- Mood check-in do người dùng tự nhập, không detect cảm xúc từ camera.

> DeskMate AI không phải app y tế, không chẩn đoán bệnh, không phân tích cảm xúc từ khuôn mặt, không lưu raw webcam frames.

---

## 1. Cấu trúc thư mục

```txt
C:\AI_codex
  main.py                     # Demo webcam posture tracking local
  chatbot_cli.py              # Demo chatbot trong terminal
  requirements-api.txt        # Dependency FastAPI

  posture_tracking/           # Module phân tích tư thế từ landmarks
  chatbot/                    # DeskMate Coach, LLM client, prompt
  rag/                        # Hybrid RAG: OpenAI embeddings + JSON vector store + BM25 fallback
  knowledge_base/             # Tài liệu nội bộ cho RAG
  api_service/                # FastAPI service
  mood_tracking/              # Mood self-report local JSON store
  models/                     # MediaPipe .task model nếu đã tải
  data/                       # Mood check-ins local JSON
  rag_index/                  # Vector index JSON nếu đã tạo
```

---

## 2. Những gì đã làm được

### 2.1. Webcam posture tracking

File chính:

```txt
main.py
posture_tracking/
```

Đã làm được:

- Mở webcam local bằng OpenCV.
- Dùng MediaPipe Tasks `PoseLandmarker`.
- Tự tải model `pose_landmarker_lite.task` nếu chưa có.
- Hiệu chuẩn tư thế chuẩn trong 5 giây đầu.
- Trích xuất landmarks phần đầu/vai.
- Tính posture features: head tilt, forward head ratio, shoulder imbalance, face distance relative scale, visibility confidence.
- Tính posture score 0–100.
- Hiển thị overlay tiếng Việt trên webcam.
- Có cảnh báo khi tư thế xấu kéo dài.

Trạng thái posture hiện có:

```txt
good
forward_head
head_tilt
shoulder_imbalance
too_close
too_far
not_visible
low_movement
possible_drowsiness
```

Events hiện có:

```txt
posture.forward_head
posture.head_tilt
posture.shoulder_imbalance
posture.face_distance
posture.not_visible
fatigue.low_movement
fatigue.possible_drowsiness
```

### 2.2. Fatigue / stillness signal

Đã làm được:

- Tính `stillness_ms`.
- Tính `bad_posture_streak_ms`.
- Phát hiện `low_movement` khi ít chuyển động kéo dài.
- Phát hiện `possible_drowsiness` khi ít chuyển động kéo dài kèm tín hiệu đầu/cổ không ổn định.

Giới hạn:

- Không kết luận người dùng đang ngủ gật.
- Chỉ nói “tín hiệu mệt/buồn ngủ có thể xảy ra”.

### 2.3. Mood check-in

Folder:

```txt
mood_tracking/
```

Đã làm được:

- Lưu mood do user tự chọn hoặc tự nhập.
- Lưu local JSON tại `data/mood_checkins.json`.
- Tính mood summary: latest mood, average energy, average stress, mood counts.

Mood labels:

```txt
good
tired
stressed
focused
distracted
calm
overwhelmed
neutral
```

Quan trọng:

- Mood là self-report.
- Không detect cảm xúc từ webcam.
- Không nói “camera thấy bạn buồn/stress”.

### 2.4. Chatbot tiếng Việt

Folder:

```txt
chatbot/
```

Đã làm được:

- Chatbot `DeskMateCoach`.
- Trả lời tiếng Việt.
- Có system prompt guardrails.
- Không chẩn đoán bệnh.
- Không phân tích cảm xúc từ khuôn mặt.
- Không nói AI xem ảnh webcam.
- Có fallback local nếu chưa có OpenAI API key.
- Có thể dùng context về posture, workday, privacy và mood self-report.

Nếu có `OPENAI_API_KEY`, chatbot gọi OpenAI Chat Completions. Nếu chưa có key, chatbot dùng local fallback.

### 2.5. RAG

Folder:

```txt
rag/
knowledge_base/
```

Đã làm được:

- Đọc markdown từ `knowledge_base/`.
- Chunk tài liệu.
- BM25 local search.
- Query expansion nhẹ.
- Topic boost.
- OpenAI embeddings nếu có API key.
- Local JSON vector store.
- BM25 fallback nếu chưa có vector index hoặc chưa có key.

RAG mode:

```txt
vector          # dùng OpenAI embeddings + local JSON vector index
bm25            # fallback local
bm25_fallback   # thử vector lỗi, fallback BM25
```

Tạo vector index:

```powershell
$env:OPENAI_API_KEY="sk-..."
python -m rag.index_knowledge_base
```

Vector index lưu tại:

```txt
rag_index/knowledge_base_vectors.json
```

### 2.6. Knowledge base

Folder:

```txt
knowledge_base/
```

Đã có tài liệu về posture basics, nudge routines, privacy, product FAQ, event schema, workday timeline, daily report, personal baseline, Vietnam context, judge Q&A, chatbot guardrails, ergonomic setup, camera/calibration, troubleshooting, API reference, business model, competitor analysis, data retention, demo script và mood check-in.

### 2.7. FastAPI service

Folder:

```txt
api_service/
```

Đã làm được endpoint:

```txt
GET    /health
POST   /chat
POST   /rag/search
POST   /posture/calibrate
POST   /posture/analyze
DELETE /posture/session/{session_id}
POST   /mood/check-in
GET    /mood/recent
GET    /mood/summary
```

Docs:

```txt
http://127.0.0.1:8000/docs
```

---

## 3. Những gì chưa làm được / chưa tối ưu

### 3.1. Chưa có UI desktop hoàn chỉnh

Hiện tại mới có webcam demo bằng OpenCV, chatbot CLI và FastAPI Swagger docs. Chưa có app desktop đẹp kiểu Electron/Tauri/Streamlit.

### 3.2. Chưa có event store hoàn chỉnh

Posture events hiện được tạo ra nhưng chưa có database event store chung cho toàn app. Chưa có SQLite schema cho posture events, work session events, nudge events và daily summaries.

### 3.3. Chưa có activity tracker thật

Chưa track thật active computer time, idle time, app category usage, break detection từ hệ điều hành hoặc longest uninterrupted session thật.

### 3.4. Chưa có daily report thật từ event store

Chatbot và knowledge base đã hỗ trợ daily report, nhưng chưa có pipeline hoàn chỉnh:

```txt
event store -> daily aggregate -> AI report -> report UI
```

### 3.5. Chưa có mascot nudge UI thật

Đã có nudge logic/tài liệu, nhưng chưa có popup mascot UI với snooze/done thật.

### 3.6. Chưa có privacy dashboard UI thật

Đã có privacy policy và chatbot trả lời privacy, nhưng chưa có màn hình dashboard trực quan.

### 3.7. Chưa detect cảm xúc từ camera

Cố ý chưa làm. DeskMate không detect vui, buồn, tức giận hoặc stress qua khuôn mặt. Mood hiện tại chỉ là user tự check-in.

### 3.8. Chưa đo khoảng cách màn hình bằng cm

Hiện chỉ đo khoảng cách tương đối:

```txt
face_scale = current_face_size / calibrated_face_size
```

Không đo được chính xác cm nếu không có depth sensor hoặc calibration vật chuẩn.

### 3.9. Chưa tối ưu hiệu năng

Hiện app ở mức MVP demo. Chưa tối ưu throttle MediaPipe FPS, resize frame trước inference, giảm vẽ overlay bằng Pillow mỗi frame, throttle terminal logs hoặc chuyển JSON sang SQLite.

### 3.10. Chưa production-ready

Chưa có auth, multi-user storage, background worker, robust retry/caching cho LLM, eval set cho RAG, packaging app desktop hoặc installer.

---

## 4. Cách chạy

### 4.1. Chạy webcam posture demo

```powershell
cd C:\AI_codex
python main.py
```

Hoặc nếu dùng Python path cụ thể:

```powershell
& C:/Users/hongp/AppData/Local/Microsoft/WindowsApps/python3.13.exe c:/AI_codex/main.py
```

Khi chạy:

1. Ngồi thẳng 5 giây đầu để calibration.
2. Xem overlay tư thế trên webcam.
3. Nhấn `q` để thoát.

### 4.2. Chạy chatbot CLI

```powershell
cd C:\AI_codex
python chatbot_cli.py
```

Nếu lỗi tiếng Việt trong PowerShell:

```powershell
$env:PYTHONIOENCODING="utf-8"
chcp 65001
python chatbot_cli.py
```

### 4.3. Chạy FastAPI server

```powershell
cd C:\AI_codex
python -m uvicorn api_service.main:app --host 127.0.0.1 --port 8000
```

Mở docs:

```txt
http://127.0.0.1:8000/docs
```

Health check:

```txt
http://127.0.0.1:8000/health
```

### 4.4. Tạo vector index cho RAG Level 3

Nếu có OpenAI key:

```powershell
$env:OPENAI_API_KEY="sk-..."
python -m rag.index_knowledge_base
```

Nếu không tạo index, RAG vẫn chạy bằng BM25 fallback.

---

## 5. Demo gợi ý

### Demo posture

```powershell
python main.py
```

Show calibration, posture score, head tilt, face distance relative, stillness và possible drowsiness signal nếu có.

### Demo API

```powershell
python -m uvicorn api_service.main:app --host 127.0.0.1 --port 8000
```

Mở:

```txt
http://127.0.0.1:8000/docs
```

Test `/chat`, `/rag/search`, `/mood/check-in`, `/mood/summary`.

### Demo chatbot privacy

Hỏi:

```txt
Bạn có lưu ảnh webcam không?
```

Kỳ vọng:

```txt
Không. Webcam xử lý local, raw frames stored = 0, AI không xem ảnh webcam.
```

### Demo mood self-report

Gọi `/mood/check-in`:

```json
{
  "mood": "tired",
  "energy": 2,
  "stress": 4,
  "note": "ngủ ít, đang chạy deadline"
}
```

Sau đó hỏi `/chat`:

```txt
mood của tôi thế nào?
```

---

## 6. Guardrails quan trọng

DeskMate phải giữ các nguyên tắc sau:

- Không chẩn đoán bệnh.
- Không phân tích cảm xúc từ webcam.
- Không nói user đang stress dựa trên khuôn mặt.
- Không khẳng định user đang ngủ gật.
- Không lưu raw webcam frames.
- Không gửi ảnh webcam cho AI.
- Không có employer dashboard trong MVP.
- Nếu thiếu dữ liệu, nói rõ là thiếu dữ liệu.
- Nếu user đau kéo dài hoặc có triệu chứng nghiêm trọng, khuyên hỏi chuyên gia y tế.

---

## 7. Roadmap đề xuất

### Ưu tiên gần

1. Tối ưu hiệu năng `main.py`: throttle FPS, resize frame, throttle overlay/log.
2. Thêm SQLite event store.
3. Tạo daily aggregate.
4. Tạo privacy dashboard UI.
5. Tạo mascot nudge UI.
6. Kết nối `main.py` với FastAPI thay vì gọi module trực tiếp.

### Sau MVP

1. App desktop bằng Electron/Tauri/Streamlit.
2. Activity tracker thật.
3. Daily report UI.
4. RAG eval set.
5. Better vector store hoặc ChromaDB nếu cần scale.
6. Packaging/installer.
