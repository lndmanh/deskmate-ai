import os
import time
import urllib.request
from pathlib import Path

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import cv2
import mediapipe as mp
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from mediapipe.tasks.python.core.base_options import BaseOptions
from mediapipe.tasks.python.vision import (
    PoseLandmarker,
    PoseLandmarkerOptions,
    PoseLandmarksConnections,
    RunningMode,
)

from posture_tracking import (
    PoseFrame,
    PoseLandmark,
    PostureAnalyzer,
    create_posture_calibration,
)
from posture_tracking.session_recorder import PostureSessionRecorder


CALIBRATION_SECONDS = 5
WINDOW_NAME = "DeskMate AI - Theo dõi tư thế"
MODEL_DIR = Path("models")
POSE_MODEL_PATH = MODEL_DIR / "pose_landmarker_lite.task"
POSE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
FONT_PATHS = [
    Path("C:/Windows/Fonts/arial.ttf"),
    Path("C:/Windows/Fonts/segoeui.ttf"),
    Path("C:/Windows/Fonts/calibri.ttf"),
]


def load_vietnamese_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for font_path in FONT_PATHS:
        if font_path.exists():
            return ImageFont.truetype(str(font_path), size)

    return ImageFont.load_default()


VIETNAMESE_FONT = load_vietnamese_font(22)


def mediapipe_landmarks_to_frame(result: object) -> PoseFrame | None:
    pose_landmarks = getattr(result, "pose_landmarks", None)

    if not pose_landmarks:
        return None

    first_person_landmarks = pose_landmarks[0]

    landmarks = [
        PoseLandmark(
            x=landmark.x,
            y=landmark.y,
            z=landmark.z,
            visibility=getattr(landmark, "visibility", 1.0),
        )
        for landmark in first_person_landmarks
    ]

    return PoseFrame(
        timestamp_ms=int(time.time() * 1000),
        landmarks=landmarks,
    )


def ensure_pose_model() -> Path:
    if POSE_MODEL_PATH.exists():
        return POSE_MODEL_PATH

    MODEL_DIR.mkdir(exist_ok=True)
    print(f"Đang tải model tư thế vào {POSE_MODEL_PATH}...")
    urllib.request.urlretrieve(POSE_MODEL_URL, POSE_MODEL_PATH)
    return POSE_MODEL_PATH


def create_pose_landmarker() -> PoseLandmarker:
    model_path = ensure_pose_model()
    options = PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(model_path)),
        running_mode=RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    return PoseLandmarker.create_from_options(options)


def draw_pose_landmarks(frame: object, result: object) -> None:
    pose_landmarks = getattr(result, "pose_landmarks", None)

    if not pose_landmarks:
        return

    first_person_landmarks = pose_landmarks[0]
    height, width = frame.shape[:2]

    for connection in PoseLandmarksConnections.POSE_LANDMARKS:
        start = first_person_landmarks[connection.start]
        end = first_person_landmarks[connection.end]
        start_point = (int(start.x * width), int(start.y * height))
        end_point = (int(end.x * width), int(end.y * height))
        cv2.line(frame, start_point, end_point, (0, 255, 0), 2)

    for landmark in first_person_landmarks:
        point = (int(landmark.x * width), int(landmark.y * height))
        cv2.circle(frame, point, 3, (0, 128, 255), -1)


def draw_text(
    frame: object,
    text: str,
    y: int,
    color: tuple[int, int, int] = (0, 255, 0),
    x: int = 30,
) -> None:
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    image = Image.fromarray(rgb_frame)
    draw = ImageDraw.Draw(image)
    bgr_color = color
    rgb_color = (bgr_color[2], bgr_color[1], bgr_color[0])
    draw.text((x, y - 22), text, font=VIETNAMESE_FONT, fill=rgb_color)
    frame[:, :, :] = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def draw_info_panel(frame: object, lines: list[tuple[str, tuple[int, int, int]]]) -> None:
    panel_x = 18
    panel_y = 18
    panel_width = 430
    line_height = 28
    panel_height = 28 + line_height * len(lines)

    overlay = frame.copy()
    cv2.rectangle(
        overlay,
        (panel_x, panel_y),
        (panel_x + panel_width, panel_y + panel_height),
        (20, 20, 20),
        -1,
    )
    cv2.addWeighted(overlay, 0.62, frame, 0.38, 0, frame)

    for index, (text, color) in enumerate(lines):
        draw_text(
            frame,
            text,
            panel_y + 30 + index * line_height,
            color,
            x=panel_x + 14,
        )


def normalize_head_tilt(raw_degrees: float) -> float:
    normalized = raw_degrees

    while normalized > 90:
        normalized -= 180

    while normalized < -90:
        normalized += 180

    return normalized


def describe_face_distance(face_scale: float) -> str:
    if face_scale >= 1.25:
        return "quá gần"
    if face_scale <= 0.78:
        return "quá xa"
    return "bình thường"


def translate_status(status: str) -> str:
    labels = {
        "good": "tư thế tốt",
        "forward_head": "cúi đầu / cổ đưa trước",
        "head_tilt": "nghiêng đầu",
        "shoulder_imbalance": "lệch vai",
        "too_close": "ngồi quá gần",
        "too_far": "ngồi quá xa",
        "not_visible": "không thấy rõ",
        "low_movement": "ít chuyển động",
        "possible_drowsiness": "tín hiệu mệt/buồn ngủ",
    }
    return labels.get(status, status)


