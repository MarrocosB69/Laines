import { Readable } from 'stream';
import { FindOperator } from 'typeorm';
import { AnalyticsController } from './analytics.controller';
import {
  AnalyticsService,
  MIN_HIGHLIGHT_SAMPLE,
  buildMetricTrend,
  reportDayKey,
  resolveReportPeriods
} from './analytics.service';

/*
 * WI-016, etapa 1: números confiáveis nos Relatórios. Dados 100% sintéticos:
 * nenhum id, nome ou data corresponde a pessoa real. O relógio fica fixo em
 * 2026-10-02 12:00 no horário de Brasília, e os testes de fuso rodam com o
 * processo em UTC, para que um cálculo pelo relógio local ou pelo dia UTC
 * apareça como erro em qualquer máquina.
 */

const NOW = new Date('2026-10-02T15:00:00Z');
const PROJ_A = 'a1600000-0000-4000-8000-00000000000a';
const PROJ_B = 'b1600000-0000-4000-8000-00000000000b';
const PROJ_C = 'c1600000-0000-4000-8000-00000000000c';

type Linha = Record<string, unknown>;

const casa = (linha: Linha, where?: Record<string, unknown>) => (
  !where || Object.entries(where).every(([campo, condicao]) => {
    if (condicao instanceof FindOperator) {
      if (condicao.type === 'isNull') return linha[campo] === null || linha[campo] === undefined;
      if (condicao.type === 'in') {
        const valores: unknown = condicao.value;
        return Array.isArray(valores) && valores.includes(linha[campo]);
      }
      throw new Error(`operador sem suporte no repositório falso: ${condicao.type}`);
    }
    return linha[campo] === condicao;
  })
);

const repo = (linhas: Linha[]) => ({
  find: async (opcoes: { where?: Record<string, unknown>; take?: number; skip?: number } = {}) => {
    const filtradas = linhas.filter((linha) => casa(linha, opcoes.where));
    const inicio = opcoes.skip || 0;
    return filtradas.slice(inicio, opcoes.take ? inicio + opcoes.take : undefined);
  }
});

type Dados = { users?: Linha[]; pacientes?: Linha[]; avaliacoes?: Linha[]; agendamentos?: Linha[] };

type Overview = Extract<Awaited<ReturnType<AnalyticsService['getReportsOverview']>>, { metrics: unknown }>;
type Correlacoes = Extract<Awaited<ReturnType<AnalyticsService['getCorrelations']>>, { dataset: unknown }>;

const criarServico = (dados: Dados) => {
  const service = new AnalyticsService(
    repo(dados.users || []) as never,
    repo(dados.pacientes || []) as never,
    repo(dados.avaliacoes || []) as never,
    repo(dados.agendamentos || []) as never,
    repo([{ id: PROJ_A, nome: 'Projeto Sintético A' }, { id: PROJ_B, nome: 'Projeto Sintético B' }]) as never,
    repo([]) as never,
    repo([]) as never,
    repo([]) as never
  );
  // Relógio fixo: substitui o método privado `clock` só nesta instância.
  Object.assign(service, { clock: () => NOW });
  return service;
};

const correlacoesDe = async (dados: Dados, range: string, projectId: string) => (
  await criarServico(dados).getCorrelations({ range, projectId, forceRefresh: true })
) as Correlacoes;

const comProcessoEmUtc = async (fn: () => Promise<void> | void) => {
  const anterior = process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  process.env.TZ = 'UTC';
  try {
    await fn();
  } finally {
    process.env.TZ = anterior;
  }
};

const lerStream = async (stream: Readable) => {
  let texto = '';
  for await (const parte of stream) texto += String(parte);
  return texto;
};

