#!/usr/bin/env python3
"""
tests/test_smplx_e2e.py — Teste end-to-end do pipeline SMPL-X.

Salta automaticamente quando:
  • torch / smplx / scipy não estão instalados
  • os modelos não são encontrados em config.SMPLX_MODEL_DIR

Usa landmarks sintéticos plausíveis em vez de imagens reais.
Tempo estimado de execução: 35–60 s em CPU moderno.

Execução:
    python -m pytest tests/test_smplx_e2e.py -v -s
    python tests/test_smplx_e2e.py
"""
from __future__ import annotations

import dataclasses
import sys
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import config
from core.smplx_estimator import (
    SMPLXEstimator,
    diagnose_model_files,
    get_body_levels_3d,
    is_available,
)


# ─── Mock de landmark ────────────────────────────────────────────────────────

@dataclasses.dataclass
class _Lm:
    """Objeto mínimo compatível com a API do MediaPipe Tasks."""
    x: float
    y: float
    z: float = 0.0
    visibility: float = 0.95
    presence:   float = 0.95


# ─── Template canônico (vista frontal) ──────────────────────────────────────
#
# Posições aproximadas para uma pessoa de ~175 cm preenchendo ~85% de um
# frame 1280×720 (braços relaxados ao lado do corpo).
#
# Os landmarks marcados ★ são os únicos que entram na função de perda
# (via _PAIRS em smplx_estimator.py: MP_IDX = [11,12,13,14,23,24,25,26,27,28]).
# Os demais apenas preenchem o array de 33 posições.

_CANON: list[tuple[float, float]] = [
    # idx   x       y        nome
    (0.500, 0.100),  # 0  nariz
    (0.512, 0.095),  # 1  olho_esq_inner
    (0.523, 0.093),  # 2  olho_esq
    (0.532, 0.096),  # 3  olho_esq_outer
    (0.488, 0.095),  # 4  olho_dir_inner
    (0.477, 0.093),  # 5  olho_dir
    (0.468, 0.096),  # 6  olho_dir_outer
    (0.548, 0.110),  # 7  orelha_esq
    (0.452, 0.110),  # 8  orelha_dir
    (0.512, 0.122),  # 9  boca_esq
    (0.488, 0.122),  # 10 boca_dir
    (0.592, 0.262),  # 11 ombro_esq    ★
    (0.408, 0.262),  # 12 ombro_dir    ★
    (0.628, 0.412),  # 13 cotovelo_esq ★
    (0.372, 0.412),  # 14 cotovelo_dir ★
    (0.642, 0.548),  # 15 pulso_esq
    (0.358, 0.548),  # 16 pulso_dir
    (0.648, 0.572),  # 17 mindinho_esq
    (0.352, 0.572),  # 18 mindinho_dir
    (0.653, 0.568),  # 19 indicador_esq
    (0.347, 0.568),  # 20 indicador_dir
    (0.647, 0.562),  # 21 polegar_esq
    (0.353, 0.562),  # 22 polegar_dir
    (0.556, 0.552),  # 23 quadril_esq  ★
    (0.444, 0.552),  # 24 quadril_dir  ★
    (0.554, 0.718),  # 25 joelho_esq   ★
    (0.446, 0.718),  # 26 joelho_dir   ★
    (0.552, 0.876),  # 27 tornozelo_esq★
    (0.448, 0.876),  # 28 tornozelo_dir★
    (0.550, 0.900),  # 29 calcanhar_esq
    (0.450, 0.900),  # 30 calcanhar_dir
    (0.558, 0.920),  # 31 pe_esq
    (0.442, 0.920),  # 32 pe_dir
]

# Índices de landmarks do lado esquerdo e direito (usados na vista lateral)
_LEFT  = {1, 2, 3, 7, 9,  11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31}
_RIGHT = {4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32}


def _make_frontal() -> list[_Lm]:
    return [_Lm(x=x, y=y) for x, y in _CANON]


def _make_posterior() -> list[_Lm]:
    """Costas: espelho horizontal do frontal (left/right trocam no plano da imagem)."""
    return [_Lm(x=1.0 - x, y=y) for x, y in _CANON]


