# Posture Tracking Python Module

Module Python cho phần theo dõi và đánh giá tư thế ngồi bằng BlazePose/MediaPipe.

Module này **không tự mở webcam** và **không lưu ảnh**. File main sẽ chạy webcam + MediaPipe, sau đó truyền landmarks vào module này.

## Pipeline

```txt
Webcam -> Preprocess -> BlazePose/MediaPipe -> posture_tracking -> Alert/Event/Stats
```

## Cách import từ main.py

```python
from posture_tracking import (
    PoseFrame,
    PoseLandmark,
    PostureAnalyzer,
    create_posture_calibration,
)
```

## Chạy demo webcam

Từ thư mục `C:\AI_codex`, cài thư viện:

```bash
pip install mediapipe opencv-python
```

Sau đó chạy:

```bash
python main.py
```

Khi cửa sổ webcam mở:

1. Ngồi thẳng trong 5 giây đầu để hiệu chuẩn.
2. Sau hiệu chuẩn, màn hình sẽ hiển thị trạng thái tư thế, score, confidence, khoảng cách tương đối, stillness và bad posture streak.
3. Nếu tư thế xấu hoặc tín hiệu fatigue kéo dài, terminal sẽ in cảnh báo/event.
4. Nhấn `q` để thoát.

## Ví dụ gọi trong main.py

```python
import time

from posture_tracking import (
    PoseFrame,
    PoseLandmark,
    PostureAnalyzer,
    create_posture_calibration,
)


def mediapipe_landmarks_to_frame(results) -> PoseFrame | None:
    if not results.pose_landmarks:
        return None

    landmarks = [
        PoseLandmark(
            x=landmark.x,
            y=landmark.y,
            z=landmark.z,
            visibility=landmark.visibility,
        )
        for landmark in results.pose_landmarks.landmark
    ]

    return PoseFrame(timestamp_ms=int(time.time() * 1000), landmarks=landmarks)


calibration_frames: list[PoseFrame] = []

# Trong vài giây đầu, khi user ngồi đúng tư thế:
# calibration_frames.append(frame)

calibration_result = create_posture_calibration(calibration_frames)

if calibration_result.ok and calibration_result.calibration is not None:
    analyzer = PostureAnalyzer(calibration_result.calibration)

    # Với mỗi frame mới từ MediaPipe:
    result = analyzer.analyze(frame)

    print(result.status, result.score, result.confidence)

    if result.alert is not None:
        print(result.alert.message)

    event = analyzer.to_event(result)
    if event is not None:
        print(event)
```

## Output chính

`analyzer.analyze(frame)` trả về:

- `status`: trạng thái tư thế.
- `score`: điểm 0–100.
- `confidence`: độ tin cậy.
- `features`: chỉ số hình học.
- `active_issues`: danh sách lỗi tư thế đang xảy ra.
- `alert`: cảnh báo nếu lỗi kéo dài quá ngưỡng.
- `stillness_ms`: thời gian ít chuyển động.
- `bad_posture_streak_ms`: chuỗi tư thế xấu liên tục.

Các trạng thái:

- `good`
- `forward_head`
- `head_tilt`
- `shoulder_imbalance`
- `too_close`
- `too_far`
- `not_visible`
- `low_movement`
- `possible_drowsiness`

## Fatigue signals

Module có thêm tín hiệu fatigue nhẹ:

- `fatigue.low_movement`: ít chuyển động trong thời gian dài.
- `fatigue.possible_drowsiness`: tín hiệu mệt/buồn ngủ có thể xảy ra khi ít chuyển động kéo dài kèm đầu/cổ cúi hoặc nghiêng.

Không nên gọi đây là “detect ngủ gật” chắc chắn. Cách nói đúng là “tín hiệu mệt/buồn ngủ” hoặc “possible drowsiness”. Module không phân tích cảm xúc.

## Privacy

- Không nhận raw image.
- Không lưu webcam frame.
- Chỉ nhận landmarks từ MediaPipe/BlazePose.
- Chỉ trả posture result/event.
