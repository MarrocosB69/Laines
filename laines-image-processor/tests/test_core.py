import math
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import config
from core.calibration import _gaussian_smooth, find_waist_y, find_neck_y, find_hip_y, get_mask_width_at_row
from core.usnavy import calc_usnavy
from core.aruco_calibration import _side_lengths, detect_aruco_scale
from core import smplx_estimator


class CalibrationTests(unittest.TestCase):
    def test_smoothing_does_not_create_false_edge_minimum(self):
        smoothed = _gaussian_smooth(np.ones(100, dtype=float))
        self.assertTrue(np.allclose(smoothed, 1.0, atol=1e-8))

    def test_constant_torso_waist_is_not_forced_to_search_boundary(self):
        mask = np.zeros((200, 100), dtype=np.uint8)
        for y in range(70, 130):
            half_width = 18 + abs(y - 100) // 10
            mask[y, 50 - half_width:50 + half_width + 1] = 1
        waist_y = find_waist_y(mask, 50, 150)
        self.assertLessEqual(abs(waist_y - 100), 5)

    def test_width_uses_torso_segment_instead_of_separate_arms(self):
        mask = np.zeros((100, 120), dtype=np.uint8)
        mask[50, 10:20] = 1
        mask[50, 40:80] = 1
        mask[50, 100:110] = 1
        self.assertEqual(get_mask_width_at_row(mask, 50), 39.0)


class FindNeckYTests(unittest.TestCase):
    def test_finds_minimum_in_nose_to_shoulder_range(self):
        # Mask narrowest at y=30 (neck) between nose_y=10 and shoulder_y=60
        mask = np.zeros((100, 80), dtype=np.uint8)
        for y in range(5, 75):
            half = 20 + abs(y - 30) // 4  # minimum width at y=30
            mask[y, 40 - half:40 + half + 1] = 1
        result = find_neck_y(mask, nose_y=10.0, shoulder_y=60.0)
        # NECK_SCAN_TOP_RATIO=0.25: start=10+(60-10)*0.25=22
        # NECK_SCAN_BOTTOM_RATIO=0.85: end=10+(60-10)*0.85=52
        self.assertLessEqual(abs(result - 30), 4)

    def test_fallback_when_neck_region_too_thin(self):
        # Neck region has < NECK_MIN_VALID_PIXELS (5) mean width → use NECK_OFFSET_RATIO fallback
        mask = np.zeros((100, 80), dtype=np.uint8)
        for y in range(22, 53):
            mask[y, 40:42] = 1  # only 2 px wide — below threshold
        nose_y, shoulder_y = 10.0, 60.0
        result = find_neck_y(mask, nose_y=nose_y, shoulder_y=shoulder_y)
        expected = int(nose_y + (shoulder_y - nose_y) * config.NECK_OFFSET_RATIO)
        self.assertEqual(result, expected)