// ── Cenário clínico sintético (projeto A, com B ao lado) ─────────────────
const BASE: Dados = {
  users: [
    { id: 'u-aluno-1', role: 'aluno', projetoId: PROJ_A, createdAt: new Date('2026-09-27T15:00:00Z') },
    { id: 'u-aluno-2', role: 'aluno', projetoId: PROJ_B, createdAt: new Date('2026-09-28T15:00:00Z') },
    { id: 'u-pres-1', role: 'presidente', projetoId: null, createdAt: new Date('2026-09-29T15:00:00Z') },
    { id: 'u-aluno-4', role: 'aluno', projetoId: PROJ_A, createdAt: new Date('2025-01-01T15:00:00Z') },
    { id: 'u-prof-1', role: 'professor', projetoId: null, createdAt: new Date('2025-01-01T15:00:00Z') }
  ],
  pacientes: [
    { id: 'pac-a', projetoId: PROJ_A, alunoResponsavelId: 'aluno-1', professorSupervisorId: 'prof-1', status: 'ativo', dataCadastro: new Date('2026-01-10T15:00:00Z') },
    { id: 'pac-b', projetoId: PROJ_A, alunoResponsavelId: 'aluno-2', professorSupervisorId: 'prof-1', status: 'ativo', dataCadastro: new Date('2026-09-28T15:00:00Z') },
    { id: 'pac-c', projetoId: PROJ_A, alunoResponsavelId: null, professorSupervisorId: null, status: 'espera', dataCadastro: new Date('2026-09-20T15:00:00Z') },
    { id: 'pac-d', projetoId: PROJ_B, alunoResponsavelId: 'aluno-3', professorSupervisorId: 'prof-2', status: 'ativo', dataCadastro: new Date('2026-09-27T15:00:00Z') }
  ],
  avaliacoes: [
    { id: 'av-1', pacienteId: 'pac-a', projetoId: PROJ_A, tipo: 'bioimpedancia', status: 'finalizada', meta: { completude: 90 }, createdAt: new Date('2026-09-27T15:00:00Z') },
    { id: 'av-2', pacienteId: 'pac-a', projetoId: PROJ_A, tipo: 'perimetros', status: 'finalizada', meta: { completude: 90 }, createdAt: new Date('2026-03-01T15:00:00Z') },
    { id: 'av-3', pacienteId: 'pac-b', projetoId: PROJ_A, tipo: 'perimetros', status: 'rascunho', meta: { completude: 50 }, createdAt: new Date('2026-09-29T15:00:00Z') },
    // 26/09 02:00 UTC = 25/09 23:00 em Brasília: semana anterior.
    { id: 'av-5', pacienteId: 'pac-b', projetoId: PROJ_A, tipo: 'perimetros', status: 'finalizada', meta: { completude: 85 }, createdAt: new Date('2026-09-26T02:00:00Z') },
    { id: 'av-6', pacienteId: 'pac-d', projetoId: PROJ_B, tipo: 'bioimpedancia', status: 'finalizada', meta: { completude: 95 }, createdAt: new Date('2026-09-30T15:00:00Z') }
  ],
  agendamentos: [
    { id: 'ag-1', pacienteId: 'pac-a', date: '2026-09-30', time: '09:00', status: 'realizada' },
    { id: 'ag-2', pacienteId: 'pac-b', date: '2026-10-01', time: '10:00', status: 'falta' },
    { id: 'ag-3', pacienteId: 'pac-a', date: '2026-09-22', time: '09:00', status: 'realizada' },
    { id: 'ag-4', pacienteId: 'pac-b', date: '2026-09-23', time: '09:00', status: 'realizada' },
    { id: 'ag-5', pacienteId: 'pac-d', date: '2026-09-30', time: '09:00', status: 'realizada' }
  ]
};

const ADMIN = { id: 'admin-sintetico', role: 'admin', permissions: [] };
const COMUNICACAO = { id: 'comunicacao-sintetica', role: 'aluno', permissions: ['marketing:create'], projetoId: PROJ_A };

const overviewDe = async (range: string, projectId: string) => (
  await criarServico(BASE).getReportsOverview({ range, projectId, forceRefresh: true })
) as Overview;

describe('WI-016 relatórios: período no calendário de São Paulo', () => {
  it('cada filtro vira um período com início, fim e o anterior do mesmo tamanho', () => {
    const semana = resolveReportPeriods('week', NOW);
    expect(semana.current.startDate).toBe('2026-09-26');
    expect(semana.current.endDate).toBe('2026-10-02');
    expect(semana.current.days).toBe(7);
    expect(semana.previous.startDate).toBe('2026-09-19');
    expect(semana.previous.endDate).toBe('2026-09-25');

    const mes = resolveReportPeriods('month', NOW);
    expect(mes.current.startDate).toBe('2026-10-01');
    expect(mes.current.endDate).toBe('2026-10-02');
    expect(mes.previous.startDate).toBe('2026-09-29');
    expect(mes.previous.endDate).toBe('2026-09-30');

    const ano = resolveReportPeriods('year', NOW);
    expect(ano.current.startDate).toBe('2026-01-01');
    expect(ano.current.days).toBe(275);
    expect(ano.previous.startDate).toBe('2025-04-01');
    expect(ano.previous.endDate).toBe('2025-12-31');
    expect(ano.current.timeZone).toBe('America/Sao_Paulo');
  });

  it('perto da meia-noite, o dia é o de Brasília, não o UTC nem o do processo', async () => {
    await comProcessoEmUtc(() => {
      // 01/10 02:30 UTC = 30/09 23:30 em Brasília: ainda setembro.
      const quaseMeiaNoite = new Date('2026-10-01T02:30:00Z');
      expect(reportDayKey(quaseMeiaNoite)).toBe('2026-09-30');
      const mes = resolveReportPeriods('month', quaseMeiaNoite);
      expect(mes.current.startDate).toBe('2026-09-01');
      expect(mes.current.endDate).toBe('2026-09-30');
      const trimestre = resolveReportPeriods('quarter', quaseMeiaNoite);
      expect(trimestre.current.startDate).toBe('2026-07-01');
      expect(reportDayKey('2026-10-01')).toBe('2026-10-01');
    });
  });
});

