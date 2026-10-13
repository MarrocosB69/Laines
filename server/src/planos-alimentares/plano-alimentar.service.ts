import {
  BadRequestException,
  ConflictException,
  Optional,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  AuthenticatedUser,
  hasGlobalAccess,
  hasTeamScopedAccess,
  isStudentMemberRole,
  normalizeRole
} from '../auth/access-control';
import {
  assertClinicalLink,
  auditManagementAccess,
  clinicalScopeCondition,
  resolveClinicalLink,
  studentLookupFromRepository
} from '../auth/authorization';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Avaliacao } from '../avaliacoes/avaliacao.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { PlanoAlimentar, PlanoAlimentarStatus } from './plano-alimentar.entity';
import { User } from '../users/user.entity';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { TacoFood } from '../taco/taco.entity';
import { renderLainesPdf } from '../common/pdf/laines-pdf.renderer';
import { planoAlimentarPdfReport } from './plano-alimentar.pdf';
import { ancoraDoGrupoParaEntrega, assertSubstitutosAutomaticos, normalizePrescription, mealsForPrint, nomeAlimentoParaEntrega, prescriptionTotals, validatePrescription } from './prescricao-contract';
import {
  avaliacaoElegivel,
  conflitosSemJustificativa,
  contextoReferencias,
  normalizarRestricoesPlano,
  origemAvaliacao,
  restricoesDaAnamnese
} from './referencias-prescricao';

type JsonRecord = Record<string, unknown>;

type PlanoAlimento = {
  tacoId?: number | null;
  descricao?: string;
  quantidadeGramas?: number | null;
  medidaCaseira?: string | null;
  quantidadeMedidas?: number | null;
  calorias?: number | null;
  cho?: number | null;
  ptn?: number | null;
  lip?: number | null;
  fibra?: number | null;
};

/**
 * Item da refeicao no modelo novo: o alimento pertence a refeicao e o
 * substituto pertence ao item. No modelo antigo (`alimentos`/`substitutos`)
 * os substitutos ficavam soltos na refeicao e nao se sabia qual alimento cada
 * um trocava.
 */
type PlanoItem = {
  id?: string;
  alimentoId?: string;
  medidaIdx?: number | null;
  quantidade?: number | null;
  substitutos?: Array<{
    alimentoId?: string;
    medidaIdx?: number | null;
    modo?: 'auto' | 'fixa';
    quantidade?: number | null;
  }>;
};

type PlanoRefeicao = {
  id?: string;
  nome?: string;
  horario?: string;
  horarioFixo?: string | null;
  ancora?: { ref?: 'inicio' | 'fim'; min?: number | null } | null;
  etiqueta?: string | null;
  vinculadoTreino?: boolean;
  tipoVinculo?: 'pre' | 'peri' | 'pos' | null;
  itens?: PlanoItem[];
  alimentos?: PlanoAlimento[];
  substitutos?: PlanoAlimento[];
  orientacoes?: string;
  totalRefeicao?: {
    calorias?: number | null;
    cho?: number | null;
    ptn?: number | null;
    lip?: number | null;
    fibra?: number | null;
  };
};

type PlanoDados = {
  refeicoes?: PlanoRefeicao[];
  /**
   * Instantaneo dos alimentos usados por este plano, por id. Guardado com o
   * plano para que a composicao prescrita nao mude quando o catalogo for
   * atualizado.
   */
  catalogo?: JsonRecord;
  treinoInicio?: string | null;
  treinoDuracao?: number | null;
  pesoPaciente?: number | null;
  suplementos?: Array<{
    nome?: string;
    dose?: string;
    horario?: string;
    marca?: string;
    loteVerificado?: string;
    statusWADA?: 'aprovado' | 'risco' | 'proibido';
    justificativaClinica?: string;
  }>;
  versaoCompeticion?: boolean;
  orientacoesGerais?: string;
  revisaoFinal?: {
    confirmada?: boolean;
    confirmadoEm?: string;
    confirmadoPorId?: string;
    confirmadoPorNome?: string;
  };
};

export type NutrientesTotais = {
  calorias: number;
  cho: number;
  ptn: number;
  lip: number;
  fibra: number;
};

type MetasGet = {
  calorias: number | null;
  cho: number | null;
  ptn: number | null;
  lip: number | null;
  fibras: number | null;
  avaliacaoId: string | null;
};

type ValidacaoComparativoItem = {
  meta: number | null;
  prescrito: number | null;
  diferenca: number | null;
  adequacao: number | null;
  percentual: number | null;
  cobertura: number;
  situacao: string;
};

export type ValidacaoResult = {
  scoreAdequacaoPercent: number | null;
  hasMetasGet: boolean;
  metasGet: MetasGet;
  totaisPrescritos: NutrientesTotais;
  comparativo: {
    calorias: ValidacaoComparativoItem;
    cho: ValidacaoComparativoItem;
    ptn: ValidacaoComparativoItem;
    lip: ValidacaoComparativoItem;
    fibras: ValidacaoComparativoItem;
  };
  alertaAtivacao: string | null;
};

type AtivacaoChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  severity: 'blocker' | 'warning' | 'info';
  message: string;
};

export type AtivacaoClinicaResult = {
  podeAtivar: boolean;
  bloqueios: string[];
  avisos: string[];
  itens: AtivacaoChecklistItem[];
  validacao: ValidacaoResult;
};

type PlanoPatch = {
  pacienteId: string;
  expectedVersion?: number;
  alunoId?: string | null;
  projetoId?: string | null;
  status?: PlanoAlimentarStatus | null;
  dataInicio?: string | null;
  dataFim?: string | null;
  tipoDieta?: string | null;
  metaCalorica?: number | null;
  metaCHOg?: number | null;
  metaPTNg?: number | null;
  metaLIPg?: number | null;
  metaFibrasg?: number | null;
  faseAtual?: string | null;
  validadoAntidoping?: boolean | null;
  dados?: JsonRecord | null;
  resultados?: JsonRecord | null;
};

const ACTIVE_GUARD_MESSAGE = 'Este paciente ainda nao possui GET cadastrado. Voce pode montar um rascunho, mas nao sera possivel ativar o plano ate preencher as metas energeticas e nutricionais.';

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

@Injectable()
export class PlanoAlimentarService {
  constructor(
    @InjectRepository(PlanoAlimentar)
    private readonly repo: Repository<PlanoAlimentar>,
    @InjectRepository(Paciente)
    private readonly pacientesRepo: Repository<Paciente>,
    @InjectRepository(Avaliacao)
    private readonly avaliacoesRepo: Repository<Avaliacao>,
    @Optional() @InjectRepository(User) private readonly usersRepo?: Repository<User>,
    @Optional() @InjectRepository(TacoFood) private readonly foodsRepo?: Repository<TacoFood>,
    @Optional() private readonly auditoria?: AuditoriaService,
    // UPD-17: notificacao ao aluno na devolucao. So dispara se o modulo tiver
    // NotificacoesModule nos imports; sem isso, fica opcional e sem efeito
    // (ver relatorio de entrega — planos-alimentares.module.ts esta fora do
    // escopo de arquivos autorizados para este item).
    @Optional() private readonly notificacoes?: NotificacoesService
  ) {}

