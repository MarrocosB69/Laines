import React, { memo } from 'react';

const DIMS = [
  { key: 'qualidade_refeicoes',      label: 'Refeições'    },
  { key: 'timing_nutricional',       label: 'Timing'       },
  { key: 'hidratacao',               label: 'Hidratação'   },
  { key: 'suplementacao',            label: 'Suplementação' },
  { key: 'relacao_comida',           label: 'Rel. Comida'  },
  { key: 'sono_recuperacao',         label: 'Sono/Rec.'    },
  { key: 'comportamento_emocional',  label: 'Emocional'    },
  { key: 'autonomia_alimentar',      label: 'Autonomia'    },
];

const N = DIMS.length;
const SZ = 220;
const CX = SZ / 2;
const CY = SZ / 2;
const R  = 80;
const GRADES = [0.25, 0.5, 0.75, 1.0];

const angle = (i) => (2 * Math.PI * i) / N - Math.PI / 2;

const polarXY = (ang, r) => ({
  x: CX + r * Math.cos(ang),
  y: CY + r * Math.sin(ang),
});

const toPoints = (scores) =>
  scores.map((s, i) => {
    const r = Math.max(0, Math.min(1, s)) * R;
    return polarXY(angle(i), r);
  });

const pts2str = (pts) =>
  pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

/**
 * WheelChart — radar SVG sem biblioteca, 8 dimensões comportamentais.
 * React.memo: re-render somente quando scores mudam.
 *
 * @param {{
 *   scores: Record<string,number>|null,   // 0-100 por dimensão
 *   scoresPrev: Record<string,number>|null // sessão anterior (tracejado)
 * }} props
 */
const WheelChart = memo(({ scores, scoresPrev }) => {
  const norm  = (s, key) => (s && typeof s[key] === 'number' ? s[key] / 100 : 0);
  const curS  = DIMS.map((d) => norm(scores,     d.key));
  const prevS = scoresPrev ? DIMS.map((d) => norm(scoresPrev, d.key)) : null;

  const curPts  = toPoints(curS);
  const prevPts = prevS ? toPoints(prevS) : null;
  const hasData = curS.some((v) => v > 0);

  return (
    <svg
      viewBox={`0 0 ${SZ} ${SZ}`}
      width={SZ}
      height={SZ}
      className="wheel-chart"
      role="img"
      aria-label="Diagrama de círculos comportamental"
    >
      {/* Grade rings */}
      {GRADES.map((g) => (
        <circle
          key={g}
          cx={CX}
          cy={CY}
          r={R * g}
          fill="none"
          stroke="var(--color-border,#e2e8f0)"
          strokeWidth={0.5}
        />
      ))}

      {/* Axis spokes */}
      {DIMS.map((_, i) => {
        const end = polarXY(angle(i), R);
        return (
          <line
            key={i}
            x1={CX}
            y1={CY}
            x2={end.x.toFixed(1)}
            y2={end.y.toFixed(1)}
            stroke="var(--color-border,#e2e8f0)"
            strokeWidth={0.5}
          />
        );
      })}

      {/* Previous session — tracejado, sem fill */}
      {prevPts && (
        <polygon
          points={pts2str(prevPts)}
          fill="none"
          stroke="var(--color-text-secondary,#94a3b8)"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          opacity={0.55}
        />
      )}

      {/* Current session */}
      {hasData && (
        <polygon
          points={pts2str(curPts)}
          fill="rgba(59,130,246,0.14)"
          stroke="var(--color-primary-blue,#3b82f6)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      )}

      {/* Dimension labels */}
      {DIMS.map((d, i) => {
        const a   = angle(i);
        const pos = polarXY(a, R + 16);
        const anchor =
          Math.abs(pos.x - CX) < 5 ? 'middle' : pos.x > CX ? 'start' : 'end';
        return (
          <text
            key={d.key}
            x={pos.x.toFixed(1)}
            y={pos.y.toFixed(1)}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize={8}
            fill="var(--color-text-secondary,#64748b)"
          >
            {d.label}
          </text>
        );
      })}

      {!hasData && (
        <text
          x={CX}
          y={CY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
          fill="var(--color-text-secondary,#94a3b8)"
        >
          Sem dados
        </text>
      )}
    </svg>
  );
});

WheelChart.displayName = 'WheelChart';
export default WheelChart;
