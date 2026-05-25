import React from 'react';

/**
 * Classify a vital sign value into a status.
 * fc classification is sport-aware: 30–50 bpm is "fisio" (blue) for elite/semi-pro athletes.
 */
const CLASSIFY = {
  paSistolica: (v) => {
    if (v < 90 || v > 160) return 'risk';
    if (v >= 130) return 'alert';
    return 'ok';
  },
  paDiastolica: (v) => {
    if (v < 60 || v > 100) return 'risk';
    if (v >= 90) return 'alert';
    return 'ok';
  },
  fc: (v, isElite) => {
    if (v < 30 || v > 110) return 'risk';
    if (v >= 100) return 'alert';
    if (v < 50 && isElite) return 'fisio';
    return 'ok';
  },
  temperatura: (v) => {
    if (v < 36 || v > 38.5) return 'risk';
    if (v >= 37.5) return 'alert';
    return 'ok';
  },
  glicemia: (v) => {
    if (v < 70 || v > 125) return 'risk';
    if (v >= 100) return 'alert';
    return 'ok';
  },
};

const META = {
  paSistolica:  { label: 'PA Sistólica',  unit: 'mmHg' },
  paDiastolica: { label: 'PA Diastólica', unit: 'mmHg' },
  fc:           { label: 'Freq. Cardíaca', unit: 'bpm' },
  temperatura:  { label: 'Temperatura',   unit: '°C'   },
  glicemia:     { label: 'Glicemia',      unit: 'mg/dL' },
};

const BADGE_LABELS = {
  ok:    'Normal',
  alert: 'Atenção',
  risk:  'Risco',
  fisio: 'Fisiológico',
};

const ELITE_LEVELS = new Set(['elite', 'semi_pro', 'semi-pro', 'profissional', 'alto_rendimento']);

/**
 * VitalCard — exibe um sinal vital com classificação esportiva.
 *
 * @param {{ tipo: string, valor: number|null, nivelCompetitivo: string }} props
 */
const VitalCard = ({ tipo, valor, nivelCompetitivo }) => {
  const meta = META[tipo];
  if (!meta) return null;

  const isElite = ELITE_LEVELS.has(String(nivelCompetitivo || '').toLowerCase());
  const num = valor != null ? Number(valor) : null;
  const classifyFn = CLASSIFY[tipo];
  const status = num != null && classifyFn ? classifyFn(num, isElite) : 'empty';

  return (
    <div
      className={`vital-card vital-card--${status}`}
      role="listitem"
      aria-label={`${meta.label}: ${num != null ? `${num} ${meta.unit}` : 'Não informado'}`}
    >
      <span className="vital-card__label">{meta.label}</span>
      {num != null ? (
        <>
          <span className="vital-card__value">
            {num}
            <span className="vital-card__unit"> {meta.unit}</span>
          </span>
          <span className={`vital-card__badge vital-badge--${status}`}>
            {BADGE_LABELS[status] || status}
          </span>
        </>
      ) : (
        <span className="vital-card__empty">—</span>
      )}
    </div>
  );
};

export default VitalCard;
