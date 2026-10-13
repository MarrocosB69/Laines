import os
import math
import tempfile
from concurrent.futures import ThreadPoolExecutor
from threading import BoundedSemaphore
from typing import Any
from urllib.parse import urlparse

import numpy as np
import requests

import config
from jobs_status import update_job
from core.image_analysis import analyze_photos
from core.video_analysis import analyze_video
from core.ellipse_fitter import fit_weighted_ellipse, ramanujan_circumference
from core.body_composition import calc_body_composition
from core.smplx_estimator import (
    SMPLXEstimator,
    diagnose_model_files,
    format_model_diagnostics,
    get_body_levels_3d,
    is_available as smplx_available,
    mesh_volume_liters,
)

REQUIRED_PHOTO_VIEWS = {'frontal', 'lateral_direita', 'posterior', 'lateral_esquerda'}
_executor = ThreadPoolExecutor(max_workers=config.MAX_CONCURRENT_JOBS, thread_name_prefix='image-job')
_pending_slots = BoundedSemaphore(config.MAX_PENDING_JOBS)


# ---------------------------------------------------------------------------
# Path resolution
# ---------------------------------------------------------------------------

def _resolve_source(source: dict) -> tuple[str | None, bool]:
    src_type = source.get('type', '')

    if src_type == 'local_path':
        path = str(source.get('path', ''))
        nestjs_base = os.path.realpath(config.NESTJS_UPLOAD_BASE.rstrip('/'))
        processor_base = os.path.realpath(config.PROCESSOR_UPLOAD_BASE.rstrip('/'))
        if path.startswith(nestjs_base):
            path = processor_base + path[len(nestjs_base):]
        resolved = os.path.realpath(path)
        try:
            if os.path.commonpath([resolved, processor_base]) != processor_base:
                return None, False
        except ValueError:
            return None, False
        return (resolved, False) if os.path.isfile(resolved) else (None, False)

    if src_type == 'url':
        url = source.get('url', '')
        if not url:
            return None, False
        parsed = urlparse(str(url))
        if parsed.scheme not in {'http', 'https'} or not parsed.hostname:
            return None, False
        if not config.ALLOWED_SOURCE_HOSTS or parsed.hostname.lower() not in config.ALLOWED_SOURCE_HOSTS:
            return None, False
        try:
            with requests.get(url, stream=True, timeout=30, allow_redirects=False) as resp:
                resp.raise_for_status()
                declared_size = int(resp.headers.get('Content-Length') or 0)
                if declared_size > config.MAX_SOURCE_BYTES:
                    return None, False
                content_type = resp.headers.get('Content-Type', '').lower()
                suffix = '.mp4' if 'mp4' in content_type else ('.webm' if 'video' in content_type else '.jpg')
                total = 0
                with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                    for chunk in resp.iter_content(chunk_size=65536):
                        total += len(chunk)
                        if total > config.MAX_SOURCE_BYTES:
                            raise ValueError('SOURCE_TOO_LARGE')
                        tmp.write(chunk)
                    if total < 1:
                        raise ValueError('SOURCE_EMPTY')
                    return tmp.name, True
        except Exception:
            return None, False

    return None, False


def _prepare_captures(captures: list[dict]) -> tuple[list[dict], list[str]]:
    prepared: list[dict] = []
    temporary_paths: list[str] = []
    for cap in captures:
        source = cap.get('source', {})
        resolved, is_temporary = _resolve_source(source)
        if resolved:
            prepared.append({**cap, 'source': {**source, 'path': resolved}})
            if is_temporary:
                temporary_paths.append(resolved)
    return prepared, temporary_paths


# ---------------------------------------------------------------------------
# SMPL-X 3D circumferences (Fase 2)
# ---------------------------------------------------------------------------

