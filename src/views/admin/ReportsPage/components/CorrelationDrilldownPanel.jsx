import React, { useMemo, useState } from 'react';
import { ListFilter } from 'lucide-react';
import { MIN_HIGHLIGHT_SAMPLE, isSmallSample } from '../config/reportsConfig';

const domains = [
  { id: 'absenteeism', label: 'Faltas' },
  { id: 'completeness', label: 'Completude' },
  { id: 'retention', label: 'Retenção' }
];

const getRowsByDomain = (correlations, domain) => {
  if (!correlations || typeof correlations !== 'object') return [];

  if (domain === 'absenteeism') {
    const source = correlations.absenteeism || {};
    return [
      ...(source.byTurn || []).map((item) => ({ ...item, dimension: 'Turno', metric: item.eventRate, metricLabel: 'Taxa de falta' })),
      ...(source.byLeadTime || []).map((item) => ({ ...item, dimension: 'Lead time', metric: item.eventRate, metricLabel: 'Taxa de falta' })),
      ...(source.byAppointmentType || []).map((item) => ({ ...item, dimension: 'Tipo de consulta', metric: item.eventRate, metricLabel: 'Taxa de falta' })),
      ...(source.byProject || []).map((item) => ({ ...item, dimension: 'Projeto', metric: item.eventRate, metricLabel: 'Taxa de falta' })),
      ...(source.byResponsible || []).map((item) => ({ ...item, dimension: 'Responsável', metric: item.eventRate, metricLabel: 'Taxa de falta' }))
    ];
  }

  if (domain === 'completeness') {
    const source = correlations.completeness || {};
    return [
      ...(source.byEvaluationType || []).map((item) => ({ ...item, dimension: 'Tipo de avaliação', metric: item.averageCompleteness, metricLabel: 'Completude média' })),
      ...(source.byProject || []).map((item) => ({ ...item, dimension: 'Projeto', metric: item.averageCompleteness, metricLabel: 'Completude média' })),
      ...(source.byResponsible || []).map((item) => ({ ...item, dimension: 'Responsável', metric: item.averageCompleteness, metricLabel: 'Completude média' }))
    ];
  }

  const source = correlations.retention || {};
  return [
    ...(source.byConsultInterval || []).map((item) => ({ ...item, dimension: 'Intervalo entre consultas', metric: item.retentionRate, metricLabel: 'Retenção' })),
    ...(source.byProject || []).map((item) => ({ ...item, dimension: 'Projeto', metric: item.retentionRate, metricLabel: 'Retenção' })),
    ...(source.byResponsible || []).map((item) => ({ ...item, dimension: 'Responsável', metric: item.retentionRate, metricLabel: 'Retenção' }))
  ];
};

const CorrelationDrilldownPanel = ({ correlations }) => {
  const [domain, setDomain] = useState('absenteeism');
  const [searchTerm, setSearchTerm] = useState('');

  const rows = useMemo(() => {
    const baseRows = getRowsByDomain(correlations, domain);
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filtered = !normalizedSearch
      ? baseRows
      : baseRows.filter((item) => (
        String(item.label || '').toLowerCase().includes(normalizedSearch)
        || String(item.dimension || '').toLowerCase().includes(normalizedSearch)
      ));

    return filtered
      .filter((item) => Number.isFinite(Number(item.metric)))
      .sort((left, right) => Number(right.metric || 0) - Number(left.metric || 0))
      .slice(0, 20);
  }, [correlations, domain, searchTerm]);

  return (
    <section className="drilldown-panel">
      <div className="drilldown-header">
        <div>
          <h3 id="relatorios-drilldown-titulo">Drill-down analítico</h3>
          <p>{`Detalhamento por dimensão para orientar decisões operacionais. Grupo com menos de ${MIN_HIGHLIGHT_SAMPLE} casos vem marcado como amostra pequena.`}</p>
        </div>
        <span className="drilldown-badge">
          <ListFilter size={14} />
          Detalhes
        </span>
      </div>

      <div className="drilldown-controls">
        <div className="drilldown-domain-tabs" role="group" aria-label="Domínio do detalhamento">
          {domains.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`drilldown-tab ${domain === item.id ? 'active' : ''}`}
              onClick={() => setDomain(item.id)}
              aria-pressed={domain === item.id}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          className="drilldown-search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Filtrar por dimensão ou grupo..."
          aria-label="Filtrar dimensões analíticas"
        />
      </div>

      {rows.length === 0 ? (
        <div className="reports-empty-state laines-feedback-state">Sem dados suficientes para este detalhamento no recorte atual.</div>
      ) : (
        // A tabela rola dentro do próprio contêiner em tela estreita; o
        // contêiner entra na ordem do Tab para rolar pelo teclado.
        <div
          className="drilldown-table-wrap"
          role="region"
          aria-labelledby="relatorios-drilldown-titulo"
          tabIndex={0}
        >
          <table className="drilldown-table">
            <thead>
              <tr>
                <th scope="col">Dimensão</th>
                <th scope="col">Grupo</th>
                <th scope="col">Indicador</th>
                <th scope="col">Amostra</th>
                <th scope="col">Odds ratio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.dimension}-${row.label}-${index}`}>
                  <td>{row.dimension}</td>
                  <td>{row.label}</td>
                  <td>{Number(row.metric).toFixed(1)}%</td>
                  <td>
                    {Number(row.sampleSize || 0).toLocaleString('pt-BR')}
                    {isSmallSample(row) && <span className="drilldown-small-sample"> (amostra pequena)</span>}
                  </td>
                  <td>{typeof row.oddsRatio === 'number' ? row.oddsRatio.toFixed(2) : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default CorrelationDrilldownPanel;
