import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, FileText, Plus, Trash2 } from 'lucide-react';
import api, { getApiErrorMessage } from '../../../services/api';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import './Areas.css';

const Extensao = () => {
  const { notify, confirm } = useUiFeedback();
  const [capacitacoes, setCapacitacoes] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [capForm, setCapForm] = useState({
    titulo: '',
    publico: 'interno',
    cursos: '',
    data: '',
    descricao: ''
  });
  const [matForm, setMatForm] = useState({
    titulo: '',
    tipo: 'material',
    link: '',
    descricao: ''
  });

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

  const handleAddCapacitacao = async (event) => {
    event.preventDefault();
    if (!capForm.titulo.trim()) return;
    try {
      await api.post('/conteudos', {
        categoria: 'capacitacoes',
        ...capForm,
        cursos: capForm.cursos.split(',').map((item) => item.trim()).filter(Boolean)
      });
      setCapForm({ titulo: '', publico: 'interno', cursos: '', data: '', descricao: '' });
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
      await api.post('/conteudos', {
        categoria: 'materiais_extensao',
        ...matForm
      });
      setMatForm({ titulo: '', tipo: 'material', link: '', descricao: '' });
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

  return (
    <div className="area-page">
      <header className="area-header">
        <div>
          <h2>Extensão</h2>
          <p>Atendimentos, capacitações e materiais produzidos pela liga.</p>
        </div>
        <div className="area-badges">
          <span className="area-badge"><Calendar size={14} /> {capacitacoes.length} capacitações</span>
          <span className="area-badge"><FileText size={14} /> {materiais.length} materiais</span>
        </div>
      </header>

      <div className="area-grid">
        <section className="area-card">
          <div className="area-card-header">
            <div>
              <h3>Capacitações</h3>
              <p>Cadastre treinamentos internos ou externos.</p>
            </div>
          </div>
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
            <input
              type="text"
              placeholder="Cursos participantes (separe por vírgula)"
              value={capForm.cursos}
              onChange={(e) => setCapForm((prev) => ({ ...prev, cursos: e.target.value }))}
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
            <button type="submit" className="area-action">
              <Plus size={16} /> Adicionar
            </button>
          </form>
          <div className="area-list">
            {capacitacoes.length === 0 ? (
              <div className="area-empty laines-feedback-state">Nenhuma capacitação cadastrada.</div>
            ) : (
              capacitacoes.map((item) => (
                <div key={item.id} className="area-list-item">
                  <div>
                    <strong>{item.titulo}</strong>
                    <span>{item.publico} - {item.data || 'Sem data'}</span>
                  </div>
                  <button type="button" onClick={() => handleDelete('capacitacoes', item.id, item.titulo)}>
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
              <h3>Materiais de extensão</h3>
              <p>Guias, protocolos e documentos.</p>
            </div>
            <FileText size={20} />
          </div>
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
            <input
              type="url"
              placeholder="Link (drive, pdf, etc)"
              value={matForm.link}
              onChange={(e) => setMatForm((prev) => ({ ...prev, link: e.target.value }))}
            />
            <textarea
              rows="3"
              placeholder="Descrição"
              value={matForm.descricao}
              onChange={(e) => setMatForm((prev) => ({ ...prev, descricao: e.target.value }))}
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
                  <button type="button" onClick={() => handleDelete('materiais_extensao', item.id, item.titulo)}>
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

export default Extensao;

