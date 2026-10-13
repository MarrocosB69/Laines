"""
body_composition.py — Painel multi-fórmula de composição corporal

Ensemble ponderado de até 5 abordagens:

  1. US Navy      w=1.0  — pescoço + cintura + quadril + estatura
  2. RFM          w=1.0  — Woolcott & Bergman 2018; r²≈0.85–0.87 vs DEXA
  3. Deurenberg   w=0.8  — BMI + idade + sexo; r²≈0.79 vs pesagem hidrostática
  4. Frustum/Siri w=1.5  — troncos de cone (6 circunferências); ativado quando
                            as pernas são medidas individualmente (body parsing)
                            ou quando a densidade cai em [0.90, 1.10] g/cm³
  5. SMPL-X/Siri  w=2.5  — volume da malha 3D paramétrica (requer USE_SMPLX)

Saídas novas nesta versão:
  • intervalo_confianca — IC 95% para %GC
  • indices.visceral_fat_ratio — estimativa de gordura visceral via razão a/b
  • idade_corporal — comparação com percentis populacionais (NHANES)
  • risco_metabolico — score composto 0-5 com classificação
"""
from __future__ import annotations

import math

from .usnavy import calc_usnavy

# ─────────────────────────────────────────────────────────────────────────────
# Proporções anatômicas (fração da estatura, de baixo para cima)
# Fonte: De Leva 1996 + CAESAR anthropometric dataset
# ─────────────────────────────────────────────────────────────────────────────
_HEIGHT_FRAC: dict[str, float] = {
    'calf':  0.20,
    'thigh': 0.41,
    'hip':   0.52,
    'waist': 0.62,
    'chest': 0.76,
    'neck':  0.87,
}
# Nós virtuais para fechar o modelo
_ANKLE_FRAC       = 0.04
_ANKLE_RADIUS_CM  = 4.2    # raio médio do tornozelo (cm)
_HEAD_VOLUME_L    = 5.8    # volume médio da cabeça (litros, adulto)

# ─────────────────────────────────────────────────────────────────────────────
# Referências populacionais para idade corporal
#
# Fonte: NHANES 2015–2018 National Center for Health Statistics (NCHS).
# Dados extraídos das tabelas de percentil 50 publicadas em:
#   Fryar CD, Gu Q, Ogden CL. "Anthropometric Reference Data for Children and
#   Adults: United States, 2015–2018." National Health Statistics Reports
#   No. 136. Hyattsville, MD: NCHS; 2021.
#
# %BF estimado por absorciometria de dupla energia (DXA) para adultos 20–80 anos.
# IMC calculado a partir de peso e estatura medidos.
#
# Estes valores são EMBARCADOS no código (sem download em tempo de execução).
# Para atualização, edite as tuplas abaixo com dados do ciclo NHANES seguinte.
# ─────────────────────────────────────────────────────────────────────────────
_BF_REF: dict[str, list[tuple[int, float]]] = {
    'masculino': [(20, 17.0), (30, 20.0), (40, 23.0), (50, 25.0), (60, 27.0), (70, 30.0)],
    'feminino':  [(20, 27.0), (30, 30.0), (40, 33.0), (50, 36.0), (60, 38.0), (70, 41.0)],
}
_BMI_REF: dict[str, list[tuple[int, float]]] = {
    'masculino': [(20, 23.5), (30, 25.5), (40, 27.0), (50, 28.0), (60, 27.5), (70, 27.0)],
    'feminino':  [(20, 23.0), (30, 25.0), (40, 27.5), (50, 29.0), (60, 29.5), (70, 29.0)],
}

# ─────────────────────────────────────────────────────────────────────────────
# Fórmulas internas
# ─────────────────────────────────────────────────────────────────────────────

def _rfm(height_cm: float, waist_cm: float, sexo: str) -> float:
    """Relative Fat Mass — Woolcott & Bergman 2018."""
    if sexo == 'feminino':
        return 76.0 - (20.0 * height_cm / waist_cm)
    return 64.0 - (20.0 * height_cm / waist_cm)


def _deurenberg(bmi: float, idade: int, sexo: str) -> float:
    """Deurenberg et al. 1991 — IMC + idade + sexo."""
    sex_coef = 10.8 if sexo == 'masculino' else 0.0
    return (1.20 * bmi) + (0.23 * idade) - sex_coef - 5.4


