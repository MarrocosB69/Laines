import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

/**
 * Modal de solicitação de acesso institucional. `form` e os handlers de
 * mudança pertencem ao fluxo de solicitação (estado próprio dessa peça,
 * mantido no componente pai por interagir com o modal de recuperação
 * — ambos precisam se fechar mutuamente).
 *
 * Redesenho (docs/design/landing-guia-visual.md): o formulário longo (13
 * campos possíveis) ganha cabeçalhos de seção para dizer em que bloco a
 * pessoa está, e uma nota fixa junto ao cargo explica por que os campos
 * de matrícula/conselho aparecem e somem — a pessoa lê a regra antes de
 * escolher, não descobre por tentativa.
 */
const AccessRequestModal = ({
  open,
  modalRef,
  form,
  onFieldChange,
  onCpfChange,
  onProjectChange,
  projects,
  projectsLoading,
  loading,
  error,
  success,
  onSubmit,
  onClose
}) => {
  const isProfessorRequest = form.cargoSolicitado === 'professor';
  const isProfissionalRequest = form.cargoSolicitado === 'profissional';
  const canPickProject = isProfessorRequest || isProfissionalRequest;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="request-modal-overlay app-modal-overlay"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            className="request-modal app-modal-shell app-modal-shell--lg app-modal-shell--scrollable"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-access-modal-title"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
          >
            <div className="request-modal-header app-modal-header">
              <div className="app-modal-heading">
                <h3 id="request-access-modal-title" className="app-modal-title">Solicitar acesso</h3>
                <p className="app-modal-subtitle">Solicitação sujeita à aprovação da coordenação, com retorno por e-mail.</p>
              </div>
              <button type="button" className="app-modal-close request-modal-close" onClick={onClose} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={onSubmit} className="request-form app-modal-body">
              <div className="request-grid">
                <p className="app-modal-form-section">Identificação</p>

                <label className="request-field">
                  <span>Nome completo</span>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={onFieldChange('nome')}
                    placeholder="Seu nome"
                    required
                  />
                </label>

                <label className="request-field">
                  <span>CPF</span>
                  <input
                    type="text"
                    value={form.cpf}
                    onChange={onCpfChange}
                    placeholder="000.000.000-00"
                    maxLength="14"
                    required
                  />
                </label>

                <label className="request-field">
                  <span>Data de nascimento</span>
                  <input
                    type="date"
                    value={form.dataNascimento}
                    onChange={onFieldChange('dataNascimento')}
                    required
                  />
                </label>

                <p className="app-modal-form-section">Contato e instituição</p>

                <label className="request-field">
                  <span>E-mail</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={onFieldChange('email')}
                    placeholder="seu@email.com"
                    required
                  />
                </label>

                <label className="request-field">
                  <span>Telefone</span>
                  <input
                    type="tel"
                    value={form.telefone}
                    onChange={onFieldChange('telefone')}
                    placeholder="(00) 00000-0000"
                  />
                </label>

                <label className="request-field">
                  <span>Instituição</span>
                  <input
                    type="text"
                    value={form.instituicao}
                    onChange={onFieldChange('instituicao')}
                    placeholder="Universidade, secretaria, clube..."
                  />
                </label>

                <label className="request-field">
                  <span>Área</span>
                  <select value={form.area} onChange={onFieldChange('area')}>
                    <option value="nutricao">Nutrição</option>
                    <option value="fisioterapia">Fisioterapia</option>
                    <option value="psicologia">Psicologia</option>
                    <option value="outros">Outros</option>
                  </select>
                </label>

                <p className="app-modal-form-section">Acesso solicitado</p>

                <label className="request-field">
                  <span>Cargo solicitado</span>
                  <select
                    value={form.cargoSolicitado}
                    onChange={onFieldChange('cargoSolicitado')}
                    aria-describedby="request-cargo-hint"
                  >
                    <option value="professor">Professor</option>
                    <option value="profissional">Profissional</option>
                  </select>
                </label>

                <label className="request-field">
                  <span>Diretoria (opcional)</span>
                  <select value={form.diretoria} onChange={onFieldChange('diretoria')}>
                    <option value="">Sem diretoria</option>
                    <option value="diretoria_marketing">Diretoria de Marketing</option>
                    <option value="diretoria_ensino">Diretoria de Ensino</option>
                    <option value="diretoria_pesquisa">Diretoria de Pesquisa</option>
                    <option value="diretoria_extensao">Diretoria de Extensão</option>
                  </select>
                </label>

                <p id="request-cargo-hint" className="request-section-hint">
                  <Info size={14} />
                  Professor pede matrícula; profissional pede conselho de classe com número de registro. Nos dois casos é possível indicar um projeto parceiro logo abaixo, opcional.
                </p>

                {isProfessorRequest && (
                  <label className="request-field">
                    <span>Matrícula</span>
                    <input
                      type="text"
                      value={form.matricula}
                      onChange={onFieldChange('matricula')}
                      placeholder="Sua matrícula"
                      required
                    />
                  </label>
                )}

                {isProfissionalRequest && (
                  <>
                    <label className="request-field">
                      <span>Conselho profissional</span>
                      <select
                        value={form.conselhoTipo}
                        onChange={onFieldChange('conselhoTipo')}
                        required
                      >
                        <option value="">Selecione...</option>
                        <option value="CRN">CRN</option>
                        <option value="CREFITO">CREFITO</option>
                        <option value="CRP">CRP</option>
                        <option value="OUTRO">Outro</option>
                      </select>
                    </label>

                    <label className="request-field">
                      <span>Número do conselho</span>
                      <input
                        type="text"
                        value={form.conselhoNumero}
                        onChange={onFieldChange('conselhoNumero')}
                        placeholder="Registro profissional"
                        required
                      />
                    </label>
                  </>
                )}

                {canPickProject && (
                  <label className="request-field full">
                    <span>Projeto parceiro (opcional)</span>
                    <select
                      value={form.projetoId}
                      onChange={onProjectChange}
                      disabled={projectsLoading}
                    >
                      <option value="">{projectsLoading ? 'Carregando...' : 'Sem projeto'}</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <p className="app-modal-form-section">Sobre o uso</p>

                <label className="request-field full">
                  <span>Justificativa de uso (opcional)</span>
                  <textarea
                    rows="4"
                    value={form.justificativa}
                    onChange={onFieldChange('justificativa')}
                    placeholder="Conte, de forma breve, como pretende usar a plataforma."
                  />
                </label>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    className="request-message error"
                    role="alert"
                    aria-live="assertive"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                  >
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {success && (
                <div className="request-message success" role="status" aria-live="polite">
                  <CheckCircle2 size={16} />
                  <span>{success}</span>
                </div>
              )}

              <p className="request-privacy-notice">
                Os dados informados serão utilizados exclusivamente para análise da solicitação de acesso, conforme a LGPD. Você receberá retorno pelo e-mail informado.
              </p>

              <div className="request-actions app-modal-footer">
                <button
                  type="button"
                  className="request-secondary app-modal-btn app-modal-btn--secondary"
                  onClick={onClose}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="request-primary app-modal-btn app-modal-btn--primary"
                  disabled={loading}
                >
                  {loading ? 'Enviando...' : 'Enviar solicitação'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AccessRequestModal;
