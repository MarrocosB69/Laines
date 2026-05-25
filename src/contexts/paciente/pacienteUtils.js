import { toDate, formatDate as formatDateUtil } from '../../utils/dateUtils';
import { getSkinfoldProtocolRequiredFields } from '../../services/calculationEngine';
import { EVALUATION_REGISTRY_BY_TYPE } from '../../constants/evaluationRegistry';


export const convertFirebaseDate = (dateValue) => toDate(dateValue);

export const formatDate = (date) => {
  if (!date) return 'Nao informada';
  const formatted = formatDateUtil(date);
  return formatted === '--/--/----' ? 'Data invalida' : formatted;
};

export const formatDateForFirebase = (date) => {
  if (!date) return null;

  if (date instanceof Date) {
    return date.toISOString();
  }

  if (typeof date === 'string') {
    return date;
  }

  return null;
};

const isFilledValue = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
  return value !== null && value !== undefined && String(value).trim() !== '';
};

const readPath = (source, path) => {
  if (!source || !path) return undefined;
  return String(path)
    .split('.')
    .reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), source);
};

const getAvaliacaoFieldValue = (avaliacao, field) => {
  if (!avaliacao) return null;
  if (!field) return null;

  if (field === 'registros') {
    return (
      avaliacao.registros
      || readPath(avaliacao, 'dados.registros')
      || readPath(avaliacao, 'dados.input.registros')
      || []
    );
  }

  const sourcePaths = [
    field,
    `dados.${field}`,
    `dados.dados_brutos.${field}`,
    `dados.dados_brutos.dobras.${field}`,
    `dados.dobras.${field}`,
    `dados.resultados_calculados.${field}`,
    `dados.classificacoes.${field}`,
    `dados.metadados_formula.${field}`,
    `dados.comparacao.${field}`,
    `dados.input.${field}`,
    `dados.input.dobrasMm.${field}`,
    `dados.input.dobras.${field}`,
    `dados.source.${field}`,
    `resultados.${field}`,
    `resultados.calculated.${field}`,
    `resultados.output.${field}`,
    `resultados.comparacao.${field}`,
    `meta.${field}`
  ];

  for (const path of sourcePaths) {
    const value = readPath(avaliacao, path);
    if (value !== undefined) return value;
  }

  return null;
};

const DOBRAS_PROTOCOLS_WITH_AGE = new Set([
  'jackson_pollock_3',
  'jackson_pollock_7',
  'petroski_1995',
  'durnin_womersley'
]);

const DOBRAS_FIELD_ALIASES = {
  peitoral: ['peitoral'],
  axilar_media: ['axilar_media', 'axilarMedia'],
  triceps: ['triceps', 'tricipital'],
  subescapular: ['subescapular'],
  abdominal: ['abdominal'],
  suprailiaca: ['suprailiaca', 'supraIliaca', 'supra_iliaca'],
  coxa: ['coxa'],
  panturrilha_medial: ['panturrilha_medial', 'panturrilhaMedial'],
  biceps: ['biceps', 'biceps_braquial']
};

const resolveDobrasProtocolMeta = (avaliacao, labels) => {
  const protocolo = String(
    getAvaliacaoFieldValue(avaliacao, 'protocolo')
    || getAvaliacaoFieldValue(avaliacao, 'protocoloDobras')
    || getAvaliacaoFieldValue(avaliacao, 'protocolId')
    || 'jackson_pollock_7'
  )
    .trim()
    .toLowerCase();

  const sexo = getAvaliacaoFieldValue(avaliacao, 'sexo');
  const requiredFolds = getSkinfoldProtocolRequiredFields({ protocolId: protocolo, sex: sexo });

  const requiredFields = [...requiredFolds, 'sexo'];
  if (DOBRAS_PROTOCOLS_WITH_AGE.has(protocolo)) {
    requiredFields.push('idade');
  }

  const orderedUniqueRequiredFields = Array.from(new Set(requiredFields));

  return {
    protocolo,
    requiredFields: orderedUniqueRequiredFields,
    requiredFieldLabels: orderedUniqueRequiredFields.map((field) => labels[field] || field)
  };
};

const resolveDobrasFieldValue = (avaliacao, field) => {
  const aliases = DOBRAS_FIELD_ALIASES[field] || [field];
  for (const alias of aliases) {
    const value = getAvaliacaoFieldValue(avaliacao, alias);
    if (isFilledValue(value)) return value;
  }
  return null;
};

