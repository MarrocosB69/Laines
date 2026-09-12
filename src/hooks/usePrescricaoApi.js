import { useCallback, useEffect, useRef, useState } from 'react';
import api, { getApiErrorMessage } from '../services/api';
import { adaptarAlimento, adaptarMetas } from '../services/prescricaoCatalogo';
import { migrarRefeicao } from '../core/prescricao/legado';

/**
 * Carga e persistência da prescrição.
 *
 * Fica separado de `usePlanoCalculado` de propósito: um lida com a rede, o
 * outro com o cálculo. O container costura os dois e continua sendo o único
 * lugar que conhece qualquer um deles.
 *
 * O catálogo não é carregado inteiro — são 1.767 alimentos e a tela usa
 * poucos. Ele cresce conforme a busca traz resultados, e o que o plano usa é
 * gravado junto com ele.
 */

const REFEICAO_VAZIA = (indice) => ({
  id: `r${Date.now()}-${indice}`,
  nome: `Refeição ${indice}`,
  horario: '',
  etiqueta: null,
  aberta: true,
  itens: []
});

export function usePrescricaoApi(pacienteId) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [paciente, setPaciente] = useState(null);
  const [metas, setMetas] = useState(null);
  const [planoId, setPlanoId] = useState('');
  const [plano, setPlano] = useState(null);
  const [catalogoPorId, setCatalogoPorId] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [salvoEm, setSalvoEm] = useState(null);
  const [assinaturaSalva, setAssinaturaSalva] = useState('');
  const alterado = Boolean(plano) && JSON.stringify({ plano, catalogo: catalogoPorId }) !== assinaturaSalva;

  // Evita que uma resposta atrasada da busca sobrescreva a mais recente.
  const buscaSeq = useRef(0);
  const [busca, setBusca] = useState({ termo: '', resultados: [], carregando: false, erro: '' });

  useEffect(() => {
    if (!pacienteId) return undefined;
    let vivo = true;

    (async () => {
      setCarregando(true);
      setErro('');
      try {
        const [pac, ctx, lista] = await Promise.all([
          api.get(`/pacientes/${pacienteId}`),
          api.get(`/planos-alimentares/paciente/${pacienteId}/contexto`),
          api.get('/planos-alimentares', { params: { pacienteId, limit: 1, offset: 0 } })
        ]);
        if (!vivo) return;

        const dadosPaciente = pac.data || null;
        setPaciente(dadosPaciente);
        setMetas(adaptarMetas(ctx.data, dadosPaciente?.peso ?? dadosPaciente?.pesoAtual));

        const existente = Array.isArray(lista.data?.itens)
          ? lista.data.itens[0]
          : (Array.isArray(lista.data) ? lista.data[0] : null);

        if (existente) {
          setPlanoId(existente.id || '');
          // Planos antigos nao tem instantaneo; a migracao o reconstroi a
          // partir da composicao que cada alimento ja carregava.
          const catalogo = { ...(existente.dados?.catalogo || {}) };
          const refeicoes = Array.isArray(existente.dados?.refeicoes)
            ? existente.dados.refeicoes.map((r, i) => migrarRefeicao(r, i, catalogo, existente.dados.schemaVersion))
            : [REFEICAO_VAZIA(1)];
          const carregado = {
            ...existente.dados,
            schemaVersion: 2,
            version: existente.dados?.version || 0,
            status: existente.status || 'rascunho',
            refeicoes,
            treinoInicio: existente.dados?.treinoInicio || '',
            treinoDuracao: existente.dados?.treinoDuracao ?? 60,
            pesoPaciente: existente.dados?.pesoPaciente ?? ''
          };
          setPlano(carregado);
          setCatalogoPorId(catalogo);
          setAssinaturaSalva(JSON.stringify({ plano: carregado, catalogo }));
        } else {
          setPlano({
            schemaVersion: 2, version: 0, status: 'rascunho', refeicoes: [REFEICAO_VAZIA(1)],
            treinoInicio: '', treinoDuracao: 60, pesoPaciente: ''
          });
          setCatalogoPorId({});
        }
      } catch (e) {
        if (vivo) setErro(getApiErrorMessage(e, 'Não foi possível carregar a prescrição.'));
      } finally {
        if (vivo) setCarregando(false);
      }
    })();

    return () => { vivo = false; };
  }, [pacienteId]);

  const buscar = useCallback(async (termo) => {
    setBusca((b) => ({ ...b, termo }));
    if (termo.trim().length < 2) {
      setBusca((b) => ({ ...b, resultados: [], carregando: false, erro: '' }));
      return;
    }
    const seq = buscaSeq.current + 1;
    buscaSeq.current = seq;
    setBusca((b) => ({ ...b, carregando: true, erro: '' }));
    try {
      const { data } = await api.get('/taco/buscar', { params: { q: termo, limit: 20 } });
      if (buscaSeq.current !== seq) return;
      setBusca((b) => ({
        ...b,
        carregando: false,
        resultados: (Array.isArray(data) ? data : []).map(adaptarAlimento).filter(Boolean)
      }));
    } catch (e) {
      if (buscaSeq.current !== seq) return;
      setBusca((b) => ({
        ...b,
        carregando: false,
        resultados: [],
        erro: getApiErrorMessage(e, 'Falha ao buscar alimentos.')
      }));
    }
  }, []);

  /**
   * Carrega os alimentos do grupo, para que a substituicao tenha o que sugerir.
   *
   * Sem isto, `substitutosPara` so enxerga o que ja foi adicionado ao plano e
   * nunca propoe nada novo — o painel abria vazio e parecia quebrado.
   * Cada grupo e buscado uma vez por sessao.
   */
  const gruposCarregados = useRef(new Set());

  const carregarGrupo = useCallback(async (grupo) => {
    if (!grupo || gruposCarregados.current.has(grupo)) return;
    gruposCarregados.current.add(grupo);
    try {
      // 100 e o teto do endpoint; pedir mais devolve 400 e a sugestao some.
      const { data } = await api.get('/taco/buscar', { params: { grupo, limit: 100 } });
      const novos = (Array.isArray(data) ? data : []).map(adaptarAlimento).filter(Boolean);
      setCatalogoPorId((atual) => {
        const proximo = { ...atual };
        // Nao sobrescreve o que ja esta la: o plano guarda o instantaneo dele.
        for (const a of novos) if (!proximo[a.id]) proximo[a.id] = a;
        return proximo;
      });
    } catch (e) {
      // Falhar aqui nao quebra a prescricao, mas engolir em silencio esconde
      // o motivo de o painel abrir vazio — que foi exatamente o que ocorreu.
      gruposCarregados.current.delete(grupo);
      setErro(getApiErrorMessage(e, `Não foi possível carregar opções de ${grupo}.`));
    }
  }, []);

  /** Guarda o alimento no catálogo local para que o cálculo o encontre. */
  const registrarAlimento = useCallback((alimento) => {
    setCatalogoPorId((atual) => (atual[alimento.id] ? atual : { ...atual, [alimento.id]: alimento }));
  }, []);

  const salvar = useCallback(async (statusDesejado) => {
    if (!plano || !pacienteId) return;
    setSalvando(true);
    setErro('');
    try {
      const payload = {
        pacienteId,
        expectedVersion: plano.version || 0,
        status: statusDesejado || (plano.status === 'ativo' ? 'rascunho' : plano.status) || 'rascunho',
        metaCalorica: metas?.kcal == null ? null : Math.round(metas.kcal),
        metaCHOg: metas?.cho == null ? null : Math.round(metas.cho),
        metaPTNg: metas?.ptn == null ? null : Math.round(metas.ptn),
        metaLIPg: metas?.lip == null ? null : Math.round(metas.lip),
        metaFibrasg: metas?.fibra == null ? null : Math.round(metas.fibra),
        dados: {
          ...plano,
          schemaVersion: 2,
          refeicoes: plano.refeicoes,
          // Horario do treino: e o que ancora pre e pos-treino, entao precisa
          // viajar com o plano.
          treinoInicio: plano.treinoInicio ?? null,
          treinoDuracao: plano.treinoDuracao ?? null,
          // O cadastro do paciente nao tem peso; o informado aqui viaja junto.
          pesoPaciente: Number(plano.pesoPaciente) || null,
          // Instantaneo do catalogo usado por este plano.
          catalogo: catalogoPorId
        }
      };
      const { data } = planoId
        ? await api.patch(`/planos-alimentares/${planoId}`, payload)
        : await api.post('/planos-alimentares', payload);
      setPlanoId(data?.id || planoId);
      const saved = { ...plano, ...data.dados, status: data.status };
      const catalogo = data.dados?.catalogo || catalogoPorId;
      setPlano(saved);
      setCatalogoPorId(catalogo);
      setAssinaturaSalva(JSON.stringify({ plano: saved, catalogo }));
      setSalvoEm(new Date());
      return data;
    } catch (e) {
      setErro(getApiErrorMessage(e, 'Não foi possível salvar o plano alimentar.'));
    } finally {
      setSalvando(false);
    }
  }, [plano, pacienteId, metas, catalogoPorId, planoId]);

  const transicionar = useCallback(async (acao, confirmarComposicaoManual = false) => {
    if (!planoId || salvando || alterado) return;
    setSalvando(true);
    setErro('');
    try {
      const { data } = await api.post(`/planos-alimentares/${planoId}/${acao}`, {
        expectedVersion: plano.version || 0, confirmarComposicaoManual
      });
      const saved = { ...plano, ...data.dados, status: data.status };
      const catalogo = data.dados?.catalogo || catalogoPorId;
      setPlano(saved);
      setCatalogoPorId(catalogo);
      setAssinaturaSalva(JSON.stringify({ plano: saved, catalogo }));
      setSalvoEm(new Date());
    } catch (e) {
      setErro(getApiErrorMessage(e, 'Não foi possível atualizar a revisão do plano.'));
    } finally {
      setSalvando(false);
    }
  }, [planoId, plano, catalogoPorId, salvando, alterado]);

  const exportarPdf = useCallback(async () => {
    if (!planoId) return;
    setErro('');
    try {
      const { data } = await api.get(`/planos-alimentares/${planoId}/pdf`, {
        params: { expectedVersion: plano?.version || 0 }, responseType: 'blob'
      });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `plano-alimentar-${planoId}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setErro(e.response?.status === 409 ? 'O plano foi atualizado. Recarregue a prescrição antes de baixar o PDF.' : getApiErrorMessage(e, 'Não foi possível exportar o PDF do plano salvo.'));
    }
  }, [planoId, plano?.version]);

  return {
    carregando, erro, paciente, metas, plano, setPlano,
    catalogoPorId, registrarAlimento,
    busca, buscar, carregarGrupo,
    salvar, salvando, salvoEm, planoId, transicionar, exportarPdf, alterado
  };
}

export default usePrescricaoApi;
