import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import { Avaliacao } from '../avaliacoes/avaliacao.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { normalizeAvaliacaoTipo } from '../avaliacoes/evaluation-registry';
import { ROTULO_CLASSIFICACAO_DE } from '../avaliacoes/normalizers/triagem-reds-normalizer';
import { resolveReportPeriods } from './analytics.service';

/*
 * Perfil dos atletas atendidos (WI-016, etapa 2). So agregados: nenhuma
 * linha por pessoa, nenhum id, nenhum nome sai daqui. Toda celula com n entre
 * 1 e 4 vira null (decisao 3), com supressao complementar, e o bloco com
 * denominador abaixo de 5 sai inteiro suprimido. Cada instrumento usa so a
 * propria avaliacao finalizada mais recente no periodo (WI-007): nada e
 * combinado entre tipos.
 */

export const GRUPO_MINIMO = 5;
export const FUSO_RELATORIOS = 'America/Sao_Paulo';
const RANGES_RELATORIO = ['week', 'month', 'quarter', 'year'] as const;
export type RangeRelatorio = typeof RANGES_RELATORIO[number];

export type PeriodoRelatorio = {
  range: RangeRelatorio;
  inicio: string;
  fim: string;
  fuso: typeof FUSO_RELATORIOS;
};

/* ---------- Periodo civil em Sao Paulo (compartilhado com a producao) ---------- */

const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;
const formatoDia = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO_RELATORIOS, year: 'numeric', month: '2-digit', day: '2-digit'
});

export const diaCivilSaoPaulo = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && ISO_DIA.test(value)) return value;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  const parts = formatoDia.formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

// O mesmo periodo dos indicadores da tela (resolveReportPeriods, etapa 1):
// ultimos 7 dias, ou do primeiro dia do mes, do trimestre ou do ano ate hoje,
// no dia de Sao Paulo. Termina hoje: o que tem data depois de hoje nao conta.
export const resolverPeriodoRelatorio = (rangeInput?: string, now = new Date()): PeriodoRelatorio => {
  const range = String(rangeInput || 'month').trim().toLowerCase();
  if (!(RANGES_RELATORIO as readonly string[]).includes(range)) {
    throw new BadRequestException('Periodo invalido para o relatorio.');
  }
  const { current } = resolveReportPeriods(range as RangeRelatorio, now);
  return { range: range as RangeRelatorio, inicio: current.startDate, fim: current.endDate, fuso: FUSO_RELATORIOS };
};

// Margem de um dia antes e dois depois nos limites UTC: cobre a data civil de
// Sao Paulo; o filtro exato por dia local vem depois, em memoria.
export const limitesUtcDoPeriodo = (periodo: PeriodoRelatorio) => ({
  inicio: new Date(Date.parse(`${periodo.inicio}T00:00:00Z`) - 86_400_000),
  fim: new Date(Date.parse(`${periodo.fim}T00:00:00Z`) + 172_800_000)
});

export const noPeriodo = (dia: string | null, periodo: PeriodoRelatorio) => (
  Boolean(dia) && (dia as string) >= periodo.inicio && (dia as string) <= periodo.fim
);

/* ---------- Supressao de grupos pequenos ---------- */

export type Celula = { chave: string; rotulo: string; n: number | null; suprimido: boolean };
export type Distribuicao = { denominador: number | null; suprimido: boolean; categorias: Celula[] };
type Contagem = { chave: string; rotulo: string; n: number };

const pequeno = (n: number) => n > 0 && n < GRUPO_MINIMO;

// Primaria: 1 a 4 sai como null. Complementar: com uma unica celula suprimida,
// o total deixaria deduzi-la; suprime-se tambem a menor celula nao nula seguinte.
export const suprimirCelulas = (contagens: Contagem[]): Celula[] => {
  const marcadas = contagens.map((item) => ({ ...item, suprimido: pequeno(item.n) }));
  if (marcadas.filter((item) => item.suprimido).length === 1) {
    const complementar = marcadas
      .filter((item) => !item.suprimido && item.n > 0)
      .sort((a, b) => a.n - b.n || a.chave.localeCompare(b.chave))[0];
    if (complementar) complementar.suprimido = true;
  }
  return marcadas.map(({ chave, rotulo, n, suprimido }) => ({ chave, rotulo, n: suprimido ? null : n, suprimido }));
};

