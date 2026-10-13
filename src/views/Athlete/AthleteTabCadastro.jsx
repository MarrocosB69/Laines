import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, ClipboardCheck, FileText, Shield, User } from 'lucide-react';

const fmt = (value, fallback = 'Não informado') => {
  if (Array.isArray(value)) {
    const s = value.map((i) => String(i || '').trim()).filter(Boolean);
    return s.length ? s.join(', ') : fallback;
  }
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return !text || text === 'nao_informado' ? fallback : text;
};

const formatShortDate = (value) => {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return null; }
};

const ORIGEM_LABELS = {
  equipe: 'Cadastro pela equipe',
  inscricao_publica: 'Inscrição pública',
  atleta: 'Autocadastro',
  desconhecida: 'Origem não identificada'
};

const CADASTRO_STATUS_LABELS = {
  lista_espera: 'Lista de espera',
  pre_cadastro: 'Pré-cadastro',
  cadastro_atleta_pendente: 'Cadastro pendente',
  cadastro_atleta_completo: 'Cadastro concluído'
};

const CADASTRO_STATUS_CLASS = {
  lista_espera: 'warn',
  pre_cadastro: 'warn',
  cadastro_atleta_pendente: 'warn',
  cadastro_atleta_completo: 'ok'
};

const FASE_TREINO_LABELS = {
  preparacao_geral: 'Preparação geral',
  pre_temporada: 'Pré-temporada',
  temporada_competitiva: 'Temporada competitiva',
  pos_temporada: 'Pós-temporada',
  ferias: 'Férias',
  lesionado: 'Período de lesão'
};

