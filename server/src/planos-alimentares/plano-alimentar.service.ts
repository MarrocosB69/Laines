import {
  BadRequestException,
  ConflictException,
  Optional,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AuthenticatedUser,
  hasGlobalAccess,
  hasTeamScopedAccess,
  isStudentMemberRole,
  normalizeRole
} from '../auth/access-control';
import { Avaliacao } from '../avaliacoes/avaliacao.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { PlanoAlimentar, PlanoAlimentarStatus } from './plano-alimentar.entity';
import { User } from '../users/user.entity';
import { TacoFood } from '../taco/taco.entity';
import { normalizePrescription, mealsForPrint, prescriptionTotals, validatePrescription } from './prescricao-contract';

type JsonRecord = Record<string, unknown>;

type PlanoAlimento = {
  tacoId?: number | null;
  descricao?: string;
  quantidadeGramas?: number | null;
  medidaCaseira?: string | null;
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
  prescrito: number;
  diferenca: number | null;
  adequacao: number | null;
};

export type ValidacaoResult = {
  scoreAdequacaoPercent: number;
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
    @Optional() @InjectRepository(TacoFood) private readonly foodsRepo?: Repository<TacoFood>
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

  private async assertCanAccessPaciente(user: AuthenticatedUser, pacienteId: string) {
    const role = normalizeRole(user?.role);
    if (hasGlobalAccess(role)) return;

    const paciente = await this.pacientesRepo.findOne({ where: { id: pacienteId } });
    if (!paciente) throw new NotFoundException('Paciente nao encontrado.');

    const userId = this.toText(user?.id);
    if (!userId) {
      throw new ForbiddenException('Usuario sem identificacao valida para acessar este paciente.');
    }

    if (role === 'atleta') {
      if (paciente.atletaUserId === userId) return;
      throw new ForbiddenException('Acesso negado para este paciente.');
    }

    if (isStudentMemberRole(role)) {
      const isResponsavel = paciente.alunoResponsavelId === userId;
      const isEquipeTecnica = Array.isArray(paciente.equipeTecnicaIds) && paciente.equipeTecnicaIds.includes(userId);
      const isEquipeMulti = Array.isArray(paciente.equipeMultiIds) && paciente.equipeMultiIds.includes(userId);
      const isEquipe = isEquipeTecnica || isEquipeMulti;
      if (isResponsavel || isEquipe) return;
      throw new ForbiddenException('Acesso negado para este paciente.');
    }

    if (hasTeamScopedAccess(role)) {
      const isSupervisor = paciente.professorSupervisorId === userId;
      const isResponsavel = paciente.alunoResponsavelId === userId;
      const isEquipeTecnica = Array.isArray(paciente.equipeTecnicaIds) && paciente.equipeTecnicaIds.includes(userId);
      const isEquipeMulti = Array.isArray(paciente.equipeMultiIds) && paciente.equipeMultiIds.includes(userId);
      const isEquipe = isEquipeTecnica || isEquipeMulti;
      if (isSupervisor || isResponsavel || isEquipe) return;
      throw new ForbiddenException('Acesso negado para este paciente.');
    }

    throw new ForbiddenException('Acesso negado para este paciente.');
  }

  private async getScopedPacienteIds(user: AuthenticatedUser): Promise<string[]> {
    const role = normalizeRole(user?.role);
    if (hasGlobalAccess(role)) {
      return [];
    }

    const userId = this.toText(user?.id);
    if (!userId) return [];

    const qb = this.pacientesRepo.createQueryBuilder('paciente').select('paciente.id', 'id');
    if (role === 'atleta') {
      qb.where('paciente.atletaUserId = :userId', { userId });
    } else if (isStudentMemberRole(role)) {
      qb.where('paciente.alunoResponsavelId = :userId', { userId })
        .orWhere(':userId = ANY(COALESCE(paciente.equipeTecnicaIds, ARRAY[]::uuid[]))', { userId })
        .orWhere(':userId = ANY(COALESCE(paciente.equipeMultiIds, ARRAY[]::uuid[]))', { userId });
    } else if (hasTeamScopedAccess(role)) {
      qb.where('paciente.professorSupervisorId = :userId', { userId })
        .orWhere('paciente.alunoResponsavelId = :userId', { userId })
        .orWhere(':userId = ANY(COALESCE(paciente.equipeTecnicaIds, ARRAY[]::uuid[]))', { userId })
        .orWhere(':userId = ANY(COALESCE(paciente.equipeMultiIds, ARRAY[]::uuid[]))', { userId });
    } else {
      return [];
    }

    const rows = await qb.getRawMany<{ id: string }>();
    return rows.map((row) => row.id).filter(Boolean);
  }

  private async resolveUltimaAvaliacaoGet(pacienteId: string) {
    const row = await this.avaliacoesRepo.createQueryBuilder('avaliacao')
      .where('avaliacao.pacienteId = :pacienteId', { pacienteId })
      .andWhere('avaliacao.tipo = :tipo', { tipo: 'gasto_energetico_total' })
      .andWhere('avaliacao.deletedAt IS NULL')
      .orderBy('avaliacao.measuredAt', 'DESC', 'NULLS LAST')
      .addOrderBy('avaliacao.data', 'DESC', 'NULLS LAST')
      .addOrderBy('avaliacao.updatedAt', 'DESC')
      .getOne();

    return row || null;
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
    return normalizePrescription(input);
  }

  private computeComparativo(meta: number | null, prescrito: number): ValidacaoComparativoItem {
    if (!Number.isFinite(meta) || (meta as number) <= 0) {
      return {
        meta: null,
        prescrito,
        diferenca: null,
        adequacao: null
      };
    }
    const diferenca = round(prescrito - (meta as number), 2);
    return {
      meta: round(meta as number, 2),
      prescrito,
      diferenca,
      adequacao: this.clampAdequacao(meta as number, prescrito)
    };
  }

  async calcularTotais(refeicoes: PlanoRefeicao[], catalogo: JsonRecord = {}): Promise<NutrientesTotais> {
    return prescriptionTotals(this.normalizeDados({ refeicoes, catalogo }));
  }

  async validarAdequacao(plano: { pacienteId: string; dados?: JsonRecord | null }): Promise<ValidacaoResult> {
    const dados = this.normalizeDados(plano?.dados || {});
    const totaisPrescritos = prescriptionTotals(dados);
    const avaliacaoGet = await this.resolveUltimaAvaliacaoGet(this.toText(plano?.pacienteId));
    const metasGet = this.extractGetMetasFromAvaliacao(avaliacaoGet);

    const comparativo = {
      calorias: this.computeComparativo(metasGet.calorias, totaisPrescritos.calorias),
      cho: this.computeComparativo(metasGet.cho, totaisPrescritos.cho),
      ptn: this.computeComparativo(metasGet.ptn, totaisPrescritos.ptn),
      lip: this.computeComparativo(metasGet.lip, totaisPrescritos.lip),
      fibras: this.computeComparativo(metasGet.fibras, totaisPrescritos.fibra)
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
      : 0;

    const hasMetasGet = Boolean(metasGet.avaliacaoId);

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
      dados: dados as unknown as JsonRecord
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
      dados: dados as unknown as JsonRecord,
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
    return { ...this.normalizeDados(dados), revisaoFinal: { confirmada: false } };
  }

  private versionOf(plano: { dados?: JsonRecord | null }) {
    return Number(this.asRecord(plano.dados).version) || 0;
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
        catalogo[id] = { ...incoming, id, nome: source.descricao, fonte: source.fonte || 'TACO', grupo: source.grupo,
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

  private async persistVersion(current: PlanoAlimentar, patch: Partial<PlanoAlimentar>) {
    const expected = this.versionOf(current);
    const result = await this.repo.createQueryBuilder().update(PlanoAlimentar).set(patch)
      .where('id = :id', { id: current.id })
      .andWhere('deleted_at IS NULL')
      .andWhere("COALESCE((dados->>'version')::int, 0) = :version", { version: expected })
      .execute();
    if (result.affected !== 1) throw new ConflictException('Outra pessoa alterou este plano. Reabra antes de continuar.');
    return this.repo.findOneByOrFail({ id: current.id });
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
    } else if (!hasGlobalAccess(role)) {
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

    if (role === 'atleta') qb.andWhere('plano.status = :publishedStatus', { publishedStatus: PlanoAlimentarStatus.ATIVO });
    const planos = await qb.getMany();
    return planos.map((plano) => ({ ...plano, dados: this.normalizeDados(plano.dados) }));
  }

  async findById(id: string, user: AuthenticatedUser) {
    const plano = await this.repo.findOne({
      where: { id },
      withDeleted: false
    });
    if (!plano) throw new NotFoundException('Plano alimentar nao encontrado.');
    await this.assertCanAccessPaciente(user, plano.pacienteId);
    if (normalizeRole(user.role) === 'atleta' && plano.status !== PlanoAlimentarStatus.ATIVO) {
      throw new ForbiddenException('Este plano ainda não foi publicado.');
    }
    return { ...plano, dados: this.normalizeDados(plano.dados) };
  }

  async getPacienteContext(pacienteId: string, user: AuthenticatedUser) {
    await this.assertCanAccessPaciente(user, pacienteId);
    const ultimaAvaliacaoGet = await this.resolveUltimaAvaliacaoGet(pacienteId);
    const metasGet = this.extractGetMetasFromAvaliacao(ultimaAvaliacaoGet);
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
      ultimaAvaliacaoGetId: ultimaAvaliacaoGet?.id || null,
      planoAtivoId: planoAtivo?.id || null
    };
  }

  async create(input: PlanoPatch, user: AuthenticatedUser) {
    await this.assertCanAccessPaciente(user, input.pacienteId);
    const prepared = await this.prepareComposition(input.dados);
    const patch = await this.normalizePatch({ ...input, dados: prepared });
    patch.dados = { ...this.stampRevisaoFinal(patch.dados), version: 1, historicoRevisoes: [],
      criadoPorId: user.id, criadoEm: new Date().toISOString() };
    if (patch.status === PlanoAlimentarStatus.ATIVO) {
      throw new ForbiddenException('Salve, envie para revisão profissional e ative a versão revisada.');
    }

    if (patch.status === PlanoAlimentarStatus.ATIVO) {
      await this.assertCanActivatePlano(patch);
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
    const enriched = await this.enrichPatchWithValidation(patch);
    const { expectedVersion: _expected, ...persistent } = enriched;
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
    const pending = Object.values(dados.catalogo).filter((food: any) => food.origemComposicao !== 'catalogo' && !food.validacaoComposicao);
    if (pending.length && !confirmarComposicaoManual) {
      throw new BadRequestException('Confira e confirme explicitamente a composição dos alimentos manuais ou legados antes de aprovar.');
    }
    const now = new Date().toISOString();
    dados.version = this.versionOf(current) + 1;
    for (const food of pending as any[]) food.validacaoComposicao = { porId: reviewer.id, em: now, version: dados.version };
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
    await this.assertCanActivatePlano(current);
    const dados = this.normalizeDados(current.dados);
    dados.version = this.versionOf(current) + 1;
    dados.revisaoFinal = { ...dados.revisaoFinal, version: dados.version,
      ativadoEm: new Date().toISOString(), ativadoPorId: user.id };
    return this.persistVersion(current, { status: PlanoAlimentarStatus.ATIVO, dados });
  }

  async remove(id: string, user: AuthenticatedUser) {
    const current = await this.findById(id, user);
    await this.repo.softDelete(current.id);
    return { deleted: true };
  }

  private formatDateForPdf(value: string | null | undefined): string {
    const token = this.toText(value);
    if (!token) return '-';
    const parts = token.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return token;
  }

  private formatNumberForPdf(value: unknown, digits = 1): string {
    const parsed = this.toNumber(value);
    if (!Number.isFinite(parsed)) return '-';
    return Number(parsed).toFixed(digits);
  }

  private mapPlanoStatusForPdf(status: unknown): string {
    const token = this.toText(status).toLowerCase();
    if (token === PlanoAlimentarStatus.EM_REVISAO) return 'Em revisao';
    if (token === PlanoAlimentarStatus.ATIVO) return 'Ativo';
    if (token === PlanoAlimentarStatus.ARQUIVADO || token === PlanoAlimentarStatus.ENCERRADO) return 'Arquivado';
    return 'Rascunho';
  }

  private mapWadaStatusForPdf(status: unknown): string {
    const token = this.toText(status).toLowerCase();
    if (token === 'aprovado') return 'Aprovado';
    if (token === 'proibido') return 'Proibido';
    return 'Verificar';
  }

  private mapAdequacaoLabelForPdf(adequacao: number | null): string {
    if (!Number.isFinite(adequacao)) return '-';
    if ((adequacao as number) >= 90) return 'Adequado';
    if ((adequacao as number) >= 80) return 'Ajuste';
    return 'Critico';
  }

  async gerarPDF(planoId: string, user?: AuthenticatedUser): Promise<Buffer> {
    const plano = user
      ? await this.findById(planoId, user)
      : await this.repo.findOne({ where: { id: planoId }, withDeleted: false });
    if (!plano) throw new NotFoundException('Plano alimentar nao encontrado.');

    let PDFDocument: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      PDFDocument = require('pdfkit');
    } catch {
      throw new BadRequestException('Dependencia pdfkit nao instalada no servidor.');
    }

    const validacao = await this.validarAdequacao({
      pacienteId: plano.pacienteId,
      dados: (plano.dados || {}) as JsonRecord
    });
    const dados = this.normalizeDados(plano.dados || {});
    dados.refeicoes = mealsForPrint(dados);
    const ativacaoClinica = await this.validarAtivacaoClinica({
      pacienteId: plano.pacienteId,
      status: plano.status,
      dataInicio: plano.dataInicio,
      dataFim: plano.dataFim,
      tipoDieta: plano.tipoDieta,
      metaCalorica: plano.metaCalorica,
      metaCHOg: plano.metaCHOg,
      metaPTNg: plano.metaPTNg,
      metaLIPg: plano.metaLIPg,
      metaFibrasg: plano.metaFibrasg,
      faseAtual: plano.faseAtual,
      validadoAntidoping: plano.validadoAntidoping,
      dados: (plano.dados || {}) as JsonRecord,
      resultados: (plano.resultados || {}) as JsonRecord
    });
    const paciente = await this.pacientesRepo.findOne({
      where: { id: plano.pacienteId }
    });
    const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const metasGet = validacao.metasGet;

    const tabelaMetas = [
      {
        item: 'Energia (kcal)',
        meta: plano.metaCalorica ?? metasGet.calorias,
        prescrito: validacao.totaisPrescritos.calorias,
        adequacao: validacao.comparativo.calorias.adequacao
      },
      {
        item: 'CHO (g)',
        meta: plano.metaCHOg ?? metasGet.cho,
        prescrito: validacao.totaisPrescritos.cho,
        adequacao: validacao.comparativo.cho.adequacao
      },
      {
        item: 'PTN (g)',
        meta: plano.metaPTNg ?? metasGet.ptn,
        prescrito: validacao.totaisPrescritos.ptn,
        adequacao: validacao.comparativo.ptn.adequacao
      },
      {
        item: 'LIP (g)',
        meta: plano.metaLIPg ?? metasGet.lip,
        prescrito: validacao.totaisPrescritos.lip,
        adequacao: validacao.comparativo.lip.adequacao
      },
      {
        item: 'Fibras (g)',
        meta: plano.metaFibrasg ?? metasGet.fibras,
        prescrito: validacao.totaisPrescritos.fibra,
        adequacao: validacao.comparativo.fibras.adequacao
      }
    ];

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageLeft = doc.page.margins.left;
      const pageRight = doc.page.width - doc.page.margins.right;
      const pageBottom = doc.page.height - doc.page.margins.bottom;
      const contentWidth = pageRight - pageLeft;

      const ensureSpace = (needed = 30) => {
        if (doc.y + needed > pageBottom) {
          doc.addPage();
        }
      };

      const drawSectionTitle = (title: string) => {
        ensureSpace(34);
        doc.moveDown(0.35);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#1565C0').text(title);
        doc.moveDown(0.15);
        const y = doc.y;
        doc.moveTo(pageLeft, y).lineTo(pageRight, y).lineWidth(0.7).strokeColor('#d1d5db').stroke();
        doc.moveDown(0.4);
        doc.fillColor('#111827').font('Helvetica').fontSize(10);
      };

      const drawSimpleLine = (value: string) => {
        ensureSpace(16);
        doc.font('Helvetica').fontSize(10).fillColor('#111827').text(value, {
          width: contentWidth
        });
      };

      const drawMetaRow = (item: string, meta: string, prescrito: string, adequacao: string, shade = false) => {
        ensureSpace(20);
        const rowTop = doc.y;
        const rowHeight = 18;
        if (shade) {
          doc.rect(pageLeft, rowTop, contentWidth, rowHeight).fill('#f8fafc');
        }

        doc.fillColor('#111827').font('Helvetica').fontSize(9);
        doc.text(item, pageLeft + 6, rowTop + 5, { lineBreak: false });
        doc.text(meta, pageLeft + 185, rowTop + 5, { lineBreak: false });
        doc.text(prescrito, pageLeft + 285, rowTop + 5, { lineBreak: false });
        doc.text(adequacao, pageLeft + 390, rowTop + 5);
        doc.y = rowTop + rowHeight;
      };

      const headerTop = doc.y;
      doc.rect(pageLeft, headerTop, contentWidth, 58).fill('#1565C0');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15).text(
        'LAINES | Prescricao de Plano Alimentar',
        pageLeft + 12,
        headerTop + 12,
        { width: contentWidth - 24 }
      );
      doc.font('Helvetica').fontSize(9).text(
        `Documento padrao de exportacao - Gerado em ${geradoEm}`,
        pageLeft + 12,
        headerTop + 34,
        { width: contentWidth - 24 }
      );
      doc.fillColor('#111827');
      doc.y = headerTop + 70;

      drawSectionTitle('Identificacao');
      drawSimpleLine(`Paciente: ${this.toText(paciente?.nome) || '-'}  |  Prontuario: ${this.toText(paciente?.prontuario) || '-'}`);
      drawSimpleLine(`CPF: ${this.toText(paciente?.cpf) || '-'}  |  Modalidade: ${this.toText(paciente?.modalidadePrincipal) || '-'}`);
      drawSimpleLine(`Genero: ${this.toText(paciente?.genero) || '-'}  |  Status atleta: ${this.toText(paciente?.status) || '-'}`);
      drawSimpleLine(`Plano ID: ${plano.id}`);

      drawSectionTitle('Configuracao do plano');
      drawSimpleLine(`Status: ${this.mapPlanoStatusForPdf(plano.status)}  |  Tipo de dieta: ${this.toText(plano.tipoDieta) || '-'}`);
      drawSimpleLine(`Inicio: ${this.formatDateForPdf(plano.dataInicio)}  |  Fim: ${this.formatDateForPdf(plano.dataFim)}`);
      drawSimpleLine(`Fase atual: ${this.toText(plano.faseAtual) || '-'}  |  Antidoping validado: ${plano.validadoAntidoping ? 'Sim' : 'Nao'}`);
      drawSimpleLine(`Score geral de adequacao: ${this.formatNumberForPdf(validacao.scoreAdequacaoPercent, 2)}%`);

      drawSectionTitle('Revisao clinica de ativacao');
      drawSimpleLine(`Pronto para ativacao: ${ativacaoClinica.podeAtivar ? 'Sim' : 'Nao'}`);
      ativacaoClinica.itens.forEach((item) => {
        const marcador = item.ok ? 'OK' : item.severity === 'warning' ? 'Aviso' : 'Bloqueio';
        drawSimpleLine(`${marcador} - ${item.label}: ${item.message}`);
      });

      drawSectionTitle('Metas nutricionais e adequacao');
      ensureSpace(24);
      const headY = doc.y;
      doc.rect(pageLeft, headY, contentWidth, 18).fill('#e2e8f0');
      doc.fillColor('#1f2937').font('Helvetica-Bold').fontSize(9);
      doc.text('Item', pageLeft + 6, headY + 5, { lineBreak: false });
      doc.text('Meta', pageLeft + 185, headY + 5, { lineBreak: false });
      doc.text('Prescrito', pageLeft + 285, headY + 5, { lineBreak: false });
      doc.text('Adequacao', pageLeft + 390, headY + 5);
      doc.y = headY + 18;

      tabelaMetas.forEach((row, index) => {
        drawMetaRow(
          row.item,
          row.meta === null || row.meta === undefined ? '-' : this.formatNumberForPdf(row.meta, 1),
          this.formatNumberForPdf(row.prescrito, 1),
          `${row.adequacao === null ? '-' : `${this.formatNumberForPdf(row.adequacao, 1)}%`} (${this.mapAdequacaoLabelForPdf(row.adequacao)})`,
          index % 2 === 1
        );
      });

      drawSectionTitle('Refeicoes prescritas');
      const refeicoes = dados.refeicoes || [];
      if (!refeicoes.length) {
        drawSimpleLine('Nenhuma refeicao cadastrada no plano.');
      } else {
        refeicoes.forEach((refeicao, index) => {
          const totais = this.asRecord(refeicao.totalRefeicao);
          ensureSpace(44);
          const cardY = doc.y;
          doc.rect(pageLeft, cardY, contentWidth, 20).fill('#f1f5f9');
          doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10).text(
            `${index + 1}. ${this.toText(refeicao.nome) || 'Refeicao'} (${this.toText(refeicao.horario) || '--:--'})`,
            pageLeft + 8,
            cardY + 6,
            { width: contentWidth - 16 }
          );
          doc.y = cardY + 22;

          doc.fillColor('#334155').font('Helvetica').fontSize(9).text(
            `Totais da refeicao: ${this.formatNumberForPdf(totais.calorias, 1)} kcal | CHO ${this.formatNumberForPdf(totais.cho, 1)} g | PTN ${this.formatNumberForPdf(totais.ptn, 1)} g | LIP ${this.formatNumberForPdf(totais.lip, 1)} g | FIB ${this.formatNumberForPdf(totais.fibra, 1)} g`
          );
          doc.moveDown(0.2);

          const alimentos = refeicao.alimentos || [];
          if (!alimentos.length) {
            doc.fillColor('#6b7280').font('Helvetica-Oblique').text('Sem alimentos cadastrados.');
          } else {
            alimentos.forEach((alimento) => {
              ensureSpace(14);
              doc.fillColor('#111827').font('Helvetica').fontSize(9).text(
                `- ${this.toText(alimento.descricao) || 'Alimento'} | ${this.formatNumberForPdf(alimento.quantidadeGramas, 1)} g | ${this.formatNumberForPdf(alimento.calorias, 1)} kcal`
              );
            });
          }

          const substitutos = refeicao.substitutos || [];
          if (substitutos.length) {
            ensureSpace(16);
            doc.fillColor('#475569').font('Helvetica-Oblique').fontSize(9).text('Substitutos sugeridos:');
            substitutos.forEach((item) => {
              ensureSpace(14);
              doc.fillColor('#475569').font('Helvetica-Oblique').fontSize(9).text(
                `  - ${item.substitui ? `Em lugar de ${item.substitui}: ` : 'Alternativa sem vínculo: '}${this.toText(item.descricao) || 'Substituto'} | ${this.formatNumberForPdf(item.quantidadeGramas, 1)} g`
              );
            });
          }

          if (this.toText(refeicao.orientacoes)) {
            ensureSpace(18);
            doc.fillColor('#334155').font('Helvetica').fontSize(9).text(
              `Orientacoes: ${this.toText(refeicao.orientacoes)}`
            );
          }

          doc.moveDown(0.5);
        });
      }

      drawSectionTitle('Suplementacao');
      const suplementos = dados.suplementos || [];
      if (!suplementos.length) {
        drawSimpleLine('Nenhum suplemento registrado.');
      } else {
        suplementos.forEach((item, index) => {
          ensureSpace(15);
          drawSimpleLine(
            `${index + 1}. ${this.toText(item.nome) || 'Suplemento'} | Dose: ${this.toText(item.dose) || '-'} | Horario: ${this.toText(item.horario) || '--:--'} | Marca: ${this.toText(item.marca) || '-'} | WADA: ${this.mapWadaStatusForPdf(item.statusWADA)}`
          );
          if (this.toText(item.justificativaClinica)) {
            drawSimpleLine(`   Justificativa clinica: ${this.toText(item.justificativaClinica)}`);
          }
        });
      }

      drawSectionTitle('Revisão e versão');
      drawSimpleLine(`Versão ${dados.version || 0} | ${dados.revisaoFinal?.confirmada ? `Revisado por ${dados.revisaoFinal.confirmadoPorNome} · CRN ${dados.revisaoFinal.crn} · ${dados.revisaoFinal.confirmadoEm}` : 'Rascunho sem revisão profissional'}`);
      drawSectionTitle('Orientacoes gerais e observacoes');
      drawSimpleLine(this.toText(dados.orientacoesGerais) || 'Sem orientacoes gerais registradas.');
      drawSimpleLine('Suplementos exigem avaliação profissional específica. O GlobalDRO informa sobre medicamentos e não certifica a segurança antidopagem de suplementos.');

      ensureSpace(72);
      doc.moveDown(1);
      const assinaturaY = doc.y;
      doc.strokeColor('#cbd5e1').lineWidth(0.8);
      doc.moveTo(pageLeft, assinaturaY + 24).lineTo(pageLeft + 220, assinaturaY + 24).stroke();
      doc.moveTo(pageRight - 220, assinaturaY + 24).lineTo(pageRight, assinaturaY + 24).stroke();
      doc.fillColor('#475569').font('Helvetica').fontSize(8);
      doc.text('Assinatura do profissional', pageLeft, assinaturaY + 28, { width: 220, align: 'center' });
      doc.text('Assinatura do paciente', pageRight - 220, assinaturaY + 28, { width: 220, align: 'center' });

      doc.end();
    });
  }
}