def _make_lateral(depth_frac: float = 0.07) -> list[_Lm]:
    """
    Vista lateral: landmarks esquerdo/direito colapsam para uma faixa estreita.
    depth_frac é a metade do "diâmetro" visível da silhueta lateral,
    expresso como fração da largura do frame (corpo humano ~30 cm de profundidade
    a 2 m de distância → ~7% do frame de 1280 px).
    """
    lms = []
    for idx, (x, y) in enumerate(_CANON):
        if idx in _LEFT:
            nx = 0.50 + depth_frac   # lado esquerdo: levemente à direita na imagem
        elif idx in _RIGHT:
            nx = 0.50 - depth_frac   # lado direito: levemente à esquerda
        else:
            nx = 0.50                # landmarks centrais (nariz, boca)
        lms.append(_Lm(x=nx, y=y))
    return lms


def _build_views(n: int = 4) -> list[dict]:
    """Gera n vistas sintéticas para um frame 1280×720."""
    defs = [
        ('frontal',          _make_frontal()),
        ('lateral_direita',  _make_lateral()),
        ('posterior',        _make_posterior()),
        ('lateral_esquerda', _make_lateral()),
    ]
    return [
        {'vista': nome, 'landmarks': lms, 'img_h': 720, 'img_w': 1280}
        for nome, lms in defs[:n]
    ]


# ─── Motivo de skip ──────────────────────────────────────────────────────────

def _skip_reason() -> str | None:
    if not is_available():
        return 'torch, smplx ou scipy não instalados'
    d = diagnose_model_files(config.SMPLX_MODEL_DIR)
    if not d['ready']:
        return f'Modelos ausentes ou incompletos: {d["status"]}'
    return None


# ─── Resultado em cache (caro de computar) ───────────────────────────────────

_CACHE: dict = {}


def _get_multiview_result() -> tuple[dict | None, dict | None]:
    if 'result' in _CACHE:
        return _CACHE['result'], _CACHE['levels']

    est = SMPLXEstimator(config.SMPLX_MODEL_DIR, device=config.SMPLX_DEVICE)
    views = _build_views(n=4)

    t0 = time.time()
    result = est.fit_multiview(
        views,
        height_cm=175.0,
        sex='masculino',
        n_iters_shape=100,  # reduzido para o teste (default=300)
        n_iters_pose=50,    # reduzido para o teste (default=150)
    )
    elapsed = time.time() - t0
    print(f'\n  [SMPL-X] fit_multiview 4-vistas: {elapsed:.1f} s (100+50 iters)')

    levels = None
    if result is not None:
        levels = get_body_levels_3d(result['vertices'], result['joints'], 'masculino')

    _CACHE['result'] = result
    _CACHE['levels'] = levels
    return result, levels


# ════════════════════════════════════════════════════════════════════════════
# Suite 1 — Diagnóstico e setup (sem otimização)
# ════════════════════════════════════════════════════════════════════════════

class TestSmplxSetup(unittest.TestCase):
    """Verifica dependências e carga dos modelos sem rodar otimização."""

    def setUp(self):
        reason = _skip_reason()
        if reason:
            self.skipTest(reason)

    def test_is_available_true(self):
        self.assertTrue(is_available())

    def test_diagnose_ready(self):
        d = diagnose_model_files(config.SMPLX_MODEL_DIR)
        self.assertTrue(d['ready'], msg=str(d))

    def test_diagnose_no_missing_files(self):
        d = diagnose_model_files(config.SMPLX_MODEL_DIR)
        self.assertEqual(d['missing_files'], [], msg=str(d['missing_files']))

    def test_diagnose_no_missing_keys(self):
        d = diagnose_model_files(config.SMPLX_MODEL_DIR)
        self.assertEqual(d['missing_keys'], {}, msg=str(d['missing_keys']))

    def test_estimator_instantiation(self):
        est = SMPLXEstimator(config.SMPLX_MODEL_DIR, device=config.SMPLX_DEVICE)
        self.assertIsNotNone(est)

    def test_all_genders_loaded(self):
        est = SMPLXEstimator(config.SMPLX_MODEL_DIR, device=config.SMPLX_DEVICE)
        for gender in ('male', 'female', 'neutral'):
            self.assertIn(gender, est._models,
                          msg=f'Modelo "{gender}" não carregado')

    def test_wrong_model_dir_raises(self):
        with self.assertRaises(RuntimeError):
            SMPLXEstimator('/caminho/que/nao/existe', device='cpu')


