#!/usr/bin/env python3
"""
capture.py — Captura guiada LAINES v2

Sequência:
  1. Dados do atleta via terminal (estatura, peso, sexo)
  2. 4 fotos: frente, lado direito, costas, lado esquerdo
     → feedback em tempo real: posição, distância, visibilidade do corpo
  3. Vídeo de 360° (~20 segundos)
  4. Tela de resultado com grid de fotos

Controles (janela da câmera):
  SPACE  — capturar quando estiver pronto (ou forçar se não estiver)
  R      — repetir a captura atual
  Q/ESC  — sair

Saída:
  captures/<YYYYMMDD_HHMMSS>/
    frontal.jpg  lateral_direita.jpg  posterior.jpg  lateral_esquerda.jpg
    video_360.mp4
    manifest.json
"""
from __future__ import annotations

import argparse
import dataclasses
import datetime
import json
import queue
import sys
import threading
import time
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

try:
    import pyttsx3 as _pyttsx3
    _PYTTSX3_OK = True
except ImportError:
    _PYTTSX3_OK = False

# ────────────────────────────────────────────────────────────────────────────
# Passos de captura
# ────────────────────────────────────────────────────────────────────────────

FOTO_STEPS = [
    {
        'vista':    'frontal',
        'label':    'FRENTE  (1 / 4)',
        'instrucao': [
            'Fique de frente para a camara',
            'Bracos relaxados ao longo do corpo',
            'Corpo inteiro visivel — da cabeca aos pes',
        ],
    },
    {
        'vista':    'lateral_direita',
        'label':    'LADO DIREITO  (2 / 4)',
        'instrucao': [
            'Gire 90 graus para a sua DIREITA',
            'Perfil direito voltado para a camara',
            'Bracos ao longo do corpo, sem cruzar',
        ],
    },
    {
        'vista':    'posterior',
        'label':    'COSTAS  (3 / 4)',
        'instrucao': [
            'Fique de COSTAS para a camara',
            'Bracos relaxados ao longo do corpo',
            'Corpo inteiro visivel — da cabeca aos pes',
        ],
    },
    {
        'vista':    'lateral_esquerda',
        'label':    'LADO ESQUERDO  (4 / 4)',
        'instrucao': [
            'Gire 90 graus para a sua ESQUERDA',
            'Perfil esquerdo voltado para a camara',
            'Bracos ao longo do corpo, sem cruzar',
        ],
    },
]

# ────────────────────────────────────────────────────────────────────────────
# Constantes
# ────────────────────────────────────────────────────────────────────────────

VIDEO_DURATION_S  = 20
PHOTO_COUNTDOWN_S = 3
VIDEO_COUNTDOWN_S = 5
MIN_VISIBILITY    = 0.50
# Landmarks críticos: nariz, ombros, quadris, tornozelos
KEY_LANDMARKS = [0, 11, 12, 23, 24, 27, 28]

# Faixa de altura relativa ideal (corpo ocupa 65-88% do frame)
IDEAL_HEIGHT_MIN = 0.65
IDEAL_HEIGHT_MAX = 0.88

# Paleta BGR
C_GREEN  = ( 70, 210,  80)
C_YELLOW = ( 30, 210, 230)
C_RED    = ( 55,  55, 220)
C_WHITE  = (240, 240, 240)
C_GRAY   = (130, 130, 130)
C_DARK   = ( 22,  22,  30)
C_ACCENT = (190, 160,  40)  # teal-gold para hints
C_PANEL  = ( 28,  28,  40)  # fundo dos painéis

_FONT   = cv2.FONT_HERSHEY_SIMPLEX
_WINDOW = 'LAINES — Captura'

# ────────────────────────────────────────────────────────────────────────────
# Status de pose em tempo real
# ────────────────────────────────────────────────────────────────────────────

@dataclasses.dataclass
class PoseStatus:
    detected:      bool = False
    distance:      str  = 'unknown'   # muito_longe | longe | ideal | perto | muito_perto
    landmarks_ok:  bool = False

    @property
    def ready(self) -> bool:
        return self.detected and self.distance == 'ideal' and self.landmarks_ok

    @property
    def border_color(self) -> tuple:
        if self.ready:
            return C_GREEN
        if self.detected:
            return C_YELLOW
        return C_RED

    @property
    def status_text(self) -> str:
        if not self.detected:
            return 'POSICIONE-SE NO CENTRO DA CAMARA'
        m = {
            'muito_longe':  'APROXIME-SE MAIS  (muito longe)',
            'longe':        'UM POUCO MAIS PERTO',
            'muito_perto':  'AFASTE-SE MAIS  (muito perto)',
            'perto':        'UM POUCO MAIS LONGE',
        }
        if self.distance in m:
            return m[self.distance]
        if not self.landmarks_ok:
            return 'GARANTA QUE O CORPO INTEIRO ESTEJA VISIVEL'
        return 'PRONTO PARA CAPTURAR'

    @property
    def status_color(self) -> tuple:
        return C_GREEN if self.ready else (C_YELLOW if self.detected else C_RED)


