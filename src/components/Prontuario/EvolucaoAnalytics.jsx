/* eslint-disable react-refresh/only-export-components */
// Este arquivo exporta, além do componente, funções puras de transformação
// de dados (escala temporal, cobertura, nulo-vs-zero) para que
// scripts/test-visualizacao-dados.cjs exercite a lógica real do gráfico em
// vez de reimplementá-la à parte. Mesmo padrão já usado em src/contexts/*.
import React, { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { getEvaluationRegistryItem, getEvaluationTypeLabelFromRegistry } from '../../constants/evaluationRegistry';
import { FeedbackState } from '../ui';
import './EvolucaoAnalytics.css';

// Paleta categórica nos tokens da direção vigente (landing-tokens.css e
// ProntuarioPatch.css): todas passam de 3:1 sobre o branco do cartão. Numa
// mesma unidade a segunda série também vem tracejada (SERIES_DASH), para a
// cor não ser o único jeito de separar as linhas.
const CHART_COLORS = [
  'var(--lt-color-brand-blue, #2560a8)',
  'var(--lt-color-brand-green, #3d8c2a)',
  'var(--lt-color-stadium, #0b2a5e)',
  'var(--lt-color-text-muted, #555c78)',
  'var(--prt-atencao-traco, #c2410c)'
];
const SERIES_DASH = [undefined, '7 4', '2 3'];

const GROUP_CONFIGS = [
  {
    id: 'composicao',
    label: 'Composição corporal',
    description: 'Peso, IMC, circunferência abdominal, gordura e massa magra.',
    metrics: [
      {
        key: 'peso',
        label: 'Peso',
        unit: 'kg',
        types: ['perimetros'],
        aliases: ['peso', 'pesoKg', 'peso_kg', 'weight']
      },
      {
        key: 'imc',
        label: 'IMC',
        unit: 'kg/m²',
        types: ['perimetros'],
        aliases: ['imc', 'bmi']
      },
      {
        key: 'circunferenciaAbdominal',
        label: 'Circ. abdominal',
        unit: 'cm',
        types: ['perimetros'],
        aliases: [
          'circunferenciaAbdominal',
          'circunferencia_abdominal',
          'cintura',
          'circunferenciaCintura',
          'circunferencia_cintura',
          'cinturaCm'
        ]
      },
      {
        key: 'percentualGordura',
        label: 'Gordura',
        unit: '%',
        types: ['dobras_cutaneas', 'bioimpedancia'],
        aliases: [
          'percentualGordura',
          'percentual_gordura',
          'gorduraPercentual',
          'gordura_percentual',
          'bodyFatPercentage',
          'percentualDeGordura'
        ]
      },
      {
        key: 'massaMagra',
        label: 'Massa magra',
        unit: 'kg',
        types: ['dobras_cutaneas', 'bioimpedancia'],
        aliases: [
          'massaMagra',
          'massa_magra',
          'leanMass',
          'massaLivreGordura',
          'massaLivreDeGordura',
          'massa_livre_gordura'
        ]
      }
    ]
  },
  {
    id: 'clinico',
    label: 'Clínico',
    description: 'Pressão arterial e frequência cardíaca registrados nas avaliações clínicas.',
    metrics: [
      {
        key: 'pressaoSistolica',
        label: 'PAS',
        unit: 'mmHg',
        types: ['avaliacao_clinica'],
        aliases: ['pressaoSistolica', 'pressao_sistolica', 'sistolica', 'pas']
      },
      {
        key: 'pressaoDiastolica',
        label: 'PAD',
        unit: 'mmHg',
        types: ['avaliacao_clinica'],
        aliases: ['pressaoDiastolica', 'pressao_diastolica', 'diastolica', 'pad']
      },
      {
        key: 'frequenciaCardiaca',
        label: 'FC',
        unit: 'bpm',
        types: ['avaliacao_clinica'],
        aliases: [
          'frequenciaCardiaca',
          'frequencia_cardiaca',
          'fc',
          'heartRate',
          'bpm',
          'pulso'
        ]
      }
    ]
  },
  {
    id: 'gasto',
    label: 'Gasto energético',
    description: 'GET estimado e taxa metabólica basal ao longo das sessões.',
    metrics: [
      {
        key: 'getEstimadoKcal',
        label: 'GET',
        unit: 'kcal',
        types: ['gasto_energetico_total'],
        aliases: [
          'getEstimadoKcal',
          'get_estimado_kcal',
          'getEstimado',
          'get_kcal',
          'get',
          'gastoEnergeticoTotal',
          'gasto_energetico_total',
          'totalDiario'
        ]
      },
      {
        key: 'tmbBaseKcal',
        label: 'TMB',
        unit: 'kcal',
        types: ['gasto_energetico_total'],
        aliases: [
          'tmbBaseKcal',
          'tmb_base_kcal',
          'tmbKcal',
          'tmb',
          'taxaMetabolicaBasal',
          'taxa_metabolica_basal'
        ]
      }
    ]
  },
  {
    id: 'adesao',
    label: 'Adesão',
    description: 'Score geral de adesão registrado nos retornos.',
    metrics: [
      {
        key: 'scoreAdesaoGeral',
        label: 'Adesão geral',
        unit: 'pts',
        types: ['evolucao_retorno'],
        aliases: [
          'scoreAdesaoGeral',
          'score_adesao_geral',
          'adesaoGeral',
          'adesao_geral',
          'scoreAdesao',
          'pontuacaoAdesao'
        ]
      }
    ]
  }
];

const normalizeKey = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

export const parseEvaluationDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const date = new Date(value < 100000000000 ? value * 1000 : value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'object') {
    if (typeof value.seconds === 'number') return parseEvaluationDate(value.seconds);
    if (typeof value._seconds === 'number') return parseEvaluationDate(value._seconds);
    if (typeof value.toDate === 'function') return parseEvaluationDate(value.toDate());
  }
  return null;
};