def _try_smplx_circumferences(
    photo_data: list[dict],
    estatura: float,
    sexo: str,
) -> dict[str, float | None] | None:
    """
    Tenta extrair circunferências via SMPL-X a partir das fotos já processadas.
    Retorna dict {'neck', 'waist', 'hip'} em cm, ou None se falhar/desabilitado.
    Chest/thigh/calf continuam vindos do ellipse 2D (SMPL-X não os computa).
    Remove os campos internos _landmarks/_img_h/_img_w dos dicts de foto.
    """
    analysis = _try_smplx_analysis(photo_data, estatura, sexo)
    return analysis.get('circumferences') if analysis.get('circumference_ok') else None


def _try_smplx_analysis(
    photo_data: list[dict],
    estatura: float,
    sexo: str,
) -> dict:
    """
    Fit SMPL-X once and return all 3D signals needed by the pipeline.

    The function intentionally does not mutate photo_data. Landmark fields are
    still needed later to decide whether SMPL-X or 2D ellipse is more reliable
    for each circumference level.
    """
    analysis: dict = {
        'enabled': config.USE_SMPLX,
        'available': smplx_available(),
        'fit_ok': False,
        'circumference_ok': False,
        'volume_ok': False,
        'status': 'disabled' if not config.USE_SMPLX else 'not_started',
        'reason': None,
        'circumferences': {},
        'body_levels': {},
        'volume_liters': None,
        'height_scale': None,
        'diagnostics': None,
    }

    if not config.USE_SMPLX:
        return analysis

    diagnostics = diagnose_model_files(config.SMPLX_MODEL_DIR)
    analysis['diagnostics'] = {
        'ready': diagnostics.get('ready'),
        'status': diagnostics.get('status'),
        'dependencies': diagnostics.get('dependencies'),
    }
    if not diagnostics.get('ready'):
        analysis['status'] = str(diagnostics.get('status') or 'not_ready')
        analysis['reason'] = format_model_diagnostics(diagnostics)
        return analysis

    views: list[dict] = []
    for p in photo_data:
        lm = p.get('_landmarks')
        img_h = p.get('_img_h')
        img_w = p.get('_img_w')
        if lm is not None and img_h is not None and img_w is not None:
            views.append({
                'vista': p['vista'],
                'landmarks': lm,
                'img_h': img_h,
                'img_w': img_w,
                'mask': p.get('_mask'),
            })

    if not views:
        analysis['status'] = 'no_landmarks'
        analysis['reason'] = 'Fotos sem landmarks preservados para fitting SMPL-X.'
        return analysis

    try:
        estimator = SMPLXEstimator(config.SMPLX_MODEL_DIR, device=config.SMPLX_DEVICE)
        result = estimator.fit_multiview(views, estatura, sexo)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning('SMPL-X falhou, usando modo 2D: %s', exc)
        analysis['status'] = 'fit_error'
        analysis['reason'] = str(exc)
        return analysis

    if result is None:
        analysis['status'] = 'fit_failed'
        analysis['reason'] = 'Fitting SMPL-X nao convergiu.'
        return analysis

    analysis['fit_ok'] = True
    analysis['height_scale'] = round(float(result.get('height_scale') or 0.0), 5)
    # Store raw mesh data so run_pipeline can export GLB without re-running the estimator
    analysis['_raw_mesh'] = {
        'vertices': result['vertices'],
        'faces':    result['faces'],
    }

    levels = get_body_levels_3d(result['vertices'], result['joints'], sexo)
    circ: dict[str, float | None] = {}
    for key in ('neck', 'waist', 'hip'):
        value = levels.get(key, {}).get('circ_cm')
        circ[key] = float(value) if value is not None else None

    analysis['circumferences'] = circ
    analysis['body_levels'] = {
        key: {
            'y_m': round(float(value['y']), 4) if value.get('y') is not None else None,
            'circ_cm': round(float(value['circ_cm']), 2) if value.get('circ_cm') is not None else None,
        }
        for key, value in levels.items()
    }
    analysis['circumference_ok'] = bool(circ.get('neck') and circ.get('waist'))

    volume_liters = mesh_volume_liters(result.get('vertices'), result.get('faces'))
    if volume_liters is not None:
        analysis['volume_liters'] = round(float(volume_liters), 2)
        analysis['volume_ok'] = True

    if analysis['circumference_ok'] and analysis['volume_ok']:
        analysis['status'] = 'ok'
    elif analysis['circumference_ok']:
        analysis['status'] = 'partial_circumference_only'
        analysis['reason'] = 'Circunferencias SMPL-X disponiveis, mas volume da malha indisponivel.'
    else:
        analysis['status'] = 'no_valid_circumference'
        analysis['reason'] = 'SMPL-X nao retornou pescoço/cintura validos.'

    return analysis


