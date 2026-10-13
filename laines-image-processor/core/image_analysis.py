import math
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

import config
from .calibration import (
    get_height_px,
    get_height_from_landmarks,
    get_mask_width_at_row,
    get_body_levels,
)
from .aruco_calibration import detect_aruco_scale
from .body_parsing import (
    apply_body_parsing,
    get_leg_widths_at_row,
    parsing_confidence,
)

# Lazy-loaded body parsing model — initialised once on first frontal photo
_body_parsing_model = None
_body_parsing_loaded = False


def _get_body_parsing_model():
    """Load SCHP model once and cache it for the process lifetime."""
    global _body_parsing_model, _body_parsing_loaded
    if _body_parsing_loaded:
        return _body_parsing_model
    _body_parsing_loaded = True
    if not config.USE_BODY_PARSING:
        return None
    from .body_parsing import load_body_parsing_model
    _body_parsing_model = load_body_parsing_model(
        config.BODY_PARSING_MODEL_PATH,
        config.BODY_PARSING_N_CLASSES,
    )
    return _body_parsing_model

VISTA_THETA: dict[str, float] = {
    'frontal': 0.0,
    'lateral_direita': math.pi / 2,
    'posterior': math.pi,
    'lateral_esquerda': -math.pi / 2,
}

_KEY_LANDMARKS = [11, 12, 23, 24, 27, 28]


def apply_clahe(img: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_eq = clahe.apply(l)
    enhanced = cv2.merge([l_eq, a, b])
    return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)


def refine_mask(mask: np.ndarray) -> np.ndarray:
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    closed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel, iterations=1)
    return opened


def landmarks_are_visible(lm: list, min_visibility: float = config.MIN_VISIBILITY) -> bool:
    for idx in _KEY_LANDMARKS:
        if idx >= len(lm):
            return False
        vis = getattr(lm[idx], 'visibility', 1.0)
        if vis < min_visibility:
            return False
    return True


def _make_static_detector() -> mp_vision.PoseLandmarker:
    base_options = mp_python.BaseOptions(model_asset_path=config.MODEL_PATH)
    options = mp_vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=mp_vision.RunningMode.IMAGE,
        output_segmentation_masks=True,
        num_poses=1,
    )
    return mp_vision.PoseLandmarker.create_from_options(options)