describe('WI-016 relatórios: tendência só com base de comparação', () => {
  it('anterior zero ou ausente não tem direção; os demais comparam', () => {
    expect(buildMetricTrend(5, 0).direction).toBeNull();
    expect(buildMetricTrend(5, 0).deltaPercent).toBeNull();
    expect(buildMetricTrend(5, null).direction).toBeNull();
    expect(buildMetricTrend(3, 4)).toEqual({ current: 3, previous: 4, deltaPercent: -25, direction: 'down' });
    expect(buildMetricTrend(4, 4)).toEqual({ current: 4, previous: 4, deltaPercent: 0, direction: 'flat' });
    expect(buildMetricTrend(2, 1)).toEqual({ current: 2, previous: 1, deltaPercent: 100, direction: 'up' });
  });
});

describe('WI-016 relatórios: resumo separa situação atual e período', () => {
  it('todos os indicadores de fluxo respeitam a semana, no fuso de Brasília', async () => {
    await comProcessoEmUtc(async () => {
      const overview = await overviewDe('week', PROJ_A);
      expect(overview.period.startDate).toBe('2026-09-26');
      expect(overview.previousPeriod.endDate).toBe('2026-09-25');
      const m = overview.metrics;
      // Situação atual: o cadastro, sem período.
      expect(m.totalAlunos).toBe(2);
      expect(m.professores).toBe(1);
      expect(m.totalPacientes).toBe(3);
      expect(m.taxaVinculacao).toBe(67);
      // No período: av-5 (25/09 23:00 em Brasília) fica fora da semana.
      expect(m.avaliacoesPeriodo).toBe(2);
      expect(m.atendimentosRealizados).toBe(1);
      expect(m.novosAtletas).toBe(1);
      expect(m.retornos).toBe(2);
      expect(m.atletasAvaliados).toBe(2);
      expect(m.retencao).toBe(100);
      expect(m.integridade).toBe(50);
      expect(m.completionRate).toBe(50);
      expect(m.satisfacao).toBe(2.5);
    });
  });

  it('a tendência compara com a semana anterior e some sem base', async () => {
    await comProcessoEmUtc(async () => {
      const { trends } = await overviewDe('week', PROJ_A);
      expect(trends.avaliacoesPeriodo).toEqual({ current: 2, previous: 1, deltaPercent: 100, direction: 'up' });
      expect(trends.atendimentosRealizados).toEqual({ current: 1, previous: 2, deltaPercent: -50, direction: 'down' });
      expect(trends.novosAtletas).toEqual({ current: 1, previous: 1, deltaPercent: 0, direction: 'flat' });
      // Na semana anterior ninguém era retorno: sem base, sem seta.
      expect(trends.retornos.previous).toBe(0);
      expect(trends.retornos.direction).toBeNull();
    });
  });

  it('uso por tipo conta só as avaliações do período', async () => {
    const { usageByType } = await overviewDe('week', PROJ_A);
    const bio = usageByType.find((item) => item.key === 'bioimpedancia');
    const peri = usageByType.find((item) => item.key === 'perimetros');
    expect(bio?.count).toBe(1);
    expect(peri?.count).toBe(1);
    expect(peri?.percentage).toBe(50);
  });

  it('ausência vem null (sem valor), não 0', async () => {
    const overview = await overviewDe('week', 'sem');
    const m = overview.metrics;
    expect(m.totalPacientes).toBe(0);
    expect(m.avaliacoesPeriodo).toBe(0);
    expect(m.taxaVinculacao).toBeNull();
    expect(m.integridade).toBeNull();
    expect(m.completionRate).toBeNull();
    expect(m.satisfacao).toBeNull();
    expect(m.retencao).toBeNull();
    expect(overview.usageByType.every((item) => item.percentage === null)).toBe(true);
    expect(overview.trends.avaliacoesPeriodo.direction).toBeNull();
  });

  it('alunos e supervisores têm o mesmo sentido com e sem filtro de projeto', async () => {
    const todos = await overviewDe('week', 'all');
    // Responsáveis distintos entre os atletas (aluno-1, aluno-2, aluno-3), e
    // não os 4 usuários com papel estudantil.
    expect(todos.metrics.totalAlunos).toBe(3);
    expect(todos.metrics.professores).toBe(2);
    expect(todos.metricDefinitions.totalAlunos.group).toBe('situacao_atual');
    expect(todos.metricDefinitions.avaliacoesPeriodo.group).toBe('no_periodo');
  });
});

