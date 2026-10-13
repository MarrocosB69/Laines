import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Avaliacao } from '../avaliacoes/avaliacao.entity';
import { AvaliacoesService } from '../avaliacoes/avaliacoes.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthenticatedUser } from '../auth/access-control';
import { assertClinicalLink, studentLookupFromRepository } from '../auth/authorization';
import { Paciente } from '../pacientes/paciente.entity';
import { User } from '../users/user.entity';
import { AvaliacaoImagemCaptura } from './avaliacao-imagem-captura.entity';
import { AvaliacaoImagemProcessamento } from './avaliacao-imagem-processamento.entity';
import { AvaliacaoImagemStorageService } from './avaliacao-imagem-storage.service';
import { CriarAvaliacaoImagemDto } from './dto/criar-avaliacao-imagem.dto';
import { ConcluirUploadDto } from './dto/concluir-upload.dto';

const CAPTURE_SPECS = [
  { vista: 'frontal', mimeType: 'image/jpeg', extension: 'jpg', maxBytes: 15 * 1024 * 1024 },
  { vista: 'lateral_direita', mimeType: 'image/jpeg', extension: 'jpg', maxBytes: 15 * 1024 * 1024 },
  { vista: 'posterior', mimeType: 'image/jpeg', extension: 'jpg', maxBytes: 15 * 1024 * 1024 },
  { vista: 'lateral_esquerda', mimeType: 'image/jpeg', extension: 'jpg', maxBytes: 15 * 1024 * 1024 },
  { vista: 'video_360', mimeType: 'video/webm', extension: 'webm', maxBytes: 100 * 1024 * 1024 },
] as const;
const IMAGE_EVALUATION_TYPE = 'composicao_corporal_imagem';