const InfoItem = ({ label, value }) => (
  <div className="athlete-prontuario-item">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const CadastroBlock = ({ icon: Icon, title, children }) => (
  <section className="ap-card">
    <h2 className="ap-card__header">
      <Icon size={16} /><span>{title}</span>
    </h2>
    {children}
  </section>
);

const AthleteTabCadastro = ({
  patient,
  cadastroAtleta,
  athleteInitials,
  athleteDisplayName,
  athleteAge,
  athleteInitialData,
  prontuarioIdentityItems,
  evaluationsSorted,
  latestEvaluationDateLabel,
  onCompleteOnboarding,
}) => {
  if (!patient) return null;

  /* ── Prefer cadastroAtleta, fallback to legacy fields ── */
  const ca = cadastroAtleta || {};
  const origemCadastro = ca.origemCadastro || null;
  const statusCadastroAtleta = ca.statusCadastroAtleta || null;
  const cadastroPendente = ca.cadastroPendente !== undefined
    ? Boolean(ca.cadastroPendente)
    : !patient?.confirmacaoAtleta?.completed;
  const completadoEm = ca.completadoEm || patient?.confirmacaoAtleta?.completadoEm || null;

  /* campos: merged view from backend; fallback to athleteInitialData */
  const campos = (ca.campos && typeof ca.campos === 'object') ? ca.campos : {};
  const d = (ca.dadosAutorrelatados && typeof ca.dadosAutorrelatados === 'object')
    ? ca.dadosAutorrelatados
    : (athleteInitialData || {});

  const isComplete = !cadastroPendente;
  const consentStatus = String(patient?.consentimentoPesquisa || '').toLowerCase();
  const consentOk = consentStatus === 'aceito' || consentStatus === 'aceite';

  /* ── Sport section ── */
  const sportFields = [
    { label: 'Modalidade', value: fmt(campos.modalidadePrincipal || d.modalidade || patient?.modalidadePrincipal) },
    { label: 'Nível', value: fmt(d.nivel) },
    { label: 'Clube', value: fmt(d.clube) },
    (d.frequenciaSemanal || patient?.frequenciaSemanal)
      ? { label: 'Frequência semanal', value: `${d.frequenciaSemanal || patient?.frequenciaSemanal}x / semana` }
      : null,
    (d.duracaoSessao || patient?.duracaoSessao)
      ? { label: 'Duração da sessão', value: `${d.duracaoSessao || patient?.duracaoSessao} min` }
      : null,
    (d.faseAtual)
      ? { label: 'Fase atual', value: FASE_TREINO_LABELS[d.faseAtual] || fmt(d.faseAtual) }
      : null,
    (d.objetivo || patient?.objetivo)
      ? { label: 'Objetivo', value: fmt(d.objetivo || patient?.objetivo) }
      : null,
  ].filter((item) => item && item.value && item.value !== 'Não informado');

  /* ── Clinical section — prefer campos (merged) ── */
  const queixaPrincipal = campos.queixaPrincipal || d.queixaPrincipal || patient?.observacoes || null;
  const historicoSaude = campos.historicoSaude || d.historicoSaude || patient?.historicoSaude || null;
  const patologiasList = (
    (Array.isArray(campos.comorbidadesPessoais) && campos.comorbidadesPessoais.length > 0)
      ? campos.comorbidadesPessoais
      : Array.isArray(d.patologias) ? d.patologias : []
  ).filter(Boolean);
  const comorbFamiliaList = (
    (Array.isArray(campos.comorbidadesFamiliares) && campos.comorbidadesFamiliares.length > 0)
      ? campos.comorbidadesFamiliares
      : Array.isArray(d.comorbidadesFamiliares) ? d.comorbidadesFamiliares : []
  ).filter(Boolean);
  const hasClinicalData = queixaPrincipal || historicoSaude || patologiasList.length > 0 || d.alergias;

  const statusClass = CADASTRO_STATUS_CLASS[statusCadastroAtleta] || 'neutral';
  const completadoDate = formatShortDate(completadoEm);

  return (
    <div className="ap-tab-body">

      <section className="ap-hero">
        <div className="ap-hero__profile">
          <div className="ap-hero__avatar">{athleteInitials}</div>
          <div className="ap-hero__meta">
            <h2 className="ap-hero__name">{athleteDisplayName}</h2>
            <p className="ap-hero__sub">{patient.modalidadePrincipal || 'Modalidade não informada'}</p>
            <p className="ap-hero__sub">
              {fmt(patient?.alunoResponsavelNome || patient?.alunoResponsavel?.nome, 'Equipe LAINES')}
            </p>
            {athleteAge != null && <span className="ap-hero__age">{athleteAge} anos</span>}
          </div>
        </div>
        <div className="ap-hero__stats">
          <div className="ap-hero__stat">
            <span>Avaliações</span>
            <strong>{evaluationsSorted.length}</strong>
          </div>
          <div className="ap-hero__stat">
            <span>Última avaliação</span>
            <strong>{latestEvaluationDateLabel}</strong>
          </div>
          <div className={`ap-hero__stat ap-hero__stat--${isComplete ? 'ok' : 'warn'}`}>
            <span>Cadastro</span>
            <strong>{isComplete ? 'Concluído' : 'Pendente'}</strong>
          </div>
          <div className={`ap-hero__stat ap-hero__stat--${consentOk ? 'ok' : 'warn'}`}>
            <span>Consentimento</span>
            <strong>{consentOk ? 'Aceito' : 'Pendente'}</strong>
          </div>
        </div>
      </section>

      {/* Status bar — origin, status, completion date, CTA */}
      <div className="ap-cadastro-status-bar">
        <div className="ap-cadastro-badges">
          {origemCadastro && (
            <span className="ap-cadastro-badge ap-cadastro-badge--origin">
              {ORIGEM_LABELS[origemCadastro] || origemCadastro}
            </span>
          )}
          {statusCadastroAtleta && (
            <span className={`ap-cadastro-badge ap-cadastro-badge--${statusClass}`}>
              {isComplete
                ? <><CheckCircle2 size={12} /> {CADASTRO_STATUS_LABELS[statusCadastroAtleta]}</>
                : <><AlertTriangle size={12} /> {CADASTRO_STATUS_LABELS[statusCadastroAtleta]}</>}
            </span>
          )}
          {completadoDate && (
            <span className="ap-cadastro-badge ap-cadastro-badge--date">
              Concluído em {completadoDate}
            </span>
          )}
        </div>
        {cadastroPendente && onCompleteOnboarding && (
          <button type="button" className="ap-complete-btn" onClick={onCompleteOnboarding}>
            <ClipboardCheck size={14} />
            Completar cadastro
          </button>
        )}
      </div>

      <CadastroBlock icon={User} title="Quem sou">
        <div className="ap-dossie__pills">
          <span className="athlete-pill neutral">Nº {fmt(patient?.prontuario, 'Pendente')}</span>
          <span className={`athlete-pill ${isComplete ? 'ok' : 'pending'}`}>
            {isComplete ? 'Cadastro concluído' : 'Cadastro pendente'}
          </span>
          <span className={`athlete-pill ${consentOk ? 'ok' : 'pending'}`}>
            {consentOk ? 'Consentimento aceito' : 'Consentimento pendente'}
          </span>
        </div>
        <div className="athlete-prontuario-grid">
          {prontuarioIdentityItems.map((item) => (
            <InfoItem key={item.label} label={item.label} value={item.value} />
          ))}
          {(campos.telefone || patient?.telefone) && (
            <InfoItem label="Telefone" value={fmt(campos.telefone || patient?.telefone)} />
          )}
          {(campos.cidade || patient?.cidade) && (
            <InfoItem
              label="Cidade / Estado"
              value={[campos.cidade || patient?.cidade, campos.estado || patient?.estado].filter(Boolean).join(' / ')}
            />
          )}
        </div>
      </CadastroBlock>

      {sportFields.length > 0 && (
        <CadastroBlock icon={Activity} title="Meu esporte">
          <div className="athlete-prontuario-grid">
            {sportFields.map((item) => (
              <InfoItem key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </CadastroBlock>
      )}

      {hasClinicalData && (
        <CadastroBlock icon={FileText} title="Histórico clínico">
          <div className="ap-dossie__body" style={{ paddingTop: 0, borderTop: 'none', marginTop: 0 }}>
            {queixaPrincipal && (
              <div className="ap-dossie__section">
                <h3>Queixa principal</h3>
                <p className="athlete-text">{queixaPrincipal}</p>
              </div>
            )}
            {historicoSaude && (
              <div className="ap-dossie__section">
                <h3>Histórico de saúde</h3>
                <p className="athlete-text">{historicoSaude}</p>
              </div>
            )}
            {patologiasList.length > 0 && (
              <div className="ap-dossie__section">
                <h3>Patologias / Comorbidades</h3>
                <div className="athlete-prontuario-chip-list">
                  {patologiasList.map((p) => (
                    <span key={p} className="athlete-prontuario-chip">{p}</span>
                  ))}
                </div>
              </div>
            )}
            {d.alergias && (
              <div className="ap-dossie__section">
                <h3>Alergias / Intolerâncias</h3>
                <p className="athlete-text">{d.alergias}</p>
              </div>
            )}
            {comorbFamiliaList.length > 0 && (
              <div className="ap-dossie__section">
                <h3>Comorbidades familiares</h3>
                <div className="athlete-prontuario-chip-list">
                  {comorbFamiliaList.map((c) => (
                    <span key={c} className="athlete-prontuario-chip">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CadastroBlock>
      )}

      {!hasClinicalData && !isComplete && (
        <div className="ap-forms-gate">
          <AlertTriangle size={14} />
          <span>
            Histórico clínico pendente — conclua o cadastro para adicionar seus dados de saúde.
          </span>
          {onCompleteOnboarding && (
            <button type="button" className="athlete-action-btn" onClick={onCompleteOnboarding}>
              Completar agora
            </button>
          )}
        </div>
      )}

      <CadastroBlock icon={Shield} title="Consentimento de pesquisa">
        <span className={`athlete-pill ${consentOk ? 'ok' : 'pending'}`}>
          {consentOk ? 'Termo aceito' : 'Termo pendente'}
        </span>
        {!consentOk && (
          <p className="athlete-text" style={{ marginTop: '0.5rem' }}>
            A assinatura do termo de consentimento ainda não foi registrada.
            Solicite à equipe LAINES.
          </p>
        )}
      </CadastroBlock>

    </div>
  );
};

export default AthleteTabCadastro;
