from dataclasses import dataclass

from .geometry import average, extract_posture_features
from .types import PoseFrame, PostureCalibration, PostureFeatures, PostureThresholds


@dataclass(frozen=True)
class CalibrationResult:
    ok: bool
    calibration: PostureCalibration | None = None
    reason: str | None = None


def create_posture_calibration(
    frames: list[PoseFrame],
    thresholds: PostureThresholds | None = None,
) -> CalibrationResult:
    posture_thresholds = thresholds or PostureThresholds()
    features: list[PostureFeatures] = []

    for frame in frames:
        feature = extract_posture_features(frame.landmarks)
        if feature is not None and feature.visibility_confidence >= posture_thresholds.min_visibility:
            features.append(feature)

    if len(features) < 5:
        return CalibrationResult(
            ok=False,
            reason="Không đủ frame rõ để hiệu chuẩn. Hãy ngồi trong vùng webcam vài giây.",
        )

    last_frame = frames[-1]

    return CalibrationResult(
        ok=True,
        calibration=PostureCalibration(
            shoulder_width=average([feature.shoulder_width for feature in features]),
            shoulder_balance_y=average([feature.shoulder_delta_y for feature in features]),
            face_size=average([feature.face_size for feature in features]),
            eye_distance=average([feature.eye_distance for feature in features]),
            head_forward_ratio=average([feature.head_forward_ratio for feature in features]),
            head_tilt_degrees=average([feature.head_tilt_degrees for feature in features]),
            calibrated_at_ms=last_frame.timestamp_ms,
        ),
    )