class FindHipYTests(unittest.TestCase):
    def test_finds_maximum_between_hip_joint_and_knee(self):
        # Mask widest at y=180 (gluteal area); hip_joint_y=150, knee_y=350
        mask = np.zeros((400, 120), dtype=np.uint8)
        for y in range(140, 320):
            half = 15 + max(0, 20 - abs(y - 180) // 4)
            mask[y, 60 - half:60 + half + 1] = 1
        result = find_hip_y(mask, hip_joint_y=150.0, knee_y=350.0)
        # HIP_SCAN_TOP_RATIO=1.0: start=int(150*1.0)=150
        # HIP_SCAN_BOTTOM_RATIO=0.6: end=int(150+(350-150)*0.6)=270
        self.assertLessEqual(abs(result - 180), 6)

    def test_fallback_when_no_foreground_pixels(self):
        mask = np.zeros((400, 120), dtype=np.uint8)
        result = find_hip_y(mask, hip_joint_y=150.0, knee_y=350.0)
        self.assertEqual(result, 150)


class UsNavyTests(unittest.TestCase):
    def test_female_requires_hip_measurement(self):
        result = calc_usnavy(32, 80, None, 165, 65, 'feminino')
        self.assertIn('error', result)
        self.assertIsNone(result['percGordura'])

    def test_valid_male_result_is_finite(self):
        result = calc_usnavy(40, 90, 100, 175, 80, 'masculino')
        self.assertNotIn('error', result)
        self.assertTrue(math.isfinite(result['percGordura']))


class ArucoSideLengthsTests(unittest.TestCase):
    """Unit tests for _side_lengths — no OpenCV aruco required."""

    def test_perfect_square_returns_equal_sides(self):
        """A 30 px axis-aligned square must have all 4 sides = 30 px."""
        side = 30.0
        corners = np.array([[
            [0.0, 0.0],
            [side, 0.0],
            [side, side],
            [0.0, side],
        ]])
        sides = _side_lengths(corners)
        self.assertEqual(len(sides), 4)
        np.testing.assert_allclose(sides, side, rtol=1e-6)

    def test_perfect_square_cv_ratio_near_zero(self):
        """A flat parallel marker has cv_ratio ≈ 0 → 'alta' confidence."""
        side = 30.0
        corners = np.array([[
            [0.0, 0.0], [side, 0.0], [side, side], [0.0, side],
        ]])
        sides = _side_lengths(corners)
        mean_side = float(np.mean(sides))
        cv_ratio = float(np.std(sides) / mean_side)
        self.assertLess(cv_ratio, 0.01)

    def test_px_por_cm_formula(self):
        """mean_side / marker_size_cm must equal the expected px/cm ratio."""
        side_px = 30.0
        marker_size_cm = 10.0
        corners = np.array([[
            [0.0, 0.0], [side_px, 0.0], [side_px, side_px], [0.0, side_px],
        ]])
        sides = _side_lengths(corners)
        mean_side = float(np.mean(sides))
        px_por_cm = mean_side / marker_size_cm
        self.assertAlmostEqual(px_por_cm, 3.0, places=5)

    def test_trapezoidal_corners_give_high_cv_ratio(self):
        """Perspective tilt (trapezoid) must produce cv_ratio > 0.15 → 'baixa'."""
        # Far side narrower than near side — simulates depth tilt
        corners = np.array([[
            [5.0, 0.0],    # top-left
            [35.0, 0.0],   # top-right  (near side: 30 px)
            [32.0, 20.0],  # bottom-right
            [8.0, 20.0],   # bottom-left (far side: 24 px)
        ]])
        sides = _side_lengths(corners)
        mean_side = float(np.mean(sides))
        cv_ratio = float(np.std(sides) / mean_side)
        self.assertGreater(cv_ratio, 0.15)


class ArucoDetectScaleTests(unittest.TestCase):
    """Tests for detect_aruco_scale — integration or graceful-degradation."""

    def test_blank_image_returns_nao_detectado(self):
        """An image with no marker must degrade gracefully."""
        import numpy as np
        blank = np.ones((400, 300, 3), dtype=np.uint8) * 200
        result = detect_aruco_scale(blank, marker_size_cm=10.0)
        self.assertEqual(result.get('metodo'), 'nao_detectado')

    def test_end_to_end_with_synthetic_marker(self):
        """Generate a real ArUco marker, verify px/cm and confidence."""
        try:
            import cv2
            dictionary = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
            side_px = 200
            img = np.ones((500, 500, 3), dtype=np.uint8) * 255
            marker_gray = cv2.aruco.generateImageMarker(dictionary, 0, side_px)
            img[150:350, 150:350] = cv2.cvtColor(marker_gray, cv2.COLOR_GRAY2BGR)
            marker_size_cm = 10.0  # 200 px → 10 cm means 20 px/cm
            result = detect_aruco_scale(img, marker_size_cm)
            if result.get('metodo') == 'nao_detectado':
                self.skipTest('opencv-contrib-python não disponível neste ambiente')
            self.assertEqual(result['metodo'], 'aruco')
            # Allow ±5% tolerance on px/cm (sub-pixel corner detection)
            expected = side_px / marker_size_cm
            self.assertAlmostEqual(result['px_por_cm'], expected, delta=expected * 0.05)
            self.assertEqual(result['confianca'], 'alta')
            self.assertLess(result['cv_ratio'], 0.15)
            self.assertEqual(len(result['lados_px']), 4)
        except (AttributeError, ImportError):
            self.skipTest('opencv-contrib-python não disponível neste ambiente')


def _scipy_available():
    try:
        from scipy.spatial import ConvexHull  # noqa: F401
        return True
    except ImportError:
        return False


class ExtractCircumferenceTests(unittest.TestCase):
    def setUp(self):
        if not _scipy_available():
            self.skipTest('scipy não instalado (dependência opcional da Fase 2)')

    def test_cylinder_circumference(self):
        """Cilindro de raio r → circunferência ≈ 2πr (com tolerância do convex hull)."""
        from core.smplx_estimator import extract_circumference
        angles = np.linspace(0, 2 * np.pi, 120, endpoint=False)
        r = 0.20  # 20 cm raio
        vertices = np.column_stack([r * np.cos(angles), np.zeros(120), r * np.sin(angles)])
        result = extract_circumference(vertices, y_target=0.0, epsilon=0.01)
        expected = 2 * math.pi * r * 100  # cm
        self.assertIsNotNone(result)
        self.assertAlmostEqual(result, expected, delta=expected * 0.05)

    def test_returns_none_when_too_few_vertices(self):
        from core.smplx_estimator import extract_circumference
        vertices = np.array([[0.0, 0.0, 0.0], [0.1, 0.0, 0.0]])
        self.assertIsNone(extract_circumference(vertices, y_target=0.0, epsilon=0.05))

    def test_returns_none_when_no_vertices_in_slice(self):
        from core.smplx_estimator import extract_circumference
        angles = np.linspace(0, 2 * np.pi, 60, endpoint=False)
        # Todos os vértices em y=1.0, y_target=0.0 com epsilon pequeno → sem interseção
        vertices = np.column_stack([np.cos(angles), np.ones(60), np.sin(angles)])
        self.assertIsNone(extract_circumference(vertices, y_target=0.0, epsilon=0.01))


class MeshVolumeTests(unittest.TestCase):
    def test_tetrahedron_volume_liters(self):
        from core.smplx_estimator import mesh_volume_liters
        vertices = np.array([
            [0.0, 0.0, 0.0],
            [1.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 1.0],
        ])
        faces = np.array([
            [0, 2, 1],
            [0, 1, 3],
            [0, 3, 2],
            [1, 2, 3],
        ])
        # Tetrahedron volume = 1/6 m3 = 166.666... liters.
        self.assertAlmostEqual(mesh_volume_liters(vertices, faces), 1000.0 / 6.0, places=4)

    def test_invalid_mesh_returns_none(self):
        from core.smplx_estimator import mesh_volume_liters
        self.assertIsNone(mesh_volume_liters(np.zeros((2, 3)), np.array([[0, 1, 2]])))


class SmplxDensitometryTests(unittest.TestCase):
    def test_smplx_volume_activates_siri_formula(self):
        from core.body_composition import calc_body_composition
        result = calc_body_composition(
            neck_cm=37.2,
            waist_cm=78.1,
            hip_cm=94.3,
            height_cm=183,
            peso_kg=87.1,
            sexo='masculino',
            idade=25,
            smplx_volume_liters=82.5,
        )
        self.assertIsNotNone(result['formulas']['smplx_siri'])
        self.assertEqual(result['densitometrico']['volume_smplx_L'], 82.5)
        self.assertGreaterEqual(result['ensemble_n'], 4)


class SmplxFusionTests(unittest.TestCase):
    def test_high_visibility_uses_smplx_for_core_levels(self):
        from pipeline import fuse_circumferences_with_sources

        class Landmark:
            def __init__(self, visibility: float):
                self.visibility = visibility

        photo_data = [{'_landmarks': [Landmark(0.95) for _ in range(33)]}]
        circ_2d = {
            'neck': 36.0, 'chest': 98.0, 'waist': 82.0,
            'hip': 96.0, 'thigh': 55.0, 'calf': 37.0,
        }
        circ_smplx = {'neck': 37.0, 'waist': 80.0, 'hip': 94.0}

        merged, sources, visibility = fuse_circumferences_with_sources(circ_2d, circ_smplx, photo_data)

        self.assertEqual(merged['neck'], 37.0)
        self.assertEqual(merged['waist'], 80.0)
        self.assertEqual(merged['hip'], 94.0)
        self.assertEqual(merged['chest'], 98.0)
        self.assertEqual(sources['waist'], 'smplx_3d')
        self.assertEqual(sources['chest'], 'ellipse_polar_2d')
        self.assertGreaterEqual(visibility['waist'], 0.9)


class GetBodyLevels3dTests(unittest.TestCase):
    def setUp(self):
        if not _scipy_available():
            self.skipTest('scipy não instalado (dependência opcional da Fase 2)')

    def _make_joints(self):
        joints = np.zeros((22, 3), dtype=float)
        joints[0]  = [0.0,   0.95, 0.0]
        joints[1]  = [-0.09, 0.93, 0.0]
        joints[2]  = [ 0.09, 0.93, 0.0]
        joints[4]  = [-0.09, 0.55, 0.0]
        joints[5]  = [ 0.09, 0.55, 0.0]
        joints[9]  = [0.0,   1.25, 0.0]
        joints[12] = [0.0,   1.47, 0.0]
        joints[13] = [-0.05, 1.40, 0.0]
        joints[14] = [ 0.05, 1.40, 0.0]
        return joints

    def _ring_vertices(self, y_levels: list[tuple[float, float]]) -> np.ndarray:
        angles = np.linspace(0, 2 * math.pi, 60, endpoint=False)
        rings = []
        for y, r in y_levels:
            rings.append(np.column_stack([r * np.cos(angles), np.full(60, y), r * np.sin(angles)]))
        return np.vstack(rings)

    def test_hip_level_is_near_joint(self):
        from core.smplx_estimator import get_body_levels_3d
        joints = self._make_joints()
        vertices = self._ring_vertices([
            (0.93, 0.18), (0.80, 0.15), (0.65, 0.12),
            (1.10, 0.14), (1.40, 0.06), (1.47, 0.07),
        ])
        levels = get_body_levels_3d(vertices, joints, sex='masculino')
        self.assertIsNotNone(levels['hip']['circ_cm'])
        hip_y = levels['hip']['y']
        self.assertGreaterEqual(hip_y, 0.55)   # acima do joelho
        self.assertLessEqual(hip_y, 0.95)      # abaixo do pelvis

    def test_returns_all_keys(self):
        from core.smplx_estimator import get_body_levels_3d
        joints = self._make_joints()
        vertices = self._ring_vertices([
            (1.47, 0.07), (1.40, 0.08), (0.93, 0.18), (1.10, 0.12), (0.80, 0.15),
        ])
        levels = get_body_levels_3d(vertices, joints, sex='feminino')
        for key in ('neck', 'waist', 'hip'):
            self.assertIn(key, levels)
            self.assertIn('y', levels[key])
            self.assertIn('circ_cm', levels[key])


class SMPLXModelDiagnosticsTests(unittest.TestCase):
    def test_normalize_model_dir_accepts_smplx_leaf_folder(self):
        with tempfile.TemporaryDirectory() as tmp:
            model_dir = Path(tmp) / 'models'
            leaf_dir = model_dir / 'smplx'
            leaf_dir.mkdir(parents=True)

            self.assertEqual(
                smplx_estimator.normalize_model_dir(str(leaf_dir)),
                str(model_dir),
            )

    def test_incomplete_npz_models_return_explicit_missing_keys(self):
        old_deps_ok = smplx_estimator._DEPS_OK
        old_scipy_ok = smplx_estimator._SCIPY_OK
        smplx_estimator._DEPS_OK = True
        smplx_estimator._SCIPY_OK = True

        try:
            with tempfile.TemporaryDirectory() as tmp:
                model_dir = Path(tmp) / 'models'
                smplx_dir = model_dir / 'smplx'
                smplx_dir.mkdir(parents=True)

                base_arrays = {
                    'J_regressor': np.zeros((1, 1)),
                    'f': np.zeros((1, 3)),
                    'kintree_table': np.zeros((2, 1)),
                    'posedirs': np.zeros((1, 1, 1)),
                    'shapedirs': np.zeros((1, 1, 1)),
                    'v_template': np.zeros((1, 3)),
                    'weights': np.zeros((1, 1)),
                }
                for filename in smplx_estimator._MODEL_FILENAMES:
                    np.savez(smplx_dir / filename, **base_arrays)

                diagnostics = smplx_estimator.diagnose_model_files(str(model_dir))

            self.assertFalse(diagnostics['ready'])
            self.assertEqual(diagnostics['status'], 'incomplete_models')
            self.assertIn('SMPLX_MALE.npz', diagnostics['missing_keys'])
            self.assertIn('hands_componentsl', diagnostics['missing_keys']['SMPLX_MALE.npz'])
            self.assertIn('lmk_faces_idx', diagnostics['missing_keys']['SMPLX_MALE.npz'])
            self.assertIn('incompletos', smplx_estimator.format_model_diagnostics(diagnostics))
        finally:
            smplx_estimator._DEPS_OK = old_deps_ok
            smplx_estimator._SCIPY_OK = old_scipy_ok


class ConfigDefaultsTests(unittest.TestCase):
    """Garante que os defaults de config.py batem com os valores que estavam hardcoded (Etapa 0)."""

    def test_photo_weight(self):
        self.assertEqual(config.PHOTO_WEIGHT, 2.0)

    def test_video_frame_weight(self):
        self.assertEqual(config.VIDEO_FRAME_WEIGHT, 1.0)

    def test_min_visibility(self):
        self.assertEqual(config.MIN_VISIBILITY, 0.6)

    def test_mask_threshold(self):
        self.assertEqual(config.MASK_THRESHOLD, 0.5)

    def test_min_angle_step_deg(self):
        self.assertEqual(config.MIN_ANGLE_STEP_DEG, 3.0)

    def test_target_fps(self):
        self.assertEqual(config.TARGET_FPS, 10)

    def test_min_coverage_deg(self):
        self.assertEqual(config.MIN_COVERAGE_DEG, 270.0)

    def test_min_video_frames(self):
        self.assertEqual(config.MIN_VIDEO_FRAMES, 12)

    def test_waist_search_bounds(self):
        self.assertEqual(config.WAIST_SEARCH_START, 0.20)
        self.assertEqual(config.WAIST_SEARCH_END, 0.80)

    def test_waist_smooth_sigma(self):
        self.assertEqual(config.WAIST_SMOOTH_SIGMA, 3.0)

    def test_neck_offset_ratio(self):
        self.assertEqual(config.NECK_OFFSET_RATIO, 0.70)

    def test_head_top_ratio(self):
        self.assertEqual(config.HEAD_TOP_RATIO, 0.60)

    def test_aruco_cv_threshold(self):
        self.assertEqual(config.ARUCO_CV_THRESHOLD, 0.15)

    def test_aruco_min_side_px(self):
        self.assertEqual(config.ARUCO_MIN_SIDE_PX, 10.0)

    def test_versao_algoritmo(self):
        self.assertEqual(config.VERSAO_ALGORITMO, '2.1.1')
        self.assertNotEqual(config.VERSAO_ALGORITMO, '2.0.0')  # Historicos anteriores seguem identificaveis.

    def test_versao_instrumento(self):
        self.assertEqual(config.VERSAO_INSTRUMENTO, 'laines-v1.0')

    def test_versao_protocolo(self):
        self.assertEqual(config.VERSAO_PROTOCOLO, 'quatro_vistas_rgb_v1')

    def test_neck_scan_ratios(self):
        self.assertEqual(config.NECK_SCAN_TOP_RATIO, 0.25)
        self.assertEqual(config.NECK_SCAN_BOTTOM_RATIO, 0.85)

    def test_neck_min_valid_pixels(self):
        self.assertEqual(config.NECK_MIN_VALID_PIXELS, 5.0)

    def test_hip_scan_ratios(self):
        self.assertEqual(config.HIP_SCAN_TOP_RATIO, 1.0)
        self.assertEqual(config.HIP_SCAN_BOTTOM_RATIO, 0.6)

    def test_waist_navel_ratio(self):
        self.assertEqual(config.WAIST_NAVEL_RATIO, 0.78)

    def test_smplx_model_dir_points_to_models_parent(self):
        self.assertEqual(Path(config.SMPLX_MODEL_DIR).name, 'models')


class ProcessorRequestContractTests(unittest.TestCase):
    def test_job_request_preserves_age_provenance_for_pipeline(self):
        import uuid
        from main import JobRequest
        from core.body_composition import calc_body_composition

        views = ('frontal', 'lateral_direita', 'posterior', 'lateral_esquerda', 'video_360')
        request = JobRequest.model_validate({
            'evaluationId': str(uuid.uuid4()),
            'anthropometry': {
                'peso': 70,
                'estatura': 175,
                'sexo': 'masculino',
                'idade': 31,
                'idadeOrigem': 'paciente.dataNascimento',
                'idadeReferenciaEm': '2026-09-28',
            },
            'captures': [
                {
                    'captureId': str(uuid.uuid4()),
                    'vista': view,
                    'mimeType': 'video/webm' if view == 'video_360' else 'image/jpeg',
                    'source': {'type': 'url', 'url': 'https://example.test/capture'},
                }
                for view in views
            ],
        })

        anthropometry = request.anthropometry.model_dump()
        self.assertEqual(anthropometry['idade'], 31)
        self.assertEqual(anthropometry['idadeOrigem'], 'paciente.dataNascimento')
        self.assertEqual(anthropometry['idadeReferenciaEm'], '2026-09-28')
        result = calc_body_composition(
            neck_cm=38, waist_cm=86, hip_cm=95,
            height_cm=anthropometry['estatura'], peso_kg=anthropometry['peso'],
            sexo=anthropometry['sexo'], idade=anthropometry['idade'],
        )
        self.assertIsNotNone(result['formulas']['deurenberg'])


if __name__ == '__main__':
    unittest.main()
