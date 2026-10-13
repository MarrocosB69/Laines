import numpy as np
import config


def _gaussian_smooth(arr: np.ndarray, sigma: float = 3.0) -> np.ndarray:
    """1-D Gaussian smoothing via convolution (reflect padding)."""
    if arr.size == 0:
        return arr
    radius = int(3 * sigma)
    x = np.arange(-radius, radius + 1)
    kernel = np.exp(-0.5 * (x / sigma) ** 2)
    kernel /= kernel.sum()
    effective_radius = min(radius, max(0, arr.size - 1))
    if effective_radius == 0:
        return arr.astype(float, copy=True)
    trimmed_kernel = kernel[radius - effective_radius:radius + effective_radius + 1]
    trimmed_kernel /= trimmed_kernel.sum()
    padded = np.pad(arr, effective_radius, mode='reflect')
    return np.convolve(padded, trimmed_kernel, mode='valid')


def get_height_px(mask: np.ndarray) -> float:
    """Height of the person in the segmentation mask (topmost to bottommost pixel)."""
    rows = np.where(mask.sum(axis=1) > 0)[0]
    if len(rows) < 2:
        return 0.0
    return float(rows[-1] - rows[0])


def get_height_from_landmarks(landmarks, img_h: int) -> float:
    """
    Estimate body height in pixels using nose (0) and heel landmarks (29, 30).
    More robust than mask extremes when feet aren't fully in frame.
    Returns 0.0 if landmarks are unreliable.
    """
    if hasattr(landmarks, 'landmark'):
        lm = landmarks.landmark
    else:
        lm = landmarks

    nose_y = lm[0].y * img_h
    shoulder_y = ((lm[11].y + lm[12].y) / 2.0) * img_h
    heel_y = max(lm[29].y, lm[30].y) * img_h
    head_top_y = nose_y - max(0.0, shoulder_y - nose_y) * config.HEAD_TOP_RATIO
    height = heel_y - head_top_y
    return float(height) if height > 20 else 0.0


def get_mask_width_at_row(mask: np.ndarray, y: int) -> float:
    """Width of the central contiguous body segment at row y."""
    y = int(max(0, min(y, mask.shape[0] - 1)))
    row = mask[y, :]
    indices = np.where(row > 0)[0]
    if len(indices) < 2:
        return 0.0
    breaks = np.where(np.diff(indices) > 1)[0]
    starts = np.r_[0, breaks + 1]
    ends = np.r_[breaks, len(indices) - 1]
    segments = [(int(indices[start]), int(indices[end])) for start, end in zip(starts, ends)]
    mask_columns = np.where(mask.sum(axis=0) > 0)[0]
    centre = float(np.median(mask_columns)) if len(mask_columns) else (mask.shape[1] - 1) / 2.0
    left, right = min(
        segments,
        key=lambda segment: (abs(((segment[0] + segment[1]) / 2.0) - centre), -(segment[1] - segment[0])),
    )
    return float(right - left) if right > left else 0.0


def find_waist_y(
    mask: np.ndarray,
    shoulder_y: int,
    hip_y: int,
    start_frac: float = None,
    end_frac: float = None,
    sigma: float = None,
) -> int:
    """
    Find the narrowest horizontal slice of the mask in the torso region.
    If start_frac/end_frac are not provided, use config.WAIST_SEARCH_START/END.
    """
    if start_frac is None:
        start_frac = config.WAIST_SEARCH_START
    if end_frac is None:
        end_frac = config.WAIST_SEARCH_END
    if sigma is None:
        sigma = config.WAIST_SMOOTH_SIGMA

    start = int(shoulder_y + (hip_y - shoulder_y) * start_frac)
    end = int(shoulder_y + (hip_y - shoulder_y) * end_frac)
    start = max(0, min(start, mask.shape[0] - 2))
    end = max(start + 1, min(end, mask.shape[0] - 1))

    widths = np.array([
        get_mask_width_at_row(mask, y) for y in range(start, end)
    ], dtype=float)

    nonzero_mean = widths[widths > 0].mean() if (widths > 0).any() else 1.0
    widths_clean = np.where(widths > 0, widths, nonzero_mean)

    smoothed = _gaussian_smooth(widths_clean, sigma=sigma)
    waist_offset = int(np.argmin(smoothed))
    return start + waist_offset


