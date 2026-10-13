export type NivelPrioridadeContato = 'vermelho' | 'amarelo' | 'cinza' | 'verde';
export type PontoTriagem = 0 | 1 | null;

export type CriteriosTriagem = {
  energiaTreino: PontoTriagem;
  insegurancaAlimentar: PontoTriagem;
  sinaisSintomas: PontoTriagem;
};

export const VERSAO_PRIORIDADE_CONTATO = 'contato-v2' as const;

export type PrioridadeContato = {
  nivel: NivelPrioridadeContato;
  rotulo: string;
  motivos: string[];
  pontos: number | null;
  criterios: CriteriosTriagem;
  versao: typeof VERSAO_PRIORIDADE_CONTATO;
};

export const ORDEM_PRIORIDADE_CONTATO: Record<NivelPrioridadeContato, number> = {
  vermelho: 0,
  amarelo: 1,
  cinza: 2,
  verde: 3
};

// Códigos oferecidos na inscrição pública (CLINICAL_SIGN_OPTIONS).
const SINAIS_PUBLICOS = new Set([
  'caibras_qualquer_hora', 'formigamento', 'contracoes_musculares_persistentes',
  'tremores_musculos', 'movimentos_involuntarios', 'caibras_noturnas',
  'sensacao_choque_eletrico', 'cansaco_fadiga', 'mialgia', 'fraqueza_muscular',
  'palidez', 'queda_cabelo', 'unhas_frageis', 'glossite', 'queilite_angular',
  'xeroftalmia'
]);

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object'
  && !Array.isArray(value) ? value as Record<string, unknown> : {};
const token = (value: unknown): string => typeof value === 'string'
  ? value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
const simNao = (value: unknown): PontoTriagem => {
  if (value === true || ['sim', 'true'].includes(token(value))) return 1;
  if (value === false || ['nao', 'false'].includes(token(value))) return 0;
  return null;
};

const pontoEnergiaTreino = (dados: Record<string, unknown>): PontoTriagem => {
  const sexo = token(dados.sexoBiologico);
  const instrumento = sexo.startsWith('fem') ? 'leaf_q'
    : sexo.startsWith('masc') ? 'lea_q13' : null;
  if (!instrumento || dados.redsInstrumento !== instrumento) return null;
  const respostas = record(dados.redsRespostas);
  const prefixo = instrumento === 'leaf_q' ? 'leaf_q' : 'lea_q';
  const total = instrumento === 'leaf_q' ? 12 : 13;
  const chaves = Array.from({ length: total }, (_, index) => `${prefixo}${index + 1}`);
  if (chaves.some((chave) => Object.prototype.hasOwnProperty.call(respostas, chave)
    && simNao(respostas[chave]) === null)) {
    return null;
  }
  const pontos = chaves.map((chave) => simNao(respostas[chave]));
  if (pontos.includes(1)) return 1;
  return pontos.every((ponto) => ponto === 0) ? 0 : null;
};

const pontoInsegurancaAlimentar = (dados: Record<string, unknown>): PontoTriagem => {
  const respostas = record(dados.ebia).respostas;
  if (!Array.isArray(respostas) || respostas.length !== 3) return null;
  const pontos = respostas.map((item) => simNao(record(item).resposta));
  if (respostas.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    return null;
  }
  if (respostas.some((item) => record(item).resposta != null
    && simNao(record(item).resposta) === null)) return null;
  if (pontos.includes(1)) return 1;
  return pontos.every((ponto) => ponto === 0) ? 0 : null;
};

const pontoSinaisSintomas = (dados: Record<string, unknown>): PontoTriagem => {
  const raw = dados.sinaisClinicos;
  if (raw != null && (!Array.isArray(raw) || raw.some((item) => typeof item !== 'string'))) {
    return null;
  }
  const sinais = new Set((Array.isArray(raw) ? raw : []).map(token).filter(Boolean));
  if ([...sinais].some((sinal) => sinal !== 'nenhum' && !SINAIS_PUBLICOS.has(sinal))) {
    return null;
  }
  const nenhum = sinais.delete('nenhum') || record(dados.relatoNegativo).sinais === true;
  if (nenhum && sinais.size) return null;
  if (sinais.size >= 4) return 1;
  return sinais.size || nenhum ? 0 : null;
};

const motivo = (rotulo: string, ponto: PontoTriagem, positivo: string): string => (
  ponto === null ? `${rotulo}: resposta incompleta ou inconsistente.`
    : ponto === 1 ? `${rotulo}: 1 ponto — ${positivo}.`
      : `${rotulo}: 0 ponto.`
);

export function prioridadeContatoDaTriagem(dados: Record<string, unknown>): PrioridadeContato {
  const criterios: CriteriosTriagem = {
    energiaTreino: pontoEnergiaTreino(dados),
    insegurancaAlimentar: pontoInsegurancaAlimentar(dados),
    sinaisSintomas: pontoSinaisSintomas(dados)
  };
  const pontosConfirmados = Object.values(criterios).filter((ponto) => ponto === 1).length;
  const incompleto = Object.values(criterios).some((ponto) => ponto === null);
  const nivel: NivelPrioridadeContato = pontosConfirmados >= 2 ? 'vermelho'
    : incompleto ? 'cinza' : pontosConfirmados === 1 ? 'amarelo' : 'verde';
  const rotulo = { vermelho: 'Contato prioritário', amarelo: 'Contato antecipado',
    cinza: 'Revisar respostas', verde: 'Ordem regular' }[nivel];
  const motivos = [
    motivo('Energia e treino (rastreio RED-S)', criterios.energiaTreino,
      'sinal relacionado à baixa disponibilidade energética relatado'),
    motivo('Segurança alimentar', criterios.insegurancaAlimentar,
      'resposta positiva no rastreio breve'),
    motivo('Sinais e sintomas', criterios.sinaisSintomas,
      'quatro ou mais sinais distintos relatados')
  ];
  if (incompleto) motivos.push('Há respostas pendentes; confirmar no contato.');
  return { nivel, rotulo, pontos: incompleto ? null : pontosConfirmados,
    criterios, motivos, versao: VERSAO_PRIORIDADE_CONTATO };
}