describe('WI-016 relatórios: trimestral no período e sem meta', () => {
  it('trimestres do calendário, recortados pelo período, com meta sempre null', async () => {
    await comProcessoEmUtc(async () => {
      const { quarterly } = await overviewDe('week', PROJ_A);
      expect(quarterly).toHaveLength(4);
      expect(quarterly.map((q) => `${q.period}/${q.ano}`)).toEqual(['Jan-Mar/2026', 'Abr-Jun/2026', 'Jul-Set/2026', 'Out-Dez/2026']);
      const [q1, , q3, q4] = quarterly;
      expect(q1.noPeriodo).toBe(false);
      expect(q1.avaliacoes).toBeNull();
      expect(q3.inicio).toBe('2026-09-26');
      expect(q3.fim).toBe('2026-09-30');
      expect(q3.parcial).toBe(true);
      expect(q3.avaliacoes).toBe(2);
      expect(q3.pacientes).toBe(1);
      expect(q3.atendimentos).toBe(1);
      expect(q3.alunos).toBe(1);
      expect(q4.avaliacoes).toBe(0);
      expect(quarterly.every((q) => q.meta === null)).toBe(true);
    });
  });

  it('no ano, a soma dos trimestres é o total do período', async () => {
    const overview = await overviewDe('year', PROJ_A);
    const soma = overview.quarterly.reduce((total, q) => total + (q.avaliacoes || 0), 0);
    expect(soma).toBe(overview.metrics.avaliacoesPeriodo);
    expect(soma).toBe(4);
  });
});

describe('WI-016 relatórios: exportação respeita período e projeto', () => {
  it('JSON detalhado traz só o período e o projeto', async () => {
    await comProcessoEmUtc(async () => {
      const resultado = await criarServico(BASE).exportReports(
        { range: 'week', projectId: PROJ_A, anonymize: 'false', format: 'json' },
        ADMIN
      );
      const dados = JSON.parse(await lerStream(resultado.stream));
      expect(dados.period.startDate).toBe('2026-09-26');
      expect(dados.pacientes.map((item: Linha) => item.id).sort()).toEqual(['pac-a', 'pac-b']);
      expect(dados.avaliacoes.map((item: Linha) => item.id).sort()).toEqual(['av-1', 'av-3']);
      expect(dados.agendamentos.map((item: Linha) => item.id).sort()).toEqual(['ag-1', 'ag-2']);
    });
  });

  it('CSV detalhado anonimizado tem as mesmas linhas do período', async () => {
    await comProcessoEmUtc(async () => {
      const resultado = await criarServico(BASE).exportReports(
        { range: 'week', projectId: PROJ_A, anonymize: 'true', format: 'csv' },
        ADMIN
      );
      const linhas = (await lerStream(resultado.stream)).replace(/^﻿/, '').trim().split('\n');
      const contar = (tipo: string) => linhas.filter((linha) => linha.startsWith(`"${tipo}"`)).length;
      expect(linhas).toHaveLength(7);
      expect(contar('paciente')).toBe(2);
      expect(contar('avaliacao')).toBe(2);
      expect(contar('consulta')).toBe(2);
      expect(linhas.some((linha) => linha.includes('pac-a'))).toBe(false);
    });
  });

  it('exportação agregada (sem leitura detalhada) escreve o período', async () => {
    const resultado = await criarServico(BASE).exportReports(
      { range: 'week', projectId: 'all', format: 'csv' },
      COMUNICACAO
    );
    const texto = await lerStream(resultado.stream);
    expect(texto).toMatch(/"periodo_inicio","2026-09-26"/);
    expect(texto).toMatch(/"periodo_fim","2026-10-02"/);
    // O escopo de quem não é admin é o próprio projeto (A), não "all".
    expect(texto).toMatch(/"avaliacoesPeriodo","2"/);
    expect(texto).toMatch(/"totalPacientes","3"/);
    const json = await criarServico(BASE).exportReports({ range: 'week', projectId: 'all', format: 'json' }, COMUNICACAO);
    const agregado = JSON.parse(await lerStream(json.stream));
    expect(agregado.filters.projectId).toBe(PROJ_A);
    expect(agregado.pacientes === undefined).toBe(true);
  });
});