export const montarDistribuicao = (contagens: Contagem[], denominador: number): Distribuicao => {
  if (pequeno(denominador)) return { denominador: null, suprimido: true, categorias: [] };
  if (denominador === 0) return { denominador: 0, suprimido: false, categorias: [] };
  return { denominador, suprimido: false, categorias: suprimirCelulas(contagens) };
};

/* ---------- Escalas: as classificacoes que os normalizadores ja gravam ---------- */

type Escala = { chave: string; rotulo: string; tokens: string[] };

const SEM_CLASSIFICACAO = { chave: 'sem_classificacao', rotulo: 'Sem classificação registrada' };

const token = (value: unknown) => String(value ?? '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

// Rotulos de Lohman (dobras) e da bioimpedancia, como o formulario grava.
// Cada metodo usa a propria referencia; aqui so se agrupa o texto gravado.
const ESCALA_COMPOSICAO: Escala[] = [
  { chave: 'muito_baixo', rotulo: 'Muito baixo', tokens: ['muito_baixo'] },
  { chave: 'baixo', rotulo: 'Baixo', tokens: ['baixo'] },
  { chave: 'adequado', rotulo: 'Adequado', tokens: ['adequado'] },
  { chave: 'levemente_elevado', rotulo: 'Levemente elevado', tokens: ['levemente_elevado'] },
  { chave: 'atencao', rotulo: 'Atenção', tokens: ['atencao'] },
  { chave: 'elevado', rotulo: 'Elevado', tokens: ['elevado'] }
];

// Chaves neutras: o codigo gravado (otima/risco_relativo/reds_estabelecido)
// nao sai do servidor, so o rotulo do glossario.
const ESCALA_DE: Escala[] = [
  { chave: 'adequada', rotulo: ROTULO_CLASSIFICACAO_DE.otima, tokens: ['otima', token(ROTULO_CLASSIFICACAO_DE.otima)] },
  { chave: 'reduzida', rotulo: ROTULO_CLASSIFICACAO_DE.risco_relativo, tokens: ['risco_relativo', token(ROTULO_CLASSIFICACAO_DE.risco_relativo)] },
  { chave: 'baixa', rotulo: ROTULO_CLASSIFICACAO_DE.reds_estabelecido, tokens: ['reds_estabelecido', token(ROTULO_CLASSIFICACAO_DE.reds_estabelecido)] }
];

const ESCALA_EBIA: Escala[] = [
  { chave: 'seguranca', rotulo: 'Segurança alimentar', tokens: ['sa', 'seguranca_alimentar'] },
  { chave: 'leve', rotulo: 'Insegurança alimentar leve', tokens: ['il', 'inseguranca_alimentar_leve'] },
  { chave: 'moderada', rotulo: 'Insegurança alimentar moderada', tokens: ['im', 'inseguranca_alimentar_moderada'] },
  { chave: 'grave', rotulo: 'Insegurança alimentar grave', tokens: ['ig', 'inseguranca_alimentar_grave'] }
];

const ESCALA_NOVA: Escala[] = [
  { chave: 'saudavel', rotulo: 'Padrão saudável', tokens: ['padrao_saudavel'] },
  { chave: 'moderado', rotulo: 'Padrão moderado', tokens: ['padrao_moderado'] },
  { chave: 'risco', rotulo: 'Padrão de risco', tokens: ['padrao_de_risco'] },
  { chave: 'alto_risco', rotulo: 'Padrão de alto risco', tokens: ['padrao_de_alto_risco'] }
];

const ESCALA_HIDRATACAO: Escala[] = [
  { chave: 'sem_perda', rotulo: 'Sem perda relevante', tokens: ['sem_perda_relevante'] },
  { chave: 'leve', rotulo: 'Leve desidratação', tokens: ['leve_desidratacao'] },
  { chave: 'moderada', rotulo: 'Desidratação moderada', tokens: ['desidratacao_moderada'] },
  { chave: 'importante', rotulo: 'Desidratação importante', tokens: ['desidratacao_importante'] }
];

const classificarNaEscala = (escala: Escala[], valores: unknown[]) => {
  for (const valor of valores) {
    const t = token(valor);
    if (!t) continue;
    const item = escala.find((entrada) => entrada.tokens.includes(t));
    if (item) return item.chave;
  }
  return SEM_CLASSIFICACAO.chave;
};

// Escala fechada: todas as faixas aparecem, inclusive com zero; "sem
// classificacao" so quando houver. Escala aberta: so faixas com alguem.
const contarNaEscala = (escala: Escala[], chaves: string[], fechada: boolean): Contagem[] => {
  const total = (chave: string) => chaves.filter((item) => item === chave).length;
  const itens = escala.map(({ chave, rotulo }) => ({ chave, rotulo, n: total(chave) }));
  const semClassificacao = { ...SEM_CLASSIFICACAO, n: total(SEM_CLASSIFICACAO.chave) };
  return [...(fechada ? itens : itens.filter((item) => item.n > 0)), ...(semClassificacao.n > 0 ? [semClassificacao] : [])];
};

/* ---------- Leitura das avaliacoes ---------- */

export type AvaliacaoPerfilRow = Pick<Avaliacao, 'pacienteId' | 'tipo' | 'status' | 'projetoId' | 'data' | 'createdAt'
  | 'classificacao' | 'classificacaoLabel' | 'resultados'>;
export type PacientePerfilRow = Pick<Paciente, 'id' | 'dataNascimento' | 'sexoBiologico' | 'modalidadePrincipal'>;

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

const TIPOS_COMPOSICAO = ['dobras_cutaneas', 'bioimpedancia'] as const;
const ROTULO_METODO: Record<string, string> = { dobras_cutaneas: 'Dobras cutâneas', bioimpedancia: 'Bioimpedância' };

const valoresClassificacao = (row: AvaliacaoPerfilRow, tipo: string): unknown[] => {
  const resultados = asRecord(row.resultados);
  const output = asRecord(resultados.output);
  if (tipo === 'triagem_reds') return [resultados.classificacaoDE, output.classificacaoDE, row.classificacao];
  if (tipo === 'hidratacao') return [row.classificacao, output.classificacaoHidrica, resultados.classificacaoHidrica];
  if (tipo === 'dobras_cutaneas' || tipo === 'bioimpedancia') {
    return [row.classificacao, row.classificacaoLabel, resultados.classificacao_percentual_gordura,
      output.classificacaoPercentualGordura, output.classificacaoGordura];
  }
  return [row.classificacao, output.classificacao, resultados.classificacao, row.classificacaoLabel];
};

const diaDaAvaliacao = (row: AvaliacaoPerfilRow) => diaCivilSaoPaulo(row.data) || diaCivilSaoPaulo(row.createdAt);

const noEscopo = (row: AvaliacaoPerfilRow, projectId: string) => {
  if (projectId === 'all') return true;
  if (projectId === 'sem') return !row.projetoId;
  return row.projetoId === projectId;
};

type AvaliacaoNoPeriodo = { pacienteId: string; tipo: string; dia: string; criadoEm: number; row: AvaliacaoPerfilRow };

const maisRecente = (a: AvaliacaoNoPeriodo, b: AvaliacaoNoPeriodo) => (
  a.dia !== b.dia ? (a.dia > b.dia ? a : b) : (a.criadoEm >= b.criadoEm ? a : b)
);

const ultimaPorPaciente = (lista: AvaliacaoNoPeriodo[], tipos: readonly string[]) => {
  const porPaciente = new Map<string, AvaliacaoNoPeriodo>();
  for (const item of lista) {
    if (!tipos.includes(item.tipo)) continue;
    const atual = porPaciente.get(item.pacienteId);
    porPaciente.set(item.pacienteId, atual ? maisRecente(atual, item) : item);
  }
  return [...porPaciente.values()];
};

/* ---------- Quem sao ---------- */

const SEXOS = [
  { chave: 'feminino', rotulo: 'Feminino' },
  { chave: 'masculino', rotulo: 'Masculino' }
];
const SEXO_NAO_INFORMADO = { chave: 'nao_informado', rotulo: 'Não informado no cadastro' };

// Sexo biologico do cadastro; identidade de genero nao entra (paciente.entity).
const sexoDoPaciente = (paciente?: PacientePerfilRow) => {
  const t = token(paciente?.sexoBiologico);
  if (t.startsWith('fem') || t === 'f' || t === 'female') return 'feminino';
  if (t.startsWith('masc') || t === 'm' || t === 'male') return 'masculino';
  return SEXO_NAO_INFORMADO.chave;
};

const contarSexos = (sexos: string[]): Contagem[] => {
  const total = (chave: string) => sexos.filter((item) => item === chave).length;
  const naoInformado = total(SEXO_NAO_INFORMADO.chave);
  return [
    ...SEXOS.map((item) => ({ ...item, n: total(item.chave) })),
    ...(naoInformado > 0 ? [{ ...SEXO_NAO_INFORMADO, n: naoInformado }] : [])
  ];
};

const FAIXAS_ETARIAS = [
  { chave: 'ate_17', rotulo: '17 anos ou menos', ate: 17 },
  { chave: '18_24', rotulo: '18 a 24 anos', ate: 24 },
  { chave: '25_34', rotulo: '25 a 34 anos', ate: 34 },
  { chave: '35_mais', rotulo: '35 anos ou mais', ate: Number.POSITIVE_INFINITY }
];
const SEM_NASCIMENTO = { chave: 'sem_data', rotulo: 'Data de nascimento não informada' };

const idadeEm = (nascimento: unknown, referencia: string): number | null => {
  const dia = diaCivilSaoPaulo(nascimento);
  if (!dia) return null;
  const [ano, mes, d] = dia.split('-').map(Number);
  const [refAno, refMes, refDia] = referencia.split('-').map(Number);
  const idade = refAno - ano - (refMes < mes || (refMes === mes && refDia < d) ? 1 : 0);
  return idade >= 0 && idade < 120 ? idade : null;
};

const faixaEtaria = (paciente: PacientePerfilRow | undefined, referencia: string) => {
  const idade = idadeEm(paciente?.dataNascimento, referencia);
  if (idade === null) return SEM_NASCIMENTO.chave;
  return (FAIXAS_ETARIAS.find((faixa) => idade <= faixa.ate) as typeof FAIXAS_ETARIAS[number]).chave;
};

const contarFaixasEtarias = (pacientes: Array<PacientePerfilRow | undefined>, referencia: string): Contagem[] => {
  const faixas = pacientes.map((paciente) => faixaEtaria(paciente, referencia));
  const total = (chave: string) => faixas.filter((item) => item === chave).length;
  const semData = total(SEM_NASCIMENTO.chave);
  return [
    ...FAIXAS_ETARIAS.map(({ chave, rotulo }) => ({ chave, rotulo, n: total(chave) })),
    ...(semData > 0 ? [{ ...SEM_NASCIMENTO, n: semData }] : [])
  ];
};

const MODALIDADES_NOMEADAS = 6;

// So modalidades com 5 ou mais atletas aparecem pelo nome; as demais vao
// para "Outras modalidades". Assim um nome raro nunca sai do servidor.
const contarModalidades = (pacientes: Array<PacientePerfilRow | undefined>): Contagem[] => {
  const grupos = new Map<string, { n: number; grafias: Map<string, number> }>();
  let naoInformada = 0;
  for (const paciente of pacientes) {
    const original = String(paciente?.modalidadePrincipal || '').trim().replace(/\s+/g, ' ');
    const chave = token(original);
    if (!chave) { naoInformada += 1; continue; }
    const grupo = grupos.get(chave) || { n: 0, grafias: new Map<string, number>() };
    grupo.n += 1;
    grupo.grafias.set(original, (grupo.grafias.get(original) || 0) + 1);
    grupos.set(chave, grupo);
  }
  const ordenados = [...grupos.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
  const nomeados = ordenados.filter(([, grupo]) => grupo.n >= GRUPO_MINIMO).slice(0, MODALIDADES_NOMEADAS);
  const nomeadosChaves = new Set(nomeados.map(([chave]) => chave));
  const outras = ordenados.filter(([chave]) => !nomeadosChaves.has(chave)).reduce((soma, [, grupo]) => soma + grupo.n, 0);
  const rotuloDe = (grafias: Map<string, number>) => [...grafias.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))[0][0];
  return [
    ...nomeados.map(([chave, grupo]) => ({ chave: `modalidade_${chave}`, rotulo: rotuloDe(grupo.grafias), n: grupo.n })),
    ...(outras > 0 ? [{ chave: 'outras', rotulo: 'Outras modalidades', n: outras }] : []),
    ...(naoInformada > 0 ? [{ chave: 'nao_informada', rotulo: 'Não informada', n: naoInformada }] : [])
  ];
};

/* ---------- Montagem do relatorio ---------- */

type MotivoBloco = 'grupo_pequeno' | 'sem_avaliacao' | null;
const motivoDe = (dist: Distribuicao): MotivoBloco => (
  dist.suprimido ? 'grupo_pequeno' : dist.denominador === 0 ? 'sem_avaliacao' : null
);

type BlocoClassificacao = Distribuicao & {
  titulo: string; descricao: string; instrumento: string; motivo: MotivoBloco; geradoEm: string;
};

const blocoClassificacao = (params: {
  titulo: string; descricao: string; instrumento: string; escala: Escala[];
  lista: AvaliacaoNoPeriodo[]; geradoEm: string;
}): BlocoClassificacao => {
  const ultimas = ultimaPorPaciente(params.lista, [params.instrumento]);
  const chaves = ultimas.map((item) => classificarNaEscala(params.escala, valoresClassificacao(item.row, item.tipo)));
  const dist = montarDistribuicao(contarNaEscala(params.escala, chaves, true), ultimas.length);
  return {
    titulo: params.titulo, descricao: params.descricao, instrumento: params.instrumento,
    ...dist, motivo: motivoDe(dist), geradoEm: params.geradoEm
  };
};

export type EscopoProjeto = 'todos' | 'sem_projeto' | 'projeto';

export const montarPerfilAtletas = (params: {
  avaliacoes: AvaliacaoPerfilRow[];
  pacientes: PacientePerfilRow[];
  periodo: PeriodoRelatorio;
  projectId: string;
  now?: Date;
}) => {
  const now = params.now || new Date();
  const geradoEm = now.toISOString();
  const hoje = diaCivilSaoPaulo(now) as string;
  const referenciaIdade = params.periodo.fim < hoje ? params.periodo.fim : hoje;
  const pacientes = new Map(params.pacientes.map((paciente) => [String(paciente.id), paciente]));

  // So entra quem ainda existe no cadastro: avaliacao de paciente excluido sai da conta.
  const lista: AvaliacaoNoPeriodo[] = [];
  for (const row of params.avaliacoes) {
    if (token(row.status) !== 'finalizada' || !noEscopo(row, params.projectId)) continue;
    const pacienteId = String(row.pacienteId || '');
    if (!pacientes.has(pacienteId)) continue;
    const dia = diaDaAvaliacao(row);
    if (!dia || !noPeriodo(dia, params.periodo)) continue;
    const criado = row.createdAt ? new Date(row.createdAt).getTime() : 0;
    lista.push({ pacienteId, tipo: normalizeAvaliacaoTipo(row.tipo), dia, criadoEm: Number.isFinite(criado) ? criado : 0, row });
  }

  // Quem sao: atletas com ao menos uma avaliacao finalizada no periodo.
  const populacao = [...new Set(lista.map((item) => item.pacienteId))].map((id) => pacientes.get(id));
  const quemSaoBase = montarDistribuicao([], populacao.length);
  const quemSaoAberto = !quemSaoBase.suprimido && populacao.length > 0;
  const quemSao = {
    titulo: 'Quem são',
    descricao: 'Atletas com pelo menos uma avaliação finalizada no período.',
    denominador: quemSaoBase.denominador,
    suprimido: quemSaoBase.suprimido,
    motivo: motivoDe(quemSaoBase),
    geradoEm,
    modalidade: quemSaoAberto
      ? montarDistribuicao(contarModalidades(populacao), populacao.length)
      : quemSaoBase,
    sexo: quemSaoAberto
      ? montarDistribuicao(contarSexos(populacao.map(sexoDoPaciente)), populacao.length)
      : quemSaoBase,
    faixaEtaria: quemSaoAberto
      ? montarDistribuicao(contarFaixasEtarias(populacao, referenciaIdade), populacao.length)
      : quemSaoBase
  };

  // Composicao: a mais recente de cada atleta entre dobras e bioimpedancia;
  // escolhe-se um registro, sem misturar valores dos dois metodos.
  const composicoes = ultimaPorPaciente(lista, TIPOS_COMPOSICAO);
  const composicaoBase = montarDistribuicao([], composicoes.length);
  const composicaoAberta = !composicaoBase.suprimido && composicoes.length > 0;
  const sexosComposicao = composicoes.map((item) => sexoDoPaciente(pacientes.get(item.pacienteId)));
  const gruposSexo = suprimirCelulas(contarSexos(sexosComposicao));
  const composicaoCorporal = {
    titulo: 'Composição corporal',
    descricao: 'Faixa de % de gordura da composição mais recente de cada atleta no período, por sexo.',
    instrumento: TIPOS_COMPOSICAO.join(','),
    denominador: composicaoBase.denominador,
    suprimido: composicaoBase.suprimido,
    motivo: motivoDe(composicaoBase),
    geradoEm,
    metodos: composicaoAberta
      ? montarDistribuicao(
        TIPOS_COMPOSICAO.map((tipo) => ({
          chave: tipo, rotulo: ROTULO_METODO[tipo], n: composicoes.filter((item) => item.tipo === tipo).length
        })),
        composicoes.length
      )
      : composicaoBase,
    porSexo: composicaoAberta
      ? gruposSexo.map((grupo) => {
        if (grupo.suprimido) return { chave: grupo.chave, rotulo: grupo.rotulo, denominador: null, suprimido: true, categorias: [] };
        const doGrupo = composicoes.filter((_, index) => sexosComposicao[index] === grupo.chave);
        const chaves = doGrupo.map((item) => classificarNaEscala(ESCALA_COMPOSICAO, valoresClassificacao(item.row, item.tipo)));
        return { chave: grupo.chave, rotulo: grupo.rotulo, ...montarDistribuicao(contarNaEscala(ESCALA_COMPOSICAO, chaves, false), doGrupo.length) };
      })
      : []
  };

  return {
    geradoEm,
    periodo: params.periodo,
    escopoProjeto: (params.projectId === 'all' ? 'todos' : params.projectId === 'sem' ? 'sem_projeto' : 'projeto') as EscopoProjeto,
    grupoMinimo: GRUPO_MINIMO,
    definicao: {
      populacao: 'Atletas com pelo menos uma avaliação finalizada no período, no escopo de projeto permitido.',
      instrumento: 'Cada bloco usa só a avaliação finalizada mais recente de cada atleta no período, do próprio tipo (na composição corporal, a mais recente entre dobras e bioimpedância); nada é combinado entre tipos.',
      supressao: `Grupos com 1 a ${GRUPO_MINIMO - 1} atletas não aparecem; quando só um grupo some, o menor seguinte também some para não ser deduzido pelo total.`,
      composicao: 'Cada método usa a própria referência de classificação gravada na avaliação; as faixas não são recalculadas aqui.'
    },
    blocos: {
      quemSao,
      composicaoCorporal,
      disponibilidadeEnergetica: blocoClassificacao({
        titulo: 'Disponibilidade energética',
        descricao: 'Classificação da triagem de disponibilidade energética mais recente de cada atleta.',
        instrumento: 'triagem_reds', escala: ESCALA_DE, lista, geradoEm
      }),
      insegurancaAlimentar: blocoClassificacao({
        titulo: 'Insegurança alimentar (EBIA)',
        descricao: 'Classificação da EBIA na avaliação socioeconômica mais recente de cada atleta.',
        instrumento: 'avaliacao_socioeconomica', escala: ESCALA_EBIA, lista, geradoEm
      }),
      padraoAlimentarNova: blocoClassificacao({
        titulo: 'Padrão alimentar (NOVA)',
        descricao: 'Padrão pela participação de ultraprocessados na avaliação alimentar mais recente de cada atleta.',
        instrumento: 'alimentar', escala: ESCALA_NOVA, lista, geradoEm
      }),
      hidratacao: blocoClassificacao({
        titulo: 'Hidratação',
        descricao: 'Perda de peso no exercício na avaliação de hidratação mais recente de cada atleta.',
        instrumento: 'hidratacao', escala: ESCALA_HIDRATACAO, lista, geradoEm
      })
    }
  };
};

export type PerfilAtletasRelatorio = ReturnType<typeof montarPerfilAtletas>;

const LOTE_PACIENTES = 500;

@Injectable()
export class AnalyticsPerfilService {
  constructor(
    @InjectRepository(Avaliacao) private readonly avaliacoesRepo: Repository<Avaliacao>,
    @InjectRepository(Paciente) private readonly pacientesRepo: Repository<Paciente>
  ) {}

  async getPerfilAtletas(params: { periodo: PeriodoRelatorio; projectId: string; now?: Date }): Promise<PerfilAtletasRelatorio> {
    const avaliacoes = await this.buscarAvaliacoes(params.periodo, params.projectId);
    const ids = [...new Set(avaliacoes.map((row) => String(row.pacienteId || '')).filter(Boolean))];
    const pacientes = await this.buscarPacientes(ids);
    return montarPerfilAtletas({ avaliacoes, pacientes, periodo: params.periodo, projectId: params.projectId, now: params.now });
  }

  private buscarAvaliacoes(periodo: PeriodoRelatorio, projectId: string): Promise<AvaliacaoPerfilRow[]> {
    const base: FindOptionsWhere<Avaliacao> = { status: 'finalizada' };
    if (projectId === 'sem') base.projetoId = IsNull();
    else if (projectId !== 'all') base.projetoId = projectId;
    const limites = limitesUtcDoPeriodo(periodo);
    return this.avaliacoesRepo.find({
      where: [
        { ...base, data: Between(periodo.inicio, periodo.fim) },
        { ...base, data: IsNull(), createdAt: Between(limites.inicio, limites.fim) }
      ],
      select: {
        pacienteId: true, tipo: true, status: true, projetoId: true, data: true, createdAt: true,
        classificacao: true, classificacaoLabel: true, resultados: true
      }
    });
  }

  private async buscarPacientes(ids: string[]): Promise<PacientePerfilRow[]> {
    const lotes: string[][] = [];
    for (let i = 0; i < ids.length; i += LOTE_PACIENTES) lotes.push(ids.slice(i, i + LOTE_PACIENTES));
    const resultados = await Promise.all(lotes.map((lote) => this.pacientesRepo.find({
      where: { id: In(lote) },
      select: { id: true, dataNascimento: true, sexoBiologico: true, modalidadePrincipal: true }
    })));
    return resultados.flat();
  }
}
