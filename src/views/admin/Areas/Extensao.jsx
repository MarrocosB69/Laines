import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Calendar, ChevronDown, ClipboardList, FileText, Plus, RefreshCw, Trash2, Paperclip, Download, X } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import api, { getApiErrorMessage } from '../../../services/api';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { AttachmentThumbnail } from '../../../components/ui';
import { PainelIndicadores, PainelLista, PainelSecao, PainelVisaoGeral } from '../../../components/painel/Painel';
import {
  canManageContentArea,
  formatList,
  getContentStatusLabel,
  getStatusOptionsForUser,
  splitCommaList
} from './contentAreaUtils';
import './Areas.css';

const EXTENSAO_SECTIONS = new Set(['overview', 'triagens', 'capacitacoes', 'materiais']);
const PRIORIDADES_TRIAGEM = [
  { nivel: 'vermelho', rotulo: 'Contato prioritário' },
  { nivel: 'amarelo', rotulo: 'Contato antecipado' },
  { nivel: 'cinza', rotulo: 'Revisar dados' },
  { nivel: 'verde', rotulo: 'Contato de rotina' }
];

const getTriagemPrioridade = (item) => {
  const prioridade = item?.prioridadeContato;
  const nivel = PRIORIDADES_TRIAGEM.some((faixa) => faixa.nivel === prioridade?.nivel)
    ? prioridade.nivel : 'cinza';
  return {
    nivel,
    rotulo: prioridade?.rotulo || PRIORIDADES_TRIAGEM.find((faixa) => faixa.nivel === nivel)?.rotulo,
    pontos: Number.isInteger(prioridade?.pontos) && prioridade.pontos >= 0 && prioridade.pontos <= 3
      ? prioridade.pontos : null,
    motivos: Array.isArray(prioridade?.motivos) ? prioridade.motivos : []
  };
};

const formatTriagemData = (value) => {
  if (!value) return '';
  const data = new Date(value);
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleDateString('pt-BR');
};

const getAreaItemKey = (prefix, item, index) => {
  const id = String(item?.id || '').trim();
  if (id) return id;
  const label = String(item?.titulo || item?.nome || item?.tipo || item?.data || 'item').trim();
  return `${prefix}-${index}-${label || 'item'}`;
};

