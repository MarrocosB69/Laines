import React, { useRef, useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Copy, Pencil } from 'lucide-react';
import { ANCORAS, rotuloAncora } from '../../core/prescricao/horarios.js';
import AlimentoLinha from './AlimentoLinha.jsx';
import BuscaAlimento from './BuscaAlimento.jsx';
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
  restritosPorItem = {},
  abertos,
  blocoPorAlimentoId,
  horario,
  metodo = 'alimentos',
  porcoesPorItem = {},
  onToggle,
  onAdicionarAlimento,
  buscaAberta = false,
  buscaAlimento,
  onBuscarAlimento,
  onEscolherAlimento,
  onFecharBusca,
  onEditarRefeicao,
  onDuplicarRefeicao,
  onExcluirRefeicao,
  ...handlers
}) {
  const [editando, setEditando] = useState(false);
  const botaoAdicionarRef = useRef(null);
  const { igPonderado, cargaGlicemica, choDisponivel: disp } = totais;
  const semEnergia = itens.length > 0 && itens.every((item) => item.comp?.kcal == null);
  const energiaParcial = itens.some((item) => item.comp?.kcal == null);
  const valorAncora = refeicao.ancora ? `${refeicao.ancora.ref}:${refeicao.ancora.min}` : '';

  return (
    <div className="pp-refeicao">
      <div className="pp-refeicao__cabeca">
        {editando ? (
          <div className="pp-refeicao__edicao">
            <div className="pp-campo pp-campo--nome">
              <label className="pp-rotulo" htmlFor={`nome-${refeicao.id}`}>Nome da refeição</label>
              <input
                id={`nome-${refeicao.id}`}
                value={refeicao.nome}
                onChange={(e) => onEditarRefeicao(refeicao.id, { nome: e.target.value })}
                className="pp-controle"
              />
            </div>
            <div className="pp-campo">
              <label className="pp-rotulo" htmlFor={`ancora-${refeicao.id}`}>Ancoragem</label>
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
                className="pp-controle"
              >
                {ANCORAS.map((a2) => (
                  <option key={a2.valor} value={a2.valor}>{a2.rotulo}</option>
                ))}
              </select>
            </div>
            {!refeicao.ancora && (
              <>
                <div className="pp-campo">
                  <label className="pp-rotulo" htmlFor={`hora-${refeicao.id}`}>Horário</label>
                  <input
                    id={`hora-${refeicao.id}`}
                    type="time"
                    value={refeicao.horarioFixo || '12:00'}
                    onChange={(e) => e.target.value && onEditarRefeicao(refeicao.id, { horarioFixo: e.target.value })}
                    className="pp-controle pp-controle--hora"
                  />
                </div>
              </>
            )}
            <div className="pp-refeicao__edicao-acoes">
              <button type="button" onClick={() => setEditando(false)} className="pp-botao pp-botao--secundario">
                pronto
              </button>
              {/* Destrutiva e sem confirmacao: o nome da refeicao entra no nome
                  acessivel para nao haver duvida de qual sera excluida. */}
              <button
                type="button"
                onClick={() => onExcluirRefeicao(refeicao.id)}
                aria-label={`excluir refeição ${refeicao.nome}`}
                className="pp-botao pp-botao--perigo"
              >
                excluir refeição
              </button>
            </div>
          </div>
        ) : (
        <h3 className="pp-refeicao__titulo">
          <button
            type="button"
            onClick={() => onToggle(refeicao.id)}
            aria-expanded={refeicao.aberta}
            className="pp-refeicao__alternar"
          >
            {/* O horario vem calculado: refeicao ancorada segue o treino. */}
            <span className="pp-refeicao__nome">{refeicao.nome}</span>
            {horario && <span className="pp-refeicao__hora">{horario}</span>}
            {refeicao.ancora && (
              <span className="pp-refeicao__ancora">{rotuloAncora(refeicao.ancora)}</span>
            )}
            {refeicao.etiqueta && <Etiqueta tom="atencao">{refeicao.etiqueta}</Etiqueta>}
          </button>
        </h3>
        )}
        <div className="pp-refeicao__resumo">
          <span className="pp-refeicao__kcal">
            {semEnergia ? '—' : n(totais.kcal)} kcal{energiaParcial && !semEnergia ? ' · subtotal' : ''}
          </span>
          {!refeicao.aberta && (
            <span className="pp-refeicao__indices">
              IG {n(igPonderado)} · CG {n(cargaGlicemica)}
            </span>
          )}
          <button
            type="button"
            onClick={() => setEditando((v) => !v)}
            aria-label={`Editar ${refeicao.nome}`}
            aria-pressed={editando}
            className="pp-icone-botao"
          >
            <Pencil className="pp-icone" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDuplicarRefeicao(refeicao.id)}
            aria-label={`Duplicar ${refeicao.nome}`}
            className="pp-icone-botao"
          >
            <Copy className="pp-icone" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onToggle(refeicao.id)}
            aria-label={refeicao.aberta ? `Fechar ${refeicao.nome}` : `Abrir ${refeicao.nome}`}
            className="pp-icone-botao"
          >
            {refeicao.aberta ? <ChevronDown className="pp-icone" aria-hidden="true" /> : <ChevronRight className="pp-icone" aria-hidden="true" />}
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
          <table className="pp-tabela">
            <caption className="pp-sr">
              Alimentos de {refeicao.nome}{horario ? ` às ${horario}` : ''}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="pp-tabela__alca">
                  <span className="pp-sr">Ordem</span>
                </th>
                <th scope="col" className="pp-tabela__nome">Alimento</th>
                {metodo === 'alimentos' ? (
                  <>
                    <th scope="col" className="pp-tabela__num">Qtd</th>
                    <th scope="col" className="pp-tabela__medida">
                      Medida caseira
                    </th>
                    <th scope="col" className="pp-tabela__num">kcal</th>
                    <th scope="col" className="pp-tabela__num">C</th>
                    <th scope="col" className="pp-tabela__num">P</th>
                    <th scope="col" className="pp-tabela__num">L</th>
                  </>
                ) : (
                  <th scope="col" colSpan={6} className="pp-tabela__num">
                    {metodo === 'equivalentes' ? 'Equivalentes' : 'Grupo'}
                  </th>
                )}
                <th scope="col" className="pp-tabela__acoes">
                  <span className="pp-sr">Trocar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item, indice) => (
                <AlimentoLinha
                  key={item.id}
                  item={item}
                  ordem={indice + 1}
                  valores={valoresPorItem[item.id]}
                  ancora={ancoraPorItem[item.id]}
                  aberto={abertos.has(item.id)}
                  opcoes={opcoesPorItem[item.id] ?? []}
                  sugestoes={sugestoesPorItem[item.id]?.candidatos ?? []}
                  motivo={sugestoesPorItem[item.id]?.motivo ?? null}
                  restrito={restritosPorItem[item.id] ?? null}
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

          <div className="pp-refeicao__rodape">
            <button
              type="button"
              ref={botaoAdicionarRef}
              onClick={onAdicionarAlimento}
              aria-expanded={buscaAberta}
              className="pp-botao pp-botao--secundario"
            >
              <Plus className="pp-icone" aria-hidden="true" /> Adicionar alimento
            </button>
            <div className="pp-refeicao__etiquetas">
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

          {buscaAberta && (
            <BuscaAlimento
              id={`busca-alimento-${refeicao.id}`}
              modo="principal"
              termo={buscaAlimento.termo}
              resultados={buscaAlimento.resultados}
              carregando={buscaAlimento.carregando}
              erro={buscaAlimento.erro}
              onTermo={onBuscarAlimento}
              onEscolher={(alimento, quantidade, medidaIdx) => {
                onEscolherAlimento(alimento, quantidade, medidaIdx);
                botaoAdicionarRef.current?.focus();
              }}
              onFechar={() => {
                onFecharBusca();
                botaoAdicionarRef.current?.focus();
              }}
            />
          )}

          {/* A orientacao acompanha a refeicao no PDF do paciente: e onde cabe
              "prepare no domingo e congele em porcoes". O rotulo, antes so
              para leitor de tela, agora fica visivel: o placeholder some ao
              digitar e nao pode ser o unico nome do campo. */}
          <div className="pp-campo pp-refeicao__orientacao">
            <label className="pp-rotulo" htmlFor={`orient-${refeicao.id}`}>
              Orientação de {refeicao.nome}
            </label>
            <input
              id={`orient-${refeicao.id}`}
              value={refeicao.orientacoes ?? refeicao.orientacao ?? ''}
              onChange={(e) => onEditarRefeicao(refeicao.id, { orientacoes: e.target.value })}
              placeholder="Orientação para o paciente"
              className="pp-controle"
            />
          </div>
        </>
      )}
    </div>
  );
}