# ---------------------------------------------------------------------------
# GLB mesh export
# ---------------------------------------------------------------------------

def _export_smplx_glb(
    evaluation_id: str,
    vertices: 'np.ndarray',
    faces: 'np.ndarray',
) -> 'str | None':
    """
    Export the fitted SMPL-X mesh as a binary GLTF (.glb) file.

    Saves to {PROCESSOR_UPLOAD_BASE}/{evaluation_id}/body_mesh.glb and
    returns the relative key "{evaluation_id}/body_mesh.glb" so NestJS can
    serve it at /uploads/avaliacoes-imagem/{key}.
    Returns None on any failure (non-fatal — the rest of the pipeline continues).
    """
    try:
        import trimesh  # optional dep — already installed
        upload_base = config.PROCESSOR_UPLOAD_BASE.rstrip('/')
        mesh_dir = os.path.join(upload_base, str(evaluation_id))
        os.makedirs(mesh_dir, exist_ok=True)
        mesh_path = os.path.join(mesh_dir, 'body_mesh.glb')
        mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
        mesh.export(mesh_path)
        return f'{evaluation_id}/body_mesh.glb'
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning('GLB export falhou (nao fatal): %s', exc)
        return None


# ---------------------------------------------------------------------------
# SMPL-X vs 2D granular fusion (Bloco 2)
# ---------------------------------------------------------------------------

# Visibility score keys mapped to MediaPipe landmark indices for each level
_LEVEL_LM_INDICES: dict[str, list[int]] = {
    'neck':  [0, 11, 12],           # nariz, ombros
    'waist': [11, 12, 23, 24],      # ombros, quadril
    'hip':   [23, 24, 25, 26],      # quadril, joelhos
}


def fuse_circumferences(
    circ_2d: dict[str, float | None],
    circ_smplx: dict[str, float | None] | None,
    photo_data: list[dict],
    smplx_threshold: float = 0.6,
) -> dict[str, float | None]:
    """
    For neck / waist / hip: choose SMPL-X if available AND the mean visibility
    of the adjacent landmarks (across photos) is >= smplx_threshold.
    chest / thigh / calf always come from 2D (SMPL-X does not estimate them).

    Returns a merged dict of the best available circumference per level.
    """
    if circ_smplx is None:
        return circ_2d

    # Compute mean visibility per landmark index across photos
    vis_sum: dict[int, float] = {}
    vis_cnt: dict[int, int]   = {}
    for dp in photo_data:
        lm_list = dp.get('_landmarks')
        if lm_list is None:
            continue
        for idx in range(33):
            if idx < len(lm_list):
                v = getattr(lm_list[idx], 'visibility', 1.0)
                vis_sum[idx] = vis_sum.get(idx, 0.0) + v
                vis_cnt[idx] = vis_cnt.get(idx, 0)  + 1
    mean_vis = {k: vis_sum[k] / vis_cnt[k] for k in vis_sum}

    result: dict[str, float | None] = {}
    for level in ('neck', 'chest', 'waist', 'hip', 'thigh', 'calf'):
        smplx_val = circ_smplx.get(level)
        circ_val  = circ_2d.get(level)

        if smplx_val is None or level not in _LEVEL_LM_INDICES:
            result[level] = circ_val
            continue

        idxs = _LEVEL_LM_INDICES[level]
        avg  = sum(mean_vis.get(i, 0.0) for i in idxs) / len(idxs)
        result[level] = smplx_val if avg >= smplx_threshold else circ_val

    return result


