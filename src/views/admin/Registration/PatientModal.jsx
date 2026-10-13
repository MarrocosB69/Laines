import React, { useEffect, useMemo, useState, useCallback, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Phone, MapPin, Calendar, FileText, Users, Activity, AlertCircle, Save, Plus, Trash2, ClipboardList, ChevronDown, Lock } from 'lucide-react';
import api, { getApiErrorMessage } from '../../../services/api';
import { normalizeStatus } from '../../../utils/dateUtils';
import { isValidCpf, isValidEmail, isPastDate, normalizeCpf } from '../../../utils/validation';
import { generateInstitutionalEmail } from '../../../utils/institutionalEmail';
import { getUserDisplayName, normalizeUserList } from '../../../utils/userAdapter';
import { normalizeRole } from '../../../constants/roles';
import { useAuth } from '../../../contexts/AuthContext';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { useModalBodyLock } from '../../../hooks/useModalBodyLock';
import { useModalFocusTrap } from '../../../hooks/useModalFocusTrap';
import './PatientModal.css';

const isForbiddenError = (err) => Number(err?.response?.status || 0) === 403;

/**
 * O curso vem digitado à mão no cadastro e chega em capitalizações
 * diferentes ("Nutricao", "nutricao"). Normalizar só na exibição evita
 * reescrever dado de outra tela por causa de estética desta.
 */
const formatarCurso = (curso) => {
  const texto = String(curso || '').trim();
  if (!texto) return null;
  return texto
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|\s|-)([\p{L}])/gu, (_, antes, letra) => antes + letra.toLocaleUpperCase('pt-BR'));
};

const AREA_LABELS = {
  nutricao: 'Nutrição',
  fisioterapia: 'Fisioterapia',
  psicologia: 'Psicologia',
  educacao_fisica: 'Educação Física',
  medicina: 'Medicina',
  outro: 'Outro'
};

const PAPEL_LABELS = {
  avaliador: 'Avaliador',
  supervisor: 'Supervisor',
  consultor: 'Consultor',
  outro: 'Outro'
};
const EQUIPE_MULTI_ALLOWED_ROLES = new Set([
  'aluno',
  'presidente',
  'vice',
  'professor',
  'profissional',
  'pesquisador',
  'colaborador'
]);
const PATIENT_ACCESS_MANAGER_ROLES = new Set([
  'admin',
  'coordenacao'
]);
const PATIENT_CASE_TEAM_MANAGER_ROLES = new Set([
  ...PATIENT_ACCESS_MANAGER_ROLES
]);

const BRISTOL_NOMES = {
  1: 'Tipo 1 – Caroços duros (constipação grave)',
  2: 'Tipo 2 – Salsicha irregular',
  3: 'Tipo 3 – Salsicha com rachaduras',
  4: 'Tipo 4 – Salsicha lisa (ideal)',
  5: 'Tipo 5 – Pedaços macios',
  6: 'Tipo 6 – Pastoso',
  7: 'Tipo 7 – Aquoso (diarreia)'
};

const AVALIACAO_LABELS = {
  nutricional: 'Avaliação nutricional',
  fisioterapia: 'Fisioterapia',
  psicologia: 'Psicologia'
};

const normalizeConsentimentoPesquisa = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'aceite') return 'aceito';
  return normalized || 'pendente';
};

const createEmptyPatientFormData = () => ({
  nome: '',
  cpf: '',
  dataNascimento: '',
  genero: 'nao_informado',
  sexoBiologico: 'nao_informado',
  telefone: '',
  email: '',
  endereco: '',
  bairro: '',
  cidade: '',
  estado: '',
  status: 'Lista de Espera',
  modalidadePrincipal: '',
  tempoPratica: '',
  frequenciaSemanal: '',
  duracaoSessao: '',
  outrasModalidades: '',
  tipoTreino: 'misto',
  intensidade: 'moderada',
  objetivo: 'performance',
  observacoes: '',
  projetoId: '',
  equipeTecnicaIds: [],
  equipeProfissional: [],
  atletaUserId: '',
  consentimentoPesquisa: 'pendente',
  consentimentoData: '',
  consentimentoVersao: ''
});

const normalizeOptionalNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
};

const sortRecord = (value) => {
  if (Array.isArray(value)) return value.map(sortRecord);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortRecord(value[key]);
      return acc;
    }, {});
};

const comparableValue = (value) => {
  if (value === undefined || value === null || value === '') return '';
  if (Array.isArray(value) || typeof value === 'object') {
    return JSON.stringify(sortRecord(value));
  }
  return String(value).trim();
};

const buildComparablePatientData = (data = {}) => ({
  nome: data.nome || '',
  cpf: data.cpf || '',
  dataNascimento: data.dataNascimento || '',
  genero: data.genero || 'nao_informado',
  sexoBiologico: data.sexoBiologico || 'nao_informado',
  telefone: data.telefone || '',
  email: data.email || '',
  endereco: data.endereco || '',
  bairro: data.bairro || '',
  cidade: data.cidade || '',
  estado: data.estado || '',
  status: normalizeStatus(data.status),
  modalidadePrincipal: data.modalidadePrincipal || '',
  tempoPratica: data.tempoPratica || '',
  frequenciaSemanal: normalizeOptionalNumber(data.frequenciaSemanal),
  duracaoSessao: normalizeOptionalNumber(data.duracaoSessao),
  outrasModalidades: data.outrasModalidades || '',
  tipoTreino: data.tipoTreino || 'misto',
  intensidade: data.intensidade || 'moderada',
  objetivo: data.objetivo || 'performance',
  observacoes: data.observacoes || '',
  projetoId: data.projetoId || null,
  projetoNome: data.projetoNome || '',
  equipeTecnicaIds: Array.isArray(data.equipeTecnicaIds) ? data.equipeTecnicaIds : [],
  equipeProfissional: Array.isArray(data.equipeProfissional) ? data.equipeProfissional : [],
  atletaUserId: data.atletaUserId || null,
  consentimentoPesquisa: normalizeConsentimentoPesquisa(data.consentimentoPesquisa),
  consentimentoData: data.consentimentoData || '',
  consentimentoVersao: data.consentimentoVersao || ''
});

