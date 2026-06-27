import time
from concurrent.futures import Future, ThreadPoolExecutor
from threading import Lock

import cv2

from .types import EmotionDetectionResult


class EmotionDetector:
    def __init__(self, min_interval_ms: int = 4_000, max_frame_width: int = 320) -> None:
        self.min_interval_ms = min_interval_ms
        self.max_frame_width = max_frame_width
        self._last_analyzed_at_ms = 0
        self._last_result = EmotionDetectionResult(
            dominant_emotion=None,
            confidence=0.0,
            available=False,
            reason="emotion detector has not run yet",
        )
        self._recognizer = self._load_recognizer()
        self._face_detector = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        self._executor = ThreadPoolExecutor(max_workers=1)
        self._pending_future: Future | None = None
        self._lock = Lock()

    def is_available(self) -> bool:
        return self._recognizer is not None

    def analyze_frame(self, frame, landmarks=None) -> EmotionDetectionResult:
        if self._recognizer is None:
            return EmotionDetectionResult(
                dominant_emotion=None,
                confidence=0.0,
                available=False,
                reason="HSEmotion-ONNX is not installed. Install optional emotion requirements first.",
            )

        now_ms = int(time.time() * 1000)

        if now_ms - self._last_analyzed_at_ms < self.min_interval_ms:
            return self._get_last_result()

        if self._pending_future is not None and not self._pending_future.done():
            return self._get_last_result()

        self._last_analyzed_at_ms = now_ms
        resized_frame = self._resize_frame(frame.copy())
        resized_landmarks = landmarks
        if resized_landmarks is not None:
            self._pending_future = self._executor.submit(
                self._analyze_frame_sync,
                resized_frame,
                resized_landmarks,
            )
        else:
            self._pending_future = self._executor.submit(self._analyze_frame_sync, resized_frame)
        self._pending_future.add_done_callback(self._store_future_result)
        return self._get_last_result()

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)

    def _analyze_frame_sync(self, frame, landmarks=None) -> EmotionDetectionResult:
        if self._recognizer is None:
            return EmotionDetectionResult(
                dominant_emotion=None,
                confidence=0.0,
                available=False,
                reason="HSEmotion-ONNX is not installed. Install optional emotion requirements first.",
            )

        face_crop = self._crop_largest_face(frame, landmarks)

        if face_crop is None:
            return EmotionDetectionResult(
                dominant_emotion=None,
                confidence=0.0,
                available=False,
                reason="no face detected",
            )

        try:
            emotion, raw_scores = self._recognizer.predict_emotions(face_crop, logits=False)
        except Exception as error:
            return EmotionDetectionResult(
                dominant_emotion=None,
                confidence=0.0,
                available=False,
                reason=f"Emotion analysis failed: {error}",
            )

        if not isinstance(emotion, str):
            return EmotionDetectionResult(
                dominant_emotion=None,
                confidence=0.0,
                available=False,
                reason="Emotion label was not available.",
            )

        scores = self._build_score_dict(raw_scores)
        confidence = scores.get(emotion, 0.0)

        return EmotionDetectionResult(
            dominant_emotion=emotion,
            confidence=confidence,
            scores=scores,
            available=True,
        )

    def _store_future_result(self, future: Future) -> None:
        try:
            result = future.result()
        except Exception as error:
            result = EmotionDetectionResult(
                dominant_emotion=None,
                confidence=0.0,
                available=False,
                reason=f"Emotion analysis failed: {error}",
            )

        with self._lock:
            self._last_result = result

    def _get_last_result(self) -> EmotionDetectionResult:
        with self._lock:
            return self._last_result

    def _resize_frame(self, frame):
        height, width = frame.shape[:2]

        if width <= self.max_frame_width:
            return frame

        scale = self.max_frame_width / width
        target_size = (self.max_frame_width, int(height * scale))
        return cv2.resize(frame, target_size, interpolation=cv2.INTER_AREA)

    def _crop_largest_face(self, frame, landmarks=None):
        face_crop = self._crop_face_from_pose_landmarks(frame, landmarks)

        if face_crop is not None:
            return face_crop

        gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self._face_detector.detectMultiScale(
            gray_frame,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(48, 48),
        )

        if len(faces) == 0:
            return None

        x, y, width, height = max(faces, key=lambda face: face[2] * face[3])
        margin_x = int(width * 0.15)
        margin_y = int(height * 0.18)
        frame_height, frame_width = frame.shape[:2]
        left = max(x - margin_x, 0)
        top = max(y - margin_y, 0)
        right = min(x + width + margin_x, frame_width)
        bottom = min(y + height + margin_y, frame_height)
        face_crop_bgr = frame[top:bottom, left:right]
        return cv2.cvtColor(face_crop_bgr, cv2.COLOR_BGR2RGB)

    def _crop_face_from_pose_landmarks(self, frame, landmarks):
        if landmarks is None or len(landmarks) < 11:
            return None

        frame_height, frame_width = frame.shape[:2]
        face_indexes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        visible_points = []

        for index in face_indexes:
            landmark = landmarks[index]

            if landmark.visibility < 0.35:
                continue

            visible_points.append((int(landmark.x * frame_width), int(landmark.y * frame_height)))

        if len(visible_points) < 4:
            return None

        xs = [point[0] for point in visible_points]
        ys = [point[1] for point in visible_points]
        left = min(xs)
        right = max(xs)
        top = min(ys)
        bottom = max(ys)
        width = right - left
        height = bottom - top

        if width < 24 or height < 24:
            return None

        margin_x = int(width * 0.85)
        margin_top = int(height * 1.15)
        margin_bottom = int(height * 2.25)
        crop_left = max(left - margin_x, 0)
        crop_top = max(top - margin_top, 0)
        crop_right = min(right + margin_x, frame_width)
        crop_bottom = min(bottom + margin_bottom, frame_height)

        if crop_right <= crop_left or crop_bottom <= crop_top:
            return None

        face_crop_bgr = frame[crop_top:crop_bottom, crop_left:crop_right]
        return cv2.cvtColor(face_crop_bgr, cv2.COLOR_BGR2RGB)

    def _build_score_dict(self, raw_scores) -> dict[str, float]:
        if self._recognizer is None:
            return {}

        return {
            label: float(raw_scores[index])
            for index, label in self._recognizer.idx_to_class.items()
            if index < len(raw_scores)
        }

    def _load_recognizer(self):
        try:
            from hsemotion_onnx.facial_emotions import HSEmotionRecognizer
        except ImportError:
            return None

        return HSEmotionRecognizer(model_name="enet_b0_8_best_vgaf")
