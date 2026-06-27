import math

from .constants import BLAZEPOSE_LANDMARKS
from .types import PoseLandmark, PostureFeatures


def distance_2d(a: PoseLandmark, b: PoseLandmark) -> float:
    dx = a.x - b.x
    dy = a.y - b.y
    return math.sqrt(dx * dx + dy * dy)


def midpoint(a: PoseLandmark, b: PoseLandmark) -> PoseLandmark:
    return PoseLandmark(
        x=(a.x + b.x) / 2,
        y=(a.y + b.y) / 2,
        z=(a.z + b.z) / 2,
        visibility=min(a.visibility, b.visibility),
    )


def angle_degrees(a: PoseLandmark, b: PoseLandmark) -> float:
    radians = math.atan2(b.y - a.y, b.x - a.x)
    return radians * (180 / math.pi)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(max(value, minimum), maximum)


def average(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def get_required_upper_body_landmarks(landmarks: list[PoseLandmark]) -> list[PoseLandmark] | None:
    required_indexes = [
        BLAZEPOSE_LANDMARKS["nose"],
        BLAZEPOSE_LANDMARKS["left_eye_inner"],
        BLAZEPOSE_LANDMARKS["right_eye_inner"],
        BLAZEPOSE_LANDMARKS["left_ear"],
        BLAZEPOSE_LANDMARKS["right_ear"],
        BLAZEPOSE_LANDMARKS["left_shoulder"],
        BLAZEPOSE_LANDMARKS["right_shoulder"],
    ]

    if len(landmarks) <= max(required_indexes):
        return None

    return [landmarks[index] for index in required_indexes]


def calculate_upper_body_visibility(landmarks: list[PoseLandmark]) -> float:
    required = get_required_upper_body_landmarks(landmarks)

    if required is None:
        return 0.0

    return average([landmark.visibility for landmark in required])


def extract_posture_features(landmarks: list[PoseLandmark]) -> PostureFeatures | None:
    if len(landmarks) <= BLAZEPOSE_LANDMARKS["right_shoulder"]:
        return None

    nose = landmarks[BLAZEPOSE_LANDMARKS["nose"]]
    left_eye_inner = landmarks[BLAZEPOSE_LANDMARKS["left_eye_inner"]]
    right_eye_inner = landmarks[BLAZEPOSE_LANDMARKS["right_eye_inner"]]
    left_ear = landmarks[BLAZEPOSE_LANDMARKS["left_ear"]]
    right_ear = landmarks[BLAZEPOSE_LANDMARKS["right_ear"]]
    left_shoulder = landmarks[BLAZEPOSE_LANDMARKS["left_shoulder"]]
    right_shoulder = landmarks[BLAZEPOSE_LANDMARKS["right_shoulder"]]

    shoulder_width = distance_2d(left_shoulder, right_shoulder)
    shoulder_delta_y = abs(left_shoulder.y - right_shoulder.y)
    eye_distance = distance_2d(left_eye_inner, right_eye_inner)
    ear_distance = distance_2d(left_ear, right_ear)
    face_size = max(eye_distance, ear_distance)
    shoulder_center = midpoint(left_shoulder, right_shoulder)
    ear_center = midpoint(left_ear, right_ear)

    if shoulder_width == 0:
        head_forward_ratio = 0.0
    else:
        nose_to_shoulder = abs(nose.x - shoulder_center.x) / shoulder_width
        ear_to_shoulder = abs(ear_center.x - shoulder_center.x) / shoulder_width
        head_forward_ratio = max(nose_to_shoulder, ear_to_shoulder)

    return PostureFeatures(
        shoulder_width=shoulder_width,
        shoulder_delta_y=shoulder_delta_y,
        face_size=face_size,
        eye_distance=eye_distance,
        head_forward_ratio=head_forward_ratio,
        head_tilt_degrees=angle_degrees(left_ear, right_ear),
        visibility_confidence=calculate_upper_body_visibility(landmarks),
    )
