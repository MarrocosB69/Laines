type Registro = Record<string, unknown>;

const registro = (value: unknown): Registro => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as Registro : {};
const texto = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const normalizar = (value: unknown) => texto(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function avaliacaoElegivel(avaliacao: Registro | null) {
  return Boolean(avaliacao && avaliacao.status === 'finalizada' && !avaliacao.deletedAt);
}

export function origemAvaliacao(avaliacao: Registro | null) {
  if (!avaliacaoElegivel(avaliacao)) return null;
  const dados = registro(avaliacao?.dados);
  const formula = registro(dados.metadados_formula);
  return {
    avaliacaoId: avaliacao?.id,
    status: avaliacao?.status,
    data: avaliacao?.measuredAt || avaliacao?.data || null,
    metodo: avaliacao?.formulaId || formula.formulaId || null,
    origem: avaliacao?.sourceSystem || null,
  };
}

/*
 * Referências populacionais de ingestão (DRI, NASEM) para adultos, por sexo
 * biológico e faixa etária. Mesmos oito nutrientes já existentes no sistema;
 * nenhum nutriente foi acrescentado. RDA/AI são referências populacionais e
 * não metas individuais; sódio usa o CDRR (limite). Menores de 19 anos,
 * gestação e lactação não têm referência nesta versão e ficam sem valor.
 */
type Faixa = '19-30' | '31-50' | '51-70' | '71+';
type Sexo = 'masculino' | 'feminino';

const FONTE_DRI = 'DRI (NASEM) · RDA/AI para adultos; sódio CDRR 2019; potássio AI 2019';

const NUTRIENTES = [
  { nutriente: 'fibra', rotulo: 'Fibra', unidade: 'g', tipo: 'AI', direcao: 'referencia' },
  { nutriente: 'ferro', rotulo: 'Ferro', unidade: 'mg', tipo: 'RDA', direcao: 'referencia' },
  { nutriente: 'calcio', rotulo: 'Cálcio', unidade: 'mg', tipo: 'RDA', direcao: 'referencia' },
  { nutriente: 'zinco', rotulo: 'Zinco', unidade: 'mg', tipo: 'RDA', direcao: 'referencia' },
  { nutriente: 'magnesio', rotulo: 'Magnésio', unidade: 'mg', tipo: 'RDA', direcao: 'referencia' },
  { nutriente: 'vitaminaD', rotulo: 'Vitamina D', unidade: 'µg', tipo: 'RDA', direcao: 'referencia' },
  { nutriente: 'potassio', rotulo: 'Potássio', unidade: 'mg', tipo: 'AI', direcao: 'referencia' },
  { nutriente: 'sodio', rotulo: 'Sódio', unidade: 'mg', tipo: 'CDRR', direcao: 'limite' },
] as const;

// Ordem: fibra, ferro, cálcio, zinco, magnésio, vitamina D, potássio, sódio.
const VALORES_DRI: Record<Sexo, Record<Faixa, number[]>> = {
  masculino: {
    '19-30': [38, 8, 1000, 11, 400, 15, 3400, 2300],
    '31-50': [38, 8, 1000, 11, 420, 15, 3400, 2300],
    '51-70': [30, 8, 1000, 11, 420, 15, 3400, 2300],
    '71+':   [30, 8, 1200, 11, 420, 20, 3400, 2300],
  },
  feminino: {
    '19-30': [25, 18, 1000, 8, 310, 15, 2600, 2300],
    '31-50': [25, 18, 1000, 8, 320, 15, 2600, 2300],
    '51-70': [21, 8, 1200, 8, 320, 15, 2600, 2300],
    '71+':   [21, 8, 1200, 8, 320, 20, 2600, 2300],
  },
};

function idadeEm(nascimento: string, hoje: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) return null;
  const data = new Date(`${nascimento}T00:00:00.000Z`);
  if (!Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== nascimento || nascimento > hoje) return null;
  return Number(hoje.slice(0, 4)) - Number(nascimento.slice(0, 4)) - (hoje.slice(5) < nascimento.slice(5) ? 1 : 0);
}

function sexoBiologico(valor: string): Sexo | null {
  if (['masculino', 'm', 'homem', 'male'].includes(valor)) return 'masculino';
  if (['feminino', 'f', 'mulher', 'female'].includes(valor)) return 'feminino';
  return null;
}

