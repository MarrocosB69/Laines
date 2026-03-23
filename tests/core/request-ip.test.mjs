import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { extractClientIp } = require('../../server/dist/common/request-ip.js');

test('extractClientIp prioriza req.ip quando disponivel', () => {
  const ip = extractClientIp({
    ip: '10.0.0.15',
    headers: {
      'x-forwarded-for': '177.10.10.10, 10.0.0.1'
    }
  });
  assert.equal(ip, '10.0.0.15');
});

test('extractClientIp usa x-forwarded-for quando req.ip vazio', () => {
  const ip = extractClientIp({
    ip: '',
    headers: {
      'x-forwarded-for': '177.10.10.10, 10.0.0.1'
    }
  });
  assert.equal(ip, '177.10.10.10');
});

test('extractClientIp normaliza ipv6 mapped', () => {
  const ip = extractClientIp({
    ip: '::ffff:192.168.1.10',
    headers: {}
  });
  assert.equal(ip, '192.168.1.10');
});
