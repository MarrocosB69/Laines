import React from 'react';
import { n, qtd } from './formato.js';

/** Conferência de conteúdo antes da transição; o servidor continua decidindo. */
export default function ConferenciaPlano({ pacienteNome, acao, refeicoes, totaisPorId,
  itensPorRefeicao, opcoesPorItem, valoresPorItem, horarioDeRefeicao, macros,
  bloqueioQuantidade, bloqueioRevisao, salvando, onCancelar, onConfirmar,
  onCorrigirQuantidade, onCorrigirRestricoes }) {
  const totalItens = refeicoes.reduce((total, r) => total + (itensPorRefeicao[r.id]?.length || 0), 0);
  const incompletos = totalItens === 0 ? [] : macros.filter((linha) => linha.cobertura < 1 &&
    ['kcal', 'cho', 'ptn', 'lip'].includes(linha.nutriente));
  const rotuloAcao = acao === 'enviar' ? 'Enviar para revisão'
    : acao === 'ativar' ? 'Ativar plano' : 'Aprovar revisão';
  const bloqueado = Boolean(bloqueioQuantidade || (acao === 'enviar' && bloqueioRevisao));
  const energiaDaRefeicao = (refeicao) => {
    const itens = itensPorRefeicao[refeicao.id] || [];
    if (itens.length && itens.every((item) => item.comp?.kcal == null)) return '— kcal';
    return `${n(totaisPorId[refeicao.id]?.kcal)} kcal${itens.some((item) => item.comp?.kcal == null) ? ' · subtotal' : ''}`;
  };

  return (
    <section className="pp-conferencia" aria-labelledby="pp-conferencia-titulo">
      <div className="pp-conferencia__cabeca">
        <div>
          <h3 id="pp-conferencia-titulo" tabIndex={-1}>Conferir antes de {acao === 'ativar' ? 'ativar' : acao === 'enviar' ? 'enviar' : 'aprovar'}</h3>
          <p>{pacienteNome} · {refeicoes.length} {refeicoes.length === 1 ? 'refeição' : 'refeições'} · {totalItens} {totalItens === 1 ? 'alimento principal' : 'alimentos principais'}</p>
        </div>
        <button type="button" onClick={onCancelar} className="pp-botao pp-botao--secundario">Voltar à edição</button>
      </div>
      {incompletos.length > 0 && (
        <p className="pp-nota pp-nota--atencao" role="status">
          Composição incompleta em {incompletos.map((linha) => linha.rotulo.toLowerCase()).join(', ')}.
          Os valores exibidos são subtotais dos alimentos com dados disponíveis; confira a cobertura na adequação nutricional.
        </p>
      )}
      {bloqueioQuantidade && <p className="pp-conferencia__pendencia">{bloqueioQuantidade} <button type="button" onClick={onCorrigirQuantidade} className="pp-botao pp-botao--link">Ir ao alimento</button></p>}
      {acao === 'enviar' && bloqueioRevisao && <p className="pp-conferencia__pendencia">{bloqueioRevisao} <button type="button" onClick={onCorrigirRestricoes} className="pp-botao pp-botao--link">Conferir restrições</button></p>}
      <ol className="pp-conferencia__refeicoes">
        {refeicoes.map((refeicao) => (
          <li key={refeicao.id} className="pp-conferencia__refeicao">
            <div className="pp-conferencia__refeicao-topo">
              <strong>{refeicao.nome} · {horarioDeRefeicao(refeicao) || 'sem horário'}</strong>
              <span>{energiaDaRefeicao(refeicao)}</span>
            </div>
            {(itensPorRefeicao[refeicao.id] || []).length === 0 && <p>Sem alimentos.</p>}
            <ul>
              {(itensPorRefeicao[refeicao.id] || []).map((item) => (
                <li key={item.id}>
                  <span>{item.nome} · {qtd(item.quantidade)} {item.medida?.descricao || 'g'}
                    {item.medida?.descricao && ` · ${n(valoresPorItem[item.id]?.gramas)} g`}</span>
                  {(opcoesPorItem[item.id] || []).map((opcao) => (
                    <small key={opcao.alimentoId}>ou {opcao.nome} · {opcao.pendenteQuantidade ? 'quantidade pendente' : `${qtd(opcao.quantidade)} ${opcao.medida?.descricao || 'g'}`}</small>
                  ))}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <div className="pp-conferencia__acoes">
        <span>As alternativas não entram no total. A versão salva será validada pelo servidor.</span>
        <button type="button" onClick={onConfirmar} disabled={salvando || bloqueado}
          className="pp-botao pp-botao--primario">{salvando ? 'Aguarde…' : rotuloAcao}</button>
      </div>
    </section>
  );
}
