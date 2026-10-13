import React, { useState, useCallback, useEffect } from 'react';
import { CheckCircle, ChevronLeft, ChevronRight, ClipboardList, Loader2, RotateCcw, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api, { getApiErrorMessage } from '../../services/api';
import { isValidCpf, normalizeCpf, isValidEmail } from '../../utils/validation';
import logoLaines from '../../assets/LogoLaines.webp';
import {
  getQuestionnaireForSex,
  scoreQuestionnaire
} from '../../constants/clinicalInstruments';
import {
  TRIAGEM_MEET_URL,
  SINAIS_NENHUM,
  EBIA_PERGUNTAS,
  TEMPO_PRATICA_OPCOES,
  FREQUENCIA_SEMANAL_OPCOES,
  initialForm,
  DRAFT_FIELDS,
  readDraft,
  writeDraft,
  clearDraft
} from './inscricao/constantes';
// Uma folha por superficie (docs/implementacao/inscricao-v2/change-intent.md).
// Antes das etapas: EscalasVisuais importa a propria folha e vem depois.
// Vocabulario visual comum com a primeira pagina (--lt-*): so custom properties.
import '../landing/landing-tokens.css';
import './inscricao-base.css';
import './inscricao-campos.css';
import Step1Termo from './inscricao/EtapaTermo';
import Step2DadosPessoais from './inscricao/EtapaDados';
import Step3Esporte from './inscricao/EtapaEsporte';
import Step4Saude from './inscricao/EtapaSaude';
import Step5Rotina from './inscricao/EtapaRotina';
import Step6Finalizacao from './inscricao/EtapaFinalizacao';

const STEPS = [
  { label: 'Termo' },
  { label: 'Dados pessoais' },
  { label: 'Esporte' },
  { label: 'Saúde' },
  { label: 'Rotina' },
  { label: 'Finalização' }
];

const validateSports = (esportes) => {
  const errors = {};
  const lista = Array.isArray(esportes) && esportes.length ? esportes : [{}];
  const names = new Set();
  if (lista.length > 5) errors.esportes_0_modalidade = 'Informe no máximo cinco esportes.';
  lista.forEach((esporte, index) => {
    const name = String(esporte?.modalidade || '').trim().replace(/\s+/g, ' ');
    const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
    const minutes = Number(esporte?.duracaoSessao);
    const weeklySessions = Number(esporte?.frequenciaSemanal);
    if (name.length < 2) errors[`esportes_${index}_modalidade`] = 'Informe o esporte com pelo menos duas letras.';
    else if (names.has(normalized)) errors[`esportes_${index}_modalidade`] = 'Este esporte já foi informado.';
    if (!TEMPO_PRATICA_OPCOES.includes(esporte?.tempoPratica)) {
      errors[`esportes_${index}_tempoPratica`] = 'Selecione o tempo de prática.';
    }
    if (!FREQUENCIA_SEMANAL_OPCOES.includes(weeklySessions)) {
      errors[`esportes_${index}_frequenciaSemanal`] = 'Selecione a frequência semanal.';
    }
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 480) {
      errors[`esportes_${index}_duracaoSessao`] = 'Informe de 1 a 480 minutos por sessão.';
    }
    names.add(normalized);
  });
  return errors;
};