class PoseChecker:
    """
    Detecta pose em tempo real (a cada N frames) e classifica
    distância e visibilidade do corpo.
    """
    def __init__(self, check_every: int = 8) -> None:
        self._pose = mp.solutions.pose.Pose(
            static_image_mode=False,
            model_complexity=0,
            smooth_landmarks=True,
            min_detection_confidence=0.45,
            min_tracking_confidence=0.40,
        )
        self._every  = check_every
        self._n      = 0
        self._status = PoseStatus()

    def update(self, frame: np.ndarray) -> PoseStatus:
        self._n += 1
        if self._n % self._every != 0:
            return self._status

        rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = self._pose.process(rgb)

        if not result.pose_landmarks:
            self._status = PoseStatus(detected=False)
            return self._status

        lm = result.pose_landmarks.landmark

        # Altura relativa (nariz → tornozelo)
        nose_y = lm[0].y
        heel_y = max(lm[29].y, lm[30].y)
        h_ratio = heel_y - nose_y

        if   h_ratio < 0.45: dist = 'muito_longe'
        elif h_ratio < IDEAL_HEIGHT_MIN: dist = 'longe'
        elif h_ratio > 0.94: dist = 'muito_perto'
        elif h_ratio > IDEAL_HEIGHT_MAX: dist = 'perto'
        else:                dist = 'ideal'

        invisible    = sum(1 for i in KEY_LANDMARKS if lm[i].visibility < MIN_VISIBILITY)
        lm_ok        = invisible <= 1

        self._status = PoseStatus(detected=True, distance=dist, landmarks_ok=lm_ok)
        return self._status

    def close(self) -> None:
        self._pose.close()


# ────────────────────────────────────────────────────────────────────────────
# Audio feedback (TTS)
# ────────────────────────────────────────────────────────────────────────────

_STATUS_PHRASES: dict[str, str] = {
    'not_detected': 'Posicione-se em frente a camera',
    'muito_longe':  'Aproxime-se mais',
    'longe':        'Um pouco mais perto',
    'muito_perto':  'Afaste-se mais',
    'perto':        'Um pouco mais longe',
    'lm_not_ok':    'Garanta que o corpo inteiro esteja visivel',
    'ready':        'Perfeito. Nao se mova.',
}

_STEP_NEXT_PHRASE = [
    'Agora gire noventa graus para a sua direita',
    'Agora fique de costas para a camera',
    'Agora gire para o lado esquerdo',
]


class Speaker:
    """TTS assincrono com debounce — guia o sujeito sem depender da tela."""

    _COOLDOWN = 4.0

    def __init__(self, rate: int = 155, volume: float = 0.95) -> None:
        self._q: queue.Queue[str | None] = queue.Queue()
        self._last_key  = ''
        self._last_time = 0.0
        self._active    = _PYTTSX3_OK
        if not self._active:
            return
        self._thread = threading.Thread(target=self._worker,
                                        args=(rate, volume), daemon=True)
        self._thread.start()

    def _worker(self, rate: int, volume: float) -> None:
        try:
            engine = _pyttsx3.init()
            engine.setProperty('rate', rate)
            engine.setProperty('volume', volume)
            for v in engine.getProperty('voices'):
                vid = v.id.lower()
                if any(k in vid for k in ('brazil', 'portuguese', 'pt-br', 'pt_br')):
                    engine.setProperty('voice', v.id)
                    break
            while True:
                phrase = self._q.get()
                if phrase is None:
                    break
                engine.say(phrase)
                engine.runAndWait()
        except Exception:
            pass

    def say(self, key: str, phrase: str, cooldown: float | None = None) -> None:
        if not self._active:
            return
        now = time.time()
        cd  = self._COOLDOWN if cooldown is None else cooldown
        if key == self._last_key and now - self._last_time < cd:
            return
        self._last_key  = key
        self._last_time = now
        # Descarta frase pendente — mantém fila rasa
        while not self._q.empty():
            try:
                self._q.get_nowait()
            except queue.Empty:
                break
        self._q.put(phrase)

    def close(self) -> None:
        if not self._active:
            return
        self._q.put(None)
        self._thread.join(timeout=3.0)


_speaker: 'Speaker | None' = None


def _say(key: str, phrase: str, cooldown: float = 4.0) -> None:
    if _speaker is not None:
        _speaker.say(key, phrase, cooldown)


def _say_status(status: PoseStatus) -> None:
    if not status.detected:
        _say('not_detected', _STATUS_PHRASES['not_detected'])
    elif status.distance in _STATUS_PHRASES:
        _say(status.distance, _STATUS_PHRASES[status.distance])
    elif not status.landmarks_ok:
        _say('lm_not_ok', _STATUS_PHRASES['lm_not_ok'])
    elif status.ready:
        _say('ready', _STATUS_PHRASES['ready'], cooldown=8.0)


# ────────────────────────────────────────────────────────────────────────────
# Helpers de desenho
# ────────────────────────────────────────────────────────────────────────────

def _shadow_text(img: np.ndarray, text: str, org: tuple, scale: float,
                 color: tuple, thick: int = 1) -> None:
    cv2.putText(img, text, (org[0]+1, org[1]+1), _FONT, scale, (0,0,0), thick+1)
    cv2.putText(img, text, org,                  _FONT, scale, color,   thick)


def _centered_text(img: np.ndarray, text: str, y: int, scale: float,
                   color: tuple, thick: int = 1) -> None:
    (tw, _), _ = cv2.getTextSize(text, _FONT, scale, thick)
    x = (img.shape[1] - tw) // 2
    _shadow_text(img, text, (x, y), scale, color, thick)


