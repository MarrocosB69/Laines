import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Plus, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { COR, REFERENCIAS } from '../../constants/prescricao/seed.js';
import { gruposDoCatalogo } from '../../services/prescricaoCatalogo.js';
import { horarioDe, ordenarPorHorario } from '../../core/prescricao/horarios.js';
import { analisesDoPlano } from '../../core/prescricao/analises.js';
import { distribuicaoNova, listaDeCompras } from '../../core/prescricao/classificacao.js';
import { porcoesDoItem } from '../../core/prescricao/equivalentes.js';
import { usePrescricaoApi } from '../../hooks/usePrescricaoApi.js';
import { usePlanoCalculado } from '../../hooks/usePlanoCalculado.js';
import RefeicaoCard from '../../components/Prescricao/RefeicaoCard.jsx';
import PainelMacros from '../../components/Prescricao/PainelMacros.jsx';
import TabelaAdequacao from '../../components/Prescricao/TabelaAdequacao.jsx';
import Analises from '../../components/Prescricao/Analises.jsx';
import GrauProcessamento from '../../components/Prescricao/GrauProcessamento.jsx';
import ListaCompras from '../../components/Prescricao/ListaCompras.jsx';
import BuscaAlimento from '../../components/Prescricao/BuscaAlimento.jsx';
import { n } from '../../components/Prescricao/formato.js';
import './PrescricaoPlano.css';

const TOTAIS_VAZIOS = {
  kcal: 0, cho: 0, ptn: 0, lip: 0,
  choDisponivel: null, cargaGlicemica: null, igPonderado: null
};

/**
 * Container da prescrição.
 *
 * Costura duas coisas e nada mais: `usePrescricaoApi` (rede) e
 * `usePlanoCalculado` (cálculo). Nenhum componente abaixo conhece qualquer um
 * dos dois — todos recebem dado pronto.
 *
 * As referências DRI vêm do arquivo de seed porque são tabela de referência,
 * não dado de exemplo; um dia serão por idade e sexo do paciente.
 */