function faixaEtaria(idade: number | null): Faixa | null {
  if (idade === null || idade < 19) return null;
  if (idade <= 30) return '19-30';
  if (idade <= 50) return '31-50';
  if (idade <= 70) return '51-70';
  return '71+';
}

export function contextoReferencias(paciente: Registro, anamnese: Registro | null, hoje = new Date().toISOString().slice(0, 10)) {
  const dados = avaliacaoElegivel(anamnese) ? registro(anamnese?.dados) : {};
  const sexo = sexoBiologico(normalizar(paciente.sexoBiologico || paciente.sexo || dados.sexoBiologico));
  const nascimento = texto(paciente.dataNascimento || dados.dataNascimento);
  const idade = idadeEm(nascimento, hoje);
  const faixa = faixaEtaria(idade);
  const valores = sexo && faixa ? VALORES_DRI[sexo][faixa] : null;
  const rotuloSexo = sexo === 'masculino' ? 'homem' : sexo === 'feminino' ? 'mulher' : null;
  const rotuloFaixa = faixa === '71+' ? '71 anos ou mais' : faixa ? `${faixa.replace('-', '–')} anos` : null;

  let motivo: string | null = null;
  if (!sexo && idade === null) motivo = 'Sexo biológico e data de nascimento não informados no cadastro. Referência DRI indisponível; as metas individuais do GET permanecem separadas.';
  else if (!sexo) motivo = 'Sexo biológico não informado no cadastro. Referência DRI indisponível; as metas individuais do GET permanecem separadas.';
  else if (idade === null) motivo = 'Data de nascimento inválida ou ausente. Referência DRI indisponível; as metas individuais do GET permanecem separadas.';
  else if (!faixa) motivo = 'Referência DRI para menores de 19 anos não incluída nesta versão. As metas individuais do GET permanecem separadas.';

  return {
    grupo: valores ? `${rotuloSexo} ${rotuloFaixa}` : null,
    fonte: FONTE_DRI,
    dataReferencia: hoje,
    origemPerfil: paciente.sexoBiologico || paciente.sexo ? 'cadastro do paciente' : origemAvaliacao(anamnese),
    idade,
    sexo,
    faixa,
    observacao: valores ? 'Gestação e lactação exigem referência própria, não considerada aqui.' : null,
    motivo,
    linhas: NUTRIENTES.map((ref, index) => ({ ...ref, valor: valores ? valores[index] : null })),
  };
}

export function restricoesDaAnamnese(anamnese: Registro | null) {
  if (!avaliacaoElegivel(anamnese)) return {
    descricao: '', origem: null, alimentoIds: [], pendenteRevisao: true,
    motivo: 'Sem anamnese finalizada para conferir restrições. Sugestões automáticas suspensas.',
  };
  const descricao = texto(registro(anamnese?.dados).alergias);
  // Somente negações completas e inequívocas; texto livre não é um catálogo de alérgenos.
  const semRestricao = ['nenhuma', 'nenhum', 'nao', 'nao possui', 'sem alergias', 'sem alergias ou intolerancias']
    .includes(normalizar(descricao));
  return {
    descricao,
    origem: origemAvaliacao(anamnese),
    alimentoIds: [],
    pendenteRevisao: !semRestricao,
    motivo: semRestricao ? null : descricao
      ? 'Há restrições registradas em texto livre. Sugestões automáticas suspensas até conferência profissional dos alimentos.'
      : 'A anamnese não informa alergias/intolerâncias. Sugestões automáticas suspensas até conferência profissional.',
  };
}

/*
 * Restrições confirmadas no plano (UPD-11). A anamnese traz texto livre; a
 * conferência mapeia esse texto para grupos/alimentos do catálogo e viaja com o
 * plano. Autoria e data da conferência são fixadas no servidor.
 */
export type RestricoesPlano = {
  conferidoEm: string;
  conferidoPorId: string;
  conferidoPorNome: string;
  origem: { descricao: string; avaliacaoId: string | null; data: unknown } | null;
  semRestricao: boolean;
  grupos: string[];
  alimentoIds: string[];
  observacao: string;
  justificativas: Record<string, string>;
};

const listaTexto = (value: unknown, max = 100) => Array.isArray(value)
  ? [...new Set(value.map((item) => texto(item)).filter(Boolean))].slice(0, max)
  : [];

const mesmaLista = (a: string[], b: string[]) => a.length === b.length && a.every((item) => b.includes(item));

