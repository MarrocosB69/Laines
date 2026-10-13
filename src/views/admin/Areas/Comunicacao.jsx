import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Megaphone, FileText, Link as LinkIcon, Plus, Trash2, Paperclip, Download, X } from 'lucide-react';
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

const COMUNICACAO_SECTIONS = new Set(['overview', 'comunicados', 'materiais']);

const getAreaItemKey = (prefix, item, index) => {
  const id = String(item?.id || '').trim();
  if (id) return id;
  const label = String(item?.titulo || item?.tipo || item?.data || 'item').trim();
  return `${prefix}-${index}-${label || 'item'}`;
};

// Leitura comum das quatro diretorias (UPD-13, UX-04/UX-05): reaproveita as
// categorias de conteúdo que já existem no servidor (comunicados_marketing,
// materiais_marketing). Nenhum cadastro novo.
const Comunicacao = ({ section = 'overview', onSectionChange } = {}) => {
  const { notify, confirm } = useUiFeedback();
  const { user } = useAuth();
  const [comunicados, setComunicados] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);
  const [comunicadoFile, setComunicadoFile] = useState(null);
  const [materialFile, setMaterialFile] = useState(null);
  const [comunicadoForm, setComunicadoForm] = useState({
    titulo: '',
    tipo: 'comunicado',
    status: 'em_andamento',
    data: '',
    link: '',
    descricao: '',
    equipeOrganizacao: ''
  });
  const [materialForm, setMaterialForm] = useState({
    titulo: '',
    tipo: 'material',
    status: 'em_andamento',
    link: '',
    descricao: '',
    autores: ''
  });
  const fileInputRef = useRef(null);
  const comunicadoFileInputRef = useRef(null);
  const materialFileInputRef = useRef(null);
  const uploadTargetIdRef = useRef(null);
  const canManageComunicacao = useMemo(() => (
    canManageContentArea(user, 'comunicacao')
  ), [user]);
  const statusOptions = useMemo(() => getStatusOptionsForUser(user), [user]);
  const activeSection = COMUNICACAO_SECTIONS.has(section) ? section : 'overview';
  const sectionMeta = {
    overview: {
      title: 'Comunicação',
      description: 'Comunicados e materiais produzidos pela diretoria de comunicação/marketing.'
    },
    comunicados: {
      title: 'Comunicados',
      description: 'Avisos, campanhas e divulgações da liga.'
    },
    materiais: {
      title: 'Materiais de comunicação',
      description: 'Artes, guias e referências com autoria registrada.'
    }
  }[activeSection];

  const handleNavigateSection = useCallback((nextSection) => {
    onSectionChange?.(nextSection);
  }, [onSectionChange]);

  const loadData = useCallback(async () => {
    try {
      const [comunicadosRes, materiaisRes] = await Promise.all([
        api.get('/conteudos', { params: { categoria: 'comunicados_marketing' } }),
        api.get('/conteudos', { params: { categoria: 'materiais_marketing' } })
      ]);
      setComunicados(comunicadosRes.data || []);
      setMateriais(materiaisRes.data || []);
    } catch (error) {
      notify({
        type: 'error',
        title: 'Erro ao carregar conteúdos',
        message: getApiErrorMessage(error, 'Não foi possível carregar os conteúdos de comunicação.')
      });
    }
  }, [notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const recentComunicados = useMemo(() => comunicados.slice(0, 5), [comunicados]);

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

  const handleAddComunicado = async (event) => {
    event.preventDefault();
    if (!comunicadoForm.titulo.trim()) return;
    try {
      const { data } = await api.post('/conteudos', {
        categoria: 'comunicados_marketing',
        ...comunicadoForm,
        equipeOrganizacao: splitCommaList(comunicadoForm.equipeOrganizacao)
      });
      await uploadCreatedConteudoFile(data?.id, comunicadoFile);
      setComunicadoForm({
        titulo: '',
        tipo: 'comunicado',
        status: 'em_andamento',
        data: '',
        link: '',
        descricao: '',
        equipeOrganizacao: ''
      });
      setComunicadoFile(null);
      clearFileInput(comunicadoFileInputRef);
      await loadData();
    } catch (error) {
      notify({
        type: 'error',
        title: 'Erro ao criar comunicado',
        message: getApiErrorMessage(error, 'Não foi possível cadastrar o comunicado.')
      });
    }
  };

  const handleAddMaterial = async (event) => {
    event.preventDefault();
    if (!materialForm.titulo.trim()) return;
    try {
      const { data } = await api.post('/conteudos', {
        categoria: 'materiais_marketing',
        ...materialForm,
        autores: splitCommaList(materialForm.autores)
      });
      await uploadCreatedConteudoFile(data?.id, materialFile);
      setMaterialForm({ titulo: '', tipo: 'material', status: 'em_andamento', link: '', descricao: '', autores: '' });
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

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    const id = uploadTargetIdRef.current;
    event.target.value = '';
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

  const renderItemMeta = (item, fallback) => (
    <>
      <span>{fallback}</span>
      <span className={`area-status-chip area-status-chip--${item.status || 'sem_status'}`}>
        {getContentStatusLabel(item.status)}
      </span>
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
      {item.arquivoNome && (
        <button
          type="button"
          className="area-item-btn area-item-btn--download"
          title={`Baixar: ${item.arquivoNome}`}
          onClick={() => handleDownloadArquivo(item.id, item.arquivoNome)}
        >
          <Download size={14} />
        </button>
      )}
      {canManageComunicacao && (
        <>
          <button
            type="button"
            className="area-item-btn area-item-btn--attach"
            title={item.arquivoNome ? 'Substituir arquivo' : 'Anexar arquivo'}
            onClick={() => triggerUpload(item.id)}
            disabled={uploadingId === item.id}
          >
            {uploadingId === item.id ? <span className="area-item-uploading">...</span> : <Paperclip size={14} />}
          </button>
          {item.arquivoNome && (
            <button
              type="button"
              className="area-item-btn area-item-btn--remove-file"
              title="Remover arquivo"
              onClick={() => handleRemoveArquivo(item.id)}
            >
              <X size={12} />
            </button>
          )}
          <button
            type="button"
            className="area-item-btn area-item-btn--delete"
            title="Remover item"
            onClick={() => handleDelete('', item.id, item.titulo)}
          >
            <Trash2 size={14} />
          </button>
        </>
      )}
    </div>
  );

  const overviewCards = [
    {
      id: 'comunicados',
      title: 'Comunicados',
      description: 'Avisos e campanhas com link e anexos.',
      count: comunicados.length,
      icon: Megaphone
    },
    {
      id: 'materiais',
      title: 'Materiais',
      description: 'Artes, guias e referências com autoria.',
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
          <span className="area-badge"><Megaphone size={14} /> {comunicados.length} comunicados</span>
          <span className="area-badge"><FileText size={14} /> {materiais.length} materiais</span>
        </div>
      </header>

      {!canManageComunicacao && (
        <div className="area-readonly-note">
          <Megaphone size={14} />
          Visualizacao dos itens publicados, aprovados ou em andamento.
        </div>
      )}

      {/* Painel da área com as peças da Visão geral, como em Ensino e
          Extensão. Mesmos dados, textos, destinos e condições de antes. */}
      {activeSection === 'overview' && (
        <PainelVisaoGeral className="area-painel">
          <PainelSecao
            id="comunicacao-operacao"
            className="area-painel__operacao"
            titulo="Operação de comunicação"
            descricao={canManageComunicacao
              ? 'Abra uma frente em página inteira para revisar, publicar ou editar.'
              : 'Abra uma frente em página inteira para consultar o que já foi publicado.'}
          >
            <PainelIndicadores
              rotulo="Operação de comunicação"
              itens={overviewCards.map((card) => ({
                id: card.id,
                rotulo: card.title,
                valor: card.count,
                detalhe: card.description,
                icone: card.icon,
                onClick: () => handleNavigateSection(card.id)
              }))}
            />
          </PainelSecao>
          <PainelSecao
            id="comunicacao-comunicados-recentes"
            className="area-painel__raia"
            titulo="Comunicados recentes"
            estado={recentComunicados.length === 0 ? 'vazio' : 'pronto'}
            vazio={{ titulo: 'Nenhum comunicado publicado até o momento.' }}
          >
            <PainelLista
              rotuloAcessivel="Comunicados recentes"
              itens={recentComunicados.map((item, index) => ({
                id: getAreaItemKey('comunicacao-overview-comunicado', item, index),
                titulo: item.titulo,
                meta: item.data || getContentStatusLabel(item.status),
                onClick: () => handleNavigateSection('comunicados')
              }))}
            />
          </PainelSecao>
          <PainelSecao
            id="comunicacao-materiais-recentes"
            className="area-painel__raia"
            titulo="Materiais recentes"
            estado={materiais.length === 0 ? 'vazio' : 'pronto'}
            vazio={{ titulo: 'Nenhum material publicado até o momento.' }}
          >
            <PainelLista
              rotuloAcessivel="Materiais recentes"
              itens={materiais.slice(0, 4).map((item, index) => ({
                id: getAreaItemKey('comunicacao-overview-material', item, index),
                titulo: item.titulo,
                meta: getContentStatusLabel(item.status),
                onClick: () => handleNavigateSection('materiais')
              }))}
            />
          </PainelSecao>
        </PainelVisaoGeral>
      )}

      {activeSection === 'comunicados' && (
      <div className="area-grid area-grid--single">
        <section className="area-card">
          <div className="area-card-header">
            <div>
              <h3>Comunicados</h3>
              <p>Links editáveis e anexos.</p>
            </div>
          </div>
          <div className="area-list">
            {recentComunicados.length === 0 ? (
              <div className="area-empty laines-feedback-state">Nenhum comunicado publicado até o momento.</div>
            ) : (
              recentComunicados.map((item, index) => (
                <div key={getAreaItemKey('comunicacao-comunicado-upcoming', item, index)} className="area-list-item">
                  {renderItemThumbnail(item)}
                  <div className="area-item-info">
                    <strong>{item.titulo}</strong>
                    {renderItemMeta(item, `${item.tipo || 'comunicado'} - ${item.data || 'Sem data'}`)}
                  </div>
                  {item.link ? (
                    <a className="area-link" href={item.link} target="_blank" rel="noreferrer">
                      <LinkIcon size={14} /> Abrir
                    </a>
                  ) : (
                    <span>Sem link</span>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {canManageComunicacao && (
        <section className="area-card">
          <div className="area-card-header">
            <div>
              <h3>Publicar comunicado</h3>
              <p>Cadastre o link e o material de referência.</p>
            </div>
          </div>
          <form className="area-form" onSubmit={handleAddComunicado}>
            <input
              type="text"
              placeholder="Título do comunicado"
              value={comunicadoForm.titulo}
              onChange={(e) => setComunicadoForm((prev) => ({ ...prev, titulo: e.target.value }))}
            />
            <select
              value={comunicadoForm.tipo}
              onChange={(e) => setComunicadoForm((prev) => ({ ...prev, tipo: e.target.value }))}
            >
              <option value="comunicado">Comunicado</option>
              <option value="campanha">Campanha</option>
            </select>
            <select
              value={comunicadoForm.status}
              onChange={(e) => setComunicadoForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              type="date"
              value={comunicadoForm.data}
              onChange={(e) => setComunicadoForm((prev) => ({ ...prev, data: e.target.value }))}
            />
            <input
              type="url"
              placeholder="Link do comunicado"
              value={comunicadoForm.link}
              onChange={(e) => setComunicadoForm((prev) => ({ ...prev, link: e.target.value }))}
            />
            <textarea
              rows="3"
              placeholder="Descrição"
              value={comunicadoForm.descricao}
              onChange={(e) => setComunicadoForm((prev) => ({ ...prev, descricao: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Equipe de organizacao (separe por virgula)"
              value={comunicadoForm.equipeOrganizacao}
              onChange={(e) => setComunicadoForm((prev) => ({ ...prev, equipeOrganizacao: e.target.value }))}
            />
            <label className="area-form-attachment">
              <span>Anexo</span>
              <input
                ref={comunicadoFileInputRef}
                className="attachment-thumbnail__input"
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={(event) => setComunicadoFile(event.target.files?.[0] || null)}
              />
              <AttachmentThumbnail
                file={comunicadoFile}
                emptyTitle="Selecionar anexo"
                emptyDescription="PDF, DOC, PNG ou JPG"
                description="Arquivo selecionado para este comunicado."
                onRemove={comunicadoFile ? () => {
                  setComunicadoFile(null);
                  clearFileInput(comunicadoFileInputRef);
                } : null}
              />
            </label>
            <button type="submit" className="area-action">
              <Plus size={16} /> Adicionar
            </button>
          </form>
          <div className="area-list">
            {comunicados.length === 0 ? (
              <div className="area-empty laines-feedback-state">Nenhum comunicado cadastrado.</div>
            ) : (
              comunicados.map((item, index) => (
                <div key={getAreaItemKey('comunicacao-comunicado', item, index)} className="area-list-item">
                  {renderItemThumbnail(item)}
                  <div className="area-item-info">
                    <strong>{item.titulo}</strong>
                    {renderItemMeta(item, `${item.tipo || 'comunicado'} - ${item.data || 'Sem data'}`)}
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

      {activeSection === 'materiais' && (
      <div className="area-grid area-grid--single">
        <section className="area-card">
          <div className="area-card-header">
            <div>
              <h3>Materiais de comunicação</h3>
              <p>Artes, guias e referências.</p>
            </div>
            <FileText size={20} />
          </div>
          {canManageComunicacao ? (
          <form className="area-form" onSubmit={handleAddMaterial}>
            <input
              type="text"
              placeholder="Título do material"
              value={materialForm.titulo}
              onChange={(e) => setMaterialForm((prev) => ({ ...prev, titulo: e.target.value }))}
            />
            <select
              value={materialForm.tipo}
              onChange={(e) => setMaterialForm((prev) => ({ ...prev, tipo: e.target.value }))}
            >
              <option value="material">Material</option>
              <option value="arte">Arte</option>
              <option value="guia">Guia</option>
            </select>
            <select
              value={materialForm.status}
              onChange={(e) => setMaterialForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              type="url"
              placeholder="Link do material"
              value={materialForm.link}
              onChange={(e) => setMaterialForm((prev) => ({ ...prev, link: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Autoria (separe por virgula)"
              value={materialForm.autores}
              onChange={(e) => setMaterialForm((prev) => ({ ...prev, autores: e.target.value }))}
            />
            <textarea
              rows="3"
              placeholder="Descrição"
              value={materialForm.descricao}
              onChange={(e) => setMaterialForm((prev) => ({ ...prev, descricao: e.target.value }))}
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
            <div className="area-readonly-inline">Cadastro restrito a coordenacao e diretoria de comunicacao.</div>
          )}
          <div className="area-list">
            {materiais.length === 0 ? (
              <div className="area-empty laines-feedback-state">Nenhum material cadastrado.</div>
            ) : (
              materiais.map((item, index) => (
                <div key={getAreaItemKey('comunicacao-material', item, index)} className="area-list-item">
                  {renderItemThumbnail(item)}
                  <div className="area-item-info">
                    <strong>{item.titulo}</strong>
                    {renderItemMeta(item, item.tipo)}
                  </div>
                  {renderItemActions(item)}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
      )}
    </div>
  );
};

export default Comunicacao;
