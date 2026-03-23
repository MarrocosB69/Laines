import React from 'react';
import '../avaliacoes.css';

const ResultadosAntropometricos = () => {
  return (
    <div className="eval-card">
      <div className="eval-header">
        <div className="eval-icon" style={{ background: 'rgba(148, 163, 184, 0.2)', color: '#64748b' }}>
          RX
        </div>
        <div>
          <h3 className="eval-title">Resultados Antropometricos</h3>
          <p className="eval-subtitle">Resumo dos calculos gerados.</p>
        </div>
      </div>
      <div className="eval-empty">Sem resultados para exibir.</div>
    </div>
  );
};

export default ResultadosAntropometricos;
