import { toDate, formatDate as formatDateUtil } from '../../utils/dateUtils';

export const convertFirebaseDate = (dateValue) => toDate(dateValue);

export const formatDate = (date) => {
  if (!date) return 'Não informada';
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
  return value !== null && value !== undefined && value !== '';
};

const getAvaliacaoFieldValue = (avaliacao, field) => {
  if (!avaliacao) return null;
  if (field === 'registros') return avaliacao.registros || avaliacao.dados?.registros || [];
  if (avaliacao.dados && field in avaliacao.dados) return avaliacao.dados[field];
  if (avaliacao.resultados && field in avaliacao.resultados) return avaliacao.resultados[field];
  if (field in avaliacao) return avaliacao[field];
  return null;
};

export const buildAvaliacaoMeta = (avaliacao) => {
  const tipo = avaliacao?.tipo || '';
  const requiredByTipo = {
    bioimpedancia: ['peso', 'estatura', 'percentualGordura'],
    dobras_cutaneas: [
      'tricipital',
      'subescapular',
      'suprailiaca',
      'abdominal',
      'coxa',
      'peitoral',
      'idade',
      'sexo',
      'peso',
      'altura'
    ],
    perimetros: [
      'braco_relaxado',
      'braco_contraido',
      'cintura',
      'abdominal',
      'quadril',
      'coxa',
      'panturrilha'
    ],
    alimentar: ['registros'],
    hidratacao: ['perdaSuor', 'taxaSudorese', 'perdaPesoPercentual'],
    avaliacao_socioeconomica: [
      'situacaoFamiliar',
      'rendaFamiliar',
      'numeroMoradores',
      'numeroComodos',
      'escolaridadeResponsavel'
    ]
  };

  const labels = {
    peso: 'Peso',
    estatura: 'Estatura',
    percentualGordura: 'Percentual de gordura',
    tricipital: 'Tricipital',
    subescapular: 'Subescapular',
    suprailiaca: 'Suprailiaca',
    abdominal: 'Abdominal',
    coxa: 'Coxa',
    peitoral: 'Peitoral',
    idade: 'Idade',
    sexo: 'Sexo',
    altura: 'Altura',
    braco_relaxado: 'Braco relaxado',
    braco_contraido: 'Braco contraido',
    cintura: 'Cintura',
    quadril: 'Quadril',
    panturrilha: 'Panturrilha',
    registros: 'Registros de consumo',
    perdaSuor: 'Perda de suor',
    taxaSudorese: 'Taxa de sudorese',
    perdaPesoPercentual: 'Perda de peso',
    situacaoFamiliar: 'Situacao familiar',
    rendaFamiliar: 'Renda familiar',
    numeroMoradores: 'Numero de moradores',
    numeroComodos: 'Numero de comodos',
    escolaridadeResponsavel: 'Escolaridade do responsavel'
  };

  const requiredFields = requiredByTipo[tipo] || [];
  if (requiredFields.length === 0) {
    return { completude: 0, pendencias: [], camposPreenchidos: 0, camposTotais: 0 };
  }

  let filledCount = 0;
  const pendencias = [];
  requiredFields.forEach((field) => {
    const value = getAvaliacaoFieldValue(avaliacao, field);
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
    camposTotais: requiredFields.length
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