def fuse_circumferences_with_sources(
    circ_2d: dict[str, float | None],
    circ_smplx: dict[str, float | None] | None,
    photo_data: list[dict],
    smplx_threshold: float = 0.6,
) -> tuple[dict[str, float | None], dict[str, str], dict[str, float | None]]:
    """
    Same fusion rule as fuse_circumferences, but also reports source and
    visibility by level for auditability.
    """
    levels = ('neck', 'chest', 'waist', 'hip', 'thigh', 'calf')
    if circ_smplx is None:
        return (
            dict(circ_2d),
            {level: 'ellipse_polar_2d' for level in levels},
            {level: None for level in levels},
        )

    vis_sum: dict[int, float] = {}
    vis_cnt: dict[int, int] = {}
    for dp in photo_data:
        lm_list = dp.get('_landmarks')
        if lm_list is None:
            continue
        for idx in range(33):
            if idx < len(lm_list):
                v = getattr(lm_list[idx], 'visibility', 1.0)
                vis_sum[idx] = vis_sum.get(idx, 0.0) + v
                vis_cnt[idx] = vis_cnt.get(idx, 0) + 1
    mean_vis = {k: vis_sum[k] / vis_cnt[k] for k in vis_sum}

    result: dict[str, float | None] = {}
    sources: dict[str, str] = {}
    visibility: dict[str, float | None] = {}

    for level in levels:
        smplx_val = circ_smplx.get(level)
        circ_val = circ_2d.get(level)
        avg: float | None = None

        if level in _LEVEL_LM_INDICES:
            idxs = _LEVEL_LM_INDICES[level]
            avg = sum(mean_vis.get(i, 0.0) for i in idxs) / len(idxs)

        if smplx_val is not None and avg is not None and avg >= smplx_threshold:
            result[level] = smplx_val
            sources[level] = 'smplx_3d'
        else:
            result[level] = circ_val
            sources[level] = 'ellipse_polar_2d'

        visibility[level] = round(avg, 3) if avg is not None else None

    return result, sources, visibility


# ---------------------------------------------------------------------------
# Ellipse fitting per body level — also returns waist axes for visceral index
# ---------------------------------------------------------------------------

def _compute_circumferences(
    photo_data: list[dict],
    video_data: list[dict],
) -> tuple[dict[str, float | None], float | None, float | None, float | None]:
    """
    Fit polar ellipses for all 6 anatomical levels.

    Returns
    -------
    circs           : dict level → circumference in cm
    waist_a         : ellipse depth semi-axis for waist (cm), or None
    waist_b         : ellipse width semi-axis for waist (cm), or None
    waist_fit_rmse  : weighted RMSE of waist ellipse fit (cm) — geometric
                      uncertainty proxy for the confidence interval.
                      Computed over ALL angles (photos + video frames).
    """
    circs:          dict[str, float | None] = {}
    waist_a:        float | None = None
    waist_b:        float | None = None
    waist_fit_rmse: float | None = None

    for level in ('neck', 'chest', 'waist', 'hip', 'thigh', 'calf'):
        thetas:  list[float] = []
        radii:   list[float] = []
        weights: list[float] = []

        for dp in photo_data:
            r = dp['measurements'].get(level)
            if r is not None:
                thetas.append(dp['theta'])
                radii.append(r)
                weights.append(dp['weight'])

        radius_key = f'{level}_radius'
        for dp in video_data:
            r = dp.get(radius_key)
            if r is not None:
                thetas.append(dp['theta'])
                radii.append(r)
                weights.append(dp['weight'])

        if not thetas:
            circs[level] = None
            continue

        if len(thetas) == 1:
            circs[level] = 2.0 * math.pi * radii[0]
        else:
            a, b = fit_weighted_ellipse(thetas, radii, weights)
            circs[level] = ramanujan_circumference(a, b)
            if level == 'waist':
                waist_a = round(a, 2)
                waist_b = round(b, 2)
                # RMSE of fit: r_fitted(θ)² = a²sin²θ + b²cos²θ
                arr_t = np.array(thetas)
                arr_r = np.array(radii)
                arr_w = np.array(weights)
                r_hat = np.sqrt(
                    np.maximum(0.0, a ** 2 * np.sin(arr_t) ** 2 + b ** 2 * np.cos(arr_t) ** 2)
                )
                residuals = arr_r - r_hat
                waist_fit_rmse = round(
                    float(np.sqrt(np.average(residuals ** 2, weights=arr_w))), 3
                )

    return circs, waist_a, waist_b, waist_fit_rmse


