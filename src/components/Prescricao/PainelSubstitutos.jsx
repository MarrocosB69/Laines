import React, { useRef } from 'react';
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
  'ancora-indisponivel': 'Sem dado suficiente para ancorar a equivalência.',
  'restricoes-pendentes': 'Sugestões suspensas até a conferência das restrições do paciente.',
  'grupo-restrito': 'Grupo marcado como restrição confirmada; sem sugestões automáticas.'
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
  buscaAtiva,
  onBuscarSubstituto,
  onEscolherSubstituto,
  onAlternarBuscaSubstituto,
  onFecharBusca
}) {
  const botaoBuscaRef = useRef(null);
  const buscando = buscaAtiva === `substituto:${base.id}`;

  return (
    <div className="pp-substitutos">
      <div className="pp-substitutos__cabeca">
        <span className="pp-substitutos__titulo">
          Opções de substituição · âncora {ROTULO_ANCORA[ancora] ?? ancora}
        </span>
        <div className="pp-substitutos__acoes">
          {blocoSalvo && (
            <button
              type="button"
              onClick={() => onAplicarBloco(base.id, blocoSalvo)}
              className="pp-botao pp-botao--link"
            >
              <BookmarkCheck className="pp-icone" aria-hidden="true" /> Usar bloco desta edição: “{blocoSalvo.nome}”
            </button>
          )}
          {/* As sugestoes so alcancam o mesmo grupo de equivalencia. Aqui o
              profissional escolhe qualquer alimento do catalogo — inclusive
              um sem equivalencia calculavel, que entra marcado como tal. */}
          {onEscolherSubstituto && (
            <button
              type="button"
              ref={botaoBuscaRef}
              onClick={() => onAlternarBuscaSubstituto(base.id)}
              aria-expanded={buscando}
              className="pp-botao pp-botao--link"
            >
              <Search className="pp-icone" aria-hidden="true" /> Escolher substituto
            </button>
          )}
          <button
            type="button"
            onClick={() => onSalvarBloco(base)}
            className="pp-botao pp-botao--link"
          >
            <Bookmark className="pp-icone" aria-hidden="true" /> Guardar bloco nesta edição
          </button>
        </div>
      </div>

      {buscando && onEscolherSubstituto && (
        <BuscaAlimento
          id={`busca-substituto-${base.id}`}
          modo="substituto"
          termo={busca?.termo ?? ''}
          resultados={busca?.resultados ?? []}
          carregando={busca?.carregando ?? false}
          erro={busca?.erro ?? ''}
          onTermo={onBuscarSubstituto}
          onEscolher={(alimento, _quantidade, medidaIdx) => {
            onEscolherSubstituto(base.id, alimento, medidaIdx);
            botaoBuscaRef.current?.focus();
          }}
          onFechar={() => {
            onFecharBusca();
            botaoBuscaRef.current?.focus();
          }}
        />
      )}

      {opcoes.length === 0 && !buscando && (
        <p className="pp-substitutos__vazio">Nenhuma opção prescrita ainda.</p>
      )}

      {opcoes.map((op) => (
        <div key={op.alimentoId} className="pp-opcao">
          <span className="pp-opcao__ou">ou</span>
          <span className="pp-opcao__nome">
            {op.nome}
            <Selo fonte={op.fonte} />
          </span>
          {/* A quantidade da opcao prescrita e editavel: o profissional
              prescreve a substituicao em vez de so aceitar a equivalencia
              calculada. Digitar aqui trava a opcao em modo fixo, e o selo
              passa a mostrar o quanto ela de fato reproduz. */}
          <span className="pp-opcao__qtd">
            <label className="pp-sr" htmlFor={`qtd-${base.id}-${op.alimentoId}`}>
              Quantidade de {op.nome}
            </label>
            <input
              id={`qtd-${base.id}-${op.alimentoId}`}
              type="number"
              min="0.5"
              step="0.5"
              value={op.quantidade ?? ''}
              onChange={(e) => onQuantidadeSubstituto(base.id, op.alimentoId,
                e.target.value === '' ? '' : Number(e.target.value))}
              className="pp-controle pp-controle--num"
            />
            <span>{op.medida.descricao || 'g'}</span>
            {op.medida.descricao && <span className="pp-opcao__gramas">· {n(op.gramas)} g</span>}
          </span>
          {op.pendenteQuantidade && <span role="status" className="pp-substitutos__motivo">Informe a quantidade desta opção antes de salvar.</span>}
          <SeloEquivalencia desvio={op.desvio} />
          {/* So faz sentido voltar ao automatico quando existe automatico:
              sem equivalencia calculavel, nao ha o que recalcular. */}
          {op.modo === 'fixa' && op.desvio !== null && (
            <button
              type="button"
              onClick={() => onQuantidadeSubstituto(base.id, op.alimentoId, null)}
              title="Voltar à quantidade equivalente calculada"
              className="pp-selo-equiv pp-selo-equiv--sem pp-selo-equiv--botao"
            >
              prescrita
            </button>
          )}
          <span className="pp-opcao__deltas"><DeltasMacro op={op} /></span>
          <button
            type="button"
            onClick={() => onRemover(base.id, op.alimentoId)}
            aria-label={`Remover ${op.nome} das opções`}
            className="pp-icone-botao pp-icone-botao--perigo"
          >
            <X className="pp-icone" aria-hidden="true" />
          </button>
        </div>
      ))}

      <p className="pp-substitutos__motivo">
        {MOTIVO_TEXTO[motivo] ?? 'Sugestões dentro de 10% após arredondar para medida caseira'}
      </p>

      {sugestoes.map((op) => (
        <div key={op.alimentoId} className="pp-opcao pp-opcao--sugestao">
          <button
            type="button"
            onClick={() => onAdicionar(base.id, op)}
            aria-label={`Adicionar ${op.nome} como opção`}
            className="pp-icone-botao pp-icone-botao--adicionar"
          >
            <Plus className="pp-icone" aria-hidden="true" />
          </button>
          <span className="pp-opcao__nome">
            {op.nome}
            <Selo fonte={op.fonte} />
          </span>
          {/* Sem medida caseira a quantidade JA e a grama: repetir daria
              "73,5 · 74 g", que parece dois numeros diferentes. */}
          <span className="pp-opcao__medida">
            {op.medida.descricao
              ? `${n(op.quantidade, op.quantidade % 1 ? 1 : 0)} ${op.medida.descricao} · ${n(op.gramas)} g`
              : `${n(op.gramas)} g`}
          </span>
          <SeloEquivalencia desvio={op.desvio} />
          <span className="pp-opcao__deltas"><DeltasMacro op={op} /></span>
          <span className="pp-opcao__espaco" />
        </div>
      ))}
    </div>
  );
}
