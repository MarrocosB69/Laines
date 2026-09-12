import React from 'react';
import { GripVertical, Repeat, X } from 'lucide-react';
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
  valores,
  ancora,
  aberto,
  opcoes,
  sugestoes,
  motivo,
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
  onBuscarSubstituto,
  onEscolherSubstituto,
  onExcluirItem,
  onSalvarBloco,
  onAplicarBloco
}) {
  return (
    <>
      <tr className="border-b border-stone-200 text-xs">
        <td className="py-1.5 pr-1 align-middle">
          <GripVertical className="w-3.5 h-3.5 text-stone-300" aria-hidden="true" />
        </td>

        {/* A única coluna que encolhe. min-w-0 permite que ela ceda; as demais
            têm whitespace-nowrap e ficam intactas. */}
        <td className="py-1.5 pr-3 align-middle min-w-0">
          <span className="text-stone-800">{item.nome}</span>
          <Selo fonte={item.fonte} />
          {opcoes.length > 0 && (
            <span className="ml-1.5 whitespace-nowrap text-stone-400">
              {opcoes.length} {opcoes.length === 1 ? 'opção' : 'opções'}
            </span>
          )}
        </td>

        {metodo !== 'alimentos' ? (
          /* Nos outros metodos o paciente nao recebe grama: recebe porcao de
             equivalencia, ou so o grupo. Uma celula so, atravessando as
             colunas numericas. */
          <td colSpan={6} className="py-1.5 pr-2 align-middle text-right text-stone-600">
            {metodo === 'equivalentes'
              ? (porcoes === null
                ? <span className="text-stone-400">sem equivalência</span>
                : `${fmtQtd(porcoes)} ${porcoes === 1 ? 'porção' : 'porções'} de ${(item.grupo || '').toLowerCase()}`)
              : <span className="text-stone-400">{item.grupo || 'sem grupo'}</span>}
          </td>
        ) : (
        <>
        <td className="py-1.5 pr-2 align-middle text-right">
          <input
            type="number"
            min="0"
            step="0.5"
            value={item.quantidade}
            onChange={(e) => onQuantidade(item.id, Number(e.target.value))}
            aria-label={`Quantidade de ${item.nome}`}
            className="pp-largura-num rounded border border-stone-200 px-1 py-0.5 text-right text-xs"
          />
        </td>

        <td className="py-1.5 pr-3 align-middle whitespace-nowrap text-stone-500">
          {item.medida.descricao} · {n(valores.gramas)} g
        </td>

        <td className="py-1.5 pr-2 align-middle whitespace-nowrap text-right text-stone-800">
          {n(valores.kcal)}
        </td>
        <td className="py-1.5 pr-2 align-middle whitespace-nowrap text-right text-stone-500">
          {n(valores.cho)}
        </td>
        <td className="py-1.5 pr-2 align-middle whitespace-nowrap text-right text-stone-500">
          {n(valores.ptn)}
        </td>
        <td className="py-1.5 pr-2 align-middle whitespace-nowrap text-right text-stone-500">
          {n(valores.lip)}
        </td>
        </>
        )}

        <td className="py-1.5 align-middle">
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => onAlternar(item.id)}
              aria-expanded={aberto}
              aria-label={`Opções de substituição de ${item.nome}`}
              className={`${aberto ? 'text-stone-900' : 'text-stone-400'} hover:text-stone-700`}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
            {/* Ate aqui nao havia como tirar um alimento da refeicao: so
                dava para zerar a quantidade, o que deixa a linha morta. */}
            {onExcluirItem && (
              <button
                type="button"
                onClick={() => onExcluirItem(item.id)}
                aria-label={`Remover ${item.nome} da refeição`}
                className="pp-excluir text-stone-300 hover:text-red-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>

      {aberto && (
        <tr>
          <td colSpan={colunas} className="p-0">
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
              onBuscarSubstituto={onBuscarSubstituto}
              onEscolherSubstituto={onEscolherSubstituto}
              onSalvarBloco={onSalvarBloco}
              onAplicarBloco={onAplicarBloco}
            />
          </td>
        </tr>
      )}
    </>
  );
}
