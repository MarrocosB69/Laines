"""
body_parsing.py — SCHP (Self-Correction for Human Parsing) integration.

Generates per-body-part semantic masks for the frontal view, enabling
independent left/right leg measurement.  This fixes the bilateral silhouette
ambiguity that currently prevents the frustum densitometric formula from
producing valid densities.

Model formats supported (tried in order):
  1. ONNX  (.onnx) — preferred; no PyTorch required at inference time.
  2. TorchScript (.pt / .pth) — fallback when ONNX is unavailable.

Input  : 512×512 RGB image, ImageNet mean/std normalisation.
Output : (1, n_classes, H, W) logits  →  argmax  →  label map.

ATR dataset labels (18 classes — default for MobileNet SCHP checkpoints):
  0 background   1 hat       2 hair      3 sunglasses  4 tronco
  5 saia         6 calca     7 vestido   8 cinto
  9 sapato_esq  10 sapato_dir 11 rosto
 12 perna_esquerda  13 perna_direita
 14 braco_esquerdo  15 braco_direito
 16 bolsa        17 cachecol

LIP dataset labels (20 classes — for ResNet-101 SCHP checkpoints):
  0 background  1 hat  2 hair  3 luva  4 oculos  5 tronco
  6 vestido  7 casaco  8 meia  9 calca  10 macacao  11 cachecol
 12 saia  13 rosto  14 braco_esquerdo  15 braco_direito
 16 perna_esquerda  17 perna_direita  18 sapato_esq  19 sapato_dir
"""
from __future__ import annotations

import logging

import cv2
import numpy as np

log = logging.getLogger(__name__)

SCHP_INPUT_SIZE = 512
_MEAN_BGR = np.array([0.406, 0.456, 0.485], dtype=np.float32)
_STD_BGR  = np.array([0.225, 0.224, 0.229], dtype=np.float32)

SCHP_LABELS_ATR: dict[int, str] = {
    0: 'background',       1: 'chapeu',        2: 'cabelo',
    3: 'oculos',           4: 'tronco',        5: 'saia',
    6: 'calca',            7: 'vestido',       8: 'cinto',
    9: 'sapato_esq',      10: 'sapato_dir',   11: 'rosto',
    12: 'perna_esquerda', 13: 'perna_direita',
    14: 'braco_esquerdo', 15: 'braco_direito',
    16: 'bolsa',          17: 'cachecol',
}

SCHP_LABELS_LIP: dict[int, str] = {
    0: 'background', 1: 'chapeu',         2: 'cabelo',     3: 'luva',
    4: 'oculos',     5: 'tronco',         6: 'vestido',    7: 'casaco',
    8: 'meia',       9: 'calca',         10: 'macacao',   11: 'cachecol',
    12: 'saia',     13: 'rosto',
    14: 'braco_esquerdo',  15: 'braco_direito',
    16: 'perna_esquerda',  17: 'perna_direita',
    18: 'sapato_esq',      19: 'sapato_dir',
}

# ─────────────────────────────────────────────────────────────────────────────
# Pre/post processing
# ─────────────────────────────────────────────────────────────────────────────

def _preprocess(img_bgr: np.ndarray) -> np.ndarray:
    """Return float32 NCHW array (1, 3, 512, 512) normalised to ImageNet stats."""
    resized = cv2.resize(img_bgr, (SCHP_INPUT_SIZE, SCHP_INPUT_SIZE),
                         interpolation=cv2.INTER_LINEAR)
    x = resized.astype(np.float32) / 255.0
    x = (x - _MEAN_BGR) / _STD_BGR
    return x.transpose(2, 0, 1)[np.newaxis, ...].astype(np.float32)  # NCHW


def _postprocess(logits: np.ndarray, orig_h: int, orig_w: int) -> np.ndarray:
    """Convert (1, C, H, W) logits to uint8 label map at original resolution."""
    label_small = np.argmax(logits[0], axis=0).astype(np.uint8)
    return cv2.resize(label_small, (orig_w, orig_h), interpolation=cv2.INTER_NEAREST)


# ─────────────────────────────────────────────────────────────────────────────
# Model loading
# ─────────────────────────────────────────────────────────────────────────────

class _OnnxModel:
    backend = 'onnx'

    def __init__(self, session, n_classes: int):
        self._sess      = session
        self.n_classes  = n_classes
        self.input_name = session.get_inputs()[0].name

    def __call__(self, x: np.ndarray) -> np.ndarray:
        return self._sess.run(None, {self.input_name: x})[0]


class _TorchModel:
    backend = 'torchscript'

    def __init__(self, module, n_classes: int):
        self._model    = module
        self.n_classes = n_classes

    def __call__(self, x: np.ndarray) -> np.ndarray:
        import torch
        with torch.no_grad():
            t   = torch.from_numpy(x)
            out = self._model(t)
            if isinstance(out, (tuple, list)):
                out = out[0]   # some variants return (logits, aux_logits)
            return out.cpu().numpy()