def create_video_capture() -> cv2.VideoCapture | None:
    camera_indexes = [0, 1, 2]
    backends = [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]

    for camera_index in camera_indexes:
        for backend in backends:
            print(f"Đang thử webcam index={camera_index}, backend={backend}...")
            capture = cv2.VideoCapture(camera_index, backend)
            capture.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

            if not capture.isOpened():
                capture.release()
                continue

            success, _ = capture.read()

            if success:
                print(f"Đang dùng webcam index={camera_index}, backend={backend}.")
                return capture

            capture.release()

    return None


def main() -> None:
    capture = create_video_capture()

    if capture is None:
        print("Không mở được webcam. Hãy kiểm tra quyền camera hoặc đổi camera index.")
        return

    calibration_frames: list[PoseFrame] = []
    analyzer: PostureAnalyzer | None = None
    calibration_started_at = time.time()
    last_printed_event_type: str | None = None
    recorder = PostureSessionRecorder()

    print("DeskMate AI đã bắt đầu theo dõi tư thế.")
    print("Ngồi thẳng trong 5 giây đầu để hiệu chuẩn.")
    print("Nhấn q để thoát.")

    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)

    pose_landmarker = create_pose_landmarker()

    with pose_landmarker:
        while capture.isOpened():
            success, frame = capture.read()

            if not success:
                print("Không đọc được frame từ webcam.")
                break

            frame = cv2.flip(frame, 1)
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            timestamp_ms = int(time.time() * 1000)
            result = pose_landmarker.detect_for_video(mp_image, timestamp_ms)
            pose_frame = mediapipe_landmarks_to_frame(result)

            draw_pose_landmarks(frame, result)

            if analyzer is None:
                elapsed = time.time() - calibration_started_at
                remaining = max(CALIBRATION_SECONDS - int(elapsed), 0)

                draw_info_panel(
                    frame,
                    [
                        (f"Đang hiệu chuẩn: ngồi thẳng ({remaining}s)", (0, 255, 255)),
                        ("Giữ đầu và vai trong khung hình", (255, 255, 255)),
                        (f"Số frame đã ghi: {len(calibration_frames)}", (255, 255, 255)),
                    ],
                )

                if pose_frame is not None:
                    calibration_frames.append(pose_frame)

                if elapsed >= CALIBRATION_SECONDS:
                    calibration_result = create_posture_calibration(calibration_frames)

                    if calibration_result.ok and calibration_result.calibration is not None:
                        analyzer = PostureAnalyzer(calibration_result.calibration)
                        print("Calibration done.")
                    else:
                        reason = calibration_result.reason or "Hiệu chuẩn thất bại."
                        print(reason)
                        calibration_frames = []
                        calibration_started_at = time.time()
            else:
                if pose_frame is None:
                    draw_info_panel(
                        frame,
                        [
                            ("Trạng thái: không thấy rõ", (0, 0, 255)),
                            ("Đưa đầu và vai vào khung hình", (255, 255, 255)),
                        ],
                    )
                else:
                    result = analyzer.analyze(pose_frame)
                    status_color = (0, 255, 0) if result.status == "good" else (0, 165, 255)

                    if result.status in ["not_visible", "forward_head", "shoulder_imbalance", "possible_drowsiness"]:
                        status_color = (0, 0, 255)

                    panel_lines = [
                        (f"Trạng thái: {translate_status(result.status)}", status_color),
                        (f"Điểm tư thế: {result.score}/100", status_color),
                        (f"Độ tin cậy: {result.confidence:.2f}", (255, 255, 255)),
                    ]

                    if result.features is not None:
                        calibration = analyzer.calibration

                        if calibration is not None and calibration.face_size != 0:
                            face_scale = result.features.face_size / calibration.face_size
                        else:
                            face_scale = 1.0

                        if calibration is not None:
                            head_tilt_delta = abs(
                                normalize_head_tilt(result.features.head_tilt_degrees)
                                - normalize_head_tilt(calibration.head_tilt_degrees)
                            )
                            forward_delta = result.features.head_forward_ratio - calibration.head_forward_ratio
                            shoulder_percent = (
                                result.features.shoulder_delta_y / calibration.shoulder_width * 100
                                if calibration.shoulder_width != 0
                                else 0
                            )
                        else:
                            head_tilt_delta = 0.0
                            forward_delta = 0.0
                            shoulder_percent = 0.0

                        panel_lines.extend(
                            [
                                (
                                    f"Khoảng cách màn hình: {describe_face_distance(face_scale)} ({face_scale:.2f}x)",
                                    (255, 255, 255),
                                ),
                                (f"Độ lệch đầu: {head_tilt_delta:.1f}°", (255, 255, 255)),
                                (f"Cúi đầu/cổ đưa trước: {forward_delta:+.3f}", (255, 255, 255)),
                                (f"Độ lệch vai: {shoulder_percent:.1f}%", (255, 255, 255)),
                                (f"Ít chuyển động: {result.stillness_ms // 1000}s", (255, 255, 255)),
                                (f"Chuỗi tư thế xấu: {result.bad_posture_streak_ms // 1000}s", (255, 255, 255)),
                            ]
                        )

                    if result.alert is not None:
                        panel_lines.append((result.alert.message, (0, 0, 255)))
                        print(result.alert.message)

                    draw_info_panel(frame, panel_lines)

                    event = analyzer.to_event(result)
                    recorder.record(result, event)

                    if event is not None and event.type != last_printed_event_type:
                        print(event)
                        last_printed_event_type = event.type

            cv2.imshow(WINDOW_NAME, frame)

            if cv2.waitKey(5) & 0xFF == ord("q"):
                break

    recorder.save()
    capture.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
