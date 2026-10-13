"""
ArUco marker-based pixel-per-cm scale calibration.

A printed ArUco marker of known physical size is photographed together with
the subject.  Because the marker is on a fixed stand (independent of the
person) and must face the camera for each of the 4 photo poses, the detected
side lengths give a direct pixel-per-cm ratio for that specific frame.

API compatibility
-----------------
ArUco contrib was in cv2.aruco since OpenCV 3.x, but the detector class was
refactored in 4.7:
  < 4.7  : cv2.aruco.detectMarkers(img, dictionary, parameters=params)
  >= 4.7 : cv2.aruco.ArucoDetector(dictionary, params).detectMarkers(img)

Both paths are supported.  If opencv-contrib-python is absent (or the aruco
module is missing), every call returns {'metodo': 'nao_detectado'} without
raising.

Confidence metric
-----------------
A flat marker photographed face-on (parallel to the image sensor plane)
produces four equal side lengths.  Perspective tilt raises the coefficient of
variation (cv_ratio = std / mean) of those sides.  The threshold 0.15 is
empirically safe for tilt angles up to ~25° while rejecting severely skewed
detections.

Depth-offset error
------------------
If the marker is at depth Δd relative to the body cross-section being
measured and the camera is at distance D, the scale error is ≈ Δd / D.
At D = 2 m, keeping Δd ≤ 10 cm gives error ≤ 5 %, consistent with the
validation acceptance criterion.
"""

from __future__ import annotations

import numpy as np
import config

try:
    import cv2

    _cv_major, _cv_minor = (int(x) for x in cv2.__version__.split('.')[:2])
    _NEW_API = (_cv_major, _cv_minor) >= (4, 7)

    _DICT_MAP: dict[str, int] = {
        'DICT_4X4_50':         cv2.aruco.DICT_4X4_50,
        'DICT_4X4_100':        cv2.aruco.DICT_4X4_100,
        'DICT_5X5_50':         cv2.aruco.DICT_5X5_50,
        'DICT_6X6_50':         cv2.aruco.DICT_6X6_50,
        'DICT_APRILTAG_36h11': cv2.aruco.DICT_APRILTAG_36h11,
    }

    def _make_detector(dict_name: str):
        dict_const = _DICT_MAP.get(dict_name, cv2.aruco.DICT_4X4_50)
        dictionary = cv2.aruco.getPredefinedDictionary(dict_const)
        if _NEW_API:
            params = cv2.aruco.DetectorParameters()
            return cv2.aruco.ArucoDetector(dictionary, params)
        return (dictionary, cv2.aruco.DetectorParameters_create())

    def _run_detector(detector, img: np.ndarray):
        if _NEW_API:
            return detector.detectMarkers(img)
        dictionary, params = detector
        return cv2.aruco.detectMarkers(img, dictionary, parameters=params)

    _ARUCO_AVAILABLE = True

except (ImportError, AttributeError):
    _ARUCO_AVAILABLE = False


def _side_lengths(corners_1n42: np.ndarray) -> np.ndarray:
    """Return the 4 side lengths (px) of a detected marker quadrilateral.

    corners_1n42 has shape (1, 4, 2): the convention used by cv2.aruco.
    Point order: top-left, top-right, bottom-right, bottom-left.
    """
    pts = corners_1n42.reshape(4, 2)
    return np.array([
        np.linalg.norm(pts[1] - pts[0]),  # top-left     → top-right
        np.linalg.norm(pts[2] - pts[1]),  # top-right    → bottom-right
        np.linalg.norm(pts[3] - pts[2]),  # bottom-right → bottom-left
        np.linalg.norm(pts[0] - pts[3]),  # bottom-left  → top-left
    ])


def detect_aruco_scale(
    img: np.ndarray,
    marker_size_cm: float,
    dict_name: str = 'DICT_4X4_50',
) -> dict:
    """Detect an ArUco marker in *img* and return the pixel-per-cm scale.

    Parameters
    ----------
    img:
        BGR image (numpy array) — pass the CLAHE-enhanced version for best
        detection in uneven lighting.
    marker_size_cm:
        Physical side length of the printed marker in centimetres.
    dict_name:
        ArUco dictionary name string (see _DICT_MAP for valid values).

    Returns
    -------
    On success:
        {
          metodo:     'aruco',
          px_por_cm:  float,   # pixels per centimetre
          confianca:  'alta' | 'baixa',
          cv_ratio:   float,   # std/mean of the 4 side lengths
          lados_px:   [float, float, float, float],
        }
    On failure / not detected:
        { metodo: 'nao_detectado' }
    """
    if not _ARUCO_AVAILABLE or marker_size_cm <= 0:
        return {'metodo': 'nao_detectado'}

    try:
        detector = _make_detector(dict_name)
        corners, ids, _ = _run_detector(detector, img)
    except Exception:
        return {'metodo': 'nao_detectado'}

    if ids is None or len(ids) == 0:
        return {'metodo': 'nao_detectado'}

    # When multiple markers are present, pick the one most parallel to the
    # camera (lowest cv_ratio = most equal side lengths).
    best: dict | None = None
    for corner_set in corners:
        sides = _side_lengths(corner_set)
        mean_side = float(np.mean(sides))
        if mean_side < config.ARUCO_MIN_SIDE_PX:
            continue  # too small to be trustworthy
        cv_ratio = float(np.std(sides) / mean_side)
        if best is None or cv_ratio < best['cv_ratio']:
            best = {'cv_ratio': cv_ratio, 'sides': sides, 'mean_side': mean_side}

    if best is None:
        return {'metodo': 'nao_detectado'}

    px_por_cm = best['mean_side'] / marker_size_cm
    confianca = 'alta' if best['cv_ratio'] <= config.ARUCO_CV_THRESHOLD else 'baixa'

    return {
        'metodo':    'aruco',
        'px_por_cm': round(px_por_cm, 4),
        'confianca': confianca,
        'cv_ratio':  round(best['cv_ratio'], 4),
        'lados_px':  [round(float(s), 2) for s in best['sides']],
    }