def load_body_parsing_model(model_path: str, n_classes: int = 18):
    """
    Load SCHP model.  Returns a callable model object or None on failure.

    Tries ONNX first; if the path ends with .pt/.pth, tries TorchScript.
    The returned object is callable: model(x_nchw) -> logits_nchw.
    """
    import os
    if not os.path.isfile(model_path):
        log.warning('Body parsing: model not found at %s', model_path)
        return None

    ext = os.path.splitext(model_path)[1].lower()

    if ext == '.onnx':
        try:
            import onnxruntime as ort
            sess = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
            log.info('Body parsing: loaded ONNX from %s', model_path)
            return _OnnxModel(sess, n_classes)
        except ImportError:
            log.warning('Body parsing: onnxruntime not installed')
        except Exception as exc:
            log.warning('Body parsing: ONNX load failed (%s)', exc)

    if ext in ('.pt', '.pth'):
        try:
            import torch
            module = torch.jit.load(model_path, map_location='cpu')
            module.eval()
            log.info('Body parsing: loaded TorchScript from %s', model_path)
            return _TorchModel(module, n_classes)
        except Exception as exc:
            log.warning('Body parsing: TorchScript load failed: %s', exc)

    log.warning('Body parsing: could not load model from %s', model_path)
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Inference
# ─────────────────────────────────────────────────────────────────────────────

def apply_body_parsing(
    image_bgr: np.ndarray,
    model,
    label_map: dict[int, str] | None = None,
) -> dict[str, np.ndarray]:
    """
    Run SCHP body parsing on a BGR image.

    Returns a dict mapping label name → binary uint8 mask at original resolution.
    Raises RuntimeError on empty output (caller should catch and fall back).
    """
    if label_map is None:
        n = getattr(model, 'n_classes', 18)
        label_map = SCHP_LABELS_LIP if n == 20 else SCHP_LABELS_ATR

    h, w = image_bgr.shape[:2]
    x       = _preprocess(image_bgr)
    logits  = model(x)
    lm_arr  = _postprocess(logits, h, w)

    masks: dict[str, np.ndarray] = {}
    for idx, name in label_map.items():
        m = (lm_arr == idx).astype(np.uint8)
        if m.any():
            masks[name] = m

    if not masks:
        raise RuntimeError('Body parsing produced empty output')
    return masks


# ─────────────────────────────────────────────────────────────────────────────
# Width measurement from part masks
# ─────────────────────────────────────────────────────────────────────────────

def get_limb_width_at_row(
    mask_dict: dict[str, np.ndarray],
    y: int,
    label: str,
    max_segments: int = 2,
) -> tuple[float, bool]:
    """
    Total width occupied by `label` at row y (sum of all contiguous segments).

    Returns (width_px, is_confident).
      width_px     : sum of all segment widths.  Correct when the part
                     is split by a real gap (e.g., legs slightly apart).
      is_confident : False when n_segments > max_segments, which likely
                     indicates SCHP noise fragmented a single structure
                     into spurious pieces.  The caller should fall back to
                     the MediaPipe mask in that case.

    Returns (0.0, False) if the label is absent or has no pixels at y.
    """
    mask = mask_dict.get(label)
    if mask is None:
        return 0.0, False

    y   = int(max(0, min(y, mask.shape[0] - 1)))
    row = mask[y, :]
    idx = np.where(row > 0)[0]
    if len(idx) == 0:
        return 0.0, False
    if len(idx) == 1:
        return 1.0, True

    breaks = np.where(np.diff(idx) > 1)[0]
    starts = np.r_[0, breaks + 1]
    ends   = np.r_[breaks, len(idx) - 1]
    n_segs = len(starts)

    total_width = float(sum(int(idx[e]) - int(idx[s]) for s, e in zip(starts, ends)))
    is_confident = n_segs <= max_segments

    if not is_confident:
        log.debug(
            'get_limb_width_at_row: %s at y=%d has %d segments (expected ≤%d) — '
            'possible SCHP noise; width=%.1f px',
            label, y, n_segs, max_segments, total_width,
        )

    return total_width, is_confident


def get_leg_widths_at_row(
    mask_dict: dict[str, np.ndarray],
    y: int,
) -> tuple[float, float, bool]:
    """
    Returns (width_left_px, width_right_px, is_confident).
    is_confident is False when either leg has more than 2 segments at row y
    (likely SCHP fragmentation noise).
    """
    l_w, l_ok = get_limb_width_at_row(mask_dict, y, 'perna_esquerda')
    r_w, r_ok = get_limb_width_at_row(mask_dict, y, 'perna_direita')
    return l_w, r_w, l_ok and r_ok


def parsing_confidence(
    mask_dict: dict[str, np.ndarray],
    required: tuple[str, ...] = ('perna_esquerda', 'perna_direita'),
    min_frac: float = 0.02,
) -> float:
    """
    Returns fraction of `required` labels present with sufficient pixel count.

    Threshold is **relative**: label must cover at least `min_frac` of the total
    non-background body area (default 2%).  This adapts to image resolution and
    zoom level, unlike a fixed pixel count that fails on low-resolution inputs.

    Falls back to a 50 px floor so tiny thumbnails still produce results.
    1.0 = all required labels detected; 0.0 = none.
    """
    if not mask_dict:
        return 0.0

    total_body_px = sum(
        int(m.sum()) for lbl, m in mask_dict.items() if lbl != 'background'
    )
    min_px = max(50, int(min_frac * total_body_px))

    found = sum(
        1 for lbl in required
        if mask_dict.get(lbl) is not None and int(mask_dict[lbl].sum()) > min_px
    )
    return found / len(required)
