import React, { useMemo } from 'react';

const MiniSparkline = ({
  values = [],
  target = null,
  width = 220,
  height = 72,
  stroke = '#2563eb',
  strokeWidth = 2
}) => {
  const numericValues = useMemo(
    () => (Array.isArray(values) ? values.filter((value) => Number.isFinite(value)) : []),
    [values]
  );

  const chart = useMemo(() => {
    if (!numericValues.length) return null;
    const maxValue = Math.max(...numericValues, Number.isFinite(target) ? target : -Infinity);
    const minValue = Math.min(...numericValues, Number.isFinite(target) ? target : Infinity);
    const safeMax = Number.isFinite(maxValue) ? maxValue : 1;
    const safeMin = Number.isFinite(minValue) ? minValue : 0;
    const range = safeMax - safeMin || 1;
    const innerWidth = Math.max(10, width - 8);
    const innerHeight = Math.max(10, height - 8);
    const stepX = numericValues.length > 1 ? innerWidth / (numericValues.length - 1) : 0;

    const toY = (value) => {
      const normalized = (value - safeMin) / range;
      return Number((height - 4 - (normalized * innerHeight)).toFixed(2));
    };

    const points = numericValues.map((value, index) => {
      const x = Number((4 + (index * stepX)).toFixed(2));
      return `${x},${toY(value)}`;
    }).join(' ');

    const targetY = Number.isFinite(target) ? toY(target) : null;
    return {
      points,
      targetY
    };
  }, [height, numericValues, target, width]);

  if (!chart || numericValues.length === 0) {
    return <div className="mini-sparkline mini-sparkline--empty">Sem dados</div>;
  }

  return (
    <svg className="mini-sparkline" width={width} height={height} role="img" aria-label="Tendencia">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={chart.points}
      />
      {Number.isFinite(chart.targetY) && (
        <line
          x1="2"
          y1={chart.targetY}
          x2={Math.max(2, width - 2)}
          y2={chart.targetY}
          stroke="#f59e0b"
          strokeDasharray="4 4"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
};

export default MiniSparkline;

