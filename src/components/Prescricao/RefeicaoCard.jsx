import React, { useState } from 'react';
import { GripVertical, Plus, ChevronDown, ChevronRight, Copy, Pencil, X } from 'lucide-react';
import { ANCORAS, rotuloAncora } from '../../core/prescricao/horarios.js';
import AlimentoLinha from './AlimentoLinha.jsx';
import Etiqueta from './Etiqueta.jsx';
import { n } from './formato.js';

const COLUNAS = 9;

/** Apresentacional: totais e dados de cada linha chegam prontos. */
export default function RefeicaoCard({
  refeicao,
  itens,
  totais,
  ancoraPorItem,
  valoresPorItem,
  opcoesPorItem,
  sugestoesPorItem,
  abertos,
  blocoPorAlimentoId,
  horario,
  metodo = 'alimentos',
  porcoesPorItem = {},
  onToggle,
  onAdicionarAlimento,
  onEditarRefeicao,
  onDuplicarRefeicao,
  onExcluirRefeicao,
  ...handlers
}) {
  const [editando, setEditando] = useState(false);
  const { igPonderado, cargaGlicemica, choDisponivel: disp } = totais;
  const valorAncora = refeicao.ancora ? `${refeicao.ancora.ref}:${refeicao.ancora.min}` : '';

  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        {editando ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`nome-${refeicao.id}`}>Nome da refeição</label>
            <input
              id={`nome-${refeicao.id}`}
              value={refeicao.nome}
              onChange={(e) => onEditarRefeicao(refeicao.id, { nome: e.target.value })}
              className="pp-largura-nome rounded border border-stone-200 text-sm"
            />
            <label className="sr-only" htmlFor={`ancora-${refeicao.id}`}>Ancoragem</label>
            <select
              id={`ancora-${refeicao.id}`}
              value={valorAncora}
              onChange={(e) => {
                if (!e.target.value) {
                  // Voltar para horario fixo preserva a hora que estava valendo,
                  // em vez de zerar e obrigar a redigitar.
                  onEditarRefeicao(refeicao.id, {
                    ancora: null, etiqueta: null, horarioFixo: horario || '12:00'
                  });
                } else {
                  const [ref, min] = e.target.value.split(':');
                  onEditarRefeicao(refeicao.id, {
                    ancora: { ref, min: Number(min) }, etiqueta: 'peri-treino', horarioFixo: null
                  });
                }
              }}
              className="rounded border border-stone-200 text-xs"
            >
              {ANCORAS.map((a2) => (
                <option key={a2.valor} value={a2.valor}>{a2.rotulo}</option>
              ))}
            </select>
            {!refeicao.ancora && (
              <>
                <label className="sr-only" htmlFor={`hora-${refeicao.id}`}>Horário</label>
                <input
                  id={`hora-${refeicao.id}`}
                  type="time"
                  value={refeicao.horarioFixo || '12:00'}
                  onChange={(e) => e.target.value && onEditarRefeicao(refeicao.id, { horarioFixo: e.target.value })}
                  className="rounded border border-stone-200 text-xs"
                />
              </>
            )}
            <button type="button" onClick={() => setEditando(false)} className="text-xs text-stone-700 hover:text-stone-900">
              pronto
            </button>
            <button
              type="button"
              onClick={() => onExcluirRefeicao(refeicao.id)}
              className="pp-excluir text-xs text-stone-400 hover:text-red-600"
            >
              excluir refeição
            </button>
          </div>
        ) : (
        <button
          type="button"
          onClick={() => onToggle(refeicao.id)}
          aria-expanded={refeicao.aberta}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          <GripVertical className="w-4 h-4 shrink-0 text-stone-300" aria-hidden="true" />
          {/* O horario vem calculado: refeicao ancorada segue o treino. */}
          <span className="text-sm text-stone-900">{refeicao.nome}</span>
          {horario && <span className="text-xs text-stone-500">{horario}</span>}
          {refeicao.ancora && (
            <span className="text-xs text-stone-400">{rotuloAncora(refeicao.ancora)}</span>
          )}
          {refeicao.etiqueta && <Etiqueta tom="atencao">{refeicao.etiqueta}</Etiqueta>}
        </button>
        )}
        <div className="flex shrink-0 items-center gap-2 text-xs text-stone-500">
          <span className="whitespace-nowrap">{n(totais.kcal)} kcal</span>
          {!refeicao.aberta && (
            <span className="whitespace-nowrap rounded bg-stone-100 px-2 py-0.5">
              IG {n(igPonderado)} · CG {n(cargaGlicemica)}
            </span>
          )}
          <button
            type="button"
            onClick={() => setEditando((v) => !v)}
            aria-label={`Editar ${refeicao.nome}`}
            aria-pressed={editando}
            className="text-stone-400 hover:text-stone-700"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDuplicarRefeicao(refeicao.id)}
            aria-label={`Duplicar ${refeicao.nome}`}
            className="text-stone-400 hover:text-stone-700"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onToggle(refeicao.id)}
            aria-label={refeicao.aberta ? `Fechar ${refeicao.nome}` : `Abrir ${refeicao.nome}`}
            className="text-stone-400 hover:text-stone-700"
          >
            {refeicao.aberta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {refeicao.aberta && (
        <>
          {itens.length === 0 ? (
            /* Cabecalho de tabela sem nenhuma linha nao informa nada e ainda
               parece defeito. Sem alimento, a refeicao pede o proximo passo. */
            <div className="pp-vazio">
              <p className="pp-vazio__titulo">Nenhum alimento nesta refeição</p>
              <p className="pp-vazio__dica">
                Busque pelo nome — os totais, a adequação e as opções de
                substituição aparecem conforme você monta.
              </p>
            </div>
          ) : (
          /* table-fixed seria mais previsivel, mas impede a coluna do nome de
             ceder por ultimo: aqui a largura vem das regras de cada celula. */
          <table className="mt-2 w-full border-collapse text-xs">
            <caption className="sr-only">
              Alimentos de {refeicao.nome}{horario ? ` às ${horario}` : ''}
            </caption>
            <thead>
              <tr className="border-b border-stone-200 text-stone-400">
                <th scope="col" className="w-6 pb-1">
                  <span className="sr-only">Reordenar</span>
                </th>
                <th scope="col" className="pb-1 text-left font-normal">Alimento</th>
                {metodo === 'alimentos' ? (
                  <>
                    <th scope="col" className="w-20 pb-1 pr-2 text-right font-normal">Qtd</th>
                    <th scope="col" className="pb-1 text-left font-normal whitespace-nowrap">
                      Medida caseira
                    </th>
                    <th scope="col" className="w-12 pb-1 text-right font-normal">kcal</th>
                    <th scope="col" className="w-8 pb-1 text-right font-normal">C</th>
                    <th scope="col" className="w-8 pb-1 text-right font-normal">P</th>
                    <th scope="col" className="w-8 pb-1 text-right font-normal">L</th>
                  </>
                ) : (
                  <th scope="col" colSpan={6} className="pb-1 text-right font-normal">
                    {metodo === 'equivalentes' ? 'Equivalentes' : 'Grupo'}
                  </th>
                )}
                <th scope="col" className="w-8 pb-1">
                  <span className="sr-only">Trocar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <AlimentoLinha
                  key={item.id}
                  item={item}
                  valores={valoresPorItem[item.id]}
                  ancora={ancoraPorItem[item.id]}
                  aberto={abertos.has(item.id)}
                  opcoes={opcoesPorItem[item.id] ?? []}
                  sugestoes={sugestoesPorItem[item.id]?.candidatos ?? []}
                  motivo={sugestoesPorItem[item.id]?.motivo ?? null}
                  blocoSalvo={blocoPorAlimentoId[item.alimentoId]}
                  colunas={COLUNAS}
                  metodo={metodo}
                  porcoes={porcoesPorItem[item.id] ?? null}
                  {...handlers}
                />
              ))}
            </tbody>
          </table>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={onAdicionarAlimento}
              className="flex items-center gap-1.5 whitespace-nowrap text-xs text-stone-500 hover:text-stone-800"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar alimento
            </button>
            <div className="flex flex-wrap gap-1.5">
              {itens.length > 0 && (
                <>
              <Etiqueta tom={igPonderado !== null && igPonderado <= 55 ? 'ok' : 'neutro'}>
                IG {n(igPonderado)}
              </Etiqueta>
              <Etiqueta tom={cargaGlicemica !== null && cargaGlicemica >= 20 ? 'atencao' : 'neutro'}>
                CG {n(cargaGlicemica)}
              </Etiqueta>
              <Etiqueta>{n(disp)} g CHO disp.</Etiqueta>
                </>
              )}
            </div>
          </div>

          {/* A orientacao acompanha a refeicao no PDF do paciente: e onde cabe
              "prepare no domingo e congele em porcoes". */}
          <label className="sr-only" htmlFor={`orient-${refeicao.id}`}>
            Orientação de {refeicao.nome}
          </label>
          <input
            id={`orient-${refeicao.id}`}
            value={refeicao.orientacao ?? ''}
            onChange={(e) => onEditarRefeicao(refeicao.id, { orientacao: e.target.value })}
            placeholder="Orientação para o paciente"
            className="pp-orientacao mt-2 w-full border-t border-stone-200 text-xs"
          />
        </>
      )}
    </div>
  );
}
