# Troubleshooting DeskMate AI

Tài liệu này hỗ trợ debug nhanh khi demo hoặc chạy local.

## Webcam không mở

Nếu webcam không mở:

- Kiểm tra app khác có đang dùng camera không.
- Kiểm tra quyền camera của Windows.
- Thử camera index 0, 1, 2.
- Thử backend DirectShow hoặc MSMF.
- Restart terminal hoặc app.

Trong code hiện tại, `main.py` đã thử nhiều webcam index và backend.

## Cửa sổ webcam không hiện

Nếu terminal chạy nhưng cửa sổ không hiện:

- Kiểm tra terminal có bị đứng ở bước tải model không.
- Kiểm tra taskbar có cửa sổ OpenCV bị ẩn không.
- Chạy lại không dùng FastAPI server nếu đang chiếm camera.
- Đảm bảo `cv2.imshow` được gọi từ môi trường desktop, không phải remote/headless.

## MediaPipe không có `solutions`

Một số bản MediaPipe mới chỉ expose `mediapipe.tasks`, không có `mp.solutions`. Code hiện tại đã dùng `PoseLandmarker` từ MediaPipe Tasks API.

## Model `.task` không tải được

Nếu không tải được model:

- Kiểm tra internet.
- Tải thủ công file `pose_landmarker_lite.task`.
- Đặt vào folder `models/`.
- Đảm bảo đường dẫn là `models/pose_landmarker_lite.task`.

## FastAPI `/` trả 404

Không phải lỗi. Docs nằm ở:

```txt
http://127.0.0.1:8000/docs
```

Health check:

```txt
http://127.0.0.1:8000/health
```

## Uvicorn `--reload` bị Aborted trên Windows

Chạy không dùng reload:

```bash
python -m uvicorn api_service.main:app --host 127.0.0.1 --port 8000
```

## Chatbot trả lời local fallback

Nếu thấy:

```txt
DeskMate (local fallback)
```

nghĩa là chưa set `OPENAI_API_KEY` hoặc API lỗi. Set key:

```powershell
$env:OPENAI_API_KEY="sk-..."
python chatbot_cli.py
```

## PowerShell lỗi tiếng Việt

Chạy:

```powershell
$env:PYTHONIOENCODING="utf-8"
chcp 65001
```

Sau đó chạy lại chatbot.