export const buildAvaliacaoMeta = (avaliacao) => {
  const tipo = String(avaliacao?.tipo || '').trim().toLowerCase();

  const labels = {
    percentualGordura: 'Percentual de gordura',
    massaMagra: 'Massa magra',
    aguaTotal: 'Agua total',
    peitoral: 'Peitoral',
    axilarMedia: 'Axilar media',
    axilar_media: 'Axilar media',
    triceps: 'Triceps',
    subescapular: 'Subescapular',
    abdominal: 'Abdominal',
    supraIliaca: 'Supra-iliaca',
    suprailiaca: 'Supra-iliaca',
    supra_iliaca: 'Supra-iliaca',
    coxa: 'Coxa',
    panturrilha_medial: 'Panturrilha medial',
    biceps: 'Biceps',
    idade: 'Idade',
    sexo: 'Sexo',
    peso: 'Peso',
    estatura: 'Estatura',
    fonte_oficial: 'Fonte oficial',
    percentualGorduraOficial: 'Percentual de gordura oficial',
    massaMagraOficialKg: 'Massa magra oficial',
    tmbSelecionadaKcal: 'TMB selecionada',
    tmbBaseKcal: 'TMB base',
    fatorAtividade: 'Fator de atividade',
    getEstimadoKcal: 'GET estimado',
    nomePaciente: 'Nome',
    sexoBiologico: 'Sexo biologico',
    objetivos: 'Objetivos principais',
    scoreRisco: 'Score de risco',
    prioridade: 'Prioridade de cuidado',
    pressaoSistolica: 'PA sistolica',
    pressaoDiastolica: 'PA diastolica',
    frequenciaCardiaca: 'Frequencia cardiaca',
    prioridadeCuidado: 'Prioridade de cuidado',
    cintura: 'Cintura',
    categorias: 'Kcal por grupo NOVA',
    registros: 'Registros de consumo',
    pesoAntesExercicio: 'Peso antes',
    pesoAposExercicio: 'Peso apos',
    duracaoExercicioMin: 'Duracao do exercicio',
    perdaPesoPercentual: 'Perda de peso percentual',
    temMenores: 'Presenca de menores no domicilio',
    pontuacaoEBIA: 'Pontuacao EBIA',
    classificacaoLabel: 'Classificacao EBIA',
    queixaPrincipal: 'Queixa principal',
    intensidadeDor: 'Intensidade da dor',
    objetivo: 'Objetivo do atendimento',
    estresse: 'Nivel de estresse',
    painel: 'Painel de exames',
    analitos: 'Analitos',
    adesaoPlanoAlimentar: 'Adesao ao plano alimentar',
    adesaoAtividadeFisica: 'Adesao a atividade fisica',
    scoreAdesaoGeral: 'Score de adesao geral',
    disponibilidadeEnergetica: 'Disponibilidade energetica',
    scoreLeafQ: 'Score de rastreio RED-S',
    faseAtual: 'Fase atual',
    sessoesSemana: 'Sessoes da semana',
    cargaSemanaAtual: 'Carga semanal atual'
  };

  let requiredFields = EVALUATION_REGISTRY_BY_TYPE[tipo]?.requiredFields || [];
  let dobrasMeta = null;

  if (tipo === 'dobras_cutaneas') {
    dobrasMeta = resolveDobrasProtocolMeta(avaliacao, labels);
    requiredFields = dobrasMeta.requiredFields;
  }

  if (requiredFields.length === 0) {
    return {
      completude: 0,
      pendencias: [],
      camposPreenchidos: 0,
      camposTotais: 0,
      ...(dobrasMeta ? {
        protocolo: dobrasMeta.protocolo,
        camposObrigatorios: dobrasMeta.requiredFieldLabels
      } : {})
    };
  }

  let filledCount = 0;
  const pendencias = [];

  requiredFields.forEach((field) => {
    const value = tipo === 'dobras_cutaneas'
      ? resolveDobrasFieldValue(avaliacao, field)
      : getAvaliacaoFieldValue(avaliacao, field);

    if (isFilledValue(value)) {
      filledCount += 1;
    } else {
      pendencias.push(labels[field] || field);
    }
  });

  const completude = Math.round((filledCount / requiredFields.length) * 100);

  return {
    completude,
    pendencias,
    camposPreenchidos: filledCount,
    camposTotais: requiredFields.length,
    ...(dobrasMeta ? {
      protocolo: dobrasMeta.protocolo,
      camposObrigatorios: dobrasMeta.requiredFieldLabels
    } : {})
  };
};
export const sanitizePacientePayload = (data) => {
  const payload = { ...data };
  delete payload.id;
  delete payload.createdAt;
  delete payload.updatedAt;
  delete payload.linkedAt;
  delete payload.dataCadastro;
  delete payload.dataCadastroFormatada;
  delete payload.dataNascimentoFormatada;
  delete payload.idade;
  delete payload.modalidade;
  delete payload.prontuario;
  delete payload.alunoResponsavel;
  delete payload.professorSupervisor;
  return payload;
};

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
