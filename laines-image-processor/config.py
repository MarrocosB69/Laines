import os
import tempfile
from pathlib import Path

# Port this service listens on
PORT = int(os.getenv('PORT', '8001'))
LOG_LEVEL = os.getenv('LOG_LEVEL', 'info')
PROCESSOR_TOKEN = os.getenv('IMAGE_PROCESSOR_TOKEN', '').strip()
MAX_CONCURRENT_JOBS = max(1, int(os.getenv('PROCESSOR_MAX_CONCURRENT_JOBS', '2')))
MAX_PENDING_JOBS = max(MAX_CONCURRENT_JOBS, int(os.getenv('PROCESSOR_MAX_PENDING_JOBS', '8')))
MAX_SOURCE_BYTES = max(1, int(os.getenv('PROCESSOR_MAX_SOURCE_BYTES', str(100 * 1024 * 1024))))
ALLOWED_SOURCE_HOSTS = {
    host.strip().lower()
    for host in os.getenv('PROCESSOR_ALLOWED_SOURCE_HOSTS', '').split(',')
    if host.strip()
}
JOB_STATE_PATH = os.getenv(
    'PROCESSOR_JOB_STATE_PATH',
    str(Path(tempfile.gettempdir()) / 'laines-image-processor-jobs.json'),
)

# NestJS writes uploads to this path (inside its container / local machine)
NESTJS_UPLOAD_BASE = os.getenv(
    'NESTJS_UPLOAD_BASE',
    '/app/uploads/avaliacoes-imagem',
)

# This processor accesses the same files via this path (Docker volume mount)
PROCESSOR_UPLOAD_BASE = os.getenv(
    'PROCESSOR_UPLOAD_BASE',
    '/uploads/avaliacoes-imagem',
)

# ArUco marker calibration
ARUCO_MARKER_SIZE_CM = float(os.getenv('ARUCO_MARKER_SIZE_CM', '14.8'))
ARUCO_DICT_NAME = os.getenv('ARUCO_DICT_NAME', 'DICT_4X4_50')

# MediaPipe pose landmarker model (.task bundle)
_here = Path(__file__).parent
MODEL_PATH = str(
    Path(os.getenv('POSE_MODEL_PATH', str(_here / 'models' / 'pose_landmarker_full.task')))
)

# === Versões (constantes de código — sem env var) ===
VERSAO_INSTRUMENTO = 'laines-v1.0'
VERSAO_ALGORITMO   = '2.1.1'
VERSAO_PROTOCOLO   = 'quatro_vistas_rgb_v1'

# === Parâmetros de análise ===
PHOTO_WEIGHT       = float(os.getenv('PROCESSOR_PHOTO_WEIGHT',       '2.0'))
VIDEO_FRAME_WEIGHT = float(os.getenv('PROCESSOR_VIDEO_FRAME_WEIGHT', '1.0'))
MIN_VISIBILITY     = float(os.getenv('PROCESSOR_MIN_VISIBILITY',     '0.6'))
MASK_THRESHOLD     = float(os.getenv('PROCESSOR_MASK_THRESHOLD',     '0.5'))
MIN_ANGLE_STEP_DEG = float(os.getenv('PROCESSOR_MIN_ANGLE_STEP_DEG', '3.0'))   # graus; módulos convertem para radianos
TARGET_FPS         = int(  os.getenv('PROCESSOR_TARGET_FPS',         '10'))
MIN_COVERAGE_DEG   = float(os.getenv('PROCESSOR_MIN_COVERAGE_DEG',   '270'))
MIN_VIDEO_FRAMES   = int(  os.getenv('PROCESSOR_MIN_VIDEO_FRAMES',   '12'))

# Parâmetros de busca para cintura (genéricos, usados como fallback)
WAIST_SEARCH_START = float(os.getenv('PROCESSOR_WAIST_SEARCH_START', '0.20'))
WAIST_SEARCH_END   = float(os.getenv('PROCESSOR_WAIST_SEARCH_END',   '0.80'))
WAIST_SMOOTH_SIGMA = float(os.getenv('PROCESSOR_WAIST_SMOOTH_SIGMA', '3.0'))

# Parâmetros de busca para cintura específicos por sexo
WAIST_SEARCH_START_MALE   = float(os.getenv('PROCESSOR_WAIST_SEARCH_START_MALE',   '0.30'))
WAIST_SEARCH_END_MALE     = float(os.getenv('PROCESSOR_WAIST_SEARCH_END_MALE',     '0.70'))
WAIST_SEARCH_START_FEMALE = float(os.getenv('PROCESSOR_WAIST_SEARCH_START_FEMALE', '0.20'))
WAIST_SEARCH_END_FEMALE   = float(os.getenv('PROCESSOR_WAIST_SEARCH_END_FEMALE',   '0.60'))

# Parâmetros de busca para pescoço
NECK_SEARCH_START   = float(os.getenv('PROCESSOR_NECK_SEARCH_START',   '0.0'))
NECK_SEARCH_END     = float(os.getenv('PROCESSOR_NECK_SEARCH_END',     '0.5'))
NECK_SMOOTH_SIGMA   = float(os.getenv('PROCESSOR_NECK_SMOOTH_SIGMA',   '2.0'))