export default function InscricaoPublica() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [globalError, setGlobalError] = useState('');
  const [draftRestaurado, setDraftRestaurado] = useState(false);

  // A etapa vive na URL para que o botao voltar do navegador — e o gesto de
  // swipe no celular — retroceda uma etapa em vez de descartar o formulario.
  // Sem o aceite do termo nenhuma etapa adiante e alcancavel, mesmo por link
  // direto.
  const stepFromUrl = Number(searchParams.get('etapa') || 1) - 1;
  const step = form.consentimentoAceito
    ? Math.min(Math.max(Number.isFinite(stepFromUrl) ? stepFromUrl : 0, 0), STEPS.length - 1)
    : 0;

  const irParaEtapa = useCallback((target, { replace = false } = {}) => {
    const proxima = Math.min(Math.max(target, 0), STEPS.length - 1);
    setSearchParams(
      proxima === 0 ? {} : { etapa: String(proxima + 1) },
      { replace }
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setSearchParams]);

  // Recupera o rascunho ao abrir. O aceite do termo nunca e restaurado.
  useEffect(() => {
    const draft = readDraft();
    if (!draft) return;
    setForm((current) => ({ ...current, ...draft }));
    setDraftRestaurado(true);
  }, []);

  useEffect(() => { writeDraft(form); }, [form]);

  const temPreenchimento = DRAFT_FIELDS.some((field) => {
    const value = form[field];
    if (field === 'tipoParticipante') return value !== 'adulto';
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });

  // Aviso do navegador ao fechar ou recarregar com dados nao enviados.
  useEffect(() => {
    if (!temPreenchimento || result) return undefined;
    const handler = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [temPreenchimento, result]);

  const sair = (event) => {
    if (!temPreenchimento) return;
    const ok = window.confirm(
      'Sair agora descarta o que você preencheu nesta triagem. Deseja sair mesmo assim?'
    );
    if (!ok) { event.preventDefault(); return; }
    clearDraft();
  };

  const descartarRascunho = () => {
    clearDraft();
    setForm(initialForm);
    setDraftRestaurado(false);
    irParaEtapa(0, { replace: true });
  };

  const validateStep = useCallback(() => {
    const errs = {};
    if (step === 0) {
      if (!form.consentimentoAceito) {
        errs.consentimentoAceito = 'Você precisa aceitar o Termo de Compromisso para continuar.';
      }
    }
    if (step === 1) {
      if (!form.nome.trim() || form.nome.trim().length < 3) errs.nome = 'Informe seu nome completo.';
      if (!isValidCpf(form.cpf)) errs.cpf = 'CPF inválido.';
      if (!form.dataNascimento) errs.dataNascimento = 'Informe sua data de nascimento.';
      if (!form.telefone.trim()) errs.telefone = 'Informe um telefone para contato.';
      if (form.email && !isValidEmail(form.email)) errs.email = 'E-mail inválido.';
      if (form.tipoParticipante === 'menor') {
        if (!form.nomeResponsavel.trim()) errs.nomeResponsavel = 'Informe o nome do responsável.';
        if (!isValidCpf(form.cpfResponsavel)) errs.cpfResponsavel = 'CPF do responsável inválido.';
      }
    }
    if (step === 2) Object.assign(errs, validateSports(form.esportes));
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [step, form]);

  const next = () => {
    if (!validateStep()) return;
    irParaEtapa(step + 1);
  };

  const back = () => {
    setErrors({});
    irParaEtapa(step - 1);
  };

  // Retroceder pelo stepper e livre; avancar continua exigindo validacao,
  // entao so etapas ja concluidas sao clicaveis.
  const goToStep = (target) => {
    if (target >= step) return;
    setErrors({});
    irParaEtapa(target);
  };

  const buildPayload = () => {
    const cpf = normalizeCpf(form.cpf);
    const ebiaParsed = form.ebia.some(Boolean)
      ? { respostas: EBIA_PERGUNTAS.map((q, i) => ({ pergunta: q, resposta: form.ebia[i] || null })) }
      : undefined;

    const comorbPessoais = [
      ...form.comorbidadesPessoais.filter((c) => c !== 'Outra' && c !== 'Nenhuma'),
      ...(form.comorbidadesPessoais.includes('Outra') && form.outraComorbidadePessoal.trim()
        ? [form.outraComorbidadePessoal.trim()]
        : [])
    ];

    const sinaisClinicos = form.sinaisClinicos.filter((item) => item !== SINAIS_NENHUM);
    const examesRealizados = form.examesRealizados.filter((item) => item !== 'Nenhum no último ano');

    // "Nenhuma" marcado explicitamente e diferente de campo nao respondido —
    // distincao que o ranking da lista de espera precisa enxergar.
    const relatoNegativo = {
      comorbidades: form.comorbidadesPessoais.includes('Nenhuma'),
      sinais: form.sinaisClinicos.includes(SINAIS_NENHUM),
      exames: form.examesRealizados.includes('Nenhum no último ano')
    };

    const familiaPai = form.familiaPai.filter((item) => item !== 'Nenhuma');
    const familiaMae = form.familiaMae.filter((item) => item !== 'Nenhuma');
    const comorbidadesFamiliares = (form.familiaPai.length || form.familiaMae.length)
      ? { pai: familiaPai, mae: familiaMae }
      : undefined;

    // Resumo legivel mantido em historicoSaude para as telas que ja leem esse campo.
    const resumoFamiliar = [
      form.familiaPai.length ? `Pai: ${form.familiaPai.join(', ')}` : '',
      form.familiaMae.length ? `Mãe: ${form.familiaMae.join(', ')}` : ''
    ].filter(Boolean).join(' | ');

    const questionario = getQuestionnaireForSex(form.sexoBiologico);
    const respostasReds = questionario
      ? Object.fromEntries(
        questionario.questions
          .map(({ key }) => [key, form.redsRespostas[key]])
          .filter(([, value]) => typeof value === 'boolean')
      )
      : {};
    const temRespostasReds = Object.keys(respostasReds).length > 0;
    const esportes = form.esportes.map((esporte) => ({
      modalidade: esporte.modalidade.trim().replace(/\s+/g, ' '),
      tempoPratica: esporte.tempoPratica,
      frequenciaSemanal: Number(esporte.frequenciaSemanal),
      duracaoSessao: Number(esporte.duracaoSessao)
    }));
    const primeiroEsporte = esportes[0];

    return {
      consentimentoAceito: form.consentimentoAceito,
      nome: form.nome.trim(),
      cpf,
      dataNascimento: form.dataNascimento || undefined,
      genero: form.genero || undefined,
      sexoBiologico: form.sexoBiologico || undefined,
      telefone: form.telefone.trim() || undefined,
      email: form.email.trim() || undefined,
      profissao: form.profissao.trim() || undefined,
      rendaMensal: form.rendaMensal || undefined,
      escolaridade: form.escolaridade || undefined,
      cidade: form.cidade.trim() || undefined,
      estado: form.estado || undefined,
      bairro: form.bairro.trim() || undefined,
      endereco: form.endereco.trim() || undefined,
      nomeResponsavel: form.nomeResponsavel.trim() || undefined,
      cpfResponsavel: form.cpfResponsavel ? normalizeCpf(form.cpfResponsavel) : undefined,
      esportes,
      modalidadePrincipal: primeiroEsporte.modalidade,
      outrasModalidades: esportes.slice(1).map((esporte) => esporte.modalidade).join(', ').slice(0, 200) || undefined,
      tempoPratica: primeiroEsporte.tempoPratica,
      frequenciaSemanal: primeiroEsporte.frequenciaSemanal,
      duracaoSessao: primeiroEsporte.duracaoSessao,
      lesaoAtual: typeof form.lesaoAtual === 'boolean' ? form.lesaoAtual : undefined,
      lesaoUltimos3Meses: typeof form.lesaoUltimos3Meses === 'boolean' ? form.lesaoUltimos3Meses : undefined,
      impactoLesao: (form.lesaoAtual === true || form.lesaoUltimos3Meses === true)
        ? form.impactoLesao || undefined : undefined,
      comorbidadesPessoais: comorbPessoais.length ? comorbPessoais : undefined,
      comorbidadesFamiliares,
      historicoSaude: resumoFamiliar || undefined,
      sinaisClinicos: sinaisClinicos.length ? sinaisClinicos : undefined,
      relatoNegativo,
      examesRealizados: examesRealizados.length ? examesRealizados : undefined,
      hidratacao: form.hidratacao ? Number(form.hidratacao) : undefined,
      bristol: form.bristol ? Number(form.bristol) : undefined,
      urinaPrimeira: form.urinaPrimeira ? Number(form.urinaPrimeira) : undefined,
      urinaUltima: form.urinaUltima ? Number(form.urinaUltima) : undefined,
      suplementoNoDia: form.suplementoNoDia || undefined,
      redsInstrumento: temRespostasReds ? questionario.id : undefined,
      redsRespostas: temRespostasReds ? respostasReds : undefined,
      redsScore: temRespostasReds ? scoreQuestionnaire(respostasReds) : undefined,
      avaliacaoSolicitada: form.avaliacaoSolicitada.length ? form.avaliacaoSolicitada : undefined,
      ebia: ebiaParsed,
      comoSoube: form.comoSoube || undefined,
      observacoes: form.observacoes.trim() || undefined
    };
  };

  const submit = async () => {
    const sportErrors = validateSports(form.esportes);
    if (Object.keys(sportErrors).length) {
      setErrors(sportErrors);
      irParaEtapa(2);
      return;
    }
    setGlobalError('');
    setSubmitting(true);
    try {
      const payload = buildPayload();
      const { data } = await api.post('/public/inscricao', payload);
      clearDraft();
      setResult(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setGlobalError(getApiErrorMessage(err) || 'Erro ao enviar inscrição. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="ip-page">
        <div className="ip-container ip-container--narrow">
          <div className="ip-success">
            <CheckCircle size={56} className="ip-success-icon" />
            <h1 className="ip-success-title">Solicitação recebida</h1>
            <p className="ip-success-subtitle">
              {result.message}
            </p>
            <p className="ip-success-body">
              Quando uma vaga estiver disponível, a equipe LAINES usará os contatos do cadastro
              para orientar os próximos passos.
            </p>
            <p className="ip-success-body">
              A triagem será orientada pela equipe. Quando solicitado, acesse a sala informada:
              {' '}
              <a href={TRIAGEM_MEET_URL} target="_blank" rel="noreferrer">
                sala de triagem LAINES
              </a>.
            </p>
            <p className="ip-success-body ip-success-body--muted">
              Enviar o formulário novamente não altera um cadastro anterior. Para corrigir dados
              ou contatos, procure a equipe LAINES.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const rotuloEtapaAtual = STEPS[step].label;

  return (
    <div className="ip-page">
      <header className="ip-header-band">
        <div className="ip-container ip-header">
          <div className="ip-header__marca">
            <span className="ip-header__emblema">
              <img src={logoLaines} alt="" width="512" height="512" />
            </span>
            <span className="ip-header__sigla">LAINES</span>
          </div>
          <a className="ip-exit" href="/" onClick={sair}>
            <X size={16} aria-hidden="true" />
            <span>Sair</span>
          </a>
          <div className="ip-header-text">
            <h1 className="ip-page-title">Formulário de Inscrição e Triagem</h1>
            <p className="ip-page-subtitle">
              Liga Acadêmica Interprofissional de Nutrição Esportiva — FACISA/UFRN
            </p>
          </div>
        </div>
      </header>

      <div className="ip-container">
        <nav className="ip-progress" aria-label="Etapas da inscrição">
          <p className="ip-progress__resumo">
            <span className="ip-progress__contagem">{`Etapa ${step + 1} de ${STEPS.length}`}</span>
            <span className="ip-progress__atual">{rotuloEtapaAtual}</span>
          </p>
          <ol className="ip-raias">
            {STEPS.map((s, i) => {
              const concluida = i < step;
              const atual = i === step;
              const conteudo = (
                <>
                  <span className="ip-raia__marca" aria-hidden="true" />
                  <span className="ip-raia__numero" aria-hidden="true">
                    {concluida ? <CheckCircle size={13} /> : i + 1}
                  </span>
                  <span className="ip-raia__rotulo">{s.label}</span>
                </>
              );
              return (
                <li key={s.label} className="ip-raia-item">
                  {concluida ? (
                    <button
                      type="button"
                      className="ip-raia ip-raia--concluida"
                      onClick={() => goToStep(i)}
                      disabled={submitting}
                      aria-label={`Voltar para a etapa ${i + 1}: ${s.label}`}
                    >
                      {conteudo}
                    </button>
                  ) : (
                    <span
                      className={`ip-raia${atual ? ' ip-raia--atual' : ''}`}
                      aria-current={atual ? 'step' : undefined}
                    >
                      {conteudo}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="ip-card">
          {draftRestaurado && !result && (
            <div className="ip-draft-note">
              <RotateCcw size={15} aria-hidden="true" />
              <span>
                Recuperamos o que você já tinha preenchido. Suas respostas de saúde não
                ficam salvas no aparelho — só os dados de cadastro.
              </span>
              <button type="button" className="ip-draft-discard" onClick={descartarRascunho}>
                Começar do zero
              </button>
            </div>
          )}
          <div className="ip-etapa-conteudo" key={step}>
            {step === 0 && <Step1Termo form={form} setForm={setForm} />}
            {step === 1 && <Step2DadosPessoais form={form} setForm={setForm} errors={errors} />}
            {step === 2 && <Step3Esporte form={form} setForm={setForm} errors={errors} />}
            {step === 3 && <Step4Saude form={form} setForm={setForm} />}
            {step === 4 && <Step5Rotina form={form} setForm={setForm} />}
            {step === 5 && <Step6Finalizacao form={form} setForm={setForm} />}
          </div>

          {errors.consentimentoAceito && (
            <p className="ip-error-msg ip-error-msg--block">{errors.consentimentoAceito}</p>
          )}
          {globalError && (
            <p className="ip-error-msg ip-error-msg--block">{globalError}</p>
          )}

          <div className="ip-nav">
            {step > 0 ? (
              <button className="ip-btn ip-btn--ghost" onClick={back} disabled={submitting}>
                <ChevronLeft size={18} /> Voltar
              </button>
            ) : (
              <a className="ip-btn ip-btn--ghost" href="/">
                <ChevronLeft size={18} /> Voltar ao site
              </a>
            )}
            <div className="ip-nav-spacer" />
            {step < STEPS.length - 1 ? (
              <button className="ip-btn ip-btn--primary" onClick={next}>
                Avançar <ChevronRight size={18} />
              </button>
            ) : (
              <button className="ip-btn ip-btn--primary" onClick={submit} disabled={submitting}>
                {submitting ? (
                  <><Loader2 size={18} className="ip-spin" /> Enviando...</>
                ) : (
                  <><ClipboardList size={18} /> Enviar inscrição</>
                )}
              </button>
            )}
          </div>
        </div>

        <p className="ip-footer-note">
          Dúvidas? Entre em contato pelo Instagram <strong>@laines.facisa</strong> ou compareça
          presencialmente à FACISA/UFRN.
        </p>
      </div>
    </div>
  );
}