// A equacao adulta de Deurenberg foi estudada em participantes >18 ate 83 anos.
// Data invalida, ausente ou fora dessa faixa nao deve virar uma idade presumida.
function adultAgeAtCapture(birthDate: string | undefined, captureDate: string): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const parsed = new Date(`${birthDate}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== birthDate || birthDate > captureDate) return null;
  const age = Number(captureDate.slice(0, 4)) - Number(birthDate.slice(0, 4))
    - (captureDate.slice(5) < birthDate.slice(5) ? 1 : 0);
  return age >= 19 && age <= 83 ? age : null;
}

type ProcessorResponse = {
  jobId?: string;
  status?: string;
  progress?: number;
  algorithmVersion?: string;
  results?: Record<string, unknown>;
  error?: string;
};

@Injectable()
export class AvaliacaoImagemService implements OnModuleInit, OnModuleDestroy {
  private readonly processorBaseUrl = String(process.env.IMAGE_PROCESSOR_URL || '').replace(/\/+$/, '');
  private maintenanceTimer?: NodeJS.Timeout;
  private maintenanceRunning = false;
  private readonly startingJobs = new Set<string>();

  constructor(
    @InjectRepository(AvaliacaoImagemCaptura)
    private readonly captureRepo: Repository<AvaliacaoImagemCaptura>,
    @InjectRepository(AvaliacaoImagemProcessamento)
    private readonly processingRepo: Repository<AvaliacaoImagemProcessamento>,
    @InjectRepository(Avaliacao)
    private readonly evaluationRepo: Repository<Avaliacao>,
    private readonly avaliacoesService: AvaliacoesService,
    private readonly storage: AvaliacaoImagemStorageService,
    private readonly auditoria: AuditoriaService,
    @InjectRepository(Paciente)
    private readonly patientRepo: Repository<Paciente>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  onModuleInit() {
    this.maintenanceTimer = setInterval(() => void this.reconcileProcessingJobs(), 15_000);
    this.maintenanceTimer.unref?.();
    setTimeout(() => void this.reconcileProcessingJobs(), 2_000).unref?.();
  }

  onModuleDestroy() {
    if (this.maintenanceTimer) clearInterval(this.maintenanceTimer);
  }

  private actor(user?: AuthenticatedUser | null) {
    if (!user) return { id: 'system', name: 'Processador de imagens', role: 'system' };
    return { id: user.id, name: user.name || null, email: user.email || null, role: user.role || null };
  }

  private async authorizeEvaluation(
    id: string,
    user: AuthenticatedUser,
    requireEdit = false,
  ): Promise<Avaliacao> {
    const evaluation = requireEdit
      ? await this.avaliacoesService.findEditableById(id, user)
      : await this.avaliacoesService.findById(id, user);
    if (!evaluation || evaluation.tipo !== IMAGE_EVALUATION_TYPE) {
      throw new NotFoundException('Avaliacao por imagem nao encontrada.');
    }
    const patient = await this.patientRepo.findOne({ where: { id: evaluation.pacienteId } });
    await assertClinicalLink(user, patient, studentLookupFromRepository(this.userRepo));
    return evaluation;
  }

  private async requireUploadState(id: string) {
    const processing = await this.processingRepo.findOne({ where: { avaliacaoId: id } });
    if (!processing) throw new NotFoundException('Processamento nao encontrado.');
    if (processing.status !== 'aguardando_upload') {
      throw new ConflictException('As capturas desta avaliacao ja foram encaminhadas para processamento.');
    }
    return processing;
  }

  async uploadLocal(token: string, input: NodeJS.ReadableStream, user: AuthenticatedUser, contentLength?: number) {
    const objectKey = this.storage.localUploadObjectKey(token);
    const capture = await this.captureRepo.findOne({ where: { objectKey } });
    if (!capture) throw new NotFoundException('Captura nao encontrada.');
    await this.authorizeEvaluation(capture.avaliacaoId, user, true);
    await this.requireUploadState(capture.avaliacaoId);
    if (capture.uploadStatus === 'confirmado') throw new ConflictException('Captura ja confirmada.');
    return this.storage.saveLocalUpload(token, input, contentLength);
  }

  async create(dto: CriarAvaliacaoImagemDto, user: AuthenticatedUser) {
    if (String(user?.role || '').trim().toLowerCase() === 'coord_atendimento') {
      throw new ForbiddenException('Coordenacao de atendimento consulta avaliacoes, sem criar registros clinicos.');
    }
    if (dto.consentimentoTipo === 'responsavel_legal' && !dto.consentimentoResponsavelNome?.trim()) {
      throw new BadRequestException('Informe o nome do responsavel legal.');
    }
    const videoIsMp4 = String(dto.videoMimeType || '').toLowerCase().includes('mp4');
    const captureSpecs = CAPTURE_SPECS.map((spec) => (
      spec.vista === 'video_360'
        ? {
            ...spec,
            mimeType: videoIsMp4 ? 'video/mp4' : 'video/webm',
            extension: videoIsMp4 ? 'mp4' : 'webm',
          }
        : spec
    ));
    const measuredAt = new Date();
    const captureDate = measuredAt.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const patient = await this.patientRepo.findOne({ where: { id: dto.pacienteId } });
    const adultAge = adultAgeAtCapture(patient?.dataNascimento, captureDate);
    const evaluation = await this.avaliacoesService.create({
      tipo: IMAGE_EVALUATION_TYPE,
      pacienteId: dto.pacienteId,
      status: 'rascunho',
      schemaVersion: 1,
      formulaId: 'body3d_experimental_v1',
      formulaVersion: '0.1.0',
      sourceSystem: 'laines_imagem_web',
      measuredAt: measuredAt.toISOString(),
      dados: {
        peso: dto.peso,
        estatura: dto.estatura,
        sexo: dto.sexo,
        idade: adultAge,
        idadeOrigem: adultAge === null ? 'indisponivel' : 'paciente.dataNascimento',
        idadeReferenciaEm: captureDate,
        arucoMarkerSizeCm: dto.arucoMarkerSizeCm ?? null,
        consentimento: {
          aceito: true,
          aceitoEm: new Date().toISOString(),
          versao: 'imagem-corporal-v2',
          tipo: dto.consentimentoTipo,
          responsavelNome: dto.consentimentoResponsavelNome?.trim() || null,
          registradoPorId: user.id,
          registradoPorPapel: user.role || null,
        },
      },
      meta: {
        experimental: true,
        protocoloCaptura: 'quatro_vistas_rgb_v1',
        processamentoStatus: 'aguardando_upload',
      },
    }, user);

    const captures = captureSpecs.map((spec) => this.captureRepo.create({
      avaliacaoId: evaluation.id,
      vista: spec.vista,
      objectKey: `${randomUUID()}/${randomUUID()}-${spec.vista}.${spec.extension}`,
      mimeType: spec.mimeType,
      uploadStatus: 'pendente',
    }));
    try {
      await this.captureRepo.save(captures);
      await this.processingRepo.save(this.processingRepo.create({
        avaliacaoId: evaluation.id,
        status: 'aguardando_upload',
        progresso: 0,
      }));
    } catch (error) {
      await this.captureRepo.delete({ avaliacaoId: evaluation.id }).catch(() => undefined);
      await this.avaliacoesService.remove(evaluation.id).catch(() => undefined);
      throw error;
    }
    await this.auditoria.create({
      action: 'avaliacao_imagem.created',
      entity: 'avaliacao_imagem',
      entityId: evaluation.id,
      meta: { pacienteId: dto.pacienteId, protocolo: 'quatro_vistas_rgb_v1' },
      actor: this.actor(user),
    });
    return {
      id: evaluation.id,
      status: 'aguardando_upload',
      captures: captures.map((capture) => ({ id: capture.id, vista: capture.vista })),
    };
  }

  async createUploadUrls(id: string, user: AuthenticatedUser) {
    await this.authorizeEvaluation(id, user, true);
    await this.requireUploadState(id);
    const captures = await this.captureRepo.find({
      where: { avaliacaoId: id },
      order: { createdAt: 'ASC' },
    });
    const descriptors = await Promise.all(captures.filter((capture) => capture.uploadStatus !== 'confirmado').map(async (capture) => {
      const spec = CAPTURE_SPECS.find((item) => item.vista === capture.vista);
      return {
        captureId: capture.id,
        vista: capture.vista,
        ...(await this.storage.createUploadDescriptor(capture.objectKey, {
          mimeType: capture.mimeType,
          maxBytes: spec?.maxBytes,
        })),
      };
    }));
    await this.captureRepo.update(
      { avaliacaoId: id, uploadStatus: 'pendente' },
      { uploadStatus: 'url_gerada' },
    );
    await this.auditoria.create({
      action: 'avaliacao_imagem.upload_authorized', entity: 'avaliacao_imagem', entityId: id,
      meta: { captures: descriptors.length }, actor: this.actor(user),
    });
    return { avaliacaoId: id, uploads: descriptors };
  }

  async concludeUpload(
    id: string,
    captureId: string,
    dto: ConcluirUploadDto,
    user: AuthenticatedUser,
  ) {
    await this.authorizeEvaluation(id, user, true);
    const capture = await this.captureRepo.findOne({ where: { id: captureId, avaliacaoId: id } });
    if (!capture) throw new NotFoundException('Captura nao encontrada.');
    if (capture.uploadStatus === 'confirmado') {
      return { captureId, status: 'confirmado', size: Number(capture.tamanhoBytes) };
    }
    await this.requireUploadState(id);
    const inspection = await this.storage.inspectObject(capture.objectKey);
    const spec = CAPTURE_SPECS.find((item) => item.vista === capture.vista);
    if (inspection.size < 1 || inspection.size > (spec?.maxBytes || 15 * 1024 * 1024)) {
      throw new BadRequestException('Arquivo de captura vazio ou acima do limite permitido.');
    }
    if (dto.tamanhoBytes && dto.tamanhoBytes !== inspection.size) {
      throw new BadRequestException('Tamanho confirmado diverge do arquivo armazenado.');
    }
    if (inspection.detectedMimeType !== capture.mimeType) {
      throw new BadRequestException('Conteudo do arquivo nao corresponde ao formato esperado.');
    }
    if (dto.sha256 && dto.sha256.toLowerCase() !== inspection.sha256) {
      throw new BadRequestException('Integridade da captura nao confirmada.');
    }
    capture.uploadStatus = 'confirmado';
    capture.tamanhoBytes = String(inspection.size);
    capture.sha256 = inspection.sha256;
    capture.confirmadoEm = new Date();
    await this.captureRepo.save(capture);

    const pending = await this.captureRepo.count({
      where: { avaliacaoId: id, uploadStatus: 'confirmado' },
    });
    if (pending === CAPTURE_SPECS.length) {
      const claimed = await this.processingRepo.update(
        { avaliacaoId: id, status: 'aguardando_upload' },
        { status: 'iniciando', progresso: 5, erroCodigo: null, erroMensagem: null },
      );
      if (claimed.affected) {
        void this.startProcessingSafely(id, user).catch(() => undefined);
      }
    }
    return { captureId, status: 'confirmado', size: inspection.size };
  }

  private async fetchProcessor(path: string, init?: RequestInit): Promise<ProcessorResponse> {
    const processorToken = String(process.env.IMAGE_PROCESSOR_TOKEN || '').trim();
    if (!processorToken) {
      throw new Error('Token interno do processador nao configurado.');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.IMAGE_PROCESSOR_TIMEOUT_MS || 15000));
    try {
      const response = await fetch(`${this.processorBaseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${processorToken}`,
          ...(init?.headers || {}),
        },
      });
      if (!response.ok) throw new Error(`Processador respondeu HTTP ${response.status}.`);
      return await response.json() as ProcessorResponse;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async startProcessing(id: string, user?: AuthenticatedUser | null): Promise<void> {
    if (!this.processorBaseUrl) {
      await this.processingRepo.update({ avaliacaoId: id }, {
        status: 'aguardando_processador',
        progresso: 5,
        erroCodigo: 'PROCESSOR_NOT_CONFIGURED',
        erroMensagem: 'Servico 3D ainda nao configurado no servidor.',
      });
      return;
    }
    const evaluation = await this.evaluationRepo.findOne({ where: { id } });
    const captures = await this.captureRepo.find({ where: { avaliacaoId: id } });
    if (!evaluation || captures.length !== CAPTURE_SPECS.length || captures.some((capture) => capture.uploadStatus !== 'confirmado')) {
      throw new Error('Avaliacao ou conjunto de capturas incompleto.');
    }
    const sources = await Promise.all(captures.map(async (capture) => ({
      captureId: capture.id,
      vista: capture.vista,
      mimeType: capture.mimeType,
      source: await this.storage.createProcessorSource(capture.objectKey),
    })));
    const response = await this.fetchProcessor('/jobs', {
      method: 'POST',
      body: JSON.stringify({
        evaluationId: id,
        protocolVersion: 'quatro_vistas_rgb_v1',
        anthropometry: evaluation.dados || {},
        captures: sources,
      }),
    });
    if (response.results) {
      await this.completeProcessing(id, response.results, response.algorithmVersion, user);
      return;
    }
    if (!response.jobId) throw new Error('Processador nao retornou identificador do job.');
    await this.processingRepo.update({ avaliacaoId: id }, {
      status: 'em_processamento',
      processorJobId: response.jobId,
      algoritmoVersion: response.algorithmVersion || null,
      progresso: Number.isFinite(response.progress) ? Number(response.progress) : 10,
      erroCodigo: null,
      erroMensagem: null,
    });
  }

  private async startProcessingSafely(id: string, user?: AuthenticatedUser | null): Promise<void> {
    if (this.startingJobs.has(id)) return;
    this.startingJobs.add(id);
    try {
      await this.startProcessing(id, user);
    } catch (error) {
      await this.processingRepo.update({ avaliacaoId: id, status: 'iniciando' }, {
        status: 'falha', erroCodigo: 'PROCESSOR_START_FAILED',
        erroMensagem: 'Nao foi possivel iniciar o processamento. As capturas foram preservadas para nova tentativa.',
      });
      throw error;
    } finally {
      this.startingJobs.delete(id);
    }
  }

  private normalizeResults(raw: Record<string, unknown>, algorithmVersion?: string) {
    const numberFrom = (...keys: string[]) => {
      for (const key of keys) {
        if (!['number', 'string'].includes(typeof raw[key]) || String(raw[key]).trim() === '') continue;
        const value = Number(raw[key]);
        if (Number.isFinite(value)) return value;
      }
      return null;
    };
    const rawVersion = raw.algoritmoVersion || raw.algorithmVersion;
    const normalizedVersion = algorithmVersion
      || (typeof rawVersion === 'string' ? rawVersion : '')
      || 'nao_informada';
    return {
      ...raw,
      status: 'experimental',
      natureza: 'estimativa',
      validacaoClinica: 'nao_comprovada',
      origem: 'processador_imagem',
      algoritmoVersion: normalizedVersion,
      percGordura: numberFrom('percGordura', 'percentualGordura', 'bodyFatPercent'),
      massaGorda: numberFrom('massaGorda', 'fatMassKg'),
      massaMagra: numberFrom('massaMagra', 'fatFreeMassKg', 'leanMassKg'),
      rcq: numberFrom('rcq', 'waistHipRatio'),
    };
  }

  private assertValidResults(results: Record<string, unknown>) {
    const required = ['percGordura', 'massaGorda', 'massaMagra'] as const;
    for (const key of required) {
      const value = Number(results[key]);
      if (results[key] == null || !Number.isFinite(value) || value < 0) {
        throw new Error(`Processador retornou resultado invalido para ${key}.`);
      }
    }
    const fatPercent = Number(results.percGordura);
    if (fatPercent < 2 || fatPercent > 70) {
      throw new Error('Percentual de gordura fora da faixa plausivel.');
    }
  }

  private async completeProcessing(
    id: string,
    rawResults: Record<string, unknown>,
    algorithmVersion: string | undefined,
    user?: AuthenticatedUser | null,
  ): Promise<void> {
    const normalizedResults = this.normalizeResults(rawResults, algorithmVersion);
    this.assertValidResults(normalizedResults);
    const evaluation = await this.evaluationRepo.findOne({ where: { id } });
    if (!evaluation) throw new NotFoundException('Avaliacao por imagem nao encontrada.');
    const anthropometry = (evaluation?.dados || {}) as Record<string, unknown>;
    const results = {
      ...normalizedResults,
      peso: Number(anthropometry.peso),
      estatura: Number(anthropometry.estatura),
      sexo: anthropometry.sexo,
    };
    const processing = await this.processingRepo.findOne({ where: { avaliacaoId: id } });
    if (!processing) throw new NotFoundException('Processamento nao encontrado.');
    processing.status = 'concluida';
    processing.progresso = 100;
    processing.resultados = results;
    processing.algoritmoVersion = String(results.algoritmoVersion);
    processing.concluidoEm = new Date();
    processing.erroCodigo = null;
    processing.erroMensagem = null;
    if (evaluation) {
      evaluation.status = 'finalizada';
      evaluation.resultados = results;
      evaluation.formulaId = String(rawResults.metodo || rawResults.method || 'body3d_experimental_v1');
      evaluation.formulaVersion = String(results.algoritmoVersion).slice(0, 30);
      evaluation.meta = {
        ...(evaluation.meta || {}),
        experimental: true,
        processamentoStatus: 'concluida',
        processamentoConcluidoEm: new Date().toISOString(),
      };
    }
    await this.processingRepo.manager.transaction(async (manager) => {
      await manager.save(Avaliacao, evaluation);
      await manager.save(AvaliacaoImagemProcessamento, processing);
    });
    await this.auditoria.create({
      action: 'avaliacao_imagem.processed',
      entity: 'avaliacao_imagem',
      entityId: id,
      meta: { algorithmVersion: results.algoritmoVersion, experimental: true },
      actor: this.actor(user),
    });
  }

  private async refreshFromProcessor(
    processing: AvaliacaoImagemProcessamento,
    user?: AuthenticatedUser | null,
  ): Promise<AvaliacaoImagemProcessamento> {
    if (processing.status !== 'em_processamento' || !processing.processorJobId || !this.processorBaseUrl) {
      return processing;
    }
    let response: ProcessorResponse;
    try {
      response = await this.fetchProcessor(`/jobs/${encodeURIComponent(processing.processorJobId)}`);
    } catch (error) {
      throw new BadGatewayException(error instanceof Error ? error.message : 'Processador 3D indisponivel.');
    }
    const status = String(response.status || '').toLowerCase();
    if (['concluida', 'completed', 'complete', 'done'].includes(status)) {
      try {
        if (!response.results) throw new Error('Resultado ausente.');
        this.assertValidResults(this.normalizeResults(response.results, response.algorithmVersion));
      } catch {
        await this.processingRepo.update({ id: processing.id, status: 'em_processamento' }, {
          status: 'falha', erroCodigo: 'PROCESSOR_RESULTS_INVALID',
          erroMensagem: 'O processador concluiu sem uma estimativa valida. As capturas foram preservadas.',
        });
        return (await this.processingRepo.findOne({ where: { id: processing.id } })) || processing;
      }
      await this.completeProcessing(
        processing.avaliacaoId, response.results!,
        response.algorithmVersion || processing.algoritmoVersion || undefined, user,
      );
    } else if (['falha', 'failed', 'error'].includes(status)) {
      await this.processingRepo.update({ id: processing.id }, {
        status: 'falha',
        erroCodigo: 'PROCESSOR_JOB_FAILED',
        erroMensagem: response.error || 'O processamento 3D falhou.',
      });
    } else if (Number.isFinite(response.progress)) {
      await this.processingRepo.update({ id: processing.id }, { progresso: Number(response.progress) });
    }
    return (await this.processingRepo.findOne({ where: { id: processing.id } })) || processing;
  }

  private async reconcileProcessingJobs() {
    if (this.maintenanceRunning) return;
    this.maintenanceRunning = true;
    try {
      const jobs = await this.processingRepo.find({
        where: { status: In(['aguardando_upload', 'iniciando', 'em_processamento', 'aguardando_processador']) },
        take: 20,
        order: { updatedAt: 'ASC' },
      });
      for (const job of jobs) {
        if (this.startingJobs.has(job.avaliacaoId)) continue;
        try {
          if (job.status === 'em_processamento') {
            await this.refreshFromProcessor(job, null);
            continue;
          }
          const confirmed = await this.captureRepo.count({
            where: { avaliacaoId: job.avaliacaoId, uploadStatus: 'confirmado' },
          });
          if (confirmed !== CAPTURE_SPECS.length) continue;
          const claimed = await this.processingRepo.update({ id: job.id, status: job.status }, {
            status: 'iniciando',
            progresso: 5,
            erroCodigo: null,
            erroMensagem: null,
          });
          if (claimed.affected) await this.startProcessingSafely(job.avaliacaoId, null);
        } catch {
          // Consultas transitorias preservam o job; falhas ao iniciar permitem retomada explicita.
        }
      }
    } finally {
      this.maintenanceRunning = false;
    }
  }

  async reprocess(id: string, user: AuthenticatedUser) {
    await this.authorizeEvaluation(id, user, true);
    const processing = await this.processingRepo.findOne({ where: { avaliacaoId: id } });
    if (!processing) throw new NotFoundException('Processamento nao encontrado.');
    if (!['falha', 'aguardando_processador'].includes(processing.status)) {
      throw new ConflictException('Aguarde o processamento atual antes de tentar novamente.');
    }
    const confirmed = await this.captureRepo.count({
      where: { avaliacaoId: id, uploadStatus: 'confirmado' },
    });
    if (confirmed !== CAPTURE_SPECS.length) {
      throw new BadRequestException('Todas as capturas precisam estar confirmadas para reprocessar.');
    }
    const claimed = await this.processingRepo.update({ avaliacaoId: id, status: processing.status }, {
      status: 'iniciando',
      processorJobId: null,
      progresso: 5,
      erroCodigo: null,
      erroMensagem: null,
      resultados: null,
      concluidoEm: null,
    });
    if (!claimed.affected) throw new ConflictException('O processamento ja foi retomado.');
    await this.startProcessingSafely(id, user);
    const current = await this.processingRepo.findOne({ where: { avaliacaoId: id } });
    return { avaliacaoId: id, status: current?.status || 'iniciando' };
  }

  async status(id: string, user: AuthenticatedUser) {
    await this.authorizeEvaluation(id, user);
    let processing = await this.processingRepo.findOne({ where: { avaliacaoId: id } });
    if (!processing) throw new NotFoundException('Processamento nao encontrado.');
    processing = await this.refreshFromProcessor(processing, user);
    const captures = await this.captureRepo.find({ where: { avaliacaoId: id } });
    return {
      avaliacaoId: id,
      status: processing.status,
      progress: processing.progresso || 0,
      message: processing.erroMensagem || null,
      errorCode: processing.erroCodigo || null,
      terminal: ['concluida', 'falha'].includes(processing.status),
      hasResults: processing.status === 'concluida' && Boolean(processing.resultados),
      captures: captures.map((capture) => ({ vista: capture.vista, confirmed: capture.uploadStatus === 'confirmado' })),
    };
  }

  async results(id: string, user: AuthenticatedUser) {
    await this.authorizeEvaluation(id, user);
    const processing = await this.processingRepo.findOne({ where: { avaliacaoId: id } });
    if (!processing) throw new NotFoundException('Processamento nao encontrado.');
    await this.auditoria.create({
      action: 'avaliacao_imagem.results_accessed', entity: 'avaliacao_imagem', entityId: id,
      meta: { status: processing.status }, actor: this.actor(user),
    });
    return {
      avaliacaoId: id,
      status: processing.status,
      experimental: true,
      algorithmVersion: processing.algoritmoVersion || null,
      results: processing.status === 'concluida' ? (processing.resultados || null) : null,
    };
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.authorizeEvaluation(id, user, true);
    const captures = await this.captureRepo.find({ where: { avaliacaoId: id } });

    // Preserve the database mapping if storage deletion fails so the operation
    // can be retried without leaving untraceable sensitive objects behind.
    await Promise.all(
      captures.map((c) => this.storage.deleteObject(c.objectKey)),
    );

    await this.captureRepo.delete({ avaliacaoId: id });
    await this.processingRepo.delete({ avaliacaoId: id });
    await this.avaliacoesService.remove(id);

    await this.auditoria.create({
      action: 'avaliacao_imagem.deleted',
      entity: 'avaliacao_imagem',
      entityId: id,
      meta: { capturesRemoved: captures.length },
      actor: this.actor(user),
    });
    return { success: true };
  }
}