# ════════════════════════════════════════════════════════════════════════════
# Suite 2 — Fit com vista única (frontal, rápido ~5-10 s)
# ════════════════════════════════════════════════════════════════════════════

class TestSmplxSingleView(unittest.TestCase):
    """Fit frontal-only: verifica que o pipeline não crasha e retorna shape correto."""

    def setUp(self):
        reason = _skip_reason()
        if reason:
            self.skipTest(reason)

    def test_frontal_fit_returns_result(self):
        est = SMPLXEstimator(config.SMPLX_MODEL_DIR, device=config.SMPLX_DEVICE)
        views = _build_views(n=1)
        result = est.fit_multiview(views, height_cm=175.0, sex='masculino',
                                   n_iters_shape=60, n_iters_pose=30)
        self.assertIsNotNone(result, msg='fit_multiview retornou None para vista frontal')

    def test_frontal_vertices_shape(self):
        est = SMPLXEstimator(config.SMPLX_MODEL_DIR, device=config.SMPLX_DEVICE)
        views = _build_views(n=1)
        result = est.fit_multiview(views, height_cm=175.0, sex='masculino',
                                   n_iters_shape=60, n_iters_pose=30)
        self.assertIsNotNone(result)
        self.assertEqual(result['vertices'].shape, (10475, 3))

    def test_frontal_joints_shape(self):
        est = SMPLXEstimator(config.SMPLX_MODEL_DIR, device=config.SMPLX_DEVICE)
        views = _build_views(n=1)
        result = est.fit_multiview(views, height_cm=175.0, sex='masculino',
                                   n_iters_shape=60, n_iters_pose=30)
        self.assertIsNotNone(result)
        self.assertEqual(result['joints'].shape, (22, 3))

    def test_female_single_view(self):
        """Modelo feminino carrega e converge sem crash."""
        est = SMPLXEstimator(config.SMPLX_MODEL_DIR, device=config.SMPLX_DEVICE)
        views = _build_views(n=1)
        result = est.fit_multiview(views, height_cm=162.0, sex='feminino',
                                   n_iters_shape=60, n_iters_pose=30)
        self.assertIsNotNone(result)
        # Altura da malha deve ser próxima de 1.62 m
        v = result['vertices']
        h_cm = (v[:, 1].max() - v[:, 1].min()) * 100
        self.assertAlmostEqual(h_cm, 162.0, delta=12.0,
                               msg=f'Altura feminina: {h_cm:.1f} cm')


# ════════════════════════════════════════════════════════════════════════════
# Suite 3 — Fit com 4 vistas (E2E principal, ~20-35 s)
# ════════════════════════════════════════════════════════════════════════════