const Extensao = ({ section = 'overview', onSectionChange } = {}) => {
  const { notify, confirm } = useUiFeedback();
  const { user } = useAuth();
  const [capacitacoes, setCapacitacoes] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [triagensPublicas, setTriagensPublicas] = useState([]);
  const [loadingTriagens, setLoadingTriagens] = useState(false);
  const [erroTriagens, setErroTriagens] = useState('');
  const [triagemAccessDenied, setTriagemAccessDenied] = useState(false);
  const [triagemAbertaId, setTriagemAbertaId] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('todas');
  const [exportandoTriagens, setExportandoTriagens] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [capacitacaoFile, setCapacitacaoFile] = useState(null);
  const [materialFile, setMaterialFile] = useState(null);
  const [capForm, setCapForm] = useState({
    titulo: '',
    status: 'em_andamento',
    publico: 'interno',
    cursos: '',
    data: '',
    descricao: '',
    profissionalNome: '',
    profissionalCredencial: '',
    equipeOrganizacao: ''
  });
  const [matForm, setMatForm] = useState({
    titulo: '',
    tipo: 'material',
    status: 'em_andamento',
    link: '',
    descricao: '',
    autores: ''
  });

  const fileInputRef = useRef(null);
  const capacitacaoFileInputRef = useRef(null);
  const materialFileInputRef = useRef(null);
  const uploadTargetIdRef = useRef(null);
  const canManageExtensao = useMemo(() => (
    canManageContentArea(user, 'extensao')
  ), [user]);
  const canViewTriagens = canManageExtensao && !triagemAccessDenied;
  const contagensTriagens = useMemo(() => PRIORIDADES_TRIAGEM.reduce((total, faixa) => ({
    ...total,
    [faixa.nivel]: triagensPublicas.filter((item) => getTriagemPrioridade(item).nivel === faixa.nivel).length
  }), {}), [triagensPublicas]);
  const triagensFiltradas = useMemo(() => (
    filtroPrioridade === 'todas' ? triagensPublicas
      : triagensPublicas.filter((item) => getTriagemPrioridade(item).nivel === filtroPrioridade)
  ), [triagensPublicas, filtroPrioridade]);
  const statusOptions = useMemo(() => getStatusOptionsForUser(user), [user]);
  const activeSection = EXTENSAO_SECTIONS.has(section) ? section : 'overview';
  const sectionMeta = {
    overview: {
      title: 'Extensão',
      description: 'Triagens, capacitações e materiais produzidos pela liga.'
    },
    triagens: {
      title: 'Triagens públicas',
      description: 'Demandas recebidas pelo formulário inicial e encaminhadas para organização da extensão.'
    },
    capacitacoes: {
      title: 'Capacitações',
      description: 'Planejamento, responsáveis e equipe de organização das capacitações.'
    },
    materiais: {
      title: 'Materiais de extensão',
      description: 'Guias, protocolos e materiais criados pela liga com autoria registrada.'
    }
  }[activeSection];

  const handleNavigateSection = useCallback((nextSection) => {
    onSectionChange?.(nextSection);
  }, [onSectionChange]);

  const loadTriagensPublicas = useCallback(async () => {
    if (!canManageExtensao) {
      setTriagensPublicas([]);
      return;
    }
    setLoadingTriagens(true);
    setErroTriagens('');
    try {
      const { data } = await api.get('/pacientes/triagem-publica');
      setTriagemAccessDenied(false);
      setTriagensPublicas(Array.isArray(data) ? data : []);
    } catch (error) {
      if (error?.response?.status === 403) {
        setTriagemAccessDenied(true);
      } else {
        setErroTriagens(getApiErrorMessage(error, 'Não foi possível carregar as triagens públicas.'));
      }
      setTriagensPublicas([]);
    } finally {
      setLoadingTriagens(false);
    }
  }, [canManageExtensao]);

  const handleExportarTriagens = async () => {
    if (!canViewTriagens || exportandoTriagens) return;
    setExportandoTriagens(true);
    try {
      const { data } = await api.get('/pacientes/triagem-publica/relatorio.pdf', { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fila-triagem-publica-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (error?.response?.status === 403) {
        setTriagemAccessDenied(true);
        setTriagensPublicas([]);
      } else {
        notify({
          type: 'error',
          title: 'Erro ao exportar fila',
          message: getApiErrorMessage(error, 'Não foi possível baixar o relatório de triagens.')
        });
      }
    } finally {
      setExportandoTriagens(false);
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [capRes, matRes] = await Promise.all([
        api.get('/conteudos', { params: { categoria: 'capacitacoes' } }),
        api.get('/conteudos', { params: { categoria: 'materiais_extensao' } })
      ]);
      setCapacitacoes(capRes.data || []);
      setMateriais(matRes.data || []);
    } catch (error) {
      notify({
        type: 'error',
        title: 'Erro ao carregar dados',
        message: getApiErrorMessage(error, 'Não foi possível carregar os dados da extensão.')
      });
    }
  }, [notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadTriagensPublicas();
  }, [loadTriagensPublicas]);

  const clearFileInput = (ref) => {
    if (ref.current) ref.current.value = '';
  };

  const uploadCreatedConteudoFile = async (id, file) => {
    if (!id || !file) return;

    const formData = new FormData();
    formData.append('file', file);
    await api.post(`/conteudos/${id}/arquivo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  };

  const handleAddCapacitacao = async (event) => {
    event.preventDefault();
    if (!capForm.titulo.trim()) return;
    try {
      const { data } = await api.post('/conteudos', {
        categoria: 'capacitacoes',
        ...capForm,
        cursos: splitCommaList(capForm.cursos),
        equipeOrganizacao: splitCommaList(capForm.equipeOrganizacao)
      });
      await uploadCreatedConteudoFile(data?.id, capacitacaoFile);
      setCapForm({
        titulo: '',
        status: 'em_andamento',
        publico: 'interno',
        cursos: '',
        data: '',
        descricao: '',
        profissionalNome: '',
        profissionalCredencial: '',
        equipeOrganizacao: ''
      });
      setCapacitacaoFile(null);
      clearFileInput(capacitacaoFileInputRef);
      await loadData();
    } catch (error) {
      notify({
        type: 'error',
        title: 'Erro ao criar capacitação',
        message: getApiErrorMessage(error, 'Não foi possível cadastrar a capacitação.')
      });
    }
  };

  const handleAddMaterial = async (event) => {
    event.preventDefault();
    if (!matForm.titulo.trim()) return;
    try {
      const { data } = await api.post('/conteudos', {
        categoria: 'materiais_extensao',
        ...matForm,
        autores: splitCommaList(matForm.autores)
      });
      await uploadCreatedConteudoFile(data?.id, materialFile);
      setMatForm({ titulo: '', tipo: 'material', status: 'em_andamento', link: '', descricao: '', autores: '' });
      setMaterialFile(null);
      clearFileInput(materialFileInputRef);
      await loadData();
    } catch (error) {
      notify({
        type: 'error',
        title: 'Erro ao criar material',
        message: getApiErrorMessage(error, 'Não foi possível cadastrar o material.')
      });
    }
  };

  const handleDelete = async (_collectionName, id, title) => {
    const accepted = await confirm({
      title: 'Remover conteúdo',
      message: `Deseja remover "${title || 'item selecionado'}"?`,
      confirmLabel: 'Remover',
      cancelLabel: 'Cancelar',
      variant: 'danger'
    });
    if (!accepted) return;

    try {
      await api.delete(`/conteudos/${id}`);
      await loadData();
      notify({
        type: 'success',
        title: 'Conteúdo removido',
        message: 'O item foi removido com sucesso.'
      });
    } catch (error) {
      notify({
        type: 'error',
        title: 'Erro ao remover conteúdo',
        message: getApiErrorMessage(error, 'Não foi possível remover o item.')
      });
    }
  };

  const triggerUpload = (id) => {
    uploadTargetIdRef.current = id;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    const id = uploadTargetIdRef.current;
    e.target.value = '';
    if (!file || !id) return;

    setUploadingId(id);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/conteudos/${id}/arquivo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await loadData();
      notify({ type: 'success', title: 'Arquivo anexado', message: 'O arquivo foi salvo com sucesso.' });
    } catch (error) {
      notify({ type: 'error', title: 'Erro no upload', message: getApiErrorMessage(error, 'Não foi possível enviar o arquivo.') });
    } finally {
      setUploadingId(null);
    }
  };

  const handleDownloadArquivo = async (id, nome) => {
    try {
      const res = await api.get(`/conteudos/${id}/arquivo`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = nome || 'arquivo';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      notify({ type: 'error', title: 'Erro no download', message: getApiErrorMessage(error, 'Não foi possível baixar o arquivo.') });
    }
  };

  const handleRemoveArquivo = async (id) => {
    const accepted = await confirm({
      title: 'Remover arquivo',
      message: 'Deseja remover o arquivo anexado?',
      confirmLabel: 'Remover',
      cancelLabel: 'Cancelar',
      variant: 'danger'
    });
    if (!accepted) return;
    try {
      await api.delete(`/conteudos/${id}/arquivo`);
      await loadData();
      notify({ type: 'success', title: 'Arquivo removido', message: 'O arquivo foi removido.' });
    } catch (error) {
      notify({ type: 'error', title: 'Erro', message: getApiErrorMessage(error, 'Não foi possível remover o arquivo.') });
    }
  };

  const getTriagemDados = (item) => (
    item?.confirmacaoAtleta?.inscricaoPublica?.dados
    || item?.confirmacaoAtleta?.dados
    || {}
  );

  const formatTriagemValue = (value) => {
    if (value === null || value === undefined || value === '') return '';
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry || '').trim()).filter(Boolean).join(', ');
    }
    if (typeof value === 'object') {
      return Object.entries(value)
        .map(([key, entry]) => {
          if (Array.isArray(entry)) {
            const text = entry.map((item) => String(item || '').trim()).filter(Boolean).join(', ');
            return text ? `${key}: ${text}` : '';
          }
          const text = String(entry || '').trim();
          return text ? `${key}: ${text}` : '';
        })
        .filter(Boolean)
        .join(' | ');
    }
    return String(value).trim();
  };

  const renderTriagemChips = (label, value) => {
    const items = Array.isArray(value)
      ? value.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];
    if (!items.length) return null;
    return (
      <div className="area-triagem-row">
        <span>{label}</span>
        <ul className="area-triagem-chips">
          {items.map((entry, index) => <li key={`${label}-${index}-${entry}`}>{entry}</li>)}
        </ul>
      </div>
    );
  };

  const renderTriagemDetail = (item) => {
    const dados = getTriagemDados(item);
    const prioridade = getTriagemPrioridade(item);
    const esportes = Array.isArray(dados.esportes) ? dados.esportes : [];
    const descricaoEsportes = esportes.map((esporte, index) => [
      esporte.modalidade,
      (esporte.frequenciaSemanal || (index === 0 && dados.frequenciaSemanal))
        ? `${esporte.frequenciaSemanal || dados.frequenciaSemanal}×/semana` : '',
      esporte.tempoPratica ? `tempo de prática: ${esporte.tempoPratica}` : '',
      esporte.duracaoSessao ? `${esporte.duracaoSessao} min/sessão` : ''
    ].filter(Boolean).join(' · ')).filter(Boolean).join(' | ');
    const simNao = (value) => value === true ? 'Sim' : value === false ? 'Não' : 'Não informado';
    const impactoLesao = {
      normal: 'Prática normal',
      adaptada: 'Prática adaptada',
      interrompida: 'Prática interrompida'
    }[dados.impactoLesao] || (dados.lesaoAtual === false && dados.lesaoUltimos3Meses === false
      ? 'Não se aplica' : 'Não informado');
    const ebiaRespostas = Array.isArray(dados?.ebia?.respostas) ? dados.ebia.respostas : [];
    const ebiaResumo = ebiaRespostas.length
      ? `${ebiaRespostas.filter((entry) => String(entry?.resposta || '').toLowerCase() === 'sim').length}/${ebiaRespostas.length} positivas`
      : '';
    const fields = [
      ['Inscrição recebida', formatTriagemData(item.createdAt)],
      ['Contato', [item.telefone || dados.telefone, item.email || dados.email].filter(Boolean).join(' | ')],
      ['Cidade/UF', [item.cidade || dados.cidade, item.estado || dados.estado].filter(Boolean).join(' / ')],
      [esportes.length ? 'Esportes' : 'Modalidade', descricaoEsportes || item.modalidadePrincipal || dados.modalidadePrincipal],
      ['Objetivo', dados.objetivo],
      ['Treino', esportes.length ? '' : [dados.frequenciaSemanal ? `${dados.frequenciaSemanal}x/sem` : '', dados.duracaoSessao ? `${dados.duracaoSessao} min` : '', dados.intensidade].filter(Boolean).join(' | ')],
      ['Lesão ou dor atual', simNao(dados.lesaoAtual)],
      ['Lesão nos últimos 3 meses', simNao(dados.lesaoUltimos3Meses)],
      ['Efeito atual na prática', impactoLesao],
      ['Renda', dados.rendaMensal],
      ['Escolaridade', dados.escolaridade],
      ['Hidratacao', dados.hidratacao ? `${dados.hidratacao} L/dia` : ''],
      ['Bristol', dados.bristol ? `Tipo ${dados.bristol}` : ''],
      ['Urina', [dados.urinaPrimeira ? `primeira: ${dados.urinaPrimeira}` : '', dados.urinaUltima ? `ultima: ${dados.urinaUltima}` : ''].filter(Boolean).join(' | ')],
      ['EBIA inicial', ebiaResumo],
      ['Como soube', dados.comoSoube],
      ['Responsavel legal', [dados.nomeResponsavel, dados.cpfResponsavel ? `CPF: ${dados.cpfResponsavel}` : ''].filter(Boolean).join(' | ')],
      ['Observacoes', dados.observacoes]
    ].filter(([, value]) => formatTriagemValue(value));

    return (
      <div className="area-triagem-detail">
        <div className="area-triagem-justificativa">
          <strong>Motivos da prioridade de contato{prioridade.pontos !== null ? ` · ${prioridade.pontos}/3 pontos` : ''}</strong>
          <ul>
            {(prioridade.motivos.length ? prioridade.motivos : ['Conferir respostas da triagem.'])
              .map((motivo, index) => <li key={`${index}-${motivo}`}>{motivo}</li>)}
          </ul>
          <p>Ordem para revisão da equipe; não define diagnóstico nem aptidão esportiva.</p>
        </div>
        {/* Lista de descrição: cada rótulo fica ligado ao próprio valor. */}
        <dl className="area-triagem-grid">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{formatTriagemValue(value)}</dd>
            </div>
          ))}
        </dl>
        {renderTriagemChips('Avaliacoes solicitadas', dados.avaliacaoSolicitada)}
        {renderTriagemChips('Condicoes pessoais', dados.comorbidadesPessoais)}
        {renderTriagemChips('Sinais relatados', dados.sinaisClinicos)}
        {renderTriagemChips('Exames informados', dados.examesRealizados)}
        {formatTriagemValue(dados.comorbidadesFamiliares) && (
          <div className="area-triagem-row">
            <span>Historico familiar</span>
            <strong>{formatTriagemValue(dados.comorbidadesFamiliares)}</strong>
          </div>
        )}
      </div>
    );
  };

  const renderItemMeta = (item, fallback) => (
    <>
      <span>{fallback}</span>
      <span className={`area-status-chip area-status-chip--${item.status || 'sem_status'}`}>
        {getContentStatusLabel(item.status)}
      </span>
      {item.profissionalNome && <span>Profissional: {item.profissionalNome}</span>}
      {item.profissionalCredencial && <span>Credencial: {item.profissionalCredencial}</span>}
      {formatList(item.equipeOrganizacao) && <span>Equipe: {formatList(item.equipeOrganizacao)}</span>}
      {formatList(item.autores) && <span>Autoria: {formatList(item.autores)}</span>}
      {item.arquivoNome && (
        <span className="area-item-filename">
          <Paperclip size={10} /> {item.arquivoNome}
        </span>
      )}
    </>
  );

  const renderItemThumbnail = (item) => (
    item.arquivoNome ? (
      <AttachmentThumbnail
        className="area-item-thumbnail"
        compact
        name={item.arquivoNome}
        mimeType={item.arquivoMime || ''}
      />
    ) : null
  );

  const renderItemActions = (item) => (
    <div className="area-item-actions">
      {item.arquivoNome ? (
        <>
          <button
            type="button"
            className="area-item-btn area-item-btn--download"
            title={`Baixar: ${item.arquivoNome}`}
            onClick={() => handleDownloadArquivo(item.id, item.arquivoNome)}
          >
            <Download size={14} />
          </button>
          {canManageExtensao && (
          <>
          <button
            type="button"
            className="area-item-btn area-item-btn--attach"
            title="Substituir arquivo"
            onClick={() => triggerUpload(item.id)}
            disabled={uploadingId === item.id}
          >
            <Paperclip size={14} />
          </button>
          <button
            type="button"
            className="area-item-btn area-item-btn--remove-file"
            title="Remover arquivo"
            onClick={() => handleRemoveArquivo(item.id)}
          >
            <X size={12} />
          </button>
          </>
          )}
        </>
      ) : canManageExtensao ? (
        <button
          type="button"
          className="area-item-btn area-item-btn--attach"
          title="Anexar arquivo"
          onClick={() => triggerUpload(item.id)}
          disabled={uploadingId === item.id}
        >
          {uploadingId === item.id ? (
            <span className="area-item-uploading">…</span>
          ) : (
            <Paperclip size={14} />
          )}
        </button>
      ) : null}
      {canManageExtensao && (
      <button
        type="button"
        className="area-item-btn area-item-btn--delete"
        title="Remover item"
        onClick={() => handleDelete('', item.id, item.titulo)}
      >
        <Trash2 size={14} />
      </button>
      )}
    </div>
  );

  const overviewCards = [
    {
      id: 'triagens',
      title: 'Triagens públicas',
      description: canViewTriagens
        ? 'Receber, revisar e preparar demandas do formulário inicial.'
        : 'Acesso restrito à coordenação e diretoria de extensão.',
      count: triagensPublicas.length,
      icon: ClipboardList,
      disabled: !canViewTriagens
    },
    {
      id: 'capacitacoes',
      title: 'Capacitações',
      description: 'Eventos formativos com profissional responsável e equipe organizadora.',
      count: capacitacoes.length,
      icon: Calendar
    },
    {
      id: 'materiais',
      title: 'Materiais',
      description: 'Guias, protocolos e materiais com autoria registrada.',
      count: materiais.length,
      icon: FileText
    }
  ];

  return (
    <div className="area-page">
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
        onChange={handleFileChange}
      />

      <header className="area-header">
        <div>
          <h2>{sectionMeta.title}</h2>
          <p>{sectionMeta.description}</p>
        </div>
        <div className="area-badges">
          {canViewTriagens && (
            <span className="area-badge"><ClipboardList size={14} /> {triagensPublicas.length} triagens</span>
          )}
          <span className="area-badge"><Calendar size={14} /> {capacitacoes.length} capacitações</span>
          <span className="area-badge"><FileText size={14} /> {materiais.length} materiais</span>
        </div>
      </header>

      {!canManageExtensao && (
        <div className="area-readonly-note">
          <Calendar size={14} />
          Visualizacao dos itens publicados, aprovados ou em andamento.
        </div>
      )}

      {/* Painel da área com as peças da Visão geral, como em Ensino. O cartão
          de triagens sem acesso (card.disabled) não vira botão, e o número
          vira traço com "sem dado": a lista nem é carregada para quem não
          gerencia, então o 0 de antes afirmava algo que ninguém mediu. */}
      {activeSection === 'overview' && (
        <PainelVisaoGeral className="area-painel">
          <PainelSecao
            id="extensao-operacao"
            className="area-painel__operacao"
            titulo="Operação da extensão"
            descricao={canManageExtensao
              ? 'Escolha uma frente para revisar, publicar ou editar em página inteira.'
              : 'Escolha uma frente para consultar o que já foi publicado.'}
          >
            <PainelIndicadores
              rotulo="Operação da extensão"
              itens={overviewCards.map((card) => ({
                id: card.id,
                rotulo: card.title,
                valor: card.disabled ? null : card.count,
                detalhe: card.description,
                icone: card.icon,
                onClick: card.disabled ? undefined : () => handleNavigateSection(card.id)
              }))}
            />
          </PainelSecao>
          <PainelSecao
            id="extensao-proximas-capacitacoes"
            className="area-painel__raia"
            titulo="Próximas capacitações"
            estado={capacitacoes.length === 0 ? 'vazio' : 'pronto'}
            vazio={{ titulo: 'Nenhuma capacitação cadastrada.' }}
          >
            <PainelLista
              rotuloAcessivel="Próximas capacitações"
              itens={(capacitacoes.slice(0, 4)).map((item, index) => ({
                id: getAreaItemKey('extensao-overview-capacitacao', item, index),
                titulo: item.titulo,
                meta: item.data || getContentStatusLabel(item.status),
                onClick: () => handleNavigateSection('capacitacoes')
              }))}
            />
          </PainelSecao>
          <PainelSecao
            id="extensao-materiais-recentes"
            className="area-painel__raia"
            titulo="Materiais recentes"
            estado={materiais.length === 0 ? 'vazio' : 'pronto'}
            vazio={{ titulo: 'Nenhum material cadastrado.' }}
          >
            <PainelLista
              rotuloAcessivel="Materiais recentes"
              itens={(materiais.slice(0, 4)).map((item, index) => ({
                id: getAreaItemKey('extensao-overview-material', item, index),
                titulo: item.titulo,
                meta: getContentStatusLabel(item.status),
                onClick: () => handleNavigateSection('materiais')
              }))}
            />
          </PainelSecao>
        </PainelVisaoGeral>
      )}

      {activeSection === 'triagens' && !canViewTriagens && (
        <div className="area-restricted-panel">
          <span className="area-restricted-panel__icone" aria-hidden="true"><ClipboardList size={22} /></span>
          <strong>Triagens restritas</strong>
          <p>As respostas da triagem pública ficam disponíveis apenas para os perfis autorizados da coordenação e diretoria de extensão.</p>
        </div>
      )}

      {activeSection === 'triagens' && canViewTriagens && (
        <section className="area-card area-card--triagem">
          <div className="area-card-header">
            <div>
              <h3>Triagens públicas</h3>
              <p>Fila de contato das inscrições públicas, organizada para revisão da equipe.</p>
            </div>
            <div className="area-triagem-actions">
              <button
                type="button"
                className="area-triagem-export"
                onClick={handleExportarTriagens}
                disabled={exportandoTriagens || loadingTriagens || triagensPublicas.length === 0}
              >
                <Download size={16} aria-hidden="true" />
                {exportandoTriagens ? 'Gerando PDF...' : 'Exportar fila em PDF'}
              </button>
              <button
                type="button"
                className="area-item-btn area-item-btn--attach"
                title="Atualizar triagens"
                aria-label="Atualizar triagens"
                onClick={loadTriagensPublicas}
                disabled={loadingTriagens}
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          <div className="area-triagem-controls">
            <p>A ordem indica prioridade de contato, sujeita à revisão humana. Não representa diagnóstico ou aptidão esportiva.</p>
            <div className="area-triagem-legenda" aria-label="Faixas da fila">
              {PRIORIDADES_TRIAGEM.map((faixa) => (
                <span key={faixa.nivel} className={`area-triagem-prioridade area-triagem-prioridade--${faixa.nivel}`}>
                  {faixa.rotulo} · {contagensTriagens[faixa.nivel] || 0}
                </span>
              ))}
            </div>
            <label className="area-triagem-filter">
              <span>Mostrar</span>
              <select value={filtroPrioridade} onChange={(event) => setFiltroPrioridade(event.target.value)}>
                <option value="todas">Todas as prioridades ({triagensPublicas.length})</option>
                {PRIORIDADES_TRIAGEM.map((faixa) => (
                  <option key={faixa.nivel} value={faixa.nivel}>
                    {faixa.rotulo} ({contagensTriagens[faixa.nivel] || 0})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="area-list area-triagem-list">
            {loadingTriagens ? (
              <div className="area-empty laines-feedback-state">Carregando triagens...</div>
            ) : erroTriagens ? (
              <div className="area-empty laines-feedback-state" role="alert">
                <span>{erroTriagens}</span>
                <button type="button" className="area-triagem-export" onClick={loadTriagensPublicas}>
                  Tentar novamente
                </button>
              </div>
            ) : triagensPublicas.length === 0 ? (
              <div className="area-empty laines-feedback-state">Nenhuma triagem pública pendente.</div>
            ) : triagensFiltradas.length === 0 ? (
              <div className="area-empty laines-feedback-state">Nenhuma triagem nesta prioridade.</div>
            ) : (
              triagensFiltradas.map((item, index) => {
                const dados = getTriagemDados(item);
                const prioridade = getTriagemPrioridade(item);
                const dataInscricao = formatTriagemData(item.createdAt);
                const isOpen = triagemAbertaId === item.id;
                return (
                  <article key={getAreaItemKey('extensao-triagem', item, index)} className="area-triagem-item">
                    <button
                      type="button"
                      className="area-triagem-summary"
                      onClick={() => setTriagemAbertaId((current) => (current === item.id ? '' : item.id))}
                      aria-expanded={isOpen}
                    >
                      {/* span, não div: botão só aceita conteúdo em linha. */}
                      <span className="area-triagem-summary__posicao">#{item.posicaoFila || '—'}</span>
                      <span className="area-triagem-summary__texto">
                        <strong>{item.nome || dados.nome || 'Atleta sem nome'}</strong>
                        <span>
                          {item.prontuario || 'Sem prontuário'} · {item.modalidadePrincipal || dados.modalidadePrincipal || 'Modalidade não informada'}
                          {dataInscricao ? ` · Inscrição ${dataInscricao}` : ''}
                        </span>
                      </span>
                      <span className={`area-triagem-prioridade area-triagem-prioridade--${prioridade.nivel}`}>
                        {prioridade.rotulo}{prioridade.pontos !== null ? ` · ${prioridade.pontos}/3` : ''}
                      </span>
                      <span className="area-status-chip area-status-chip--em_andamento">
                        {item.status || 'Triagem Pública'}
                      </span>
                      <ChevronDown className="area-triagem-seta" size={18} aria-hidden="true" />
                    </button>
                    {isOpen && renderTriagemDetail(item)}
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}

      {(activeSection === 'capacitacoes' || activeSection === 'materiais') && (
      <div className="area-grid area-grid--single">
        {activeSection === 'capacitacoes' && (
        <section className="area-card">
          <div className="area-card-header">
            <div>
              <h3>Capacitações</h3>
              <p>Cadastre treinamentos internos ou externos.</p>
            </div>
          </div>
          {canManageExtensao ? (
          <form className="area-form" onSubmit={handleAddCapacitacao}>
            <input
              type="text"
              placeholder="Título da capacitação"
              value={capForm.titulo}
              onChange={(e) => setCapForm((prev) => ({ ...prev, titulo: e.target.value }))}
            />
            <select
              value={capForm.publico}
              onChange={(e) => setCapForm((prev) => ({ ...prev, publico: e.target.value }))}
            >
              <option value="interno">Interno</option>
              <option value="externo">Externo</option>
            </select>
            <select
              value={capForm.status}
              onChange={(e) => setCapForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Cursos participantes (separe por vírgula)"
              value={capForm.cursos}
              onChange={(e) => setCapForm((prev) => ({ ...prev, cursos: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Profissional responsavel"
              value={capForm.profissionalNome}
              onChange={(e) => setCapForm((prev) => ({ ...prev, profissionalNome: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Credencial profissional (CRN, CREFITO...)"
              value={capForm.profissionalCredencial}
              onChange={(e) => setCapForm((prev) => ({ ...prev, profissionalCredencial: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Equipe de organizacao (separe por virgula)"
              value={capForm.equipeOrganizacao}
              onChange={(e) => setCapForm((prev) => ({ ...prev, equipeOrganizacao: e.target.value }))}
            />
            <input
              type="date"
              value={capForm.data}
              onChange={(e) => setCapForm((prev) => ({ ...prev, data: e.target.value }))}
            />
            <textarea
              rows="3"
              placeholder="Descrição"
              value={capForm.descricao}
              onChange={(e) => setCapForm((prev) => ({ ...prev, descricao: e.target.value }))}
            />
            <label className="area-form-attachment">
              <span>Anexo</span>
              <input
                ref={capacitacaoFileInputRef}
                className="attachment-thumbnail__input"
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={(event) => setCapacitacaoFile(event.target.files?.[0] || null)}
              />
              <AttachmentThumbnail
                file={capacitacaoFile}
                emptyTitle="Selecionar anexo"
                emptyDescription="PDF, DOC, PNG ou JPG"
                description="Arquivo selecionado para esta capacitacao."
                onRemove={capacitacaoFile ? () => {
                  setCapacitacaoFile(null);
                  clearFileInput(capacitacaoFileInputRef);
                } : null}
              />
            </label>
            <button type="submit" className="area-action">
              <Plus size={16} /> Adicionar
            </button>
          </form>
          ) : (
            <div className="area-readonly-inline">Cadastro restrito a coordenacao e diretoria de extensao.</div>
          )}
          <div className="area-list">
            {capacitacoes.length === 0 ? (
              <div className="area-empty laines-feedback-state">Nenhuma capacitação cadastrada.</div>
            ) : (
              capacitacoes.map((item, index) => (
                <div key={getAreaItemKey('extensao-capacitacao', item, index)} className="area-list-item">
                  {renderItemThumbnail(item)}
                  <div className="area-item-info">
                    <strong>{item.titulo}</strong>
                    {renderItemMeta(item, `${item.publico || 'interno'} - ${item.data || 'Sem data'}`)}
                  </div>
                  {renderItemActions(item)}
                </div>
              ))
            )}
          </div>
        </section>
        )}

        {activeSection === 'materiais' && (
        <section className="area-card">
          <div className="area-card-header">
            <div>
              <h3>Materiais de extensão</h3>
              <p>Guias, protocolos e documentos.</p>
            </div>
            <FileText size={20} />
          </div>
          {canManageExtensao ? (
          <form className="area-form" onSubmit={handleAddMaterial}>
            <input
              type="text"
              placeholder="Título do material"
              value={matForm.titulo}
              onChange={(e) => setMatForm((prev) => ({ ...prev, titulo: e.target.value }))}
            />
            <select
              value={matForm.tipo}
              onChange={(e) => setMatForm((prev) => ({ ...prev, tipo: e.target.value }))}
            >
              <option value="material">Material</option>
              <option value="protocolo">Protocolo</option>
              <option value="guia">Guia</option>
            </select>
            <select
              value={matForm.status}
              onChange={(e) => setMatForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              type="url"
              placeholder="Link (drive, pdf, etc) — opcional se anexar arquivo"
              value={matForm.link}
              onChange={(e) => setMatForm((prev) => ({ ...prev, link: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Autoria (separe por virgula)"
              value={matForm.autores}
              onChange={(e) => setMatForm((prev) => ({ ...prev, autores: e.target.value }))}
            />
            <textarea
              rows="3"
              placeholder="Descrição"
              value={matForm.descricao}
              onChange={(e) => setMatForm((prev) => ({ ...prev, descricao: e.target.value }))}
            />
            <label className="area-form-attachment">
              <span>Anexo</span>
              <input
                ref={materialFileInputRef}
                className="attachment-thumbnail__input"
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={(event) => setMaterialFile(event.target.files?.[0] || null)}
              />
              <AttachmentThumbnail
                file={materialFile}
                emptyTitle="Selecionar anexo"
                emptyDescription="PDF, DOC, PNG ou JPG"
                description="Arquivo selecionado para este material."
                onRemove={materialFile ? () => {
                  setMaterialFile(null);
                  clearFileInput(materialFileInputRef);
                } : null}
              />
            </label>
            <button type="submit" className="area-action">
              <Plus size={16} /> Adicionar
            </button>
          </form>
          ) : (
            <div className="area-readonly-inline">Cadastro restrito a coordenacao e diretoria de extensao.</div>
          )}
          <div className="area-list">
            {materiais.length === 0 ? (
              <div className="area-empty laines-feedback-state">Nenhum material cadastrado.</div>
            ) : (
              materiais.map((item, index) => (
                <div key={getAreaItemKey('extensao-material', item, index)} className="area-list-item">
                  {renderItemThumbnail(item)}
                  <div className="area-item-info">
                    <strong>{item.titulo}</strong>
                    {renderItemMeta(item, item.tipo)}
                    {item.link && !item.arquivoNome && (
                      <a
                        className="area-link"
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FileText size={11} /> Abrir link
                      </a>
                    )}
                  </div>
                  {renderItemActions(item)}
                </div>
              ))
            )}
          </div>
        </section>
        )}
      </div>
      )}
    </div>
  );
};

export default Extensao;
