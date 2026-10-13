import React from 'react';

const Skeleton = ({ lines = 1, variant = 'line', width, height, className = '' }) => {
  if (variant === 'line' || lines > 1) {
    const count = variant === 'line' ? lines : 1;
    return (
      <div className={`ui-skeleton-group ${className}`} aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="ui-skeleton ui-skeleton-line"
            style={width ? { width } : undefined}
          />
        ))}
      </div>
    );
  }

  const cls = `ui-skeleton ui-skeleton-${variant} ${className}`.trim();
  return (
    <div
      className={cls}
      aria-hidden="true"
      style={{
        ...(width ? { width } : {}),
        ...(height ? { height } : {})
      }}
    />
  );
};

export default Skeleton;
