import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_AREA_ROLES,
  PROFESSOR_AREA_ROLES,
  getRedirectPathFromRole,
  normalizeRole
} from '../../src/constants/roles.js';

test('normalizeRole normaliza variacoes comuns', () => {
  assert.equal(normalizeRole('Diretoria de Extensao'), 'diretoria_extensao');
  assert.equal(normalizeRole('COORDENACAO GERAL'), 'coordenacao');
  assert.equal(normalizeRole('Vice-Presidente'), 'vice');
  assert.equal(normalizeRole('student'), 'aluno');
  assert.equal(normalizeRole('Parceiro'), 'colaborador');
});

test('getRedirectPathFromRole resolve rotas por perfil', () => {
  assert.equal(getRedirectPathFromRole('admin'), '/admin');
  assert.equal(getRedirectPathFromRole('diretoria_extensao'), '/admin');
  assert.equal(getRedirectPathFromRole('professor'), '/professor');
  assert.equal(getRedirectPathFromRole('aluno'), '/aluno');
  assert.equal(getRedirectPathFromRole('tecnico'), '/equipe');
  assert.equal(getRedirectPathFromRole('atleta'), '/atleta');
  assert.equal(getRedirectPathFromRole('desconhecido'), '/');
});

test('constantes de papeis essenciais estao presentes', () => {
  assert.ok(ADMIN_AREA_ROLES.includes('coord_atendimento'));
  assert.ok(PROFESSOR_AREA_ROLES.includes('profissional'));
});
