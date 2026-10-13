import React from 'react';
import { Repeat, X } from 'lucide-react';
import Selo from './Selo.jsx';
import PainelSubstitutos from './PainelSubstitutos.jsx';
import { n, qtd as fmtQtd } from './formato.js';

/**
 * Apresentacional: nada aqui calcula.
 *
 * `valores`, `opcoes` e `sugestoes` chegam prontos do container, e o estado de
 * aberto/fechado vive lá também — antes cada linha guardava o próprio
 * `useState` e chamava o núcleo, o que espalhava o cálculo pela árvore.
 *
 * Sobre larguras: a medida caseira e o contador de opções nunca encolhem.
 * Quem cede espaço é o nome do alimento, e só ele — "colher de servir · 50 g"
 * cortado em "colher de servir · 50…" perde justamente a informação que o
 * profissional usa para prescrever.
 */
export default function AlimentoLinha({
  item,
  ordem,
  valores,
  ancora,
  aberto,
  opcoes,
  sugestoes,
  motivo,
  restrito = null,
  blocoSalvo,
  colunas,
  metodo = 'alimentos',
  porcoes = null,
  onAlternar,
  onQuantidade,
  onAdicionar,
  onRemover,
  onQuantidadeSubstituto,
  busca,
  buscaAtiva,
  onBuscarSubstituto,
  onEscolherSubstituto,
  onAlternarBuscaSubstituto,
  onFecharBusca,
  onExcluirItem,
  onSalvarBloco,
  onAplicarBloco
}) {
  return (
    <>
      <tr className="pp-item">
        <td className="pp-item__alca">
          {ordem}
        </td>

        {/* A única coluna que encolhe (quebra linha); as demais não quebram e
            ficam intactas — ver .pp-item__* no CSS. */}
        <td className="pp-item__nome">
          <span className="pp-item__alimento">{item.nome}</span>
          <Selo fonte={item.fonte} />
          {restrito && (
            <span
              className={`pp-restricao ${restrito.justificada ? 'pp-restricao--justificada' : 'pp-restricao--pendente'}`}
              title={restrito.motivo === 'alimento' ? 'Alimento marcado como restrição confirmada' : 'Grupo marcado como restrição confirmada'}
            >
              restrição{restrito.justificada ? ' · justificada' : ' · justificar'}
            </span>
          )}
          {opcoes.length > 0 && (
            <span className="pp-item__opcoes">
              {opcoes.length} {opcoes.length === 1 ? 'opção' : 'opções'}
            </span>
          )}
        </td>

        {metodo !== 'alimentos' ? (
          /* Visualizacao da edicao; a entrega conserva alimento e quantidade. */
          <td colSpan={6} className="pp-item__equivalencia">
            {metodo === 'equivalentes'
              ? (porcoes === null
                ? <span className="pp-item__apagado">sem equivalência</span>
                : `${fmtQtd(porcoes)} ${porcoes === 1 ? 'porção' : 'porções'} de ${(item.grupo || '').toLowerCase()}`)
              : <span className="pp-item__apagado">{item.grupo || 'sem grupo'}</span>}
          </td>
        ) : (
        <>
        <td className="pp-item__qtd">
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={item.quantidade ?? ''}
            onChange={(e) => onQuantidade(item.id, e.target.value === '' ? '' : Number(e.target.value))}
            aria-label={`Quantidade de ${item.nome}`}
            className="pp-controle pp-controle--num"
          />
        </td>

        <td className="pp-item__medida">
          {item.medida.descricao} · {n(valores.gramas)} g
        </td>

        {/* data-rotulo: quando a refeição fica estreita as linhas viram
            blocos, o cabeçalho sai de vista e cada número mostra o próprio
            rótulo (só visual; ver o CSS). */}
        <td className="pp-item__num pp-item__num--kcal" data-rotulo="kcal">
          {n(valores.kcal)}
        </td>
        <td className="pp-item__num pp-item__num--cho" data-rotulo="C">
          {n(valores.cho)}
        </td>
        <td className="pp-item__num pp-item__num--ptn" data-rotulo="P">
          {n(valores.ptn)}
        </td>
        <td className="pp-item__num pp-item__num--lip" data-rotulo="L">
          {n(valores.lip)}
        </td>
        </>
        )}

        <td className="pp-item__acoes">
          <div className="pp-item__botoes">
            <button
              type="button"
              onClick={() => onAlternar(item.id)}
              aria-expanded={aberto}
              aria-label={`Opções de substituição de ${item.nome}`}
              className={`pp-icone-botao${aberto ? ' pp-icone-botao--ativo' : ''}`}
            >
              <Repeat className="pp-icone" aria-hidden="true" />
            </button>
            {/* Ate aqui nao havia como tirar um alimento da refeicao: so
                dava para zerar a quantidade, o que deixa a linha morta. */}
            {onExcluirItem && (
              <button
                type="button"
                onClick={() => onExcluirItem(item.id)}
                aria-label={`Remover ${item.nome} da refeição`}
                className="pp-icone-botao pp-icone-botao--perigo"
              >
                <X className="pp-icone" aria-hidden="true" />
              </button>
            )}
          </div>
        </td>
      </tr>

      {aberto && (
        <tr className="pp-item-substitutos">
          <td colSpan={colunas} className="pp-item-substitutos__celula">
            <PainelSubstitutos
              base={item}
              ancora={ancora}
              opcoes={opcoes}
              sugestoes={sugestoes}
              motivo={motivo}
              blocoSalvo={blocoSalvo}
              onAdicionar={onAdicionar}
              onRemover={onRemover}
              onQuantidadeSubstituto={onQuantidadeSubstituto}
              busca={busca}
              buscaAtiva={buscaAtiva}
              onBuscarSubstituto={onBuscarSubstituto}
              onEscolherSubstituto={onEscolherSubstituto}
              onAlternarBuscaSubstituto={onAlternarBuscaSubstituto}
              onFecharBusca={onFecharBusca}
              onSalvarBloco={onSalvarBloco}
              onAplicarBloco={onAplicarBloco}
            />
          </td>
        </tr>
      )}
    </>
  );
}