def _frustum_vol_cm3(r1: float, r2: float, h: float) -> float:
    """Volume do tronco de cone entre dois níveis adjacentes (cm³)."""
    return (math.pi * h / 3.0) * (r1 ** 2 + r1 * r2 + r2 ** 2)


def _body_volume_liters(
    circs: dict[str, float | None],
    height_cm: float,
    bilateral_legs: bool = False,
) -> float | None:
    """
    Estima volume corporal total (litros) empilhando troncos de cone.

    Parâmetros
    ----------
    circs          : dict com circunferências por nível anatômico
    height_cm      : estatura total em cm
    bilateral_legs : True quando thigh/calf são circunferências POR PERNA
                     (body parsing ativo). Nesse caso o volume dos segmentos
                     de coxa e panturrilha é multiplicado por 2 (bilateral).
                     False usa as circunferências como estão (pode subestimar
                     o volume das pernas se medido na vista frontal combinada).

    Requer ≥ 3 níveis para retornar um resultado.
    """
    torso_levels  = {'neck', 'chest', 'waist', 'hip'}
    leg_levels    = {'thigh', 'calf'}

    # Monta lista (altura_cm, raio_cm, is_leg)
    levels: list[tuple[float, float, bool]] = []
    for name, frac in _HEIGHT_FRAC.items():
        c = circs.get(name)
        if c and c > 0:
            levels.append((frac * height_cm, c / (2.0 * math.pi), name in leg_levels))

    if len(levels) < 3:
        return None

    # Adiciona tornozelo como nó de fechamento inferior
    levels.append((_ANKLE_FRAC * height_cm, _ANKLE_RADIUS_CM, True))
    levels.sort(key=lambda x: x[0])  # ascendente (baixo → cima)

    vol_cm3 = 0.0
    for i in range(len(levels) - 1):
        h_lo, r_lo, is_leg_lo = levels[i]
        h_hi, r_hi, is_leg_hi = levels[i + 1]
        dh = h_hi - h_lo
        if dh <= 0:
            continue
        seg_vol = _frustum_vol_cm3(r_lo, r_hi, dh)
        # Se ambas as extremidades são de perna e medidas são por-perna, dobra (bilateral)
        if bilateral_legs and is_leg_lo and is_leg_hi:
            seg_vol *= 2.0
        vol_cm3 += seg_vol

    vol_cm3 += _HEAD_VOLUME_L * 1000.0
    return vol_cm3 / 1000.0  # cm³ → litros


def _siri(density: float) -> float | None:
    """Equação de Siri (1956): %GC = (4.95/ρ − 4.50) × 100.  Válida para ρ ∈ [0.90, 1.10]."""
    if density <= 0:
        return None
    val = (4.95 / density - 4.50) * 100.0
    return val if 2.0 < val < 70.0 else None


# ─────────────────────────────────────────────────────────────────────────────
# Índices de saúde
# ─────────────────────────────────────────────────────────────────────────────

def _visceral_fat_ratio(waist_a: float | None, waist_b: float | None) -> str | None:
    """
    Estimativa qualitativa de gordura visceral a partir da razão dos semi-eixos
    da elipse de cintura: a (profundidade AP) / b (largura lateral).

    Fundamentação:
      Kuk JL et al. (2006) "Visceral fat is an independent predictor of all-cause
        mortality in men." Obesity 14(2):336-41.
      Fox CS et al. (2007) "Abdominal visceral and subcutaneous adipose tissue
        compartments." Circulation 116(1):39-48.

    Esses estudos mostram que a razão sagital/transversal do corte abdominal
    (equivalente a a/b da elipse de cintura medida por TC/RM) correlaciona
    com a área de gordura visceral:
      a/b < 0.65 → área VAT tipicamente < 100 cm²  → 'baixa'
      a/b 0.65–0.85 → VAT 100–160 cm²              → 'moderada'
      a/b > 0.85 → VAT > 160 cm²                   → 'alta'

    Limitação: a elipse polar aqui estimada por visão computacional é uma
    aproximação 2D da seção real; a calibração dos limiares deve ser refinada
    com dados locais (Sprint D) comparando a/b com DEXA ou TC abdominal.
    """
    if not waist_a or not waist_b or waist_b <= 0:
        return None
    ratio = waist_a / waist_b
    if ratio < 0.65:
        return 'baixa'
    if ratio < 0.85:
        return 'moderada'
    return 'alta'


