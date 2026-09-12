/**
 * Estado do paciente, calculado uma vez.
 *
 * Seis arquivos calculavam "pendência" por conta própria — daí a tela dizer
 * 16 no selo da aba, 16 na faixa de indicadores e 9 no título do painel, para
 * a mesma pergunta. Aqui o cálculo acontece uma vez e todo painel lê daqui.
 *
 * Puro de propósito: sem React, sem rede, sem data do sistema como entrada
 * implícita — o "agora" é parâmetro, para o teste poder fixá-lo.
 */

/** Avaliações que o backend exige antes de considerar o caso encaminhado. */
export const OBRIGATORIAS = ['anamnese_inicial', 'perimetros', 'avaliacao_clinica'];

/** Abaixo disto uma avaliação em andamento vira pendência declarada. */
const COMPLETUDE_MINIMA = 80;

const texto = (v) => String(v ?? '').trim().toLowerCase();

/**
 * Estados que significam "o registro está fechado".
 *
 * `concluida` existe em registros antigos e o backend nunca o emite — ele só
 * conhece `rascunho` e `finalizada`. Enquanto a origem desse dado não for
 * decidida, tratá-lo como fechado num lugar só é o que impede a mesma
 * avaliação de aparecer pendente numa aba e pronta em outra.
 */
const FECHADOS = new Set(['finalizada', 'concluida', 'realizada']);

export const estaFechada = (avaliacao) => FECHADOS.has(texto(avaliacao?.status));

/** Completude declarada pela avaliação, ou null quando não há. */
export function completudeDe(avaliacao) {
  const bruta = avaliacao?.meta?.completude ?? avaliacao?.completude;
  const n = Number(bruta);
  return Number.isFinite(n) ? n : null;
}

/**
 * Preenchida por inteiro e ainda aberta.
 *
 * É o caso que fazia a tela pedir "Completar" para algo completo: nada no
 * fluxo move a avaliação de rascunho para finalizada quando ela chega a 100%.
 */
export const prontaParaFinalizar = (avaliacao) => (
  !estaFechada(avaliacao) && completudeDe(avaliacao) >= 100
);

const porTipo = (avaliacoes) => avaliacoes.reduce((acc, a) => {
  const t = texto(a?.tipo);
  if (!t) return acc;
  (acc[t] ||= []).push(a);
  return acc;
}, {});