def find_neck_y(
    mask: np.ndarray,
    nose_y: float,
    shoulder_y: float,
    sigma: float = None,
) -> int:
    """
    Find the narrowest horizontal slice in the neck region (between nose and shoulders).
    Falls back to NECK_OFFSET_RATIO when the region has fewer than NECK_MIN_VALID_PIXELS
    mean width (e.g., lateral view where the neck barely appears in the mask).
    """
    if sigma is None:
        sigma = config.NECK_SMOOTH_SIGMA

    start = int(nose_y + (shoulder_y - nose_y) * config.NECK_SCAN_TOP_RATIO)
    end = int(nose_y + (shoulder_y - nose_y) * config.NECK_SCAN_BOTTOM_RATIO)
    start = max(0, min(start, mask.shape[0] - 2))
    end = max(start + 1, min(end, mask.shape[0] - 1))

    widths = np.array([
        get_mask_width_at_row(mask, y) for y in range(start, end)
    ], dtype=float)

    mean_valid = widths[widths > 0].mean() if (widths > 0).any() else 0.0
    if mean_valid < config.NECK_MIN_VALID_PIXELS:
        return int(nose_y + (shoulder_y - nose_y) * config.NECK_OFFSET_RATIO)

    widths_clean = np.where(widths > 0, widths, mean_valid)
    smoothed = _gaussian_smooth(widths_clean, sigma=sigma)
    return start + int(np.argmin(smoothed))


def find_chest_y(
    mask: np.ndarray,
    shoulder_y: float,
    hip_y: float,
    sigma: float = None,
) -> int:
    """
    Find the widest horizontal slice at chest/pectoral level (ISAK mesosternal).
    Searches CHEST_SCAN_TOP_RATIO to CHEST_SCAN_BOTTOM_RATIO of shoulder→hip distance.
    Uses argmax — the chest is the widest point in the upper torso below the axilla.
    Falls back to 15% of shoulder→hip when no foreground pixels are found.
    """
    if sigma is None:
        sigma = config.CHEST_SMOOTH_SIGMA

    start = int(shoulder_y + (hip_y - shoulder_y) * config.CHEST_SCAN_TOP_RATIO)
    end   = int(shoulder_y + (hip_y - shoulder_y) * config.CHEST_SCAN_BOTTOM_RATIO)
    start = max(0, min(start, mask.shape[0] - 2))
    end   = max(start + 1, min(end, mask.shape[0] - 1))

    widths = np.array([
        get_mask_width_at_row(mask, y) for y in range(start, end)
    ], dtype=float)

    if widths.max() < 1.0:
        return int(shoulder_y + (hip_y - shoulder_y) * 0.15)

    nonzero_mean = widths[widths > 0].mean() if (widths > 0).any() else 1.0
    widths_clean = np.where(widths > 0, widths, nonzero_mean)
    smoothed = _gaussian_smooth(widths_clean, sigma=sigma)
    return start + int(np.argmax(smoothed))


def find_thigh_y(
    mask: np.ndarray,
    hip_landmark_y: float,
    knee_y: float,
    sigma: float = None,
) -> int:
    """
    Find the widest horizontal slice at mid-thigh (ISAK protocol).
    Searches THIGH_SCAN_TOP_RATIO to THIGH_SCAN_BOTTOM_RATIO of hip→knee distance,
    equivalent to the mid-thigh region. Uses argmax — thigh is widest proximally.
    Falls back to 45% of hip→knee when no foreground pixels are found.
    """
    if sigma is None:
        sigma = config.THIGH_SMOOTH_SIGMA

    start = int(hip_landmark_y + (knee_y - hip_landmark_y) * config.THIGH_SCAN_TOP_RATIO)
    end   = int(hip_landmark_y + (knee_y - hip_landmark_y) * config.THIGH_SCAN_BOTTOM_RATIO)
    start = max(0, min(start, mask.shape[0] - 2))
    end   = max(start + 1, min(end, mask.shape[0] - 1))

    widths = np.array([
        get_mask_width_at_row(mask, y) for y in range(start, end)
    ], dtype=float)

    if widths.max() < 1.0:
        return int(hip_landmark_y + (knee_y - hip_landmark_y) * 0.45)

    nonzero_mean = widths[widths > 0].mean() if (widths > 0).any() else 1.0
    widths_clean = np.where(widths > 0, widths, nonzero_mean)
    smoothed = _gaussian_smooth(widths_clean, sigma=sigma)
    return start + int(np.argmax(smoothed))


