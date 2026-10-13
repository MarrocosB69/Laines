import { ForbiddenException } from '@nestjs/common';
import { AnalyticsProducaoService, ItemProducao } from './analytics-producao.service';
import { resolverPeriodoRelatorio } from './analytics-perfil.service';
import { AnalyticsRelatoriosExtraController } from './analytics-relatorios-extra.controller';

/*
 * WI-016, etapa 3. Dados sinteticos. Os repositorios falsos devolvem todas as
 * linhas, ignorando o `where`: o recorte exato do periodo (dia civil de Sao
 * Paulo), da categoria e da situacao e provado pelo filtro em memoria.
 */

const NOW = new Date('2026-10-15T15:00:00Z');
const PERIODO = resolverPeriodoRelatorio('month', NOW); // 2026-10-01 a 2026-10-15 (hoje)

const conteudo = (categoria: string, status: string, data: string | null, createdAt = '2026-10-10T12:00:00Z') => ({
  categoria, status, data, createdAt: new Date(createdAt), titulo: 'Titulo sintetico', criadoPorNome: 'Pessoa Sintetica'
});

const CONTEUDOS = [
  conteudo('reunioes_cientificas', 'publicado', '2026-10-05'),
  conteudo('reunioes_cientificas', 'aprovado', '2026-10-06'),
  conteudo('reunioes_cientificas', 'em_andamento', '2026-10-07'),
  conteudo('reunioes_cientificas', 'rascunho', '2026-10-08'),
  conteudo('reunioes_cientificas', 'publicado', '2026-09-30'),
  // Sem data: vale a criacao no dia de Sao Paulo. 02:00 UTC de 1/10 ainda e 30/09.
  conteudo('reunioes_cientificas', 'publicado', null, '2026-10-01T02:00:00Z'),
  // 02:30 UTC de 16/10 ainda e 15/10 (hoje) em Sao Paulo: entra.
  conteudo('reunioes_cientificas', 'pendente', null, '2026-10-16T02:30:00Z'),
  // O periodo termina hoje: item marcado para amanha (16/10) ainda nao conta.
  conteudo('reunioes_cientificas', 'publicado', '2026-10-16'),
  conteudo('capacitacoes', 'pendente_aprovacao', '2026-10-15'),
  conteudo('capacitacoes', 'arquivado', '2026-10-15'),
  conteudo('capacitacoes', 'publicado', '2026-10-28'),
  conteudo('comunicados_marketing', 'publicado', '2026-10-02'),
  conteudo('materiais_marketing', 'em_andamento', null, '2026-10-03T12:00:00Z'),
  conteudo('comunicados_pesquisa', 'publicado', '2026-10-02')
];

const triagem = (createdAt: string, confirmacaoAtleta: Record<string, unknown>) => ({
  createdAt: new Date(createdAt), dataCadastro: new Date(createdAt), confirmacaoAtleta, nome: 'Inscrito Sintetico'
});

const TRIAGENS = [
  triagem('2026-10-03T12:00:00Z', { origem: 'inscricao_publica', origens: ['inscricao_publica'], inscritoEm: '2026-10-03T12:00:00Z' }),
  triagem('2026-10-09T12:00:00Z', { origem: 'equipe', origens: ['inscricao_publica', 'equipe'], inscritoEm: '2026-10-09T12:00:00Z' }),
  triagem('2026-10-11T12:00:00Z', { origem: 'equipe', inscricaoPublica: { atualizadoEm: '2026-10-11T12:00:00Z', dados: { x: 1 } } }),
  triagem('2026-10-12T12:00:00Z', { origem: 'equipe', origens: ['equipe'] }),
  triagem('2026-10-01T01:00:00Z', { origem: 'inscricao_publica', inscritoEm: '2026-10-01T01:00:00Z' })
];

const PROJETOS = [
  { status: 'em_andamento' }, { status: 'em_andamento' }, { status: 'planejamento' },
  { status: 'pausado' }, { status: 'concluido' }
];

const PRODUCOES = [
  { status: 'publicado', createdAt: new Date('2026-10-02T12:00:00Z') },
  { status: 'em_revisao', createdAt: new Date('2026-10-12T12:00:00Z') },
  { status: 'em_revisao', createdAt: new Date('2026-10-13T12:00:00Z') },
  { status: 'publicado', createdAt: new Date('2026-08-13T12:00:00Z') }
];

