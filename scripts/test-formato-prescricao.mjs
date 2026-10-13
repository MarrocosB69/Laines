import assert from 'node:assert/strict';
import { n, sinal, qtd } from '../src/components/Prescricao/formato.js';

for (const missing of [null, undefined, NaN, Infinity, -Infinity, '']) {
  assert.equal(n(missing), '—');
  assert.equal(sinal(missing), '—');
  assert.equal(qtd(missing), '—');
}
assert.equal(n(0), '0');
assert.equal(sinal(0), '0');
assert.equal(qtd(0), '0');
assert.equal(n(1234.5, 1), '1.234,5');
assert.equal(sinal(2), '+2');
assert.equal(sinal(-2), '-2');
assert.equal(qtd(1.5), '1,5');
console.log('Prescricao: ausente/NaN/infinito nao aparecem; zero e finitos preservados.');
