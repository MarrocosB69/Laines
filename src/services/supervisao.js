import api from './api';

/*
 * UPD-17 — supervisao por jornada.
 *
 * A fila junta dois recursos que o servidor mantem separados (avaliacoes e
 * planos alimentares, cada um com seu findFilaRevisao) na MESMA forma de
 * item: { tipo, id, pacienteId, pacienteNome, tipoInstrumento, enviadoPorId,
 * enviadoPorNome, enfileiradoEm, rota }. Este arquivo so consome as duas
 * rotas — nao reimplementa a regra de acesso, que e do servidor.
 */

const sortByEnfileiradoEm = (items) => (
  [...items].sort((a, b) => new Date(a.enfileiradoEm).getTime() - new Date(b.enfileiradoEm).getTime())
);

/*
 * O item de avaliacao devolvido por GET /avaliacoes/fila-revisao nao carrega
 * a observacao de envio (meta.observacaoEnvio) — o formato da fila e o mesmo
 * ha duas ondas e alterar findFilaRevisao nao faz parte deste item. Busca-se
 * o registro completo por item (o usuario ja tem vinculo, senao nao estaria
 * na fila) para trazer a pergunta do aluno para a lista. Filas de liga sao
 * pequenas; falha em um item so deixa aquele item sem a observacao, nunca
 * derruba a fila inteira.
 */
const enrichAvaliacaoObservacao = async (item) => {
  try {
    const { data } = await api.get(`/avaliacoes/${item.id}`);
    const observacaoEnvio = typeof data?.meta?.observacaoEnvio === 'string' ? data.meta.observacaoEnvio : '';
    return observacaoEnvio ? { ...item, observacaoEnvio } : item;
  } catch {
    return item;
  }
};

export const getFilaRevisao = async ({ limit = 25, offset = 0 } = {}) => {
  const [avaliacoesRes, planosRes] = await Promise.all([
    api.get('/avaliacoes/fila-revisao', { params: { limit, offset } }),
    api.get('/planos-alimentares/fila-revisao', { params: { limit, offset } })
  ]);
  const avaliacoesBrutas = Array.isArray(avaliacoesRes.data) ? avaliacoesRes.data : [];
  const planos = Array.isArray(planosRes.data) ? planosRes.data : [];

  const avaliacoesEnriquecidas = await Promise.all(avaliacoesBrutas.map(enrichAvaliacaoObservacao));

  return sortByEnfileiradoEm([...avaliacoesEnriquecidas, ...planos]);
};

/* Aprova um item da fila sem exigir abrir o registro completo. */
export const aprovarItemFila = async (item) => {
  if (item.tipo === 'avaliacao') {
    const { data } = await api.patch(`/avaliacoes/${item.id}/revisar`, {});
    return data;
  }
  if (item.tipo === 'plano') {
    // Plano exige expectedVersion (CAS) que a fila nao carrega, e aprovar e
    // um fluxo de dois passos no servidor (revisar confirma a composicao,
    // ativar publica). Busca a versao atual e encadeia os dois — o usuario
    // continua sem precisar abrir a tela de prescricao.
    const { data: atual } = await api.get(`/planos-alimentares/${item.id}`);
    const versaoAtual = Number(atual?.dados?.version || 0);
    const { data: revisado } = await api.post(`/planos-alimentares/${item.id}/revisar`, {
      expectedVersion: versaoAtual
    });
    const versaoRevisada = Number(revisado?.dados?.version ?? versaoAtual + 1);
    const { data: ativado } = await api.post(`/planos-alimentares/${item.id}/ativar`, {
      expectedVersion: versaoRevisada
    });
    return ativado;
  }
  throw new Error(`Tipo de item de fila desconhecido: ${item.tipo}`);
};

/* Devolve um item da fila com observacao, sem exigir abrir o registro completo. */
export const devolverItemFila = async (item, observacao) => {
  if (item.tipo === 'avaliacao') {
    const { data } = await api.patch(`/avaliacoes/${item.id}/devolver`, { observacao });
    return data;
  }
  if (item.tipo === 'plano') {
    const { data: atual } = await api.get(`/planos-alimentares/${item.id}`);
    const versaoAtual = Number(atual?.dados?.version || 0);
    const { data } = await api.post(`/planos-alimentares/${item.id}/devolver`, {
      expectedVersion: versaoAtual,
      observacao
    });
    return data;
  }
  throw new Error(`Tipo de item de fila desconhecido: ${item.tipo}`);
};

/* UPD-17 (servidor, parte 1): o aluno responsavel/equipe/gestao pede revisao. */
export const enviarAvaliacaoParaRevisao = async (avaliacaoId, observacao) => {
  const texto = String(observacao || '').trim();
  const { data } = await api.patch(`/avaliacoes/${avaliacaoId}/enviar-revisao`, texto ? { observacao: texto } : {});
  return data;
};
