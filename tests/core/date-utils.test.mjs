import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toDate,
  toDateKey,
  toLocalDateInputValue,
  formatDate
} from '../../src/utils/dateUtils.js';

test('toLocalDateInputValue retorna formato yyyy-mm-dd', () => {
  const value = toLocalDateInputValue(new Date('2026-03-10T15:30:00-03:00'));
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/);
});

test('toDateKey preserva data local para Date valido', () => {
  const key = toDateKey(new Date('2026-03-10T00:00:00-03:00'));
  assert.equal(key, '2026-03-10');
});

test('toDate parseia string ISO e falha com valor invalido', () => {
  assert.ok(toDate('2026-03-10T10:00:00.000Z') instanceof Date);
  assert.equal(toDate('invalid-date'), null);
});

test('formatDate gera data pt-BR padrao', () => {
  assert.equal(formatDate('2026-03-10T00:00:00.000Z'), '10/03/2026');
});
