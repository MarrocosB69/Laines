import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Save, X } from 'lucide-react';
import { useModalBodyLock } from '../../../hooks/useModalBodyLock';
import { useModalFocusTrap } from '../../../hooks/useModalFocusTrap';


const defaultForm = {
  nome: '',
  area: 'nutricao',
  status: 'planejamento',
  coordenador: '',
  descricao: '',
  equipe: '',
  alunosIds: []
};

const ResearchProjectModal = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  students = [],
  projects = [],
  lockCoordinator = false,
  defaultCoordinatorName = ''
}) => {
  const [formData, setFormData] = useState(defaultForm);
  const [studentSearch, setStudentSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const modalRef = useRef(null);

  useModalBodyLock(isOpen);
  useModalFocusTrap(isOpen, modalRef);

  useEffect(() => {
    if (initialData) {
      setFormData({
        nome: initialData.nome || '',
        area: initialData.area || 'nutricao',
        status: initialData.status || 'planejamento',
        coordenador: initialData.coordenador || '',
        descricao: initialData.descricao || '',
        equipe: (initialData.equipe || []).join(', '),
        alunosIds: initialData.alunosIds || []
      });
    } else {
      setFormData({
        ...defaultForm,
        coordenador: lockCoordinator ? defaultCoordinatorName : ''
      });
    }
    setStudentSearch('');
  }, [defaultCoordinatorName, initialData, lockCoordinator]);

  const handleChange = (field) => (event) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const toggleStudent = (studentId) => {
    setFormData((prev) => {
      const current = new Set(prev.alunosIds || []);
      if (current.has(studentId)) {
        current.delete(studentId);
      } else {
        current.add(studentId);
      }
      return { ...prev, alunosIds: Array.from(current) };
    });
  };

  const filteredStudents = students.filter((student) => {
    if (!studentSearch.trim()) return true;
    const term = studentSearch.trim().toLowerCase();
    return (
      student.nome?.toLowerCase().includes(term) ||
      student.email?.toLowerCase().includes(term)
    );
  });

  const selectedStudents = (formData.alunosIds || []).map((id) => {
    const student = students.find((item) => item.id === id);
    return {
      id,
      nome: student?.nome || student?.email || id
    };
  });

  const exceededLimit = (formData.alunosIds || []).filter((studentId) => {
    const otherProjects = projects.filter((project) => {
      if (initialData?.id && project.id === initialData.id) return false;
      return (project.alunosIds || []).includes(studentId);
    });
    return otherProjects.length >= 2;
  });

  const isSubmitDisabled = saving || exceededLimit.length > 0;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        equipe: formData.equipe
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      };
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestClose = useCallback(() => {
    if (saving) return;
    onClose?.();
  }, [saving, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleRequestClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleRequestClose]);
  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const modalContent = (
    <div
      className="research-project-modal-overlay app-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleRequestClose();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="research-project-modal app-modal-shell app-modal-shell--lg app-modal-shell--scrollable"
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="research-project-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="app-modal-header research-project-modal__header">
          <div className="app-modal-heading">
            <h3 id="research-project-modal-title" className="app-modal-title">
              {initialData ? 'Editar projeto' : 'Novo projeto'}
            </h3>
            <p className="app-modal-subtitle">Cadastre projetos de pesquisa e equipe responsável.</p>
          </div>
          <button
            type="button"
            className="app-modal-close research-project-modal__close"
            onClick={handleRequestClose}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="app-modal-body research-project-modal__form">
          <div className="app-modal-form-grid research-project-modal__grid">
            <label className="app-modal-field app-modal-field--full">
              <span className="app-modal-field-label">Nome do projeto</span>
              <input
                type="text"
                value={formData.nome}
                onChange={handleChange('nome')}
                className="app-modal-input research-project-modal__input"
                required
              />
            </label>

            <label className="app-modal-field">
              <span className="app-modal-field-label">Área</span>
              <select
                value={formData.area}
                onChange={handleChange('area')}
                className="app-modal-select research-project-modal__select"
              >
                <option value="nutricao">Nutrição</option>
                <option value="fisioterapia">Fisioterapia</option>
                <option value="psicologia">Psicologia</option>
                <option value="multidisciplinar">Multidisciplinar</option>
                <option value="outros">Outros</option>
              </select>
            </label>

            <label className="app-modal-field">
              <span className="app-modal-field-label">Status</span>
              <select
                value={formData.status}
                onChange={handleChange('status')}
                className="app-modal-select research-project-modal__select"
              >
                <option value="planejamento">Planejamento</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluido">Concluído</option>
                <option value="pausado">Pausado</option>
              </select>
            </label>

            <label className="app-modal-field app-modal-field--full">
              <span className="app-modal-field-label">Coordenador(a)</span>
              <input
                type="text"
                value={formData.coordenador}
                onChange={handleChange('coordenador')}
                placeholder="Nome do coordenador"
                className="app-modal-input research-project-modal__input"
                disabled={lockCoordinator}
              />
            </label>

            <label className="app-modal-field app-modal-field--full">
              <span className="app-modal-field-label">Equipe (separe por vírgula)</span>
              <input
                type="text"
                value={formData.equipe}
                onChange={handleChange('equipe')}
                placeholder="Ex: Ana, Carlos, Dr. José"
                className="app-modal-input research-project-modal__input"
              />
            </label>

            <div className="app-modal-field app-modal-field--full research-project-modal__students">
              <div className="research-project-modal__students-header">
                <span className="app-modal-field-label">Alunos vinculados</span>
                <span className="research-project-modal__counter">{formData.alunosIds.length} selecionado(s)</span>
              </div>
              <input
                type="text"
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Buscar aluno por nome ou email"
                className="app-modal-input research-project-modal__search"
              />
              <div className="research-project-modal__student-list">
                {filteredStudents.length === 0 ? (
                  <span className="research-project-modal__empty">Nenhum aluno encontrado.</span>
                ) : (
                  filteredStudents.map((student) => (
                    <label key={student.id} className="research-project-modal__student-option">
                      <input
                        type="checkbox"
                        checked={(formData.alunosIds || []).includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                      />
                      <span>{student.nome || student.email || student.id}</span>
                    </label>
                  ))
                )}
              </div>
              {selectedStudents.length > 0 && (
                <div className="research-project-modal__selected-list">
                  {selectedStudents.map((student) => (
                    <span key={student.id} className="research-project-modal__selected-badge">
                      {student.nome}
                    </span>
                  ))}
                </div>
              )}
              {exceededLimit.length > 0 && (
                <div className="research-project-modal__warning">
                  {exceededLimit
                    .map((id) => students.find((student) => student.id === id)?.nome || id)
                    .join(', ')}
                  {' '}já estão em 2 pesquisas.
                </div>
              )}
              <span className="research-project-modal__helper">Cada aluno pode participar de até 2 pesquisas.</span>
            </div>

            <label className="app-modal-field app-modal-field--full">
              <span className="app-modal-field-label">Descrição</span>
              <textarea
                rows="4"
                value={formData.descricao}
                onChange={handleChange('descricao')}
                placeholder="Resumo do projeto e objetivos."
                className="app-modal-textarea research-project-modal__textarea"
              />
            </label>
          </div>
          <div className="app-modal-footer research-project-modal__footer">
            <div className="app-modal-actions">
              <button
                type="button"
                onClick={handleRequestClose}
                className="app-modal-btn app-modal-btn--secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitDisabled}
                className="app-modal-btn app-modal-btn--primary"
              >
                <Save size={16} />
                {saving ? 'Salvando...' : 'Salvar projeto'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ResearchProjectModal;






