import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { BookOpen, FileText, Link as LinkIcon, Plus, Trash2 } from 'lucide-react';
import api, { getApiErrorMessage } from '../../../services/api';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import './Areas.css';

const Ensino = () => {
  const { notify, confirm } = useUiFeedback();
  const [reunioes, setReunioes] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [reuniaoForm, setReuniaoForm] = useState({
    titulo: '',
    data: '',
    link: '',
    descricao: ''
  });
  const [materialForm, setMaterialForm] = useState({
    titulo: '',
    tipo: 'artigo',
    link: '',
    descricao: ''
  });

  const loadData = useCallback(async () => {
    try {
      const [reunioesRes, materiaisRes] = await Promise.all([
        api.get('/conteudos', { params: { categoria: 'reunioes_cientificas' } }),
        api.get('/conteudos', { params: { categoria: 'materiais_ensino' } })
      ]);
      setReunioes(reunioesRes.data || []);
      setMateriais(materiaisRes.data || []);
    } catch (error) {
      console.warn('Ensino: falha ao carregar conteúdos', error);
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

  const handleAddReuniao = async (event) => {
    event.preventDefault();
    if (!reuniaoForm.titulo.trim()) return;
    try {
      await api.post('/conteudos', {
        categoria: 'reunioes_cientificas',
        ...reuniaoForm
      });
      setReuniaoForm({ titulo: '', data: '', link: '', descricao: '' });
      await loadData();
    } catch (error) {
      console.warn('Ensino: falha ao criar reunião', error);
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
      await api.post('/conteudos', {
        categoria: 'materiais_ensino',
        ...materialForm
      });
      setMaterialForm({ titulo: '', tipo: 'artigo', link: '', descricao: '' });
      await loadData();
    } catch (error) {
      console.warn('Ensino: falha ao criar material', error);
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
      console.warn('Ensino: falha ao remover item', error);
      notify({
        type: 'error',
        title: 'Erro ao remover conteúdo',
        message: getApiErrorMessage(error, 'Não foi possível remover o item.')
      });
    }
  };

  return (
    <div className="area-page">
      <header className="area-header">
        <div>
          <h2>Ensino</h2>
          <p>Reuniões científicas, links e materiais de apoio.</p>
        </div>
        <div className="area-badges">
          <span className="area-badge"><BookOpen size={14} /> {reunioes.length} reuniões</span>
          <span className="area-badge"><FileText size={14} /> {materiais.length} materiais</span>
        </div>
      </header>

      <div className="area-grid">
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
              upcomingMeetings.map((item) => (
                <div key={item.id} className="area-list-item">
                  <div>
                    <strong>{item.titulo}</strong>
                    <span>{item.data || 'Sem data'}</span>
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
            <button type="submit" className="area-action">
              <Plus size={16} /> Adicionar
            </button>
          </form>
          <div className="area-list">
            {reunioes.length === 0 ? (
              <div className="area-empty laines-feedback-state">Nenhuma reunião cadastrada.</div>
            ) : (
              reunioes.map((item) => (
                <div key={item.id} className="area-list-item">
                  <div>
                    <strong>{item.titulo}</strong>
                    <span>{item.data || 'Sem data'}</span>
                  </div>
                  <button type="button" onClick={() => handleDelete('reunioes_cientificas', item.id, item.titulo)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="area-card">
          <div className="area-card-header">
            <div>
              <h3>Materiais de ensino</h3>
              <p>Artigos, guias e referências.</p>
            </div>
            <FileText size={20} />
          </div>
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
            <input
              type="url"
              placeholder="Link do material"
              value={materialForm.link}
              onChange={(e) => setMaterialForm((prev) => ({ ...prev, link: e.target.value }))}
            />
            <textarea
              rows="3"
              placeholder="Descrição"
              value={materialForm.descricao}
              onChange={(e) => setMaterialForm((prev) => ({ ...prev, descricao: e.target.value }))}
            />
            <button type="submit" className="area-action">
              <Plus size={16} /> Adicionar
            </button>
          </form>
          <div className="area-list">
            {materiais.length === 0 ? (
              <div className="area-empty laines-feedback-state">Nenhum material cadastrado.</div>
            ) : (
              materiais.map((item) => (
                <div key={item.id} className="area-list-item">
                  <div>
                    <strong>{item.titulo}</strong>
                    <span>{item.tipo}</span>
                  </div>
                  <button type="button" onClick={() => handleDelete('materiais_ensino', item.id, item.titulo)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Ensino;
