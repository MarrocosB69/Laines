import { isStudentMemberRole, normalizeRole } from '../constants/roles';

const REQUIRED_FIELD_LABELS = {
  name: 'Nome completo',
  cpf: 'CPF',
  telefone: 'Telefone',
  dataNascimento: 'Data de nascimento',
  matricula: 'Matrícula',
  curso: 'Curso',
  periodo: 'Período',
  supervisorId: 'Professor supervisor',
  projetoId: 'Projeto'
};

const BASE_REQUIRED_FIELDS = ['name', 'cpf', 'telefone', 'dataNascimento'];
// Participação acadêmica: identifica a pessoa e o vínculo com a liga. Sem
// isso, o cadastro fica incompleto e bloqueia o uso do sistema.
const STUDENT_PARTICIPATION_FIELDS = ['matricula', 'curso', 'periodo'];
// Habilitação para atendimento: libera a rotina clínica (agenda, pacientes),
// mas não é cadastro obrigatório da liga. Sem supervisor/projeto, o aluno
// continua lendo a Liga normalmente; só o atendimento fica pendente
// (UPD-13, produto-clinico.md — "Liga acadêmica: leitura transversal").
const STUDENT_ATENDIMENTO_FIELDS = ['supervisorId', 'projetoId'];

const isFilled = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
};

export const getRequiredProfileFields = (role) => {
  const normalizedRole = normalizeRole(role);
  if (isStudentMemberRole(normalizedRole)) {
    return [...BASE_REQUIRED_FIELDS, ...STUDENT_PARTICIPATION_FIELDS];
  }
  return [...BASE_REQUIRED_FIELDS];
};

// Campos que habilitam o atendimento clínico. Não entram no cadastro
// obrigatório (getRequiredProfileFields) para não bloquear a leitura da Liga.
export const getAtendimentoProfileFields = (role) => (
  isStudentMemberRole(normalizeRole(role)) ? [...STUDENT_ATENDIMENTO_FIELDS] : []
);

export const getProfileCompletionState = (user) => {
  if (!user) {
    return {
      complete: true,
      missingFields: [],
      requiredFields: [],
      role: ''
    };
  }

  const requiredFields = getRequiredProfileFields(user.role);
  const missingFields = requiredFields.filter((field) => !isFilled(user[field]));

  return {
    complete: missingFields.length === 0,
    missingFields,
    requiredFields,
    role: normalizeRole(user.role)
  };
};

export const getRequiredFieldLabel = (field) => REQUIRED_FIELD_LABELS[field] || field;