// ── Drivers: 9 consultas na semana do projeto C ──────────────────────────
const pacientesC = Array.from({ length: 10 }, (_, index) => ({
  id: `pac-c${index + 1}`,
  projetoId: PROJ_C,
  alunoResponsavelId: null,
  status: 'ativo',
  dataCadastro: new Date('2026-01-05T15:00:00Z')
}));
const DRIVERS: Dados = {
  pacientes: pacientesC,
  agendamentos: [
    // Manhã: 6 consultas, 2 faltas (33,3%).
    ...[1, 2, 3, 4, 5, 6].map((n) => ({ id: `ag-m${n}`, pacienteId: `pac-c${n}`, date: '2026-09-29', time: '09:00', status: n <= 2 ? 'falta' : 'realizada' })),
    // Tarde: 3 consultas, todas falta (100%), grupo pequeno.
    ...[7, 8, 9].map((n) => ({ id: `ag-t${n}`, pacienteId: `pac-c${n}`, date: '2026-09-29', time: '14:00', status: 'falta' }))
  ]
};

describe('WI-016 relatórios: drivers com n e grupo mínimo', () => {
  it('grupo com menos de 5 fica só no detalhe, marcado como amostra pequena', async () => {
    const correlacoes = await correlacoesDe(DRIVERS, 'week', PROJ_C);
    const tarde = correlacoes.absenteeism.byTurn.find((item) => item.key === 'tarde');
    expect(tarde?.sampleSize).toBe(3);
    expect(tarde?.smallSample).toBe(true);
    const turno = correlacoes.drivers.find((item) => item.id === 'absenteeism_turn');
    expect(turno?.title).toBe('Turno critico: Manha');
    expect(turno?.sampleSize).toBe(6);
    expect(turno?.sampleUnit).toBe('consultas');
    expect(correlacoes.drivers.every((item) => Number(item.sampleSize) >= MIN_HIGHLIGHT_SAMPLE)).toBe(true);
    expect(correlacoes.alerts.length).toBeGreaterThan(0);
    expect(correlacoes.alerts.every((item) => Number(item.sampleSize) >= MIN_HIGHLIGHT_SAMPLE)).toBe(true);
  });

  it('a base analisada conta só atletas com atividade no período', async () => {
    const correlacoes = await correlacoesDe(DRIVERS, 'week', PROJ_C);
    expect(correlacoes.dataset).toEqual({ patients: 9, evaluations: 0, appointments: 9 });
    expect(correlacoes.period.startDate).toBe('2026-09-26');
  });

  it('quem não tem leitura detalhada recebe o período e nenhum responsável', async () => {
    const resultado = {
      generatedAt: NOW.toISOString(),
      filters: { range: 'week', projectId: PROJ_A },
      period: { startDate: '2026-09-26', endDate: '2026-10-02' },
      dataset: { patients: 1, evaluations: 1, appointments: 1 },
      absenteeism: { byTurn: [], byLeadTime: [], byAppointmentType: [], byProject: [], byResponsible: [{ label: 'Aluno Sintético', sampleSize: 6 }] },
      completeness: { byResponsible: [{ label: 'Aluno Sintético', sampleSize: 6 }] },
      retention: { byResponsible: [{ label: 'Aluno Sintético', sampleSize: 6 }] },
      drivers: [],
      alerts: [],
      cache: { hit: false, ttlSeconds: 45 }
    };
    let pedido: Linha = {};
    const controller = new AnalyticsController({
      getCorrelations: async (query: Linha) => { pedido = query; return resultado; }
    } as never);
    const resposta = await controller.correlations({ user: COMUNICACAO }, 'week', 'false', 'all');
    expect(pedido.projectId).toBe(PROJ_A);
    expect(resposta.period).toEqual(resultado.period);
    expect(resposta.absenteeism.byResponsible).toHaveLength(0);
    expect(resposta.completeness.byResponsible).toHaveLength(0);
  });
});