  private toText(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    const token = this.toText(value).toLowerCase();
    if (!token) return null;
    if (['true', '1', 'sim', 'yes'].includes(token)) return true;
    if (['false', '0', 'nao', 'no'].includes(token)) return false;
    return null;
  }

  private asRecord(value: unknown): JsonRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as JsonRecord;
  }

  private asArray<T>(value: unknown): T[] {
    if (!Array.isArray(value)) return [];
    return value as T[];
  }

  private normalizeStatus(value?: unknown): PlanoAlimentarStatus {
    const token = this.toText(value).toLowerCase();
    if (token === PlanoAlimentarStatus.EM_REVISAO) return PlanoAlimentarStatus.EM_REVISAO;
    if (token === PlanoAlimentarStatus.ATIVO) return PlanoAlimentarStatus.ATIVO;
    if (token === PlanoAlimentarStatus.ARQUIVADO || token === PlanoAlimentarStatus.ENCERRADO) {
      return PlanoAlimentarStatus.ARQUIVADO;
    }
    return PlanoAlimentarStatus.RASCUNHO;
  }

  private normalizeTipoDieta(value?: unknown): string {
    const token = this.toText(value).toLowerCase();
    if (['fixa', 'rodizio', 'periodizada'].includes(token)) return token;
    return 'fixa';
  }

  private pickFirstNumber(sources: JsonRecord[], aliases: string[]): number | null {
    for (const source of sources) {
      for (const alias of aliases) {
        const parts = alias.split('.');
        let current: unknown = source;
        for (const part of parts) {
          if (!current || typeof current !== 'object') {
            current = undefined;
            break;
          }
          current = (current as JsonRecord)[part];
        }
        const parsed = this.toNumber(current);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return null;
  }

  private clampAdequacao(meta: number, prescrito: number): number {
    if (!Number.isFinite(meta) || meta <= 0) return 0;
    const delta = Math.abs(meta - prescrito);
    const raw = 100 - ((delta / meta) * 100);
    return round(Math.max(0, Math.min(100, raw)), 2);
  }

  // Contrato unico (UPD-12): mesma regra de pacientes/avaliacoes, incluindo a cadeia de supervisao.
  private async assertCanAccessPaciente(user: AuthenticatedUser, pacienteId: string) {
    const role = normalizeRole(user?.role);
    if (hasGlobalAccess(role)) {
      await auditManagementAccess(this.auditoria, user, 'pacientes', pacienteId, { acao: 'acesso_plano_alimentar' });
      return;
    }

    const paciente = await this.pacientesRepo.findOne({ where: { id: pacienteId } });
    if (!paciente) throw new NotFoundException('Paciente nao encontrado.');

    if (!this.toText(user?.id)) {
      throw new ForbiddenException('Usuario sem identificacao valida para acessar este paciente.');
    }
    await assertClinicalLink(user, paciente, studentLookupFromRepository(this.usersRepo));
    if (role === 'coord_atendimento') {
      await auditManagementAccess(this.auditoria, user, 'pacientes', pacienteId, { acao: 'acesso_plano_alimentar' });
    }
  }

  private async getScopedPacienteIds(user: AuthenticatedUser): Promise<string[]> {
    const role = normalizeRole(user?.role);
    if (hasGlobalAccess(role)) {
      return [];
    }

    const userId = this.toText(user?.id);
    if (!userId) return [];

    const qb = this.pacientesRepo.createQueryBuilder('paciente').select('paciente.id', 'id');
    const alunosSupervisionadosSubQuery = this.usersRepo
      ?.createQueryBuilder('aluno_supervisionado')
      .select('aluno_supervisionado.id')
      .where('(aluno_supervisionado.supervisorId = :userId OR aluno_supervisionado.profissionalId = :userId)')
      .andWhere('aluno_supervisionado.deletedAt IS NULL');
    const scope = clinicalScopeCondition({
      alias: 'paciente',
      user,
      supervisedStudentsSubquery: alunosSupervisionadosSubQuery?.getQuery()
    });
    if (scope === null || scope === '1 = 0') return [];
    qb.where(scope, { userId });
    if (alunosSupervisionadosSubQuery) qb.setParameters(alunosSupervisionadosSubQuery.getParameters());

    const rows = await qb.getRawMany<{ id: string }>();
    return rows.map((row) => row.id).filter(Boolean);
  }

  /*
   * UPD-11: uma restrição registrada na anamnese precisa ter sido conferida no
   * plano antes da revisão, e todo item que colide com restrição confirmada
   * precisa de justificativa clínica explícita.
   */
  private async assertRestricoesConferidas(pacienteId: string, dados: JsonRecord) {
    const anamnese = await this.resolveUltimaAvaliacaoElegivel(this.toText(pacienteId), 'anamnese_inicial');
    const contexto = restricoesDaAnamnese(anamnese ? { ...anamnese } : null);
    const registro = this.asRecord(dados.restricoes);
    if (contexto.pendenteRevisao && !registro.conferidoEm) {
      throw new BadRequestException('Confira as restrições alimentares registradas na anamnese antes de enviar para revisão.');
    }
    const conflitos = conflitosSemJustificativa(dados);
    if (conflitos.length) {
      throw new BadRequestException(`Itens em conflito com restrição confirmada sem justificativa: ${conflitos.map((c) => c.nome).join(', ')}.`);
    }
  }

  private async resolveUltimaAvaliacaoGet(pacienteId: string) {
    return this.resolveUltimaAvaliacaoElegivel(pacienteId, 'gasto_energetico_total');
  }

  private async resolveUltimaAvaliacaoElegivel(pacienteId: string, tipo: string) {
    const row = await this.avaliacoesRepo.createQueryBuilder('avaliacao')
      .where('avaliacao.pacienteId = :pacienteId', { pacienteId })
      .andWhere('avaliacao.tipo = :tipo', { tipo })
      .andWhere('avaliacao.status = :statusElegivel', { statusElegivel: 'finalizada' })
      .andWhere('avaliacao.deletedAt IS NULL')
      .orderBy('avaliacao.measuredAt', 'DESC', 'NULLS LAST')
      .addOrderBy('avaliacao.data', 'DESC', 'NULLS LAST')
      .addOrderBy('avaliacao.updatedAt', 'DESC')
      .getOne();

    return row && avaliacaoElegivel({ ...row }) ? row : null;
  }

  private extractGetMetasFromAvaliacao(avaliacao: Avaliacao | null): MetasGet {
    if (!avaliacao) {
      return {
        calorias: null,
        cho: null,
        ptn: null,
        lip: null,
        fibras: null,
        avaliacaoId: null
      };
    }

    const dados = this.asRecord(avaliacao.dados);
    const resultados = this.asRecord(avaliacao.resultados);
    const calculated = this.asRecord(resultados.calculated);
    const esportivo = this.asRecord(dados.esportivo);
    const resultCalc = this.asRecord(dados.resultados_calculados);

    const sources = [resultados, calculated, dados, esportivo, resultCalc];

    const calorias = this.pickFirstNumber(sources, [
      'getEstimadoKcal',
      'getKcal',
      'get',
      'gastoEnergeticoTotal',
      'totalDiario',
      'metaCalorica'
    ]) ?? this.toNumber(avaliacao.totalDiario);

    const cho = this.pickFirstNumber(sources, [
      'choG',
      'cho',
      'metaCHO',
      'metaCHO_g'
    ]);
    const ptn = this.pickFirstNumber(sources, [
      'ptnG',
      'ptn',
      'metaPTN',
      'metaPTN_g'
    ]);
    const lip = this.pickFirstNumber(sources, [
      'lipG',
      'lip',
      'metaLIP',
      'metaLIP_g'
    ]);
    const fibras = this.pickFirstNumber(sources, [
      'fibrasG',
      'fibras',
      'metaFibras',
      'metaFibras_g'
    ]);

    return {
      calorias: Number.isFinite(calorias) ? round(calorias as number, 2) : null,
      cho: Number.isFinite(cho) ? round(cho as number, 2) : null,
      ptn: Number.isFinite(ptn) ? round(ptn as number, 2) : null,
      lip: Number.isFinite(lip) ? round(lip as number, 2) : null,
      fibras: Number.isFinite(fibras) ? round(fibras as number, 2) : null,
      avaliacaoId: avaliacao.id
    };
  }

  private normalizeDados(input: unknown): any {
    const normalized = normalizePrescription(input);
    Object.defineProperty(normalized.refeicoes, '__catalogo', {
      value: normalized.catalogo,
      enumerable: false,
      configurable: true
    });
    return normalized;
  }

  private computeComparativo(meta: number | null, prescrito: number | null, cobertura = 1): ValidacaoComparativoItem {
    if (meta === null || meta <= 0 || prescrito === null || cobertura < 0.5) {
      return {
        meta,
        prescrito,
        diferenca: null,
        adequacao: null,
        percentual: null,
        cobertura,
        situacao: 'sem-dado'
      };
    }
    const diferenca = round(prescrito - meta, 2);
    const percentual = prescrito / meta * 100;
    return {
      meta: round(meta, 2),
      prescrito,
      diferenca,
      adequacao: this.clampAdequacao(meta, prescrito),
      percentual: round(percentual, 2),
      cobertura,
      situacao: percentual > 120 ? 'excedido' : percentual < 80 ? 'insuficiente'
        : percentual < 90 || percentual > 110 ? 'atencao' : 'ok'
    };
  }

  async calcularTotais(refeicoes: PlanoRefeicao[], catalogo: JsonRecord = {}): Promise<NutrientesTotais> {
    const resolvedCatalogo = Object.keys(catalogo).length
      ? catalogo
      : this.asRecord(Reflect.get(refeicoes, '__catalogo'));
    return prescriptionTotals(this.normalizeDados({ refeicoes, catalogo: resolvedCatalogo }));
  }

  async validarAdequacao(plano: { pacienteId: string; dados?: JsonRecord | null }): Promise<ValidacaoResult> {
    const dados = this.normalizeDados(plano?.dados || {});
    const totaisPrescritos = prescriptionTotals(dados);
    const avaliacaoGet = await this.resolveUltimaAvaliacaoGet(this.toText(plano?.pacienteId));
    const metasGet = this.extractGetMetasFromAvaliacao(avaliacaoGet);

    // Totais publicados mantêm seu contrato; adequação não transforma ausência em zero.
    const itens = this.asArray<JsonRecord>(dados.refeicoes).flatMap((meal) => this.asArray<JsonRecord>(meal.itens));
    const catalogo = this.asRecord(dados.catalogo);
    const valores = (nutriente: string) => itens.map((item) => {
      const alimento = this.asRecord(catalogo[this.toText(item.alimentoId)]);
      const medida = this.asArray<JsonRecord>(alimento.medidas)[Number(item.medidaIdx || 0)];
      const valor = this.toNumber(this.asRecord(alimento.comp)[nutriente]);
      if (valor === null) return null;
      const porcao = valor * Number(item.quantidade) * Number(medida?.gramas) / 100;
      return Number.isFinite(porcao) ? porcao : null;
    });
    const energias = valores('kcal');
    const totalEnergia = energias.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    const comparar = (meta: number | null, nutriente: string) => {
      const lista = valores(nutriente);
      const conhecidos = lista.filter((value): value is number => Number.isFinite(value));
      const cobertura = !lista.length ? 0 : totalEnergia > 0 && energias.every((value) => value !== null)
        ? energias.reduce<number>((sum, value, i) => sum + (lista[i] === null ? 0 : value ?? 0), 0) / totalEnergia
        : conhecidos.length / lista.length;
      return this.computeComparativo(meta, conhecidos.length ? round(conhecidos.reduce((sum, value) => sum + value, 0), 2) : null, cobertura);
    };

    const comparativo = {
      calorias: comparar(metasGet.calorias, 'kcal'),
      cho: comparar(metasGet.cho, 'cho'),
      ptn: comparar(metasGet.ptn, 'ptn'),
      lip: comparar(metasGet.lip, 'lip'),
      fibras: comparar(metasGet.fibras, 'fibra')
    };

    const scores = [
      comparativo.calorias.adequacao,
      comparativo.cho.adequacao,
      comparativo.ptn.adequacao,
      comparativo.lip.adequacao,
      comparativo.fibras.adequacao
    ].filter((value): value is number => Number.isFinite(value));

    const scoreAdequacaoPercent = scores.length
      ? round(scores.reduce((sum, value) => sum + value, 0) / scores.length, 2)
      : null;

    const hasMetasGet = Boolean(metasGet.avaliacaoId && metasGet.calorias !== null && metasGet.calorias > 0);

    return {
      scoreAdequacaoPercent,
      hasMetasGet,
      metasGet,
      totaisPrescritos,
      comparativo,
      alertaAtivacao: hasMetasGet ? null : ACTIVE_GUARD_MESSAGE
    };
  }

  private effectiveMeta(plano: Partial<PlanoPatch>, metasGet: MetasGet, key: keyof MetasGet, planoValue: unknown): number | null {
    const fromPlano = this.toNumber(planoValue);
    if (Number.isFinite(fromPlano) && (fromPlano as number) > 0) return fromPlano;
    const fromGet = this.toNumber(metasGet[key]);
    if (Number.isFinite(fromGet) && (fromGet as number) > 0) return fromGet;
    return null;
  }

  private pushChecklist(
    itens: AtivacaoChecklistItem[],
    item: AtivacaoChecklistItem
  ) {
    itens.push(item);
  }

  async validarAtivacaoClinica(plano: Partial<PlanoPatch>): Promise<AtivacaoClinicaResult> {
    const pacienteId = this.toText(plano?.pacienteId);
    const dados = this.normalizeDados(plano?.dados || {});
    const validacao = await this.validarAdequacao({
      pacienteId,
      dados: dados
    });
    const itens: AtivacaoChecklistItem[] = [];

    const add = (id: string, label: string, ok: boolean, severity: 'blocker' | 'warning' | 'info', message: string) => {
      this.pushChecklist(itens, { id, label, ok, severity, message });
    };

    add(
      'get',
      'GET existente',
      validacao.hasMetasGet,
      'blocker',
      validacao.hasMetasGet
        ? 'GET localizado para apoiar a prescricao.'
        : ACTIVE_GUARD_MESSAGE
    );

    const metas = {
      calorias: this.effectiveMeta(plano, validacao.metasGet, 'calorias', plano?.metaCalorica),
      cho: this.effectiveMeta(plano, validacao.metasGet, 'cho', plano?.metaCHOg),
      ptn: this.effectiveMeta(plano, validacao.metasGet, 'ptn', plano?.metaPTNg),
      lip: this.effectiveMeta(plano, validacao.metasGet, 'lip', plano?.metaLIPg),
      fibras: this.effectiveMeta(plano, validacao.metasGet, 'fibras', plano?.metaFibrasg)
    };
    const missingMetas = Object.entries(metas)
      .filter(([, value]) => !Number.isFinite(value) || Number(value) <= 0)
      .map(([key]) => key);
    add(
      'metas_completas',
      'Metas completas',
      missingMetas.length === 0,
      'blocker',
      missingMetas.length === 0
        ? 'Metas de kcal, CHO, PTN, LIP e fibras definidas.'
        : `Metas incompletas: ${missingMetas.join(', ')}.`
    );

    const refeicoes = dados.refeicoes || [];
    const refeicoesComAlimentos = refeicoes.filter((refeicao) => this.asArray(refeicao.itens).length > 0);
    add(
      'refeicoes',
      'Refeicoes cadastradas',
      refeicoesComAlimentos.length > 0,
      'blocker',
      refeicoesComAlimentos.length > 0
        ? `${refeicoesComAlimentos.length} refeicao(oes) com alimentos cadastrados.`
        : 'Cadastre ao menos uma refeicao com alimento antes de ativar.'
    );

    const totaisValidos = validacao.totaisPrescritos.calorias > 0
      && validacao.totaisPrescritos.cho >= 0
      && validacao.totaisPrescritos.ptn >= 0
      && validacao.totaisPrescritos.lip >= 0
      && validacao.totaisPrescritos.fibra >= 0;
    add(
      'totais_backend',
      'Totais recalculados',
      totaisValidos,
      'blocker',
      totaisValidos
        ? 'Totais nutricionais recalculados pelo backend.'
        : 'Nao foi possivel calcular totais nutricionais validos.'
    );

    const suplementos = dados.suplementos || [];
    const proibidos = suplementos.filter((item) => item.statusWADA === 'proibido');
    add(
      'suplementos_proibidos',
      'Suplementos proibidos',
      proibidos.length === 0,
      'blocker',
      proibidos.length === 0
        ? 'Nenhum suplemento proibido informado.'
        : 'Ha suplemento marcado como proibido. Remova ou substitua antes de ativar.'
    );

    const riscoSemJustificativa = suplementos.filter((item) => (
      item.statusWADA === 'risco'
      && this.toText(item.justificativaClinica).length < 10
    ));
    add(
      'suplementos_risco',
      'Suplementos em risco',
      riscoSemJustificativa.length === 0,
      'blocker',
      riscoSemJustificativa.length === 0
        ? 'Suplementos em risco possuem justificativa clinica ou nao foram informados.'
        : 'Suplemento em risco exige justificativa clinica antes da ativacao.'
    );

    const revisado = Boolean(dados.revisaoFinal?.confirmada
      && dados.revisaoFinal?.origem === 'servidor'
      && dados.revisaoFinal?.version === dados.version
      && dados.revisaoFinal?.confirmadoPorId); 
    add(
      'revisao_final',
      'Revisao final',
      revisado,
      'blocker',
      revisado
        ? 'Revisao final confirmada pelo profissional.'
        : 'Confirme a revisao final profissional antes de ativar.'
    );

    if (Number.isFinite(validacao.comparativo.calorias.adequacao)
      && Number(validacao.comparativo.calorias.adequacao) < 80) {
      add(
        'distancia_get',
        'Distancia contra GET',
        false,
        'warning',
        'O plano esta distante da meta energetica definida. Revise as refeicoes antes de ativar.'
      );
    }

    const bloqueios = itens
      .filter((item) => item.severity === 'blocker' && !item.ok)
      .map((item) => item.message);
    const avisos = itens
      .filter((item) => item.severity === 'warning' && !item.ok)
      .map((item) => item.message);

    return {
      podeAtivar: bloqueios.length === 0,
      bloqueios,
      avisos,
      itens,
      validacao
    };
  }

  private async assertCanActivatePlano(plano: Partial<PlanoPatch>) {
    const ativacao = await this.validarAtivacaoClinica(plano);
    if (!ativacao.podeAtivar) {
      throw new BadRequestException(ativacao.bloqueios[0] || ACTIVE_GUARD_MESSAGE);
    }
  }

  private async normalizePatch(input: PlanoPatch, fallbackPacienteId?: string): Promise<PlanoPatch> {
    const pacienteId = this.toText(input?.pacienteId || fallbackPacienteId);
    if (!pacienteId) {
      throw new BadRequestException('pacienteId e obrigatorio.');
    }

    const status = input?.status === null || input?.status === undefined
      ? undefined
      : this.normalizeStatus(input.status);
    const dados = this.normalizeDados(input?.dados || {});
    const totais = prescriptionTotals(dados);

    const normalized: PlanoPatch = {
      pacienteId,
      alunoId: this.toText(input?.alunoId) || null,
      projetoId: this.toText(input?.projetoId) || null,
      status,
      dataInicio: this.toText(input?.dataInicio) || null,
      dataFim: this.toText(input?.dataFim) || null,
      tipoDieta: this.normalizeTipoDieta(input?.tipoDieta),
      metaCalorica: this.toNumber(input?.metaCalorica),
      metaCHOg: this.toNumber(input?.metaCHOg),
      metaPTNg: this.toNumber(input?.metaPTNg),
      metaLIPg: this.toNumber(input?.metaLIPg),
      metaFibrasg: this.toNumber(input?.metaFibrasg),
      faseAtual: this.toText(input?.faseAtual) || null,
      validadoAntidoping: this.toBoolean(input?.validadoAntidoping) ?? false,
      dados: dados,
      resultados: {
        ...(this.asRecord(input?.resultados)),
        totaisCalculados: totais
      }
    };

    if (!normalized.dataInicio) {
      normalized.dataInicio = new Date().toISOString().slice(0, 10);
    }

    return normalized;
  }

  private async enrichPatchWithValidation(patch: PlanoPatch): Promise<PlanoPatch> {
    const validacao = await this.validarAdequacao({
      pacienteId: patch.pacienteId,
      dados: patch.dados || {}
    });
    const ativacaoClinica = await this.validarAtivacaoClinica(patch);

    return {
      ...patch,
      resultados: {
        ...(this.asRecord(patch.resultados)),
        validacao,
        ativacaoClinica
      }
    };
  }

  private stampRevisaoFinal(dados: JsonRecord | null | undefined): JsonRecord {
    const { revisaoFinal: _untrustedReview, ...safeDados } = this.normalizeDados(dados);
    return { ...safeDados, revisaoFinal: { confirmada: false } };
  }

  private versionOf(plano: { dados?: JsonRecord | null }) {
    return Number(this.asRecord(plano.dados).version) || 0;
  }

  private hasCurrentReview(plano: { dados?: JsonRecord | null }) {
    const review = this.asRecord(this.asRecord(plano.dados).revisaoFinal);
    return review.confirmada === true && review.origem === 'servidor'
      && review.version === this.versionOf(plano);
  }

  private responseFor(plano: PlanoAlimentar) {
    const dados = this.normalizeDados(plano.dados);
    return { ...plano, dados, entrega: plano.status === PlanoAlimentarStatus.ATIVO && this.hasCurrentReview(plano)
      ? { version: this.versionOf(plano), refeicoes: mealsForPrint(dados) } : null };
  }

  private assertVersion(current: PlanoAlimentar, expectedVersion: unknown) {
    if (!Number.isInteger(expectedVersion) || expectedVersion !== this.versionOf(current)) {
      throw new ConflictException('O plano foi alterado ou a versão está ausente. Reabra o plano antes de salvar ou revisar.');
    }
  }

  private async assertReviewer(user: AuthenticatedUser) {
    const account = await this.usersRepo?.findOne({ where: { id: user.id }, withDeleted: false });
    const role = normalizeRole(account?.role);
    const crn = this.toText(account?.crn)
      || (this.toText(account?.conselhoTipo).toUpperCase() === 'CRN' ? this.toText(account?.conselhoNumero) : '');
    if (!account || account.status !== 'ativo' || !['professor', 'profissional'].includes(role) || !crn) {
      throw new ForbiddenException('A revisão exige professor ou profissional ativo com registro CRN cadastrado.');
    }
    return { id: account.id, name: account.name, crn };
  }

  private async prepareComposition(input: unknown, current?: PlanoAlimentar) {
    const dados = this.normalizeDados(input);
    const previous = current ? this.normalizeDados(current.dados) : { catalogo: {} };
    const used = new Set<string>();
    for (const meal of dados.refeicoes) for (const item of meal.itens) {
      used.add(String(item.alimentoId));
      for (const sub of item.substitutos || []) used.add(String(sub.alimentoId));
    }
    const catalogo: JsonRecord = {};
    for (const id of used) {
      const incoming = this.asRecord(dados.catalogo[id]);
      const old = previous.catalogo[id];
      if (old) {
        // A composition already prescribed is immutable under the same identifier.
        if (JSON.stringify(incoming.comp) !== JSON.stringify(old.comp)
          || JSON.stringify(incoming.medidas) !== JSON.stringify(old.medidas)) {
          throw new BadRequestException('A composição histórica não pode ser sobrescrita. Selecione outro alimento ou mantenha a composição salva.');
        }
        catalogo[id] = old;
      } else if (/^[1-9][0-9]*$/.test(id)) {
        const source = await this.foodsRepo?.findOne({ where: { id: Number(id) } });
        if (!source) throw new BadRequestException('Alimento não encontrado no catálogo de origem.');
        const fields = { kcal: 'energiaKcal', cho: 'carboidrato', ptn: 'proteina', lip: 'lipidios', fibra: 'fibra',
          ferro: 'ferro', calcio: 'calcio', zinco: 'zinco', magnesio: 'magnesio', vitaminaD: 'vitaminaD', potassio: 'potassio', sodio: 'sodio' };
        catalogo[id] = { ...incoming, id, nome: source.descricao,
          nomeExibicao: nomeAlimentoParaEntrega({ nome: source.descricao, fonte: source.fonte || 'TACO' }),
          codigoFonte: String(source.codigoTexto || source.codigo || ''),
          fonte: source.fonte || 'TACO', grupo: source.grupo,
          grupoEquivalencia: ancoraDoGrupoParaEntrega(source.grupo),
          origemComposicao: 'catalogo', validacaoComposicao: null,
          medidas: [{ descricao: null, gramas: 1 }],
          comp: Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, this.toNumber(source[field])])) };
      } else {
        catalogo[id] = { ...incoming, origemComposicao: incoming.fonte === 'plano' ? 'legado_pendente' : 'manual_pendente', validacaoComposicao: null };
      }
    }
    dados.catalogo = { ...previous.catalogo, ...catalogo };
    validatePrescription(dados);
    return dados;
  }

  private async persistVersion(current: PlanoAlimentar, patch: Partial<PlanoAlimentar>, repo = this.repo) {
    const expected = this.versionOf(current);
    const { dados, resultados, ...fields } = patch;
    const result = await repo.createQueryBuilder().update(PlanoAlimentar).set({
      ...fields,
      ...(dados !== undefined ? { dados: () => 'CAST(:planDados AS jsonb)' } : {}),
      ...(resultados !== undefined ? { resultados: () => 'CAST(:planResultados AS jsonb)' } : {})
    }).setParameters({ planDados: JSON.stringify(dados), planResultados: JSON.stringify(resultados) })
      .where('id = :id', { id: current.id })
      .andWhere('deleted_at IS NULL')
      .andWhere("COALESCE((dados->>'version')::int, 0) = :version", { version: expected })
      .execute();
    if (result.affected !== 1) throw new ConflictException('Outra pessoa alterou este plano. Reabra antes de continuar.');
    return repo.findOneByOrFail({ id: current.id });
  }

  async findAll(
    user: AuthenticatedUser,
    filtros: { pacienteId?: string; status?: string; limit?: number; offset?: number }
  ) {
    const role = normalizeRole(user?.role);
    const qb = this.repo.createQueryBuilder('plano')
      .where('plano.deletedAt IS NULL')
      .orderBy('plano.updatedAt', 'DESC');

    if (filtros?.pacienteId) {
      await this.assertCanAccessPaciente(user, filtros.pacienteId);
      qb.andWhere('plano.pacienteId = :pacienteId', { pacienteId: filtros.pacienteId });
    } else if (!hasGlobalAccess(role) && role !== 'coord_atendimento') {
      const ids = await this.getScopedPacienteIds(user);
      if (!ids.length) return [];
      qb.andWhere('plano.pacienteId IN (:...ids)', { ids });
    }

    const status = this.toText(filtros?.status).toLowerCase();
    if (status) {
      qb.andWhere('plano.status = :status', { status: this.normalizeStatus(status) });
    }

    const limit = Math.max(1, Math.min(100, Math.floor(this.toNumber(filtros?.limit) || 25)));
    const offset = Math.max(0, Math.floor(this.toNumber(filtros?.offset) || 0));
    qb.take(limit).skip(offset);

    if (role === 'atleta') {
      qb.andWhere('plano.status = :publishedStatus', { publishedStatus: PlanoAlimentarStatus.ATIVO })
        .andWhere("plano.dados->'revisaoFinal'->>'confirmada' = 'true'")
        .andWhere("plano.dados->'revisaoFinal'->>'origem' = 'servidor'")
        .andWhere("plano.dados->'revisaoFinal'->>'version' = plano.dados->>'version'");
    }
    const planos = await qb.getMany();
    return planos.map((plano) => this.responseFor(plano));
  }

  async findById(id: string, user: AuthenticatedUser) {
    const plano = await this.repo.findOne({
      where: { id },
      withDeleted: false
    });
    if (!plano) throw new NotFoundException('Plano alimentar nao encontrado.');
    await this.assertCanAccessPaciente(user, plano.pacienteId);
    if (normalizeRole(user.role) === 'atleta' && (plano.status !== PlanoAlimentarStatus.ATIVO || !this.hasCurrentReview(plano))) {
      throw new ForbiddenException('Este plano ainda não foi publicado.');
    }
    return this.responseFor(plano);
  }

  async getPacienteContext(pacienteId: string, user: AuthenticatedUser) {
    await this.assertCanAccessPaciente(user, pacienteId);
    const ultimaAvaliacaoGet = await this.resolveUltimaAvaliacaoGet(pacienteId);
    const metasGet = this.extractGetMetasFromAvaliacao(ultimaAvaliacaoGet);
    const anamnese = await this.resolveUltimaAvaliacaoElegivel(pacienteId, 'anamnese_inicial');
    const paciente = await this.pacientesRepo.findOne({ where: { id: pacienteId } });
    if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
    const planoAtivo = await this.repo.findOne({
      where: {
        pacienteId,
        status: PlanoAlimentarStatus.ATIVO
      },
      withDeleted: false,
      order: {
        updatedAt: 'DESC'
      }
    });

    return {
      pacienteId,
      metasGet,
      origemMetas: origemAvaliacao(ultimaAvaliacaoGet ? { ...ultimaAvaliacaoGet } : null),
      referencias: contextoReferencias({ ...paciente }, anamnese ? { ...anamnese } : null),
      restricoes: restricoesDaAnamnese(anamnese ? { ...anamnese } : null),
      ultimaAvaliacaoGetId: ultimaAvaliacaoGet?.id || null,
      planoAtivoId: planoAtivo?.id || null
    };
  }

  async create(input: PlanoPatch, user: AuthenticatedUser) {
    await this.assertCanAccessPaciente(user, input.pacienteId);
    const prepared = await this.prepareComposition(input.dados);
    // Restrições confirmadas (UPD-11): autoria e data fixadas no servidor.
    prepared.restricoes = normalizarRestricoesPlano(this.asRecord(input.dados).restricoes, undefined, user);
    if (prepared.restricoes === undefined) delete prepared.restricoes;
    const patch = await this.normalizePatch({ ...input, dados: prepared });
    patch.dados = { ...this.stampRevisaoFinal(patch.dados), version: 1, historicoRevisoes: [],
      criadoPorId: user.id, criadoEm: new Date().toISOString() };
    if (patch.status === PlanoAlimentarStatus.ATIVO) {
      throw new ForbiddenException('Salve, envie para revisão profissional e ative a versão revisada.');
    }
    if (patch.status === PlanoAlimentarStatus.EM_REVISAO) {
      await this.assertRestricoesConferidas(input.pacienteId, this.asRecord(patch.dados));
      assertSubstitutosAutomaticos(this.normalizeDados(patch.dados));
    }

    const enrichedPatch = await this.enrichPatchWithValidation(patch);
    const entity = this.repo.create({
      pacienteId: enrichedPatch.pacienteId,
      alunoId: user.id || null,
      projetoId: enrichedPatch.projetoId || null,
      status: enrichedPatch.status || PlanoAlimentarStatus.RASCUNHO,
      dataInicio: enrichedPatch.dataInicio || new Date().toISOString().slice(0, 10),
      dataFim: enrichedPatch.dataFim || null,
      tipoDieta: this.normalizeTipoDieta(enrichedPatch.tipoDieta),
      metaCalorica: this.toNumber(enrichedPatch.metaCalorica),
      metaCHOg: this.toNumber(enrichedPatch.metaCHOg),
      metaPTNg: this.toNumber(enrichedPatch.metaPTNg),
      metaLIPg: this.toNumber(enrichedPatch.metaLIPg),
      metaFibrasg: this.toNumber(enrichedPatch.metaFibrasg),
      faseAtual: this.toText(enrichedPatch.faseAtual) || null,
      validadoAntidoping: Boolean(enrichedPatch.validadoAntidoping),
      dados: this.asRecord(enrichedPatch.dados),
      resultados: this.asRecord(enrichedPatch.resultados)
    });

    return this.repo.save(entity);
  }

  async update(id: string, input: Partial<PlanoPatch>, user: AuthenticatedUser) {
    const current = await this.findById(id, user);
    this.assertVersion(current, input.expectedVersion);
    if (input.pacienteId && input.pacienteId !== current.pacienteId) {
      throw new BadRequestException('Não é permitido transferir a prescrição para outro paciente.');
    }
    if (input.status === PlanoAlimentarStatus.ATIVO) {
      throw new ForbiddenException('Use a ativação da versão revisada para publicar o plano.');
    }
    const dados = await this.prepareComposition(input.dados ?? current.dados, current);
    const prior = this.asRecord(current.dados);
    // Restrições confirmadas (UPD-11): conferência inalterada preserva autoria; mudança recebe carimbo novo.
    dados.restricoes = normalizarRestricoesPlano(
      input.dados === undefined ? undefined : this.asRecord(input.dados).restricoes, prior.restricoes, user
    );
    if (dados.restricoes === undefined) delete dados.restricoes;
    const history = this.asArray(prior.historicoRevisoes);
    const review = this.asRecord(prior.revisaoFinal);
    dados.historicoRevisoes = review.confirmada
      ? [...history, { ...review, invalidadaEm: new Date().toISOString(), invalidadaPorId: user.id }]
      : history;
    dados.revisaoFinal = { confirmada: false };
    dados.version = this.versionOf(current) + 1;
    dados.criadoPorId = prior.criadoPorId;
    dados.criadoEm = prior.criadoEm;
    const patch = await this.normalizePatch({ ...current, ...input, pacienteId: current.pacienteId,
      alunoId: current.alunoId, dados, resultados: current.resultados });
    // Every write invalidates a review, including changes to dates, goals and supplements.
    patch.status = input.status || (current.status === PlanoAlimentarStatus.ATIVO
      ? PlanoAlimentarStatus.RASCUNHO : current.status);
    if (patch.status === PlanoAlimentarStatus.EM_REVISAO) {
      await this.assertRestricoesConferidas(current.pacienteId, dados);
      assertSubstitutosAutomaticos(dados);
    }
    const enriched = await this.enrichPatchWithValidation(patch);
    const { expectedVersion: _expected, ...persistent } = enriched;
    if ([PlanoAlimentarStatus.ATIVO, PlanoAlimentarStatus.ARQUIVADO, PlanoAlimentarStatus.ENCERRADO].includes(current.status)) {
      // Published content remains intact while the next prescription is prepared.
      const copy = this.repo.create({
        pacienteId: current.pacienteId, alunoId: user.id, projetoId: persistent.projetoId,
        status: input.status === PlanoAlimentarStatus.EM_REVISAO ? PlanoAlimentarStatus.EM_REVISAO : PlanoAlimentarStatus.RASCUNHO,
        dataInicio: persistent.dataInicio || current.dataInicio, dataFim: persistent.dataFim,
        tipoDieta: persistent.tipoDieta || current.tipoDieta, metaCalorica: persistent.metaCalorica,
        metaCHOg: persistent.metaCHOg, metaPTNg: persistent.metaPTNg, metaLIPg: persistent.metaLIPg,
        metaFibrasg: persistent.metaFibrasg, faseAtual: persistent.faseAtual,
        validadoAntidoping: persistent.validadoAntidoping ?? false,
        dados: { ...dados, version: 1, revisaoFinal: { confirmada: false }, historicoRevisoes: [],
          origemPlanoId: current.id, origemVersion: this.versionOf(current), criadoPorId: user.id, criadoEm: new Date().toISOString() },
        resultados: persistent.resultados
      });
      return this.repo.save(copy);
    }
    return this.persistVersion(current, persistent as Partial<PlanoAlimentar>);
  }

  async revisar(id: string, expectedVersion: number, user: AuthenticatedUser, confirmarComposicaoManual = false) {
    const current = await this.findById(id, user);
    this.assertVersion(current, expectedVersion);
    const reviewer = await this.assertReviewer(user);
    if (current.status !== PlanoAlimentarStatus.EM_REVISAO) {
      throw new BadRequestException('Envie o plano para revisão antes de aprovar.');
    }
    const dados = this.normalizeDados(current.dados);
    validatePrescription(dados);
    await this.assertRestricoesConferidas(current.pacienteId, dados);
    assertSubstitutosAutomaticos(dados);
    const pending = Object.values(this.asRecord(dados.catalogo)).map((food) => this.asRecord(food))
      .filter((food) => food.origemComposicao !== 'catalogo' && !food.validacaoComposicao);
    if (pending.length && !confirmarComposicaoManual) {
      throw new BadRequestException('Confira e confirme explicitamente a composição dos alimentos manuais ou legados antes de aprovar.');
    }
    const now = new Date().toISOString();
    dados.version = this.versionOf(current) + 1;
    for (const food of pending) food.validacaoComposicao = { porId: reviewer.id, em: now, version: dados.version };
    dados.revisaoFinal = { confirmada: true, origem: 'servidor', version: dados.version,
      confirmadoEm: now, confirmadoPorId: reviewer.id, confirmadoPorNome: reviewer.name, crn: reviewer.crn };
    const enriched = await this.enrichPatchWithValidation({ ...current, dados });
    return this.persistVersion(current, { dados, resultados: enriched.resultados });
  }

  async ativar(id: string, user: AuthenticatedUser, expectedVersion?: number) {
    const current = await this.findById(id, user);
    this.assertVersion(current, expectedVersion);
    await this.assertReviewer(user);
    if (current.status !== PlanoAlimentarStatus.EM_REVISAO) {
      throw new BadRequestException('Somente um plano em revisão pode ser ativado.');
    }
    assertSubstitutosAutomaticos(this.normalizeDados(current.dados));
    await this.assertCanActivatePlano(current);
    return this.repo.manager.transaction(async (manager) => {
      const patient = await manager.getRepository(Paciente).findOne({
        where: { id: current.pacienteId }, lock: { mode: 'pessimistic_write' }
      });
      if (!patient) throw new NotFoundException('Paciente nao encontrado.');
      const plans = manager.getRepository(PlanoAlimentar);
      const locked = await plans.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!locked) throw new NotFoundException('Plano alimentar nao encontrado.');
      this.assertVersion(locked, expectedVersion);
      const dados = this.normalizeDados(locked.dados);
      const publishedAt = new Date().toISOString();
      dados.version = this.versionOf(locked) + 1;
      dados.revisaoFinal = { ...dados.revisaoFinal, version: dados.version,
        ativadoEm: publishedAt, ativadoPorId: user.id };
      await plans.createQueryBuilder().update(PlanoAlimentar).set({
        status: PlanoAlimentarStatus.ARQUIVADO,
        dados: () => "COALESCE(dados, '{}'::jsonb) || jsonb_build_object('substituidoPorPlanoId', CAST(:newPlan AS text), 'arquivadoEm', CAST(:archivedAt AS text))"
      }).setParameters({ newPlan: id, archivedAt: publishedAt })
        .where('paciente_id = :patientId', { patientId: locked.pacienteId })
        .andWhere('status = :active', { active: PlanoAlimentarStatus.ATIVO })
        .andWhere('id <> :id', { id }).andWhere('deleted_at IS NULL').execute();
      return this.persistVersion(locked, { status: PlanoAlimentarStatus.ATIVO, dados }, plans);
    });
  }

  // UPD-17: mesma regra de vinculo usada em devolver() de avaliacoes — supervisor,
  // supervisao_aluno ou gestao. O aluno responsavel (link 'responsavel') e a
  // equipe (link 'equipe') tem acesso de leitura mas nao devolvem.
  private async assertCanDevolver(user: AuthenticatedUser, pacienteId: string): Promise<void> {
    const paciente = await this.pacientesRepo.findOne({ where: { id: pacienteId } });
    if (!paciente) throw new NotFoundException('Plano alimentar nao encontrado.');
    const link = await resolveClinicalLink(user, paciente, studentLookupFromRepository(this.usersRepo));
    if (!link) throw new NotFoundException('Plano alimentar nao encontrado.');
    if (link !== 'gestao' && link !== 'supervisor' && link !== 'supervisao_aluno') {
      throw new ForbiddenException('Apenas supervisor, profissional vinculado ou gestao podem devolver este plano.');
    }
  }

  async devolver(id: string, expectedVersion: number, observacao: string, user: AuthenticatedUser) {
    const texto = this.toText(observacao);
    if (texto.length < 5 || texto.length > 1000) {
      throw new BadRequestException('Observacao deve ter entre 5 e 1000 caracteres.');
    }

    const current = await this.findById(id, user);
    this.assertVersion(current, expectedVersion);
    await this.assertCanDevolver(user, current.pacienteId);
    if (current.status !== PlanoAlimentarStatus.EM_REVISAO) {
      throw new BadRequestException('Somente um plano em revisão pode ser devolvido.');
    }

    const dados = this.normalizeDados(current.dados);
    const now = new Date().toISOString();
    // Autoria, data e versao fixadas pelo servidor (mesma disciplina de revisaoFinal).
    dados.version = this.versionOf(current) + 1;

    const priorReview = this.asRecord(dados.revisaoFinal);
    if (priorReview.confirmada) {
      // Uma revisao ja confirmada nesta versao fica invalida ao devolver; o
      // historico preserva o registro em vez de apaga-lo.
      dados.historicoRevisoes = [
        ...this.asArray(dados.historicoRevisoes),
        { ...priorReview, invalidadaEm: now, invalidadaPorId: user.id }
      ];
      dados.revisaoFinal = { confirmada: false };
    }

    const registro = {
      porId: user.id,
      porNome: user.name || user.email || null,
      em: now,
      observacao: texto,
      version: dados.version
    };
    dados.devolucoes = [...this.asArray(dados.devolucoes), registro];

    // A prescricao (refeicoes/catalogo) nao muda ao devolver, so resultados
    // (validacao/ativacaoClinica) permanecem os ja calculados; nao ha motivo
    // para reconsultar a ultima avaliacao de GET aqui.
    const saved = await this.persistVersion(current, { status: PlanoAlimentarStatus.RASCUNHO, dados });

    if (current.alunoId) {
      try {
        await this.notificacoes?.createForUsers([current.alunoId], {
          titulo: 'Plano alimentar devolvido',
          mensagem: 'Um plano alimentar foi devolvido com orientacao; abra o prontuario.',
          tipo: 'alerta_clinico'
        });
      } catch {
        // Best-effort — nao interrompe a devolucao.
      }
    }

    return saved;
  }

  /*
   * UPD-17: fila de revisao do responsavel. Nao ha SQL clinico novo: o
   * candidato vem de uma coluna indexada (status 'em_revisao'), e o acesso
   * de cada item e decidido chamando resolveClinicalLink() por paciente — o
   * mesmo contrato usado em assertCanAccessPaciente/devolver, so que
   * aplicado item a item em vez de como fragmento SQL. Papeis sem vinculo
   * de supervisao recebem fila vazia, nunca um erro.
   */
  async findFilaRevisao(user: AuthenticatedUser, filtros: { limit?: number; offset?: number }) {
    const role = normalizeRole(user?.role);
    if (!hasGlobalAccess(role) && !hasTeamScopedAccess(role)) {
      return [];
    }

    const limit = Math.max(1, Math.min(100, Math.floor(this.toNumber(filtros.limit) || 25)));
    const offset = Math.max(0, Math.floor(this.toNumber(filtros.offset) || 0));

    const candidatos = await this.repo.find({ where: { status: PlanoAlimentarStatus.EM_REVISAO, deletedAt: IsNull() } });

    const elegiveis: Array<{ plano: PlanoAlimentar; paciente: Paciente }> = [];
    for (const plano of candidatos) {
      const paciente = await this.pacientesRepo.findOne({ where: { id: plano.pacienteId } });
      if (!paciente) continue;
      if (!hasGlobalAccess(role)) {
        const link = await resolveClinicalLink(user, paciente, studentLookupFromRepository(this.usersRepo));
        if (!link) continue;
      }
      elegiveis.push({ plano, paciente });
    }

    const alunoIds = [...new Set(elegiveis.map((item) => item.plano.alunoId).filter((id): id is string => Boolean(id)))];
    const alunos = alunoIds.length && this.usersRepo ? await this.usersRepo.find({ where: { id: In(alunoIds) } }) : [];
    const alunoNomeById = new Map(alunos.map((aluno) => [aluno.id, aluno.name]));

    const itens = elegiveis.map(({ plano, paciente }) => ({
      tipo: 'plano' as const,
      id: plano.id,
      pacienteId: plano.pacienteId,
      pacienteNome: paciente.nome || null,
      tipoInstrumento: plano.tipoDieta || null,
      enviadoPorId: plano.alunoId || null,
      enviadoPorNome: (plano.alunoId && alunoNomeById.get(plano.alunoId)) || null,
      enfileiradoEm: plano.updatedAt,
      rota: `/prescricao-plano/${plano.pacienteId}`
    }));

    itens.sort((a, b) => new Date(a.enfileiradoEm).getTime() - new Date(b.enfileiradoEm).getTime());
    return itens.slice(offset, offset + limit);
  }

  async remove(id: string, user: AuthenticatedUser) {
    const current = await this.findById(id, user);
    if (![PlanoAlimentarStatus.RASCUNHO, PlanoAlimentarStatus.EM_REVISAO].includes(current.status)) {
      throw new ForbiddenException('Prescrições publicadas fazem parte do histórico e não podem ser excluídas.');
    }
    await this.repo.softDelete(current.id);
    return { deleted: true };
  }

  async gerarPDF(planoId: string, user?: AuthenticatedUser, expectedVersion?: number): Promise<Buffer> {
    const plano = user
      ? await this.findById(planoId, user)
      : await this.repo.findOne({ where: { id: planoId }, withDeleted: false });
    if (!plano) throw new NotFoundException('Plano alimentar não encontrado.');
    if (expectedVersion !== undefined) this.assertVersion(plano, expectedVersion);

    const dados = this.normalizeDados(plano.dados || {});
    dados.refeicoes = mealsForPrint(dados);
    const paciente = await this.pacientesRepo.findOne({ where: { id: plano.pacienteId } });
    const report = planoAlimentarPdfReport(plano, paciente, dados, this.hasCurrentReview(plano));
    try { require.resolve('pdfkit'); } catch {
      throw new BadRequestException('Dependencia pdfkit nao instalada no servidor.');
    }
    return renderLainesPdf(report);
  }
}
