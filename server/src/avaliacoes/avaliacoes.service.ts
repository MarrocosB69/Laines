import { Injectable, NotFoundException, Optional, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Avaliacao } from './avaliacao.entity';
import { AvaliacaoSessao } from './avaliacao-sessao.entity';
import { CriarAvaliacaoDto } from './dto/criar-avaliacao.dto';
import { AtualizarAvaliacaoDto } from './dto/atualizar-avaliacao.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ObservabilityService } from '../observability/observability.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Paciente } from '../pacientes/paciente.entity';
import { User } from '../users/user.entity';
import {
  AuthenticatedUser,
  hasGlobalAccess,
  hasTeamScopedAccess,
  isStudentMemberRole,
  normalizeRole
} from '../auth/access-control';
import { normalizeAvaliacaoPayload } from './avaliacao-normalizer';
import { AVALIACAO_REGISTRY_BY_TIPO, normalizeAvaliacaoTipo } from './evaluation-registry';

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
const MIN_COMPLETUDE_TO_FINALIZE = 80;
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
    @Optional() private readonly auditoria?: AuditoriaService
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
      }
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

  private shouldUseListProjection(filtros: FiltrosAvaliacao) {
    return Number.isFinite(filtros.limit) && !filtros.pacienteId;
  }

  private canAccessViaPaciente(user: AuthenticatedUser, paciente: Paciente | null) {
    if (!paciente) return false;
    const role = normalizeRole(user.role);
    if (hasGlobalAccess(role)) return true;

    if (isStudentMemberRole(role)) {
      return paciente.alunoResponsavelId === user.id
        || (paciente.equipeTecnicaIds || []).includes(user.id);
    }

    if (hasTeamScopedAccess(role)) {
      return paciente.professorSupervisorId === user.id
        || paciente.alunoResponsavelId === user.id
        || (paciente.equipeTecnicaIds || []).includes(user.id);
    }

    if (role === 'atleta') {
      return paciente.atletaUserId === user.id;
    }

    return false;
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
    for (const source of sources) {
      const raw = source[category];
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const nested = this.asRecord(raw);
        const nestedEnergy = this.toNumber(this.pickFirstValue(nested.energiaTotal, nested.kcal, nested.value));
        if (Number.isFinite(nestedEnergy)) return nestedEnergy;
      }
      const numeric = this.toNumber(raw);
      if (Number.isFinite(numeric)) return numeric;
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

  private assertFinalizationRequirements(tipo: string, payload: unknown) {
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
    if (!hasGlobalAccess(role)) {
      if (isStudentMemberRole(role)) {
        qb.andWhere('avaliacao.alunoId = :userId', { userId: user.id });
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
        const equipePacientesSubQuery = this.pacientesRepo
          .createQueryBuilder('paciente')
          .select('paciente.id')
          .where(
            '(paciente.professorSupervisorId = :userId OR paciente.alunoResponsavelId = :userId OR :userId = ANY(COALESCE(paciente.equipeTecnicaIds, ARRAY[]::uuid[])))',
            { userId: user.id }
          );
        qb.andWhere(
          `avaliacao.pacienteId IN (${equipePacientesSubQuery.getQuery()})`
        );
        qb.setParameters(equipePacientesSubQuery.getParameters());
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
    return this.repo.findOne({ where: { id } });
  }

  async findById(id: string, user: AuthenticatedUser) {
    const avaliacao = await this.findByIdRaw(id);
    if (!avaliacao) return null;

    const role = normalizeRole(user.role);
    if (hasGlobalAccess(role)) return avaliacao;
    if (isStudentMemberRole(role) && avaliacao.alunoId === user.id) return avaliacao;

    const paciente = await this.pacientesRepo.findOne({ where: { id: avaliacao.pacienteId } });
    if (!this.canAccessViaPaciente(user, paciente)) {
      return null;
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
    if (!hasGlobalAccess(role) && !this.canAccessViaPaciente(user, paciente)) {
      throw new ForbiddenException('Sem permissao para avaliar este paciente.');
    }
    if (paciente.alunoResponsavelId) {
      if (payload.alunoId && payload.alunoId !== paciente.alunoResponsavelId) {
        throw new ForbiddenException('Avaliacao deve usar o aluno responsavel vinculado ao paciente.');
      }
      payload.alunoId = payload.alunoId || paciente.alunoResponsavelId;
    }
    if (paciente.projetoId) {
      if (payload.projetoId && payload.projetoId !== paciente.projetoId) {
        throw new ForbiddenException('Avaliacao deve manter projeto vinculado ao paciente.');
      }
      payload.projetoId = payload.projetoId || paciente.projetoId;
      payload.projetoNome = payload.projetoNome || paciente.projetoNome || '';
    }
    let athleteReleaseMeta: {
      releaseId: string | null;
      releasedAt: string | null;
      releasedById: string | null;
      releasedByName: string | null;
    } | null = null;
    if (role === 'atleta') {
      if (String(payload.tipo || '').toLowerCase().trim() !== 'avaliacao_socioeconomica') {
        throw new ForbiddenException('Atleta pode preencher apenas o formulario EBIA liberado pela equipe.');
      }
      const release = this.getEbiaSelfFormRelease(paciente);
      if (!release.enabled) {
        throw new ForbiddenException('Formulario EBIA ainda nao foi liberado para este atleta.');
      }
      if (!paciente.alunoResponsavelId) {
        throw new BadRequestException('Paciente sem aluno responsavel vinculado para registrar EBIA.');
      }
      payload.alunoId = paciente.alunoResponsavelId;
      payload.status = 'finalizada';
      payload.data = payload.data || this.todayDateIso();
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
        normalizedPayload
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
    if (role === 'atleta') {
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
    return saved;
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
      if (isStudentMemberRole(role) && avaliacao.alunoId && avaliacao.alunoId !== user.id) {
        throw new ForbiddenException('Sem permissao para editar avaliacao de outro aluno.');
      }
    }

    const nextPacienteId = dto.pacienteId || avaliacao.pacienteId;
    const nextPaciente = await this.pacientesRepo.findOne({ where: { id: nextPacienteId } });
    if (!nextPaciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }

    const nextAlunoId = dto.alunoId || avaliacao.alunoId || nextPaciente.alunoResponsavelId;
    if (nextPaciente.alunoResponsavelId && nextAlunoId && nextPaciente.alunoResponsavelId !== nextAlunoId) {
      throw new ForbiddenException('Avaliacao deve manter consistencia com o aluno vinculado ao paciente.');
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
        payloadParaCompletude
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

    const merged = this.repo.merge(avaliacao, {
      ...normalizedDto,
      meta: enrichedMeta,
      sessaoId: nextSessaoId || undefined,
      alunoId: nextAlunoId || undefined,
      projetoId: nextPaciente.projetoId || nextProjetoId || undefined,
      projetoNome: nextPaciente.projetoNome || normalizedDto.projetoNome || avaliacao.projetoNome || undefined,
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
    return saved;
  }

  async findPendencias(pacienteId: string, user: AuthenticatedUser) {
    const paciente = await this.pacientesRepo.findOne({ where: { id: pacienteId } });
    if (!paciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }
    const role = normalizeRole(user.role);
    if (!hasGlobalAccess(role) && !this.canAccessViaPaciente(user, paciente)) {
      throw new ForbiddenException('Sem permissao para visualizar pendencias deste paciente.');
    }

    const startedAt = Date.now();
    const avaliacoes = await this.repo.find({
      where: { pacienteId },
      select: ['id', 'tipo', 'status', 'meta']
    });
    this.recordQuery('avaliacoes.find_pendencias.query', startedAt, 'GET /avaliacoes/pendencias');

    type Pendencia = {
      id: string;
      tipo: string;
      severidade: string;
      itemTipo: string;
      mensagem: string;
      acao: { label: string };
    };
    const pendencias: Pendencia[] = [];

    const tiposRealizados = new Set(
      avaliacoes.map((a) => String(a.tipo || '').trim().toLowerCase())
    );

    for (const obrigatorio of PENDENCIAS_OBRIGATORIAS) {
      if (!tiposRealizados.has(obrigatorio)) {
        const entry = AVALIACAO_REGISTRY_BY_TIPO[obrigatorio];
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
      const meta = this.asRecord(avaliacao.meta);
      const completude = Number(meta.completude);
      if (Number.isFinite(completude) && completude < 80) {
        const entry = AVALIACAO_REGISTRY_BY_TIPO[normalizeAvaliacaoTipo(avaliacao.tipo)];
        pendencias.push({
          id: `incomplete-${avaliacao.id}`,
          tipo: 'avaliacao_incompleta',
          severidade: 'media',
          itemTipo: avaliacao.tipo,
          mensagem: `${entry?.label || avaliacao.tipo} incompleta (${Math.round(completude)}%)`,
          acao: { label: 'Completar' }
        });
      }
    }

    return pendencias;
  }

  async remove(id: string) {
    const avaliacao = await this.findByIdRaw(id);
    if (!avaliacao) {
      throw new NotFoundException('Avaliacao nao encontrada.');
    }
    await this.repo.delete(id);
    await this.syncSessaoStatus(avaliacao.sessaoId);
    this.realtime.emit('avaliacoes.deleted', { id });
    return { success: true };
  }
}
