import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Repository } from 'typeorm';
import { Conteudo } from '../conteudos/conteudo.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { Projeto } from '../projetos/projeto.entity';
import { ProjetoIdeia } from '../projetos/projeto-ideia.entity';
import { ProjetoProducao } from '../projetos/projeto-producao.entity';
import { getCadastroAtletaOrigins } from '../pacientes/athlete-cadastro.utils';
import {
  PeriodoRelatorio,
  diaCivilSaoPaulo,
  limitesUtcDoPeriodo,
  noPeriodo
} from './analytics-perfil.service';

/*
 * Producao da liga (WI-016, etapa 3): contagens por area no periodo, sem
 * nenhum dado por pessoa. Uma fonte que nao pode ser lida vira null, nunca 0;
 * zero so quando a fonte respondeu e a contagem e de fato zero.
 */

export const CATEGORIAS_CONTEUDO = {
  reunioes_cientificas: 'Reuniões científicas',
  materiais_ensino: 'Materiais de ensino',
  capacitacoes: 'Capacitações',
  materiais_extensao: 'Materiais de extensão',
  comunicados_marketing: 'Comunicados',
  materiais_marketing: 'Materiais de comunicação'
} as const;
type CategoriaConteudo = keyof typeof CATEGORIAS_CONTEUDO;

export type Situacao = { chave: string; rotulo: string; n: number | null };
export type ItemProducao = {
  chave: string;
  rotulo: string;
  recorte: 'periodo' | 'situacao_atual';
  total: number | null;
  fonteDisponivel: boolean;
  porSituacao: Situacao[];
  definicao: string;
};
export type AreaProducao = { chave: 'ensino' | 'extensao' | 'comunicacao' | 'pesquisa'; rotulo: string; itens: ItemProducao[] };

export type ConteudoProducaoRow = Pick<Conteudo, 'categoria' | 'status' | 'data' | 'createdAt'>;
export type TriagemProducaoRow = Pick<Paciente, 'createdAt' | 'dataCadastro' | 'confirmacaoAtleta'>;
export type ProjetoProducaoRow = Pick<Projeto, 'status'>;
export type ProducaoPesquisaRow = Pick<ProjetoProducao, 'status' | 'createdAt'>;
export type IdeiaProducaoRow = Pick<ProjetoIdeia, 'status' | 'createdAt'>;

