"""
SMPL-X 3D body estimator — Fase 2 do pipeline LAINES.

Rota A: fitting SMPLify-X style usando landmarks 2D do MediaPipe (já calculados na Fase 1).
O pipeline de modo 2D (Fase 1) permanece como fallback automático quando este módulo
não está disponível ou USE_SMPLX=false.

Dependências opcionais:
    pip install smplx[all] torch scipy

Modelos SMPL-X (download em smpl-x.is.tue.mpg.de, requer cadastro):
    laines-image-processor/models/smplx/SMPLX_MALE.npz
    laines-image-processor/models/smplx/SMPLX_FEMALE.npz
    laines-image-processor/models/smplx/SMPLX_NEUTRAL.npz
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
import numpy as np

logger = logging.getLogger(__name__)

try:
    import torch
    import smplx as smplx_lib
    _DEPS_OK = True
except ImportError:
    _DEPS_OK = False

try:
    from scipy.spatial import ConvexHull
    _SCIPY_OK = True
except ImportError:
    _SCIPY_OK = False


# ---------------------------------------------------------------------------
# MediaPipe landmark → SMPL-X joint index mapping
# Apenas juntas corporais confiáveis (excluindo rosto e mãos)
# ---------------------------------------------------------------------------
_PAIRS: list[tuple[int, int]] = [
    (11, 16),  # ombro esquerdo
    (12, 17),  # ombro direito
    (13, 18),  # cotovelo esquerdo
    (14, 19),  # cotovelo direito
    (23,  1),  # quadril esquerdo
    (24,  2),  # quadril direito
    (25,  4),  # joelho esquerdo
    (26,  5),  # joelho direito
    (27,  7),  # tornozelo esquerdo
    (28,  8),  # tornozelo direito
]
_MP_IDX    = [p[0] for p in _PAIRS]
_SMPLX_IDX = [p[1] for p in _PAIRS]

# Orientação global inicial por vista (Y rotation em graus)
_VIEW_YAW_DEG: dict[str, float] = {
    'frontal':           0.0,
    'lateral_direita':  90.0,
    'posterior':        180.0,
    'lateral_esquerda': 270.0,
}


_MODEL_FILENAMES: tuple[str, ...] = (
    'SMPLX_MALE.npz',
    'SMPLX_FEMALE.npz',
    'SMPLX_NEUTRAL.npz',
)

_REQUIRED_MODEL_KEYS: frozenset[str] = frozenset({
    'J_regressor',
    'f',
    'hands_componentsl',
    'hands_componentsr',
    'hands_meanl',
    'hands_meanr',
    'kintree_table',
    'lmk_bary_coords',
    'lmk_faces_idx',
    'posedirs',
    'shapedirs',
    'v_template',
    'weights',
})


def normalize_model_dir(model_dir: str) -> str:
    """
    Return the directory that must be passed to smplx.create().

    smplx.create(model_type='smplx') expects the parent directory containing
    the "smplx" subfolder. Accepting ".../models/smplx" keeps old env vars
    from failing with "Path .../smplx/smplx does not exist".
    """
    path = Path(model_dir)
    if path.name.lower() == 'smplx':
        return str(path.parent)
    return str(path)


def diagnose_model_files(model_dir: str) -> dict:
    """
    Validate the local SMPL-X model layout without running optimization.

    Expected layout:
        <model_dir>/smplx/SMPLX_MALE.npz
        <model_dir>/smplx/SMPLX_FEMALE.npz
        <model_dir>/smplx/SMPLX_NEUTRAL.npz
    """
    normalized_dir = Path(normalize_model_dir(model_dir))
    model_subdir = normalized_dir / 'smplx'
    diagnostics: dict = {
        'ready': False,
        'status': 'ok',
        'model_dir': str(normalized_dir),
        'model_subdir': str(model_subdir),
        'expected_layout': '<model_dir>/smplx/SMPLX_{MALE,FEMALE,NEUTRAL}.npz',
        'dependencies': {
            'torch_and_smplx': _DEPS_OK,
            'scipy': _SCIPY_OK,
        },
        'missing_files': [],
        'missing_keys': {},
        'load_errors': {},
    }

    if not _DEPS_OK or not _SCIPY_OK:
        diagnostics['status'] = 'missing_dependency'
        return diagnostics

    for filename in _MODEL_FILENAMES:
        model_path = model_subdir / filename
        if not model_path.is_file():
            diagnostics['missing_files'].append(str(model_path))
            continue
        try:
            data = np.load(model_path, allow_pickle=True)
            try:
                keys = set(data.files)
            finally:
                data.close()
        except Exception as exc:
            diagnostics['load_errors'][filename] = str(exc)
            continue

        missing_keys = sorted(_REQUIRED_MODEL_KEYS - keys)
        if missing_keys:
            diagnostics['missing_keys'][filename] = missing_keys

    if diagnostics['missing_files']:
        diagnostics['status'] = 'missing_files'
    elif diagnostics['load_errors']:
        diagnostics['status'] = 'load_error'
    elif diagnostics['missing_keys']:
        diagnostics['status'] = 'incomplete_models'

    diagnostics['ready'] = diagnostics['status'] == 'ok'
    return diagnostics


def format_model_diagnostics(diagnostics: dict) -> str:
    status = diagnostics.get('status', 'unknown')
    if status == 'missing_dependency':
        return 'Dependencias SMPL-X incompletas. Instale torch, smplx e scipy.'
    if status == 'missing_files':
        missing = ', '.join(diagnostics.get('missing_files', []))
        return f'Modelos SMPL-X ausentes: {missing}'
    if status == 'load_error':
        return f'Modelos SMPL-X nao puderam ser lidos: {diagnostics.get("load_errors", {})}'
    if status == 'incomplete_models':
        return f'Modelos SMPL-X incompletos; chaves ausentes: {diagnostics.get("missing_keys", {})}'
    if status == 'ok':
        return 'SMPL-X OK'
    return f'SMPL-X status desconhecido: {status}'


def is_available() -> bool:
    """True se torch, smplx e scipy estiverem instalados."""
    return _DEPS_OK and _SCIPY_OK


# ---------------------------------------------------------------------------
# SMPLXEstimator
# ---------------------------------------------------------------------------

class SMPLXEstimator:
    """
    Ajusta o modelo SMPL-X a múltiplas vistas usando landmarks 2D do MediaPipe.

    Estratégia de fitting (2 estágios):
      1. Fit independente por vista → coleta betas (forma corporal).
      2. Mediana dos betas → refit com betas fixos na vista frontal (pose refinada).
    Escala final: malha → estatura real via fator uniforme.
    """

    def __init__(self, model_dir: str, device: str = 'cpu') -> None:
        diagnostics = diagnose_model_files(model_dir)
        if not diagnostics['ready']:
            raise RuntimeError(format_model_diagnostics(diagnostics))

        model_dir = normalize_model_dir(model_dir)
        self._dev = torch.device(device)
        self._models: dict[str, object] = {}
        for gender in ('male', 'female', 'neutral'):
            self._models[gender] = smplx_lib.create(
                model_dir,
                model_type='smplx',
                gender=gender,
                use_face_contour=False,
                use_pca=True,
                num_pca_comps=12,
                flat_hand_mean=True,
                num_betas=10,
            ).to(self._dev)

    def _model(self, sex: str):
        return self._models['female' if sex.lower() == 'feminino' else 'male']

    def _to_normalized(
        self,
        landmarks: list,
        img_h: int,
        img_w: int,
    ) -> tuple[np.ndarray, np.ndarray]:
        """
        Converte landmarks MediaPipe para coordenadas normalizadas em [-1, 1].
        Retorna (pts: (33, 2), conf: (33,)).
        """
        pts  = np.zeros((33, 2), dtype=np.float32)
        conf = np.zeros(33,      dtype=np.float32)
        for i, lm in enumerate(landmarks):
            pts[i, 0] =  (lm.x * img_w - img_w / 2.0) / (img_w / 2.0)
            # Inverte Y: imagem tem Y↓, SMPL-X tem Y↑.
            # Sem a negação o otimizador converge para o corpo de cabeça para baixo.
            pts[i, 1] = -(lm.y * img_h - img_h / 2.0) / (img_h / 2.0)
            conf[i]   = float(getattr(lm, 'visibility', 1.0))
        return pts, conf

    def _fit_single_view(
        self,
        model,
        joints_2d: np.ndarray,
        conf: np.ndarray,
        betas_init: np.ndarray | None = None,
        freeze_betas: bool = False,
        yaw_deg: float = 0.0,
        n_iters: int = 300,
        lr: float = 0.05,
    ) -> dict:
        """
        Ajusta SMPL-X a uma vista com projeção ortográfica fraca (weak perspective).
        Usa Adam + decaimento exponencial de LR.
        """
        dev = self._dev
        j2d_np = joints_2d  # (33, 2) normalizado
        j2d    = torch.tensor(j2d_np, dtype=torch.float32, device=dev)
        w      = torch.tensor(conf,   dtype=torch.float32, device=dev)

        # Betas (forma)
        betas = (
            torch.tensor(betas_init, dtype=torch.float32, device=dev).unsqueeze(0)
            if betas_init is not None
            else torch.zeros(1, 10, dtype=torch.float32, device=dev)
        )
        betas.requires_grad_(not freeze_betas)

        # Orientação global: inicializa com yaw da vista
        go = torch.zeros(1, 3, dtype=torch.float32, device=dev)
        go[0, 1] = float(np.radians(yaw_deg))
        go = go.clone().requires_grad_(True)

        body_pose = torch.zeros(1, 63, dtype=torch.float32, device=dev, requires_grad=True)
        cam_scale = torch.tensor([[0.5]], dtype=torch.float32, device=dev, requires_grad=True)
        cam_t     = torch.zeros(1, 2,   dtype=torch.float32, device=dev, requires_grad=True)

        optim_params = [go, body_pose, cam_scale, cam_t]
        if not freeze_betas:
            optim_params.append(betas)

        optimizer = torch.optim.Adam(optim_params, lr=lr)
        scheduler = torch.optim.lr_scheduler.ExponentialLR(optimizer, gamma=0.99)

        smplx_t = torch.tensor(_SMPLX_IDX, dtype=torch.long, device=dev)
        mp_t    = torch.tensor(_MP_IDX,    dtype=torch.long, device=dev)

        for _ in range(n_iters):
            optimizer.zero_grad()
            out   = model(betas=betas, body_pose=body_pose, global_orient=go, return_verts=True)
            j3d   = out.joints[0, :22, :]                        # (22, 3)

            # Projeção fraca: scale * XY + translação 2D
            j2d_pred = cam_scale * j3d[smplx_t, :2] + cam_t     # (K, 2)
            j2d_tgt  = j2d[mp_t]                                 # (K, 2)
            wi       = w[mp_t]                                    # (K,)

            repro     = (wi * ((j2d_pred - j2d_tgt) ** 2).sum(dim=-1)).mean()
            reg_shape = 0.005 * (betas ** 2).sum()
            reg_pose  = 0.001 * (body_pose ** 2).sum()

            (repro + reg_shape + reg_pose).backward()
            optimizer.step()
            scheduler.step()

        with torch.no_grad():
            out = model(betas=betas, body_pose=body_pose, global_orient=go, return_verts=True)

        return {
            'vertices': out.vertices[0].cpu().numpy(),  # (10475, 3) metros
            'joints':   out.joints[0].cpu().numpy(),    # (127, 3)
            'betas':    betas[0].detach().cpu().numpy(),
        }

    # ── Silhouette loss (Bloco 2) ────────────────────────────────────────────

    @staticmethod
    def _precompute_dist_field(mask: np.ndarray):
        """
        Precompute outside-mask distance transform (once per view).
        Returns (1, 1, H, W) float32 tensor normalised by image diagonal.
        """
        from scipy.ndimage import distance_transform_edt
        dist = distance_transform_edt(~mask.astype(bool)).astype(np.float32)
        diag = float(np.sqrt(mask.shape[0] ** 2 + mask.shape[1] ** 2))
        dist /= max(1.0, diag)
        return torch.from_numpy(dist).unsqueeze(0).unsqueeze(0)  # (1,1,H,W)

    @staticmethod
    def _silhouette_loss(
        vertices_3d: 'torch.Tensor',
        cam_scale:   'torch.Tensor',
        cam_t:       'torch.Tensor',
        dist_field:  'torch.Tensor',
    ) -> 'torch.Tensor':
        """
        Differentiable outside-mask penalty (no differentiable rasterizer needed).

        Projects all mesh vertices to normalised 2D, samples the precomputed
        distance-to-mask field via bilinear interpolation, and returns the mean
        squared distance.  Loss = 0 when every vertex projects inside the mask.

        Silhouette gradient flows through:
          cam_scale → projection → grid_sample (bilinear, differentiable)
          cam_t     → projection → grid_sample
        """
        import torch.nn.functional as F
        xy = cam_scale * vertices_3d[:, :2] + cam_t   # (N, 2) normalised
        xy = xy.clamp(-1.0, 1.0)
        grid = xy.unsqueeze(0).unsqueeze(0)            # (1, 1, N, 2)
        # grid_sample: input (1,1,H,W), grid (1,1,N,2) → (1,1,1,N)
        sampled = F.grid_sample(dist_field, grid, align_corners=True, mode='bilinear')
        return (sampled.squeeze() ** 2).mean()

    def _fit_cpu_optimized(
        self,
        model,
        joints_2d:      np.ndarray,
        conf:           np.ndarray,
        mask:           np.ndarray | None = None,
        betas_init:     np.ndarray | None = None,
        freeze_betas:   bool = False,
        yaw_deg:        float = 0.0,
        n_iters:        int   = 50,
        lr:             float = 0.05,
        silhouette_w:   float = 0.10,
        early_stop_patience: int   = 8,
        early_stop_delta:    float = 1e-4,
    ) -> dict:
        """
        CPU-optimised fitting: 50 iterations, Adam, exponential LR decay,
        optional silhouette loss, early stopping.

        Runs in < 30 s on a modern CPU for a single view.
        """
        dev = self._dev
        j2d = torch.tensor(joints_2d, dtype=torch.float32, device=dev)
        w   = torch.tensor(conf,      dtype=torch.float32, device=dev)

        betas = (
            torch.tensor(betas_init, dtype=torch.float32, device=dev).unsqueeze(0)
            if betas_init is not None
            else torch.zeros(1, 10, dtype=torch.float32, device=dev)
        )
        betas.requires_grad_(not freeze_betas)

        go = torch.zeros(1, 3, dtype=torch.float32, device=dev)
        go[0, 1] = float(np.radians(yaw_deg))
        go = go.clone().requires_grad_(True)

        body_pose = torch.zeros(1, 63, dtype=torch.float32, device=dev, requires_grad=True)
        cam_scale = torch.tensor([[0.5]], dtype=torch.float32, device=dev, requires_grad=True)
        cam_t     = torch.zeros(1, 2,   dtype=torch.float32, device=dev, requires_grad=True)

        params = [go, body_pose, cam_scale, cam_t]
        if not freeze_betas:
            params.append(betas)

        optimizer = torch.optim.Adam(params, lr=lr)
        scheduler = torch.optim.lr_scheduler.ExponentialLR(optimizer, gamma=0.97)

        smplx_t = torch.tensor(_SMPLX_IDX, dtype=torch.long, device=dev)
        mp_t    = torch.tensor(_MP_IDX,    dtype=torch.long, device=dev)

        dist_field = None
        if mask is not None and silhouette_w > 0:
            dist_field = self._precompute_dist_field(mask).to(dev)

        best_loss  = float('inf')
        no_improve = 0

        for _ in range(n_iters):
            optimizer.zero_grad()
            out    = model(betas=betas, body_pose=body_pose, global_orient=go, return_verts=True)
            j3d    = out.joints[0, :22, :]
            j2d_p  = cam_scale * j3d[smplx_t, :2] + cam_t
            j2d_t  = j2d[mp_t]
            wi     = w[mp_t]

            repro  = (wi * ((j2d_p - j2d_t) ** 2).sum(dim=-1)).mean()
            reg_s  = 0.005 * (betas ** 2).sum()
            reg_p  = 0.001 * (body_pose ** 2).sum()
            loss   = repro + reg_s + reg_p

            if dist_field is not None:
                verts = out.vertices[0]   # (N, 3)
                loss  = loss + silhouette_w * self._silhouette_loss(verts, cam_scale, cam_t, dist_field)

            loss.backward()
            optimizer.step()
            scheduler.step()

            loss_val = float(loss.detach())
            if best_loss - loss_val > early_stop_delta:
                best_loss  = loss_val
                no_improve = 0
            else:
                no_improve += 1
                if no_improve >= early_stop_patience:
                    break

        with torch.no_grad():
            out = model(betas=betas, body_pose=body_pose, global_orient=go, return_verts=True)

        return {
            'vertices': out.vertices[0].cpu().numpy(),
            'joints':   out.joints[0].cpu().numpy(),
            'betas':    betas[0].detach().cpu().numpy(),
        }

    # ── Original fit (full iteration count, no silhouette loss) ─────────────

    def fit_multiview(
        self,
        views: list[dict],
        height_cm: float,
        sex: str,
        n_iters_shape: int = 50,
        n_iters_pose:  int = 30,
        use_silhouette: bool = True,
        silhouette_w:   float = 0.10,
    ) -> dict | None:
        """
        Ajusta SMPL-X a múltiplas vistas com fitting CPU-optimizado.

        Cada elemento de `views` deve ter:
            'vista':     str        — 'frontal' | 'lateral_direita' | ...
            'landmarks': list       — landmarks MediaPipe (pose_landmarks[0])
            'img_h':     int
            'img_w':     int
            'mask':      np.ndarray — opcional; máscara binária (H×W) para silhueta

        n_iters_shape / n_iters_pose são limites máximos; early stopping
        pode terminar mais cedo (tipicamente 20–40 iterações efetivas).

        Retorna dict com 'vertices', 'joints', 'betas', 'height_scale', ou None.
        """
        if not views:
            return None

        model = self._model(sex)
        model.eval()

        # ── Estágio 1: fit independente por vista → coleta betas ────────────
        all_betas: list[np.ndarray] = []
        for v in views:
            try:
                j2d, conf = self._to_normalized(v['landmarks'], v['img_h'], v['img_w'])
                yaw   = _VIEW_YAW_DEG.get(v.get('vista', 'frontal'), 0.0)
                mask  = v.get('mask') if use_silhouette else None
                res   = self._fit_cpu_optimized(
                    model, j2d, conf,
                    mask=mask,
                    yaw_deg=yaw,
                    n_iters=n_iters_shape,
                    silhouette_w=silhouette_w,
                )
                all_betas.append(res['betas'])
            except Exception as exc:
                logger.warning('SMPL-X fit falhou na vista %s: %s', v.get('vista'), exc)

        if not all_betas:
            logger.error('SMPL-X: nenhuma vista convergiu')
            return None

        betas_median = np.median(np.stack(all_betas), axis=0)

        # ── Estágio 2: refit com betas fixos + silhueta na vista frontal ────
        frontal = next((v for v in views if v.get('vista') == 'frontal'), views[0])
        try:
            j2d, conf = self._to_normalized(frontal['landmarks'], frontal['img_h'], frontal['img_w'])
            mask = frontal.get('mask') if use_silhouette else None
            res  = self._fit_cpu_optimized(
                model, j2d, conf,
                mask=mask,
                betas_init=betas_median,
                freeze_betas=True,
                yaw_deg=0.0,
                n_iters=n_iters_pose,
                silhouette_w=silhouette_w,
            )
        except Exception as exc:
            logger.error('SMPL-X: refit frontal falhou: %s', exc)
            return None

        vertices = res['vertices']
        joints   = res['joints'][:22]   # primeiras 22 juntas corporais

        # ── Escala para estatura real ────────────────────────────────────────
        mesh_h_m = float(vertices[:, 1].max() - vertices[:, 1].min())
        if mesh_h_m < 0.1:
            logger.error('SMPL-X: altura da malha irrealista (%.3f m)', mesh_h_m)
            return None

        scale = (height_cm / 100.0) / mesh_h_m
        return {
            'vertices':      vertices * scale,   # (10475, 3) metros reais
            'joints':        joints   * scale,   # (22, 3) metros reais
            'faces':         np.asarray(getattr(model, 'faces', []), dtype=np.int64),
            'betas':         betas_median,
            'height_scale':  scale,
        }


# ---------------------------------------------------------------------------
# Extração de circunferência
# ---------------------------------------------------------------------------

def extract_circumference(
    vertices: np.ndarray,
    y_target: float,
    epsilon: float = 0.01,
) -> float | None:
    """
    Circunferência (cm) no plano horizontal y=y_target, via convex hull dos
    vértices próximos projetados no plano XZ.

    vertices: (N, 3) em metros — convenção SMPL-X (Y aponta para cima)
    y_target: coordenada Y do plano de corte, em metros
    epsilon:  meia-espessura da fatia (metros)
    Retorna circunferência em cm, ou None se vértices insuficientes.
    """
    if not _SCIPY_OK:
        logger.warning('scipy não disponível; extract_circumference retornando None')
        return None

    near = vertices[np.abs(vertices[:, 1] - y_target) < epsilon]
    if len(near) < 4:
        return None

    xz = near[:, [0, 2]]
    try:
        hull = ConvexHull(xz)
    except Exception:
        return None

    pts = xz[hull.vertices]
    pts = np.vstack([pts, pts[0]])                           # fecha o polígono
    perimeter_m = float(np.sum(np.linalg.norm(np.diff(pts, axis=0), axis=1)))
    return perimeter_m * 100.0                               # m → cm


def mesh_volume_liters(vertices: np.ndarray, faces: np.ndarray) -> float | None:
    """
    Volume of a closed triangular mesh in liters.

    vertices: (N, 3) in meters.
    faces:    (M, 3) triangle indices.

    Uses the divergence theorem:
        V = |sum dot(v0, cross(v1, v2))| / 6

    fit_multiview already scales vertices to real meters, so the final
    conversion is cubic meters to liters.
    """
    verts = np.asarray(vertices, dtype=float)
    tri = np.asarray(faces, dtype=np.int64)

    if verts.ndim != 2 or verts.shape[1] != 3:
        return None
    if tri.ndim != 2 or tri.shape[1] != 3 or len(tri) == 0:
        return None
    if tri.min(initial=0) < 0 or tri.max(initial=-1) >= len(verts):
        return None

    v0 = verts[tri[:, 0]]
    v1 = verts[tri[:, 1]]
    v2 = verts[tri[:, 2]]
    signed_volume_m3 = float(np.einsum('ij,ij->i', v0, np.cross(v1, v2)).sum() / 6.0)
    volume_liters = abs(signed_volume_m3) * 1000.0

    if not np.isfinite(volume_liters) or volume_liters <= 0:
        return None
    return volume_liters


def _scan_circumference(
    vertices: np.ndarray,
    y_start: float,
    y_end: float,
    mode: str = 'min',
    n_samples: int = 24,
    epsilon: float = 0.01,
) -> tuple[float, float | None]:
    """
    Varre o intervalo [y_start, y_end] buscando o plano com mínima ou máxima circunferência.
    Retorna (y_optimo, circumferencia_cm).
    """
    ys = np.linspace(y_start, y_end, n_samples)
    best_y   = float(ys[0])
    best_val = np.inf if mode == 'min' else -np.inf
    best_c: float | None = None

    for y in ys:
        c = extract_circumference(vertices, float(y), epsilon)
        if c is None:
            continue
        if (mode == 'min' and c < best_val) or (mode == 'max' and c > best_val):
            best_val = c
            best_y   = float(y)
            best_c   = c

    return best_y, best_c


# ---------------------------------------------------------------------------
# Níveis corporais 3D
# ---------------------------------------------------------------------------

def get_body_levels_3d(
    vertices: np.ndarray,
    joints: np.ndarray,
    sex: str,
) -> dict[str, dict]:
    """
    Determina os planos Y ótimos para medir pescoço, cintura e quadril na malha 3D.

    joints: (22, 3) — primeiras 22 juntas SMPL-X, em metros (Y aponta para cima)
    vertices: (10475, 3) — malha completa escalada

    Retorna dict por nível com 'y' (metros) e 'circ_cm' (circunferência).

    Índices das juntas SMPL-X usados:
      0=pelvis, 1=l_hip, 2=r_hip, 4=l_knee, 5=r_knee,
      9=spine3, 12=neck, 13=l_collar, 14=r_collar
    """
    pelvis_y  = float(joints[0, 1])
    spine3_y  = float(joints[9, 1])
    neck_j_y  = float(joints[12, 1])
    l_collar_y = float(joints[13, 1])
    hip_y     = float((joints[1, 1] + joints[2, 1]) / 2)
    knee_y    = float((joints[4, 1] + joints[5, 1]) / 2)

    # Pescoço: mínima circunferência entre colar e junta do pescoço
    neck_scan_lo = min(neck_j_y, l_collar_y)
    neck_scan_hi = max(neck_j_y, l_collar_y)
    neck_y_opt, neck_c = _scan_circumference(vertices, neck_scan_lo, neck_scan_hi, mode='min')

    # Quadril: máxima circunferência entre quadril e 60% em direção ao joelho
    hip_scan_hi = hip_y
    hip_scan_lo = hip_y + (knee_y - hip_y) * 0.6   # Y decresce em direção ao joelho
    if hip_scan_lo > hip_scan_hi:
        hip_scan_lo, hip_scan_hi = hip_scan_hi, hip_scan_lo
    hip_y_opt, hip_c = _scan_circumference(vertices, hip_scan_lo, hip_scan_hi, mode='max')

    # Cintura
    if sex.lower() == 'feminino':
        # Feminino: mínima entre pelvis e spine3 (cintura anatômica)
        waist_y_opt, waist_c = _scan_circumference(vertices, pelvis_y, spine3_y, mode='min')
    else:
        # Masculino: nível umbilical (~60% de pelvis→spine3) — consistente com WAIST_NAVEL_RATIO
        waist_scan_lo = pelvis_y + (spine3_y - pelvis_y) * 0.40
        waist_scan_hi = pelvis_y + (spine3_y - pelvis_y) * 0.75
        waist_y_opt, waist_c = _scan_circumference(
            vertices, waist_scan_lo, waist_scan_hi, mode='min'
        )

    return {
        'neck':  {'y': neck_y_opt,  'circ_cm': neck_c},
        'waist': {'y': waist_y_opt, 'circ_cm': waist_c},
        'hip':   {'y': hip_y_opt,   'circ_cm': hip_c},
    }


def _main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description='Validate SMPL-X model layout and dependencies.')
    parser.add_argument('--model-dir', default=None, help='Parent directory containing the smplx model folder.')
    args = parser.parse_args()

    if args.model_dir:
        model_dir = args.model_dir
    else:
        import config
        model_dir = config.SMPLX_MODEL_DIR

    diagnostics = diagnose_model_files(model_dir)
    print(format_model_diagnostics(diagnostics))
    print(json.dumps(diagnostics, indent=2, sort_keys=True))
    return 0 if diagnostics['ready'] else 1


if __name__ == '__main__':
    raise SystemExit(_main())
