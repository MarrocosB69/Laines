import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, UserCheck, Search, GraduationCap, AlertCircle, 
  Link2, Loader2, Users, Shield, Clock, CheckCircle,
  UserPlus, AlertTriangle, Calendar, BookOpen, TrendingUp
} from 'lucide-react';
import { useModalBodyLock } from '../../../hooks/useModalBodyLock';
import { useModalFocusTrap } from '../../../hooks/useModalFocusTrap';
import { getApiErrorMessage } from '../../../services/api';

import './LinkPatientModal.css';

const LinkPatientModal = ({ isOpen, onClose, onLink, patient, students }) => {
  const [selectedStudent, setSelectedStudent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' ou 'grid'
  const [sortBy, setSortBy] = useState('name'); // 'name', 'available', 'load'
  const modalRef = useRef(null);

  useModalBodyLock(isOpen);
  useModalFocusTrap(isOpen, modalRef);

  const handleRequestClose = useCallback(() => {
    if (isLinking) return;
    onClose?.();
  }, [isLinking, onClose]);

  useEffect(() => {
    if (isOpen) {
      setSelectedStudent('');
      setSearchTerm('');
      setError('');
      setSuccess('');
      setIsLinking(false);
      setViewMode('list');
      setSortBy('name');
    }
  }, [isOpen, patient]);

  // Ordenar e filtrar alunos
  const filteredAndSortedStudents = useMemo(() => {
    let filtered = students.filter(student => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        return (
          student.nome?.toLowerCase().includes(term) ||
          student.professor?.toLowerCase().includes(term) ||
          student.email?.toLowerCase().includes(term) ||
          student.matricula?.toLowerCase().includes(term)
        );
      }
      return true;
    });

    // Ordenacao
    filtered.sort((a, b) => {
      switch(sortBy) {
        case 'name':
          return a.nome?.localeCompare(b.nome);
        case 'available':
          return (b.disponivel || 0) - (a.disponivel || 0);
        case 'load':
          return (b.pacientesAtuais || 0) - (a.pacientesAtuais || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [students, searchTerm, sortBy]);

  const handleLink = useCallback(async () => {
    if (!selectedStudent) {
      setError('Selecione um aluno para vincular');
      return;
    }

    const student = students.find(s => s.id === selectedStudent);
    if (student?.limiteAtingido) {
      setError('Este aluno ja atingiu o limite maximo de pacientes');
      return;
    }

    setIsLinking(true);
    setError('');
    setSuccess('');

    try {
      await onLink(patient.id, selectedStudent);
      setSuccess('Paciente vinculado com sucesso!');
      
      setTimeout(() => {
        handleRequestClose();
      }, 1500);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Erro ao vincular paciente. Tente novamente.'));
    } finally {
      setIsLinking(false);
    }
  }, [selectedStudent, patient, onLink, handleRequestClose, students]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      handleRequestClose();
      return;
    }
    if (e.key !== 'Enter' || isLinking) return;

    const target = e.target;
    const isTypingTarget = target instanceof HTMLElement
      && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName));
    if (isTypingTarget) return;

    e.preventDefault();
    handleLink();
  }, [handleRequestClose, handleLink, isLinking]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !patient) return null;
  if (typeof document === 'undefined') return null;

  const selectedStudentData = selectedStudent 
    ? students.find(s => s.id === selectedStudent)
    : null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div
          className="link-modal-overlay app-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleRequestClose();
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="modal-container app-modal-shell app-modal-shell--xl"
            ref={modalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="link-patient-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            {/* Header */}
            <header className="modal-header app-modal-header">
              <div className="header-left app-modal-heading">
                <h2 id="link-patient-modal-title" className="app-modal-title">Vincular Paciente</h2>
                <p className="app-modal-subtitle">Selecione um aluno para realizar o acompanhamento</p>
              </div>
              <button 
                type="button" 
                onClick={handleRequestClose}
                disabled={isLinking}
                className="close-button app-modal-close"
                aria-label="Fechar"
              >
                <X size={24} />
              </button>
            </header>

            {/* Paciente Info */}
            <div className="patient-card">
              <div className="patient-avatar">
                {patient.nome?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="patient-info">
                <h3 className="patient-name">{patient.nome || 'Nome não informado'}</h3>
                <div className="patient-details">
                  {patient.cpf && (
                    <span className="patient-detail">
                      <Shield size={12} />
                      CPF: {patient.cpf.substring(0, 3)}.***.***-**
                    </span>
                  )}
                  {patient.dataNascimento && (
                    <span className="patient-detail">
                      <Calendar size={12} />
                      Nasc: {patient.dataNascimento}
                    </span>
                  )}
                  {patient.email && (
                    <span className="patient-detail">
                      <UserCheck size={12} />
                      {patient.email}
                    </span>
                  )}
                </div>
              </div>
              <div className="patient-status waiting">
                <Clock size={16} />
                <span>Aguardando vinculação</span>
              </div>
            </div>

            {/* Controles */}
            <div className="controls-section">
              <div className="search-container">
                <div className="search-icon">
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Buscar aluno por nome, email, matricula..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                  disabled={isLinking}
                />
                {searchTerm && (
                  <button 
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="clear-search"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="controls-right">
                <div className="sort-options">
                  <span className="sort-label">Ordenar por:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="sort-select"
                    disabled={isLinking}
                  >
                    <option value="name">Nome</option>
                    <option value="available">Disponibilidade</option>
                    <option value="load">Carga atual</option>
                  </select>
                </div>

                <div className="view-toggle">
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                    disabled={isLinking}
                  >
                    <Users size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    disabled={isLinking}
                  >
                    <BookOpen size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de Alunos */}
            <div className="students-section">
              <div className="section-header">
                <h4>Membros disponíveis</h4>
                <span className="students-count">
                  {filteredAndSortedStudents.length} de {students.length} membros
                </span>
              </div>

              {filteredAndSortedStudents.length === 0 ? (
                <div className="empty-students">
                  <div className="empty-icon">
                    <GraduationCap size={48} />
                  </div>
                  <h5>Nenhum aluno encontrado</h5>
                  <p>
                    {searchTerm 
                      ? 'Tente alterar os termos da busca' 
                      : 'Todos os alunos estão com a carga máxima'}
                  </p>
                </div>
              ) : viewMode === 'list' ? (
                <div className="students-list">
                  {filteredAndSortedStudents.map((student) => {
                    const isSelected = selectedStudent === student.id;
                    const isLimitReached = student.limiteAtingido;
                    
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => !isLinking && !isLimitReached && setSelectedStudent(student.id)}
                        disabled={isLinking || isLimitReached}
                        aria-pressed={isSelected}
                        className={`student-item ${isSelected ? 'selected' : ''} ${isLimitReached ? 'disabled' : ''}`}
                      >
                        <div className="student-avatar">
                          <GraduationCap size={20} />
                        </div>
                        
                        <div className="student-info">
                          <h5 className="student-name">{student.nome || 'Aluno sem nome'}</h5>
                          <div className="student-details">
                            {student.email && (
                              <span className="student-detail">
                                <UserCheck size={12} />
                                {student.email}
                              </span>
                            )}
                            {student.professor && (
                              <span className="student-detail">
                                <Shield size={12} />
                                Orientador: {student.professor}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="student-stats">
                          <div className="stat-item">
                            <div className="stat-label">Carga Atual</div>
                            <div className={`stat-value ${student.limiteAtingido ? 'limit-reached' : ''}`}>
                              {student.pacientesAtuais || 0}/5
                            </div>
                          </div>
                          <div className="stat-item">
                            <div className="stat-label">Disponível</div>
                            <div className="stat-value available">
                              {student.disponivel || 0}
                            </div>
                          </div>
                        </div>

                        <div className="student-selection">
                          {isLimitReached ? (
                            <div className="limit-badge">
                              <AlertTriangle size={14} />
                              <span>Limite</span>
                            </div>
                          ) : isSelected ? (
                            <div className="selected-badge">
                              <CheckCircle size={20} />
                            </div>
                          ) : (
                            <div className="select-badge" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="students-grid">
                  {filteredAndSortedStudents.map((student) => {
                    const isSelected = selectedStudent === student.id;
                    const isLimitReached = student.limiteAtingido;
                    
                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => !isLinking && !isLimitReached && setSelectedStudent(student.id)}
                        disabled={isLinking || isLimitReached}
                        aria-pressed={isSelected}
                        className={`student-card ${isSelected ? 'selected' : ''} ${isLimitReached ? 'disabled' : ''}`}
                      >
                        <div className="card-header">
                          <div className="student-avatar">
                            <GraduationCap size={20} />
                          </div>
                          <div className="card-actions">
                            {isLimitReached ? (
                              <div className="limit-indicator">
                                <AlertTriangle size={14} />
                              </div>
                            ) : isSelected ? (
                              <div className="selected-indicator">
                                <CheckCircle size={16} />
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="card-content">
                          <h5 className="student-name">{student.nome || 'Aluno sem nome'}</h5>
                          <p className="student-email">{student.email || 'Sem email'}</p>
                          
                          <div className="card-stats">
                            <div className="card-stat">
                              <div className="stat-label">Pacientes</div>
                              <div className={`stat-value ${student.limiteAtingido ? 'limit' : ''}`}>
                                {student.pacientesAtuais || 0}
                              </div>
                            </div>
                            <div className="card-stat">
                              <div className="stat-label">Disponível</div>
                              <div className="stat-value available">
                                {student.disponivel || 0}
                              </div>
                            </div>
                          </div>

                          {student.professor && (
                            <div className="card-supervisor">
                              <Shield size={12} />
                              <span>{student.professor}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Aluno Selecionado Preview */}
            {selectedStudentData && (
              <div className="selected-preview">
                <div className="preview-header">
                  <h4>Aluno Selecionado</h4>
                  <button
                    type="button"
                    onClick={() => setSelectedStudent('')}
                    className="clear-selection"
                    disabled={isLinking}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="preview-content">
                  <div className="preview-avatar">
                    <GraduationCap size={24} />
                  </div>
                  <div className="preview-info">
                    <h5 className="preview-name">{selectedStudentData.nome}</h5>
                    <div className="preview-details">
                      {selectedStudentData.email && (
                        <span className="preview-detail">{selectedStudentData.email}</span>
                      )}
                      {selectedStudentData.professor && (
                        <span className="preview-detail">
                          <Shield size={12} /> {selectedStudentData.professor}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="preview-stats">
                    <div className="preview-stat">
                      <div className="stat-label">Carga Atual</div>
                      <div className="stat-value">{selectedStudentData.pacientesAtuais || 0}/5</div>
                    </div>
                    <div className="preview-stat">
                      <div className="stat-label">Disponível</div>
                      <div className="stat-value available">{selectedStudentData.disponivel || 0}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Mensagens de Status */}
            {success && (
              <div className="success-message">
                <CheckCircle size={20} />
                <div>
                  <h5>Vinculação realizada!</h5>
                  <p>{success}</p>
                </div>
              </div>
            )}

            {error && (
              <div className="error-message">
                <AlertCircle size={20} />
                <div>
                  <h5>Erro na vinculação</h5>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {/* Footer */}
            <footer className="modal-footer app-modal-footer">
              <div className="app-modal-actions">
                <button
                  type="button"
                  onClick={handleRequestClose}
                  disabled={isLinking}
                  className="app-modal-btn app-modal-btn--secondary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleLink}
                  disabled={isLinking || !selectedStudent || selectedStudentData?.limiteAtingido}
                  className="app-modal-btn app-modal-btn--primary"
                >
                  {isLinking ? (
                    <>
                      <Loader2 className="spinner" size={18} />
                      <span>Vinculando...</span>
                    </>
                  ) : (
                    <>
                      <Link2 size={18} />
                      <span>Confirmar vinculação</span>
                    </>
                  )}
                </button>
              </div>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

export default LinkPatientModal;