// Exportadas para o teste sintético em scripts/test-visualizacao-dados.cjs
// exercitar a lógica real (escala temporal, nulo-vs-zero, cobertura) em vez
// de reimplementá-la à parte — um regressão aqui derruba o teste.
export const getEvaluationDate = (evaluation) => parseEvaluationDate(
  evaluation?.measuredAt
    || evaluation?.data
    || evaluation?.dataAvaliacao
    || evaluation?.dataCriacao
    || evaluation?.createdAt
    || evaluation?.updatedAt
);

// Acompanhamento clinico se le por janela: o que mudou no ultimo trimestre
// nao e a mesma pergunta do que mudou no ano. "Mes a mes" nao e janela e sim
// granularidade — mantem tudo, mas reduz a um ponto por mes (o mais recente),
// que e como se le uma serie longa sem virar serrilha.
export const PERIODOS_EVOLUCAO = [
  { id: '3m', label: '3 meses', meses: 3 },
  { id: '6m', label: '6 meses', meses: 6 },
  { id: '12m', label: '12 meses', meses: 12 },
  { id: 'mensal', label: 'Mês a mês', meses: null }
];

export const recortarPorPeriodo = (avaliacoes, periodoId) => {
  const lista = Array.isArray(avaliacoes) ? avaliacoes : [];
  const periodo = PERIODOS_EVOLUCAO.find((item) => item.id === periodoId);
  if (!periodo) return lista;

  if (periodo.meses) {
    const limite = new Date();
    limite.setMonth(limite.getMonth() - periodo.meses);
    return lista.filter((item) => {
      const data = getEvaluationDate(item);
      return data ? data >= limite : false;
    });
  }

  // mes a mes: um registro por (tipo, mes) — o mais recente do mes.
  const porChave = new Map();
  lista.forEach((item) => {
    const data = getEvaluationDate(item);
    if (!data) return;
    const chave = `${String(item?.tipo || item?.type || '')}:${data.getFullYear()}-${data.getMonth()}`;
    const atual = porChave.get(chave);
    if (!atual || data > getEvaluationDate(atual)) porChave.set(chave, item);
  });
  return [...porChave.values()];
};