# Parâmetros anatômicos para pescoço (busca entre nariz e ombros)
NECK_SCAN_TOP_RATIO    = float(os.getenv('PROCESSOR_NECK_SCAN_TOP_RATIO',    '0.25'))
NECK_SCAN_BOTTOM_RATIO = float(os.getenv('PROCESSOR_NECK_SCAN_BOTTOM_RATIO', '0.85'))
NECK_MIN_VALID_PIXELS  = float(os.getenv('PROCESSOR_NECK_MIN_VALID_PIXELS',  '5'))

# Parâmetros de busca para quadril (glúteos)
HIP_SEARCH_START    = float(os.getenv('PROCESSOR_HIP_SEARCH_START',    '0.4'))
HIP_SEARCH_END      = float(os.getenv('PROCESSOR_HIP_SEARCH_END',      '0.9'))
HIP_SMOOTH_SIGMA    = float(os.getenv('PROCESSOR_HIP_SMOOTH_SIGMA',    '3.0'))

# Parâmetros anatômicos para quadril (busca entre articulação do quadril e joelho)
HIP_SCAN_TOP_RATIO     = float(os.getenv('PROCESSOR_HIP_SCAN_TOP_RATIO',     '1.0'))
HIP_SCAN_BOTTOM_RATIO  = float(os.getenv('PROCESSOR_HIP_SCAN_BOTTOM_RATIO',  '0.6'))

# Nível umbilical para cintura masculina (US Navy)
WAIST_NAVEL_RATIO      = float(os.getenv('PROCESSOR_WAIST_NAVEL_RATIO',      '0.78'))

# Antigos parâmetros (mantidos para compatibilidade, mas não mais usados)
NECK_OFFSET_RATIO  = float(os.getenv('PROCESSOR_NECK_OFFSET_RATIO',  '0.70'))
HEAD_TOP_RATIO     = float(os.getenv('PROCESSOR_HEAD_TOP_RATIO',     '0.60'))

ARUCO_CV_THRESHOLD = float(os.getenv('PROCESSOR_ARUCO_CV_THRESHOLD', '0.15'))
ARUCO_MIN_SIDE_PX  = float(os.getenv('PROCESSOR_ARUCO_MIN_SIDE_PX',  '10.0'))

# Tórax (nível peitoral / mesosternal — abaixo das axilas)
CHEST_SCAN_TOP_RATIO    = float(os.getenv('PROCESSOR_CHEST_SCAN_TOP_RATIO',    '0.05'))
CHEST_SCAN_BOTTOM_RATIO = float(os.getenv('PROCESSOR_CHEST_SCAN_BOTTOM_RATIO', '0.28'))
CHEST_SMOOTH_SIGMA      = float(os.getenv('PROCESSOR_CHEST_SMOOTH_SIGMA',      '3.0'))

# Coxa (mid-thigh ISAK — entre articulação do quadril e joelho)
THIGH_SCAN_TOP_RATIO    = float(os.getenv('PROCESSOR_THIGH_SCAN_TOP_RATIO',    '0.30'))
THIGH_SCAN_BOTTOM_RATIO = float(os.getenv('PROCESSOR_THIGH_SCAN_BOTTOM_RATIO', '0.65'))
THIGH_SMOOTH_SIGMA      = float(os.getenv('PROCESSOR_THIGH_SMOOTH_SIGMA',      '3.0'))

# Panturrilha (gastrocnêmio — máxima circunferência entre joelho e tornozelo)
CALF_SCAN_TOP_RATIO     = float(os.getenv('PROCESSOR_CALF_SCAN_TOP_RATIO',     '0.15'))
CALF_SCAN_BOTTOM_RATIO  = float(os.getenv('PROCESSOR_CALF_SCAN_BOTTOM_RATIO',  '0.60'))
CALF_SMOOTH_SIGMA       = float(os.getenv('PROCESSOR_CALF_SMOOTH_SIGMA',       '2.0'))

# === SMPL-X 3D estimation (Fase 2) ===
USE_SMPLX       = os.getenv('PROCESSOR_USE_SMPLX', 'false').lower() == 'true'
SMPLX_MODEL_DIR = os.getenv('PROCESSOR_SMPLX_MODEL_DIR', str(_here / 'models'))
SMPLX_DEVICE    = os.getenv('PROCESSOR_SMPLX_DEVICE', 'cpu')

# === Body parsing (SCHP) — Bloco 1 ===
# Enables semantic part segmentation to separate left/right legs in the
# frontal view, fixing the bilateral silhouette ambiguity in the frustum.
USE_BODY_PARSING          = os.getenv('PROCESSOR_USE_BODY_PARSING', 'false').lower() == 'true'
BODY_PARSING_MODEL_PATH   = os.getenv(
    'PROCESSOR_BODY_PARSING_MODEL_PATH',
    str(_here / 'models' / 'schp_atr.onnx'),   # default: ATR 18-class ONNX
)
BODY_PARSING_N_CLASSES    = int(  os.getenv('PROCESSOR_BODY_PARSING_N_CLASSES',    '18'))
BODY_PARSING_CONF_THRESH  = float(os.getenv('PROCESSOR_BODY_PARSING_CONF_THRESH', '0.5'))
# Applied to frontal thigh/calf when body parsing unavailable (legs are bilateral)
LEG_CORRECTION_FACTOR     = float(os.getenv('PROCESSOR_LEG_CORRECTION_FACTOR',   '0.65'))
