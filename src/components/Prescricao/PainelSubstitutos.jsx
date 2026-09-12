import React, { useState } from 'react';
import { X, Plus, Search, Bookmark, BookmarkCheck } from 'lucide-react';
import Selo from './Selo.jsx';
import SeloEquivalencia from './SeloEquivalencia.jsx';
import DeltasMacro from './DeltasMacro.jsx';
import BuscaAlimento from './BuscaAlimento.jsx';
import { n } from './formato.js';

const ROTULO_ANCORA = {
  ptn: 'proteína',
  lip: 'lipídio',
  choDisponivel: 'carboidrato disponível'
};

const MOTIVO_TEXTO = {
  'sem-grupo': 'Alimento sem grupo de equivalência classificado.',
  'ancora-indisponivel': 'Sem dado suficiente para ancorar a equivalência.'
};

/**
 * Apresentacional: recebe opções e sugestões já calculadas.
 *
 * As opções são alternativas à linha prescrita e nunca somam ao total do dia
 * — por isso aparecem recuadas sob o item, com o "ou" à esquerda, e não como
 * mais uma linha da refeição.
 */
export default function PainelSubstitutos({
  base,
  ancora,
  opcoes,
  sugestoes,
  motivo,
  blocoSalvo,
  onAdicionar,
  onRemover,
  onQuantidadeSubstituto,
  onSalvarBloco,
  onAplicarBloco,
  busca,
  onBuscarSubstituto,
  onEscolherSubstituto
}) {
  const [buscando, setBuscando] = useState(false);

  return (
    <div className="mb-1 ml-6 rounded-lg bg-stone-50 px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs text-stone-500">
          Opções de substituição · âncora {ROTULO_ANCORA[ancora] ?? ancora}
        </span>
        <div className="flex gap-2">
          {blocoSalvo && (
            <button
              type="button"
              onClick={() => onAplicarBloco(base.id, blocoSalvo)}
              className="flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900"
            >
              <BookmarkCheck className="w-3.5 h-3.5" /> Aplicar “{blocoSalvo.nome}”
            </button>
          )}
          {/* As sugestoes so alcancam o mesmo grupo de equivalencia. Aqui o
              profissional escolhe qualquer alimento do catalogo — inclusive
              um sem equivalencia calculavel, que entra marcado como tal. */}
          {onEscolherSubstituto && (
            <button
              type="button"
              onClick={() => setBuscando((v) => !v)}
              aria-expanded={buscando}
              className="flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900"
            >
              <Search className="w-3.5 h-3.5" /> Escolher substituto
            </button>
          )}
          <button
            type="button"
            onClick={() => onSalvarBloco(base)}
            className="flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900"
          >
            <Bookmark className="w-3.5 h-3.5" /> Salvar alimento e substitutos
          </button>
        </div>
      </div>

      {buscando && onEscolherSubstituto && (
        <BuscaAlimento
          id={`busca-substituto-${base.id}`}
          termo={busca?.termo ?? ''}
          resultados={busca?.resultados ?? []}
          carregando={busca?.carregando ?? false}
          erro={busca?.erro ?? ''}
          onTermo={onBuscarSubstituto}
          onEscolher={(alimento) => { onEscolherSubstituto(base.id, alimento); setBuscando(false); }}
          onFechar={() => setBuscando(false)}
        />
      )}

      {opcoes.length === 0 && !buscando && (
        <p className="py-1 text-xs text-stone-400">Nenhuma opção prescrita ainda.</p>
      )}

      {opcoes.map((op) => (
        <div key={op.alimentoId} className="flex items-center gap-2 border-t border-stone-200 py-1 text-xs">
          <span className="w-3 text-stone-400">ou</span>
          <span className="min-w-0 flex-1 text-stone-800">
            {op.nome}
            <Selo fonte={op.fonte} />
          </span>
          {/* A quantidade da opcao prescrita e editavel: o profissional
              prescreve a substituicao em vez de so aceitar a equivalencia
              calculada. Digitar aqui trava a opcao em modo fixo, e o selo
              passa a mostrar o quanto ela de fato reproduz. */}
          <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-stone-600">
            <label className="sr-only" htmlFor={`qtd-${base.id}-${op.alimentoId}`}>
              Quantidade de {op.nome}
            </label>
            <input
              id={`qtd-${base.id}-${op.alimentoId}`}
              type="number"
              min="0"
              step="0.5"
              value={op.quantidade}
              onChange={(e) => onQuantidadeSubstituto(base.id, op.alimentoId, Number(e.target.value))}
              className="pp-largura-num rounded border border-stone-200 text-right"
            />
            <span>{op.medida.descricao || 'g'}</span>
            {op.medida.descricao && <span className="text-stone-400">· {n(op.gramas)} g</span>}
          </span>
          <SeloEquivalencia desvio={op.desvio} />
          {/* So faz sentido voltar ao automatico quando existe automatico:
              sem equivalencia calculavel, nao ha o que recalcular. */}
          {op.modo === 'fixa' && op.desvio !== null && (
            <button
              type="button"
              onClick={() => onQuantidadeSubstituto(base.id, op.alimentoId, null)}
              title="Voltar à quantidade equivalente calculada"
              className="pp-selo-equiv pp-selo-equiv--sem"
            >
              prescrita
            </button>
          )}
          <span className="shrink-0 whitespace-nowrap text-right"><DeltasMacro op={op} /></span>
          <button
            type="button"
            onClick={() => onRemover(base.id, op.alimentoId)}
            aria-label={`Remover ${op.nome} das opções`}
            className="text-stone-400 hover:text-stone-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <p className="mt-2 mb-1 text-xs text-stone-400">
        {MOTIVO_TEXTO[motivo] ?? 'Sugestões dentro de 10% após arredondar para medida caseira'}
      </p>

      {sugestoes.map((op) => (
        <div key={op.alimentoId} className="flex items-center gap-2 border-t border-stone-200 py-1 text-xs">
          <button
            type="button"
            onClick={() => onAdicionar(base.id, op)}
            aria-label={`Adicionar ${op.nome} como opção`}
            className="text-stone-400 hover:text-stone-900"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <span className="min-w-0 flex-1 text-stone-600">
            {op.nome}
            <Selo fonte={op.fonte} />
          </span>
          {/* Sem medida caseira a quantidade JA e a grama: repetir daria
              "73,5 · 74 g", que parece dois numeros diferentes. */}
          <span className="shrink-0 whitespace-nowrap text-stone-500">
            {op.medida.descricao
              ? `${n(op.quantidade, op.quantidade % 1 ? 1 : 0)} ${op.medida.descricao} · ${n(op.gramas)} g`
              : `${n(op.gramas)} g`}
          </span>
          <SeloEquivalencia desvio={op.desvio} />
          <span className="shrink-0 whitespace-nowrap text-right"><DeltasMacro op={op} /></span>
          <span className="w-3.5" />
        </div>
      ))}
    </div>
  );
}
