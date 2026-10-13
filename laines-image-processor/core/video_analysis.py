import math
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

import config

_MIN_ANGLE_STEP = math.radians(config.MIN_ANGLE_STEP_DEG)

from .calibration import (
    get_height_px,
    get_height_from_landmarks,
    get_mask_width_at_row,
    get_body_levels,
)
from .image_analysis import apply_clahe, refine_mask, landmarks_are_visible


def _make_video_detector() -> mp_vision.PoseLandmarker:
    base_options = mp_python.BaseOptions(model_asset_path=config.MODEL_PATH)
    options = mp_vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=mp_vision.RunningMode.VIDEO,
        output_segmentation_masks=True,
        num_poses=1,
    )
    return mp_vision.PoseLandmarker.create_from_options(options)


def estimate_rotation(world_landmarks) -> float:
    lm = world_landmarks[0]
    left = lm[11]
    right = lm[12]
    dx = right.x - left.x
    dz = right.z - left.z
    return math.atan2(dz, dx)


def check_angular_coverage(thetas: list[float], min_degrees: float = None) -> bool:
    if min_degrees is None:
        min_degrees = config.MIN_COVERAGE_DEG
    if not thetas:
        return False
    bin_size = 10
    n_bins = 360 // bin_size
    covered = set()
    for theta in thetas:
        deg = math.degrees(theta) % 360
        covered.add(int(deg // bin_size))
    return len(covered) * bin_size >= min_degrees


def analyze_video(
    capture: dict,
    estatura_cm: float,
    sexo: str = 'masculino',
    photo_px_por_cm: float | None = None,
) -> tuple[list[dict], bool, dict]:
    """
    Analyze the 360° rotation video using MediaPipe Tasks VIDEO mode.

    Scale strategy:
      - If photo_px_por_cm is provided (ArUco-derived), use it directly.
      - Otherwise, fallback to height calibration from video frames.
    """
    _fallback_no_source: dict = {'metodo': 'altura_fallback', 'px_por_cm': None, 'confianca': 'baixa'}

    source = capture.get('source', {})
    video_path = source.get('path')
    if not video_path:
        return [], False, _fallback_no_source

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return [], False, _fallback_no_source

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    step = max(1, int(fps / config.TARGET_FPS))

    # ── Scale determination ─────────────────────────────────────────────────
    if photo_px_por_cm is not None and photo_px_por_cm > 0:
        scale = 1.0 / photo_px_por_cm
        calibracao_video: dict = {
            'metodo': 'aruco_derivado_das_fotos',
            'px_por_cm': round(photo_px_por_cm, 4),
            'confianca': 'alta',
            'suposicao': 'distancia_camera_constante_entre_fotos_e_video',
        }
    else:
        # Pass 1: robust height calibration
        heights: list[float] = []
        frame_idx = 0

        with _make_video_detector() as detector:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                timestamp_ms = int(frame_idx * 1000 / fps)

                if frame_idx % step == 0:
                    frame_enh = apply_clahe(frame)
                    rgb = cv2.cvtColor(frame_enh, cv2.COLOR_BGR2RGB)
                    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                    result = detector.detect_for_video(mp_image, timestamp_ms)
                    if result.pose_landmarks and result.segmentation_masks:
                        lm = result.pose_landmarks[0]
                        raw_mask = (result.segmentation_masks[0].numpy_view() > config.MASK_THRESHOLD).astype(np.uint8)
                        h_px = get_height_px(refine_mask(raw_mask))
                        if h_px < 50:
                            h_px = get_height_from_landmarks(lm, frame.shape[0])
                        if h_px > 50:
                            heights.append(h_px)

                frame_idx += 1

        if not heights:
            cap.release()
            return [], False, {'metodo': 'altura_fallback', 'px_por_cm': None, 'confianca': 'baixa'}

        scale = estatura_cm / float(np.median(heights))
        calibracao_video = {
            'metodo': 'altura_fallback',
            'px_por_cm': round(1.0 / scale, 4) if scale > 0 else None,
            'confianca': 'baixa',
        }

    # ── Pass 2: measurement collection ─────────────────────────────────────
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    data_points: list[dict] = []
    all_thetas: list[float] = []
    frame_idx = 0
    prev_theta: float | None = None

    with _make_video_detector() as detector:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            timestamp_ms = int(frame_idx * 1000 / fps)

            if frame_idx % step != 0:
                frame_idx += 1
                continue

            h, w = frame.shape[:2]
            frame_enh = apply_clahe(frame)
            rgb = cv2.cvtColor(frame_enh, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = detector.detect_for_video(mp_image, timestamp_ms)

            if (
                not result.pose_landmarks
                or not result.pose_world_landmarks
                or not result.segmentation_masks
            ):
                frame_idx += 1
                continue

            lm = result.pose_landmarks[0]

            if not landmarks_are_visible(lm):
                frame_idx += 1
                continue

            theta = estimate_rotation(result.pose_world_landmarks)
            all_thetas.append(theta)

            if prev_theta is not None:
                diff = abs(theta - prev_theta)
                if diff > math.pi:
                    diff = 2 * math.pi - diff
                if diff < _MIN_ANGLE_STEP:
                    frame_idx += 1
                    continue

            prev_theta = theta

            raw_mask = (result.segmentation_masks[0].numpy_view() > config.MASK_THRESHOLD).astype(np.uint8)
            mask = refine_mask(raw_mask)

            # Use anatomical search with sex
            levels = get_body_levels(lm, mask, h, w, sexo)

            point: dict = {'theta': theta, 'weight': config.VIDEO_FRAME_WEIGHT}
            has_waist = False

            for name in ('neck', 'chest', 'waist', 'hip', 'thigh', 'calf'):
                row_y = levels.get(name)
                if row_y is None:
                    continue
                width_px = get_mask_width_at_row(mask, row_y)
                if width_px > 0:
                    point[f'{name}_radius'] = (width_px * scale) / 2.0
                    if name == 'waist':
                        has_waist = True

            if has_waist:
                data_points.append(point)

            frame_idx += 1

    cap.release()
    coverage_ok = check_angular_coverage(all_thetas)
    return data_points, coverage_ok, calibracao_video