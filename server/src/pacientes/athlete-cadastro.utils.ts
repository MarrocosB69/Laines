export type JsonRecord = Record<string, unknown>;

export type CadastroAtletaOrigem = 'equipe' | 'inscricao_publica' | 'atleta' | 'desconhecida';

export interface MergeAthleteConfirmationOptions {
  origem?: CadastroAtletaOrigem;
  cadastroStatus?: string;
  timestamp?: string;
  actorId?: string | null;
  actorName?: string | null;
  completed?: boolean;
  anamneseId?: string | null;
  versao?: string;
}

export interface PacienteCadastroSource {
  id?: string;
  prontuario?: string;
  nome?: string;
  dataNascimento?: string | null;
  genero?: string | null;
  telefone?: string | null;
  email?: string | null;
  cidade?: string | null;
  estado?: string | null;
  status?: string | null;
  modalidadePrincipal?: string | null;
  tempoPratica?: string | null;
  frequenciaSemanal?: number | null;
  duracaoSessao?: number | null;
  outrasModalidades?: string | null;
  tipoTreino?: string | null;
  intensidade?: string | null;
  objetivo?: string | null;
  observacoes?: string | null;
  historicoSaude?: string | null;
  comorbidadesPessoais?: string[] | null;
  comorbidadesFamiliares?: Record<string, unknown> | string[] | null;
  projetoId?: string | null;
  projetoNome?: string | null;
  alunoResponsavelId?: string | null;
  alunoResponsavelNome?: string | null;
  professorSupervisorId?: string | null;
  professorSupervisorNome?: string | null;
  atletaUserId?: string | null;
  consentimentoPesquisa?: string | null;
  consentimentoData?: string | null;
  confirmacaoAtleta?: JsonRecord | null;
  dataCadastro?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function asJsonRecord(value: unknown): JsonRecord {
  return isJsonRecord(value) ? value : {};
}

export function compactJsonRecord(record: JsonRecord): JsonRecord {
  return Object.entries(record).reduce<JsonRecord>((acc, [key, value]) => {
    if (value === undefined) return acc;
    if (isJsonRecord(value)) {
      acc[key] = compactJsonRecord(value);
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {});
}

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function normalizeStatus(value: unknown): string {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function deepMergeRecords(base: JsonRecord, incoming: JsonRecord): JsonRecord {
  const merged: JsonRecord = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    const current = merged[key];
    if (isJsonRecord(current) && isJsonRecord(value)) {
      merged[key] = deepMergeRecords(current, value);
      continue;
    }
    merged[key] = value;
  }
  return compactJsonRecord(merged);
}

function normalizeOrigin(value: unknown): string {
  const raw = normalizeText(value);
  return raw || 'desconhecida';
}

export function getCadastroAtletaOrigins(confirmacaoAtleta: unknown): string[] {
  const confirmation = asJsonRecord(confirmacaoAtleta);
  const values = [
    ...(Array.isArray(confirmation.origens) ? confirmation.origens : []),
    confirmation.origem
  ]
    .map(normalizeOrigin)
    .filter(Boolean);
  return [...new Set(values)];
}

export function mergeAthleteConfirmation(
  current: unknown,
  incoming: unknown,
  options: MergeAthleteConfirmationOptions = {}
): JsonRecord {
  const currentRecord = asJsonRecord(current);
  const incomingRecord = asJsonRecord(incoming);
  const timestamp = options.timestamp || new Date().toISOString();
  const merged = deepMergeRecords(currentRecord, incomingRecord);

  const origins = [
    ...getCadastroAtletaOrigins(currentRecord),
    ...getCadastroAtletaOrigins(incomingRecord),
    options.origem
  ]
    .map(normalizeOrigin)
    .filter(Boolean);
  const uniqueOrigins = [...new Set(origins)];
  if (uniqueOrigins.length > 0) {
    merged.origens = uniqueOrigins;
    merged.origem = normalizeText(merged.origem) || uniqueOrigins[0];
  }

  if (options.cadastroStatus) {
    merged.cadastroStatus = options.cadastroStatus;
  }
  if (options.versao) {
    merged.versao = options.versao;
  }
  if (options.anamneseId) {
    merged.anamneseId = options.anamneseId;
  }
  if (options.completed !== undefined) {
    merged.completed = options.completed;
    if (options.completed) {
      merged.completadoEm = timestamp;
      merged.submittedAt = timestamp;
    }
  }

  if (options.origem) {
    const event = compactJsonRecord({
      origem: options.origem,
      status: options.cadastroStatus,
      data: timestamp,
      userId: options.actorId || undefined,
      userName: options.actorName || undefined
    });
    const currentHistory = Array.isArray(merged.historicoCadastro)
      ? merged.historicoCadastro.filter(isJsonRecord)
      : [];
    merged.historicoCadastro = [...currentHistory.slice(-9), event];
    merged.ultimaAtualizacaoCadastro = event;
  }

  return compactJsonRecord(merged);
}

function resolveCadastroStatus(paciente: PacienteCadastroSource, confirmation: JsonRecord): string {
  const explicit = normalizeText(confirmation.cadastroStatus);
  if (explicit) return explicit;

  const completed = Boolean(
    confirmation.completed
    || confirmation.completadoEm
    || confirmation.submittedAt
    || confirmation.anamneseId
  );
  if (completed) return 'cadastro_atleta_completo';

  const normalizedPatientStatus = normalizeStatus(paciente.status);
  if (normalizedPatientStatus === 'triagem' || normalizedPatientStatus === 'triagem publica' || normalizedPatientStatus === 'triagem_publica') {
    return 'triagem_publica';
  }

  if (
    normalizedPatientStatus === 'lista de espera'
    || normalizedPatientStatus === 'lista_espera'
    || normalizedPatientStatus === 'espera'
  ) {
    return 'lista_espera';
  }

  if (paciente.atletaUserId) {
    return 'cadastro_atleta_pendente';
  }

  const origins = getCadastroAtletaOrigins(confirmation);
  if (origins.includes('inscricao_publica')) {
    return 'lista_espera';
  }

  return 'pre_cadastro';
}

export function buildCadastroAtletaConsolidado(paciente: PacienteCadastroSource): JsonRecord {
  const confirmation = asJsonRecord(paciente.confirmacaoAtleta);
  const dadosAutorrelatados = asJsonRecord(confirmation.dados);
  const origins = getCadastroAtletaOrigins(confirmation);
  const origemCadastro = normalizeText(confirmation.origem) || origins[0] || 'desconhecida';
  const statusCadastroAtleta = resolveCadastroStatus(paciente, confirmation);
  const formulariosLiberados = asJsonRecord(confirmation.formulariosLiberados);
  const ebiaSelfForm = asJsonRecord(confirmation.ebiaSelfForm);

  const dadosBase = compactJsonRecord({
    prontuario: paciente.prontuario || null,
    nome: paciente.nome || null,
    dataNascimento: paciente.dataNascimento || null,
    genero: paciente.genero || null,
    telefone: paciente.telefone || null,
    email: paciente.email || null,
    cidade: paciente.cidade || null,
    estado: paciente.estado || null,
    status: paciente.status || null,
    modalidadePrincipal: paciente.modalidadePrincipal || null,
    tempoPratica: paciente.tempoPratica || null,
    frequenciaSemanal: paciente.frequenciaSemanal ?? null,
    duracaoSessao: paciente.duracaoSessao ?? null,
    outrasModalidades: paciente.outrasModalidades || null,
    tipoTreino: paciente.tipoTreino || null,
    intensidade: paciente.intensidade || null,
    objetivo: paciente.objetivo || null,
    observacoes: paciente.observacoes || null,
    historicoSaude: paciente.historicoSaude || null,
    comorbidadesPessoais: paciente.comorbidadesPessoais || [],
    comorbidadesFamiliares: paciente.comorbidadesFamiliares || [],
    projetoId: paciente.projetoId || null,
    projetoNome: paciente.projetoNome || null,
    alunoResponsavelId: paciente.alunoResponsavelId || null,
    alunoResponsavelNome: paciente.alunoResponsavelNome || null,
    professorSupervisorId: paciente.professorSupervisorId || null,
    professorSupervisorNome: paciente.professorSupervisorNome || null,
    consentimentoPesquisa: paciente.consentimentoPesquisa || null,
    consentimentoData: paciente.consentimentoData || null
  });

  const campos = compactJsonRecord({
    dataNascimento: paciente.dataNascimento || dadosAutorrelatados.dataNascimento || null,
    genero: paciente.genero || dadosAutorrelatados.genero || null,
    telefone: paciente.telefone || dadosAutorrelatados.telefone || null,
    cidade: paciente.cidade || dadosAutorrelatados.cidade || null,
    estado: paciente.estado || dadosAutorrelatados.estado || null,
    modalidadePrincipal: paciente.modalidadePrincipal
      || dadosAutorrelatados.modalidadePrincipal
      || asJsonRecord(dadosAutorrelatados.esportivo).modalidade
      || null,
    objetivo: paciente.objetivo || dadosAutorrelatados.objetivo || null,
    queixaPrincipal: paciente.observacoes
      || dadosAutorrelatados.queixaPrincipal
      || dadosAutorrelatados.motivoAtendimento
      || dadosAutorrelatados.observacoes
      || null,
    historicoSaude: paciente.historicoSaude || dadosAutorrelatados.historicoSaude || null,
    comorbidadesPessoais: paciente.comorbidadesPessoais
      || dadosAutorrelatados.comorbidadesPessoais
      || dadosAutorrelatados.patologias
      || [],
    comorbidadesFamiliares: paciente.comorbidadesFamiliares
      || dadosAutorrelatados.comorbidadesFamiliares
      || []
  });

  return compactJsonRecord({
    origemCadastro,
    origensCadastro: origins.length ? origins : [origemCadastro],
    statusCadastroAtleta,
    cadastroCompleto: statusCadastroAtleta === 'cadastro_atleta_completo',
    cadastroPendente: statusCadastroAtleta !== 'cadastro_atleta_completo',
    completadoEm: confirmation.completadoEm || confirmation.submittedAt || null,
    anamneseId: confirmation.anamneseId || null,
    dadosBase,
    dadosAutorrelatados,
    campos,
    formulariosLiberados,
    ebiaSelfForm,
    consentimento: asJsonRecord(confirmation.consentimento),
    ultimaAtualizacaoCadastro: asJsonRecord(confirmation.ultimaAtualizacaoCadastro),
    historicoCadastro: Array.isArray(confirmation.historicoCadastro) ? confirmation.historicoCadastro : []
  });
}