const buildPatientUpdatePayload = (nextData, initialData) => {
  const previousData = buildComparablePatientData(initialData);
  return Object.entries(nextData).reduce((payload, [key, value]) => {
    if (comparableValue(value) !== comparableValue(previousData[key])) {
      payload[key] = value;
    }
    return payload;
  }, {});
};

function TriagemDataSection({ dados }) {
  const [open, setOpen] = React.useState(true);
  if (!dados || Object.keys(dados).length === 0) return null;

  const chips = (arr) => Array.isArray(arr) && arr.length > 0
    ? arr.map((v) => <span key={v} className="triagem-chip">{v}</span>)
    : <span className="triagem-empty">—</span>;

  const val = (v) => (v != null && v !== '') ? String(v) : null;

  return (
    <div className="triagem-section">
      <button
        type="button"
        className="triagem-section__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <ClipboardList size={15} />
        <span>Dados preenchidos pelo atleta na inscrição</span>
        <ChevronDown size={15} className={`triagem-chevron${open ? ' triagem-chevron--open' : ''}`} />
      </button>

      {open && (
        <div className="triagem-section__body">
          <div className="triagem-grid">
            {val(dados.profissao) && (
              <div className="triagem-field">
                <span className="triagem-label">Profissão</span>
                <span className="triagem-value">{dados.profissao}</span>
              </div>
            )}
            {val(dados.rendaMensal) && (
              <div className="triagem-field">
                <span className="triagem-label">Renda familiar</span>
                <span className="triagem-value">{dados.rendaMensal}</span>
              </div>
            )}
            {val(dados.escolaridade) && (
              <div className="triagem-field">
                <span className="triagem-label">Escolaridade</span>
                <span className="triagem-value">{dados.escolaridade}</span>
              </div>
            )}
            {val(dados.hidratacao) && (
              <div className="triagem-field">
                <span className="triagem-label">Ingestão hídrica</span>
                <span className="triagem-value">{dados.hidratacao} L/dia</span>
              </div>
            )}
            {val(dados.bristol) && (
              <div className="triagem-field">
                <span className="triagem-label">Escala de Bristol</span>
                <span className="triagem-value">{BRISTOL_NOMES[dados.bristol] || `Tipo ${dados.bristol}`}</span>
              </div>
            )}
            {val(dados.comoSoube) && (
              <div className="triagem-field">
                <span className="triagem-label">Como conheceu a LAINES</span>
                <span className="triagem-value">{dados.comoSoube}</span>
              </div>
            )}
          </div>

          {Array.isArray(dados.avaliacaoSolicitada) && dados.avaliacaoSolicitada.length > 0 && (
            <div className="triagem-row">
              <span className="triagem-label">Avaliações solicitadas</span>
              <div className="triagem-chips">
                {dados.avaliacaoSolicitada.map((v) => (
                  <span key={v} className="triagem-chip triagem-chip--accent">
                    {AVALIACAO_LABELS[v] || v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(dados.examesRealizados) && dados.examesRealizados.length > 0 && (
            <div className="triagem-row">
              <span className="triagem-label">Exames realizados</span>
              <div className="triagem-chips">{chips(dados.examesRealizados)}</div>
            </div>
          )}

          {dados.ebia?.respostas && (
            <div className="triagem-row">
              <span className="triagem-label">Segurança alimentar (EBIA)</span>
              <div className="triagem-ebia">
                {dados.ebia.respostas.map((r, i) => (
                  <div key={i} className="triagem-ebia-item">
                    <span className={`triagem-ebia-resp triagem-ebia-resp--${r.resposta === 'Sim' ? 'yes' : 'no'}`}>
                      {r.resposta || '—'}
                    </span>
                    <span className="triagem-ebia-q">{r.pergunta}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(val(dados.nomeResponsavel) || val(dados.cpfResponsavel)) && (
            <div className="triagem-row">
              <span className="triagem-label">Responsável legal</span>
              <span className="triagem-value">
                {dados.nomeResponsavel}
                {dados.cpfResponsavel ? ` — CPF: ${dados.cpfResponsavel}` : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Acompanha qual seção está sob a barra de navegação.
 *
 * IntersectionObserver em vez de ouvir `scroll`: o navegador só avisa quando
 * a interseção muda, então não há trabalho a cada pixel rolado. A faixa de
 * observação começa abaixo da barra fixa — é de lá que o leitor está lendo.
 */
function useSecaoVisivel(ids, ativo) {
  const [atual, setAtual] = useState(ids[0]);

  useEffect(() => {
    if (!ativo) return undefined;
    const alvos = ids
      .map((id) => document.getElementById(`secao-${id}`))
      .filter(Boolean);
    if (alvos.length === 0) return undefined;

    const observador = new IntersectionObserver(
      (entradas) => {
        const visiveis = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visiveis[0]) setAtual(visiveis[0].target.id.replace('secao-', ''));
      },
      { rootMargin: '-58px 0px -70% 0px', threshold: 0 }
    );
    alvos.forEach((a) => observador.observe(a));
    return () => observador.disconnect();
  }, [ids, ativo]);

  return atual;
}

/**
 * Secoes do formulario, na ordem em que aparecem.
 *
 * O rotulo aqui e curto de proposito: e atalho de navegacao, nao titulo — o
 * titulo completo continua no cabecalho de cada secao.
 */
const SECOES_IDS = ['identificacao', 'contato', 'esporte', 'vinculo', 'equipe', 'consentimento'];

const SECOES = [
  { id: 'identificacao', rotulo: 'Identificação' },
  { id: 'contato', rotulo: 'Contato' },
  { id: 'esporte', rotulo: 'Esporte' },
  { id: 'vinculo', rotulo: 'Vínculo' },
  { id: 'equipe', rotulo: 'Equipe' },
  { id: 'consentimento', rotulo: 'Consentimento' }
];

const PatientModal = ({ isOpen, onClose, onSave, initialData, onCreate }) => {
  const secaoAtual = useSecaoVisivel(SECOES_IDS, isOpen);
  const [formData, setFormData] = useState(createEmptyPatientFormData);
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [multiProfUsers, setMultiProfUsers] = useState([]);
  const [athleteUsers, setAthleteUsers] = useState([]);
  const [newMembro, setNewMembro] = useState({ userId: '', area: 'nutricao', papel: 'avaliador' });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const modalRef = useRef(null);
  // Prefixo dos ids que ligam rótulo, dica e erro aos campos (padrão de
  // src/views/public/inscricao/campos.jsx): o modal abre no admin e no
  // painel do professor, e ids fixos poderiam repetir.
  const campoId = useId();
  const erroId = `${campoId}-erro`;
  const { notify } = useUiFeedback();
  const { user } = useAuth();

  useModalBodyLock(isOpen);
  useModalFocusTrap(isOpen, modalRef);

  const canManageAccessLinks = useMemo(() => {
    const role = normalizeRole(user?.role);
    return PATIENT_ACCESS_MANAGER_ROLES.has(role);
  }, [user?.role]);

  const canManagePatientLinks = useMemo(() => {
    const role = normalizeRole(user?.role);
    return PATIENT_CASE_TEAM_MANAGER_ROLES.has(role);
  }, [user?.role]);

  const hasRequiredActiveLinks = useMemo(() => Boolean(
    (initialData?.alunoResponsavelId || initialData?.alunoResponsavel?.id)
    && (initialData?.professorSupervisorId || initialData?.professorSupervisor?.id)
  ), [initialData]);

  const canSelectActiveStatus = canManagePatientLinks && hasRequiredActiveLinks && Boolean(formData.projetoId);

  const buildAthleteEmailFromName = (fullName) => generateInstitutionalEmail(fullName);

  useEffect(() => {
    if (initialData) {
      setFormData({
        nome: initialData.nome || '',
        cpf: initialData.cpf || '',
        dataNascimento: initialData.dataNascimento || '',
        genero: initialData.genero || 'nao_informado',
        sexoBiologico: initialData.sexoBiologico || 'nao_informado',
        telefone: initialData.telefone || '',
        email: initialData.email || '',
        endereco: initialData.endereco || '',
        bairro: initialData.bairro || '',
        cidade: initialData.cidade || '',
        estado: initialData.estado || '',
        status: normalizeStatus(initialData.status),
        modalidadePrincipal: initialData.modalidadePrincipal || '',
        tempoPratica: initialData.tempoPratica || '',
        frequenciaSemanal: initialData.frequenciaSemanal || '',
        duracaoSessao: initialData.duracaoSessao || '',
        outrasModalidades: initialData.outrasModalidades || '',
        tipoTreino: initialData.tipoTreino || 'misto',
        intensidade: initialData.intensidade || 'moderada',
        objetivo: initialData.objetivo || 'performance',
        observacoes: initialData.observacoes || '',
        projetoId: initialData.projetoId || '',
        equipeTecnicaIds: initialData.equipeTecnicaIds || [],
        equipeProfissional: initialData.equipeProfissional || [],
        atletaUserId: initialData.atletaUserId || '',
        consentimentoPesquisa: normalizeConsentimentoPesquisa(initialData.consentimentoPesquisa),
        consentimentoData: initialData.consentimentoData || '',
        consentimentoVersao: initialData.consentimentoVersao || ''
      });
    } else {
      setFormData(createEmptyPatientFormData());
    }
    setError('');
    setNewMembro({ userId: '', area: 'nutricao', papel: 'avaliador' });
  }, [initialData, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const loadProjects = async () => {
      try {
        const { data } = await api.get('/projetos');
        const sorted = Array.isArray(data)
          ? data.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
          : [];
        setProjects(sorted);
      } catch (err) {
        const status = Number(err?.response?.status || 0);
        if (status !== 403) {
          console.error('Erro ao carregar projetos:', err);
        }
        notify({
          type: 'error',
          title: 'Acesso a projetos indisponível',
          message: status === 403
            ? 'Seu perfil não possui permissão para consultar projetos.'
            : getApiErrorMessage(err, 'Não foi possível carregar projetos.')
        });
        setProjects([]);
      }
    };
    loadProjects();
  }, [isOpen, notify]);

  useEffect(() => {
    if (!isOpen) return;
    if (!canManagePatientLinks) {
      setTeamMembers([]);
      setAthleteUsers([]);
      setMultiProfUsers([]);
      return;
    }
    const loadAccessUsers = async () => {
      try {
        const { data } = await api.get(canManageAccessLinks ? '/users?limit=200' : '/users/equipe-atendimento');
        const users = normalizeUserList(data);
        setTeamMembers(users.filter((item) => item.role === 'tecnico'));
        setAthleteUsers(canManageAccessLinks ? users.filter((item) => item.role === 'atleta') : []);
        setMultiProfUsers(users.filter((item) => EQUIPE_MULTI_ALLOWED_ROLES.has(normalizeRole(item.role))));
      } catch (err) {
        if (!isForbiddenError(err)) {
          console.error('Erro ao carregar equipe técnica:', err);
        }
        setTeamMembers([]);
        setAthleteUsers([]);
        setMultiProfUsers([]);
      }
    };
    loadAccessUsers();
  }, [canManageAccessLinks, canManagePatientLinks, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      return next;
    });
  };

  const handleToggleEquipe = (id) => {
    setFormData((prev) => {
      const selected = new Set(prev.equipeTecnicaIds || []);
      if (selected.has(id)) {
        selected.delete(id);
      } else {
        selected.add(id);
      }
      return { ...prev, equipeTecnicaIds: Array.from(selected) };
    });
  };

  /**
   * Todo mundo que aparece na equipe enxerga o prontuário do atleta — o
   * backend já concede acesso por `equipeMultiIds`, e o aluno responsável
   * entra pelo próprio vínculo. Reunir os dois numa lista só é o que torna
   * essa consequência visível para quem edita.
   *
   * O responsável não é editável aqui: ele é definido no vínculo do paciente.
   * Aparece como linha fixa para que a lista não minta por omissão.
   */
  const equipeComAcesso = useMemo(() => {
    const responsavelId = initialData?.alunoResponsavelId || initialData?.alunoResponsavel?.id || '';
    const responsavelNome = initialData?.alunoResponsavelNome
      || initialData?.alunoResponsavel?.name
      || '';

    const membros = (formData.equipeProfissional || []).map((m) => {
      const usuario = multiProfUsers.find((u) => u.id === m.userId);
      return {
        ...m,
        curso: m.curso || usuario?.curso || null,
        vinculo: m.userId === responsavelId ? 'responsavel' : 'equipe',
        removivel: true
      };
    });

    // O responsável só entra sozinho se ainda não estiver na equipe.
    const jaListado = membros.some((m) => m.userId === responsavelId);
    if (responsavelId && !jaListado) {
      const usuario = multiProfUsers.find((u) => u.id === responsavelId);
      membros.unshift({
        userId: responsavelId,
        userName: responsavelNome || getUserDisplayName(usuario, responsavelId),
        curso: usuario?.curso || null,
        area: null,
        papel: null,
        vinculo: 'responsavel',
        removivel: false
      });
    }

    return membros.sort((a2, b2) => (
      a2.vinculo === b2.vinculo ? 0 : a2.vinculo === 'responsavel' ? -1 : 1
    ));
  }, [formData.equipeProfissional, multiProfUsers, initialData]);

  const handleAddMembro = () => {
    if (!newMembro.userId || !newMembro.area) return;
    const user = multiProfUsers.find((u) => u.id === newMembro.userId);
    if (!user) return;
    setFormData((prev) => {
      const already = (prev.equipeProfissional || []).some((m) => m.userId === newMembro.userId);
      if (already) return prev;
      return {
        ...prev,
        equipeProfissional: [
          ...(prev.equipeProfissional || []),
          {
            userId: user.id,
            userName: getUserDisplayName(user, user.id),
            // Guardado no vinculo, e nao so lido do usuario: o curso na epoca
            // do atendimento e o que vale para o registro.
            curso: user.curso || null,
            area: newMembro.area,
            papel: newMembro.papel || 'avaliador'
          }
        ]
      };
    });
    setNewMembro({ userId: '', area: 'nutricao', papel: 'avaliador' });
  };

  const handleRemoveMembro = (userId) => {
    setFormData((prev) => ({
      ...prev,
      equipeProfissional: (prev.equipeProfissional || []).filter((m) => m.userId !== userId)
    }));
  };

  const requiredFields = useMemo(() => ([
    'nome',
    'dataNascimento',
    'genero',
    'telefone'
  ]), []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Campos marcados como obrigatorios no HTML, onde quer que estejam.
      const formulario = e.currentTarget;
      if (formulario && typeof formulario.checkValidity === 'function' && !formulario.checkValidity()) {
        const invalido = formulario.querySelector(':invalid');
        if (invalido) {
          invalido.scrollIntoView({ behavior: 'smooth', block: 'center' });
          invalido.focus({ preventScroll: true });
          const rotulo = invalido.closest('.space-y-2')?.querySelector('label')?.textContent
            || invalido.name
            || 'um campo obrigatório';
          throw new Error(`Falta preencher: ${rotulo.replace('*', '').trim()}.`);
        }
      }

      const missing = requiredFields.filter((field) => !formData[field]);
      if (missing.length > 0) {
        throw new Error('Preencha todos os campos obrigatórios.');
      }
      const isEditing = Boolean(initialData?.id);
      const currentCpf = normalizeCpf(formData.cpf || '');
      const initialCpf = normalizeCpf(initialData?.cpf || '');
      const cpfWasChanged = currentCpf !== initialCpf;
      const shouldValidateCpf = !isEditing || cpfWasChanged;

      if (shouldValidateCpf && !currentCpf) {
        throw new Error('CPF obrigatorio.');
      }
      if (shouldValidateCpf && !isValidCpf(currentCpf)) {
        throw new Error('CPF inválido.');
      }
      if (formData.email && !isValidEmail(formData.email)) {
        throw new Error('E-mail inválido.');
      }
      if (!isPastDate(formData.dataNascimento)) {
        throw new Error('Data de nascimento inválida.');
      }

      const isActivatingPatient = normalizeStatus(formData.status) === 'Ativo'
        && (!isEditing || normalizeStatus(initialData?.status) !== 'Ativo');
      if (isActivatingPatient && !canSelectActiveStatus) {
        throw new Error('Use o vinculo com aluno, supervisor e projeto antes de ativar o atleta.');
      }

      const canManageAthleteAccess = canManageAccessLinks;
      const generatedEmail = canManageAthleteAccess && !isEditing ? buildAthleteEmailFromName(formData.nome) : '';
      let athleteEmail = canManageAthleteAccess
        ? (generatedEmail || String(formData.email || '').trim())
        : String(formData.email || '').trim();
      if (canManageAthleteAccess && !isEditing && !athleteEmail) {
        throw new Error('E-mail do atleta não foi gerado. Verifique o nome completo.');
      }

      let athleteUserId = canManageAthleteAccess ? formData.atletaUserId : '';
      let accessDelivery = null;

      if (canManageAthleteAccess && !isEditing && !athleteUserId) {
        const { data: usersData } = await api.get('/users?limit=200');
          const users = normalizeUserList(usersData);
          const athleteCpf = normalizeCpf(formData.cpf || '');
          const existingUserByCpf = users.find((item) => (
            String(item.role || '').toLowerCase() === 'atleta' &&
            normalizeCpf(item.cpf || '') === athleteCpf
          ));
          const existingUserByEmail = users.find(
            (item) => String(item.email || '').toLowerCase() === athleteEmail.toLowerCase()
          );
          const existingUser = existingUserByCpf || existingUserByEmail;

          if (existingUser) {
            if (String(existingUser.role || '').toLowerCase() !== 'atleta') {
              throw new Error('Já existe um usuário com este e-mail, mas não é atleta.');
            }
            const existingCpf = normalizeCpf(existingUser.cpf || '');
            if (existingCpf && athleteCpf && existingCpf !== athleteCpf) {
              throw new Error('Já existe outro usuário com o mesmo e-mail institucional. Ajuste o nome para diferenciar o login.');
            }
            athleteUserId = existingUser.id;
            athleteEmail = existingUser.email || athleteEmail;
          } else {
            const { data: created } = await api.post('/users', {
              name: formData.nome,
              role: 'atleta',
              email: formData.email || undefined,
              cpf: formData.cpf,
              dataNascimento: formData.dataNascimento,
              telefone: formData.telefone,
              status: 'ativo'
            });

            athleteUserId = created?.user?.id;
            athleteEmail = created?.user?.email || athleteEmail;
            accessDelivery = created?.activation?.delivery || 'unavailable';
          }
      }

      const selectedProject = projects.find((project) => project.id === formData.projetoId) || null;
      const frequenciaSemanal = formData.frequenciaSemanal === ''
        ? null
        : Number(formData.frequenciaSemanal);
      const duracaoSessao = formData.duracaoSessao === ''
        ? null
        : Number(formData.duracaoSessao);
      if (
        (frequenciaSemanal !== null && !Number.isFinite(frequenciaSemanal))
        || (duracaoSessao !== null && !Number.isFinite(duracaoSessao))
      ) {
        throw new Error('Frequência semanal e duração da sessão devem ser números válidos.');
      }

      const patientData = {
        ...formData,
        email: String(formData.email || '').trim(),
        frequenciaSemanal,
        duracaoSessao,
        projetoId: formData.projetoId || null,
        atletaUserId: canManageAthleteAccess ? (athleteUserId || formData.atletaUserId || null) : null,
        status: normalizeStatus(formData.status),
        projetoNome: selectedProject?.nome || ''
      };

      if (initialData?.id && !cpfWasChanged) {
        delete patientData.cpf;
      }
      if (!canManagePatientLinks) {
        delete patientData.equipeTecnicaIds;
        delete patientData.equipeProfissional;
      }
      if (!canManageAccessLinks) {
        delete patientData.atletaUserId;
      }

      if (initialData?.id) {
        const updatePayload = buildPatientUpdatePayload(patientData, initialData);
        if (Object.keys(updatePayload).length > 0) {
          await api.patch(`/pacientes/${initialData.id}`, updatePayload);
        }
      } else if (onCreate) {
        await onCreate(patientData);
      } else {
        await api.post('/pacientes', patientData);
      }

      if (onSave) onSave();
      if (onClose) onClose();

      if (accessDelivery) {
        notify({
          type: 'success',
          title: 'Atleta criado',
          message: `Acesso do atleta ${athleteEmail} criado com credencial provisória ativa.`
        });
      }
    } catch (err) {
      console.error('Erro ao salvar atleta:', err);
      const apiMessage = err?.response
        ? getApiErrorMessage(err, 'Erro ao salvar dados.')
        : (err?.message || 'Erro ao salvar dados.');
      setError(apiMessage);
      notify({
        type: 'error',
        title: 'Erro ao salvar atleta',
        message: apiMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestClose = useCallback(() => {
    if (loading) return;
    onClose?.();
  }, [loading, onClose]);

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

  const athleteAccessEmptyLabel = initialData?.id
    ? (initialData?.atletaUserId ? 'Remover vinculo de acesso' : 'Manter sem acesso vinculado')
    : 'Criar novo acesso automaticamente';
  const projectSummary = projects.find((project) => project.id === formData.projetoId)?.nome
    || initialData?.projetoNome
    || 'Sem projeto';
  const teamSummaryCount = (
    (Array.isArray(formData.equipeTecnicaIds) ? formData.equipeTecnicaIds.length : 0)
    + (Array.isArray(formData.equipeProfissional) ? formData.equipeProfissional.length : 0)
  );

  const modalContent = (
    <div
      className="patient-modal-overlay app-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleRequestClose();
        }
      }}
    >
      <div
        className="patient-modal-container app-modal-shell app-modal-shell--xl"
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="patient-modal-header app-modal-header">
          <div className="app-modal-heading">
            <h2 id="patient-modal-title" className="app-modal-title">{initialData ? 'Editar Atleta' : 'Novo Atleta'}</h2>
            <p className="app-modal-subtitle">Cadastro completo do atleta e rotina esportiva</p>
          </div>
          <button
            onClick={handleRequestClose}
            className="app-modal-close"
            type="button"
            aria-label="Fechar modal de atleta"
          >
            <X size={24} />
          </button>
        </div>

        {/* noValidate porque a validacao nativa aponta para o primeiro campo
            invalido — que num formulario de seis secoes costuma estar fora da
            tela. O balao aparecia onde ninguem via e o clique em Salvar nao
            fazia nada. Aqui a checagem e a mesma, mas a recusa e visivel. */}
        <form onSubmit={handleSubmit} noValidate className="patient-modal-form app-modal-body">
          <div className="patient-form-overview" role="group" aria-label="Resumo do cadastro do atleta">
            <div className="patient-form-overview__item">
              <span className="patient-form-overview__icon"><User size={16} /></span>
              <div>
                <span className="patient-form-overview__label">Status</span>
                <strong>{normalizeStatus(formData.status) || 'Lista de Espera'}</strong>
              </div>
            </div>
            <div className="patient-form-overview__item">
              <span className="patient-form-overview__icon"><FileText size={16} /></span>
              <div>
                <span className="patient-form-overview__label">Projeto</span>
                <strong>{projectSummary}</strong>
              </div>
            </div>
            <div className="patient-form-overview__item">
              <span className="patient-form-overview__icon"><Users size={16} /></span>
              <div>
                <span className="patient-form-overview__label">Equipe</span>
                <strong>{teamSummaryCount} membro(s)</strong>
              </div>
            </div>
          </div>

          {initialData?.confirmacaoAtleta?.dados && (
            <TriagemDataSection dados={initialData.confirmacaoAtleta.dados} />
          )}

          {/* Seis secoes num rolamento longo nao davam nenhuma nocao de onde
              se esta nem de quanto falta. Estes atalhos levam direto e a
              secao recebe foco, entao o teclado acompanha o clique. */}
          <nav className="patient-form-nav" aria-label="Seções do cadastro">
            {SECOES.map((secao) => (
              <button
                key={secao.id}
                type="button"
                className={`patient-form-nav__item${secaoAtual === secao.id ? ' patient-form-nav__item--ativo' : ''}`}
                aria-current={secaoAtual === secao.id ? 'true' : undefined}
                onClick={() => {
                  const alvo = document.getElementById(`secao-${secao.id}`);
                  if (!alvo) return;
                  alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  alvo.focus({ preventScroll: true });
                }}
              >
                {secao.rotulo}
              </button>
            ))}
          </nav>

          <div className="patient-form-grid app-modal-form-grid">
            <div id="secao-identificacao" className="patient-section-title app-modal-form-section" tabIndex={-1} role="heading" aria-level={3}>
              <User size={16} /> Identificação
            </div>

            <div className="col-span-full space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-nome`}>Nome completo <span className="patient-field-required" aria-hidden="true">*</span></label>
              <input
                type="text"
                id={`${campoId}-nome`}
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                placeholder="Ex: João da Silva"
                className="patient-field-input app-modal-input"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-cpf`}>CPF <span className="patient-field-required" aria-hidden="true">*</span></label>
              <input
                type="text"
                id={`${campoId}-cpf`}
                name="cpf"
                value={formData.cpf}
                onChange={handleChange}
                placeholder="000.000.000-00"
                className="patient-field-input app-modal-input"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-dataNascimento`}>Data de nascimento <span className="patient-field-required" aria-hidden="true">*</span></label>
              <input
                type="date"
                id={`${campoId}-dataNascimento`}
                name="dataNascimento"
                value={formData.dataNascimento}
                onChange={handleChange}
                className="patient-field-input app-modal-input"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-genero`}>Sexo <span className="patient-field-required" aria-hidden="true">*</span></label>
              <select
                id={`${campoId}-genero`}
                name="genero"
                value={formData.genero}
                onChange={handleChange}
                className="patient-field-select app-modal-select"
                required
              >
                <option value="nao_informado">Prefiro não informar</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-sexoBiologico`}>Sexo biologico</label>
              <select
                id={`${campoId}-sexoBiologico`}
                name="sexoBiologico"
                value={formData.sexoBiologico}
                onChange={handleChange}
                className="patient-field-select app-modal-select"
              >
                <option value="nao_informado">Prefiro nao informar</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
              </select>
            </div>

            <div id="secao-contato" className="patient-section-title app-modal-form-section" tabIndex={-1} role="heading" aria-level={3}>
              <Phone size={16} /> Contato e endereço
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-telefone`}>Telefone / WhatsApp <span className="patient-field-required" aria-hidden="true">*</span></label>
              <input
                type="tel"
                id={`${campoId}-telefone`}
                name="telefone"
                value={formData.telefone}
                onChange={handleChange}
                placeholder="(00) 00000-0000"
                className="patient-field-input app-modal-input"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-email`}>E-mail</label>
              <input
                type="email"
                id={`${campoId}-email`}
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="joao@email.com"
                className="patient-field-input app-modal-input"
              />
            </div>

            <div className="col-span-full space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-endereco`}>Endereço</label>
              <input
                type="text"
                id={`${campoId}-endereco`}
                name="endereco"
                value={formData.endereco}
                onChange={handleChange}
                placeholder="Rua, número, complemento"
                className="patient-field-input app-modal-input"
              />
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-bairro`}>Bairro</label>
              <input
                type="text"
                id={`${campoId}-bairro`}
                name="bairro"
                value={formData.bairro}
                onChange={handleChange}
                placeholder="Centro"
                className="patient-field-input app-modal-input"
              />
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-cidade`}>Cidade</label>
              <input
                type="text"
                id={`${campoId}-cidade`}
                name="cidade"
                value={formData.cidade}
                onChange={handleChange}
                placeholder="Natal"
                className="patient-field-input app-modal-input"
              />
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-estado`}>Estado</label>
              <input
                type="text"
                id={`${campoId}-estado`}
                name="estado"
                value={formData.estado}
                onChange={handleChange}
                placeholder="RN"
                className="patient-field-input app-modal-input"
              />
            </div>

            <div id="secao-esporte" className="patient-section-title app-modal-form-section" tabIndex={-1} role="heading" aria-level={3}>
              <Activity size={16} /> Esporte e rotina
            </div>

            <div className="col-span-full space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-modalidadePrincipal`}>Modalidade principal <span className="patient-field-required" aria-hidden="true">*</span></label>
              <input
                type="text"
                id={`${campoId}-modalidadePrincipal`}
                name="modalidadePrincipal"
                value={formData.modalidadePrincipal}
                onChange={handleChange}
                placeholder="Ex: Corrida, Crossfit"
                className="patient-field-input app-modal-input"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-tempoPratica`}>Tempo de prática</label>
              <input
                type="text"
                id={`${campoId}-tempoPratica`}
                name="tempoPratica"
                value={formData.tempoPratica}
                onChange={handleChange}
                placeholder="Ex: 3 anos"
                className="patient-field-input app-modal-input"
              />
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-frequenciaSemanal`}>Frequência (dias/semana) <span className="patient-field-required" aria-hidden="true">*</span></label>
              <input
                type="number"
                id={`${campoId}-frequenciaSemanal`}
                name="frequenciaSemanal"
                value={formData.frequenciaSemanal}
                onChange={handleChange}
                placeholder="Ex: 5"
                className="patient-field-input app-modal-input"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-duracaoSessao`}>Duração por sessão (min) <span className="patient-field-required" aria-hidden="true">*</span></label>
              <input
                type="number"
                id={`${campoId}-duracaoSessao`}
                name="duracaoSessao"
                value={formData.duracaoSessao}
                onChange={handleChange}
                placeholder="Ex: 60"
                className="patient-field-input app-modal-input"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-outrasModalidades`}>Outras modalidades</label>
              <input
                type="text"
                id={`${campoId}-outrasModalidades`}
                name="outrasModalidades"
                value={formData.outrasModalidades}
                onChange={handleChange}
                placeholder="Ex: Musculação, Yoga"
                className="patient-field-input app-modal-input"
              />
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-tipoTreino`}>Tipo de treino</label>
              <select
                id={`${campoId}-tipoTreino`}
                name="tipoTreino"
                value={formData.tipoTreino}
                onChange={handleChange}
                className="patient-field-select app-modal-select"
              >
                <option value="forca">Força</option>
                <option value="resistencia">Resistência</option>
                <option value="tecnico">Técnico</option>
                <option value="misto">Misto</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-intensidade`}>Intensidade percebida</label>
              <select
                id={`${campoId}-intensidade`}
                name="intensidade"
                value={formData.intensidade}
                onChange={handleChange}
                className="patient-field-select app-modal-select"
              >
                <option value="leve">Leve</option>
                <option value="moderada">Moderada</option>
                <option value="intensa">Intensa</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-objetivo`}>Objetivo principal</label>
              <select
                id={`${campoId}-objetivo`}
                name="objetivo"
                value={formData.objetivo}
                onChange={handleChange}
                className="patient-field-select app-modal-select"
              >
                <option value="performance">Performance</option>
                <option value="estetica">Estética</option>
                <option value="saude">Saúde</option>
              </select>
            </div>

            <div id="secao-vinculo" className="patient-section-title app-modal-form-section" tabIndex={-1} role="heading" aria-level={3}>
              <FileText size={16} /> Vínculo e observações
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-status`}>Status do atendimento</label>
              <select
                id={`${campoId}-status`}
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="patient-field-select app-modal-select"
                aria-describedby={!canSelectActiveStatus && normalizeStatus(formData.status) !== 'Ativo' ? `${campoId}-status-dica` : undefined}
              >
                <option value="Ativo" disabled={!canSelectActiveStatus}>Ativo</option>
                <option value="Lista de Espera">Lista de espera</option>
                <option value="Triagem Publica">Triagem pública</option>
                <option value="Triagem">Triagem</option>
                <option value="Inativo">Inativo</option>
                <option value="Alta">Alta</option>
              </select>
              {!canSelectActiveStatus && normalizeStatus(formData.status) !== 'Ativo' && (
                <small className="field-hint" id={`${campoId}-status-dica`}>
                  Para ativar, use o fluxo de vinculo com aluno, supervisor responsavel e projeto.
                </small>
              )}
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-projetoId`}>Projeto de pesquisa</label>
              <select
                id={`${campoId}-projetoId`}
                name="projetoId"
                value={formData.projetoId}
                onChange={handleChange}
                className="patient-field-select app-modal-select"
              >
                <option value="">Sem projeto</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.nome}
                  </option>
                ))}
              </select>
            </div>

            {canManagePatientLinks && (
              <>
            <div id="secao-equipe" className="patient-section-title app-modal-form-section" tabIndex={-1} role="heading" aria-level={3}>
              <Users size={16} /> {canManageAccessLinks ? 'Equipe técnica e acesso' : 'Equipe de atendimento'}
            </div>

            {canManageAccessLinks && (
              <div className="col-span-full space-y-2">
                <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-atletaUserId`}>Usuário do atleta</label>
                <select
                  id={`${campoId}-atletaUserId`}
                  name="atletaUserId"
                  value={formData.atletaUserId}
                  onChange={handleChange}
                  className="patient-field-select app-modal-select"
                  aria-describedby={`${campoId}-atletaUserId-dica`}
                >
                  <option value="">{athleteAccessEmptyLabel}</option>
                  {athleteUsers.map((athlete) => (
                    <option key={athlete.id} value={athlete.id}>
                      {getUserDisplayName(athlete, athlete.id)}
                    </option>
                  ))}
                </select>
                <small className="field-hint" id={`${campoId}-atletaUserId-dica`}>
                  {initialData?.id
                    ? 'A criacao automatica de novo acesso fica reservada ao cadastro inicial do atleta.'
                    : 'A coordenacao pode criar o acesso do atleta junto com o cadastro inicial.'}
                </small>
              </div>
            )}

            <div className="col-span-full space-y-2">
              <label className="patient-field-label app-modal-field-label" id={`${campoId}-equipe-tecnica`}>Equipe técnica vinculada</label>
              <div
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 patient-team-grid"
                role="group"
                aria-labelledby={`${campoId}-equipe-tecnica`}
              >
                {teamMembers.length === 0 ? (
                  <span className="patient-team-empty">Nenhuma equipe cadastrada.</span>
                ) : (
                  teamMembers.map((member) => (
                    <label key={member.id} className="patient-team-option">
                      <input
                        type="checkbox"
                        checked={(formData.equipeTecnicaIds || []).includes(member.id)}
                        onChange={() => handleToggleEquipe(member.id)}
                        className="patient-team-checkbox"
                      />
                      <span className="patient-team-name">{getUserDisplayName(member, member.id)}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="col-span-full space-y-3">
              <label className="patient-field-label app-modal-field-label" id={`${campoId}-equipe-multi`}>Equipe de atendimento multiprofissional</label>

              {/* Os três selects não têm rótulo visível (seria texto novo):
                  o grupo leva o título acima e cada um, o próprio nome. */}
              <div className="equipe-multi-add-row" role="group" aria-labelledby={`${campoId}-equipe-multi`}>
                <select
                  value={newMembro.userId}
                  onChange={(e) => setNewMembro((p) => ({ ...p, userId: e.target.value }))}
                  className="patient-field-select app-modal-select"
                  aria-label="Membro da equipe"
                >
                  <option value="">Selecionar membro da equipe…</option>
                  {multiProfUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {getUserDisplayName(u, u.id)}{formatarCurso(u.curso) ? ` — ${formatarCurso(u.curso)}` : ''}
                    </option>
                  ))}
                </select>

                <select
                  value={newMembro.area}
                  onChange={(e) => setNewMembro((p) => ({ ...p, area: e.target.value }))}
                  className="patient-field-select app-modal-select"
                  aria-label="Área do membro"
                >
                  {Object.entries(AREA_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>

                <select
                  value={newMembro.papel}
                  onChange={(e) => setNewMembro((p) => ({ ...p, papel: e.target.value }))}
                  className="patient-field-select app-modal-select"
                  aria-label="Papel do membro"
                >
                  {Object.entries(PAPEL_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleAddMembro}
                  disabled={!newMembro.userId}
                  className="app-modal-btn app-modal-btn--secondary equipe-multi-add-btn"
                  aria-label="Adicionar membro à equipe"
                >
                  <Plus size={16} />
                </button>
              </div>

              {equipeComAcesso.length > 0 && (
                <>
                  <p className="equipe-multi-aviso">
                    Todos abaixo têm acesso ao prontuário deste atleta.
                  </p>
                  <ul className="equipe-multi-list">
                    {equipeComAcesso.map((m) => (
                      <li key={m.userId} className="equipe-multi-item">
                        <span className="equipe-multi-nome">
                          {m.userName}
                          {formatarCurso(m.curso) && (
                            <span className="equipe-multi-curso">{formatarCurso(m.curso)}</span>
                          )}
                        </span>
                        <span className={`equipe-multi-tag equipe-multi-vinculo equipe-multi-vinculo--${m.vinculo}`}>
                          {m.vinculo === 'responsavel' ? 'Aluno responsável' : 'Equipe'}
                        </span>
                        {m.area && (
                          <span className="equipe-multi-tag equipe-multi-area">
                            {AREA_LABELS[m.area] || m.area}
                          </span>
                        )}
                        {m.papel && (
                          <span className="equipe-multi-tag equipe-multi-papel">
                            {PAPEL_LABELS[m.papel] || m.papel}
                          </span>
                        )}
                        {m.removivel ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveMembro(m.userId)}
                            className="equipe-multi-remove"
                            aria-label={`Remover ${m.userName} da equipe`}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          /* O responsavel e definido no vinculo do paciente,
                             nao aqui — remover daqui daria a impressao de que
                             o vinculo tinha sido desfeito. */
                          <span className="equipe-multi-fixo" title="Definido no vínculo do paciente" role="img" aria-label="Definido no vínculo do paciente">
                            <Lock size={13} />
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* A mensagem olhava so para `equipeProfissional`, entao aparecia
                  embaixo de uma lista que ja mostrava o aluno responsavel —
                  dizendo "nenhum membro" logo apos exibir um. */}
              {(formData.equipeProfissional || []).length === 0 && (
                <span className="patient-team-empty">
                  {equipeComAcesso.length > 0
                    ? 'Nenhum profissional além do aluno responsável.'
                    : 'Nenhum membro adicionado à equipe de atendimento.'}
                </span>
              )}
            </div>

              </>
            )}

            <div className="col-span-full space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-observacoes`}>Observações iniciais</label>
              <textarea
                id={`${campoId}-observacoes`}
                name="observacoes"
                value={formData.observacoes}
                onChange={handleChange}
                rows="3"
                placeholder="Informações adicionais relevantes..."
                className="patient-field-textarea app-modal-textarea"
              />
            </div>

            <div id="secao-consentimento" className="patient-section-title app-modal-form-section" tabIndex={-1} role="heading" aria-level={3}>
              <FileText size={16} /> Consentimento para pesquisa
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-consentimentoPesquisa`}>Status do consentimento</label>
              <select
                id={`${campoId}-consentimentoPesquisa`}
                name="consentimentoPesquisa"
                value={formData.consentimentoPesquisa}
                onChange={handleChange}
                className="patient-field-select app-modal-select"
              >
                <option value="pendente">Pendente</option>
                <option value="aceito">Aceito</option>
                <option value="recusado">Recusado</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-consentimentoData`}>Data do consentimento</label>
              <input
                type="date"
                id={`${campoId}-consentimentoData`}
                name="consentimentoData"
                value={formData.consentimentoData}
                onChange={handleChange}
                className="patient-field-input app-modal-input"
              />
            </div>

            <div className="space-y-2">
              <label className="patient-field-label app-modal-field-label" htmlFor={`${campoId}-consentimentoVersao`}>Versão do termo</label>
              <input
                type="text"
                id={`${campoId}-consentimentoVersao`}
                name="consentimentoVersao"
                value={formData.consentimentoVersao}
                onChange={handleChange}
                placeholder="Ex: v1.0"
                className="patient-field-input app-modal-input"
              />
            </div>
          </div>

          {error && (
            <div className="patient-modal-error app-modal-inline-message app-modal-inline-message--error" id={erroId} role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="patient-modal-footer app-modal-footer">
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
                className="app-modal-btn app-modal-btn--primary"
                disabled={loading}
                aria-describedby={error ? erroId : undefined}
              >
                {loading ? (
                  <>Salvando...</>
                ) : (
                  <>
                    <Save size={18} />
                    {initialData ? 'Salvar alterações' : 'Cadastrar atleta'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default PatientModal;