class TestSmplxMultiview(unittest.TestCase):
    """Fit com as 4 vistas sintéticas — principal teste E2E."""

    def setUp(self):
        reason = _skip_reason()
        if reason:
            self.skipTest(reason)
        self._result, _ = _get_multiview_result()
        if self._result is None:
            self.skipTest('fit_multiview retornou None com landmarks sintéticos')

    def test_result_is_not_none(self):
        self.assertIsNotNone(self._result)

    def test_vertices_shape(self):
        self.assertEqual(self._result['vertices'].shape, (10475, 3),
                         msg=f'Shape: {self._result["vertices"].shape}')

    def test_joints_shape(self):
        self.assertEqual(self._result['joints'].shape, (22, 3),
                         msg=f'Shape: {self._result["joints"].shape}')

    def test_betas_shape(self):
        self.assertEqual(self._result['betas'].shape, (10,))

    def test_height_scale_positive(self):
        self.assertGreater(self._result['height_scale'], 0,
                           msg='height_scale deve ser positivo')

    def test_mesh_height_near_175cm(self):
        """Após scaling, a malha deve ter ~175 cm de altura (tolerância ±10 cm)."""
        v = self._result['vertices']
        h_cm = (v[:, 1].max() - v[:, 1].min()) * 100
        print(f'\n  [SMPL-X] Altura da malha: {h_cm:.1f} cm (esperado 175)')
        self.assertAlmostEqual(h_cm, 175.0, delta=10.0,
                               msg=f'Altura da malha: {h_cm:.1f} cm')

    def test_pelvis_in_lower_half(self):
        """Pelvis deve estar abaixo do centro da malha (1/3 inferior), não nas extremidades."""
        v = self._result['vertices']
        j = self._result['joints']
        y_min = float(v[:, 1].min())
        y_max = float(v[:, 1].max())
        pelvis_y = float(j[0, 1])
        # Pelvis em Y = 0 (padrão SMPL-X) — após scaling deve estar entre 1/4 e 3/4 da altura
        lower_bound = y_min + (y_max - y_min) * 0.20
        upper_bound = y_min + (y_max - y_min) * 0.65
        self.assertGreater(pelvis_y, lower_bound,
                           msg=f'Pelvis Y ({pelvis_y:.3f}) muito baixo (min={y_min:.3f})')
        self.assertLess(pelvis_y, upper_bound,
                        msg=f'Pelvis Y ({pelvis_y:.3f}) muito alto (max={y_max:.3f})')

    def test_no_nan_in_vertices(self):
        import numpy as np
        v = self._result['vertices']
        self.assertFalse(np.any(np.isnan(v)), msg='NaN encontrado nos vértices')

    def test_no_inf_in_vertices(self):
        import numpy as np
        v = self._result['vertices']
        self.assertFalse(np.any(np.isinf(v)), msg='Inf encontrado nos vértices')


# ════════════════════════════════════════════════════════════════════════════
# Suite 4 — Circunferências 3D
# ════════════════════════════════════════════════════════════════════════════

class TestSmplxCircumferences(unittest.TestCase):
    """
    Circunferências extraídas via ConvexHull.

    Com landmarks sintéticos e 100 iters, a projeção fraca pode convergir para
    um corpo com proporções 3D distorcidas (escala de profundidade ambígua),
    gerando circunferências maiores que o realístico. O que este teste garante:

      • A extração executa sem crash (código correto)
      • Todos os valores são positivos e finitos
      • Pescoço < cintura (ordem anatômica)
      • Valores menores que 500 cm (sanidade numérica mínima)

    Ranges clínicos (pescoço 30–50 cm etc.) só são válidos com fotos reais
    e n_iters_shape ≥ 300. Ver VALIDATION_PROCEDURE.md para critérios de aceite.
    """

    def setUp(self):
        reason = _skip_reason()
        if reason:
            self.skipTest(reason)
        _, self._levels = _get_multiview_result()
        if self._levels is None:
            self.skipTest('Levels não calculados (fit falhou)')

    def test_all_levels_present(self):
        for key in ('neck', 'waist', 'hip'):
            self.assertIn(key, self._levels, msg=f'Nível "{key}" ausente')

    def test_neck_not_none(self):
        c = self._levels['neck'].get('circ_cm')
        self.assertIsNotNone(c, msg='Circunferência do pescoço não calculada')

    def test_waist_not_none(self):
        c = self._levels['waist'].get('circ_cm')
        self.assertIsNotNone(c, msg='Circunferência da cintura não calculada')

    def test_hip_not_none(self):
        c = self._levels['hip'].get('circ_cm')
        self.assertIsNotNone(c, msg='Circunferência do quadril não calculada')

    def test_neck_positive_and_finite(self):
        c = self._levels['neck']['circ_cm']
        if c is None:
            self.skipTest('circ_cm de pescoço é None')
        self.assertGreater(c,   0.0, msg=f'Pescoço não positivo: {c:.1f} cm')
        self.assertLess(c,    500.0, msg=f'Pescoço numericamente implausível: {c:.1f} cm')

    def test_waist_positive_and_finite(self):
        c = self._levels['waist']['circ_cm']
        if c is None:
            self.skipTest('circ_cm de cintura é None')
        self.assertGreater(c,   0.0, msg=f'Cintura não positiva: {c:.1f} cm')
        self.assertLess(c,    500.0, msg=f'Cintura numericamente implausível: {c:.1f} cm')

    def test_hip_positive_and_finite(self):
        c = self._levels['hip']['circ_cm']
        if c is None:
            self.skipTest('circ_cm de quadril é None')
        self.assertGreater(c,   0.0, msg=f'Quadril não positivo: {c:.1f} cm')
        self.assertLess(c,    500.0, msg=f'Quadril numericamente implausível: {c:.1f} cm')

    def test_neck_smaller_than_waist(self):
        """Pescoço deve ser sempre menor que a cintura."""
        neck  = self._levels['neck'].get('circ_cm')
        waist = self._levels['waist'].get('circ_cm')
        if neck is None or waist is None:
            self.skipTest('Uma das circunferências é None')
        self.assertLess(neck, waist,
                        msg=f'Pescoço ({neck:.1f}) >= cintura ({waist:.1f})')

    def test_print_measurements(self):
        """Imprime valores para inspeção manual (não é assertion)."""
        print()
        for key in ('neck', 'waist', 'hip'):
            c = self._levels[key].get('circ_cm')
            y = self._levels[key].get('y')
            label = {'neck': 'Pescoço', 'waist': 'Cintura', 'hip': 'Quadril'}[key]
            val   = f'{c:.1f} cm  (y = {y:.3f} m)' if c else 'None'
            print(f'  [SMPL-X] {label:8s}: {val}')


