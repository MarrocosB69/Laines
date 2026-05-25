type JsonRecord = Record<string, unknown>;

const DIAS_SEMANA = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'] as const;

const normalizeType = (value: unknown): string => (
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
);

const asRecord = (value: unknown): JsonRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as JsonRecord;
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const toText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const pick = (sources: JsonRecord[], aliases: string[]): unknown => {
  for (const source of sources) {
    for (const alias of aliases) {
      if (!Object.prototype.hasOwnProperty.call(source, alias)) continue;
      const value = source[alias];
      if (value === null || value === undefined || value === '') continue;
      return value;
    }
  }
  return null;
};

const compact = (record: JsonRecord): JsonRecord => {
  const output: JsonRecord = {};
  Object.entries(record).forEach(([key, value]) => {
    if (value !== undefined) output[key] = value;
  });
  return output;
};

const normalizeDayKey = (value: unknown): string => {
  const token = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!token) return '';
  if (token.startsWith('seg')) return 'segunda';
  if (token.startsWith('ter')) return 'terca';
  if (token.startsWith('qua')) return 'quarta';
  if (token.startsWith('qui')) return 'quinta';
  if (token.startsWith('sex')) return 'sexta';
  if (token.startsWith('sab')) return 'sabado';
  if (token.startsWith('dom')) return 'domingo';
  return '';
};

const round = (value: number | null, digits = 2): number | null => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round((value as number) * factor) / factor;
};

const mean = (values: number[]): number | null => {
  if (!values.length) return null;
  const total = values.reduce((sum, item) => sum + item, 0);
  return total / values.length;
};

const stddev = (values: number[]): number | null => {
  if (!values.length) return null;
  const avg = mean(values);
  if (!Number.isFinite(avg)) return null;
  const variance = values.reduce((sum, item) => {
    const delta = item - (avg as number);
    return sum + (delta ** 2);
  }, 0) / values.length;
  return Math.sqrt(variance);
};

const classifyAcwr = (acwr: number | null): string => {
  if (!Number.isFinite(acwr)) return '';
  if ((acwr as number) < 0.8) return 'subcarga';
  if ((acwr as number) <= 1.3) return 'zona_segura';
  if ((acwr as number) <= 1.5) return 'zona_alerta';
  return 'zona_risco';
};

type CargaTreinoSession = {
  dia: string;
  tipo: string;
  duracaoMin: number | null;
  pse: number | null;
  metValue: number | null;
  cargaSessao: number | null;
};

const normalizeSessions = (input: unknown): CargaTreinoSession[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const row = asRecord(item);
      const dia = normalizeDayKey(row.dia || row.day);
      if (!dia) return null;

      const tipo = toText(row.tipo || row.tipoSessao || row.atividade);
      const duracaoMinDirect = toNumber(row.duracaoMin || row.duracao_min || row.duracao);
      const duracaoHoras = toNumber(row.duracaoHoras || row.duracao_horas);
      const duracaoMin = Number.isFinite(duracaoMinDirect)
        ? (duracaoMinDirect as number)
        : (Number.isFinite(duracaoHoras) ? (duracaoHoras as number) * 60 : null);
      const pse = toNumber(row.pse || row.PSE);
      const metValue = toNumber(row.metValue || row.met_value || row.met);

      const isPseValid = Number.isFinite(pse) && (pse as number) >= 0 && (pse as number) <= 10;
      const isDuracaoValid = Number.isFinite(duracaoMin) && (duracaoMin as number) > 0;
      const cargaSessao = isPseValid && isDuracaoValid
        ? (pse as number) * (duracaoMin as number)
        : null;

      return {
        dia,
        tipo,
        duracaoMin: round(duracaoMin, 2),
        pse: isPseValid ? round(pse, 2) : null,
        metValue: round(metValue, 1),
        cargaSessao: round(cargaSessao, 2)
      } satisfies CargaTreinoSession;
    })
    .filter((item): item is CargaTreinoSession => Boolean(item));
};

type PayloadShape = {
  tipo?: string;
  dados?: JsonRecord;
  resultados?: JsonRecord;
  formulaId?: string;
  formulaVersion?: string;
  classificacao?: string;
  classificacaoLabel?: string;
};