export const formatShortDate = (date) => {
  if (!date) return '--';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  }).format(date);
};

export const coerceNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const match = value.trim().match(/-?\d+(?:[.,]\d+)*/);
    if (!match) return null;
    const token = match[0];
    const dotGroups = token.split('.');
    const normalized = token.includes(',') && token.includes('.')
      ? token.replace(/\./g, '').replace(',', '.')
      : token.includes(',')
        ? token.replace(',', '.')
        : dotGroups.length > 1 && dotGroups.slice(1).every((part) => part.length === 3)
          ? dotGroups.join('')
          : token;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'object') {
    const preferredKeys = ['valor', 'value', 'resultado', 'total', 'kcal', 'estimado', 'media', 'score'];
    for (const key of preferredKeys) {
      const parsed = coerceNumber(value[key]);
      if (parsed !== null) return parsed;
    }
  }
  return null;
};

const findByAliases = (source, normalizedAliases, depth = 0) => {
  if (!source || typeof source !== 'object' || depth > 7) return undefined;

  if (Array.isArray(source)) {
    for (const item of source) {
      const found = findByAliases(item, normalizedAliases, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  for (const [key, value] of Object.entries(source)) {
    if (normalizedAliases.has(normalizeKey(key))) return value;
  }

  for (const value of Object.values(source)) {
    const found = findByAliases(value, normalizedAliases, depth + 1);
    if (found !== undefined) return found;
  }

  return undefined;
};

const buildCandidateSources = (evaluation) => {
  const dados = evaluation?.dados;
  const resultados = evaluation?.resultados;
  return [
    dados,
    dados?.dados_brutos,
    dados?.dadosBrutos,
    dados?.input,
    dados?.inputs,
    dados?.resultados,
    dados?.resultado,
    resultados,
    resultados?.calculado,
    resultados?.calculados,
    resultados?.calculated,
    resultados?.output,
    evaluation?.registros,
    evaluation?.meta,
    evaluation
  ].filter(Boolean);
};

export const extractMetricValue = (evaluation, metric) => {
  const normalizedAliases = new Set(metric.aliases.map(normalizeKey));

  for (const source of buildCandidateSources(evaluation)) {
    const rawValue = findByAliases(source, normalizedAliases);
    const value = coerceNumber(rawValue);
    if (value !== null) return value;
  }

  return null;
};

const isSupportedLongitudinalType = (type) => {
  const registryItem = getEvaluationRegistryItem(type);
  return Boolean(registryItem?.supportsLongitudinalComparison);
};

export const buildGroupAnalytics = (avaliacoes) => {
  const orderedEvaluations = (avaliacoes || [])
    .map((evaluation, index) => {
      const type = String(evaluation?.tipo || evaluation?.type || '').trim();
      return {
        evaluation,
        index,
        type,
        date: getEvaluationDate(evaluation)
      };
    })
    .filter((item) => item.type && item.date && isSupportedLongitudinalType(item.type))
    .sort((a, b) => a.date - b.date);

  return GROUP_CONFIGS.map((group) => {
    const rowsByKey = new Map();
    const pointCounts = Object.fromEntries(group.metrics.map((metric) => [metric.key, 0]));
    // Sessões elegíveis: onde o instrumento poderia ter registrado a métrica,
    // tenha ou não valor. É o denominador real da cobertura — contar só os
    // pontos com dado (pointCounts) mediria "quantos existem", não "quanto falta".
    const eligibleCounts = Object.fromEntries(group.metrics.map((metric) => [metric.key, 0]));
    const originsByMetric = Object.fromEntries(group.metrics.map((metric) => [metric.key, new Set()]));

    orderedEvaluations.forEach((item) => {
      group.metrics.forEach((metric) => {
        if (!metric.types.includes(item.type)) return;
        eligibleCounts[metric.key] += 1;

        const value = extractMetricValue(item.evaluation, metric);
        if (value === null) return; // ausência fica ausente: nunca vira zero aqui.

        const rowKey = [
          item.date.getTime(),
          item.type,
          item.evaluation?.id || item.evaluation?.avaliacaoId || item.index
        ].join(':');
        const current = rowsByKey.get(rowKey) || {
          timestamp: item.date.getTime(),
          dateLabel: formatShortDate(item.date),
          tipo: item.type
        };

        current[metric.key] = value;
        rowsByKey.set(rowKey, current);
        pointCounts[metric.key] += 1;
        originsByMetric[metric.key].add(item.type);
      });
    });

    const chartData = Array.from(rowsByKey.values()).sort((a, b) => a.timestamp - b.timestamp);
    const metricsWithData = group.metrics.filter((metric) => pointCounts[metric.key] > 0);
    const lineMetrics = group.metrics.filter((metric) => pointCounts[metric.key] >= 2);

    // Cobertura por métrica: fração das sessões elegíveis que têm o dado.
    // "Parcial" (abaixo de 100%) rebaixa a confiança sem virar zero ou nulo —
    // é só um número que o componente exibe ao lado do rótulo. `origins` com
    // mais de um método sinaliza que a série mistura instrumentos diferentes
    // (ex.: %gordura por dobras cutâneas e por bioimpedância não são a mesma
    // medida, mesmo compartilhando grandeza e unidade).
    const coverageByMetric = Object.fromEntries(group.metrics.map((metric) => {
      const total = eligibleCounts[metric.key];
      const found = pointCounts[metric.key];
      const ratio = total > 0 ? found / total : null;
      return [metric.key, {
        found,
        total,
        ratio,
        parcial: ratio !== null && ratio < 1,
        origins: [...originsByMetric[metric.key]]
      }];
    }));

    return {
      ...group,
      chartData,
      metricsWithData,
      lineMetrics,
      pointCounts,
      coverageByMetric,
      hasEnoughData: lineMetrics.length > 0,
      totalPoints: Object.values(pointCounts).reduce((sum, count) => sum + count, 0)
    };
  });
};

const formatMetricValue = (value, unit) => {
  if (value === null || value === undefined) return '--';
  const decimals = Math.abs(value) >= 100 ? 0 : 1;
  return `${Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : decimals,
    maximumFractionDigits: decimals
  })}${unit ? ` ${unit}` : ''}`;
};

// Origem/método legível a partir do tipo de avaliação que gerou o ponto —
// mesma fonte de rótulo usada no resto do prontuário, sem inventar outra.
const rotuloOrigem = (tipo) => getEvaluationTypeLabelFromRegistry(tipo) || tipo || 'origem não informada';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const dataLabel = Number.isFinite(label) ? formatShortDate(new Date(label)) : label;

  return (
    <div className="evolucao-tooltip">
      <strong>{dataLabel}</strong>
      {payload.map((item) => (
        <span key={item.dataKey} style={{ '--metric-color': item.color }}>
          <i aria-hidden="true" />
          {item.name}: {formatMetricValue(item.value, item.payload?.[`_${item.dataKey}Unit`] || '')}
          {item.payload?.tipo ? ` · ${rotuloOrigem(item.payload.tipo)}` : ''}
        </span>
      ))}
    </div>
  );
};

const EvolucaoAnalytics = ({ avaliacoes = [] }) => {
  const [periodo, setPeriodo] = useState('12m');
  const avaliacoesNoPeriodo = useMemo(
    () => recortarPorPeriodo(avaliacoes, periodo),
    [avaliacoes, periodo]
  );
  const groups = useMemo(() => buildGroupAnalytics(avaliacoesNoPeriodo), [avaliacoesNoPeriodo]);
  const visibleGroups = useMemo(
    () => groups.filter((group) => group.hasEnoughData),
    [groups]
  );
  const [selectedGroupId, setSelectedGroupId] = useState('');
  // Alternativa em tabela por unidade: some por padrão (o gráfico já responde
  // a maioria das leituras), mas fica a um clique/Enter/toque de distância —
  // não depende de passar o mouse sobre um ponto.
  const [tabelasAbertas, setTabelasAbertas] = useState(() => new Set());
  const [ordemAscendente, setOrdemAscendente] = useState(true);
  const alternarTabela = (chave) => {
    setTabelasAbertas((atual) => {
      const proxima = new Set(atual);
      if (proxima.has(chave)) proxima.delete(chave); else proxima.add(chave);
      return proxima;
    });
  };

  useEffect(() => {
    if (!visibleGroups.length) {
      setSelectedGroupId('');
      return;
    }
    if (!visibleGroups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(visibleGroups[0].id);
    }
  }, [selectedGroupId, visibleGroups]);

  const selectedGroup = visibleGroups.find((group) => group.id === selectedGroupId) || visibleGroups[0];

  // Sem isto, uma janela curta mostrava "nao ha dados" para um paciente que
  // tem historico — a pessoa concluiria que o registro se perdeu.
  const temDadoForaDoPeriodo = !visibleGroups.length
    && avaliacoes.length > avaliacoesNoPeriodo.length;

  const chartData = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.chartData.map((row) => {
      const rowWithUnits = { ...row };
      selectedGroup.metrics.forEach((metric) => {
        rowWithUnits[`_${metric.key}Unit`] = metric.unit;
      });
      return rowWithUnits;
    });
  }, [selectedGroup]);

  /**
   * Métricas agrupadas pela unidade que medem.
   *
   * `cor0` guarda o deslocamento na paleta para que a cor de cada série
   * continue única ao longo de todos os gráficos do grupo — duas séries em
   * gráficos diferentes com a mesma cor sugeririam parentesco que não existe.
   */
  const gruposPorUnidade = useMemo(() => {
    if (!selectedGroup) return [];
    const porUnidade = new Map();
    selectedGroup.lineMetrics.forEach((metric) => {
      const u = metric.unit || '';
      if (!porUnidade.has(u)) porUnidade.set(u, []);
      porUnidade.get(u).push(metric);
    });
    let deslocamento = 0;
    return [...porUnidade.entries()].map(([unidade, metricas]) => {
      const item = { unidade, metricas, cor0: deslocamento };
      deslocamento += metricas.length;
      return item;
    });
  }, [selectedGroup]);

  return (
    <section className="pron-card pron-panel evolucao-analytics" aria-labelledby="evolucao-title">
      <header className="pron-panel-header evolucao-analytics__header">
        <div>
          <h2 id="evolucao-title">Evolução longitudinal</h2>
          <p>
            Gráficos por sessão com os indicadores comparáveis do prontuário.
          </p>
        </div>
        <div className="evolucao-analytics__head-actions">
          <div className="evolucao-analytics__periodo" role="group" aria-label="Período da evolução">
            {PERIODOS_EVOLUCAO.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`evolucao-analytics__periodo-btn ${item.id === periodo ? 'is-active' : ''}`}
                aria-pressed={item.id === periodo}
                onClick={() => setPeriodo(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <span className="evolucao-analytics__badge">
            <TrendingUp size={15} aria-hidden="true" />
            {visibleGroups.length === 1 ? '1 grupo com série' : `${visibleGroups.length || 0} grupos com série`}
          </span>
        </div>
      </header>

      {!visibleGroups.length ? (
        <FeedbackState
          empty
          icon={TrendingUp}
          size="sm"
          title={temDadoForaDoPeriodo
            ? 'Nenhum registro comparável neste período.'
            : 'Ainda não há dados suficientes para gráficos longitudinais.'}
          description={temDadoForaDoPeriodo
            ? 'Existem registros fora da janela escolhida. Amplie o período para vê-los.'
            : 'São necessários pelo menos dois registros da mesma métrica em avaliações comparáveis.'}
        />
      ) : (
        <>
          <div className="evolucao-analytics__switcher" role="tablist" aria-label="Grupos de evolução">
            {visibleGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={group.id === selectedGroup?.id}
                className={`evolucao-analytics__pill ${group.id === selectedGroup?.id ? 'is-active' : ''}`}
                onClick={() => setSelectedGroupId(group.id)}
              >
                {group.label}
                <span>{group.totalPoints}</span>
              </button>
            ))}
          </div>

          <div className="evolucao-analytics__summary" aria-label="Métricas disponíveis">
            {selectedGroup.metricsWithData.map((metric) => {
              const cobertura = selectedGroup.coverageByMetric?.[metric.key];
              const coberturaPercentual = Number.isFinite(cobertura?.ratio) ? Math.round(cobertura.ratio * 100) : null;
              return (
                <div key={metric.key} className="evolucao-analytics__metric">
                  <span>{metric.label}</span>
                  <strong>{selectedGroup.pointCounts[metric.key] === 1 ? '1 ponto' : `${selectedGroup.pointCounts[metric.key]} pontos`}</strong>
                  {cobertura?.parcial && (
                    <em className="evolucao-analytics__cobertura-parcial">
                      Cobertura parcial: {coberturaPercentual}% das sessões elegíveis ({cobertura.found} de {cobertura.total})
                    </em>
                  )}
                  {cobertura && cobertura.origins.length > 1 && (
                    <em className="evolucao-analytics__origem-mista">
                      Métodos diferentes na série: {cobertura.origins.map(rotuloOrigem).join(' · ')}
                    </em>
                  )}
                </div>
              );
            })}
          </div>

          <div className="evolucao-analytics__chart-card">
            <div className="evolucao-analytics__chart-head">
              <div>
                <h3>{selectedGroup.label}</h3>
                <p>{selectedGroup.description}</p>
              </div>
            </div>
            <p className="evolucao-analytics__disclaimer">
              A posição de cada ponto segue a data real da avaliação — intervalos maiores entre sessões aparecem como maior distância no eixo. A inclinação da linha mostra a variação registrada; não é, por si só, evidência de melhora ou piora clínica.
            </p>

            {/* Um gráfico por unidade.
                Antes, todas as métricas do grupo dividiam um eixo só: gordura
                em % (perto de 12) e massa magra em kg (perto de 68) na mesma
                escala de 0 a 80. Uma rastejava na base, a outra ocupava o topo,
                e a comparação visual entre elas não significava nada.
                Agora quilo e porcentagem nunca dividem escala — o que se
                compara entre os gráficos é o movimento no tempo. */}
            {gruposPorUnidade.map(({ unidade, metricas, cor0 }) => {
              const chaveTabela = `${selectedGroup.id}:${unidade}`;
              const tabelaId = `evolucao-tabela-${normalizeKey(selectedGroup.id)}-${normalizeKey(unidade || 'sem-unidade')}`;
              const tabelaAberta = tabelasAbertas.has(chaveTabela);
              // Só entra na tabela desta unidade quem tem ao menos uma destas
              // métricas — uma sessão de outro instrumento do mesmo grupo não
              // vira linha em branco aqui (o gráfico também não a desenha).
              const linhasRelevantes = chartData.filter((row) => metricas
                .some((m) => Object.prototype.hasOwnProperty.call(row, m.key)));
              const linhasOrdenadas = [...linhasRelevantes].sort((a, b) => (
                ordemAscendente ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
              ));
              // Resumo em texto do gráfico para o leitor de tela: por série, o
              // número de sessões e o primeiro e o último valor, com a data.
              const resumoGrafico = `Gráfico de linha, ${metricas.map((m) => m.label).join(' e ')} em ${unidade || 'unidade não declarada'}. ${metricas.map((m) => {
                const pontos = chartData.filter((row) => Object.prototype.hasOwnProperty.call(row, m.key));
                if (!pontos.length) return `${m.label}: sem registro`;
                const primeiro = pontos[0];
                const ultimo = pontos[pontos.length - 1];
                return `${m.label}: ${pontos.length === 1 ? '1 sessão' : `${pontos.length} sessões`}, de ${formatMetricValue(primeiro[m.key], m.unit)} em ${primeiro.dateLabel} a ${formatMetricValue(ultimo[m.key], m.unit)} em ${ultimo.dateLabel}`;
              }).join('. ')}.`;

              return (
                <div key={unidade} className="evolucao-analytics__unidade">
                  <div className="evolucao-analytics__unidade-head">
                    <p className="evolucao-analytics__unidade-rotulo">
                      {metricas.map((m) => m.label).join(' · ')}
                      <span> em {unidade || 'unidade não declarada'}</span>
                    </p>
                    <button
                      type="button"
                      className="evolucao-analytics__tabela-toggle"
                      aria-expanded={tabelaAberta}
                      aria-controls={tabelaId}
                      onClick={() => alternarTabela(chaveTabela)}
                    >
                      {tabelaAberta ? 'Ocultar tabela' : 'Ver dados em tabela'}
                    </button>
                  </div>
                  <div className="evolucao-analytics__chart" role="img" aria-label={resumoGrafico}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 12, right: 18, bottom: 4, left: 0 }}>
                        <CartesianGrid stroke="var(--lt-color-border, rgba(12, 31, 48, 0.12))" vertical={false} />
                        {/* Eixo numérico pela data real (ms), não pelo índice do
                            ponto: um intervalo de um dia e um de seis meses
                            ocupam larguras diferentes no eixo, proporcionais ao
                            tempo decorrido. */}
                        <XAxis
                          dataKey="timestamp"
                          type="number"
                          domain={['dataMin', 'dataMax']}
                          tickFormatter={(value) => formatShortDate(new Date(value))}
                          tick={{ fill: 'var(--lt-color-text-muted, #555c78)', fontSize: 12 }}
                          tickLine={false}
                          axisLine={{ stroke: 'var(--lt-color-border-field, #7a8098)' }}
                          allowDuplicatedCategory={false}
                        />
                        <YAxis
                          tick={{ fill: 'var(--lt-color-text-muted, #555c78)', fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
                          width={42}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                          iconType="plainline"
                          wrapperStyle={{ fontSize: 13, color: 'var(--lt-color-text, #262947)' }}
                          formatter={(valor) => <span className="evolucao-analytics__legenda">{valor}</span>}
                        />
                        {metricas.map((metric, index) => (
                          <Line
                            key={metric.key}
                            type="monotone"
                            dataKey={metric.key}
                            name={metric.label}
                            unit={metric.unit}
                            stroke={CHART_COLORS[(cor0 + index) % CHART_COLORS.length]}
                            strokeDasharray={SERIES_DASH[index % SERIES_DASH.length]}
                            strokeWidth={2.5}
                            dot={{ r: 3, strokeWidth: 1 }}
                            activeDot={{ r: 5 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {tabelaAberta && (
                    <div className="evolucao-analytics__table-wrap" role="region" aria-labelledby={`${tabelaId}-legenda`} tabIndex={0}>
                      <table className="evolucao-analytics__table" id={tabelaId}>
                        <caption id={`${tabelaId}-legenda`}>
                          {metricas.map((m) => m.label).join(' · ')} — {linhasOrdenadas.length === 1
                            ? '1 sessão registrada' : `${linhasOrdenadas.length} sessões registradas`}
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">
                              <button
                                type="button"
                                className="evolucao-analytics__sort-btn"
                                onClick={() => setOrdemAscendente((atual) => !atual)}
                                aria-label={`Ordenar por data, ${ordemAscendente ? 'mais recente primeiro' : 'mais antiga primeiro'}`}
                              >
                                Data {ordemAscendente ? '▲' : '▼'}
                              </button>
                            </th>
                            {metricas.map((m) => (
                              <th scope="col" key={m.key}>{m.label} ({m.unit || 'sem unidade'})</th>
                            ))}
                            <th scope="col">Origem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {linhasOrdenadas.map((row) => (
                            <tr key={`${row.timestamp}:${row.tipo || ''}`}>
                              <th scope="row">{row.dateLabel}</th>
                              {metricas.map((m) => (
                                <td key={m.key}>
                                  {Object.prototype.hasOwnProperty.call(row, m.key)
                                    ? formatMetricValue(row[m.key], '')
                                    : 'sem registro'}
                                </td>
                              ))}
                              <td>{row.tipo ? rotuloOrigem(row.tipo) : 'não informada'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};

export default EvolucaoAnalytics;