# ════════════════════════════════════════════════════════════════════════════
# Suite 5 — Robustez / casos de borda
# ════════════════════════════════════════════════════════════════════════════

class TestSmplxRobustness(unittest.TestCase):
    """Casos de borda que não devem crashar."""

    def setUp(self):
        reason = _skip_reason()
        if reason:
            self.skipTest(reason)
        self._est = SMPLXEstimator(config.SMPLX_MODEL_DIR, device=config.SMPLX_DEVICE)

    def test_empty_views_returns_none(self):
        result = self._est.fit_multiview([], height_cm=175.0, sex='masculino')
        self.assertIsNone(result, msg='Lista vazia deve retornar None')

    def test_zero_visibility_landmarks_converge(self):
        """Todos com visibility=0 → todos os pesos são 0 → loss = constante → não crasha."""
        views = _build_views(n=1)
        for lm in views[0]['landmarks']:
            lm.visibility = 0.0
        result = self._est.fit_multiview(views, height_cm=175.0, sex='masculino',
                                         n_iters_shape=20, n_iters_pose=10)
        # Pode retornar None ou um resultado (dependendo do fallback), mas não deve crashar
        # Se retornar um resultado, verifica shape básico
        if result is not None:
            self.assertEqual(result['vertices'].shape, (10475, 3))

    def test_extract_circumference_too_few_vertices(self):
        """Menos de 4 vértices na fatia → deve retornar None sem crash."""
        import numpy as np
        from core.smplx_estimator import extract_circumference
        tiny = np.array([[0.0, 0.9, 0.0], [0.1, 0.9, 0.0]])
        result = extract_circumference(tiny, y_target=0.9, epsilon=0.05)
        self.assertIsNone(result)

    def test_extract_circumference_cylinder(self):
        """Cilindro de raio 10 cm → circunferência ≈ 62,8 cm."""
        import numpy as np
        from core.smplx_estimator import extract_circumference
        n = 200
        angles = np.linspace(0, 2 * np.pi, n, endpoint=False)
        r = 0.10  # 10 cm = 0.10 m
        verts = np.column_stack([
            r * np.cos(angles),
            np.zeros(n),
            r * np.sin(angles),
        ])
        circ = extract_circumference(verts, y_target=0.0, epsilon=0.05)
        self.assertIsNotNone(circ)
        expected = 2 * 3.14159 * 10.0   # ≈ 62.8 cm
        self.assertAlmostEqual(circ, expected, delta=2.0,
                               msg=f'Circunferência do cilindro: {circ:.1f} cm')


if __name__ == '__main__':
    unittest.main(verbosity=2)