# ---------------------------------------------------------------------------
# Calibration summary
# ---------------------------------------------------------------------------

def _summarize_calibration(
    photo_data: list[dict],
    video_calibracao: dict,
    marker_size_cm: float,
    aruco_used: bool,
) -> dict:
    foto_calibracoes = [p.get('calibracao', {}) for p in photo_data]
    metodos = [c.get('metodo', 'desconhecido') for c in foto_calibracoes]
    confiancas = [c.get('confianca', 'baixa') for c in foto_calibracoes]

    if all(m == 'aruco' for m in metodos):
        metodo_geral = 'aruco'
    elif any(m == 'aruco' for m in metodos):
        metodo_geral = 'aruco_parcial'
    else:
        metodo_geral = 'altura_fallback'

    confianca_geral = (
        'alta'
        if (
            all(c == 'alta' for c in confiancas)
            and video_calibracao.get('confianca') == 'alta'
        )
        else 'baixa'
    )

    return {
        'metodo_geral': metodo_geral,
        'confianca_geral': confianca_geral,
        'marcador_tamanho_cm': marker_size_cm if aruco_used else None,
        'px_por_cm_por_vista': {
            p['vista']: {
                'metodo': p.get('calibracao', {}).get('metodo'),
                'px_por_cm': p.get('calibracao', {}).get('px_por_cm'),
                'confianca': p.get('calibracao', {}).get('confianca'),
            }
            for p in photo_data
        },
        'video': video_calibracao,
    }


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_pipeline(job_id: str, payload: dict) -> None:
    temporary_paths: list[str] = []
    try:
        update_job(job_id, status='processing', progress=5)

        anthropometry = payload.get('anthropometry', {})
        estatura = float(anthropometry.get('estatura', 170))
        peso = float(anthropometry.get('peso', 70))
        sexo = str(anthropometry.get('sexo', 'masculino')).lower()
        raw_age = anthropometry.get('idade')
        idade = raw_age if type(raw_age) is int and 19 <= raw_age <= 83 else None
        idade_origem = (
            anthropometry.get('idadeOrigem') if idade is not None else 'indisponivel'
        )

        raw_marker_size = anthropometry.get('arucoMarkerSizeCm')
        marker_size_cm: float = (
            float(raw_marker_size)
            if raw_marker_size is not None and float(raw_marker_size) > 0
            else config.ARUCO_MARKER_SIZE_CM
        )
        aruco_dict_name: str = config.ARUCO_DICT_NAME

        captures, temporary_paths = _prepare_captures(payload.get('captures', []))
        if len(captures) != 5:
            raise ValueError('Uma ou mais capturas nao puderam ser lidas com seguranca')

        photo_captures = [c for c in captures if c.get('vista') != 'video_360']
        video_capture = next((c for c in captures if c.get('vista') == 'video_360'), None)

        # Phase 1 — Static photos (higher confidence)
        update_job(job_id, progress=10)
        photo_data = analyze_photos(
            photo_captures,
            estatura,
            sexo,
            marker_size_cm,
            aruco_dict_name
        )
        valid_photo_views = {str(item.get('vista', '')) for item in photo_data}
        missing_views = sorted(REQUIRED_PHOTO_VIEWS - valid_photo_views)
        if missing_views:
            raise ValueError(f'Fotos sem qualidade suficiente: {", ".join(missing_views)}')

        # Phase 1.5 — SMPL-X 3D circumferences + mesh export (Fase 2, optional)
        update_job(job_id, progress=25)
        smplx_analysis = _try_smplx_analysis(photo_data, estatura, sexo)
        smplx_circ = (
            smplx_analysis.get('circumferences')
            if smplx_analysis.get('circumference_ok')
            else None
        )
        smplx_volume_liters = (
            smplx_analysis.get('volume_liters')
            if smplx_analysis.get('volume_ok')
            else None
        )

        # Export GLB while raw mesh is still in memory; pop it to avoid serialising numpy arrays
        smplx_mesh_key: str | None = None
        raw_mesh = smplx_analysis.pop('_raw_mesh', None)
        if smplx_analysis.get('fit_ok') and raw_mesh is not None:
            evaluation_id = str(payload.get('evaluationId', ''))
            if evaluation_id:
                smplx_mesh_key = _export_smplx_glb(
                    evaluation_id,
                    raw_mesh['vertices'],
                    raw_mesh['faces'],
                )

        # Derive video scale from high-confidence ArUco photos (median of up to 4 values)
        aruco_px_values = [
            p['calibracao']['px_por_cm']
            for p in photo_data
            if p.get('calibracao', {}).get('metodo') == 'aruco'
            and p.get('calibracao', {}).get('confianca') == 'alta'
            and p.get('calibracao', {}).get('px_por_cm')
        ]
        video_px_por_cm: float | None = float(np.median(aruco_px_values)) if aruco_px_values else None

        # Phase 2 — 360° video (continuous angular coverage)
        update_job(job_id, progress=30)
        video_data: list[dict] = []
        coverage_ok = True
        video_calibracao: dict = {'metodo': 'nao_disponivel', 'confianca': 'baixa'}
        if video_capture:
            video_data, coverage_ok, video_calibracao = analyze_video(
                video_capture,
                estatura,
                sexo,
                video_px_por_cm
            )
        if not video_capture or len(video_data) < config.MIN_VIDEO_FRAMES:
            raise ValueError('Video 360 com poucos frames validos')
        if not coverage_ok:
            raise ValueError('Video 360 sem cobertura angular minima de 270 graus')

        # Phase 3 — Circumferences: SMPL-X 3D (se disponível) ou elipse 2D
        # Chest/thigh/calf always come from 2D ellipse (SMPL-X não os computa ainda)
        update_job(job_id, progress=75)
        circ_2d, waist_a, waist_b, waist_fit_rmse = _compute_circumferences(photo_data, video_data)
        chest_cm = circ_2d.get('chest')
        thigh_cm = circ_2d.get('thigh')
        calf_cm  = circ_2d.get('calf')

        # bilateral_legs: True when the frontal view used body parsing to
        # measure each leg independently (corrects frustum bilateral issue)
        frontal = next((dp for dp in photo_data if dp.get('vista') == 'frontal'), None)
        bilateral_legs = frontal is not None and frontal.get('leg_source') == 'body_parsing'

        # Granular SMPL-X / 2D fusion
        circ_fused, circ_sources, smplx_visibility = fuse_circumferences_with_sources(
            circ_2d, smplx_circ, photo_data
        )
        smplx_levels_used = any(
            circ_sources.get(level) == 'smplx_3d'
            for level in ('neck', 'waist', 'hip')
        )

        if smplx_levels_used:
            neck_cm  = circ_fused.get('neck')  or circ_2d.get('neck')
            waist_cm = circ_fused.get('waist') or circ_2d.get('waist')
            hip_cm   = circ_fused.get('hip')   or circ_2d.get('hip')
            metodo_circ = 'smplx_3d'
        else:
            neck_cm  = circ_2d.get('neck')
            waist_cm = circ_2d.get('waist')
            hip_cm   = circ_2d.get('hip')
            metodo_circ = 'ellipse_polar_2d'

        if not waist_cm or not neck_cm:
            raise ValueError(
                f'Medidas insuficientes. '
                f'Fotos: {len(photo_data)}, frames de vídeo: {len(video_data)}'
            )

        scale_high_confidence = len(aruco_px_values) >= 3
        level_confidence: dict[str, str] = {}
        for level in ('neck', 'chest', 'waist', 'hip', 'thigh', 'calf'):
            has_value = circ_fused.get(level) is not None
            from_smplx = circ_sources.get(level) == 'smplx_3d'
            stable_ellipse = (
                scale_high_confidence
                and (level != 'waist' or waist_fit_rmse is None or waist_fit_rmse <= 1.5)
            )
            level_confidence[level] = 'alta' if has_value and (from_smplx or stable_ellipse) else 'baixa'

        # Phase 4 — Multi-formula body composition panel
        update_job(job_id, progress=90)
        formula = calc_body_composition(
            neck_cm=neck_cm,
            waist_cm=waist_cm,
            hip_cm=hip_cm,
            height_cm=estatura,
            peso_kg=peso,
            sexo=sexo,
            idade=idade,
            chest_cm=chest_cm,
            thigh_cm=thigh_cm,
            calf_cm=calf_cm,
            smplx_volume_liters=smplx_volume_liters,
            bilateral_legs=bilateral_legs,
            waist_a=waist_a,
            waist_b=waist_b,
            level_confidence=level_confidence,
            fitting_rmse_cm=waist_fit_rmse,
        )

        if formula.get('error') or formula.get('percGordura') is None:
            raise ValueError(formula.get('error', 'Composicao corporal nao calculavel'))

        if formula.get('formulas', {}).get('smplx_siri') is not None:
            metodo_circ = 'smplx_densitometrico'

        calibracao = _summarize_calibration(
            photo_data, video_calibracao, marker_size_cm, bool(aruco_px_values)
        )

        results = {
            **formula,
            'metodo': f'{metodo_circ}_ensemble_v2',
            'algorithmVersion': config.VERSAO_ALGORITMO,
            'versoes': {
                'instrumento': config.VERSAO_INSTRUMENTO,
                'algoritmo':   config.VERSAO_ALGORITMO,
                'protocolo':   config.VERSAO_PROTOCOLO,
                'regra_idade': 'adulto_19_83_sem_fallback_v1',
            },
            'measurements': {
                'neck_cm':  round(neck_cm, 1),
                'chest_cm': round(chest_cm, 1) if chest_cm else None,
                'waist_cm': round(waist_cm, 1),
                'hip_cm':   round(hip_cm, 1)   if hip_cm   else None,
                'thigh_cm': round(thigh_cm, 1) if thigh_cm else None,
                'calf_cm':  round(calf_cm, 1)  if calf_cm  else None,
                'waist_ellipse': {
                    'a_cm': waist_a,   # profundidade (AP)
                    'b_cm': waist_b,   # largura (lateral)
                } if waist_a and waist_b else None,
            },
            'smplx_mesh_key': smplx_mesh_key,
            'sources': {
                'photos_processed':      len(photo_data),
                'video_frames_processed': len(video_data),
                'video_coverage_ok':     coverage_ok,
                'bilateral_legs':        bilateral_legs,
                'waist_fit_rmse_cm':     waist_fit_rmse,
                'leg_source': frontal.get('leg_source', 'mediapipe') if frontal else 'mediapipe',
                'circumference_sources': circ_sources,
                'smplx_visibility':       smplx_visibility,
                'level_confidence':       level_confidence,
                'smplx':                  smplx_analysis,
                'idade_anos':             idade,
                'idade_origem':           idade_origem,
                'idade_referencia_em':    anthropometry.get('idadeReferenciaEm'),
            },
            'calibracao': calibracao,
        }

        update_job(job_id, status='concluida', progress=100, results=results)

    except Exception as exc:
        update_job(job_id, status='falha', progress=0, error=str(exc))
    finally:
        for path in temporary_paths:
            try:
                os.unlink(path)
            except OSError:
                pass


def start_pipeline_thread(job_id: str, payload: dict) -> bool:
    if not _pending_slots.acquire(blocking=False):
        return False
    future = _executor.submit(run_pipeline, job_id, payload)
    future.add_done_callback(lambda _future: _pending_slots.release())
    return True
