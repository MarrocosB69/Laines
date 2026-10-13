import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Clock, FileText, Info, Plus, RefreshCw, Save, TriangleAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useUiFeedback } from '../../contexts/UiFeedbackContext';
import { COR } from '../../constants/prescricao/seed.js';
import { gruposDoCatalogo } from '../../services/prescricaoCatalogo.js';
import { nomeParaExibicao } from '../../core/prescricao/nomeAlimento.js';
import { horarioDe, ordenarPorHorario } from '../../core/prescricao/horarios.js';
import { analisesDoPlano } from '../../core/prescricao/analises.js';
import { distribuicaoNova, listaDeCompras } from '../../core/prescricao/classificacao.js';
import { porcoesDoItem } from '../../core/prescricao/equivalentes.js';
import { montarOpcao } from '../../core/prescricao/equivalencia.js';
import { usePrescricaoApi } from '../../hooks/usePrescricaoApi.js';
import { usePlanoCalculado } from '../../hooks/usePlanoCalculado.js';
import { useEdicaoPendente } from '../../hooks/useEdicaoPendente.js';
import RefeicaoCard from '../../components/Prescricao/RefeicaoCard.jsx';
import MapaRefeicoes from '../../components/Prescricao/MapaRefeicoes.jsx';
import ConferenciaPlano from '../../components/Prescricao/ConferenciaPlano.jsx';
import PainelMacros from '../../components/Prescricao/PainelMacros.jsx';
import TabelaAdequacao from '../../components/Prescricao/TabelaAdequacao.jsx';
import PainelRestricoes from '../../components/Prescricao/PainelRestricoes.jsx';
import Analises from '../../components/Prescricao/Analises.jsx';
import GrauProcessamento from '../../components/Prescricao/GrauProcessamento.jsx';
import ListaCompras from '../../components/Prescricao/ListaCompras.jsx';
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
 * Referências elegíveis e restrições vêm do contexto clínico do paciente.
 */
