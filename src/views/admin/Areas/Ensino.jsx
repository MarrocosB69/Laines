import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { BookOpen, FileText, Link as LinkIcon, Plus, Trash2, Paperclip, Download, X } from 'lucide-react';
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

const ENSINO_SECTIONS = new Set(['overview', 'reunioes', 'materiais']);

const getAreaItemKey = (prefix, item, index) => {
  const id = String(item?.id || '').trim();
  if (id) return id;
  const label = String(item?.titulo || item?.tipo || item?.data || 'item').trim();
  return `${prefix}-${index}-${label || 'item'}`;
};

const Ensino = ({ section = 'overview', onSectionChange } = {}) => {
  const { notify, confirm } = useUiFeedback();
  const { user } = useAuth();
  const [reunioes, setReunioes] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);
  const [reuniaoFile, setReuniaoFile] = useState(null);
  const [materialFile, setMaterialFile] = useState(null);
  const [reuniaoForm, setReuniaoForm] = useState({
    titulo: '',
    tipo: 'reuniao_cientifica',
    status: 'em_andamento',
    data: '',
    link: '',
    descricao: '',
    equipeOrganizacao: ''
  });
  const [materialForm, setMaterialForm] = useState({
    titulo: '',
    tipo: 'artigo',
    status: 'em_andamento',
    link: '',
    descricao: '',
    autores: ''
  });
  const fileInputRef = useRef(null);
  const reuniaoFileInputRef = useRef(null);
  const materialFileInputRef = useRef(null);
  const uploadTargetIdRef = useRef(null);
  const canManageEnsino = useMemo(() => (
    canManageContentArea(user, 'ensino')
  ), [user]);
  const statusOptions = useMemo(() => getStatusOptionsForUser(user), [user]);
  const activeSection = ENSINO_SECTIONS.has(section) ? section : 'overview';
  const sectionMeta = {
    overview: {
      title: 'Ensino',
      description: 'Reuniões científicas, rodas de conversa e materiais de apoio.'
    },
    reunioes: {
      title: 'Reuniões e rodas',
      description: 'Agenda científica, rodas de conversa, links e anexos relacionados.'
    },
    materiais: {
      title: 'Materiais de ensino',
      description: 'Artigos, guias, slides e referências com autoria registrada.'
    }
  }[activeSection];

  const handleNavigateSection = useCallback((nextSection) => {
    onSectionChange?.(nextSection);
  }, [onSectionChange]);

  const loadData = useCallback(async () => {
    try {
      const [reunioesRes, materiaisRes] = await Promise.all([
        api.get('/conteudos', { params: { categoria: 'reunioes_cientificas' } }),
        api.get('/conteudos', { params: { categoria: 'materiais_ensino' } })
      ]);
      setReunioes(reunioesRes.data || []);
      setMateriais(materiaisRes.data || []);
    } catch (error) {
      notify({
        type: 'error',
        title: 'Erro ao carregar conteúdos',
        message: getApiErrorMessage(error, 'Não foi possível carregar os conteúdos de ensino.')
      });
    }
  }, [notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const upcomingMeetings = useMemo(() => {
    return reunioes.slice(0, 5);
  }, [reunioes]);

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

  const handleAddReuniao = async (event) => {
    event.preventDefault();
    if (!reuniaoForm.titulo.trim()) return;
    try {
      const { data } = await api.post('/conteudos', {
        categoria: 'reunioes_cientificas',
        ...reuniaoForm,
        equipeOrganizacao: splitCommaList(reuniaoForm.equipeOrganizacao)
      });
      await uploadCreatedConteudoFile(data?.id, reuniaoFile);
      setReuniaoForm({
        titulo: '',
        tipo: 'reuniao_cientifica',
        status: 'em_andamento',
        data: '',
        link: '',
        descricao: '',
        equipeOrganizacao: ''
      });
      setReuniaoFile(null);
      clearFileInput(reuniaoFileInputRef);
      await loadData();
    } catch (error) {
      notify({
        type: 'error',
        title: 'Erro ao criar reunião',
        message: getApiErrorMessage(error, 'Não foi possível cadastrar a reunião.')
      });
    }
  };

  const handleAddMaterial = async (event) => {
    event.preventDefault();
    if (!materialForm.titulo.trim()) return;
    try {
      const { data } = await api.post('/conteudos', {
        categoria: 'materiais_ensino',
        ...materialForm,
        autores: splitCommaList(materialForm.autores)
      });
      await uploadCreatedConteudoFile(data?.id, materialFile);
      setMaterialForm({ titulo: '', tipo: 'artigo', status: 'em_andamento', link: '', descricao: '', autores: '' });
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
      notify({ type: 'error', title: 'Erro no upload', message: getApiErrorMessage(error, 'Nao foi possivel enviar o arquivo.') });
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
      notify({ type: 'error', title: 'Erro no download', message: getApiErrorMessage(error, 'Nao foi possivel baixar o arquivo.') });
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
      notify({ type: 'error', title: 'Erro', message: getApiErrorMessage(error, 'Nao foi possivel remover o arquivo.') });
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
      {canManageEnsino && (
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
      id: 'reunioes',
      title: 'Reuniões e rodas',
      description: 'Agenda científica, links e anexos de cada encontro.',
      count: reunioes.length,
      icon: BookOpen
    },
    {
      id: 'materiais',
      title: 'Materiais',
      description: 'Artigos, guias, slides e referências com autoria.',
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
          <span className="area-badge"><BookOpen size={14} /> {reunioes.length} reuniões</span>
          <span className="area-badge"><FileText size={14} /> {materiais.length} materiais</span>
        </div>
      </header>

      {!canManageEnsino && (
        <div className="area-readonly-note">
          <BookOpen size={14} />
          Visualizacao dos itens publicados, aprovados ou em andamento.
        </div>
      )}

      {/* Painel da área com as peças da Visão geral (src/components/painel/):
          os cartões viram indicadores clicáveis e as duas raias, seções com
          lista. Mesmos dados, textos, destinos e condições de antes. */}
      {activeSection === 'overview' && (
        <PainelVisaoGeral className="area-painel">
          <PainelSecao
            id="ensino-operacao"
            className="area-painel__operacao"
            titulo="Operação de ensino"
            descricao={canManageEnsino
              ? 'Abra uma frente em página inteira para revisar, publicar ou editar.'
              : 'Abra uma frente em página inteira para consultar o que já foi publicado.'}
          >
            <PainelIndicadores
              rotulo="Operação de ensino"
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
            id="ensino-proximos-encontros"
            className="area-painel__raia"
            titulo="Próximos encontros"
            estado={upcomingMeetings.length === 0 ? 'vazio' : 'pronto'}
            vazio={{ titulo: 'Nenhuma reunião cadastrada.' }}
          >
            <PainelLista
              rotuloAcessivel="Próximos encontros"
              itens={upcomingMeetings.map((item, index) => ({
                id: getAreaItemKey('ensino-overview-meeting', item, index),
                titulo: item.titulo,
                meta: item.data || getContentStatusLabel(item.status),
                onClick: () => handleNavigateSection('reunioes')
              }))}
            />
          </PainelSecao>
          <PainelSecao
            id="ensino-materiais-recentes"
            className="area-painel__raia"
            titulo="Materiais recentes"
            estado={materiais.length === 0 ? 'vazio' : 'pronto'}
            vazio={{ titulo: 'Nenhum material cadastrado.' }}
          >
            <PainelLista
              rotuloAcessivel="Materiais recentes"
              itens={materiais.slice(0, 4).map((item, index) => ({
                id: getAreaItemKey('ensino-overview-material', item, index),
                titulo: item.titulo,
                meta: getContentStatusLabel(item.status),
                onClick: () => handleNavigateSection('materiais')
              }))}
            />
          </PainelSecao>
        </PainelVisaoGeral>
      )}

      {activeSection === 'reunioes' && (
      <div className="area-grid area-grid--single">
        <section className="area-card">
          <div className="area-card-header">
            <div>
              <h3>Próximas reuniões</h3>
              <p>Links editáveis e pautas.</p>
            </div>
          </div>
          <div className="area-list">
            {upcomingMeetings.length === 0 ? (
              <div className="area-empty laines-feedback-state">Nenhuma reunião cadastrada.</div>
            ) : (
              upcomingMeetings.map((item, index) => (
                <div key={getAreaItemKey('ensino-meeting-upcoming', item, index)} className="area-list-item">
                  {renderItemThumbnail(item)}
                  <div className="area-item-info">
                    <strong>{item.titulo}</strong>
                    {renderItemMeta(item, `${item.tipo || 'reuniao'} - ${item.data || 'Sem data'}`)}
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

        {canManageEnsino && (
        <section className="area-card">
          <div className="area-card-header">
            <div>
              <h3>Agendar reunião</h3>
              <p>Cadastre o link e o material de referência.</p>
            </div>
          </div>
          <form className="area-form" onSubmit={handleAddReuniao}>
            <input
              type="text"
              placeholder="Título da reunião"
              value={reuniaoForm.titulo}
              onChange={(e) => setReuniaoForm((prev) => ({ ...prev, titulo: e.target.value }))}
            />
            <select
              value={reuniaoForm.tipo}
              onChange={(e) => setReuniaoForm((prev) => ({ ...prev, tipo: e.target.value }))}
            >
              <option value="reuniao_cientifica">Reuniao cientifica</option>
              <option value="roda_de_conversa">Roda de conversa</option>
            </select>
            <select
              value={reuniaoForm.status}
              onChange={(e) => setReuniaoForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              type="date"
              value={reuniaoForm.data}
              onChange={(e) => setReuniaoForm((prev) => ({ ...prev, data: e.target.value }))}
            />
            <input
              type="url"
              placeholder="Link da reunião"
              value={reuniaoForm.link}
              onChange={(e) => setReuniaoForm((prev) => ({ ...prev, link: e.target.value }))}
            />
            <textarea
              rows="3"
              placeholder="Descrição ou pauta"
              value={reuniaoForm.descricao}
              onChange={(e) => setReuniaoForm((prev) => ({ ...prev, descricao: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Equipe de organizacao (separe por virgula)"
              value={reuniaoForm.equipeOrganizacao}
              onChange={(e) => setReuniaoForm((prev) => ({ ...prev, equipeOrganizacao: e.target.value }))}
            />
            <label className="area-form-attachment">
              <span>Anexo</span>
              <input
                ref={reuniaoFileInputRef}
                className="attachment-thumbnail__input"
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={(event) => setReuniaoFile(event.target.files?.[0] || null)}
              />
              <AttachmentThumbnail
                file={reuniaoFile}
                emptyTitle="Selecionar anexo"
                emptyDescription="PDF, DOC, PNG ou JPG"
                description="Arquivo selecionado para esta reuniao."
                onRemove={reuniaoFile ? () => {
                  setReuniaoFile(null);
                  clearFileInput(reuniaoFileInputRef);
                } : null}
              />
            </label>
            <button type="submit" className="area-action">
              <Plus size={16} /> Adicionar
            </button>
          </form>
          <div className="area-list">
            {reunioes.length === 0 ? (
              <div className="area-empty laines-feedback-state">Nenhuma reunião cadastrada.</div>
            ) : (
              reunioes.map((item, index) => (
                <div key={getAreaItemKey('ensino-meeting', item, index)} className="area-list-item">
                  {renderItemThumbnail(item)}
                  <div className="area-item-info">
                    <strong>{item.titulo}</strong>
                    {renderItemMeta(item, `${item.tipo || 'reuniao'} - ${item.data || 'Sem data'}`)}
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
              <h3>Materiais de ensino</h3>
              <p>Artigos, guias e referências.</p>
            </div>
            <FileText size={20} />
          </div>
          {canManageEnsino ? (
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
              <option value="artigo">Artigo</option>
              <option value="slides">Slides</option>
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
            <div className="area-readonly-inline">Cadastro restrito a coordenacao e diretoria de ensino.</div>
          )}
          <div className="area-list">
            {materiais.length === 0 ? (
              <div className="area-empty laines-feedback-state">Nenhum material cadastrado.</div>
            ) : (
              materiais.map((item, index) => (
                <div key={getAreaItemKey('ensino-material', item, index)} className="area-list-item">
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

export default Ensino;