export const normalizeCargaTreinoPayload = <T extends PayloadShape>(payload: T): T => {
  if (normalizeType(payload?.tipo) !== 'carga_treino') {
    return payload;
  }

  const payloadRecord = asRecord(payload as unknown);
  const dados = asRecord(payload.dados);
  const resultados = asRecord(payload.resultados);
  const dadosBrutos = asRecord(dados.dados_brutos);
  const input = asRecord(dados.input);
  const calculated = asRecord(resultados.calculated);

  const valueSources = [dados, dadosBrutos, input, resultados, calculated, payloadRecord];

  const faseAtual = toText(pick(valueSources, ['faseAtual', 'fase_atual']));
  const semanasAteCompeticao = toNumber(pick(valueSources, ['semanasAteCompeticao', 'semanas_ate_competicao']));
  const estrategiaTreinamento = toText(pick(valueSources, [
    'estrategiaTreinamento',
    'estrategia_treinamento',
    'estrategia'
  ]));

  const sessions = normalizeSessions(pick(valueSources, ['sessoesSemana', 'sessoes_semana', 'sessoes']));

  const cargas7diasByDia = DIAS_SEMANA.reduce<Record<string, number>>((acc, dia) => {
    acc[dia] = 0;
    return acc;
  }, {});
  sessions.forEach((session) => {
    if (!Number.isFinite(session.cargaSessao)) return;
    const dia = normalizeDayKey(session.dia);
    if (!dia) return;
    cargas7diasByDia[dia] = Number((cargas7diasByDia[dia] + (session.cargaSessao as number)).toFixed(2));
  });

  const cargas7dias = DIAS_SEMANA.map((dia) => cargas7diasByDia[dia]);
  const cargaSemanaAtual = round(cargas7dias.reduce((sum, item) => sum + item, 0), 2);
  const mediaCargas7dias = round(mean(cargas7dias), 4);
  const desvioPadraoCargas7dias = round(stddev(cargas7dias), 4);

  const monotonia = (
    Number.isFinite(mediaCargas7dias)
    && Number.isFinite(desvioPadraoCargas7dias)
    && (desvioPadraoCargas7dias as number) > 0
  )
    ? round((mediaCargas7dias as number) / (desvioPadraoCargas7dias as number), 4)
    : null;

  const cargaHistoricaArrayRaw = pick(valueSources, ['cargasUltimas4Semanas', 'cargas_ultimas_4_semanas']);
  const cargaHistoricaArray = Array.isArray(cargaHistoricaArrayRaw)
    ? cargaHistoricaArrayRaw
      .map((item) => toNumber(item))
      .filter((item): item is number => Number.isFinite(item))
    : [];
  const mediaCargaUltimas4SemanasResolved = toNumber(pick(valueSources, [
    'mediaCargaUltimas4Semanas',
    'media_carga_ultimas_4_semanas'
  ]));
  const mediaCargaUltimas4Semanas = Number.isFinite(mediaCargaUltimas4SemanasResolved)
    ? round(mediaCargaUltimas4SemanasResolved, 4)
    : round(mean(cargaHistoricaArray), 4);

  const acwr = (
    Number.isFinite(cargaSemanaAtual)
    && Number.isFinite(mediaCargaUltimas4Semanas)
    && (mediaCargaUltimas4Semanas as number) > 0
  )
    ? round((cargaSemanaAtual as number) / (mediaCargaUltimas4Semanas as number), 4)
    : null;

  const strain = (
    Number.isFinite(cargaSemanaAtual)
    && Number.isFinite(monotonia)
  )
    ? round((cargaSemanaAtual as number) * (monotonia as number), 2)
    : null;

  const classificacaoAcwr = classifyAcwr(acwr);

  const normalizedDados = compact({
    ...dados,
    faseAtual: faseAtual || undefined,
    semanasAteCompeticao: round(semanasAteCompeticao, 2),
    estrategiaTreinamento: estrategiaTreinamento || undefined,
    sessoesSemana: sessions,
    dados_brutos: compact({
      ...dadosBrutos,
      faseAtual: faseAtual || undefined,
      semanasAteCompeticao: round(semanasAteCompeticao, 2),
      estrategiaTreinamento: estrategiaTreinamento || undefined,
      sessoesSemana: sessions
    }),
    input: compact({
      ...input,
      faseAtual: faseAtual || undefined,
      semanasAteCompeticao: round(semanasAteCompeticao, 2),
      estrategiaTreinamento: estrategiaTreinamento || undefined,
      sessoesSemana: sessions,
      mediaCargaUltimas4Semanas
    })
  });

  const normalizedResultados = compact({
    ...resultados,
    cargaSemanaAtual,
    mediaCargaUltimas4Semanas,
    acwr,
    classificacaoAcwr: classificacaoAcwr || undefined,
    monotonia,
    strain,
    mediaCargas7dias,
    desvioPadraoCargas7dias,
    cargas7dias,
    calculated: compact({
      ...calculated,
      cargaSemanaAtual,
      mediaCargaUltimas4Semanas,
      acwr,
      classificacaoAcwr: classificacaoAcwr || undefined,
      monotonia,
      strain,
      mediaCargas7dias,
      desvioPadraoCargas7dias,
      cargas7dias
    }),
    output: compact({
      ...asRecord(resultados.output),
      classificacaoAcwr: classificacaoAcwr || undefined
    })
  });

  const formulaId = toText(payload.formulaId) || 'acwr_monotonia_strain_v1';
  const formulaVersion = toText(payload.formulaVersion) || '1.0.0';

  return {
    ...payload,
    dados: normalizedDados,
    resultados: normalizedResultados,
    formulaId,
    formulaVersion,
    classificacao: classificacaoAcwr || payload.classificacao,
    classificacaoLabel: classificacaoAcwr
      ? `ACWR ${classificacaoAcwr}`
      : payload.classificacaoLabel
  };
};
