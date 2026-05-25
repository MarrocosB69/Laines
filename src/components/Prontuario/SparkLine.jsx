import React, { memo, useState, useId } from 'react';

const W   = 130;
const H   = 44;
const PAD = 5;

/**
 * SparkLine — micro gráfico de linha SVG sem biblioteca.
 * React.memo: re-render somente quando pontos mudam.
 *
 * @param {{
 *   pontos: Array<{ valor: number, dataLabel: string }>,
 *   label:  string,
 *   unidade: string,
 *   cor?: string,
 * }} props
 */
const SparkLine = memo(({ pontos = [], label = '', unidade = '', cor = '#3b82f6' }) => {
  const [tooltip, setTooltip] = useState(null);
  const uid = useId();

  if (pontos.length === 0) {
    return (
      <div className="spark spark--vazio">
        <span className="spark__label">{label}</span>
        <span className="spark__empty">—</span>
      </div>
    );
  }

  const vals = pontos.map((p) => p.valor);
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  const rng  = max - min || 1;

  const toX = (i) =>
    PAD + (i / Math.max(pontos.length - 1, 1)) * (W - PAD * 2);
  const toY = (v) =>
    H - PAD - ((v - min) / rng) * (H - PAD * 2);

  const ultimo = pontos[pontos.length - 1];

  /* 1 ponto → ponto único centralizado, sem linha */
  if (pontos.length === 1) {
    return (
      <div className="spark">
        <span className="spark__label">{label}</span>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="spark__svg">
          <circle cx={W / 2} cy={H / 2} r={3.5} fill={cor} />
        </svg>
        <span className="spark__valor">
          {ultimo.valor} {unidade}
        </span>
      </div>
    );
  }

  const lineD = pontos
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.valor).toFixed(1)}`)
    .join(' ');

  const areaD =
    `M${toX(0).toFixed(1)},${H} ` +
    pontos.map((p, i) => `L${toX(i).toFixed(1)},${toY(p.valor).toFixed(1)}`).join(' ') +
    ` L${toX(pontos.length - 1).toFixed(1)},${H} Z`;

  return (
    <div className="spark">
      <span className="spark__label">{label}</span>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="spark__svg"
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id={`sg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={cor} stopOpacity={0.28} />
            <stop offset="100%" stopColor={cor} stopOpacity={0}    />
          </linearGradient>
        </defs>

        <path d={areaD} fill={`url(#sg-${uid})`} />
        <path
          d={lineD}
          fill="none"
          stroke={cor}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {pontos.map((p, i) => (
          <circle
            key={i}
            cx={toX(i)}
            cy={toY(p.valor)}
            r={3}
            fill={cor}
            style={{ cursor: 'crosshair' }}
            onMouseEnter={() =>
              setTooltip({ i, x: toX(i), y: toY(p.valor), ponto: p })
            }
          />
        ))}

        {tooltip && (
          <g className="spark__tooltip-g">
            <rect
              x={Math.min(tooltip.x - 2, W - 68)}
              y={Math.max(tooltip.y - 30, 2)}
              width={66}
              height={22}
              rx={4}
              fill="rgba(15,23,42,0.88)"
            />
            <text
              x={Math.min(tooltip.x - 2, W - 68) + 5}
              y={Math.max(tooltip.y - 30, 2) + 14}
              fontSize={8}
              fill="#fff"
            >
              {tooltip.ponto.valor} {unidade} · {tooltip.ponto.dataLabel}
            </text>
          </g>
        )}
      </svg>
      <span className="spark__valor">
        {ultimo.valor} {unidade}
      </span>
    </div>
  );
});

SparkLine.displayName = 'SparkLine';
export default SparkLine;