export function normalizarRestricoesPlano(
  raw: unknown,
  anterior: unknown,
  autor: { id?: string; name?: string },
  agora = new Date().toISOString()
): RestricoesPlano | undefined {
  if (raw === undefined) return anterior && typeof anterior === 'object' ? anterior as RestricoesPlano : undefined;
  if (raw === null) return undefined;
  const entrada = registro(raw);
  const prev = registro(anterior);
  const grupos = listaTexto(entrada.grupos, 50);
  const alimentoIds = listaTexto(entrada.alimentoIds, 200);
  const semRestricao = entrada.semRestricao === true;
  const observacao = texto(entrada.observacao).slice(0, 1000);
  const origemEntrada = registro(entrada.origem);
  const justificativasEntrada = registro(entrada.justificativas);
  const justificativas: Record<string, string> = {};
  for (const [itemId, valor] of Object.entries(justificativasEntrada)) {
    const t = texto(valor).slice(0, 500);
    if (t) justificativas[texto(itemId).slice(0, 80)] = t;
  }
  const inalterado = Boolean(prev.conferidoEm)
    && mesmaLista(grupos, listaTexto(prev.grupos, 50))
    && mesmaLista(alimentoIds, listaTexto(prev.alimentoIds, 200))
    && semRestricao === (prev.semRestricao === true)
    && observacao === texto(prev.observacao);
  return {
    // Conferência inalterada preserva autoria e data; qualquer mudança recebe carimbo novo.
    conferidoEm: inalterado ? String(prev.conferidoEm) : agora,
    conferidoPorId: inalterado ? texto(prev.conferidoPorId) : texto(autor.id),
    conferidoPorNome: inalterado ? texto(prev.conferidoPorNome) : texto(autor.name),
    origem: origemEntrada.descricao !== undefined || origemEntrada.avaliacaoId !== undefined
      ? { descricao: texto(origemEntrada.descricao).slice(0, 2000), avaliacaoId: texto(origemEntrada.avaliacaoId) || null, data: origemEntrada.data ?? null }
      : (prev.origem as RestricoesPlano['origem']) ?? null,
    semRestricao,
    grupos,
    alimentoIds,
    observacao,
    justificativas,
  };
}

export type ConflitoRestricao = { itemId: string; alimentoId: string; nome: string; motivo: 'alimento' | 'grupo'; justificativa: string | null };

// Itens do plano que colidem com restrição confirmada; justificativa curta demais conta como ausente.
export function conflitosDeRestricao(dados: Registro): ConflitoRestricao[] {
  const restricoes = registro(dados.restricoes);
  if (!restricoes.conferidoEm || restricoes.semRestricao === true) return [];
  const grupos = new Set(listaTexto(restricoes.grupos, 50));
  const alimentoIds = new Set(listaTexto(restricoes.alimentoIds, 200));
  if (!grupos.size && !alimentoIds.size) return [];
  const catalogo = registro(dados.catalogo);
  const justificativas = registro(restricoes.justificativas);
  const conflitos: ConflitoRestricao[] = [];
  const registrar = (referencia: Registro, chave: string) => {
    const alimentoId = texto(referencia.alimentoId);
    const alimento = registro(catalogo[alimentoId]);
    const motivo: ConflitoRestricao['motivo'] | null = alimentoIds.has(alimentoId) ? 'alimento'
      : grupos.has(texto(alimento.grupo)) ? 'grupo' : null;
    if (!motivo) return;
    const justificativa = texto(justificativas[chave]);
    conflitos.push({ itemId: chave, alimentoId, nome: texto(alimento.nome) || alimentoId,
      motivo, justificativa: justificativa.length >= 5 ? justificativa : null });
  };
  for (const refeicao of Array.isArray(dados.refeicoes) ? dados.refeicoes : []) {
    for (const item of Array.isArray(registro(refeicao).itens) ? registro(refeicao).itens as unknown[] : []) {
      const it = registro(item);
      registrar(it, texto(it.id));
      for (const substitute of Array.isArray(it.substitutos) ? it.substitutos : []) {
        const sub = registro(substitute);
        registrar(sub, `${texto(it.id)}:${texto(sub.alimentoId)}`);
      }
    }
  }
  return conflitos;
}

export function conflitosSemJustificativa(dados: Registro) {
  return conflitosDeRestricao(dados).filter((conflito) => !conflito.justificativa);
}
