import {
  Injectable,
  NotFoundException,
  Optional,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  UnprocessableEntityException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import { Avaliacao } from './avaliacao.entity';
import { AvaliacaoSessao } from './avaliacao-sessao.entity';
import { CriarAvaliacaoDto } from './dto/criar-avaliacao.dto';
import { AtualizarAvaliacaoDto } from './dto/atualizar-avaliacao.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ObservabilityService } from '../observability/observability.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { Paciente } from '../pacientes/paciente.entity';
import { User } from '../users/user.entity';
import {
  AuthenticatedUser,
  hasGlobalAccess,
  hasTeamScopedAccess,
  isStudentMemberRole,
  normalizeRole
} from '../auth/access-control';
import {
  areasRequeridasPorTipo,
  auditManagementAccess,
  clinicalScopeCondition,
  normalizeAreaToken,
  resolveCaseAreas,
  resolveClinicalLink,
  studentLookupFromRepository
} from '../auth/authorization';
import { normalizeAvaliacaoPayload } from './avaliacao-normalizer';
import { AVALIACAO_REGISTRY_BY_TIPO, normalizeAvaliacaoTipo } from './evaluation-registry';
import { ClinicalAlertsService } from './clinical-alerts.service';

type FiltrosAvaliacao = {
  pacienteId?: string;
  projetoId?: string;
  tipo?: string;
  limit?: number;
  offset?: number;
};

type JsonObject = Record<string, unknown>;

const AVALIACAO_STATUS_VALUES = ['rascunho', 'finalizada'] as const;
type AvaliacaoStatus = (typeof AVALIACAO_STATUS_VALUES)[number];
const AVALIACAO_STATUS_TRANSITIONS: Record<AvaliacaoStatus, readonly AvaliacaoStatus[]> = {
  rascunho: ['rascunho', 'finalizada'],
  finalizada: ['finalizada', 'rascunho']
};

const PENDENCIAS_OBRIGATORIAS = ['anamnese_inicial', 'perimetros', 'avaliacao_clinica'] as const;
const PENDENCIAS_OBRIGATORIAS_SET = new Set<string>(PENDENCIAS_OBRIGATORIAS);
const MIN_COMPLETUDE_TO_FINALIZE = 80;
const ATHLETE_SELF_REPORT_TYPES = new Set([
  'alimentar',
  'hidratacao',
  'carga_treino',
  'fisioterapia'
]);
const ATHLETE_RELEASE_CONTROLLED_TYPES = new Set(['avaliacao_socioeconomica']);
const ATHLETE_ALLOWED_CREATE_TYPES = new Set([
  ...ATHLETE_SELF_REPORT_TYPES,
  ...ATHLETE_RELEASE_CONTROLLED_TYPES
]);
const ATHLETE_SENSITIVE_RESULT_TYPES = new Set([
  'triagem_reds',
  'psicologia',
  'exames_laboratoriais'
]);
const REVIEW_ALLOWED_ROLES = new Set([
  'professor',
  'profissional',
  'pesquisador',
  'colaborador',
  'aluno',
  'admin',
  'coordenacao',
  'presidente',
  'vice'
]);
const COMPLETUDE_FIELD_ALIASES: Record<string, string[]> = {
  sexobiologico: ['sexo'],
  prioridade: ['prioridadecuidado'],
  prioridadecuidado: ['prioridade'],
  pressaosistolica: ['pas', 'sistolica'],
  pressaodiastolica: ['pad', 'diastolica'],
  frequenciacardiaca: ['fc'],
  getestimadokcal: ['getkcal', 'getestimado'],
  massamagra: ['massamagrakg'],
  aguatotal: ['aguacorporal', 'aguacorporaltotal'],
  scoreadesaogeral: ['scoreadesao']
};
const SKINFOLD_REQUIRED_FIELDS_BY_PROTOCOL: Record<string, { default?: string[]; male?: string[]; female?: string[] }> = {
  jackson_pollock_3: {
    male: ['peitoral', 'abdominal', 'coxa'],
    female: ['triceps', 'suprailiaca', 'coxa']
  },
  jackson_pollock_7: {
    default: ['peitoral', 'axilar_media', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa']
  },
  durnin_womersley: {
    default: ['biceps', 'triceps', 'subescapular', 'suprailiaca']
  },
  guedes_1985: {
    male: ['abdominal', 'suprailiaca', 'coxa'],
    female: ['triceps', 'suprailiaca', 'coxa']
  },
  petroski_1995: {
    default: ['triceps', 'subescapular', 'suprailiaca', 'panturrilha_medial']
  },
  slaughter_1988: {
    default: ['triceps', 'subescapular']
  }
};

@Injectable()
export class AvaliacoesService {
  constructor(
    @InjectRepository(Avaliacao) private repo: Repository<Avaliacao>,
    @InjectRepository(AvaliacaoSessao) private sessoesRepo: Repository<AvaliacaoSessao>,
    @InjectRepository(Paciente) private pacientesRepo: Repository<Paciente>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private realtime: RealtimeGateway,
    @Optional() private readonly observability?: ObservabilityService,
    @Optional() private readonly auditoria?: AuditoriaService,
    @Optional() private readonly clinicalAlerts?: ClinicalAlertsService,
    @Optional() private readonly notificacoes?: NotificacoesService
  ) {}

  private recordQuery(label: string, startedAt: number, context = 'GET /avaliacoes') {
    this.observability?.recordQuery({
      label,
      durationMs: Date.now() - startedAt,
      context
    });
  }

  private async recordAthleteEbiaSubmissionAudit(params: {
    user: AuthenticatedUser;
    avaliacao: Avaliacao;
    releaseId?: string | null;
    releasedAt?: string | null;
    releasedById?: string | null;
    releasedByName?: string | null;
  }) {
    if (!this.auditoria) return;
    try {
      await this.auditoria.create({
        action: 'avaliacao_ebia_submit_atleta',
        entity: 'avaliacoes',
        entityId: params.avaliacao.id,
        meta: {
          tipo: params.avaliacao.tipo,
          pacienteId: params.avaliacao.pacienteId,
          projetoId: params.avaliacao.projetoId || null,
          sessaoId: params.avaliacao.sessaoId || null,
          status: params.avaliacao.status,
          schemaVersion: params.avaliacao.schemaVersion,
          formulaId: params.avaliacao.formulaId || null,
          formulaVersion: params.avaliacao.formulaVersion || null,
          origemPreenchimento: 'atleta',
          releaseId: params.releaseId || null,
          releasedAt: params.releasedAt || null,
          releasedById: params.releasedById || null,
          releasedByName: params.releasedByName || null
        },
        actor: {
          id: params.user.id,
          role: normalizeRole(params.user.role),
          email: params.user.email || '',
          name: params.user.name || ''
        }
      });
    } catch {
      // Nao interrompe a submissao clinica se o registro de auditoria falhar.
    }
  }

  private normalizeStatus(value?: string, fallback: AvaliacaoStatus = 'rascunho'): AvaliacaoStatus {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return fallback;
    if ((AVALIACAO_STATUS_VALUES as readonly string[]).includes(normalized)) {
      return normalized as AvaliacaoStatus;
    }
    throw new BadRequestException('Status de avaliacao invalido.');
  }

  private assertStatusTransition(source: AvaliacaoStatus, target: AvaliacaoStatus) {
    const allowed = AVALIACAO_STATUS_TRANSITIONS[source] || [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(`Transicao de status invalida: ${source} -> ${target}.`);
    }
  }

  private todayDateIso() {
    return new Date().toISOString().slice(0, 10);
  }

  private async resolveSessaoExistenteOrThrow(sessaoId: string, pacienteId: string) {
    const sessao = await this.sessoesRepo.findOne({ where: { id: sessaoId } });
    if (!sessao) {
      throw new NotFoundException('Sessao de avaliacao nao encontrada.');
    }
    if (sessao.pacienteId !== pacienteId) {
      throw new ForbiddenException('Sessao informada nao pertence ao paciente desta avaliacao.');
    }
    return sessao;
  }

  private resolveFormulaDefaults(tipo: string, formulaId?: string, formulaVersion?: string) {
    const normalizedType = String(tipo || '').trim().toLowerCase();
    if (formulaId && formulaVersion) {
      return { formulaId, formulaVersion };
    }
    if (normalizedType === 'dobras_cutaneas') {
      return {
        formulaId: formulaId || 'jp7_siri_cunningham',
        formulaVersion: formulaVersion || '1.0.0'
      };
    }
    if (normalizedType === 'hidratacao') {
      return {
        formulaId: formulaId || 'hidratacao_balanco_hidrico',
        formulaVersion: formulaVersion || '1.0.0'
      };
    }
    if (normalizedType === 'alimentar') {
      return {
        formulaId: formulaId || 'nova_percentual_distribuicao',
        formulaVersion: formulaVersion || '1.0.0'
      };
    }
    if (normalizedType === 'exames_laboratoriais') {
      return {
        formulaId: formulaId || 'lab_ref_range_v1',
        formulaVersion: formulaVersion || '1.0.0'
      };
    }
    if (normalizedType === 'evolucao_retorno') {
      return {
        formulaId: formulaId || 'evolucao_adesao_score_v1',
        formulaVersion: formulaVersion || '1.0.0'
      };
    }
    return { formulaId, formulaVersion };
  }

  private normalizeMeasuredAt(value?: string | Date) {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date;
  }

  private async resolveOrCreateSessao(params: {
    sessaoId?: string;
    paciente: Paciente;
    user: AuthenticatedUser;
    projetoId?: string | null;
    dataReferencia?: string;
  }) {
    const {
      sessaoId,
      paciente,
      user,
      projetoId,
      dataReferencia
    } = params;

    if (sessaoId) {
      return this.resolveSessaoExistenteOrThrow(sessaoId, paciente.id);
    }

    const referencia = dataReferencia || this.todayDateIso();
    const profissionalId = user.id || null;

    const query = this.sessoesRepo.createQueryBuilder('sessao')
      .where('sessao.pacienteId = :pacienteId', { pacienteId: paciente.id })
      .andWhere('sessao.dataReferencia = :referencia', { referencia })
      .andWhere('sessao.status = :status', { status: 'rascunho' });

    if (profissionalId) {
      query.andWhere('sessao.profissionalId = :profissionalId', { profissionalId });
    } else {
      query.andWhere('sessao.profissionalId IS NULL');
    }

    const existente = await query
      .orderBy('sessao.updatedAt', 'DESC')
      .getOne();

    if (existente) {
      return existente;
    }

    const novaSessao = this.sessoesRepo.create({
      pacienteId: paciente.id,
      profissionalId: profissionalId || undefined,
      projetoId: projetoId || paciente.projetoId || undefined,
      dataReferencia: referencia,
      status: 'rascunho'
    });
    return this.sessoesRepo.save(novaSessao);
  }

  private async syncSessaoStatus(sessaoId?: string | null) {
    if (!sessaoId) return;
    const sessao = await this.sessoesRepo.findOne({ where: { id: sessaoId } });
    if (!sessao) return;
    const pendentes = await this.repo.count({
      where: {
        sessaoId,
        status: 'rascunho'
      },
      withDeleted: false
    });
    const proximoStatus = pendentes > 0 ? 'rascunho' : 'finalizada';
    if (sessao.status !== proximoStatus) {
      await this.sessoesRepo.save({
        id: sessao.id,
        status: proximoStatus
      });
    }
  }

  private mapListRow(row: Record<string, unknown>) {
    const pontuacao = row.pontuacaoEBIA;
    const pontuacaoEBIA = pontuacao === null || pontuacao === undefined
      ? null
      : Number(pontuacao);
    return {
      id: row.id as string,
      sessaoId: (row.sessaoId as string) || null,
      tipo: row.tipo as string,
      pacienteId: row.pacienteId as string,
      projetoId: (row.projetoId as string) || null,
      projetoNome: (row.projetoNome as string) || null,
      alunoId: (row.alunoId as string) || null,
      status: row.status as string,
      data: (row.data as string) || null,
      schemaVersion: Number(row.schemaVersion || 1),
      formulaId: (row.formulaId as string) || null,
      formulaVersion: (row.formulaVersion as string) || null,
      sourceSystem: (row.sourceSystem as string) || null,
      sourceRef: (row.sourceRef as string) || null,
      measuredAt: (row.measuredAt as Date) || null,
      classificacao: (row.classificacao as string) || null,
      classificacaoLabel: (row.classificacaoLabel as string) || null,
      pontuacaoEBIA: Number.isFinite(pontuacaoEBIA) ? pontuacaoEBIA : null,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date
    };
  }

  private compactRecord(record: JsonObject): JsonObject {
    return Object.entries(record).reduce<JsonObject>((acc, [key, value]) => {
      if (value === undefined || value === null || value === '') return acc;
      if (typeof value === 'number' && !Number.isFinite(value)) return acc;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = this.compactRecord(value as JsonObject);
        if (Object.keys(nested).length > 0) acc[key] = nested;
        return acc;
      }
      acc[key] = value;
      return acc;
    }, {});
  }

  private pickAthletePublicMeta(meta: unknown): JsonObject {
    const source = this.asRecord(meta);
    return this.compactRecord({
      completude: typeof source.completude === 'number' ? source.completude : undefined,
      origemPreenchimento: source.origemPreenchimento,
      atletaSelfReport: source.atletaSelfReport,
      aguardandoRevisao: source.aguardandoRevisao,
      submittedAt: source.submittedAt
    });
  }

  private pickAthletePublicData(tipo: string, avaliacao: Avaliacao): JsonObject | undefined {
    const dados = this.asRecord(avaliacao.dados);
    const input = this.asRecord(dados.input);
    if (tipo === 'avaliacao_socioeconomica') {
      return this.compactRecord({
        temMenores: this.pickFirstValue(input.temMenores, dados.temMenores)
      });
    }
    if (tipo === 'fisioterapia') {
      return this.compactRecord({
        intensidadeDor: this.pickFirstValue(input.intensidadeDor, dados.intensidadeDor),
        mobilidade: this.pickFirstValue(input.mobilidade, dados.mobilidade),
        riscoLesao: this.pickFirstValue(input.riscoLesao, dados.riscoLesao)
      });
    }
    if (tipo === 'carga_treino') {
      return this.compactRecord({
        faseAtual: this.pickFirstValue(dados.faseAtual, input.faseAtual),
        estrategiaTreinamento: this.pickFirstValue(dados.estrategiaTreinamento, input.estrategiaTreinamento)
      });
    }
    return undefined;
  }

  private pickAthletePublicResults(tipo: string, avaliacao: Avaliacao): JsonObject | undefined {
    const resultados = this.asRecord(avaliacao.resultados);
    const calculated = this.asRecord(resultados.calculated);
    const output = this.asRecord(resultados.output);

    if (tipo === 'alimentar') {
      const percentuais = this.asRecord(this.pickFirstValue(
        calculated.percentuais,
        resultados.percentuais,
        avaliacao.percentuais
      ));
      const totalDiario = this.pickFirstValue(calculated.totalDiario, resultados.totalDiario, avaliacao.totalDiario);
      const classificacao = this.pickFirstValue(output.classificacao, resultados.classificacao, avaliacao.classificacao);
      return this.compactRecord({
        calculated: {
          totalDiario,
          percentuais
        },
        output: {
          classificacao
        },
        totalDiario,
        percentuais,
        classificacao
      });
    }

    if (tipo === 'hidratacao') {
      const perdaPesoPercentual = this.pickFirstValue(calculated.perdaPesoPercentual, resultados.perdaPesoPercentual);
      const taxaSudoreseLh = this.pickFirstValue(calculated.taxaSudoreseLh, resultados.taxaSudoreseLh);
      const classificacaoHidrica = this.pickFirstValue(output.classificacaoHidrica, resultados.classificacaoHidrica, avaliacao.classificacaoLabel);
      return this.compactRecord({
        calculated: {
          perdaPesoPercentual,
          taxaSudoreseLh
        },
        output: {
          classificacaoHidrica
        },
        perdaPesoPercentual,
        taxaSudoreseLh,
        classificacaoHidrica
      });
    }

    if (tipo === 'carga_treino') {
      const cargaSemanaAtual = this.pickFirstValue(calculated.cargaSemanaAtual, resultados.cargaSemanaAtual);
      const acwr = this.pickFirstValue(calculated.acwr, resultados.acwr);
      const classificacaoAcwr = this.pickFirstValue(output.classificacaoAcwr, resultados.classificacaoAcwr, avaliacao.classificacao);
      const monotonia = this.pickFirstValue(calculated.monotonia, resultados.monotonia);
      const strain = this.pickFirstValue(calculated.strain, resultados.strain);
      return this.compactRecord({
        calculated: {
          cargaSemanaAtual,
          acwr,
          classificacaoAcwr,
          monotonia,
          strain
        },
        output: {
          classificacaoAcwr
        },
        cargaSemanaAtual,
        acwr,
        classificacaoAcwr,
        monotonia,
        strain
      });
    }

    if (tipo === 'avaliacao_socioeconomica') {
      const pontuacaoEBIA = this.pickFirstValue(calculated.pontuacaoEBIA, resultados.pontuacaoEBIA, avaliacao.pontuacaoEBIA);
      const classificacaoLabel = this.pickFirstValue(output.classificacaoLabel, resultados.classificacaoLabel, avaliacao.classificacaoLabel);
      return this.compactRecord({
        calculated: {
          pontuacaoEBIA
        },
        output: {
          classificacaoLabel
        },
        pontuacaoEBIA,
        classificacaoLabel
      });
    }

    return undefined;
  }

  private mapAthleteEvaluationRow(avaliacao: Avaliacao) {
    const tipo = normalizeAvaliacaoTipo(avaliacao.tipo);
    const publicData = this.pickAthletePublicData(tipo, avaliacao);
    const publicResults = this.pickAthletePublicResults(tipo, avaliacao);
    const canExposeClassification = !ATHLETE_SENSITIVE_RESULT_TYPES.has(tipo);
    return {
      id: avaliacao.id,
      sessaoId: avaliacao.sessaoId || null,
      tipo: avaliacao.tipo,
      pacienteId: avaliacao.pacienteId,
      projetoId: avaliacao.projetoId || null,
      projetoNome: avaliacao.projetoNome || null,
      alunoId: avaliacao.alunoId || null,
      status: avaliacao.status,
      data: avaliacao.data || null,
      schemaVersion: avaliacao.schemaVersion || 1,
      formulaId: avaliacao.formulaId || null,
      formulaVersion: avaliacao.formulaVersion || null,
      sourceSystem: avaliacao.sourceSystem || null,
      sourceRef: avaliacao.sourceRef || null,
      measuredAt: avaliacao.measuredAt || null,
      classificacao: canExposeClassification ? avaliacao.classificacao || null : null,
      classificacaoLabel: canExposeClassification ? avaliacao.classificacaoLabel || null : null,
      pontuacaoEBIA: Number.isFinite(avaliacao.pontuacaoEBIA) ? avaliacao.pontuacaoEBIA : null,
      revisadoEm: avaliacao.revisadoEm || null,
      revisadoPorNome: avaliacao.revisadoPorNome || null,
      meta: this.pickAthletePublicMeta(avaliacao.meta),
      dados: publicData,
      resultados: publicResults,
      createdAt: avaliacao.createdAt,
      updatedAt: avaliacao.updatedAt
    };
  }

  private shouldUseListProjection(filtros: FiltrosAvaliacao) {
    return Number.isFinite(filtros.limit) && !filtros.pacienteId;
  }

  // Contrato unico (UPD-12).
  private async canAccessViaPaciente(user: AuthenticatedUser, paciente: Paciente | null) {
    return (await resolveClinicalLink(user, paciente, studentLookupFromRepository(this.usersRepo))) !== null;
  }

  private applyAccessiblePacienteScope(
    qb: SelectQueryBuilder<Avaliacao>,
    user: AuthenticatedUser
  ) {
    if (!user.id) {
      qb.andWhere('1 = 0');
      return;
    }

    const alunosSupervisionadosSubQuery = this.usersRepo
      .createQueryBuilder('aluno_supervisionado')
      .select('aluno_supervisionado.id')
      .where('(aluno_supervisionado.supervisorId = :userId OR aluno_supervisionado.profissionalId = :userId)')
      .andWhere('aluno_supervisionado.deletedAt IS NULL');

    const equipePacientesSubQuery = this.pacientesRepo
      .createQueryBuilder('paciente')
      .select('paciente.id')
      .where(
        clinicalScopeCondition({ alias: 'paciente', user, supervisedStudentsSubquery: alunosSupervisionadosSubQuery.getQuery() }) || '1 = 0',
        { userId: user.id }
      );
    qb.andWhere(
      `avaliacao.pacienteId IN (${equipePacientesSubQuery.getQuery()})`
    );
    qb.setParameters({
      ...alunosSupervisionadosSubQuery.getParameters(),
      ...equipePacientesSubQuery.getParameters()
    });
  }

  private canUseEvaluationAuthor(
    user: AuthenticatedUser,
    paciente: Paciente,
    alunoId?: string | null
  ) {
    const role = normalizeRole(user.role);
    if (!alunoId) return true;
    if (role === 'atleta') {
      return paciente.alunoResponsavelId === alunoId;
    }
    if (isStudentMemberRole(role)) {
      return alunoId === user.id;
    }
    return true;
  }

  // Regra de area vive no contrato unico (UPD-12); aqui so ha delegacao.
  private normalizeAreaToken(value?: string | null): string | null {
    return normalizeAreaToken(value);
  }

  private resolveEvaluationAreas(tipo?: string | null): string[] {
    return areasRequeridasPorTipo(normalizeAvaliacaoTipo(String(tipo || '')));
  }

  private getCaseEditableAreas(user: AuthenticatedUser, paciente: Paciente): Set<string> {
    return resolveCaseAreas(user, paciente);
  }

  private assertCaseAreaEditAccess(user: AuthenticatedUser, paciente: Paciente, tipo?: string | null): void {
    const role = normalizeRole(user.role);
    if (hasGlobalAccess(role) || role === 'atleta') return;
    if (!isStudentMemberRole(role)) {
      throw new ForbiddenException('Sem permissao para criar ou editar avaliacao.');
    }

    const userAreas = this.getCaseEditableAreas(user, paciente);
    const requiredAreas = this.resolveEvaluationAreas(tipo);
    if (!requiredAreas.some((area) => userAreas.has(area))) {
      throw new ForbiddenException('Formulario restrito a area de atuacao do membro neste caso.');
    }
  }

  async findEditableById(id: string, user: AuthenticatedUser) {
    const avaliacao = await this.findById(id, user);
    if (!avaliacao) return null;
    const paciente = await this.pacientesRepo.findOne({ where: { id: avaliacao.pacienteId } });
    if (!paciente) return null;
    this.assertCaseAreaEditAccess(user, paciente, avaliacao.tipo);
    return avaliacao;
  }

  private asRecord(value: unknown): JsonObject {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as JsonObject;
  }

  private asArray(value: unknown): unknown[] {
    if (!Array.isArray(value)) return [];
    return value;
  }

  private pickFirstValue(...values: unknown[]) {
    for (const value of values) {
      if (value !== undefined && value !== null) return value;
    }
    return null;
  }

  private toText(value: unknown) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toBooleanChoice(value: unknown): boolean | null {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;
    const token = this.normalizeCompletudeKey(String(value || ''));
    if (!token) return null;
    if (['sim', 'true', '1', 'yes', 'y'].includes(token)) return true;
    if (['nao', 'false', '0', 'no', 'n'].includes(token)) return false;
    return null;
  }

  private normalizeSexToken(value: unknown): 'male' | 'female' | null {
    const token = this.normalizeCompletudeKey(String(value || ''));
    if (!token) return null;
    if (token === 'm' || token === 'male' || token.includes('masc')) return 'male';
    if (token === 'f' || token === 'female' || token.includes('fem')) return 'female';
    return null;
  }

  private resolveRequiredSkinfoldFields(protocolId: unknown, sexToken: 'male' | 'female' | null) {
    const protocolKey = normalizeAvaliacaoTipo(String(protocolId || '')) || 'jackson_pollock_7';
    const protocol = SKINFOLD_REQUIRED_FIELDS_BY_PROTOCOL[protocolKey] || SKINFOLD_REQUIRED_FIELDS_BY_PROTOCOL.jackson_pollock_7;
    if (sexToken && Array.isArray(protocol?.[sexToken]) && protocol[sexToken]!.length > 0) {
      return protocol[sexToken]!;
    }
    if (Array.isArray(protocol?.default)) {
      return protocol.default;
    }
    return [];
  }

  private formatSkinfoldFieldLabel(field: string) {
    const normalized = String(field || '').trim().replace(/_/g, ' ');
    if (!normalized) return field;
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  private assertEbiaFinalizationRequirements(payload: unknown) {
    const envelope = this.asRecord(payload);
    const dados = this.asRecord(envelope.dados);
    const dadosBrutos = this.asRecord(dados.dados_brutos);
    const input = this.asRecord(dados.input);
    const respostas = [
      this.asRecord(dados.respostas),
      this.asRecord(dadosBrutos.respostas),
      this.asRecord(input.respostas)
    ];

    const temMenoresChoice = this.toBooleanChoice(this.pickFirstValue(
      dados.temMenores,
      dadosBrutos.temMenores,
      input.temMenores,
      envelope.temMenores
    ));
    if (temMenoresChoice === null) {
      throw new BadRequestException('EBIA exige informar se ha moradores menores de 18 anos para finalizar.');
    }

    const totalPerguntas = temMenoresChoice ? 14 : 8;
    const faltantes: string[] = [];

    for (let index = 1; index <= totalPerguntas; index += 1) {
      const key = `q${index}`;
      const value = this.pickFirstValue(
        ...respostas.map((item) => item[key]),
        dados[key],
        dadosBrutos[key],
        input[key],
        envelope[key]
      );
      if (this.toBooleanChoice(value) === null) {
        faltantes.push(key);
      }
    }

    if (faltantes.length > 0) {
      const preview = faltantes.slice(0, 6).join(', ');
      const suffix = faltantes.length > 6 ? ', ...' : '';
      throw new BadRequestException(
        `EBIA incompleta para finalizacao. Responda todas as perguntas obrigatorias (${preview}${suffix}).`
      );
    }
  }

  private assertSkinfoldFinalizationRequirements(payload: unknown) {
    const envelope = this.asRecord(payload);
    const dados = this.asRecord(envelope.dados);
    const dadosBrutos = this.asRecord(dados.dados_brutos);
    const input = this.asRecord(dados.input);
    const dobras = [
      this.asRecord(dados.dobras),
      this.asRecord(dadosBrutos.dobras),
      this.asRecord(input.dobras)
    ];

    const protocolo = this.toText(this.pickFirstValue(
      dados.protocolo,
      dadosBrutos.protocolo,
      input.protocolo,
      envelope.protocolo
    ));
    if (!protocolo) {
      throw new BadRequestException('Dobras cutaneas exigem protocolo informado para finalizar.');
    }

    const sexo = this.normalizeSexToken(this.pickFirstValue(
      dados.sexo,
      dadosBrutos.sexo,
      input.sexo,
      envelope.sexo
    ));
    if (!sexo) {
      throw new BadRequestException('Dobras cutaneas exigem sexo biologico para validar o protocolo ao finalizar.');
    }

    const requiredFields = this.resolveRequiredSkinfoldFields(protocolo, sexo);
    const missing = requiredFields.filter((field) => {
      const numeric = this.toNumber(this.pickFirstValue(
        ...dobras.map((item) => item[field]),
        dados[field],
        dadosBrutos[field],
        input[field],
        envelope[field]
      ));
      return !Number.isFinite(numeric);
    });

    if (missing.length > 0) {
      const labels = missing.map((field) => this.formatSkinfoldFieldLabel(field)).join(', ');
      throw new BadRequestException(
        `Dobras cutaneas incompletas para o protocolo selecionado. Campos obrigatorios ausentes: ${labels}.`
      );
    }
  }

  private assertLaboratoryFinalizationRequirements(payload: unknown) {
    const envelope = this.asRecord(payload);
    const dados = this.asRecord(envelope.dados);
    const dadosBrutos = this.asRecord(dados.dados_brutos);
    const input = this.asRecord(dados.input);

    const analitos = [
      ...this.asArray(dadosBrutos.analitos),
      ...this.asArray(dados.analitos),
      ...this.asArray(input.analitos),
      ...this.asArray(envelope.registros)
    ];

    if (analitos.length === 0) {
      throw new BadRequestException('Exames laboratoriais exigem ao menos um analito preenchido para finalizar.');
    }

    const hasValidAnalito = analitos.some((item) => {
      const row = this.asRecord(item);
      const nome = this.toText(this.pickFirstValue(row.nome, row.analito, row.nomeAnalito));
      const nomeSintetico = /^analito_\d+$/i.test(nome);
      const valor = this.toNumber(this.pickFirstValue(row.valor, row.value, row.resultado));
      return Boolean(nome) && !nomeSintetico && Number.isFinite(valor);
    });

    if (!hasValidAnalito) {
      throw new BadRequestException('Exames laboratoriais exigem ao menos um analito com nome e valor numerico para finalizar.');
    }
  }

  private assertPerimetrosFinalizationRequirements(payload: unknown) {
    const envelope = this.asRecord(payload);
    const dados = this.asRecord(envelope.dados);
    const dadosBrutos = this.asRecord(dados.dados_brutos);
    const input = this.asRecord(dados.input);

    const focoCardiometabolico = this.toBooleanChoice(this.pickFirstValue(
      dados.focoCardiometabolico,
      dados.foco_cardiometabolico,
      dadosBrutos.focoCardiometabolico,
      dadosBrutos.foco_cardiometabolico,
      input.focoCardiometabolico,
      input.foco_cardiometabolico,
      envelope.focoCardiometabolico,
      envelope.foco_cardiometabolico
    ));
    if (focoCardiometabolico !== true) return;

    const cinturaCm = this.toNumber(this.pickFirstValue(
      dados.cinturaCm,
      dados.cintura_cm,
      dados.cintura,
      dadosBrutos.cinturaCm,
      dadosBrutos.cintura_cm,
      dadosBrutos.cintura,
      input.cinturaCm,
      input.cintura_cm,
      input.cintura,
      envelope.cinturaCm,
      envelope.cintura_cm,
      envelope.cintura
    ));

    if (!Number.isFinite(cinturaCm)) {
      throw new BadRequestException(
        'Perimetros com foco cardiometabolico ativo exigem circunferencia da cintura para finalizar.'
      );
    }
  }

  private assertComposicaoIntegradaFinalizationRequirements(payload: unknown) {
    const envelope = this.asRecord(payload);
    const dados = this.asRecord(envelope.dados);
    const dadosBrutos = this.asRecord(dados.dados_brutos);
    const input = this.asRecord(dados.input);
    const resultadosCalculados = this.asRecord(dados.resultados_calculados);
    const resultados = this.asRecord(envelope.resultados);
    const calculated = this.asRecord(resultados.calculated);

    const fonteOficial = this.toText(this.pickFirstValue(
      dados.fonte_oficial,
      dados.fonteOficial,
      dadosBrutos.selectedSourceId,
      input.selectedSourceId,
      envelope.fonte_oficial
    ));
    const percentualGorduraOficial = this.toNumber(this.pickFirstValue(
      dados.percentualGorduraOficial,
      dados.percentual_gordura_oficial,
      resultadosCalculados.percentualGorduraOficial,
      resultadosCalculados.percentual_gordura_oficial,
      calculated.percentualGorduraOficial,
      envelope.percentualGorduraOficial
    ));
    const massaMagraOficialKg = this.toNumber(this.pickFirstValue(
      dados.massaMagraOficialKg,
      dados.massa_magra_oficial_kg,
      resultadosCalculados.massaMagraOficialKg,
      resultadosCalculados.massa_magra_oficial_kg,
      calculated.massaMagraOficialKg,
      envelope.massaMagraOficialKg
    ));
    const tmbSelecionadaKcal = this.toNumber(this.pickFirstValue(
      dados.tmbSelecionadaKcal,
      dados.tmb_selecionada_kcal,
      resultadosCalculados.tmbSelecionadaKcal,
      resultadosCalculados.tmb_selecionada_kcal,
      calculated.tmbSelecionadaKcal,
      envelope.tmbSelecionadaKcal
    ));

    if (!fonteOficial || !Number.isFinite(percentualGorduraOficial) || !Number.isFinite(massaMagraOficialKg) || !Number.isFinite(tmbSelecionadaKcal)) {
      throw new BadRequestException(
        'Composicao integrada exige fonte oficial, percentual de gordura oficial, massa magra oficial e TMB selecionada para finalizar.'
      );
    }
  }

  private assertGetFinalizationRequirements(payload: unknown) {
    const envelope = this.asRecord(payload);
    const dados = this.asRecord(envelope.dados);
    const dadosBrutos = this.asRecord(dados.dados_brutos);
    const resultadosCalculados = this.asRecord(dados.resultados_calculados);
    const resultados = this.asRecord(envelope.resultados);
    const calculated = this.asRecord(resultados.calculated);

    const tmbBaseKcal = this.toNumber(this.pickFirstValue(
      dados.tmbBaseKcal,
      dados.tmb_base_kcal,
      dados.tmb_manual_kcal,
      dadosBrutos.manualTmbKcal,
      resultadosCalculados.tmbBaseKcal,
      resultadosCalculados.tmb_base_kcal,
      resultados.tmb_kcal,
      calculated.tmbBaseKcal,
      envelope.tmbBaseKcal
    ));
    const fatorAtividade = this.toNumber(this.pickFirstValue(
      dados.fatorAtividade,
      dados.fator_atividade,
      dados.fator_atividade_personalizado,
      dadosBrutos.customActivityFactor,
      resultadosCalculados.fatorAtividade,
      resultadosCalculados.fator_atividade,
      resultados.fator_atividade,
      calculated.fatorAtividade,
      envelope.fatorAtividade
    ));
    const getEstimadoKcal = this.toNumber(this.pickFirstValue(
      dados.getEstimadoKcal,
      dados.get_estimado_kcal,
      resultadosCalculados.getEstimadoKcal,
      resultadosCalculados.get_estimado_kcal,
      resultados.get_kcal,
      calculated.getEstimadoKcal,
      envelope.getEstimadoKcal
    ));

    if (!Number.isFinite(tmbBaseKcal) || (tmbBaseKcal as number) <= 0 || !Number.isFinite(fatorAtividade) || (fatorAtividade as number) <= 0 || !Number.isFinite(getEstimadoKcal) || (getEstimadoKcal as number) <= 0) {
      throw new BadRequestException(
        'GET exige TMB base, fator de atividade e GET estimado validos para finalizar.'
      );
    }
  }

  private resolveNovaCategoryEnergy(
    category: 'in_natura' | 'minimamente_processados' | 'processados' | 'ultraprocessados',
    sources: JsonObject[]
  ) {
    // A tela do recordatório 24h envia as chaves no singular (WI-013).
    const keys = category === 'in_natura' ? [category] : [category, category.replace(/s$/, '')];
    for (const source of sources) {
      for (const key of keys) {
        const raw = source[key];
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          const nested = this.asRecord(raw);
          const nestedEnergy = this.toNumber(this.pickFirstValue(nested.energiaTotal, nested.kcal, nested.value));
          if (Number.isFinite(nestedEnergy)) return nestedEnergy;
        }
        const numeric = this.toNumber(raw);
        if (Number.isFinite(numeric)) return numeric;
      }
    }
    return null;
  }

  private assertAlimentarFinalizationRequirements(payload: unknown) {
    const envelope = this.asRecord(payload);
    const dados = this.asRecord(envelope.dados);
    const input = this.asRecord(dados.input);

    const categorySources = [
      this.asRecord(dados.categorias),
      this.asRecord(dados.kcalPorGrupo),
      this.asRecord(input.categorias),
      this.asRecord(input.kcalPorGrupo),
      this.asRecord(envelope.categorias),
      this.asRecord(envelope.kcalPorGrupo)
    ];

    const inNatura = this.resolveNovaCategoryEnergy('in_natura', categorySources)
      ?? this.toNumber(this.pickFirstValue(dados.kcalInNatura, input.kcalInNatura, envelope.kcalInNatura))
      ?? 0;
    const minimamente = this.resolveNovaCategoryEnergy('minimamente_processados', categorySources)
      ?? this.toNumber(this.pickFirstValue(
        dados.kcalMinimamenteProcessados,
        input.kcalMinimamenteProcessados,
        envelope.kcalMinimamenteProcessados
      ))
      ?? 0;
    const processados = this.resolveNovaCategoryEnergy('processados', categorySources)
      ?? this.toNumber(this.pickFirstValue(dados.kcalProcessados, input.kcalProcessados, envelope.kcalProcessados))
      ?? 0;
    const ultraprocessados = this.resolveNovaCategoryEnergy('ultraprocessados', categorySources)
      ?? this.toNumber(this.pickFirstValue(
        dados.kcalUltraprocessados,
        input.kcalUltraprocessados,
        envelope.kcalUltraprocessados
      ))
      ?? 0;

    const somaKcal = Number(inNatura || 0) + Number(minimamente || 0) + Number(processados || 0) + Number(ultraprocessados || 0);
    if (!Number.isFinite(somaKcal) || somaKcal <= 0) {
      throw new BadRequestException(
        'Avaliacao alimentar exige informar kcal consumidas nos grupos NOVA para finalizar.'
      );
    }
  }

  private assertHidratacaoFinalizationRequirements(payload: unknown) {
    const envelope = this.asRecord(payload);
    const dados = this.asRecord(envelope.dados);
    const input = this.asRecord(dados.input);
    const resultados = this.asRecord(envelope.resultados);
    const calculated = this.asRecord(resultados.calculated);

    const pesoAntes = this.toNumber(this.pickFirstValue(
      dados.pesoAntesExercicio,
      input.pesoAntesExercicio,
      envelope.pesoAntesExercicio
    ));
    const pesoApos = this.toNumber(this.pickFirstValue(
      dados.pesoAposExercicio,
      input.pesoAposExercicio,
      envelope.pesoAposExercicio
    ));
    const duracao = this.toNumber(this.pickFirstValue(
      dados.duracaoExercicioMin,
      input.duracaoExercicioMin,
      envelope.duracaoExercicioMin
    ));
    let perdaPesoPercentual = this.toNumber(this.pickFirstValue(
      dados.perdaPesoPercentual,
      resultados.perdaPesoPercentual,
      calculated.perdaPesoPercentual,
      envelope.perdaPesoPercentual
    ));
    if (!Number.isFinite(perdaPesoPercentual) && Number.isFinite(pesoAntes) && Number.isFinite(pesoApos) && (pesoAntes as number) > 0) {
      perdaPesoPercentual = (((pesoAntes as number) - (pesoApos as number)) / (pesoAntes as number)) * 100;
    }

    if (!Number.isFinite(pesoAntes) || !Number.isFinite(pesoApos) || !Number.isFinite(duracao) || (duracao as number) <= 0 || !Number.isFinite(perdaPesoPercentual)) {
      throw new BadRequestException(
        'Hidratacao exige peso antes, peso apos e duracao de exercicio validos para finalizar.'
      );
    }
  }

  private assertFisioterapiaFinalizationRequirements(payload: unknown) {
    const envelope = this.asRecord(payload);
    const dados = this.asRecord(envelope.dados);
    const input = this.asRecord(dados.input);

    const queixaPrincipal = this.toText(this.pickFirstValue(
      dados.queixaPrincipal,
      input.queixaPrincipal,
      envelope.queixaPrincipal
    ));
    const intensidadeDor = this.toNumber(this.pickFirstValue(
      dados.intensidadeDor,
      input.intensidadeDor,
      envelope.intensidadeDor
    ));

    if (!queixaPrincipal || !Number.isFinite(intensidadeDor) || (intensidadeDor as number) < 0 || (intensidadeDor as number) > 10) {
      throw new BadRequestException(
        'Fisioterapia exige queixa principal e intensidade de dor (0-10) para finalizar.'
      );
    }
  }

  private assertPsicologiaFinalizationRequirements(payload: unknown) {
    const envelope = this.asRecord(payload);
    const dados = this.asRecord(envelope.dados);
    const input = this.asRecord(dados.input);

    const objetivo = this.toText(this.pickFirstValue(
      dados.objetivo,
      input.objetivo,
      envelope.objetivo
    ));
    const estresse = this.toNumber(this.pickFirstValue(
      dados.estresse,
      input.estresse,
      envelope.estresse
    ));

    if (!objetivo || !Number.isFinite(estresse) || (estresse as number) < 0 || (estresse as number) > 10) {
      throw new BadRequestException(
        'Psicologia exige objetivo e nivel de estresse (0-10) para finalizar.'
      );
    }
  }

  private assertTriagemRedsFinalizationRequirements(payload: unknown) {
    const envelope = this.asRecord(payload);
    const dados = this.asRecord(envelope.dados);
    const dadosBrutos = this.asRecord(dados.dados_brutos);
    const input = this.asRecord(dados.input);
    const resultados = this.asRecord(envelope.resultados);
    const calculated = this.asRecord(resultados.calculated);
    const output = this.asRecord(resultados.output);

    const disponibilidadeEnergetica = this.toNumber(this.pickFirstValue(
      dados.disponibilidadeEnergetica,
      dados.DE,
      input.disponibilidadeEnergetica,
      input.DE,
      resultados.disponibilidadeEnergetica,
      resultados.DE,
      calculated.disponibilidadeEnergetica,
      calculated.DE,
      envelope.disponibilidadeEnergetica,
      envelope.DE
    ));
    const scoreRastreio = this.toNumber(this.pickFirstValue(
      dados.scoreLeafQ,
      dados.scoreLeaQ13,
      input.scoreLeafQ,
      input.scoreLeaQ13,
      resultados.scoreLeafQ,
      resultados.scoreLeaQ13,
      calculated.scoreLeafQ,
      calculated.scoreLeaQ13,
      envelope.scoreLeafQ,
      envelope.scoreLeaQ13
    ));
    const classificacaoDE = this.toText(this.pickFirstValue(
      dados.classificacaoDE,
      resultados.classificacaoDE,
      calculated.classificacaoDE,
      output.classificacaoDE,
      envelope.classificacao
    ));
    const sexo = this.normalizeSexToken(this.pickFirstValue(
      dados.sexoBiologico,
      dados.sexo,
      dadosBrutos.sexoBiologico,
      dadosBrutos.sexo,
      input.sexoBiologico,
      input.sexo,
      envelope.sexoBiologico,
      envelope.sexo
    ));

    const assertQuestionnaireComplete = (source: unknown, keys: string[], message: string) => {
      const sourceRecord = this.asRecord(source);
      const missing = keys.filter((key, index) => {
        const value = Array.isArray(source) ? source[index] : sourceRecord[key];
        return this.toBooleanChoice(value) === null;
      });
      if (missing.length > 0) {
        throw new BadRequestException(message);
      }
    };

    if (!Number.isFinite(disponibilidadeEnergetica) || !Number.isFinite(scoreRastreio) || !classificacaoDE) {
      throw new BadRequestException(
        'Triagem de Disponibilidade Energetica exige disponibilidade energetica, score de rastreio e classificacao para finalizar.'
      );
    }
    if (!sexo) {
      throw new BadRequestException('Triagem de Disponibilidade Energetica exige sexo biologico para validar o questionario de rastreio.');
    }
    if (sexo === 'female') {
      const leafAnswers = this.pickFirstValue(
        dados.leafQRespostas,
        dados.leaf_q_respostas,
        input.leafQRespostas,
        resultados.leafQRespostas,
        envelope.leafQRespostas
      );
      assertQuestionnaireComplete(
        leafAnswers,
        Array.from({ length: 12 }, (_, index) => `leaf_q${index + 1}`),
        'Triagem de Disponibilidade Energetica exige LEAF-Q completo para finalizar.'
      );
    }
    if (sexo === 'male') {
      const leaAnswers = this.pickFirstValue(
        dados.leaQ13Respostas,
        dados.lea_q13_respostas,
        input.leaQ13Respostas,
        resultados.leaQ13Respostas,
        envelope.leaQ13Respostas
      );
      assertQuestionnaireComplete(
        leaAnswers,
        Array.from({ length: 13 }, (_, index) => `lea_q${index + 1}`),
        'Triagem de Disponibilidade Energetica exige LEA-Q13 completo para finalizar.'
      );
    }
  }

  private assertCargaTreinoFinalizationRequirements(payload: unknown) {
    const envelope = this.asRecord(payload);
    const dados = this.asRecord(envelope.dados);
    const dadosBrutos = this.asRecord(dados.dados_brutos);
    const input = this.asRecord(dados.input);
    const resultados = this.asRecord(envelope.resultados);
    const calculated = this.asRecord(resultados.calculated);

    const faseAtual = this.toText(this.pickFirstValue(
      dados.faseAtual,
      dados.fase_atual,
      dadosBrutos.faseAtual,
      input.faseAtual,
      envelope.faseAtual
    ));
    const sessoesSemana = [
      ...this.asArray(dados.sessoesSemana),
      ...this.asArray(dados.sessoes_semana),
      ...this.asArray(dadosBrutos.sessoesSemana),
      ...this.asArray(input.sessoesSemana),
      ...this.asArray(input.sessoes_semana),
      ...this.asArray(envelope.sessoesSemana)
    ];
    const hasValidSession = sessoesSemana.some((item) => {
      const row = this.asRecord(item);
      const tipo = this.toText(this.pickFirstValue(row.tipo, row.modalidade, row.atividade));
      const duracaoMin = this.toNumber(this.pickFirstValue(row.duracaoMin, row.duracao_min, row.duracao));
      const pse = this.toNumber(this.pickFirstValue(row.pse, row.PSE, row.rpe));
      return Boolean(tipo)
        && Number.isFinite(duracaoMin)
        && (duracaoMin as number) > 0
        && Number.isFinite(pse)
        && (pse as number) >= 0
        && (pse as number) <= 10;
    });
    const cargaSemanaAtual = this.toNumber(this.pickFirstValue(
      dados.cargaSemanaAtual,
      dados.carga_semana_atual,
      input.cargaSemanaAtual,
      resultados.cargaSemanaAtual,
      calculated.cargaSemanaAtual,
      envelope.cargaSemanaAtual
    ));

    if (!faseAtual || !hasValidSession || !Number.isFinite(cargaSemanaAtual) || (cargaSemanaAtual as number) <= 0) {
      throw new BadRequestException(
        'Carga de treino exige fase atual, ao menos uma sessao valida e carga semanal calculada para finalizar.'
      );
    }
  }

  private assertAvaliacaoClinicaFinalizationRequirements(
    payload: unknown,
    context?: { pacienteRole?: string }
  ): void {
    const envelope = this.asRecord(payload);
    const dados = this.asRecord(envelope.dados);
    const input = this.asRecord(dados.input);
    const resultados = this.asRecord(envelope.resultados);
    const calculated = this.asRecord(resultados.calculated);

    const pressaoSistolica = this.toNumber(this.pickFirstValue(
      dados.pressaoSistolica, input.pressaoSistolica,
      calculated.pressaoSistolica, envelope.pressaoSistolica
    ));
    const pressaoDiastolica = this.toNumber(this.pickFirstValue(
      dados.pressaoDiastolica, input.pressaoDiastolica,
      calculated.pressaoDiastolica, envelope.pressaoDiastolica
    ));
    const frequenciaCardiaca = this.toNumber(this.pickFirstValue(
      dados.frequenciaCardiaca, input.frequenciaCardiaca,
      calculated.frequenciaCardiaca, envelope.frequenciaCardiaca
    ));
    const frequenciaRespiratoria = this.toNumber(this.pickFirstValue(
      dados.frequenciaRespiratoria,
      dados.frequencia_respiratoria,
      dados.fr,
      input.frequenciaRespiratoria,
      input.frequencia_respiratoria,
      input.fr,
      calculated.frequenciaRespiratoria,
      calculated.frequencia_respiratoria,
      calculated.fr,
      resultados.frequenciaRespiratoria,
      resultados.frequencia_respiratoria,
      resultados.fr,
      envelope.frequenciaRespiratoria,
      envelope.frequencia_respiratoria,
      envelope.fr
    ));
    const temperaturaCorporal = this.toNumber(this.pickFirstValue(
      dados.temperaturaCorporal,
      dados.temperatura_corporal,
      dados.temperatura,
      dados.temp,
      input.temperaturaCorporal,
      input.temperatura_corporal,
      input.temperatura,
      input.temp,
      calculated.temperaturaCorporal,
      calculated.temperatura_corporal,
      calculated.temperatura,
      calculated.temp,
      resultados.temperaturaCorporal,
      resultados.temperatura_corporal,
      resultados.temperatura,
      resultados.temp,
      envelope.temperaturaCorporal,
      envelope.temperatura_corporal,
      envelope.temperatura,
      envelope.temp
    ));

    const assertRange = (value: number | null, min: number, max: number, message: string) => {
      if (!Number.isFinite(value) || (value as number) < min || (value as number) > max) {
        throw new UnprocessableEntityException(message);
      }
    };

    assertRange(pressaoSistolica, 70, 250, 'PA sistolica deve estar entre 70 e 250 mmHg.');
    assertRange(pressaoDiastolica, 40, 150, 'PA diastolica deve estar entre 40 e 150 mmHg.');
    assertRange(frequenciaCardiaca, 30, 220, 'Frequencia cardiaca deve estar entre 30 e 220 bpm.');
    assertRange(frequenciaRespiratoria, 8, 40, 'Frequencia respiratoria deve estar entre 8 e 40 irpm.');
    assertRange(temperaturaCorporal, 34, 42, 'Temperatura corporal deve estar entre 34 e 42 °C.');

    const roleToken = normalizeRole(this.toText(this.pickFirstValue(
      context?.pacienteRole,
      dados.pacienteRole,
      dados.rolePaciente,
      input.pacienteRole,
      input.rolePaciente,
      envelope.pacienteRole,
      envelope.rolePaciente,
      this.asRecord(dados.meta).pacienteRole,
      this.asRecord(envelope.meta).pacienteRole
    )));
    const isPacienteAtleta = roleToken === 'atleta';
    const shouldFlagBradicardiaFisiologica = isPacienteAtleta && (frequenciaCardiaca as number) < 50;

    const resultadosCalculados = this.asRecord(dados.resultados_calculados);
    delete resultadosCalculados.bradicardiaFisiologica;
    delete resultados.bradicardiaFisiologica;

    if (shouldFlagBradicardiaFisiologica) {
      resultadosCalculados.bradicardiaFisiologica = true;
      resultados.bradicardiaFisiologica = true;
    }

    dados.resultados_calculados = resultadosCalculados;
    envelope.resultados = resultados;
  }

  private assertFinalizationRequirements(
    tipo: string,
    payload: unknown,
    context?: { pacienteRole?: string }
  ) {
    const normalizedType = normalizeAvaliacaoTipo(tipo);
    if (!normalizedType) return;

    if (normalizedType === 'avaliacao_socioeconomica') {
      this.assertEbiaFinalizationRequirements(payload);
      return;
    }
    if (normalizedType === 'dobras_cutaneas') {
      this.assertSkinfoldFinalizationRequirements(payload);
      return;
    }
    if (normalizedType === 'exames_laboratoriais') {
      this.assertLaboratoryFinalizationRequirements(payload);
      return;
    }
    if (normalizedType === 'perimetros') {
      this.assertPerimetrosFinalizationRequirements(payload);
      return;
    }
    if (normalizedType === 'composicao_corporal_integrada') {
      this.assertComposicaoIntegradaFinalizationRequirements(payload);
      return;
    }
    if (normalizedType === 'gasto_energetico_total') {
      this.assertGetFinalizationRequirements(payload);
      return;
    }
    if (normalizedType === 'alimentar') {
      this.assertAlimentarFinalizationRequirements(payload);
      return;
    }
    if (normalizedType === 'hidratacao') {
      this.assertHidratacaoFinalizationRequirements(payload);
      return;
    }
    if (normalizedType === 'fisioterapia') {
      this.assertFisioterapiaFinalizationRequirements(payload);
      return;
    }
    if (normalizedType === 'psicologia') {
      this.assertPsicologiaFinalizationRequirements(payload);
      return;
    }
    if (normalizedType === 'triagem_reds') {
      this.assertTriagemRedsFinalizationRequirements(payload);
      return;
    }
    if (normalizedType === 'carga_treino') {
      this.assertCargaTreinoFinalizationRequirements(payload);
      return;
    }
    if (normalizedType === 'avaliacao_clinica') {
      this.assertAvaliacaoClinicaFinalizationRequirements(payload, context);
      return;
    }
  }

  private normalizeCompletudeKey(value: string) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s_-]+/g, '');
  }

  private isFilledCompletudeValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'boolean') return true;
    if (value instanceof Date) return !Number.isNaN(value.getTime());
    if (Array.isArray(value)) {
      if (!value.length) return false;
      return value.some((item) => this.isFilledCompletudeValue(item));
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      if (!entries.length) return false;
      return entries.some(([, item]) => this.isFilledCompletudeValue(item));
    }
    return String(value).trim() !== '';
  }

  private collectCompletudeValues(
    source: unknown,
    index: Map<string, unknown>,
    visited = new WeakSet<object>()
  ) {
    if (source === null || source === undefined) return;
    if (typeof source !== 'object') return;
    if (Array.isArray(source)) {
      source.forEach((item) => this.collectCompletudeValues(item, index, visited));
      return;
    }

    const obj = source as Record<string, unknown>;
    if (visited.has(obj)) return;
    visited.add(obj);

    for (const [key, value] of Object.entries(obj)) {
      const normalizedKey = this.normalizeCompletudeKey(key);
      if (normalizedKey) {
        const previous = index.get(normalizedKey);
        if (!index.has(normalizedKey) || !this.isFilledCompletudeValue(previous)) {
          index.set(normalizedKey, value);
        }
      }
      this.collectCompletudeValues(value, index, visited);
    }
  }

  private computeCompletude(tipo: string, payload: unknown): number {
    const entry = AVALIACAO_REGISTRY_BY_TIPO[normalizeAvaliacaoTipo(tipo)];
    if (!entry?.requiredFields?.length) return 100;

    const envelope = this.asRecord(payload);
    const dadosRecord = this.asRecord(envelope.dados);
    const resultadosRecord = this.asRecord(envelope.resultados);
    const valueIndex = new Map<string, unknown>();

    this.collectCompletudeValues(envelope, valueIndex);
    this.collectCompletudeValues(dadosRecord, valueIndex);
    this.collectCompletudeValues(dadosRecord.dados_brutos, valueIndex);
    this.collectCompletudeValues(dadosRecord.input, valueIndex);
    this.collectCompletudeValues(dadosRecord.resultados_calculados, valueIndex);
    this.collectCompletudeValues(dadosRecord.classificacoes, valueIndex);
    this.collectCompletudeValues(resultadosRecord, valueIndex);
    this.collectCompletudeValues(resultadosRecord.calculated, valueIndex);
    this.collectCompletudeValues(resultadosRecord.output, valueIndex);
    this.collectCompletudeValues(envelope.registros, valueIndex);

    let filled = 0;
    for (const field of entry.requiredFields) {
      const normalizedField = this.normalizeCompletudeKey(field);
      const aliases = COMPLETUDE_FIELD_ALIASES[normalizedField] || [];
      const keys = [normalizedField, ...aliases];
      const found = keys.some((key) => this.isFilledCompletudeValue(valueIndex.get(key)));
      if (found) {
        filled += 1;
      }
    }
    return Math.round((filled / entry.requiredFields.length) * 100);
  }

  private getEbiaSelfFormRelease(paciente: Paciente) {
    const confirmation = this.asRecord(paciente.confirmacaoAtleta);
    const release = this.asRecord(confirmation.ebiaSelfForm);
    return {
      enabled: release.enabled === true,
      releaseId: String(release.releaseId || '').trim() || null,
      releasedAt: String(release.releasedAt || '').trim() || null,
      releasedById: String(release.releasedById || '').trim() || null,
      releasedByName: String(release.releasedByName || '').trim() || null
    };
  }

  private async consumeEbiaSelfFormRelease(paciente: Paciente, avaliacaoId: string) {
    const confirmation = this.asRecord(paciente.confirmacaoAtleta);
    const release = this.asRecord(confirmation.ebiaSelfForm);

    const nextConfirmation: JsonObject = {
      ...confirmation,
      ebiaSelfForm: {
        ...release,
        enabled: false,
        consumedAt: new Date().toISOString(),
        consumedByAvaliacaoId: avaliacaoId
      }
    };

    await this.pacientesRepo.save({
      id: paciente.id,
      confirmacaoAtleta: nextConfirmation
    });
  }

  private async resolveAlunoOrThrow(alunoId?: string | null) {
    if (!alunoId) return null;
    const aluno = await this.usersRepo.findOne({ where: { id: alunoId } });
    if (!aluno) {
      throw new NotFoundException('Aluno informado nao encontrado.');
    }
    if (!isStudentMemberRole(aluno.role)) {
      throw new ForbiddenException('Avaliacao deve ser vinculada a aluno, presidente ou vice.');
    }
    if ((aluno.status || '').toLowerCase() !== 'ativo') {
      throw new ForbiddenException('Aluno informado precisa estar ativo.');
    }
    return aluno;
  }

  async findAll(user: AuthenticatedUser, filtros: FiltrosAvaliacao) {
    const qb = this.repo.createQueryBuilder('avaliacao')
      .orderBy('avaliacao.createdAt', 'DESC')
      .addOrderBy('avaliacao.id', 'DESC');

    const role = normalizeRole(user.role);
    const hasScopeFilters = Boolean(filtros.pacienteId || filtros.projetoId);
    if (hasGlobalAccess(role) && !hasScopeFilters && !Number.isFinite(filtros.limit)) {
      throw new BadRequestException('Consultas administrativas sem filtros devem informar limit.');
    }
    if (role === 'atleta' && !hasScopeFilters) {
      throw new BadRequestException('Perfil atleta deve informar pacienteId ou projetoId para listar avaliacoes.');
    }
    if (!hasGlobalAccess(role) && role !== 'coord_atendimento') {
      if (isStudentMemberRole(role)) {
        if (filtros.pacienteId) {
          this.applyAccessiblePacienteScope(qb, user);
        } else {
          qb.andWhere('avaliacao.alunoId = :userId', { userId: user.id });
          this.applyAccessiblePacienteScope(qb, user);
        }
      } else if (role === 'atleta') {
        const atletaPacientesSubQuery = this.pacientesRepo
          .createQueryBuilder('paciente')
          .select('paciente.id')
          .where('paciente.atletaUserId = :userId', { userId: user.id });
        qb.andWhere(
          `avaliacao.pacienteId IN (${atletaPacientesSubQuery.getQuery()})`
        );
        qb.setParameters(atletaPacientesSubQuery.getParameters());
      } else if (hasTeamScopedAccess(role)) {
        this.applyAccessiblePacienteScope(qb, user);
      } else {
        qb.andWhere('1 = 0');
      }
    }

    if (filtros.pacienteId) {
      qb.andWhere('avaliacao.pacienteId = :pacienteId', { pacienteId: filtros.pacienteId });
    }
    if (filtros.projetoId) {
      qb.andWhere('avaliacao.projetoId = :projetoId', { projetoId: filtros.projetoId });
    }
    if (filtros.tipo) {
      qb.andWhere('avaliacao.tipo = :tipo', { tipo: filtros.tipo });
    }
    if (Number.isFinite(filtros.limit)) {
      qb.take(filtros.limit!);
    }
    if (Number.isFinite(filtros.offset)) {
      qb.skip(filtros.offset!);
    }

    if (role === 'atleta') {
      const startedAt = Date.now();
      const result = await qb.getMany();
      this.recordQuery('avaliacoes.find_all.query', startedAt, 'GET /avaliacoes');
      return result.map((row) => this.mapAthleteEvaluationRow(row));
    }

    if (this.shouldUseListProjection(filtros)) {
      qb.select([
        'avaliacao.id AS "id"',
        'avaliacao.sessaoId AS "sessaoId"',
        'avaliacao.tipo AS "tipo"',
        'avaliacao.pacienteId AS "pacienteId"',
        'avaliacao.projetoId AS "projetoId"',
        'avaliacao.projetoNome AS "projetoNome"',
        'avaliacao.alunoId AS "alunoId"',
        'avaliacao.status AS "status"',
        'avaliacao.data AS "data"',
        'avaliacao.schemaVersion AS "schemaVersion"',
        'avaliacao.formulaId AS "formulaId"',
        'avaliacao.formulaVersion AS "formulaVersion"',
        'avaliacao.sourceSystem AS "sourceSystem"',
        'avaliacao.sourceRef AS "sourceRef"',
        'avaliacao.measuredAt AS "measuredAt"',
        'avaliacao.classificacao AS "classificacao"',
        'avaliacao.classificacaoLabel AS "classificacaoLabel"',
        'avaliacao.pontuacaoEBIA AS "pontuacaoEBIA"',
        'avaliacao.createdAt AS "createdAt"',
        'avaliacao.updatedAt AS "updatedAt"'
      ]);

      const startedAt = Date.now();
      const rows = await qb.getRawMany<Record<string, unknown>>();
      this.recordQuery('avaliacoes.find_all.query', startedAt, 'GET /avaliacoes');
      return rows.map((row) => this.mapListRow(row));
    }

    const startedAt = Date.now();
    const result = await qb.getMany();
    this.recordQuery('avaliacoes.find_all.query', startedAt, 'GET /avaliacoes');
    return result;
  }

  private findByIdRaw(id: string) {
    return this.repo.findOne({ where: { id }, withDeleted: false });
  }

  private async assertNoSessaoTipoConflict(params: {
    sessaoId?: string | null;
    tipo?: string | null;
    ignoreId?: string | null;
  }) {
    const sessaoId = String(params.sessaoId || '').trim();
    const tipo = normalizeAvaliacaoTipo(String(params.tipo || ''));
    if (!sessaoId || !tipo) return;

    const existing = await this.repo.findOne({
      where: { sessaoId, tipo },
      select: ['id'],
      withDeleted: false
    });
    if (existing?.id && existing.id !== params.ignoreId) {
      throw new ConflictException('Ja existe uma avaliacao do tipo informado nesta sessao. Edite a avaliacao existente.');
    }
  }

  async findById(id: string, user: AuthenticatedUser) {
    const avaliacao = await this.findByIdRaw(id);
    if (!avaliacao) return null;

    const role = normalizeRole(user.role);
    if (hasGlobalAccess(role)) {
      await auditManagementAccess(this.auditoria, user, 'avaliacoes', avaliacao.id, { acao: 'leitura_avaliacao', pacienteId: avaliacao.pacienteId });
      return avaliacao;
    }
    const paciente = await this.pacientesRepo.findOne({ where: { id: avaliacao.pacienteId } });
    if (!(await this.canAccessViaPaciente(user, paciente))) {
      return null;
    }
    if (role === 'coord_atendimento') {
      await auditManagementAccess(this.auditoria, user, 'avaliacoes', avaliacao.id, { acao: 'leitura_avaliacao', pacienteId: avaliacao.pacienteId });
    }
    return avaliacao;
  }

  async create(dto: CriarAvaliacaoDto, user: AuthenticatedUser) {
    const role = normalizeRole(user.role);
    const payload: CriarAvaliacaoDto = { ...dto };
    if (!hasGlobalAccess(role)) {
      if (role === 'atleta') {
        // Fluxo de atleta e validado apos carregar o paciente.
      } else if (!isStudentMemberRole(role)) {
        throw new ForbiddenException('Sem permissao para criar avaliacao.');
      } else {
        if (payload.alunoId && payload.alunoId !== user.id) {
          throw new ForbiddenException('Sem permissao para criar avaliacao para outro aluno.');
        }
        payload.alunoId = user.id;
      }
    }

    const paciente = await this.pacientesRepo.findOne({ where: { id: payload.pacienteId } });
    if (!paciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }
    if (!hasGlobalAccess(role) && !(await this.canAccessViaPaciente(user, paciente))) {
      throw new ForbiddenException('Sem permissao para avaliar este paciente.');
    }
    if (isStudentMemberRole(role)) {
      this.assertCaseAreaEditAccess(user, paciente, payload.tipo);
    }
    if (role !== 'atleta') {
      if (!this.canUseEvaluationAuthor(user, paciente, payload.alunoId)) {
        throw new ForbiddenException('Sem permissao para registrar avaliacao com este aluno autor.');
      }
      payload.alunoId = payload.alunoId || paciente.alunoResponsavelId;
    }
    if (paciente.projetoId) {
      if (payload.projetoId && payload.projetoId !== paciente.projetoId) {
        throw new ForbiddenException('Avaliacao deve manter projeto vinculado ao paciente.');
      }
      payload.projetoId = payload.projetoId || paciente.projetoId;
      payload.projetoNome = paciente.projetoNome || '';
    }
    let athleteReleaseMeta: {
      releaseId: string | null;
      releasedAt: string | null;
      releasedById: string | null;
      releasedByName: string | null;
    } | null = null;
    let athleteUsesReleaseControlledForm = false;
    if (role === 'atleta') {
      const athleteType = normalizeAvaliacaoTipo(String(payload.tipo || ''));
      if (!ATHLETE_ALLOWED_CREATE_TYPES.has(athleteType)) {
        throw new ForbiddenException('Formulario nao liberado para preenchimento pelo atleta.');
      }
      if (!this.asRecord(paciente.confirmacaoAtleta).completed) {
        throw new BadRequestException('Complete o cadastro inicial antes de enviar formularios.');
      }
      if (!paciente.alunoResponsavelId) {
        throw new BadRequestException('Paciente sem aluno responsavel vinculado para revisar o formulario.');
      }
      payload.alunoId = paciente.alunoResponsavelId;
      payload.data = payload.data || this.todayDateIso();

      if (ATHLETE_RELEASE_CONTROLLED_TYPES.has(athleteType)) {
        const release = this.getEbiaSelfFormRelease(paciente);
        if (!release.enabled) {
          throw new ForbiddenException('Formulario EBIA ainda nao foi liberado para este atleta.');
        }
        payload.status = 'finalizada';
        athleteUsesReleaseControlledForm = true;
        athleteReleaseMeta = {
          releaseId: release.releaseId,
          releasedAt: release.releasedAt,
          releasedById: release.releasedById,
          releasedByName: release.releasedByName
        };
        payload.meta = {
          ...(this.asRecord(payload.meta)),
          origemPreenchimento: 'atleta',
          ebiaSelfForm: {
            releaseId: release.releaseId,
            releasedAt: release.releasedAt,
            releasedById: release.releasedById,
            releasedByName: release.releasedByName
          }
        };
      } else {
        payload.status = 'rascunho';
        payload.meta = {
          ...(this.asRecord(payload.meta)),
          origemPreenchimento: 'atleta',
          atletaSelfReport: true,
          aguardandoRevisao: true,
          submittedAt: new Date().toISOString(),
          submittedById: user.id,
          submittedByName: user.name || ''
        };
      }
    }
    await this.resolveAlunoOrThrow(payload.alunoId);
    const normalizedStatus = this.normalizeStatus(payload.status);
    if (normalizedStatus === 'finalizada' && !payload.data) {
      payload.data = this.todayDateIso();
    }

    const normalizedPayload = normalizeAvaliacaoPayload(payload);
    const normalizedFormula = this.resolveFormulaDefaults(
      normalizedPayload.tipo || payload.tipo,
      normalizedPayload.formulaId,
      normalizedPayload.formulaVersion
    );
    const sessao = await this.resolveOrCreateSessao({
      sessaoId: normalizedPayload.sessaoId,
      paciente,
      user,
      projetoId: normalizedPayload.projetoId || payload.projetoId || paciente.projetoId,
      dataReferencia: normalizedPayload.data || payload.data || this.todayDateIso()
    });

    const computedCompletude = this.computeCompletude(
      normalizedPayload.tipo || payload.tipo,
      normalizedPayload
    );
    if (normalizedStatus === 'finalizada') {
      this.assertFinalizationRequirements(
        normalizedPayload.tipo || payload.tipo,
        normalizedPayload,
        { pacienteRole: paciente.atletaUserId ? 'atleta' : undefined }
      );
    }
    if (role !== 'atleta' && normalizedStatus === 'finalizada' && computedCompletude < MIN_COMPLETUDE_TO_FINALIZE) {
      throw new BadRequestException(
        `Avaliacao precisa de completude minima de ${MIN_COMPLETUDE_TO_FINALIZE}% para finalizar. Atual: ${computedCompletude}%.`
      );
    }
    const enrichedMeta: JsonObject = {
      ...this.asRecord(normalizedPayload.meta),
      completude: computedCompletude,
      completudeComputedAt: new Date().toISOString()
    };

    await this.assertNoSessaoTipoConflict({
      sessaoId: sessao.id,
      tipo: normalizedPayload.tipo || payload.tipo
    });

    const avaliacao = this.repo.create({
      ...normalizedPayload,
      meta: enrichedMeta,
      sessaoId: sessao.id,
      status: normalizedStatus,
      schemaVersion: normalizedPayload.schemaVersion || 1,
      formulaId: normalizedFormula.formulaId,
      formulaVersion: normalizedFormula.formulaVersion,
      measuredAt: this.normalizeMeasuredAt(normalizedPayload.measuredAt),
      autoSave: normalizedPayload.autoSave ?? false
    });
    let saved: Avaliacao;
    try {
      saved = await this.repo.save(avaliacao);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        throw new ConflictException('Ja existe uma avaliacao do tipo informado nesta sessao. Edite a avaliacao existente.');
      }
      throw error;
    }
    await this.syncSessaoStatus(saved.sessaoId);
    if (role === 'atleta' && athleteUsesReleaseControlledForm) {
      await this.consumeEbiaSelfFormRelease(paciente, saved.id);
      await this.recordAthleteEbiaSubmissionAudit({
        user,
        avaliacao: saved,
        releaseId: athleteReleaseMeta?.releaseId,
        releasedAt: athleteReleaseMeta?.releasedAt,
        releasedById: athleteReleaseMeta?.releasedById,
        releasedByName: athleteReleaseMeta?.releasedByName
      });
    }
    this.realtime.emit('avaliacoes.created', saved);
    void this.clinicalAlerts?.dispatch(saved, {
      nome: paciente.nome,
      alunoResponsavelId: paciente.alunoResponsavelId,
      professorSupervisorNome: paciente.professorSupervisorNome,
    });
    return saved;
  }

  async marcarComoRevisado(id: string, user: AuthenticatedUser): Promise<Avaliacao> {
    const avaliacao = await this.findByIdRaw(id);
    if (!avaliacao) {
      throw new NotFoundException('Avaliacao nao encontrada.');
    }

    const role = normalizeRole(user.role);
    if (!REVIEW_ALLOWED_ROLES.has(role)) {
      throw new ForbiddenException('Sem permissao para revisar avaliacao.');
    }

    const paciente = await this.pacientesRepo.findOne({ where: { id: avaliacao.pacienteId } });
    if (!(await this.canAccessViaPaciente(user, paciente))) {
      throw new NotFoundException('Avaliacao nao encontrada.');
    }

    const reviewedAt = new Date().toISOString();
    const merged = this.repo.merge(avaliacao, {
      status: 'finalizada',
      revisadoEm: reviewedAt,
      revisadoPorId: user.id,
      revisadoPorNome: user.name || user.email || null,
      meta: {
        ...this.asRecord(avaliacao.meta),
        aguardandoRevisao: false
      }
    });

    const saved = await this.repo.save(merged);
    await this.syncSessaoStatus(saved.sessaoId);
    this.realtime.emit('avaliacoes.updated', saved);
    return saved;
  }

  /*
   * UPD-17: devolve a avaliacao ao aluno com orientacao. Somente quem tem
   * vinculo de supervisao (supervisor, supervisao_aluno) ou gestao devolve;
   * o aluno responsavel nao devolve o proprio item e o atleta nao devolve nada
   * (ambos resolvem para um ClinicalLink fora da lista permitida abaixo).
   */
  async devolver(id: string, observacao: string, user: AuthenticatedUser): Promise<Avaliacao> {
    const texto = String(observacao || '').trim();
    if (texto.length < 5 || texto.length > 1000) {
      throw new BadRequestException('Observacao deve ter entre 5 e 1000 caracteres.');
    }

    const avaliacao = await this.findByIdRaw(id);
    if (!avaliacao) {
      throw new NotFoundException('Avaliacao nao encontrada.');
    }

    const paciente = await this.pacientesRepo.findOne({ where: { id: avaliacao.pacienteId } });
    const link = await resolveClinicalLink(user, paciente, studentLookupFromRepository(this.usersRepo));
    if (!link) {
      throw new NotFoundException('Avaliacao nao encontrada.');
    }
    if (link !== 'gestao' && link !== 'supervisor' && link !== 'supervisao_aluno') {
      throw new ForbiddenException('Apenas supervisor, profissional vinculado ou gestao podem devolver esta avaliacao.');
    }

    const priorMeta = this.asRecord(avaliacao.meta);
    if (!priorMeta.aguardandoRevisao) {
      throw new BadRequestException('Esta avaliacao nao esta aguardando revisao.');
    }

    this.assertStatusTransition(avaliacao.status as AvaliacaoStatus, 'rascunho');

    const now = new Date().toISOString();
    // Autoria e data fixadas pelo servidor; o payload nao informa quem devolveu.
    const devolucao = {
      porId: user.id,
      porNome: user.name || user.email || null,
      em: now,
      observacao: texto
    };
    const historico = this.asArray(priorMeta.historicoDevolucoes);

    const nextMeta: JsonObject = {
      ...priorMeta,
      aguardandoRevisao: false,
      devolucao,
      historicoDevolucoes: [...historico, devolucao]
    };
    // A pergunta do aluno (meta.observacaoEnvio, UPD-17) foi respondida pela
    // devolucao; nao deve sobreviver ao proximo envio como se fosse nova.
    delete nextMeta.observacaoEnvio;

    const merged = this.repo.merge(avaliacao, {
      status: 'rascunho',
      meta: nextMeta
    });

    const saved = await this.repo.save(merged);
    await this.syncSessaoStatus(saved.sessaoId);
    this.realtime.emit('avaliacoes.updated', saved);

    if (saved.alunoId) {
      try {
        await this.notificacoes?.createForUsers([saved.alunoId], {
          titulo: 'Avaliacao devolvida',
          mensagem: 'Uma avaliacao foi devolvida com orientacao; abra o prontuario.',
          tipo: 'alerta_clinico'
        });
      } catch {
        // Best-effort — nao interrompe a devolucao.
      }
    }

    return saved;
  }

  /*
   * UPD-17: envio opcional do aluno (ou equipe/gestao do caso) para a fila
   * do supervisor. Ate aqui aguardandoRevisao so era marcado num unico lugar
   * (create(), autorrelato do atleta) — avaliacao preenchida pelo aluno no
   * atendimento nunca chegava ao supervisor. Este metodo grava exatamente
   * os mesmos campos que aquele fluxo ja grava (submittedAt/submittedById/
   * submittedByName), para findFilaRevisao (nao alterado neste item) nao
   * precisar saber de onde veio o envio.
   *
   * O status volta para 'rascunho' porque aguardandoRevisao so ocorre nesse
   * status em todo o resto do modulo (ver comentario de findFilaRevisao
   * logo abaixo) — enviar uma avaliacao ja finalizada reabre para revisao em
   * vez de deixar a flag marcada num estado que a fila nunca lista.
   */
  async enviarParaRevisao(id: string, observacao: string | undefined, user: AuthenticatedUser): Promise<Avaliacao> {
    const avaliacao = await this.findByIdRaw(id);
    if (!avaliacao) {
      throw new NotFoundException('Avaliacao nao encontrada.');
    }

    const paciente = await this.pacientesRepo.findOne({ where: { id: avaliacao.pacienteId } });
    const link = await resolveClinicalLink(user, paciente, studentLookupFromRepository(this.usersRepo));
    if (!link) {
      throw new NotFoundException('Avaliacao nao encontrada.');
    }
    if (link !== 'gestao' && link !== 'responsavel' && link !== 'equipe') {
      throw new ForbiddenException('Apenas o responsavel pelo caso, a equipe ou a gestao podem enviar esta avaliacao para revisao.');
    }

    const priorMeta = this.asRecord(avaliacao.meta);
    if (priorMeta.aguardandoRevisao) {
      throw new BadRequestException('Esta avaliacao ja esta aguardando revisao.');
    }

    const texto = String(observacao ?? '').trim();
    if (texto.length > 1000) {
      throw new BadRequestException('Observacao deve ter no maximo 1000 caracteres.');
    }

    const nextMeta: JsonObject = {
      ...priorMeta,
      aguardandoRevisao: true,
      submittedAt: new Date().toISOString(),
      submittedById: user.id,
      submittedByName: user.name || ''
    };
    if (texto) {
      nextMeta.observacaoEnvio = texto;
    } else {
      delete nextMeta.observacaoEnvio;
    }

    // Pedir revisao nao desqualifica o dado: avaliacao finalizada continua
    // finalizada enquanto espera. Rebaixar para rascunho a tiraria da
    // elegibilidade clinica — o GET finalizado alimenta as metas do plano
    // (plano-alimentar.service.ts, resolveUltimaAvaliacaoElegivel) e a
    // prescricao travaria por falta de GET so porque alguem pediu conferencia.
    // Em devolver() o rebaixamento permanece: ali o supervisor apontou defeito.
    const merged = this.repo.merge(avaliacao, { meta: nextMeta });

    const saved = await this.repo.save(merged);
    await this.syncSessaoStatus(saved.sessaoId);
    this.realtime.emit('avaliacoes.updated', saved);

    const supervisorId = paciente?.professorSupervisorId;
    if (supervisorId && supervisorId !== user.id) {
      try {
        await this.notificacoes?.createForUsers([supervisorId], {
          titulo: 'Avaliacao aguardando revisao',
          mensagem: 'Uma avaliacao foi enviada para revisao; abra a fila para conferir.',
          tipo: 'alerta_clinico'
        });
      } catch {
        // Best-effort — nao interrompe o envio.
      }
    }

    return saved;
  }

  /*
   * UPD-17: fila de revisao do responsavel. Nao ha SQL clinico novo: o
   * candidato (status 'rascunho', unico status em que aguardandoRevisao
   * ocorre) vem de uma coluna indexada, e o acesso de cada item e decidido
   * chamando resolveClinicalLink() por paciente — o mesmo contrato usado em
   * findById/devolver, so que aplicado item a item em vez de como fragmento
   * SQL. Papeis sem vinculo de supervisao (aluno, atleta) recebem fila
   * vazia, nunca um erro.
   */
  async findFilaRevisao(user: AuthenticatedUser, filtros: { limit?: number; offset?: number }) {
    const role = normalizeRole(user.role);
    if (!hasGlobalAccess(role) && !hasTeamScopedAccess(role)) {
      return [];
    }

    const limit = Math.max(1, Math.min(100, Math.floor(filtros.limit ?? 25)));
    const offset = Math.max(0, Math.floor(filtros.offset ?? 0));

    // O que enfileira e `meta.aguardandoRevisao`, nao o status: uma avaliacao
    // finalizada tambem pode aguardar conferencia do supervisor.
    const candidatas = await this.repo.find({ where: { deletedAt: IsNull() } });

    const elegiveis: Array<{ avaliacao: Avaliacao; paciente: Paciente }> = [];
    for (const avaliacao of candidatas) {
      if (!this.asRecord(avaliacao.meta).aguardandoRevisao) continue;
      const paciente = await this.pacientesRepo.findOne({ where: { id: avaliacao.pacienteId } });
      if (!paciente) continue;
      if (!hasGlobalAccess(role)) {
        const link = await resolveClinicalLink(user, paciente, studentLookupFromRepository(this.usersRepo));
        if (!link) continue;
      }
      elegiveis.push({ avaliacao, paciente });
    }

    const alunoIds = [...new Set(elegiveis.map((item) => item.avaliacao.alunoId).filter((id): id is string => Boolean(id)))];
    const alunos = alunoIds.length ? await this.usersRepo.find({ where: { id: In(alunoIds) } }) : [];
    const alunoNomeById = new Map(alunos.map((aluno) => [aluno.id, aluno.name]));

    const itens = elegiveis.map(({ avaliacao, paciente }) => {
      const meta = this.asRecord(avaliacao.meta);
      const submittedAt = typeof meta.submittedAt === 'string' ? meta.submittedAt : null;
      const enfileiradoEm = submittedAt || avaliacao.updatedAt;
      return {
        tipo: 'avaliacao' as const,
        id: avaliacao.id,
        pacienteId: avaliacao.pacienteId,
        pacienteNome: paciente.nome || null,
        tipoInstrumento: avaliacao.tipo,
        enviadoPorId: avaliacao.alunoId || null,
        enviadoPorNome: (avaliacao.alunoId && alunoNomeById.get(avaliacao.alunoId)) || null,
        enfileiradoEm,
        // /avaliacao/:id resolve o parametro como PACIENTE
        // (AvaliacaoCompleta.jsx: `const id = pacienteId || params.id`).
        rota: `/avaliacao/${avaliacao.pacienteId}`
      };
    });

    itens.sort((a, b) => new Date(a.enfileiradoEm).getTime() - new Date(b.enfileiradoEm).getTime());
    return itens.slice(offset, offset + limit);
  }

  async update(id: string, dto: AtualizarAvaliacaoDto, user: AuthenticatedUser) {
    const avaliacao = await this.findByIdRaw(id);
    if (!avaliacao) {
      throw new NotFoundException('Avaliacao nao encontrada.');
    }

    const role = normalizeRole(user.role);
    const hasAccess = await this.findById(id, user);
    if (!hasAccess) {
      throw new NotFoundException('Avaliacao nao encontrada.');
    }

    if (!hasGlobalAccess(role)) {
      if (dto.alunoId && dto.alunoId !== avaliacao.alunoId) {
        throw new ForbiddenException('Sem permissao para alterar ownership da avaliacao.');
      }
      if (dto.pacienteId && dto.pacienteId !== avaliacao.pacienteId) {
        throw new ForbiddenException('Sem permissao para trocar paciente da avaliacao.');
      }
    }

    const nextPacienteId = dto.pacienteId || avaliacao.pacienteId;
    const nextPaciente = await this.pacientesRepo.findOne({ where: { id: nextPacienteId } });
    if (!nextPaciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }

    const nextTipo = dto.tipo || avaliacao.tipo;
    if (isStudentMemberRole(role)) {
      this.assertCaseAreaEditAccess(user, nextPaciente, nextTipo);
    }

    const nextAlunoId = dto.alunoId || avaliacao.alunoId || nextPaciente.alunoResponsavelId;
    if (dto.alunoId && !this.canUseEvaluationAuthor(user, nextPaciente, dto.alunoId)) {
      throw new ForbiddenException('Sem permissao para registrar avaliacao com este aluno autor.');
    }
    await this.resolveAlunoOrThrow(nextAlunoId);

    const nextProjetoId = dto.projetoId || avaliacao.projetoId || nextPaciente.projetoId;
    if (nextPaciente.projetoId && nextProjetoId && nextPaciente.projetoId !== nextProjetoId) {
      throw new ForbiddenException('Avaliacao deve manter consistencia com o projeto vinculado ao paciente.');
    }

    const sourceStatus = this.normalizeStatus(avaliacao.status);
    const targetStatus = this.normalizeStatus(dto.status, sourceStatus);
    this.assertStatusTransition(sourceStatus, targetStatus);
    const nextData = dto.data || avaliacao.data || (targetStatus === 'finalizada' ? this.todayDateIso() : undefined);

    const normalizedDto = normalizeAvaliacaoPayload(dto);
    const normalizedFormula = this.resolveFormulaDefaults(
      normalizedDto.tipo || avaliacao.tipo,
      normalizedDto.formulaId || avaliacao.formulaId,
      normalizedDto.formulaVersion || avaliacao.formulaVersion
    );
    let nextSessaoId = normalizedDto.sessaoId || avaliacao.sessaoId || null;
    if (normalizedDto.sessaoId) {
      const sessao = await this.resolveSessaoExistenteOrThrow(normalizedDto.sessaoId, nextPaciente.id);
      nextSessaoId = sessao.id;
    }
    if (!nextSessaoId) {
      const fallbackSessao = await this.resolveOrCreateSessao({
        paciente: nextPaciente,
        user,
        projetoId: nextProjetoId,
        dataReferencia: nextData || this.todayDateIso()
      });
      nextSessaoId = fallbackSessao.id;
    }

    const previousSessaoId = avaliacao.sessaoId || null;
    const nextDados = normalizedDto.dados !== undefined ? normalizedDto.dados : avaliacao.dados;
    const payloadParaCompletude: JsonObject = {
      ...this.asRecord(avaliacao),
      ...this.asRecord(normalizedDto),
      dados: nextDados,
      resultados: normalizedDto.resultados !== undefined ? normalizedDto.resultados : avaliacao.resultados,
      registros: normalizedDto.registros !== undefined ? normalizedDto.registros : avaliacao.registros,
      pontuacaoEBIA: normalizedDto.pontuacaoEBIA !== undefined ? normalizedDto.pontuacaoEBIA : avaliacao.pontuacaoEBIA,
      classificacao: normalizedDto.classificacao !== undefined ? normalizedDto.classificacao : avaliacao.classificacao,
      classificacaoLabel: normalizedDto.classificacaoLabel !== undefined ? normalizedDto.classificacaoLabel : avaliacao.classificacaoLabel,
      totalDiario: normalizedDto.totalDiario !== undefined ? normalizedDto.totalDiario : avaliacao.totalDiario,
      percentuais: normalizedDto.percentuais !== undefined ? normalizedDto.percentuais : avaliacao.percentuais
    };
    const computedCompletude = this.computeCompletude(
      normalizedDto.tipo || avaliacao.tipo,
      payloadParaCompletude
    );
    if (targetStatus === 'finalizada') {
      this.assertFinalizationRequirements(
        normalizedDto.tipo || avaliacao.tipo,
        payloadParaCompletude,
        { pacienteRole: nextPaciente.atletaUserId ? 'atleta' : undefined }
      );
    }
    if (targetStatus === 'finalizada' && computedCompletude < MIN_COMPLETUDE_TO_FINALIZE) {
      throw new BadRequestException(
        `Avaliacao precisa de completude minima de ${MIN_COMPLETUDE_TO_FINALIZE}% para finalizar. Atual: ${computedCompletude}%.`
      );
    }
    const enrichedMeta: JsonObject = {
      ...this.asRecord(avaliacao.meta),
      ...this.asRecord(normalizedDto.meta),
      completude: computedCompletude,
      completudeComputedAt: new Date().toISOString()
    };

    await this.assertNoSessaoTipoConflict({
      sessaoId: nextSessaoId,
      tipo: normalizedDto.tipo || avaliacao.tipo,
      ignoreId: avaliacao.id
    });

    const merged = this.repo.merge(avaliacao, {
      ...normalizedDto,
      meta: enrichedMeta,
      sessaoId: nextSessaoId || undefined,
      alunoId: nextAlunoId || undefined,
      projetoId: nextPaciente.projetoId || nextProjetoId || undefined,
      projetoNome: nextPaciente.projetoId ? (nextPaciente.projetoNome || '') : undefined,
      status: targetStatus,
      schemaVersion: normalizedDto.schemaVersion || avaliacao.schemaVersion || 1,
      formulaId: normalizedFormula.formulaId,
      formulaVersion: normalizedFormula.formulaVersion,
      measuredAt: this.normalizeMeasuredAt(normalizedDto.measuredAt) || avaliacao.measuredAt || undefined,
      data: nextData || undefined
    });
    let saved: Avaliacao;
    try {
      saved = await this.repo.save(merged);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        throw new ConflictException('Ja existe uma avaliacao do tipo informado nesta sessao. Edite a avaliacao existente.');
      }
      throw error;
    }
    await this.syncSessaoStatus(saved.sessaoId);
    if (previousSessaoId && previousSessaoId !== saved.sessaoId) {
      await this.syncSessaoStatus(previousSessaoId);
    }
    this.realtime.emit('avaliacoes.updated', saved);
    void this.clinicalAlerts?.dispatch(saved, {
      nome: nextPaciente.nome,
      alunoResponsavelId: nextPaciente.alunoResponsavelId,
      professorSupervisorNome: nextPaciente.professorSupervisorNome,
    });
    return saved;
  }

  async findPendencias(pacienteId: string, user: AuthenticatedUser) {
    const paciente = await this.pacientesRepo.findOne({ where: { id: pacienteId } });
    if (!paciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }
    const role = normalizeRole(user.role);
    if (!hasGlobalAccess(role) && !(await this.canAccessViaPaciente(user, paciente))) {
      throw new ForbiddenException('Sem permissao para visualizar pendencias deste paciente.');
    }

    const startedAt = Date.now();
    const avaliacoes = await this.repo.find({
      where: { pacienteId },
      select: ['id', 'tipo', 'status', 'meta'],
      withDeleted: false
    });
    this.recordQuery('avaliacoes.find_pendencias.query', startedAt, 'GET /avaliacoes/pendencias');

    type Pendencia = {
      id: string;
      tipo: string;
      severidade: string;
      itemTipo: string;
      mensagem: string;
      acao: { label: string };
      // Qual avaliacao a pendencia aponta — sem isso a tela sabe que ha algo a
      // fazer e nao sabe onde.
      avaliacaoId?: string;
    };
    const pendencias: Pendencia[] = [];

    const avaliacoesPorTipo = avaliacoes.reduce<Record<string, Avaliacao[]>>((acc, avaliacao) => {
      const tipo = normalizeAvaliacaoTipo(avaliacao.tipo);
      if (!tipo) return acc;
      if (!acc[tipo]) acc[tipo] = [];
      acc[tipo].push(avaliacao);
      return acc;
    }, {});
    const tiposFinalizados = new Set(
      avaliacoes
        .filter((a) => this.normalizeStatus(a.status) === 'finalizada')
        .map((a) => normalizeAvaliacaoTipo(a.tipo))
    );

    for (const obrigatorio of PENDENCIAS_OBRIGATORIAS) {
      if (!tiposFinalizados.has(obrigatorio)) {
        const entry = AVALIACAO_REGISTRY_BY_TIPO[obrigatorio];
        const draft = (avaliacoesPorTipo[obrigatorio] || [])
          .find((a) => this.normalizeStatus(a.status) !== 'finalizada');
        if (draft) {
          const meta = this.asRecord(draft.meta);
          const completude = Number(meta.completude);
          const label = Number.isFinite(completude) ? ` (${Math.round(completude)}%)` : '';

          // Preenchida por inteiro e ainda em rascunho: nada no fluxo a move
          // para finalizada quando ela chega a 100%. Pedir "Completar" o que
          // ja esta completo era o texto literal que chegava na tela.
          if (Number.isFinite(completude) && completude >= 100) {
            pendencias.push({
              id: `finalizar-${draft.id || obrigatorio}`,
              tipo: 'avaliacao_pronta',
              severidade: 'pronta',
              itemTipo: obrigatorio,
              avaliacaoId: draft.id,
              mensagem: `${entry?.label || obrigatorio} pronta para finalizar`,
              acao: { label: 'Finalizar' }
            });
            continue;
          }

          pendencias.push({
            id: `incomplete-required-${draft.id || obrigatorio}`,
            tipo: 'avaliacao_incompleta',
            severidade: 'alta',
            itemTipo: obrigatorio,
            avaliacaoId: draft.id,
            mensagem: `${entry?.label || obrigatorio} incompleta${label}`,
            acao: { label: 'Completar' }
          });
          continue;
        }
        pendencias.push({
          id: `missing-${obrigatorio}`,
          tipo: 'avaliacao_ausente',
          severidade: 'alta',
          itemTipo: obrigatorio,
          mensagem: `${entry?.label || obrigatorio} nao registrada`,
          acao: { label: 'Iniciar' }
        });
      }
    }

    for (const avaliacao of avaliacoes) {
      const normalizedTipo = normalizeAvaliacaoTipo(avaliacao.tipo);
      if (PENDENCIAS_OBRIGATORIAS_SET.has(normalizedTipo)) continue;
      if (this.normalizeStatus(avaliacao.status) === 'finalizada') continue;
      const meta = this.asRecord(avaliacao.meta);
      const completude = Number(meta.completude);
      const entry = AVALIACAO_REGISTRY_BY_TIPO[normalizedTipo];

      // Espelho do caso das obrigatorias: com 100% e ainda aberta, ela nao
      // gerava pendencia nenhuma e sumia — nem cobrada, nem fechada.
      if (Number.isFinite(completude) && completude >= 100) {
        pendencias.push({
          id: `finalizar-${avaliacao.id}`,
          tipo: 'avaliacao_pronta',
          severidade: 'pronta',
          itemTipo: avaliacao.tipo,
          avaliacaoId: avaliacao.id,
          mensagem: `${entry?.label || avaliacao.tipo} pronta para finalizar`,
          acao: { label: 'Finalizar' }
        });
        continue;
      }

      if (!Number.isFinite(completude) || completude < 80) {
        const label = Number.isFinite(completude) ? ` (${Math.round(completude)}%)` : '';
        pendencias.push({
          id: `incomplete-${avaliacao.id}`,
          tipo: 'avaliacao_incompleta',
          severidade: 'media',
          itemTipo: avaliacao.tipo,
          avaliacaoId: avaliacao.id,
          mensagem: `${entry?.label || avaliacao.tipo} incompleta${label}`,
          acao: { label: 'Completar' }
        });
      }
    }

    // Pronto para fechar vem primeiro: e o item mais barato de resolver e o
    // que mais distorce a contagem enquanto fica no meio da lista.
    const peso: Record<string, number> = { pronta: 0, alta: 1, media: 2 };
    pendencias.sort((a, b) => (peso[a.severidade] ?? 3) - (peso[b.severidade] ?? 3));

    return pendencias;
  }

  async remove(id: string) {
    const avaliacao = await this.findByIdRaw(id);
    if (!avaliacao) {
      throw new NotFoundException('Avaliacao nao encontrada.');
    }
    await this.repo.softDelete(id);
    await this.syncSessaoStatus(avaliacao.sessaoId);
    this.realtime.emit('avaliacoes.deleted', { id, pacienteId: avaliacao.pacienteId });
    return { success: true };
  }
}