def analyze_photo(
    image_path: str,
    estatura_cm: float,
    vista: str,
    sexo: str = 'masculino',
    marker_size_cm: float | None = None,
    aruco_dict_name: str = 'DICT_4X4_50',
) -> dict | None:
    """
    Analyze one static photo with MediaPipe PoseLandmarker + segmentation.

    Scale calibration priority:
      1. ArUco marker detected in the image.
      2. Fallback: estatura_cm / body height in pixels.
    """
    img = cv2.imread(image_path)
    if img is None:
        return None

    img = apply_clahe(img)
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    h, w = img.shape[:2]

    # ArUco scale
    aruco_result: dict = {'metodo': 'nao_detectado'}
    if marker_size_cm and marker_size_cm > 0:
        aruco_result = detect_aruco_scale(img, marker_size_cm, aruco_dict_name)

    # MediaPipe pose + segmentation
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

    with _make_static_detector() as detector:
        result = detector.detect(mp_image)

    if not result.pose_landmarks or not result.segmentation_masks:
        return None

    lm = result.pose_landmarks[0]

    if not landmarks_are_visible(lm):
        return None

    raw_mask = (result.segmentation_masks[0].numpy_view() > config.MASK_THRESHOLD).astype(np.uint8)
    mask = refine_mask(raw_mask)

    # Height in pixels
    height_px = get_height_px(mask)
    if height_px < 50:
        height_px = get_height_from_landmarks(lm, h)
    if height_px < 50:
        return None

    # Scale selection
    if aruco_result.get('metodo') == 'aruco' and aruco_result.get('px_por_cm', 0) > 0:
        scale = 1.0 / aruco_result['px_por_cm']
        calibracao: dict = aruco_result
    else:
        scale = estatura_cm / height_px
        calibracao = {
            'metodo': 'altura_fallback',
            'px_por_cm': round(height_px / estatura_cm, 4) if estatura_cm > 0 else None,
            'confianca': 'baixa',
        }

    # Get measurement levels using mask-based anatomical search
    levels = get_body_levels(lm, mask, h, w, sexo)

    # Body parsing: separate left/right legs (frontal view only)
    # This corrects the bilateral silhouette issue for thigh/calf.
    parsing_masks: dict | None = None
    parsing_conf  = 0.0
    if vista == 'frontal':
        bp_model = _get_body_parsing_model()
        if bp_model is not None:
            try:
                parsing_masks = apply_body_parsing(img, bp_model)
                parsing_conf  = parsing_confidence(parsing_masks)
            except Exception as exc:
                import logging
                logging.getLogger(__name__).warning('Body parsing failed: %s', exc)
                parsing_masks = None

    measurements: dict[str, float] = {}
    leg_source = 'mediapipe'

    for name in ('neck', 'chest', 'waist', 'hip', 'thigh', 'calf'):
        row_y = levels.get(name)
        if row_y is None:
            continue

        if name in ('thigh', 'calf') and vista == 'frontal':
            if parsing_masks and parsing_conf >= config.BODY_PARSING_CONF_THRESH:
                # Average width of a single leg from semantic masks.
                # leg_confident=False → SCHP fragmented a single leg into >2 segments
                # (noise), so we fall through to the MediaPipe correction fallback.
                l_w, r_w, leg_confident = get_leg_widths_at_row(parsing_masks, row_y)
                leg_widths = [w for w in (l_w, r_w) if w > 0]
                if leg_widths and leg_confident:
                    avg_leg_px = sum(leg_widths) / len(leg_widths)
                    measurements[name] = (avg_leg_px * scale) / 2.0
                    leg_source = 'body_parsing'
                    continue
            # Fallback: apply empirical correction for bilateral silhouette
            # (combined bilateral width ≈ 1/LEG_CORRECTION_FACTOR × single leg)
            combined_px = get_mask_width_at_row(mask, row_y)
            if combined_px > 0:
                measurements[name] = (combined_px * scale * config.LEG_CORRECTION_FACTOR) / 2.0
        else:
            width_px = get_mask_width_at_row(mask, row_y)
            if width_px > 0:
                measurements[name] = (width_px * scale) / 2.0

    if not measurements:
        return None

    point: dict = {
        'vista':      vista,
        'theta':      VISTA_THETA.get(vista, 0.0),
        'measurements': measurements,
        'weight':     config.PHOTO_WEIGHT,
        'calibracao': calibracao,
        'leg_source': leg_source,
    }
    if parsing_conf > 0:
        point['parsing_confidence'] = round(parsing_conf, 2)

    # Preserved for SMPL-X multiview fit (pipeline removes these after use)
    if config.USE_SMPLX:
        point['_landmarks'] = lm
        point['_img_h']     = h
        point['_img_w']     = w
        point['_mask']      = mask   # for silhouette loss in fit_multiview
    return point


def analyze_photos(
    captures: list[dict],
    estatura_cm: float,
    sexo: str = 'masculino',
    marker_size_cm: float | None = None,
    aruco_dict_name: str = 'DICT_4X4_50',
) -> list[dict]:
    data_points: list[dict] = []
    for capture in captures:
        vista = capture.get('vista', '')
        if vista == 'video_360':
            continue
        source = capture.get('source', {})
        image_path = source.get('path')
        if not image_path:
            continue
        point = analyze_photo(image_path, estatura_cm, vista, sexo, marker_size_cm, aruco_dict_name)
        if point:
            data_points.append(point)
    return data_points