const token = (value: unknown) => String(value ?? '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

// Mesmos apelidos de ConteudosService.normalizeConteudoStatus.
const STATUS_CONTEUDO_ALIAS: Record<string, string> = {
  andamento: 'em_andamento',
  em_progresso: 'em_andamento',
  pendente: 'pendente_aprovacao',
  pendente_de_aprovacao: 'pendente_aprovacao',
  aprovado_publicado: 'publicado'
};
const situacaoConteudo = (status: unknown): string | null => {
  const t = token(status);
  const normalizado = STATUS_CONTEUDO_ALIAS[t] || t;
  if (normalizado === 'publicado' || normalizado === 'aprovado') return 'publicado';
  if (normalizado === 'em_andamento' || normalizado === 'pendente_aprovacao') return 'em_andamento';
  return null; // rascunho, arquivado e desconhecidos nao contam
};

const SITUACOES_CONTEUDO = [
  { chave: 'publicado', rotulo: 'Aprovados ou publicados' },
  { chave: 'em_andamento', rotulo: 'Em andamento ou aguardando aprovação' }
];

const SITUACOES_PROJETO = [
  { chave: 'em_andamento', rotulo: 'Em andamento' },
  { chave: 'planejamento', rotulo: 'Em planejamento' },
  { chave: 'pausado', rotulo: 'Pausados' },
  { chave: 'concluido', rotulo: 'Concluídos' }
];
const PROJETO_ATIVO = new Set(['em_andamento', 'planejamento']);

const SITUACOES_PRODUCAO = [
  { chave: 'publicado', rotulo: 'Publicadas' },
  { chave: 'em_revisao', rotulo: 'Em revisão' },
  { chave: 'rascunho', rotulo: 'Rascunho' }
];

const SITUACOES_IDEIA = [
  { chave: 'ideia', rotulo: 'Ideia' },
  { chave: 'em_discussao', rotulo: 'Em discussão' },
  { chave: 'prioridade', rotulo: 'Prioridade' },
  { chave: 'arquivada', rotulo: 'Arquivadas' }
];
const OUTRAS_SITUACOES = { chave: 'outras', rotulo: 'Outras situações' };

const contarSituacoes = (situacoes: Array<{ chave: string; rotulo: string }>, valores: string[]): Situacao[] => {
  const conhecidas = new Set(situacoes.map((item) => item.chave));
  const outras = valores.filter((valor) => !conhecidas.has(valor)).length;
  return [
    ...situacoes.map((item) => ({ ...item, n: valores.filter((valor) => valor === item.chave).length })),
    ...(outras > 0 ? [{ ...OUTRAS_SITUACOES, n: outras }] : [])
  ];
};

// Fonte ausente: total null e cada situacao null, para a tela mostrar "—".
const itemIndisponivel = (base: Omit<ItemProducao, 'total' | 'fonteDisponivel' | 'porSituacao'>, situacoes: Array<{ chave: string; rotulo: string }>): ItemProducao => ({
  ...base, total: null, fonteDisponivel: false, porSituacao: situacoes.map((item) => ({ ...item, n: null }))
});

const itemConteudo = (categoria: CategoriaConteudo, conteudos: ConteudoProducaoRow[] | null, periodo: PeriodoRelatorio): ItemProducao => {
  const base = {
    chave: categoria,
    rotulo: CATEGORIAS_CONTEUDO[categoria],
    recorte: 'periodo' as const,
    definicao: 'Itens com data no período (ou criados nele, sem data); rascunhos e arquivados não contam.'
  };
  if (!conteudos) return itemIndisponivel(base, SITUACOES_CONTEUDO);
  const situacoes = conteudos
    .filter((item) => item.categoria === categoria)
    .filter((item) => noPeriodo(diaCivilSaoPaulo(item.data) || diaCivilSaoPaulo(item.createdAt), periodo))
    .map((item) => situacaoConteudo(item.status))
    .filter((item): item is string => item !== null);
  return { ...base, total: situacoes.length, fonteDisponivel: true, porSituacao: contarSituacoes(SITUACOES_CONTEUDO, situacoes) };
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

// Origem real gravada pela inscricao publica (PublicService): `origem`/`origens`
// com 'inscricao_publica' ou o bloco `inscricaoPublica` preenchido.
const ehTriagemPublica = (row: TriagemProducaoRow) => {
  const confirmacao = asRecord(row.confirmacaoAtleta);
  return getCadastroAtletaOrigins(confirmacao).includes('inscricao_publica')
    || Object.keys(asRecord(confirmacao.inscricaoPublica)).length > 0;
};

const diaDaTriagem = (row: TriagemProducaoRow) => {
  const confirmacao = asRecord(row.confirmacaoAtleta);
  return diaCivilSaoPaulo(confirmacao.inscritoEm) || diaCivilSaoPaulo(row.dataCadastro) || diaCivilSaoPaulo(row.createdAt);
};

const itemTriagens = (triagens: TriagemProducaoRow[] | null, periodo: PeriodoRelatorio): ItemProducao => {
  const base = {
    chave: 'triagens_publicas',
    rotulo: 'Triagens públicas recebidas',
    recorte: 'periodo' as const,
    definicao: 'Inscrições feitas pelo formulário público no período que seguem no cadastro.'
  };
  if (!triagens) return itemIndisponivel(base, []);
  const total = triagens.filter((row) => ehTriagemPublica(row) && noPeriodo(diaDaTriagem(row), periodo)).length;
  return { ...base, total, fonteDisponivel: true, porSituacao: [] };
};

const itemProjetos = (projetos: ProjetoProducaoRow[] | null): ItemProducao => {
  const base = {
    chave: 'projetos_ativos',
    rotulo: 'Projetos de pesquisa ativos',
    recorte: 'situacao_atual' as const,
    definicao: 'Situação atual, independente do período: ativos são os em andamento ou em planejamento.'
  };
  if (!projetos) return itemIndisponivel(base, SITUACOES_PROJETO);
  const situacoes = projetos.map((item) => token(item.status) || 'planejamento');
  return {
    ...base,
    total: situacoes.filter((item) => PROJETO_ATIVO.has(item)).length,
    fonteDisponivel: true,
    porSituacao: contarSituacoes(SITUACOES_PROJETO, situacoes)
  };
};

const itemPorCriacao = (params: {
  chave: string; rotulo: string; definicao: string; padrao: string;
  situacoes: Array<{ chave: string; rotulo: string }>;
  linhas: Array<{ status?: string | null; createdAt?: Date | string | null }> | null;
  periodo: PeriodoRelatorio;
}): ItemProducao => {
  const base = { chave: params.chave, rotulo: params.rotulo, recorte: 'periodo' as const, definicao: params.definicao };
  if (!params.linhas) return itemIndisponivel(base, params.situacoes);
  const situacoes = params.linhas
    .filter((item) => noPeriodo(diaCivilSaoPaulo(item.createdAt), params.periodo))
    .map((item) => token(item.status) || params.padrao);
  return { ...base, total: situacoes.length, fonteDisponivel: true, porSituacao: contarSituacoes(params.situacoes, situacoes) };
};

export const montarProducaoLiga = (params: {
  periodo: PeriodoRelatorio;
  conteudos: ConteudoProducaoRow[] | null;
  triagens: TriagemProducaoRow[] | null;
  projetos: ProjetoProducaoRow[] | null;
  producoes: ProducaoPesquisaRow[] | null;
  ideias: IdeiaProducaoRow[] | null;
  now?: Date;
}) => {
  const { periodo, conteudos } = params;
  const areas: AreaProducao[] = [
    {
      chave: 'ensino',
      rotulo: 'Ensino',
      itens: [itemConteudo('reunioes_cientificas', conteudos, periodo), itemConteudo('materiais_ensino', conteudos, periodo)]
    },
    {
      chave: 'extensao',
      rotulo: 'Extensão',
      itens: [
        itemConteudo('capacitacoes', conteudos, periodo),
        itemConteudo('materiais_extensao', conteudos, periodo),
        itemTriagens(params.triagens, periodo)
      ]
    },
    {
      chave: 'comunicacao',
      rotulo: 'Comunicação',
      itens: [itemConteudo('comunicados_marketing', conteudos, periodo), itemConteudo('materiais_marketing', conteudos, periodo)]
    },
    {
      chave: 'pesquisa',
      rotulo: 'Pesquisa',
      itens: [
        itemProjetos(params.projetos),
        itemPorCriacao({
          chave: 'producoes', rotulo: 'Produções científicas', padrao: 'em_revisao',
          definicao: 'Produções cadastradas no período, pela situação atual de cada uma.',
          situacoes: SITUACOES_PRODUCAO, linhas: params.producoes, periodo
        }),
        itemPorCriacao({
          chave: 'ideias', rotulo: 'Ideias de pesquisa', padrao: 'ideia',
          definicao: 'Ideias registradas no período, pela situação atual de cada uma.',
          situacoes: SITUACOES_IDEIA, linhas: params.ideias, periodo
        })
      ]
    }
  ];
  return { geradoEm: (params.now || new Date()).toISOString(), periodo, areas };
};

export type ProducaoLigaRelatorio = ReturnType<typeof montarProducaoLiga>;

@Injectable()
export class AnalyticsProducaoService {
  private readonly logger = new Logger(AnalyticsProducaoService.name);

  constructor(
    @InjectRepository(Conteudo) private readonly conteudosRepo: Repository<Conteudo>,
    @InjectRepository(Paciente) private readonly pacientesRepo: Repository<Paciente>,
    @InjectRepository(Projeto) private readonly projetosRepo: Repository<Projeto>,
    @InjectRepository(ProjetoProducao) private readonly producoesRepo: Repository<ProjetoProducao>,
    @InjectRepository(ProjetoIdeia) private readonly ideiasRepo: Repository<ProjetoIdeia>
  ) {}

  async getProducao(params: { periodo: PeriodoRelatorio; now?: Date }): Promise<ProducaoLigaRelatorio> {
    const { periodo } = params;
    const limites = limitesUtcDoPeriodo(periodo);
    const criadosNoPeriodo = Between(limites.inicio, limites.fim);
    const categorias = In(Object.keys(CATEGORIAS_CONTEUDO));
    const [conteudos, triagens, projetos, producoes, ideias] = await Promise.all([
      this.lerFonte('conteudos', () => this.conteudosRepo.find({
        where: [
          { categoria: categorias, data: Between(periodo.inicio, periodo.fim) },
          { categoria: categorias, data: IsNull(), createdAt: criadosNoPeriodo }
        ],
        select: { categoria: true, status: true, data: true, createdAt: true }
      })),
      this.lerFonte('triagens publicas', () => this.pacientesRepo.find({
        where: { createdAt: criadosNoPeriodo },
        select: { createdAt: true, dataCadastro: true, confirmacaoAtleta: true }
      })),
      this.lerFonte('projetos', () => this.projetosRepo.find({ select: { status: true } })),
      this.lerFonte('producoes', () => this.producoesRepo.find({
        where: { createdAt: criadosNoPeriodo },
        select: { status: true, createdAt: true }
      })),
      this.lerFonte('ideias', () => this.ideiasRepo.find({
        where: { createdAt: criadosNoPeriodo },
        select: { status: true, createdAt: true }
      }))
    ]);
    return montarProducaoLiga({ periodo, conteudos, triagens, projetos, producoes, ideias, now: params.now });
  }

  private async lerFonte<T>(nome: string, consulta: () => Promise<T>): Promise<T | null> {
    try {
      return await consulta();
    } catch (error) {
      this.logger.warn(`Fonte indisponivel no relatorio de producao (${nome}): ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