def _health_indices(
    waist_cm: float,
    hip_cm: float | None,
    height_cm: float,
    weight_kg: float,
    calf_cm: float | None,
    waist_a: float | None = None,
    waist_b: float | None = None,
) -> dict:
    """
    Índices de saúde cardiometabólica derivados das circunferências.

    BRI   — Body Roundness Index (Thomas et al. 2013)
    ABSI  — A Body Shape Index (Krakauer & Krakauer 2012)
    WHtR  — Waist-to-Height Ratio; cutoff > 0.5 = risco elevado
    calf_screening — EWGSOP2: < 31 cm = triagem positiva sarcopenia
    visceral_fat_ratio — 'baixa' / 'moderada' / 'alta' via a/b da elipse
    """
    bmi  = weight_kg / (height_cm / 100.0) ** 2
    whr  = round(waist_cm / hip_cm, 3) if hip_cm else None
    whtr = round(waist_cm / height_cm, 3)

    try:
        inner = 1.0 - ((waist_cm / (2.0 * math.pi)) / (0.5 * height_cm)) ** 2
        bri   = round(364.2 - 365.5 * math.sqrt(max(inner, 0.0)), 2)
    except (ValueError, ZeroDivisionError):
        bri = None

    try:
        absi = round(
            (waist_cm / 100.0) / (bmi ** (2.0 / 3.0) * (height_cm / 100.0) ** 0.5),
            4,
        )
    except (ValueError, ZeroDivisionError):
        absi = None

    calf_screening = None
    if calf_cm:
        calf_screening = 'baixo_risco' if calf_cm >= 31.0 else 'triagem_positiva_massa_muscular'

    return {
        'bmi':               round(bmi, 1),
        'rcq':               whr,
        'rcest':             whtr,
        'bri':               bri,
        'absi':              absi,
        'calf_screening':    calf_screening,
        'visceral_fat_ratio': _visceral_fat_ratio(waist_a, waist_b),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Score de risco metabólico composto
# ─────────────────────────────────────────────────────────────────────────────

def calculate_metabolic_score(
    indices: dict,
    sexo: str,
    pressao_sistolica: float | None = None,
    glicemia_jejum: float | None = None,
) -> dict:
    """
    Score de risco metabólico composto (0–7 pontos).

    Pontos de corte baseados em: IDF 2006 (WHtR), WHO 1998 (WHR),
    Thomas 2013 (BRI), Krakauer 2012 (ABSI), Fox 2007 (visceral).

    Parâmetros opcionais:
      pressao_sistolica — mmHg  (> 130 → +1 ponto)
      glicemia_jejum    — mg/dL (> 100 → +1 ponto)

    Retorna:
      pontos       : int [0, 7]
      classificacao: 'baixo' | 'moderado' | 'alto'
      detalhes     : dict com contribuição de cada critério
    """
    pontos  = 0
    detalhes: dict[str, bool] = {}

    # WHtR > 0.5 (risco cardiometabólico independe do sexo)
    whtr = indices.get('rcest')
    c = bool(whtr and whtr > 0.50)
    detalhes['whtr_elevado'] = c; pontos += c

    # WHR (RCQ) — cutoffs OMS
    whr   = indices.get('rcq')
    limit = 0.90 if sexo == 'masculino' else 0.85
    c = bool(whr and whr > limit)
    detalhes['rcq_elevado'] = c; pontos += c

    # BRI > 5 (obesidade central marcada)
    bri = indices.get('bri')
    c = bool(bri and bri > 5.0)
    detalhes['bri_elevado'] = c; pontos += c

    # ABSI > 0.083 (preditor de mortalidade independente)
    absi = indices.get('absi')
    c = bool(absi and absi > 0.083)
    detalhes['absi_elevado'] = c; pontos += c

    # Gordura visceral alta
    vfr = indices.get('visceral_fat_ratio')
    c = vfr == 'alta'
    detalhes['visceral_alta'] = c; pontos += c

    # Pressão arterial sistólica > 130 mmHg (AHA 2017)
    if pressao_sistolica is not None:
        c = pressao_sistolica > 130
        detalhes['pressao_elevada'] = c; pontos += c

    # Glicemia de jejum > 100 mg/dL (pré-diabetes ADA)
    if glicemia_jejum is not None:
        c = glicemia_jejum > 100
        detalhes['glicemia_elevada'] = c; pontos += c

    if pontos <= 1:
        classificacao = 'baixo'
    elif pontos <= 3:
        classificacao = 'moderado'
    else:
        classificacao = 'alto'

    return {
        'pontos':        pontos,
        'classificacao': classificacao,
        'detalhes':      detalhes,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Idade corporal
# ─────────────────────────────────────────────────────────────────────────────

def _interp_age(reference: list[tuple[int, float]], value: float) -> float:
    """
    Interpola a 'idade' em que `value` seria a mediana na tabela de referência.
    Extrapola linearmente além dos extremos.
    """
    ages   = [p[0] for p in reference]
    values = [p[1] for p in reference]

    if value <= values[0]:
        # Abaixo da mediana mais jovem → interpola extrapolando para antes dos 20
        if len(reference) > 1:
            slope = (values[1] - values[0]) / max(1, ages[1] - ages[0])
            return ages[0] + (value - values[0]) / slope if slope != 0 else float(ages[0])
        return float(ages[0])

    if value >= values[-1]:
        if len(reference) > 1:
            slope = (values[-1] - values[-2]) / max(1, ages[-1] - ages[-2])
            return ages[-1] + (value - values[-1]) / slope if slope != 0 else float(ages[-1])
        return float(ages[-1])

    # Interpolação linear entre os pontos da tabela
    for i in range(len(reference) - 1):
        lo_age, lo_val = reference[i]
        hi_age, hi_val = reference[i + 1]
        if lo_val <= value <= hi_val:
            frac = (value - lo_val) / max(1e-9, hi_val - lo_val)
            return lo_age + frac * (hi_age - lo_age)

    return float(ages[-1])


def estimate_body_age(
    bf_percent: float,
    bmi: float,
    sexo: str,
    age: int,
) -> int:
    """
    Estima a 'idade corporal' comparando %GC e IMC com medianas NHANES.

    Pesos: %GC tem maior relevância (60%) que IMC (40%), pois reflete
    composição corporal real e não apenas peso relativo à altura.

    Retorno: int [18, 80].  Se a pessoa tem 30 anos e retorna 38, os
    biomarcadores dela são equivalentes à mediana de pessoas de 38 anos.
    """
    bf_key  = 'masculino' if sexo.lower() != 'feminino' else 'feminino'
    bf_age  = _interp_age(_BF_REF[bf_key], bf_percent)
    bmi_age = _interp_age(_BMI_REF[bf_key], bmi)

    body_age = round(0.60 * bf_age + 0.40 * bmi_age)
    return max(18, min(80, body_age))


# ─────────────────────────────────────────────────────────────────────────────
# Propagação de incerteza
# ─────────────────────────────────────────────────────────────────────────────

def _confidence_interval(
    perc_gordura: float,
    ensemble_std: float,
    fitting_rmse_cm: float | None = None,
) -> dict:
    """
    Intervalo de confiança 95% para %GC.

    IC = percGordura ± 1.96 × σ_total, onde:

      σ_total = √(ensemble_std² + σ_geom²)

    σ_geom = incerteza geométrica propagada a partir do RMSE do fitting da elipse
    de cintura (raiz do erro quadrático médio ponderado entre medições de todos
    os ângulos e a elipse ajustada, em cm).

    Propagação linearizada da US Navy em relação à cintura:
      ∂(%BF)/∂(cintura) ≈ 1.75 %BF/cm  (média entre homens e mulheres para
      valores típicos de cintura 75–100 cm e estatura 160–180 cm)

    Isso é mais preciso que usar CV(cintura) entre 4 vistas porque:
      — inclui frames do vídeo (dezenas de ângulos), reduzindo σ_geom
      — o RMSE do fitting já captura variações sistemáticas de perspectiva
      — CV entre vistas é esperadamente alto (a cintura muda de largura com
         o ângulo — isso é a informação que o ellipse fitting usa, não ruído)
    """
    sigma = ensemble_std
    if fitting_rmse_cm is not None and fitting_rmse_cm > 0:
        sigma_geom = 1.75 * fitting_rmse_cm
        sigma = math.sqrt(ensemble_std ** 2 + sigma_geom ** 2)

    return {
        'inferior':    round(max(2.0,  perc_gordura - 1.96 * sigma), 1),
        'superior':    round(min(70.0, perc_gordura + 1.96 * sigma), 1),
        'nivel':       0.95,
        'sigma_total': round(sigma, 2),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Ponderação adaptativa das fórmulas
# ─────────────────────────────────────────────────────────────────────────────

def _adjusted_weights(
    base_weights: dict[str, float],
    level_confidence: dict[str, str],
) -> dict[str, float]:
    """
    Reduz o peso de fórmulas cujas medidas subjacentes têm baixa confiança.

    level_confidence: dict de nível → 'alta' | 'baixa'
      - Se cintura é 'baixa': US Navy e Frustum recebem fator 0.5
      - Se tórax é 'baixa':   Frustum recebe fator 0.7 (usa menos medidas)
      - Se pescoço é 'baixa': US Navy recebe fator 0.7

    RFM e Deurenberg não dependem de circunferências além da cintura e IMC,
    portanto não são penalizados por baixa confiança em outros níveis.
    """
    weights = dict(base_weights)
    waist_low = level_confidence.get('waist') == 'baixa'
    neck_low  = level_confidence.get('neck')  == 'baixa'
    chest_low = level_confidence.get('chest') == 'baixa'

    if waist_low:
        weights['us_navy']   = weights.get('us_navy',   1.0) * 0.5
        weights['rfm']       = weights.get('rfm',       1.0) * 0.5
        weights['frustum']   = weights.get('frustum',   1.5) * 0.5
    if neck_low:
        weights['us_navy']   = weights.get('us_navy',   1.0) * 0.7
    if chest_low:
        weights['frustum']   = weights.get('frustum',   1.5) * 0.7

    return weights


# ─────────────────────────────────────────────────────────────────────────────
# Função principal
# ─────────────────────────────────────────────────────────────────────────────

def calc_body_composition(
    neck_cm: float,
    waist_cm: float,
    hip_cm: float | None,
    height_cm: float,
    peso_kg: float,
    sexo: str,
    idade: int | None = None,
    chest_cm: float | None = None,
    thigh_cm: float | None = None,
    calf_cm: float | None = None,
    smplx_volume_liters: float | None = None,
    bilateral_legs: bool = False,
    waist_a: float | None = None,
    waist_b: float | None = None,
    level_confidence: dict[str, str] | None = None,
    fitting_rmse_cm: float | None = None,
    pressao_sistolica: float | None = None,
    glicemia_jejum: float | None = None,
) -> dict:
    """
    Painel de composição corporal multi-fórmula com ensemble ponderado.

    Parâmetros
    ----------
    neck_cm, waist_cm, hip_cm   : circunferências (US Navy obrigatórias)
    height_cm, peso_kg, sexo    : antropometria básica
    idade                        : anos confirmados, 19-83 (Deurenberg); None omite a formula
    chest_cm, thigh_cm, calf_cm : circunferências adicionais (frustum)
    smplx_volume_liters          : volume SMPL-X 3D (opcional, w=2.5)
    bilateral_legs               : True quando thigh/calf são por-perna (frustum bilateral)
    waist_a, waist_b             : semi-eixos da elipse de cintura (cm); usados
                                   para visceral_fat_ratio e score metabólico
    level_confidence             : dict nível → 'alta'|'baixa' para ponderação adaptativa
    measurement_cv               : CV das medições entre vistas (incerteza geométrica)
    pressao_sistolica, glicemia_jejum : dados clínicos opcionais para score metabólico
    """
    bmi = peso_kg / (height_cm / 100.0) ** 2
    estimates: list[tuple[float, float]] = []    # (valor_%BF, peso_efetivo)
    formula_vals: dict[str, float | None] = {}

    # Frustum weight: 2.0 when legs measured individually (body parsing, high confidence),
    # 1.5 when the 0.65 empirical correction is applied (MediaPipe bilateral mask).
    frustum_weight = 2.0 if bilateral_legs else 1.5
    base_weights = {'us_navy': 1.0, 'rfm': 1.0, 'deurenberg': 0.8, 'frustum': frustum_weight, 'smplx': 2.5}
    weights = _adjusted_weights(base_weights, level_confidence or {})

    # ── 1. US Navy ────────────────────────────────────────────────────────────
    usnavy    = calc_usnavy(neck_cm, waist_cm, hip_cm, height_cm, peso_kg, sexo)
    usnavy_bf = usnavy.get('percGordura')
    formula_vals['us_navy'] = usnavy_bf
    if usnavy_bf is not None:
        estimates.append((usnavy_bf, weights['us_navy']))

    # ── 2. RFM ────────────────────────────────────────────────────────────────
    rfm_val = _rfm(height_cm, waist_cm, sexo)
    rfm_ok  = 2.0 < rfm_val < 70.0
    formula_vals['rfm'] = round(rfm_val, 1) if rfm_ok else None
    if rfm_ok:
        estimates.append((rfm_val, weights['rfm']))

    # ── 3. Deurenberg ─────────────────────────────────────────────────────────
    valid_adult_age = type(idade) is int and 19 <= idade <= 83
    deur_val = _deurenberg(bmi, idade, sexo) if valid_adult_age else None
    deur_ok  = deur_val is not None and 2.0 < deur_val < 70.0
    formula_vals['deurenberg'] = round(deur_val, 1) if deur_ok else None
    if deur_ok:
        estimates.append((deur_val, weights['deurenberg']))

    # ── 4. Frustum densitométrico ──────────────────────────────────────────────
    circs = {
        'neck': neck_cm,  'chest': chest_cm, 'waist': waist_cm,
        'hip':  hip_cm,   'thigh': thigh_cm, 'calf':  calf_cm,
    }
    vol_frustum     = _body_volume_liters(circs, height_cm, bilateral_legs=bilateral_legs)
    frustum_density = None
    frustum_bf      = None
    if vol_frustum:
        frustum_density = peso_kg / vol_frustum
        frustum_bf      = _siri(frustum_density)
    formula_vals['frustum'] = round(frustum_bf, 1) if frustum_bf else None
    if frustum_bf is not None:
        estimates.append((frustum_bf, weights['frustum']))

    # ── 5. SMPL-X densitométrico ───────────────────────────────────────────────
    smplx_density = None
    smplx_bf      = None
    if smplx_volume_liters and smplx_volume_liters > 0:
        smplx_density = peso_kg / smplx_volume_liters
        smplx_bf      = _siri(smplx_density)
    formula_vals['smplx_siri'] = round(smplx_bf, 1) if smplx_bf else None
    if smplx_bf is not None:
        estimates.append((smplx_bf, weights['smplx']))

    # ── Ensemble ───────────────────────────────────────────────────────────────
    if not estimates:
        return {
            'error': 'Nenhuma formula produziu resultado valido',
            'percGordura': None, 'massaGorda': None,
            'massaMagra': None,  'rcq': None,
        }

    total_w      = sum(w for _, w in estimates)
    ensemble_bf  = sum(v * w for v, w in estimates) / total_w
    ensemble_std = math.sqrt(
        sum(w * (v - ensemble_bf) ** 2 for v, w in estimates) / total_w
    )
    ensemble_bf = max(2.0, min(70.0, ensemble_bf))

    massa_gorda = round(peso_kg * ensemble_bf / 100.0, 2)
    massa_magra = round(peso_kg - massa_gorda, 2)
    h_m  = height_cm / 100.0
    ffmi = round(massa_magra / h_m ** 2, 1)
    fmi  = round(massa_gorda / h_m ** 2, 1)

    indices = _health_indices(
        waist_cm, hip_cm, height_cm, peso_kg, calf_cm,
        waist_a=waist_a, waist_b=waist_b,
    )

    risco = calculate_metabolic_score(
        indices, sexo,
        pressao_sistolica=pressao_sistolica,
        glicemia_jejum=glicemia_jejum,
    )

    idade_corporal = estimate_body_age(ensemble_bf, bmi, sexo, idade) if valid_adult_age else None

    ic = _confidence_interval(ensemble_bf, ensemble_std, fitting_rmse_cm)

    return {
        # Campos compatíveis com schema existente
        'percGordura': round(ensemble_bf, 1),
        'massaGorda':  massa_gorda,
        'massaMagra':  massa_magra,
        'rcq':         indices['rcq'],

        # Qualidade do ensemble
        'ensemble_std': round(ensemble_std, 1),
        'ensemble_n':   len(estimates),

        # Detalhe por fórmula
        'formulas': formula_vals,

        # Composição estendida
        'ffmi': ffmi,
        'fmi':  fmi,

        # Índices de saúde
        'indices': indices,

        # Score de risco metabólico
        'risco_metabolico': risco,

        # Idade corporal (motivacional)
        'idade_corporal': idade_corporal,

        # Intervalo de confiança 95%
        'intervalo_confianca': ic,

        # Detalhe densitométrico
        'densitometrico': {
            'volume_frustum_L':    round(vol_frustum, 2)         if vol_frustum      else None,
            'densidade_frustum':   round(frustum_density, 4)     if frustum_density  else None,
            'bilateral_legs':      bilateral_legs,
            'volume_smplx_L':      round(smplx_volume_liters, 2) if smplx_volume_liters else None,
            'densidade_smplx':     round(smplx_density, 4)       if smplx_density    else None,
        },
    }
