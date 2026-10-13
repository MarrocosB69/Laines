import { normalizeBioimpedanciaPayload } from './bioimpedancia-normalizer';
import { normalizeEvolucaoRetornoPayload } from './evolucao-retorno-normalizer';
import { normalizeExamesLaboratoriaisPayload } from './exames-laboratoriais-normalizer';
import { normalizeAnamneseInicialPayload } from './anamnese-normalizer';
import { normalizeAvaliacaoClinicaPayload } from './avaliacao-clinica-normalizer';
import { normalizeDobrasCutaneasPayload } from './dobras-cutaneas-normalizer';
import { normalizePerimetrosPayload } from './perimetros-normalizer';
import { normalizeComposicaoCorporalIntegradaPayload } from './composicao-corporal-integrada-normalizer';
import { normalizeGastoEnergeticoTotalPayload } from './gasto-energetico-total-normalizer';
import { normalizeAvaliacaoAlimentarPayload } from './alimentar-normalizer';
import { normalizeHidratacaoPayload } from './hidratacao-normalizer';
import { normalizeAvaliacaoSocioeconomicaPayload } from './avaliacao-socioeconomica-normalizer';
import { normalizeFisioterapiaPayload } from './fisioterapia-normalizer';
import { normalizePsicologiaPayload } from './psicologia-normalizer';
import { normalizeTriagemRedsPayload } from './normalizers/triagem-reds-normalizer';
import { normalizeCargaTreinoPayload } from './normalizers/carga-treino-normalizer';
import { normalizePlanoMetasPayload } from './normalizers/plano-metas-normalizer';

type GenericPayload = {
  tipo?: string;
};

type PayloadNormalizer = <T extends GenericPayload>(payload: T) => T;

const normalizeType = (value: unknown) => (
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
);

const NORMALIZERS: Record<string, PayloadNormalizer> = {
  bioimpedancia: normalizeBioimpedanciaPayload,
  dobras_cutaneas: normalizeDobrasCutaneasPayload,
  perimetros: normalizePerimetrosPayload,
  composicao_corporal_integrada: normalizeComposicaoCorporalIntegradaPayload,
  gasto_energetico_total: normalizeGastoEnergeticoTotalPayload,
  alimentar: normalizeAvaliacaoAlimentarPayload,
  hidratacao: normalizeHidratacaoPayload,
  avaliacao_socioeconomica: normalizeAvaliacaoSocioeconomicaPayload,
  fisioterapia: normalizeFisioterapiaPayload,
  psicologia: normalizePsicologiaPayload,
  exames_laboratoriais: normalizeExamesLaboratoriaisPayload,
  evolucao_retorno: normalizeEvolucaoRetornoPayload,
  anamnese_inicial: normalizeAnamneseInicialPayload,
  avaliacao_clinica: normalizeAvaliacaoClinicaPayload,
  triagem_reds: normalizeTriagemRedsPayload,
  carga_treino: normalizeCargaTreinoPayload,
  plano_metas: normalizePlanoMetasPayload
};

export const normalizeAvaliacaoPayload = <T extends GenericPayload>(payload: T): T => {
  const tipo = normalizeType(payload?.tipo);
  const normalizer = NORMALIZERS[tipo];
  if (!normalizer) return payload;
  return normalizer(payload);
};