export default function PrescricaoPlano() {
  const { pacienteId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const podeRevisar = ['professor', 'profissional'].includes(user?.role)
    && Boolean(user?.crn || (user?.conselhoTipo === 'CRN' && user?.conselhoNumero));

  const {
    carregando, erro, paciente, metas, plano, setPlano,
    catalogoPorId, registrarAlimento,
    busca, buscar, carregarGrupo, salvar, salvando, salvoEm, planoId, transicionar, exportarPdf, alterado
  } = usePrescricaoApi(pacienteId);

  const [abertos, setAbertos] = useState(() => new Set());
  const [buscaEm, setBuscaEm] = useState(null);
  const [metodo, setMetodo] = useState('alimentos');
  const [biblioteca, setBiblioteca] = useState([]);
  const [composicaoConferida, setComposicaoConferida] = useState(false);

  // O treino nao e do plano nem do paciente ainda: e do profissional montando
  // a prescricao. Ancorar as refeicoes nele so exige estas duas informacoes.
  const treino = useMemo(
    () => ({ inicio: plano?.treinoInicio || '', duracao: Number(plano?.treinoDuracao) || 60 }),
    [plano]
  );

  const catalogo = useMemo(() => Object.values(catalogoPorId), [catalogoPorId]);
  const grupos = useMemo(() => gruposDoCatalogo(catalogo), [catalogo]);

  // Restrições vêm da anamnese; enquanto não houver esse vínculo, nenhuma
  // exclusão é aplicada — melhor não filtrar do que filtrar por engano.
  const restricoes = useMemo(() => [], []);

  const planoParaCalculo = useMemo(() => plano || { refeicoes: [] }, [plano]);
  const metasSeguras = useMemo(() => {
    const base = metas || { kcal: null, cho: null, ptn: null, lip: null, peso: null };
    // O cadastro do paciente nao tem campo de peso, e o peso e o que converte
    // grama em g/kg. Enquanto nao houver, o profissional informa aqui e o
    // valor viaja com o plano.
    return { ...base, peso: base.peso ?? (Number(plano?.pesoPaciente) || null) };
  }, [metas, plano]);

  const {
    calculado, totaisPorId, itensPorRefeicao, opcoesPorItem,
    sugestoesPorItem, valoresPorItem, macros, micros, distribuicao
  } = usePlanoCalculado(planoParaCalculo, {
    metas: metasSeguras,
    referencias: REFERENCIAS,
    catalogo,
    catalogoPorId,
    grupos,
    restricoes,
    abertos
  });

  const refeicoesOrdenadas = useMemo(
    () => (plano ? ordenarPorHorario(plano.refeicoes, treino) : []),
    [plano, treino]
  );

  const analises = useMemo(() => {
    const itens = calculado.resolvidas.flatMap((r) => r.itens);
    const porRefeicao = (plano?.refeicoes ?? []).map((r) => ({
      id: r.id,
      nome: r.nome,
      totais: totaisPorId[r.id] ?? TOTAIS_VAZIOS
    }));
    return analisesDoPlano(itens, porRefeicao, metasSeguras.peso);
  }, [calculado, plano, totaisPorId, metasSeguras]);

  const itensResolvidos = useMemo(
    () => calculado.resolvidas.flatMap((r) => r.itens),
    [calculado]
  );

  const distribNova = useMemo(() => distribuicaoNova(itensResolvidos), [itensResolvidos]);

  const compras = useMemo(
    () => listaDeCompras(plano?.refeicoes ?? [], catalogoPorId),
    [plano, catalogoPorId]
  );

  const porcoesPorItem = useMemo(() => Object.fromEntries(
    itensResolvidos.map((i) => [i.id, porcoesDoItem(i, grupos[i.grupo]?.ancora ?? null)])
  ), [itensResolvidos, grupos]);

  const ancoraPorItem = useMemo(
    () => Object.fromEntries(
      calculado.resolvidas.flatMap((r) => r.itens).map((i) => [i.id, grupos[i.grupo]?.ancora ?? null])
    ),
    [calculado, grupos]
  );

  const mapItens = useCallback((fn) => {
    setPlano((p) => ({ ...p, refeicoes: p.refeicoes.map((r) => ({ ...r, itens: r.itens.map(fn) })) }));
  }, [setPlano]);

  const alternarRefeicao = useCallback((id) => {
    setPlano((p) => ({
      ...p,
      refeicoes: p.refeicoes.map((r) => (r.id === id ? { ...r, aberta: !r.aberta } : r))
    }));
  }, [setPlano]);

  const alternarItem = useCallback((itemId) => {
    setAbertos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(itemId)) proximo.delete(itemId);
      else {
        proximo.add(itemId);
        // Abrir a substituicao e o gatilho para trazer o grupo: so aqui se
        // sabe qual grupo interessa, e so aqui a sugestao e olhada.
        const item = calculado.resolvidas.flatMap((r) => r.itens).find((i) => i.id === itemId);
        if (item?.grupo) carregarGrupo(item.grupo);
      }
      return proximo;
    });
  }, [calculado, carregarGrupo]);

  const alterarQuantidade = useCallback((itemId, quantidade) => {
    mapItens((i) => (i.id === itemId ? { ...i, quantidade } : i));
  }, [mapItens]);

  const adicionarSubstituto = useCallback((itemId, op) => {
    mapItens((i) => (
      i.id !== itemId || (i.substitutos ?? []).some((s) => s.alimentoId === op.alimentoId)
        ? i
        : {
          ...i,
          substitutos: [...(i.substitutos ?? []), { alimentoId: op.alimentoId, medidaIdx: op.medidaIdx, modo: 'auto' }]
        }
    ));
  }, [mapItens]);

  /**
   * Prescrever a substituicao: a quantidade passa a ser a que o profissional
   * definiu, e a opcao entra em modo fixo. Passar null devolve ao calculo
   * automatico, para nao prender quem so quis experimentar um numero.
   */
  const alterarQuantidadeSubstituto = useCallback((itemId, alimentoId, quantidade) => {
    mapItens((i) => (
      i.id !== itemId ? i : {
        ...i,
        substitutos: (i.substitutos ?? []).map((sub) => (
          sub.alimentoId !== alimentoId ? sub : (
            quantidade === null || quantidade === undefined || Number.isNaN(quantidade)
              ? { alimentoId: sub.alimentoId, medidaIdx: sub.medidaIdx, modo: 'auto' }
              : { ...sub, modo: 'fixa', quantidade: Math.max(0, quantidade) }
          )
        ))
      }
    ));
  }, [mapItens]);

  /**
   * Substituto escolhido a dedo, de qualquer parte do catálogo.
   *
   * As sugestões só alcançam o mesmo grupo de equivalência; isto aqui é o
   * profissional prescrevendo a troca que ele quer. Entra em modo automático
   * quando a equivalência é calculável — e quando não é, a opção aparece
   * assim mesmo, marcada como sem equivalência, com a quantidade editável.
   */
  const escolherSubstituto = useCallback((itemId, alimento) => {
    registrarAlimento(alimento);
    mapItens((i) => (
      i.id !== itemId || (i.substitutos ?? []).some((sub) => sub.alimentoId === alimento.id)
        ? i
        : { ...i, substitutos: [...(i.substitutos ?? []), { alimentoId: alimento.id, medidaIdx: 0, modo: 'auto' }] }
    ));
  }, [mapItens, registrarAlimento]);

  const removerSubstituto = useCallback((itemId, alimentoId) => {
    mapItens((i) => (
      i.id === itemId
        ? { ...i, substitutos: (i.substitutos ?? []).filter((s) => s.alimentoId !== alimentoId) }
        : i
    ));
  }, [mapItens]);

  /** Registra o alimento no catálogo local e o acrescenta à refeição. */
  const adicionarAlimento = useCallback((refeicaoId, alimento, gramas) => {
    registrarAlimento(alimento);
    setPlano((p) => ({
      ...p,
      refeicoes: p.refeicoes.map((r) => (
        r.id !== refeicaoId ? r : {
          ...r,
          itens: [...r.itens, {
            id: `i${Date.now()}`,
            alimentoId: alimento.id,
            medidaIdx: 0,
            quantidade: gramas,
            substitutos: []
          }]
        }
      ))
    }));
    setBuscaEm(null);
  }, [registrarAlimento, setPlano]);

  const editarRefeicao = useCallback((id, patch) => {
    setPlano((p) => ({
      ...p,
      refeicoes: p.refeicoes.map((r) => (r.id === id ? { ...r, ...patch } : r))
    }));
  }, [setPlano]);

  const excluirRefeicao = useCallback((id) => {
    setPlano((p) => ({ ...p, refeicoes: p.refeicoes.filter((r) => r.id !== id) }));
  }, [setPlano]);

  const duplicarRefeicao = useCallback((id) => {
    setPlano((p) => {
      const alvo = p.refeicoes.find((r) => r.id === id);
      if (!alvo) return p;
      const sufixo = Date.now().toString(36);
      // Ids novos em tudo: reaproveitar id de item faria as duas refeicoes
      // responderem juntas a qualquer edicao.
      const copia = {
        ...alvo,
        id: `r-${sufixo}`,
        nome: `${alvo.nome} (cópia)`,
        aberta: true,
        itens: alvo.itens.map((i, j) => ({
          ...i,
          id: `i-${sufixo}-${j}`,
          substitutos: (i.substitutos ?? []).map((sub) => ({ ...sub }))
        }))
      };
      const idx = p.refeicoes.findIndex((r) => r.id === id);
      const proximas = [...p.refeicoes];
      proximas.splice(idx + 1, 0, copia);
      return { ...p, refeicoes: proximas };
    });
  }, [setPlano]);

  const excluirItem = useCallback((refeicaoId, itemId) => {
    setPlano((p) => ({
      ...p,
      refeicoes: p.refeicoes.map((r) => (
        r.id === refeicaoId ? { ...r, itens: r.itens.filter((i) => i.id !== itemId) } : r
      ))
    }));
  }, [setPlano]);

  /**
   * Biblioteca de blocos: um conjunto de substitutos que o profissional monta
   * uma vez e reaplica. O que se guarda sao ids, nao os calculos — a
   * equivalencia e recalculada contra o alimento de destino.
   */
  const salvarBloco = useCallback((base) => {
    setBiblioteca((lib) => {
      const bloco = {
        id: `b-${Date.now().toString(36)}`,
        nome: base.nome,
        alimentoId: base.alimentoId,
        substitutos: (base.substitutos ?? []).map((sub) => ({ ...sub }))
      };
      const i = lib.findIndex((x) => x.alimentoId === base.alimentoId);
      return i === -1 ? [...lib, bloco] : lib.map((x, j) => (j === i ? { ...bloco, id: x.id } : x));
    });
  }, []);

  const aplicarBloco = useCallback((itemId, bloco) => {
    mapItens((i) => {
      if (i.id !== itemId) return i;
      const jaTem = new Set((i.substitutos ?? []).map((s) => s.alimentoId));
      return {
        ...i,
        substitutos: [...(i.substitutos ?? []), ...bloco.substitutos.filter((s) => !jaTem.has(s.alimentoId))]
      };
    });
  }, [mapItens]);

  const blocoPorAlimentoId = useMemo(
    () => Object.fromEntries(biblioteca.map((b) => [b.alimentoId, b])),
    [biblioteca]
  );

  const adicionarRefeicao = useCallback(() => {
    setPlano((p) => ({
      ...p,
      refeicoes: [...p.refeicoes, {
        id: `r${Date.now()}`,
        nome: `Refeição ${p.refeicoes.length + 1}`,
        horario: '',
        etiqueta: null,
        aberta: true,
        itens: []
      }]
    }));
  }, [setPlano]);

  const handlers = {
    onAlternar: alternarItem,
    onQuantidade: alterarQuantidade,
    onAdicionar: adicionarSubstituto,
    onRemover: removerSubstituto,
    onQuantidadeSubstituto: alterarQuantidadeSubstituto,
    busca,
    onBuscarSubstituto: buscar,
    onEscolherSubstituto: escolherSubstituto,
    onSalvarBloco: salvarBloco,
    onAplicarBloco: aplicarBloco
  };

  if (carregando) {
    return (
      <div className="prescricao-plano min-h-screen bg-stone-50 p-6 text-sm text-stone-500">
        Carregando prescrição…
      </div>
    );
  }

  if (!plano) {
    return (
      <div className="prescricao-plano min-h-screen bg-stone-50 p-6">
        <p className="text-sm text-red-700">{erro || 'Prescrição indisponível.'}</p>
      </div>
    );
  }

  return (
    <div className="prescricao-plano min-h-screen bg-stone-50 p-6 font-sans text-stone-900">
      <div className="mx-auto max-w-5xl">
        {erro && <p className="mb-3 text-xs text-red-700">{erro}</p>}

        <div className="flex gap-4 max-[999px]:flex-col-reverse">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  aria-label="Voltar"
                  className="rounded-lg border border-stone-300 p-1.5 hover:bg-stone-100"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <div className="min-w-0">
                  <h1 className="truncate text-lg leading-tight">
                    {paciente?.nome || 'Paciente'}
                  </h1>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500">
                    <span>Plano alimentar</span>
                    {plano.status && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="rounded bg-stone-100 px-1.5 py-0.5">{plano.status}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {salvoEm && <span className="text-xs text-stone-400">{alterado ? 'alterações não salvas' : `versão ${plano.version} salva`}</span>}
                <button
                  type="button"
                  onClick={() => salvar()}
                  disabled={salvando}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs hover:bg-stone-100 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> {salvando ? 'Salvando…' : 'Salvar plano'}
                </button>
                <button
                  type="button"
                  onClick={() => salvar('em_revisao')}
                  disabled={salvando || (!alterado && plano.status === 'em_revisao')}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs hover:bg-stone-100 disabled:opacity-50"
                >
                  Enviar para revisão
                </button>
                {podeRevisar && plano.status === 'em_revisao' && (
                  <button type="button" disabled={salvando || alterado}
                    onClick={() => transicionar(plano.revisaoFinal?.confirmada ? 'ativar' : 'revisar', composicaoConferida)}
                    className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs disabled:opacity-50">
                    {plano.revisaoFinal?.confirmada ? 'Ativar plano' : 'Aprovar revisão'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={exportarPdf}
                  disabled={!planoId || alterado || salvando}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs hover:bg-stone-100 disabled:opacity-50"
                >
                  <FileText className="w-3.5 h-3.5" /> PDF
                </button>
              </div>
            </div>

            {plano.revisaoFinal?.confirmada && (
              <p className="mb-2 text-xs text-stone-600">Revisado por {plano.revisaoFinal.confirmadoPorNome} · CRN {plano.revisaoFinal.crn}. Salvar alterações exige nova revisão.</p>
            )}
            {podeRevisar && plano.status === 'em_revisao' && Object.values(catalogoPorId).some((a) => a.origemComposicao !== 'catalogo' && !a.validacaoComposicao) && (
              <label className="mb-2 flex items-center gap-2 text-xs text-stone-600">
                <input type="checkbox" checked={composicaoConferida} onChange={(e) => setComposicaoConferida(e.target.checked)} />
                Conferi a origem, as unidades e a composição dos alimentos manuais ou legados deste plano.
              </label>
            )}

            {/* Ancorar refeicoes no treino so precisa destas duas informacoes;
                mudar o horario do treino move pre e pos-treino juntos. */}
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-500">
              <span>Treino</span>
              <label className="sr-only" htmlFor="treino-inicio">Início do treino</label>
              <input
                id="treino-inicio"
                type="time"
                value={plano.treinoInicio || ''}
                onChange={(e) => setPlano((p) => ({ ...p, treinoInicio: e.target.value }))}
                className="rounded border border-stone-200"
              />
              <span aria-hidden="true">·</span>
              <label className="sr-only" htmlFor="treino-duracao">Duração em minutos</label>
              <input
                id="treino-duracao"
                type="number"
                min="0"
                step="5"
                value={plano.treinoDuracao ?? 60}
                onChange={(e) => setPlano((p) => ({ ...p, treinoDuracao: Number(e.target.value) }))}
                className="pp-largura-num rounded border border-stone-200 text-right"
              />
              <span>min</span>

              <span className="mx-1 h-4 w-px bg-stone-200" aria-hidden="true" />

              <label htmlFor="peso-paciente">Peso</label>
              <input
                id="peso-paciente"
                type="number"
                min="0"
                step="0.1"
                value={plano.pesoPaciente ?? ''}
                placeholder="—"
                onChange={(e) => setPlano((p) => ({ ...p, pesoPaciente: e.target.value }))}
                className="pp-largura-num rounded border border-stone-200 text-right"
              />
              <span>kg</span>

              <span className="mx-1 h-4 w-px bg-stone-200" aria-hidden="true" />

              <label htmlFor="metodo">Método</label>
              <select
                id="metodo"
                value={metodo}
                onChange={(e) => setMetodo(e.target.value)}
                className="rounded border border-stone-200"
              >
                <option value="alimentos">Por alimentos</option>
                <option value="equivalentes">Por equivalentes</option>
                <option value="qualitativo">Qualitativo</option>
              </select>

              {!plano.treinoInicio && (
                <span className="text-stone-400">
                  — sem horário de treino, refeições ancoradas ficam sem hora
                </span>
              )}
            </div>

            <div className="space-y-2">
              {refeicoesOrdenadas.map((r) => (
                <div key={r.id}>
                  <RefeicaoCard
                    refeicao={r}
                    horario={horarioDe(r, treino)}
                    itens={itensPorRefeicao[r.id] ?? []}
                    totais={totaisPorId[r.id] ?? TOTAIS_VAZIOS}
                    ancoraPorItem={ancoraPorItem}
                    valoresPorItem={valoresPorItem}
                    opcoesPorItem={opcoesPorItem}
                    sugestoesPorItem={sugestoesPorItem}
                    abertos={abertos}
                    metodo={metodo}
                    porcoesPorItem={porcoesPorItem}
                    blocoPorAlimentoId={blocoPorAlimentoId}
                    onToggle={alternarRefeicao}
                    onAdicionarAlimento={() => setBuscaEm(buscaEm === r.id ? null : r.id)}
                    onEditarRefeicao={editarRefeicao}
                    onDuplicarRefeicao={duplicarRefeicao}
                    onExcluirRefeicao={excluirRefeicao}
                    onExcluirItem={(itemId) => excluirItem(r.id, itemId)}
                    {...handlers}
                  />
                  {buscaEm === r.id && (
                    <BuscaAlimento
                      termo={busca.termo}
                      resultados={busca.resultados}
                      carregando={busca.carregando}
                      erro={busca.erro}
                      onTermo={buscar}
                      onEscolher={(a, g) => adicionarAlimento(r.id, a, g)}
                      onFechar={() => setBuscaEm(null)}
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={adicionarRefeicao}
              className="mt-2 flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar refeição
            </button>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-100 px-4 py-2.5 text-xs text-stone-600">
              <span>
                Total do dia · {plano.refeicoes.length}{' '}
                {plano.refeicoes.length === 1 ? 'refeição' : 'refeições'}
              </span>
              <span className="text-stone-900">
                {n(calculado.dia.kcal)} kcal · carga glicêmica {n(calculado.dia.cargaGlicemica)}
              </span>
            </div>

            <TabelaAdequacao macros={macros} micros={micros} />
            <Analises analises={analises} peso={metasSeguras.peso} />

            <div className="mt-2 grid grid-cols-2 gap-2 max-[860px]:grid-cols-1">
              <GrauProcessamento distribuicao={distribNova} />
              <ListaCompras lista={compras} />
            </div>
          </div>

          {/* Abaixo de 1000px sai da lateral e vira faixa no topo. */}
          <div className="w-60 shrink-0 max-[999px]:w-full">
            <div className="sticky top-6 space-y-2 max-[999px]:static">
              <PainelMacros
                dia={calculado.dia}
                metas={metasSeguras}
                distribuicao={distribuicao}
                cores={COR}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