def _dashed_line(img: np.ndarray, pt1: tuple, pt2: tuple,
                 color: tuple, thick: int = 1, dash: int = 12, gap: int = 8) -> None:
    x1, y1, x2, y2 = pt1[0], pt1[1], pt2[0], pt2[1]
    dist = max(abs(x2-x1), abs(y2-y1), 1)
    dx, dy = (x2-x1)/dist, (y2-y1)/dist
    i = 0.0
    while i < dist:
        s = (int(x1+i*dx), int(y1+i*dy))
        e = (int(x1+min(i+dash, dist)*dx), int(y1+min(i+dash, dist)*dy))
        cv2.line(img, s, e, color, thick)
        i += dash + gap


def _draw_alignment_guide(frame: np.ndarray, status: PoseStatus) -> None:
    """Silhueta guia central com feedback de cor."""
    h, w = frame.shape[:2]
    cx   = w // 2
    color = status.border_color
    alpha = 0.45 if not status.ready else 0.55

    ov = frame.copy()
    gw = int(w * 0.28)
    gy1, gy2 = int(h * 0.04), int(h * 0.91)

    # Cabeça
    head_r  = int(gw * 0.26)
    head_cy = gy1 + head_r + 4
    cv2.circle(ov, (cx, head_cy), head_r, color, 2)

    # Corpo
    body_y1 = head_cy + head_r + 2
    wx = gw // 2
    # ombros
    cv2.line(ov, (cx-wx, body_y1), (cx+wx, body_y1), color, 2)
    # cintura (mais estreita)
    waist_y = int(body_y1 + (gy2 - body_y1) * 0.42)
    waist_x = int(wx * 0.72)
    # laterais do torso
    cv2.line(ov, (cx-wx,    body_y1), (cx-waist_x, waist_y), color, 2)
    cv2.line(ov, (cx+wx,    body_y1), (cx+waist_x, waist_y), color, 2)
    # quadril
    hip_y = int(body_y1 + (gy2 - body_y1) * 0.55)
    hip_x = int(wx * 0.88)
    cv2.line(ov, (cx-waist_x, waist_y), (cx-hip_x, hip_y), color, 2)
    cv2.line(ov, (cx+waist_x, waist_y), (cx+hip_x, hip_y), color, 2)
    cv2.line(ov, (cx-hip_x, hip_y), (cx+hip_x, hip_y), color, 2)
    # pernas
    cv2.line(ov, (cx-hip_x, hip_y), (cx-int(wx*0.55), gy2), color, 2)
    cv2.line(ov, (cx+hip_x, hip_y), (cx+int(wx*0.55), gy2), color, 2)
    cv2.line(ov, (cx-int(wx*0.55), gy2), (cx+int(wx*0.55), gy2), color, 2)

    # Linha central tracejada (sutil)
    _dashed_line(ov, (cx, gy1), (cx, gy2), tuple(c//3 for c in color), 1)

    cv2.addWeighted(ov, alpha, frame, 1-alpha, 0, frame)


def _draw_indicators(frame: np.ndarray, status: PoseStatus) -> None:
    """3 círculos indicadores no canto superior direito."""
    h, w = frame.shape[:2]
    checks = [
        (status.detected,     'Corpo'),
        (status.distance == 'ideal', 'Distancia'),
        (status.landmarks_ok, 'Visibl.'),
    ]
    x0, y0 = w - 160, 70
    for i, (ok, label) in enumerate(checks):
        y = y0 + i * 38
        col = C_GREEN if ok else C_RED
        cv2.circle(frame, (x0, y), 9, col, -1)
        cv2.circle(frame, (x0, y), 9, C_WHITE, 1)
        _shadow_text(frame, label, (x0+18, y+5), 0.45, C_WHITE, 1)


def _draw_header(frame: np.ndarray, label: str, step_idx: int) -> None:
    h, w = frame.shape[:2]
    cv2.rectangle(frame, (0, 0), (w, 52), C_PANEL, -1)
    cv2.line(frame, (0, 52), (w, 52), C_ACCENT, 1)

    # Bolinhas de progresso
    dot_r, gap = 7, 22
    total_w = len(FOTO_STEPS) * (2*dot_r + gap) - gap
    sx = (w - total_w) // 2
    for i in range(len(FOTO_STEPS)):
        cx = sx + i * (2*dot_r + gap) + dot_r
        col = C_GREEN if i < step_idx else (C_WHITE if i == step_idx else C_GRAY)
        cv2.circle(frame, (cx, 26), dot_r, col, -1 if i <= step_idx else 1)

    _centered_text(frame, label, 46, 0.70, C_YELLOW, 2)


def _draw_footer(frame: np.ndarray, lines: list[str], hint: str,
                 status: PoseStatus) -> None:
    h, w = frame.shape[:2]
    n = len(lines)
    bar_h = 28 + n * 26 + 30   # hint + n linhas + margem

    # Painel inferior
    ov = frame.copy()
    cv2.rectangle(ov, (0, h - bar_h), (w, h), C_PANEL, -1)
    cv2.addWeighted(ov, 0.82, frame, 0.18, 0, frame)
    cv2.line(frame, (0, h-bar_h), (w, h-bar_h), C_ACCENT, 1)

    # Status (centro-superior do painel)
    st = status.status_text
    _centered_text(frame, st, h - bar_h + 28, 0.65, status.status_color, 2)

    # Linhas de instrução
    for i, line in enumerate(lines):
        _centered_text(frame, line, h - bar_h + 28 + (i+1)*26, 0.48, C_WHITE, 1)

    # Hint de teclas
    _centered_text(frame, hint, h - 12, 0.40, C_ACCENT, 1)


def _draw_border(frame: np.ndarray, color: tuple, thick: int = 5) -> None:
    h, w = frame.shape[:2]
    cv2.rectangle(frame, (0, 0), (w-1, h-1), color, thick)


def _draw_countdown_arc(frame: np.ndarray, remaining: float,
                        total: float, number: int) -> None:
    h, w = frame.shape[:2]
    cx, cy, r = w//2, h//2, 90
    # Sombra
    cv2.circle(frame, (cx+2, cy+2), r, (0,0,0), -1)
    # Fundo
    cv2.circle(frame, (cx, cy), r, (50, 50, 65), -1)
    # Arco de progresso
    angle = int(360 * (1.0 - remaining / max(total, 0.01)))
    col   = C_GREEN if remaining > 1 else C_YELLOW
    cv2.ellipse(frame, (cx, cy), (r-5, r-5), -90, 0, angle, col, 10)
    # Número
    text = str(number)
    sc   = 2.8
    tk   = 5
    (tw, th), _ = cv2.getTextSize(text, _FONT, sc, tk)
    _shadow_text(frame, text, (cx - tw//2, cy + th//2), sc, C_WHITE, tk)


def _draw_video_recording(frame: np.ndarray, elapsed: float, total: float) -> None:
    h, w = frame.shape[:2]

    # Barra de progresso
    bx, bw, bh = 24, w-48, 18
    by = h - 46
    cv2.rectangle(frame, (bx, by), (bx+bw, by+bh), (50,50,65), -1)
    filled = int(bw * min(elapsed/total, 1.0))
    cv2.rectangle(frame, (bx, by), (bx+filled, by+bh), C_GREEN, -1)
    cv2.rectangle(frame, (bx, by), (bx+bw, by+bh), C_WHITE, 1)

    remaining = max(0.0, total - elapsed)
    timer = f'GRAVANDO  {int(elapsed):02d} / {int(total):02d} s   restam {int(remaining):02d} s'
    _centered_text(frame, timer, h - 56, 0.58, C_RED, 2)
    _centered_text(frame, '[SPACE] Parar antes    [Q] Cancelar', h-10, 0.40, C_ACCENT, 1)

    # Seta de rotação (guia visual)
    ax, ay = w//2, h//2 + 60
    cv2.ellipse(frame, (ax, ay), (55, 22), 0, 10, 320, C_YELLOW, 2)
    # ponta da seta
    cv2.arrowedLine(frame, (ax+40, ay-18), (ax+55, ay-10), C_YELLOW, 2, tipLength=0.5)
    _centered_text(frame, 'Gire 360 graus lentamente', h//2 + 102, 0.55, C_YELLOW, 1)

    # REC dot
    blink = int(elapsed * 2) % 2 == 0
    if blink:
        cv2.circle(frame, (22, 22), 10, C_RED, -1)
    cv2.putText(frame, 'REC', (38, 30), _FONT, 0.60, C_RED, 2)


# ────────────────────────────────────────────────────────────────────────────
# Coleta de dados do atleta
# ────────────────────────────────────────────────────────────────────────────

def _input_anthropometry() -> dict:
    print('\n' + '='*44)
    print('  LAINES — Captura guiada de composicao corporal')
    print('='*44 + '\n')
    print('Informe os dados do atleta:\n')

    while True:
        try:
            v = input('  Estatura  (cm)  [ex: 175.0]: ').strip().replace(',', '.')
            estatura = float(v)
            if not 100 <= estatura <= 250:
                raise ValueError
            break
        except ValueError:
            print('  Valor invalido. Informe entre 100 e 250 cm.\n')

    while True:
        try:
            v = input('  Peso      (kg)  [ex:  75.0]: ').strip().replace(',', '.')
            peso = float(v)
            if not 20 <= peso <= 350:
                raise ValueError
            break
        except ValueError:
            print('  Valor invalido. Informe entre 20 e 350 kg.\n')

    while True:
        v = input('  Sexo  (M / F)  [ex: M]:      ').strip().upper()
        if v in ('M', 'F'):
            break
        print('  Digite M para masculino ou F para feminino.\n')

    while True:
        try:
            vi = input('  Idade     (anos) [ex:  25]:  ').strip()
            idade = int(vi)
            if not 10 <= idade <= 100:
                raise ValueError
            break
        except ValueError:
            print('  Valor invalido. Informe entre 10 e 100 anos.\n')

    nome = input('  Nome do atleta  (opcional):  ').strip() or 'Atleta'

    return {
        'nome':     nome,
        'estatura': estatura,
        'peso':     peso,
        'sexo':     'masculino' if v == 'M' else 'feminino',
        'idade':    idade,
    }


# ────────────────────────────────────────────────────────────────────────────
# Helpers de câmera e janela
# ────────────────────────────────────────────────────────────────────────────

def _read_flip(cap: cv2.VideoCapture) -> np.ndarray | None:
    ret, frame = cap.read()
    return cv2.flip(frame, 1) if ret else None


def _window_open() -> bool:
    try:
        return cv2.getWindowProperty(_WINDOW, cv2.WND_PROP_VISIBLE) >= 1
    except Exception:
        return False


def _open_writer(path: Path, fps: float, w: int, h: int) -> tuple[cv2.VideoWriter | None, Path]:
    """Tenta mp4v → XVID, retorna (writer, path_final) ou (None, path)."""
    for fourcc_str, ext in [('mp4v', '.mp4'), ('XVID', '.avi'), ('MJPG', '.avi')]:
        p = path.with_suffix(ext)
        writer = cv2.VideoWriter(str(p), cv2.VideoWriter_fourcc(*fourcc_str), fps, (w, h))
        if writer.isOpened():
            return writer, p
    return None, path


# ────────────────────────────────────────────────────────────────────────────
# Validação pós-captura
# ────────────────────────────────────────────────────────────────────────────

def _validate_photo(image_path: str) -> tuple[bool, str]:
    img = cv2.imread(image_path)
    if img is None:
        return False, 'Arquivo corrompido'

    h = img.shape[0]
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    with mp.solutions.pose.Pose(static_image_mode=True, model_complexity=0,
                                 min_detection_confidence=0.4) as pose:
        result = pose.process(rgb)

    if not result.pose_landmarks:
        return False, 'Corpo nao detectado — reposicione-se'

    lm = result.pose_landmarks.landmark
    invisible = [i for i in KEY_LANDMARKS if lm[i].visibility < MIN_VISIBILITY]
    if len(invisible) > 2:
        return False, f'{len(invisible)} pontos-chave invisiveis — ajuste a posicao'

    nose_y = lm[0].y * h
    heel_y = max(lm[29].y, lm[30].y) * h
    body_h = heel_y - nose_y
    if body_h < h * 0.40:
        return False, 'Afaste-se da camara — corpo ocupa menos de 40% do quadro'

    return True, 'OK'


# ────────────────────────────────────────────────────────────────────────────
# Fluxo de captura de foto
# ────────────────────────────────────────────────────────────────────────────

def _preview_loop(cap: cv2.VideoCapture, checker: PoseChecker,
                  step: dict, step_idx: int,
                  force_allowed: bool = False) -> np.ndarray | None:
    """
    Loop de preview com feedback em tempo real.
    Retorna o frame capturado, ou None se o usuário sair.
    Se force_allowed=True, SPACE captura mesmo sem estar pronto.
    """
    label    = step['label']
    lines    = step['instrucao']
    hint_ok  = '[SPACE] Capturar    [Q] Sair'
    hint_nok = '[SPACE] Capturar mesmo assim    [Q] Sair'

    while True:
        if not _window_open():
            return None
        frame = _read_flip(cap)
        if frame is None:
            return None

        status = checker.update(frame)
        _say_status(status)

        _draw_alignment_guide(frame, status)
        _draw_header(frame, label, step_idx)
        _draw_indicators(frame, status)
        _draw_footer(frame, lines,
                     hint_ok if status.ready else hint_nok,
                     status)
        _draw_border(frame, status.border_color, thick=4)

        cv2.imshow(_WINDOW, frame)
        key = cv2.waitKey(30) & 0xFF

        if key in (ord('q'), 27):
            return None

        if key == ord(' '):
            if status.ready or force_allowed:
                return _read_flip(cap)  # captura frame limpo (sem overlay)
            # Não está pronto: avisa e permite segunda pressão
            force_allowed = True

        if key == ord('r'):
            force_allowed = False   # reset força


def _countdown(cap: cv2.VideoCapture, checker: PoseChecker,
               step: dict, step_idx: int, seconds: int) -> np.ndarray | None:
    label = step['label']
    lines = step['instrucao']
    _say('countdown_hold', 'Fique quieto', cooldown=0.0)

    for i in range(seconds, 0, -1):
        deadline = time.time() + 1.0
        frac_start = (seconds - i) / seconds
        while time.time() < deadline:
            if not _window_open():
                return None
            frame = _read_flip(cap)
            if frame is None:
                return None

            status = checker.update(frame)
            _draw_alignment_guide(frame, status)
            _draw_header(frame, label, step_idx)
            _draw_footer(frame, lines, '', status)
            _draw_border(frame, status.border_color, thick=4)

            remaining = deadline - time.time()
            _draw_countdown_arc(frame, remaining + (seconds - i), seconds, i)

            cv2.imshow(_WINDOW, frame)
            if cv2.waitKey(30) & 0xFF in (ord('q'), 27):
                return None

    return _read_flip(cap)


def _capture_photo_step(cap: cv2.VideoCapture, checker: PoseChecker,
                         step: dict, step_idx: int,
                         out_path: Path, no_validate: bool = False) -> bool:
    label = step['label']
    lines = step['instrucao']

    while True:
        # ── Preview com feedback em tempo real ───────────────────────────────
        frame = _preview_loop(cap, checker, step, step_idx)
        if frame is None:
            return False

        # ── Contagem regressiva ───────────────────────────────────────────────
        frame = _countdown(cap, checker, step, step_idx, PHOTO_COUNTDOWN_S)
        if frame is None:
            return False

        # ── Capturar (sem overlay, sem flip) ─────────────────────────────────
        # Lê diretamente para salvar a imagem não espelhada
        ret, raw = cap.read()
        if not ret:
            return False
        cv2.imwrite(str(out_path), raw, [cv2.IMWRITE_JPEG_QUALITY, 95])

        # ── Validação ─────────────────────────────────────────────────────────
        if no_validate:
            ok, msg = True, 'ok'
        else:
            ok, msg = _validate_photo(str(out_path))

        if ok:
            _say('foto_aceita', 'Foto aceita', cooldown=0.0)
            # Confirmação visual 2 s
            t = time.time()
            while time.time() - t < 2.0:
                f = _read_flip(cap)
                if f is None:
                    break
                _draw_alignment_guide(f, PoseStatus(detected=True, distance='ideal', landmarks_ok=True))
                _draw_header(f, label, step_idx)
                _draw_footer(f, lines, '', PoseStatus(detected=True, distance='ideal', landmarks_ok=True))
                _centered_text(f, 'FOTO ACEITA !', f.shape[0]//2, 1.4, C_GREEN, 3)
                _draw_border(f, C_GREEN, thick=8)
                cv2.imshow(_WINDOW, f)
                cv2.waitKey(30)
            return True

        # ── Validação falhou ──────────────────────────────────────────────────
        _say('foto_falha', f'Problema. {msg}', cooldown=0.0)
        hint_fail = '[R] Repetir    [SPACE] Aceitar assim mesmo    [Q] Sair'
        fail_status = PoseStatus(detected=False)
        while True:
            if not _window_open():
                return False
            f = _read_flip(cap)
            if f is None:
                return False
            _draw_header(f, label, step_idx)
            _draw_footer(f, lines, hint_fail, fail_status)
            _centered_text(f, f'PROBLEMA: {msg}', f.shape[0]//2, 0.65, C_RED, 2)
            _draw_border(f, C_RED, thick=4)
            cv2.imshow(_WINDOW, f)
            key = cv2.waitKey(30) & 0xFF
            if key == ord('r'):
                break             # retake
            if key == ord(' '):
                return True       # aceitar com aviso
            if key in (ord('q'), 27):
                return False


# ────────────────────────────────────────────────────────────────────────────
# Fluxo de captura de vídeo
# ────────────────────────────────────────────────────────────────────────────

def _capture_video_step(cap: cv2.VideoCapture, out_path: Path) -> tuple[bool, Path]:
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    w   = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h_  = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    video_label = 'VIDEO 360 graus  (5 / 5)'
    video_lines = [
        'Posicione-se de FRENTE para a camara',
        'SPACE para iniciar — gire 360 graus lentamente',
        'A gravacao para automaticamente em 20 segundos',
    ]
    wait_status = PoseStatus(detected=True, distance='ideal', landmarks_ok=True)

    # ── Aguardar SPACE ───────────────────────────────────────────────────────
    _say('video_prepare',
         'Posicione-se de frente para a camera e pressione espaco para iniciar o video',
         cooldown=30.0)
    checker = PoseChecker()
    while True:
        if not _window_open():
            checker.close()
            return False, out_path
        frame = _read_flip(cap)
        if frame is None:
            checker.close()
            return False, out_path

        status = checker.update(frame)
        _draw_alignment_guide(frame, status)
        _draw_header(frame, video_label, len(FOTO_STEPS))
        _draw_indicators(frame, status)
        _draw_footer(frame, video_lines, '[SPACE] Iniciar gravacao    [Q] Sair', status)
        _draw_border(frame, status.border_color, thick=4)
        cv2.imshow(_WINDOW, frame)

        key = cv2.waitKey(30) & 0xFF
        if key == ord(' '):
            _say('video_ready', 'Prepare-se para girar', cooldown=0.0)
            break
        if key in (ord('q'), 27):
            checker.close()
            return False, out_path
    checker.close()

    # ── Contagem regressiva ──────────────────────────────────────────────────
    step_video = {'label': video_label,
                  'instrucao': ['Prepare-se para girar 360 graus lentamente']}
    checker2 = PoseChecker()
    for i in range(VIDEO_COUNTDOWN_S, 0, -1):
        deadline = time.time() + 1.0
        while time.time() < deadline:
            frame = _read_flip(cap)
            if frame is None:
                checker2.close()
                return False, out_path
            st = checker2.update(frame)
            _draw_alignment_guide(frame, st)
            _draw_header(frame, video_label, len(FOTO_STEPS))
            _draw_footer(frame, step_video['instrucao'], '', st)
            _draw_border(frame, st.border_color, thick=4)
            remaining = deadline - time.time()
            _draw_countdown_arc(frame, remaining + (VIDEO_COUNTDOWN_S - i), VIDEO_COUNTDOWN_S, i)
            cv2.imshow(_WINDOW, frame)
            if cv2.waitKey(30) & 0xFF in (ord('q'), 27):
                checker2.close()
                return False, out_path
    checker2.close()

    # ── Gravar ───────────────────────────────────────────────────────────────
    writer, final_path = _open_writer(out_path, fps, w, h_)
    if writer is None:
        print('\nErro: nao foi possivel criar arquivo de video.', file=sys.stderr)
        return False, out_path

    _say('video_gire', 'Pode comecar a girar lentamente', cooldown=0.0)
    t0 = time.time()
    elapsed = 0.0
    while True:
        ret, raw = cap.read()
        if not ret:
            break
        elapsed = time.time() - t0
        writer.write(raw)   # grava sem flip (não espelhado)

        frame = cv2.flip(raw, 1)
        _draw_video_recording(frame, elapsed, VIDEO_DURATION_S)
        cv2.imshow(_WINDOW, frame)
        key = cv2.waitKey(1) & 0xFF

        if elapsed >= VIDEO_DURATION_S:
            break
        if key == ord(' '):
            break
        if key in (ord('q'), 27):
            writer.release()
            return False, final_path

    writer.release()
    _say('video_done', 'Video salvo com sucesso', cooldown=0.0)

    # ── Confirmação visual ────────────────────────────────────────────────────
    t = time.time()
    while time.time() - t < 2.5:
        f = _read_flip(cap)
        if f is None:
            break
        _draw_header(f, video_label, len(FOTO_STEPS))
        _centered_text(f, f'VIDEO SALVO  ({int(elapsed)} s gravados)', f.shape[0]//2, 0.85, C_GREEN, 2)
        _draw_border(f, C_GREEN, thick=8)
        cv2.imshow(_WINDOW, f)
        cv2.waitKey(30)

    return True, final_path


# ────────────────────────────────────────────────────────────────────────────
# Tela de boas-vindas
# ────────────────────────────────────────────────────────────────────────────

def _show_welcome(cap: cv2.VideoCapture, anthro: dict) -> bool:
    _say('welcome',
         'Posicione-se a dois metros da camera e pressione espaco para iniciar',
         cooldown=30.0)
    lines = [
        ('LAINES  —  Avaliacao de Composicao Corporal', 0.22, 1.0, C_YELLOW, 2),
        (f'Atleta: {anthro["nome"]}', 0.36, 0.70, C_WHITE, 1),
        (f'Estatura: {anthro["estatura"]} cm    Peso: {anthro["peso"]} kg    '
         f'Idade: {anthro.get("idade", "?")} anos    Sexo: {anthro["sexo"].capitalize()}',
         0.45, 0.58, C_WHITE, 1),
        ('Serao capturadas  4 fotos  +  1 video de 360 graus', 0.56, 0.58, C_GRAY, 1),
        ('Posicione-se a aproximadamente 2 metros da camara', 0.63, 0.55, C_GRAY, 1),
        ('[SPACE] Iniciar sessao    [Q] Sair', 0.78, 0.72, C_GREEN, 2),
    ]
    while True:
        if not _window_open():
            return False
        frame = _read_flip(cap)
        if frame is None:
            return False
        h, w = frame.shape[:2]
        ov = frame.copy()
        cv2.rectangle(ov, (0, 0), (w, h), C_DARK, -1)
        cv2.addWeighted(ov, 0.60, frame, 0.40, 0, frame)
        cv2.line(frame, (0, 52), (w, 52), C_ACCENT, 1)
        cv2.rectangle(frame, (0, 0), (w, 52), C_PANEL, -1)
        cv2.putText(frame, 'LAINES', (16, 36), _FONT, 0.80, C_ACCENT, 2)
        for text, yr, sc, col, tk in lines:
            _centered_text(frame, text, int(h * yr), sc, col, tk)
        cv2.imshow(_WINDOW, frame)
        key = cv2.waitKey(30) & 0xFF
        if key == ord(' '):
            return True
        if key in (ord('q'), 27):
            return False


# ────────────────────────────────────────────────────────────────────────────
# Tela de resultado
# ────────────────────────────────────────────────────────────────────────────

def _show_results(anthro: dict, captured_files: dict, out_dir: Path,
                  duration_s: float) -> None:
    W, H = 1280, 720
    canvas = np.full((H, W, 3), C_DARK, dtype=np.uint8)

    # Header
    cv2.rectangle(canvas, (0, 0), (W, 58), C_PANEL, -1)
    cv2.line(canvas, (0, 58), (W, 58), C_GREEN, 2)
    _centered_text(canvas, 'SESSAO CONCLUIDA  —  TODOS OS ARQUIVOS SALVOS', 40, 0.75, C_GREEN, 2)

    # Grid de fotos (lado esquerdo ~820px)
    labels_pt = {
        'frontal':           'FRENTE',
        'lateral_direita':   'LADO DIR.',
        'posterior':         'COSTAS',
        'lateral_esquerda':  'LADO ESQ.',
    }
    thumb_w, thumb_h = 380, 275
    positions = [(12, 68), (408, 68), (12, 380), (408, 380)]

    for step, (px, py) in zip(FOTO_STEPS, positions):
        v    = step['vista']
        path = captured_files.get(v)
        # Fundo do thumb
        cv2.rectangle(canvas, (px, py), (px+thumb_w, py+thumb_h), C_PANEL, -1)
        if path:
            img = cv2.imread(path)
            if img is not None:
                thumb = cv2.resize(img, (thumb_w, thumb_h))
                canvas[py:py+thumb_h, px:px+thumb_w] = thumb
        # Borda
        cv2.rectangle(canvas, (px, py), (px+thumb_w, py+thumb_h), C_ACCENT, 1)
        # Label abaixo
        lbl = labels_pt.get(v, v.upper())
        cv2.putText(canvas, lbl, (px + 8, py + thumb_h + 20),
                    _FONT, 0.55, C_YELLOW, 1)

    # Painel direito
    rx = 812
    cv2.line(canvas, (rx-6, 68), (rx-6, H-40), C_ACCENT, 1)

    def rline(text: str, y: int, scale: float = 0.52,
              color: tuple = C_WHITE, thick: int = 1) -> None:
        cv2.putText(canvas, text, (rx+10, y), _FONT, scale, color, thick)

    rline('DADOS DO ATLETA', 100, 0.62, C_YELLOW, 2)
    rline(f'Nome:      {anthro["nome"]}',            135)
    rline(f'Estatura:  {anthro["estatura"]} cm',     162)
    rline(f'Peso:      {anthro["peso"]} kg',         189)
    rline(f'Sexo:      {anthro["sexo"].capitalize()}', 216)

    cv2.line(canvas, (rx+10, 232), (W-20, 232), (60,60,80), 1)
    rline('ARQUIVOS', 258, 0.62, C_YELLOW, 2)
    folder = str(out_dir)
    # quebra se longo
    if len(folder) > 38:
        folder = '...' + folder[-35:]
    rline(folder, 288, 0.44, C_ACCENT)
    for i, fname in enumerate(['frontal.jpg', 'lateral_direita.jpg',
                               'posterior.jpg', 'lateral_esquerda.jpg', 'video_360.mp4']):
        rline(f'  {fname}', 310 + i * 22, 0.42, C_WHITE)

    rline('manifest.json', 424, 0.44, C_GREEN)

    cv2.line(canvas, (rx+10, 440), (W-20, 440), (60,60,80), 1)
    rline('PROXIMOS PASSOS', 466, 0.62, C_YELLOW, 2)
    rline('1. Abra o sistema LAINES', 498, 0.48, C_WHITE)
    rline('2. Crie uma nova avaliacao', 524, 0.48, C_WHITE)
    rline('3. Carregue o manifest.json', 550, 0.48, C_WHITE)
    rline('4. O pipeline processara automaticamente', 576, 0.48, C_WHITE)

    cv2.line(canvas, (rx+10, 600), (W-20, 600), (60,60,80), 1)
    mins = int(duration_s // 60)
    secs = int(duration_s % 60)
    rline(f'Duracao da sessao: {mins}m {secs:02d}s', 628, 0.50, C_GRAY)

    # Footer
    cv2.rectangle(canvas, (0, H-38), (W, H), C_PANEL, -1)
    _centered_text(canvas, '[ENTER]  [SPACE]  ou qualquer tecla para fechar', H-12, 0.44, C_ACCENT, 1)

    win = 'LAINES — Resultado da Sessao'
    cv2.namedWindow(win, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(win, W, H)
    cv2.imshow(win, canvas)
    cv2.waitKey(0)
    cv2.destroyWindow(win)


# ────────────────────────────────────────────────────────────────────────────
# Ponto de entrada
# ────────────────────────────────────────────────────────────────────────────

def run(args: argparse.Namespace) -> int:
    global _speaker
    if not getattr(args, 'no_audio', False):
        _speaker = Speaker()
    anthro = _input_anthropometry()
    print(f'\n  {anthro["nome"]} | {anthro["estatura"]} cm | '
          f'{anthro["peso"]} kg | {anthro["sexo"]}\n')
    print('Abrindo camara...')

    cap = cv2.VideoCapture(args.camera, cv2.CAP_DSHOW)
    if not cap.isOpened():
        cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        print(f'Erro: camara {args.camera} nao encontrada.', file=sys.stderr)
        return 1

    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cv2.namedWindow(_WINDOW, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(_WINDOW, 1280, 720)

    ts      = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    out_dir = Path(args.output) / ts
    out_dir.mkdir(parents=True, exist_ok=True)
    t_start = time.time()

    # Boas-vindas
    if not _show_welcome(cap, anthro):
        cap.release()
        cv2.destroyAllWindows()
        return 0

    # Fotos
    captured_files: dict[str, str] = {}
    checker = PoseChecker()

    for idx, step in enumerate(FOTO_STEPS):
        path = out_dir / f'{step["vista"]}.jpg'
        ok   = _capture_photo_step(cap, checker, step, idx, path,
                                   no_validate=args.no_validate)
        if not ok:
            print('\nCaptura cancelada.')
            checker.close()
            cap.release()
            cv2.destroyAllWindows()
            return 0
        captured_files[step['vista']] = str(path)
        print(f'  ✓  {step["vista"]:22s}  →  {path.name}')
        if idx < len(_STEP_NEXT_PHRASE):
            _say(f'step_{idx + 1}', _STEP_NEXT_PHRASE[idx], cooldown=0.0)
        elif idx == len(FOTO_STEPS) - 1:
            _say('video_aviso', 'Otimo! Agora faremos o video de trezentos e sessenta graus', cooldown=0.0)

    checker.close()

    # Vídeo
    video_path = out_dir / 'video_360.mp4'
    ok, video_path = _capture_video_step(cap, video_path)
    if not ok:
        print('\nCaptura de video cancelada.')
        cap.release()
        cv2.destroyAllWindows()
        return 0
    captured_files['video_360'] = str(video_path)
    print(f'  ✓  video_360              →  {video_path.name}')

    cap.release()

    # Manifest
    manifest = {
        'captured_at':   datetime.datetime.now().isoformat(timespec='seconds'),
        'anthropometry': anthro,
        'output_dir':    str(out_dir),
        'files':         captured_files,
    }
    manifest_path = out_dir / 'manifest.json'
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2),
                              encoding='utf-8')

    duration = time.time() - t_start
    print(f'\n  Sessao concluida em {int(duration//60)}m {int(duration%60):02d}s')
    print(f'  Arquivos em: {out_dir}\n')

    # Tela de resultado
    _say('sessao_ok', 'Sessao concluida com sucesso', cooldown=0.0)
    _show_results(anthro, captured_files, out_dir, duration)
    cv2.destroyAllWindows()
    if _speaker:
        _speaker.close()
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Captura guiada LAINES — 4 fotos + video 360°',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument('--camera',      type=int, default=0,
                        help='Indice da camara (0 = padrao)')
    parser.add_argument('--output',      type=str, default='captures',
                        help='Diretorio de saida')
    parser.add_argument('--no-validate', action='store_true',
                        help='Ignorar validacao MediaPipe pos-captura')
    parser.add_argument('--no-audio', action='store_true',
                        help='Desativar feedback de audio (TTS via pyttsx3)')
    sys.exit(run(parser.parse_args()))


if __name__ == '__main__':
    main()