const paraData = (valor) => {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Pendências do prontuário, em ordem de gravidade.
 *
 * A ordem importa: o que está pronto para fechar vem primeiro, porque é o
 * item mais barato de resolver e o que mais distorce a contagem.
 */
export function pendenciasDo({ avaliacoes = [], agendamentos = [], rotuloDoTipo = (t) => t, agora = new Date() }) {
  const itens = [];
  const agrupadas = porTipo(avaliacoes);

  // 1. Prontas para finalizar — completas, esperando só o fechamento.
  avaliacoes.filter(prontaParaFinalizar).forEach((a) => {
    itens.push({
      id: `finalizar-${a.id}`,
      genero: 'pronta_para_finalizar',
      severidade: 'pronta',
      tipo: texto(a.tipo),
      avaliacaoId: a.id,
      mensagem: `${rotuloDoTipo(a.tipo)} pronta para finalizar`,
      detalhe: '100% preenchida',
      acao: 'Finalizar'
    });
  });

  const tiposFechados = new Set(avaliacoes.filter(estaFechada).map((a) => texto(a.tipo)));

  // 2. Obrigatórias que ainda não fecharam.
  OBRIGATORIAS.forEach((tipo) => {
    if (tiposFechados.has(tipo)) return;
    const aberta = (agrupadas[tipo] || []).find((a) => !estaFechada(a));

    if (!aberta) {
      itens.push({
        id: `ausente-${tipo}`,
        genero: 'avaliacao_ausente',
        severidade: 'alta',
        tipo,
        mensagem: `${rotuloDoTipo(tipo)} — sem registro`,
        detalhe: 'nenhum registro criado',
        acao: 'Iniciar'
      });
      return;
    }

    // Já contada acima como pronta para finalizar; não duplica.
    if (prontaParaFinalizar(aberta)) return;

    const c = completudeDe(aberta);
    itens.push({
      id: `incompleta-${aberta.id}`,
      genero: 'avaliacao_incompleta',
      severidade: 'alta',
      tipo,
      avaliacaoId: aberta.id,
      mensagem: `${rotuloDoTipo(tipo)} incompleta`,
      detalhe: c === null ? 'sem completude registrada' : `${Math.round(c)}%`,
      acao: 'Completar'
    });
  });

  // 3. Demais avaliações abertas e pouco preenchidas.
  avaliacoes.forEach((a) => {
    const tipo = texto(a.tipo);
    if (OBRIGATORIAS.includes(tipo)) return;
    if (estaFechada(a) || prontaParaFinalizar(a)) return;
    const c = completudeDe(a);
    if (c !== null && c >= COMPLETUDE_MINIMA) return;
    itens.push({
      id: `incompleta-${a.id}`,
      genero: 'avaliacao_incompleta',
      severidade: 'media',
      tipo,
      avaliacaoId: a.id,
      mensagem: `${rotuloDoTipo(tipo)} incompleta`,
      detalhe: c === null ? 'sem completude registrada' : `${Math.round(c)}%`,
      acao: 'Completar'
    });
  });

  // 4. Continuidade do acompanhamento.
  const futuras = agendamentos.filter((ag) => {
    const d = paraData(ag?.scheduledDate ?? ag?.data ?? ag?.dataHora);
    return d && d.getTime() > agora.getTime() && texto(ag?.status) !== 'cancelada';
  });
  if (futuras.length === 0) {
    itens.push({
      id: 'sem-consulta-futura',
      genero: 'sem_agendamento',
      severidade: 'alta',
      mensagem: 'Nenhuma consulta futura agendada',
      detalhe: 'acompanhamento sem continuidade definida',
      acao: 'Agendar'
    });
  }

  const peso = { pronta: 0, alta: 1, media: 2 };
  return itens.sort((a, b) => (peso[a.severidade] ?? 3) - (peso[b.severidade] ?? 3));
}

/**
 * Divergências entre o que o atleta declarou e o que a equipe registrou.
 *
 * Não escolhe um lado: aponta que existem dois. Quem decide é quem atende.
 */
export function divergenciasDo({ paciente = {}, declarado = {} }) {
  const achados = [];

  const listou = (v) => Array.isArray(v) && v.filter(Boolean).length > 0;
  const negou = (v) => ['nao', 'não', 'nenhum', 'nenhuma', ''].includes(texto(v));

  const par = (chave, rotulo, doAtleta, doRegistro) => {
    if (listou(doRegistro) && negou(doAtleta)) {
      achados.push({
        id: chave,
        rotulo,
        declarado: 'Sem registro relatado',
        registrado: doRegistro.filter(Boolean).join(' · ')
      });
    }
  };

  par('comorbidades', 'Diagnósticos pessoais',
    declarado.diagnosticosPessoais ?? declarado.comorbidadesPessoais,
    paciente.comorbidadesPessoais);
  par('familiar', 'Histórico familiar',
    declarado.historicoFamiliar ?? declarado.comorbidadesFamiliares,
    paciente.comorbidadesFamiliares);

  return achados;
}

/**
 * O número que toda aba lê.
 *
 * Uma chamada, um objeto. Se um painel precisar de algo que não está aqui,
 * o lugar de acrescentar é aqui — não no painel.
 */
export function estadoDoProntuario({
  avaliacoes = [],
  agendamentos = [],
  paciente = {},
  declarado = {},
  rotuloDoTipo = (t) => t,
  agora = new Date()
} = {}) {
  const fechadas = avaliacoes.filter(estaFechada);
  const prontas = avaliacoes.filter(prontaParaFinalizar);
  const emAndamento = avaliacoes.filter((a) => !estaFechada(a) && !prontaParaFinalizar(a));

  const futuras = agendamentos.filter((ag) => {
    const d = paraData(ag?.scheduledDate ?? ag?.data ?? ag?.dataHora);
    return d && d.getTime() > agora.getTime() && texto(ag?.status) !== 'cancelada';
  });

  const pendencias = pendenciasDo({ avaliacoes, agendamentos, rotuloDoTipo, agora });

  return {
    avaliacoes: {
      total: avaliacoes.length,
      finalizadas: fechadas.length,
      prontasParaFinalizar: prontas.length,
      emAndamento: emAndamento.length,
      // Registro criado que nunca recebeu dado — conta como esforço, não
      // como informação disponível.
      semResultado: avaliacoes.filter((a) => {
        const r = a?.resultados;
        return !r || Object.keys(r).length === 0;
      }).length
    },
    consultas: {
      total: agendamentos.length,
      futuras: futuras.length
    },
    pendencias,
    divergencias: divergenciasDo({ paciente, declarado }),
    listaProntas: prontas
  };
}