export default function PrescricaoPlano() {
  const { pacienteId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notify, confirm } = useUiFeedback();
  const podeRevisar = ['professor', 'profissional'].includes(user?.role)
    && Boolean(user?.crn || (user?.conselhoTipo === 'CRN' && user?.conselhoNumero));
  const currentUserId = user?.uid || user?.id || '';

  const {
    carregando, erro, paciente, metas, contextoClinico, plano, setPlano,
    catalogoPorId, candidatosPorId, registrarAlimento,
    busca, buscar, carregarGrupo, salvar, salvando, salvoEm, planoId, transicionar, exportarPdf, alterado
  } = usePrescricaoApi(pacienteId);

  const [abertos, setAbertos] = useState(() => new Set());
  const [buscaAtiva, setBuscaAtiva] = useState(null);
  const [metodo, setMetodo] = useState('alimentos');
  const [biblioteca, setBiblioteca] = useState([]);
  const [composicaoConferida, setComposicaoConferida] = useState(false);
  const [acaoConferencia, setAcaoConferencia] = useState(null);

  // UPD-18 (UX-07): protecao de edicao nao salva do plano alimentar, separada
  // do redirecionamento de sessao. `alterado` (usePrescricaoApi) ja e a
  // deteccao de "sujo" certa aqui — compara o plano+catalogo atual contra a
  // assinatura do que foi salvo por ultimo, entao reabrir sem editar nada
  // nunca conta como pendencia. `dados` carrega os dois porque um alimento
  // novo (ainda nao salvo) só existe no catalogo local; sem ele, recuperar o
  // plano reintroduziria itens sem composicao nutricional resolvivel.
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false);
  useEffect(() => {
    setBiblioteca([]);
    setAbertos(new Set());
    setBuscaAtiva(null);
    setDraftBannerDismissed(false);
    setAcaoConferencia(null);
  }, [pacienteId]);
  const {
    rascunhoDisponivel: draftAvailable,
    recuperarRascunho: recoverDraft,
    descartarRascunho: discardDraft
  } = useEdicaoPendente({
    ativo: Boolean(plano) && Boolean(pacienteId),
    dirty: alterado,
    dados: { plano, catalogoPorId },
    screenId: 'prescricao-plano',
    userId: currentUserId,
    recordId: pacienteId
  });

  const handleRecoverDraft = useCallback(() => {
    const draftData = recoverDraft();
    setDraftBannerDismissed(true);
    if (!draftData) return;
    if (draftData.plano) setPlano(draftData.plano);
    if (draftData.catalogoPorId && typeof draftData.catalogoPorId === 'object') {
      Object.values(draftData.catalogoPorId).forEach(registrarAlimento);
    }
    notify({
      type: 'success',
      title: 'Rascunho recuperado',
      message: 'O plano alimentar digitado antes da sessão expirar foi restaurado. Revise e salve para confirmar.'
    });
  }, [notify, recoverDraft, registrarAlimento, setPlano]);

  const handleDiscardDraft = useCallback(() => {
    discardDraft();
    setDraftBannerDismissed(true);
  }, [discardDraft]);

  const handleVoltar = useCallback(async () => {
    // UPD-18 (UX-07): abandono deliberado pelo botao "Voltar" da propria
    // tela — o app usa BrowserRouter, sem useBlocker/unstable_usePrompt para
    // interceptar a navegacao pelo router.
    if (alterado) {
      const proceed = await confirm({
        title: 'Sair sem salvar?',
        message: 'Há alterações no plano alimentar que ainda não foram salvas. Elas serão perdidas se você sair agora.',
        confirmLabel: 'Sair sem salvar',
        cancelLabel: 'Continuar editando',
        variant: 'danger'
      });
      if (!proceed) return;
    }
    navigate(-1);
  }, [alterado, confirm, navigate]);

  const handleSalvar = useCallback(async () => {
    const resultado = await salvar();
    if (resultado) discardDraft();
  }, [discardDraft, salvar]);

  const handleEnviarRevisao = useCallback(async () => {
    const resultado = await salvar('em_revisao');
    if (resultado) discardDraft();
    return resultado;
  }, [discardDraft, salvar]);

  // O treino nao e do plano nem do paciente ainda: e do profissional montando
  // a prescricao. Ancorar as refeicoes nele so exige estas duas informacoes.
  const treino = useMemo(
    () => ({ inicio: plano?.treinoInicio || '', duracao: Number(plano?.treinoDuracao) || 60 }),
    [plano]
  );

  const catalogo = useMemo(
    () => Object.values({ ...candidatosPorId, ...catalogoPorId }),
    [candidatosPorId, catalogoPorId]
  );
  const grupos = useMemo(() => gruposDoCatalogo(catalogo), [catalogo]);

  // Restrições (UPD-11): a conferência registrada no plano prevalece sobre a
  // leitura bruta da anamnese; sem conferência, as sugestões ficam suspensas.
  const restricoesContexto = useMemo(() => contextoClinico?.restricoes || {
    pendenteRevisao: true, motivo: 'Contexto de restrições indisponível. Sugestões automáticas suspensas.'
  }, [contextoClinico]);
  const restricoes = useMemo(() => {
    const registro = plano?.restricoes;
    if (!registro?.conferidoEm) return restricoesContexto;
    return {
      pendenteRevisao: false,
      semRestricao: Boolean(registro.semRestricao),
      alimentoIds: registro.alimentoIds || [],
      grupos: registro.grupos || [],
      justificativas: registro.justificativas || {},
      descricao: registro.origem?.descricao || restricoesContexto.descricao || '',
      origem: restricoesContexto.origem || null,
      motivo: null
    };
  }, [plano?.restricoes, restricoesContexto]);
  const referencias = useMemo(() => contextoClinico?.referencias?.linhas || [], [contextoClinico]);

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
    sugestoesPorItem, valoresPorItem, restritosPorItem, macros, micros, distribuicao
  } = usePlanoCalculado(planoParaCalculo, {
    metas: metasSeguras,
    referencias,
    catalogo,
    catalogoPorId,
    grupos,
    restricoes,
    abertos
  });
  const energiaConhecida = macros.find((linha) => linha.nutriente === 'kcal');

  const refeicoesOrdenadas = useMemo(
    () => (plano ? ordenarPorHorario(plano.refeicoes, treino) : []),
    [plano, treino]
  );
  const horarioDeRefeicao = useCallback((refeicao) => horarioDe(refeicao, treino), [treino]);
  const irParaRefeicao = useCallback((id) => {
    setAcaoConferencia(null);
    setPlano((atual) => {
      if (!atual?.refeicoes?.some((r) => r.id === id && !r.aberta)) return atual;
      return { ...atual, refeicoes: atual.refeicoes.map((r) =>
        r.id === id ? { ...r, aberta: true } : r) };
    });
    requestAnimationFrame(() => {
      const alvo = document.getElementById(`pp-refeicao-${id}`);
      alvo?.focus({ preventScroll: true });
      alvo?.scrollIntoView({ block: 'start' });
    });
  }, [setPlano]);
  useEffect(() => {
    if (acaoConferencia) document.getElementById('pp-conferencia-titulo')?.focus();
  }, [acaoConferencia]);

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

  const itensEmConflito = useMemo(() => {
    const conflitos = itensResolvidos
      .filter((item) => restritosPorItem[item.id])
      .map((item) => ({ id: item.id, nome: item.nome, ...restritosPorItem[item.id] }));
    if (restricoes.pendenteRevisao || restricoes.semRestricao) return conflitos;
    const ids = new Set(restricoes.alimentoIds || []);
    const gruposRestritos = new Set(restricoes.grupos || []);
    for (const item of itensResolvidos) {
      for (const sub of item.substitutos || []) {
        const alimento = catalogoPorId[sub.alimentoId];
        if (!alimento) continue;
        const motivo = ids.has(String(sub.alimentoId)) ? 'alimento'
          : gruposRestritos.has(alimento.grupo) ? 'grupo' : null;
        if (!motivo) continue;
        const id = `${item.id}:${sub.alimentoId}`;
        const justificativa = String(restricoes.justificativas?.[id] || '').trim();
        conflitos.push({ id, nome: `Opção para ${item.nome}: ${alimento.nomeExibicao || nomeParaExibicao(alimento)}`,
          motivo, justificada: justificativa.length >= 5 });
      }
    }
    return conflitos;
  }, [itensResolvidos, restritosPorItem, catalogoPorId, restricoes]);
  const restricoesPendentes = Boolean(restricoesContexto.pendenteRevisao) && !plano?.restricoes?.conferidoEm;
  const conflitosSemJustificativa = itensEmConflito.filter((item) => !item.justificada).length;
  const quantidadePendente = plano?.refeicoes.some((refeicao) => refeicao.itens.some((item) =>
    !Number.isFinite(Number(item.quantidade)) || Number(item.quantidade) <= 0
    || (item.substitutos || []).some((sub) => sub.modo === 'fixa'
      && (!Number.isFinite(Number(sub.quantidade)) || Number(sub.quantidade) <= 0)))) ?? false;
  const bloqueioQuantidade = quantidadePendente ? 'Informe quantidades positivas para todos os alimentos e opções prescritas.' : '';
  const bloqueioRevisao = restricoesPendentes
    ? 'Confira as restrições alimentares antes de enviar para revisão.'
    : conflitosSemJustificativa
      ? `${conflitosSemJustificativa} conflito(s) com restrição sem justificativa.`
      : '';

  const confirmarConferencia = async () => {
    const acao = acaoConferencia;
    if (!acao || salvando || quantidadePendente || (acao === 'enviar' && bloqueioRevisao)) return;
    const resultado = acao === 'enviar'
      ? await handleEnviarRevisao()
      : await transicionar(acao === 'ativar' ? 'ativar' : 'revisar', composicaoConferida);
    if (resultado) setAcaoConferencia(null);
  };
  const corrigirQuantidade = () => {
    const refeicao = plano?.refeicoes.find((r) => r.itens.some((item) =>
      !Number.isFinite(Number(item.quantidade)) || Number(item.quantidade) <= 0
      || (item.substitutos || []).some((sub) => sub.modo === 'fixa'
        && (!Number.isFinite(Number(sub.quantidade)) || Number(sub.quantidade) <= 0))));
    if (!refeicao) return;
    const item = refeicao.itens.find((linha) => !Number.isFinite(Number(linha.quantidade))
      || Number(linha.quantidade) <= 0 || (linha.substitutos || []).some((sub) =>
        sub.modo === 'fixa' && (!Number.isFinite(Number(sub.quantidade)) || Number(sub.quantidade) <= 0)));
    if (item?.substitutos?.some((sub) => sub.modo === 'fixa'
      && (!Number.isFinite(Number(sub.quantidade)) || Number(sub.quantidade) <= 0))) {
      setAbertos((atual) => new Set([...atual, item.id]));
    }
    irParaRefeicao(refeicao.id);
  };
  const corrigirRestricoes = () => {
    setAcaoConferencia(null);
    requestAnimationFrame(() => {
      const alvo = document.getElementById('pp-restricoes');
      alvo?.focus({ preventScroll: true });
      alvo?.scrollIntoView({ block: 'start' });
    });
  };

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

  const fecharBusca = useCallback(() => {
    setBuscaAtiva(null);
    buscar('');
  }, [buscar]);

  const alternarBusca = useCallback((alvo) => {
    buscar('');
    setBuscaAtiva((atual) => (atual === alvo ? null : alvo));
  }, [buscar]);

  const alternarRefeicao = useCallback((id) => {
    fecharBusca();
    setPlano((p) => ({
      ...p,
      refeicoes: p.refeicoes.map((r) => (r.id === id ? { ...r, aberta: !r.aberta } : r))
    }));
  }, [fecharBusca, setPlano]);

  const alternarItem = useCallback((itemId) => {
    fecharBusca();
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
  }, [calculado, carregarGrupo, fecharBusca]);

  const alterarQuantidade = useCallback((itemId, quantidade) => {
    mapItens((i) => (i.id === itemId ? { ...i, quantidade } : i));
  }, [mapItens]);

  const adicionarSubstituto = useCallback((itemId, op) => {
    const candidato = catalogoPorId[op.alimentoId] || candidatosPorId[op.alimentoId];
    if (!candidato) return;
    registrarAlimento(candidato);
    mapItens((i) => (
      i.id !== itemId || (i.substitutos ?? []).some((s) => s.alimentoId === op.alimentoId)
        ? i
        : {
          ...i,
          substitutos: [...(i.substitutos ?? []), { alimentoId: op.alimentoId, medidaIdx: op.medidaIdx, modo: 'auto' }]
        }
    ));
  }, [mapItens, catalogoPorId, candidatosPorId, registrarAlimento]);

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
              : { ...sub, modo: 'fixa', quantidade: quantidade === '' ? null : Math.max(0, quantidade) }
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
  const escolherSubstituto = useCallback((itemId, alimento, medidaIdx = 0) => {
    const base = itensResolvidos.find((item) => item.id === itemId);
    const automatica = base && montarOpcao(base, alimento, medidaIdx, { grupos });
    registrarAlimento(alimento);
    mapItens((i) => (
      i.id !== itemId || (i.substitutos ?? []).some((sub) => sub.alimentoId === alimento.id)
        ? i
        : { ...i, substitutos: [...(i.substitutos ?? []), {
          alimentoId: alimento.id, medidaIdx,
          modo: automatica ? 'auto' : 'fixa', ...(!automatica ? { quantidade: null } : {})
        }] }
    ));
    setBuscaAtiva(null);
  }, [itensResolvidos, grupos, mapItens, registrarAlimento]);

  const removerSubstituto = useCallback((itemId, alimentoId) => {
    mapItens((i) => (
      i.id === itemId
        ? { ...i, substitutos: (i.substitutos ?? []).filter((s) => s.alimentoId !== alimentoId) }
        : i
    ));
  }, [mapItens]);

  /** Registra o alimento no catálogo local e o acrescenta à refeição. */
  const adicionarAlimento = useCallback((refeicaoId, alimento, quantidade, medidaIdx = 0) => {
    registrarAlimento(alimento);
    setPlano((p) => ({
      ...p,
      refeicoes: p.refeicoes.map((r) => (
        r.id !== refeicaoId ? r : {
          ...r,
          itens: [...r.itens, {
            id: `i${Date.now()}`,
            alimentoId: alimento.id,
            medidaIdx,
            quantidade,
            substitutos: []
          }]
        }
      ))
    }));
    setBuscaAtiva(null);
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
    buscaAtiva,
    onBuscarSubstituto: buscar,
    onAlternarBuscaSubstituto: (itemId) => alternarBusca(`substituto:${itemId}`),
    onFecharBusca: fecharBusca,
    onEscolherSubstituto: escolherSubstituto,
    onSalvarBloco: salvarBloco,
    onAplicarBloco: aplicarBloco
  };

  if (carregando) {
    return (
      <div className="prescricao-plano">
        <p className="pp-estado" role="status">
          Carregando prescrição…
        </p>
      </div>
    );
  }

  if (!plano) {
    return (
      <div className="prescricao-plano">
        <p className="pp-aviso pp-aviso--perigo" role="alert">
          <AlertCircle className="pp-aviso__icone" aria-hidden="true" />
          <span className="pp-aviso__texto">{erro || 'Prescrição indisponível.'}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="prescricao-plano">
      {erro && (
        <p role="alert" className="pp-aviso pp-aviso--perigo">
          <AlertCircle className="pp-aviso__icone" aria-hidden="true" />
          <span className="pp-aviso__texto">{erro}</span>
        </p>
      )}

      {/* UPD-18 (UX-07): sessao expirada e o pior caso de abandono de
          edicao — ninguem escolheu sair, e o redirecionamento para o login
          levaria junto o plano em edicao. O rascunho so existe porque
          useEdicaoPendente o guardou no instante em que o evento de sessao
          expirada chegou; aqui ele e oferecido de volta, nunca aplicado
          sozinho. */}
      {draftAvailable && !draftBannerDismissed && (
        <div
          role="status"
          aria-live="polite"
          className="pp-aviso pp-aviso--atencao pp-aviso--com-acoes"
        >
          <Clock className="pp-aviso__icone" aria-hidden="true" />
          <p className="pp-aviso__texto">
            A sessão expirou enquanto havia alterações não salvas neste plano alimentar. Recupere para
            continuar de onde parou ou descarte para partir dos dados salvos.
          </p>
          <span className="pp-aviso__acoes">
            <button
              type="button"
              onClick={handleRecoverDraft}
              className="pp-botao pp-botao--secundario"
            >
              <RefreshCw className="pp-icone" aria-hidden="true" /> Recuperar rascunho
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="pp-botao pp-botao--discreto"
            >
              Descartar
            </button>
          </span>
        </div>
      )}

      {/* Cabecalho em largura total: quem e o paciente, em que estado esta o
          plano e as acoes de salvar, revisar e publicar. O h1 da pagina ja vem
          do RouteSidebarLayout; o nome do paciente e o h2. */}
      <header className="pp-cabecalho">
        <div className="pp-cabecalho__identidade">
          <button
            type="button"
            onClick={handleVoltar}
            aria-label="Voltar"
            className="pp-icone-botao pp-icone-botao--contorno"
          >
            <ArrowLeft className="pp-icone" aria-hidden="true" />
          </button>
          <div className="pp-cabecalho__texto">
            <h2 className="pp-cabecalho__titulo">
              {paciente?.nome || 'Paciente'}
            </h2>
            <p className="pp-cabecalho__apoio">
              <span>Plano alimentar</span>
              {plano.status && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className={`pp-status pp-status--${plano.status}`}>{plano.status}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="pp-cabecalho__acoes">
          <span role="status" aria-live="polite" className={alterado ? 'pp-salvo pp-salvo--pendente' : 'pp-salvo'}>
            {salvando ? 'Salvando…' : alterado ? 'Alterações não salvas' : planoId || salvoEm ? `Versão ${plano.version} salva` : 'Novo plano · ainda não salvo'}
          </span>
          {/* Uma acao solida por regiao: para quem revisa um plano em revisao
              a principal e aprovar/ativar (mesma condicao que mostra o botao
              abaixo); para os demais, salvar. So muda a classe. */}
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando || quantidadePendente}
            title={bloqueioQuantidade || undefined}
            className={podeRevisar && plano.status === 'em_revisao' ? 'pp-botao pp-botao--secundario' : 'pp-botao pp-botao--primario'}
          >
            <Save className="pp-icone" aria-hidden="true" /> {salvando ? 'Salvando…' : plano.status === 'ativo' ? 'Salvar nova versão' : 'Salvar plano'}
          </button>
          <button
            type="button"
            onClick={() => setAcaoConferencia('enviar')}
            disabled={salvando || (!alterado && plano.status === 'em_revisao')}
            className="pp-botao pp-botao--secundario"
          >
            Conferir para revisão
          </button>
          {podeRevisar && plano.status === 'em_revisao' && (
            <button type="button" disabled={salvando || alterado}
              onClick={() => setAcaoConferencia(plano.revisaoFinal?.confirmada ? 'ativar' : 'revisar')}
              className="pp-botao pp-botao--primario">
              {plano.revisaoFinal?.confirmada ? 'Conferir e ativar' : 'Conferir e aprovar'}
            </button>
          )}
          <button
            type="button"
            onClick={exportarPdf}
            disabled={!planoId || alterado || salvando}
            className="pp-botao pp-botao--secundario"
          >
            <FileText className="pp-icone" aria-hidden="true" /> PDF
          </button>
        </div>
      </header>

      {acaoConferencia && (
        <ConferenciaPlano
          pacienteNome={paciente?.nome || 'Paciente'}
          acao={acaoConferencia}
          refeicoes={refeicoesOrdenadas}
          totaisPorId={totaisPorId}
          itensPorRefeicao={itensPorRefeicao}
          opcoesPorItem={opcoesPorItem}
          valoresPorItem={valoresPorItem}
          horarioDeRefeicao={horarioDeRefeicao}
          macros={macros}
          bloqueioQuantidade={bloqueioQuantidade}
          bloqueioRevisao={bloqueioRevisao}
          salvando={salvando}
          onCancelar={() => setAcaoConferencia(null)}
          onConfirmar={confirmarConferencia}
          onCorrigirQuantidade={corrigirQuantidade}
          onCorrigirRestricoes={corrigirRestricoes}
        />
      )}

      {/* UX-03: paciente/status/acao e refeicoes vem antes da analise no
          celular. A coluna principal e sempre a primeira no DOM; na coluna
          unica o container empilha na ordem natural (sem reverter), entao
          o resumo grafico (PainelMacros) cai para o fim, nao para o topo. */}
      <div className="pp-layout">
        <div className="pp-principal">
          {plano.revisaoFinal?.confirmada && (
            <p className="pp-aviso pp-aviso--info">
              <Info className="pp-aviso__icone" aria-hidden="true" />
              <span className="pp-aviso__texto">Revisado por {plano.revisaoFinal.confirmadoPorNome} · CRN {plano.revisaoFinal.crn}. {plano.status === 'ativo' ? 'As alterações serão salvas em uma nova versão; o plano vigente permanece disponível até a próxima publicação.' : 'Salvar alterações exige nova revisão.'}</span>
            </p>
          )}
          {podeRevisar && plano.status === 'em_revisao' && Object.values(catalogoPorId).some((a) => a.origemComposicao !== 'catalogo' && !a.validacaoComposicao) && (
            <label className="pp-checagem pp-checagem--destaque">
              <input type="checkbox" checked={composicaoConferida} onChange={(e) => setComposicaoConferida(e.target.checked)} />
              <span>Conferi a origem, as unidades e a composição dos alimentos manuais ou legados deste plano.</span>
            </label>
          )}

          {bloqueioQuantidade && (
            <p role="status" className="pp-aviso pp-aviso--atencao">
              <TriangleAlert className="pp-aviso__icone" aria-hidden="true" />
              <span className="pp-aviso__texto">{bloqueioQuantidade}</span>
            </p>
          )}
          {bloqueioRevisao && (
            <p role="status" className="pp-aviso pp-aviso--atencao">
              <TriangleAlert className="pp-aviso__icone" aria-hidden="true" />
              <span className="pp-aviso__texto">{bloqueioRevisao}</span>
            </p>
          )}

          <div id="pp-restricoes" tabIndex={-1} className="pp-alvo-navegacao">
            <PainelRestricoes
              contexto={restricoesContexto}
              registro={plano.restricoes}
              grupos={grupos}
              itensEmConflito={itensEmConflito}
              onChange={(registro) => setPlano((p) => ({ ...p, restricoes: registro }))}
            />
          </div>

          {/* Ancorar refeicoes no treino so precisa destas duas informacoes;
              mudar o horario do treino move pre e pos-treino juntos. */}
          <div className="pp-parametros">
            <fieldset className="pp-parametros__treino">
              <legend className="pp-rotulo">Treino</legend>
              <div className="pp-campo">
                <label className="pp-rotulo pp-rotulo--sub" htmlFor="treino-inicio">Início do treino</label>
                <input
                  id="treino-inicio"
                  type="time"
                  value={plano.treinoInicio || ''}
                  onChange={(e) => setPlano((p) => ({ ...p, treinoInicio: e.target.value }))}
                  className="pp-controle pp-controle--hora"
                />
              </div>
              <div className="pp-campo">
                <label className="pp-rotulo pp-rotulo--sub" htmlFor="treino-duracao">Duração em minutos</label>
                <span className="pp-unidade">
                  <input
                    id="treino-duracao"
                    type="number"
                    min="0"
                    step="5"
                    value={plano.treinoDuracao ?? 60}
                    onChange={(e) => setPlano((p) => ({ ...p, treinoDuracao: Number(e.target.value) }))}
                    className="pp-controle pp-controle--num"
                  />
                  <span>min</span>
                </span>
              </div>
            </fieldset>

            <div className="pp-campo">
              <label className="pp-rotulo" htmlFor="peso-paciente">Peso</label>
              <span className="pp-unidade">
                <input
                  id="peso-paciente"
                  type="number"
                  min="0"
                  step="0.1"
                  value={plano.pesoPaciente ?? ''}
                  placeholder="—"
                  onChange={(e) => setPlano((p) => ({ ...p, pesoPaciente: e.target.value }))}
                  className="pp-controle pp-controle--num"
                />
                <span>kg</span>
              </span>
            </div>

            <div className="pp-campo">
              <label className="pp-rotulo" htmlFor="metodo">Visualização da edição</label>
              <select
                id="metodo"
                aria-describedby="metodo-nota"
                value={metodo}
                onChange={(e) => setMetodo(e.target.value)}
                className="pp-controle"
              >
                <option value="alimentos">Alimentos e quantidades</option>
                <option value="equivalentes">Equivalentes</option>
                <option value="qualitativo">Grupos alimentares</option>
              </select>
              <span id="metodo-nota" className="pp-parametros__nota">O plano entregue lista alimentos e quantidades.</span>
            </div>

            {!plano.treinoInicio && (
              <span className="pp-parametros__nota">
                — sem horário de treino, refeições ancoradas ficam sem hora
              </span>
            )}
          </div>

          <MapaRefeicoes
            refeicoes={refeicoesOrdenadas}
            totaisPorId={totaisPorId}
            itensPorRefeicao={itensPorRefeicao}
            horarioDeRefeicao={horarioDeRefeicao}
            onIr={irParaRefeicao}
          />

          <div className="pp-refeicoes">
            {refeicoesOrdenadas.map((r) => (
              <div key={r.id} id={`pp-refeicao-${r.id}`} tabIndex={-1} className="pp-refeicao-bloco pp-alvo-navegacao">
                <RefeicaoCard
                  refeicao={r}
                  horario={horarioDe(r, treino)}
                  itens={itensPorRefeicao[r.id] ?? []}
                  totais={totaisPorId[r.id] ?? TOTAIS_VAZIOS}
                  ancoraPorItem={ancoraPorItem}
                  valoresPorItem={valoresPorItem}
                  opcoesPorItem={opcoesPorItem}
                  sugestoesPorItem={sugestoesPorItem}
                  restritosPorItem={restritosPorItem}
                  abertos={abertos}
                  metodo={metodo}
                  porcoesPorItem={porcoesPorItem}
                  blocoPorAlimentoId={blocoPorAlimentoId}
                  onToggle={alternarRefeicao}
                  onAdicionarAlimento={() => alternarBusca(`alimento:${r.id}`)}
                  buscaAberta={buscaAtiva === `alimento:${r.id}`}
                  buscaAlimento={busca}
                  onBuscarAlimento={buscar}
                  onEscolherAlimento={(alimento, quantidade, medidaIdx) => adicionarAlimento(r.id, alimento, quantidade, medidaIdx)}
                  onFecharBusca={fecharBusca}
                  onEditarRefeicao={editarRefeicao}
                  onDuplicarRefeicao={duplicarRefeicao}
                  onExcluirRefeicao={excluirRefeicao}
                  onExcluirItem={(itemId) => excluirItem(r.id, itemId)}
                  {...handlers}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={adicionarRefeicao}
            className="pp-botao pp-botao--acrescentar"
          >
            <Plus className="pp-icone" aria-hidden="true" /> Adicionar refeição
          </button>

          <div className="pp-total">
            <span className="pp-total__rotulo">
              Total do dia · {plano.refeicoes.length}{' '}
              {plano.refeicoes.length === 1 ? 'refeição' : 'refeições'}
            </span>
            <span className="pp-total__valor">
              {energiaConhecida?.valor === null ? '—' : n(calculado.dia.kcal)} kcal
              {energiaConhecida?.valor !== null && energiaConhecida?.cobertura < 1 ? ' · subtotal conhecido' : ''}
              {' · '}carga glicêmica {n(calculado.dia.cargaGlicemica)}
            </span>
          </div>

          <div className="pp-acoes-finais">
            <span>{alterado ? 'Há alterações não salvas.' : 'Confira as refeições antes de concluir.'}</span>
            <div className="pp-acoes-finais__botoes">
              <button type="button" onClick={handleSalvar} disabled={salvando || quantidadePendente}
                className="pp-botao pp-botao--secundario">
                <Save className="pp-icone" aria-hidden="true" /> {salvando ? 'Salvando…' : plano.status === 'ativo' ? 'Salvar nova versão' : 'Salvar plano'}
              </button>
              {podeRevisar && plano.status === 'em_revisao' ? (
                <button type="button" disabled={salvando || alterado}
                  onClick={() => setAcaoConferencia(plano.revisaoFinal?.confirmada ? 'ativar' : 'revisar')}
                  className="pp-botao pp-botao--primario">
                  {plano.revisaoFinal?.confirmada ? 'Conferir e ativar' : 'Conferir e aprovar'}
                </button>
              ) : (
                <button type="button" disabled={salvando || (!alterado && plano.status === 'em_revisao')}
                  onClick={() => setAcaoConferencia('enviar')} className="pp-botao pp-botao--primario">
                  Conferir para revisão
                </button>
              )}
            </div>
          </div>

          {/* Paineis de apoio agrupados depois das refeicoes: primeiro a
              adequacao, depois as leituras do plano como conjunto. */}
          <div className="pp-apoio">
            <TabelaAdequacao macros={macros} micros={micros} contexto={contextoClinico} />
            {/* UX-03: analise secundaria fica recolhida por padrao — o mesmo
                padrao que a tabela de adequacao ja usa para micronutrientes.
                O conteudo continua no DOM (nao e removido), so comeca fechado. */}
            <details className="pp-detalhes">
              <summary className="pp-detalhes__resumo">
                Ver análises detalhadas do plano
              </summary>
              <Analises analises={analises} peso={metasSeguras.peso} />
            </details>

            <div className="pp-apoio__par">
              <GrauProcessamento distribuicao={distribNova} />
              <ListaCompras lista={compras} />
            </div>
          </div>
        </div>

        {/* Na coluna unica sai da lateral e vai para o fim (ver UX-03 acima). */}
        <div className="pp-lateral">
          <div className="pp-lateral__fixo">
            <PainelMacros
              dia={calculado.dia}
              metas={metasSeguras}
              distribuicao={distribuicao}
              cores={COR}
              macros={macros}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
