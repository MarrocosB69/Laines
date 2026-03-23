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
const STUDENT_REQUIRED_FIELDS = ['matricula', 'curso', 'periodo', 'supervisorId', 'projetoId'];

const isFilled = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
};

export const getRequiredProfileFields = (role) => {
  const normalizedRole = normalizeRole(role);
  if (isStudentMemberRole(normalizedRole)) {
    return [...BASE_REQUIRED_FIELDS, ...STUDENT_REQUIRED_FIELDS];
  }
  return [...BASE_REQUIRED_FIELDS];
};

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
