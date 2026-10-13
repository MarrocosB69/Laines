// Funções puras da base das avaliações. Ficam fora dos .jsx porque o
// fast-refresh exige que um arquivo com componente exporte só componentes.
// Contrato: docs/implementacao/avaliacoes-v2/contrato-avaliacao.md.

export const classes = (...lista) => lista.filter(Boolean).join(' ');

// Ausência não vira zero: null, undefined, texto vazio e número não finito
// são "sem valor". O zero é um valor.
export const valorAusente = (valor) => {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === 'number') return !Number.isFinite(valor);
  if (typeof valor === 'string') return valor.trim() === '';
  return false;
};

// Os formulários usam vocabulários próprios de tom (ok, warn, risk,
// neutral...). A base só conhece quatro; o que não se reconhece é neutro.
const TONS = {
  neutro: 'neutro', neutral: 'neutro', info: 'neutro', informativo: 'neutro',
  positivo: 'positivo', ok: 'positivo', success: 'positivo', sucesso: 'positivo', good: 'positivo', bom: 'positivo',
  atencao: 'atencao', warn: 'atencao', warning: 'atencao', attention: 'atencao', moderate: 'atencao',
  perigo: 'perigo', danger: 'perigo', risk: 'perigo', critical: 'perigo', critico: 'perigo', error: 'perigo'
};

export const normalizarTom = (tom) => TONS[String(tom || '').trim().toLowerCase()] || 'neutro';

// Id do título de uma AvaliacaoSecao: `${id}-titulo`. Serve para rotular por
// aria-labelledby um grupo, uma tabela ou uma região com o título que a
// seção já mostra, sem escrever o sufixo à mão.
export const idTituloSecao = (idSecao) => `${idSecao}-titulo`;

// Texto da dica "?": uma linha, uma lista de linhas ou { texto, rotulo }.
// Linhas vazias saem (a dica de Dobras já as tirava); sem nenhuma linha, não
// há dica, e o botão não aparece. `rotulo` é o nome do botão.
export const ROTULO_DICA_PADRAO = 'Mais informações';

const linhaVazia = (linha) => linha === null || linha === undefined || linha === false
  || (typeof linha === 'string' && linha.trim() === '');

export function normalizarDica(dica) {
  if (dica === null || dica === undefined || dica === false) return null;
  const objeto = typeof dica === 'object' && !Array.isArray(dica) && !('$$typeof' in dica) ? dica : { texto: dica };
  const bruto = Array.isArray(objeto.texto) ? objeto.texto : [objeto.texto];
  const linhas = bruto.filter((linha) => !linhaVazia(linha));
  if (linhas.length === 0) return null;
  const rotulo = typeof objeto.rotulo === 'string' && objeto.rotulo.trim() ? objeto.rotulo : ROTULO_DICA_PADRAO;
  return { linhas, rotulo };
}

// Teclas na dica. Esc fecha a dica aberta. Enter e espaço são do próprio
// botão: não sobem para um ancestral que também responde a elas (a linha
// clicável da tabela de TMB de Perímetros).
export function efeitoDaTeclaNaDica(tecla, aberta) {
  if ((tecla === 'Escape' || tecla === 'Esc') && aberta) return 'fechar';
  if (tecla === 'Enter' || tecla === ' ' || tecla === 'Spacebar') return 'isolar';
  return null;
}

// Variação em relação ao anterior. O formulário escreve o texto com o sinal
// (formatSigned); a base só lê o sinal para escolher o tom. Zero é estável.
export function sentidoDaVariacao(texto) {
  if (typeof texto !== 'string') return null;
  const t = texto.trim();
  if (/^[+\-−]?\s*0+(?:[.,]0+)?(?![\d.,])/.test(t)) return 'estavel';
  if (t.startsWith('+')) return 'alta';
  if (t.startsWith('−') || t.startsWith('-')) return 'queda';
  return null;
}

// A regra de ValorAnterior: o tom só existe quando o formulário diz qual
// direção é desejável (`melhorQuando`). Sem isso, pintar um aumento de
// verde seria adivinhar o sentido clínico (o % de gordura, por exemplo).
export function tomDaVariacao(texto, melhorQuando) {
  if (melhorQuando !== 'maior' && melhorQuando !== 'menor') return 'neutro';
  const sentido = sentidoDaVariacao(texto);
  if (sentido !== 'alta' && sentido !== 'queda') return 'neutro';
  const bom = melhorQuando === 'menor' ? sentido === 'queda' : sentido === 'alta';
  return bom ? 'positivo' : 'atencao';
}

// Texto só para leitor de tela nas peças que também aparecem fora de
// `.av-modulo` (ValorAnterior, EvaluationReadiness): lá a classe .av-sr
// não existe, então o estilo vai em linha.
export const ESTILO_SO_LEITOR = Object.freeze({
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0
});