const IDEIAS = [
  { status: 'ideia', createdAt: new Date('2026-10-02T12:00:00Z') },
  { status: 'ideia', createdAt: new Date('2026-10-03T12:00:00Z') },
  { status: 'arquivada', createdAt: new Date('2026-10-04T12:00:00Z') },
  { status: 'em_votacao', createdAt: new Date('2026-10-05T12:00:00Z') },
  { status: 'ideia', createdAt: new Date('2025-10-05T12:00:00Z') }
];

const repo = (linhas: unknown[] | Error) => ({
  find: async () => { if (linhas instanceof Error) throw linhas; return linhas; }
});

const criar = (fontes: Partial<Record<'conteudos' | 'triagens' | 'projetos' | 'producoes' | 'ideias', unknown[] | Error>> = {}) => {
  const service = new AnalyticsProducaoService(
    repo(fontes.conteudos ?? CONTEUDOS) as never,
    repo(fontes.triagens ?? TRIAGENS) as never,
    repo(fontes.projetos ?? PROJETOS) as never,
    repo(fontes.producoes ?? PRODUCOES) as never,
    repo(fontes.ideias ?? IDEIAS) as never
  );
  // O aviso de fonte indisponivel vai para o log do Nest; silencia no teste.
  Object.assign(service, { logger: { warn: () => undefined } });
  return service;
};

const item = (relatorio: Awaited<ReturnType<AnalyticsProducaoService['getProducao']>>, area: string, chave: string) => (
  relatorio.areas.find((a) => a.chave === area)?.itens.find((i) => i.chave === chave) as ItemProducao
);
const situacao = (linha: ItemProducao, chave: string) => linha.porSituacao.find((s) => s.chave === chave)?.n;

describe('Producao da liga: contagens por area no periodo', () => {
  it('ensino, extensao e comunicacao contam conteudos do periodo pela situacao', async () => {
    const r = await criar().getProducao({ periodo: PERIODO, now: NOW });
    expect(r.areas.map((a) => a.chave)).toEqual(['ensino', 'extensao', 'comunicacao', 'pesquisa']);

    const reunioes = item(r, 'ensino', 'reunioes_cientificas');
    expect(reunioes.total).toBe(4);
    expect(situacao(reunioes, 'publicado')).toBe(2);
    expect(situacao(reunioes, 'em_andamento')).toBe(2);
    expect(reunioes.fonteDisponivel).toBe(true);

    // Fonte respondeu e nao ha item: zero e zero.
    expect(item(r, 'ensino', 'materiais_ensino').total).toBe(0);

    const capacitacoes = item(r, 'extensao', 'capacitacoes');
    expect(capacitacoes.total).toBe(1);
    expect(situacao(capacitacoes, 'em_andamento')).toBe(1);
    expect(item(r, 'extensao', 'materiais_extensao').total).toBe(0);
    expect(item(r, 'comunicacao', 'comunicados_marketing').total).toBe(1);
    expect(item(r, 'comunicacao', 'materiais_marketing').total).toBe(1);
  });

  it('triagens publicas contam pela origem gravada pela inscricao publica', async () => {
    const r = await criar().getProducao({ periodo: PERIODO, now: NOW });
    const triagens = item(r, 'extensao', 'triagens_publicas');
    expect(triagens.total).toBe(3);
    expect(triagens.recorte).toBe('periodo');
  });

  it('pesquisa: projetos ativos na situacao atual, producoes e ideias do periodo por situacao', async () => {
    const r = await criar().getProducao({ periodo: PERIODO, now: NOW });
    const projetos = item(r, 'pesquisa', 'projetos_ativos');
    expect(projetos.total).toBe(3);
    expect(projetos.recorte).toBe('situacao_atual');
    expect(projetos.porSituacao.map((s) => [s.chave, s.n])).toEqual([
      ['em_andamento', 2], ['planejamento', 1], ['pausado', 1], ['concluido', 1]
    ]);
    const producoes = item(r, 'pesquisa', 'producoes');
    expect(producoes.total).toBe(3);
    expect(situacao(producoes, 'publicado')).toBe(1);
    expect(situacao(producoes, 'em_revisao')).toBe(2);
    expect(situacao(producoes, 'rascunho')).toBe(0);
    const ideias = item(r, 'pesquisa', 'ideias');
    expect(ideias.total).toBe(4);
    expect(situacao(ideias, 'ideia')).toBe(2);
    expect(situacao(ideias, 'outras')).toBe(1);
  });

  it('nenhum titulo, nome ou autor sai na resposta', async () => {
    const texto = JSON.stringify(await criar().getProducao({ periodo: PERIODO, now: NOW }));
    expect(texto.includes('sintetic')).toBe(false);
    expect(texto.includes('Sintetic')).toBe(false);
  });
});