def find_calf_y(
    mask: np.ndarray,
    knee_y: float,
    ankle_y: float,
    sigma: float = None,
) -> int:
    """
    Find the widest horizontal slice at maximum calf girth (gastrocnemius belly).
    Searches CALF_SCAN_TOP_RATIO to CALF_SCAN_BOTTOM_RATIO of knee→ankle distance.
    Uses argmax — calf is widest at gastrocnemius peak (~25-40% below knee).
    Falls back to 35% of knee→ankle when no foreground pixels are found.
    """
    if sigma is None:
        sigma = config.CALF_SMOOTH_SIGMA

    start = int(knee_y + (ankle_y - knee_y) * config.CALF_SCAN_TOP_RATIO)
    end   = int(knee_y + (ankle_y - knee_y) * config.CALF_SCAN_BOTTOM_RATIO)
    start = max(0, min(start, mask.shape[0] - 2))
    end   = max(start + 1, min(end, mask.shape[0] - 1))

    widths = np.array([
        get_mask_width_at_row(mask, y) for y in range(start, end)
    ], dtype=float)

    if widths.max() < 1.0:
        return int(knee_y + (ankle_y - knee_y) * 0.35)

    nonzero_mean = widths[widths > 0].mean() if (widths > 0).any() else 1.0
    widths_clean = np.where(widths > 0, widths, nonzero_mean)
    smoothed = _gaussian_smooth(widths_clean, sigma=sigma)
    return start + int(np.argmax(smoothed))


def find_hip_y(
    mask: np.ndarray,
    hip_joint_y: float,
    knee_y: float,
    sigma: float = None,
) -> int:
    """
    Find the widest horizontal slice in the gluteal region (between hip joint and knee).
    HIP_SCAN_TOP_RATIO (1.0) anchors the start at the hip joint landmark.
    HIP_SCAN_BOTTOM_RATIO (0.6) limits the scan to 60% of the hip-to-knee distance.
    Falls back to hip_joint_y when no foreground pixels are found in the region.
    """
    if sigma is None:
        sigma = config.HIP_SMOOTH_SIGMA

    start = int(hip_joint_y * config.HIP_SCAN_TOP_RATIO)
    end = int(hip_joint_y + (knee_y - hip_joint_y) * config.HIP_SCAN_BOTTOM_RATIO)
    start = max(0, min(start, mask.shape[0] - 2))
    end = max(start + 1, min(end, mask.shape[0] - 1))

    widths = np.array([
        get_mask_width_at_row(mask, y) for y in range(start, end)
    ], dtype=float)

    if widths.max() < 1.0:
        return int(hip_joint_y)

    nonzero_mean = widths[widths > 0].mean() if (widths > 0).any() else 1.0
    widths_clean = np.where(widths > 0, widths, nonzero_mean)
    smoothed = _gaussian_smooth(widths_clean, sigma=sigma)
    return start + int(np.argmax(smoothed))


def get_body_levels(
    landmarks,
    mask: np.ndarray,
    img_h: int,
    img_w: int,
    sexo: str = 'masculino',
) -> dict[str, int]:
    """
    Returns pixel Y-coordinates for anthropometric measurement levels.

    Levels returned: neck, chest, waist, hip, thigh, calf.

    `landmarks` is either:
      - a list/sequence of landmark objects with .x, .y (Tasks API — pose_landmarks[0])
      - an object with a .landmark list (legacy API)
    """
    if hasattr(landmarks, 'landmark'):
        lm = landmarks.landmark
    else:
        lm = landmarks

    nose_y         = lm[0].y  * img_h
    shoulder_y     = ((lm[11].y + lm[12].y) / 2) * img_h
    hip_landmark_y = ((lm[23].y + lm[24].y) / 2) * img_h
    knee_y         = ((lm[25].y + lm[26].y) / 2) * img_h
    ankle_y        = ((lm[27].y + lm[28].y) / 2) * img_h

    # Neck: narrowest point between nose and shoulders
    neck_y = find_neck_y(mask, nose_y, shoulder_y)

    # Chest: widest point in upper torso (pectoral / mesosternal level)
    chest_y = find_chest_y(mask, shoulder_y, hip_landmark_y)

    # Waist: female → narrowest anatomical waist; male → navel level (US Navy)
    if sexo.lower() == 'feminino':
        waist_y = find_waist_y(
            mask,
            int(shoulder_y),
            int(hip_landmark_y),
            start_frac=config.WAIST_SEARCH_START_FEMALE,
            end_frac=config.WAIST_SEARCH_END_FEMALE,
        )
    else:
        waist_y = int(shoulder_y + (hip_landmark_y - shoulder_y) * config.WAIST_NAVEL_RATIO)

    # Hip: widest point in gluteal region (between hip joint and knee)
    hip_y = find_hip_y(mask, hip_landmark_y, knee_y)

    # Thigh: widest point at mid-thigh (ISAK protocol)
    thigh_y = find_thigh_y(mask, hip_landmark_y, knee_y)

    # Calf: maximum gastrocnemius girth (between knee and ankle)
    calf_y = find_calf_y(mask, knee_y, ankle_y)

    return {
        'neck':  neck_y,
        'chest': chest_y,
        'waist': waist_y,
        'hip':   hip_y,
        'thigh': thigh_y,
        'calf':  calf_y,
    }