describe('Producao da liga: ausencia e null, nunca 0', () => {
  it('fonte que falha vira null em total e em cada situacao; as outras seguem com numero', async () => {
    const r = await criar({ conteudos: new Error('tabela indisponivel') }).getProducao({ periodo: PERIODO, now: NOW });
    for (const [area, chave] of [['ensino', 'reunioes_cientificas'], ['ensino', 'materiais_ensino'], ['extensao', 'capacitacoes'], ['comunicacao', 'materiais_marketing']]) {
      const linha = item(r, area, chave);
      expect(linha.total).toBeNull();
      expect(linha.fonteDisponivel).toBe(false);
      expect(linha.porSituacao.every((s) => s.n === null)).toBe(true);
    }
    expect(item(r, 'extensao', 'triagens_publicas').total).toBe(3);
    expect(item(r, 'pesquisa', 'projetos_ativos').total).toBe(3);
  });

  it('cada fonte de pesquisa indisponivel vira null sozinha', async () => {
    const r = await criar({ projetos: new Error('x'), producoes: new Error('y'), ideias: new Error('z'), triagens: new Error('w') })
      .getProducao({ periodo: PERIODO, now: NOW });
    expect(item(r, 'pesquisa', 'projetos_ativos').total).toBeNull();
    expect(item(r, 'pesquisa', 'producoes').total).toBeNull();
    expect(item(r, 'pesquisa', 'ideias').total).toBeNull();
    expect(item(r, 'extensao', 'triagens_publicas').total).toBeNull();
    expect(item(r, 'ensino', 'reunioes_cientificas').total).toBe(4);
  });

  it('fontes vazias dao zero, nao null', async () => {
    const r = await criar({ conteudos: [], triagens: [], projetos: [], producoes: [], ideias: [] }).getProducao({ periodo: PERIODO, now: NOW });
    const totais = r.areas.flatMap((a) => a.itens.map((i) => i.total));
    expect(totais.every((t) => t === 0)).toBe(true);
  });
});

describe('Producao da liga: acesso igual ao dos Relatorios', () => {
  it('quem tem canAccessAnalyticsReports chama o servico; os demais recebem 403', async () => {
    let chamadas = 0;
    const controller = new AnalyticsRelatoriosExtraController({} as never, { getProducao: async () => { chamadas += 1; return {}; } } as never);
    const podem = [
      { id: 'p1', role: 'admin' },
      { id: 'p2', role: 'coordenacao' },
      { id: 'p3', role: 'aluno', permissions: ['marketing:create'] },
      { id: 'p4', role: 'presidente', permissions: ['research:manage'] }
    ];
    const naoPodem = [
      { id: 'n1', role: 'aluno' },
      { id: 'n2', role: 'presidente' },
      { id: 'n3', role: 'professor' },
      { id: 'n4', role: 'atleta' },
      { id: 'n5', role: 'coord_atendimento' },
      { id: 'n6', role: 'aluno', permissions: ['ensino:create'] }
    ];
    for (const user of podem) await controller.producao({ user }, 'month');
    expect(chamadas).toBe(podem.length);
    for (const user of naoPodem) {
      let erro: unknown = null;
      try { controller.producao({ user }, 'month'); } catch (error) { erro = error; }
      expect(erro instanceof ForbiddenException).toBe(true);
    }
    expect(chamadas).toBe(podem.length);
  });
});
