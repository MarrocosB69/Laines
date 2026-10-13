// UPD-18 (frente "proteção de edição não salva") — UX-07, último parágrafo:
// mudanças não salvas precisam de proteção contra abandono, SEPARADA do
// redirecionamento de sessão. Sessão expirada é o pior caso: ninguém
// escolheu sair, e o redirecionamento para o login levaria junto uma
// avaliação clínica longa ou um plano alimentar em edição, se ninguém
// guardar um rascunho local antes do redirecionamento acontecer.
//
// Este teste exercita a lógica PURA de src/hooks/useEdicaoPendente.js
// (isDirty, buildDraftKey, salvarRascunho, lerRascunho, limparRascunho), não
// o hook React em si — sem DOM, sem componente montado. window/localStorage
// são simulados manualmente porque o módulo só os acessa em tempo de
// chamada (getSafeStorage), nunca no import — mesmo padrão de
// scripts/test-contexto-navegacao.cjs.
//
// Regra inegociável (dado clínico em navegador possivelmente compartilhado):
// chave por usuário E por registro; limpeza ao salvar com sucesso; rascunho
// de uma conta nunca legível por outra no mesmo navegador. A seção 3 abaixo
// prova isso, e a seção 2 falha sozinha se `buildDraftKey` parar de
// distinguir usuários (regressão na própria chave, não só no conteúdo).
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const esbuild = require(path.join(root, 'node_modules', 'esbuild'));

function carregarModulosSrc() {
  const entrySource = "export * as edicaoPendente from './src/hooks/useEdicaoPendente.js';";

  const result = esbuild.buildSync({
    stdin: { contents: entrySource, resolveDir: root, loader: 'js' },
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    write: false
  });

  const code = result.outputFiles[0].text;
  const bundlePath = path.join(root, 'scripts', '__test-edicao-pendente-bundle.cjs');
  const mod = new Module(bundlePath, null);
  mod.filename = bundlePath;
  mod.paths = Module._nodeModulePaths(root);
  mod._compile(code, bundlePath);
  return mod.exports;
}

/**
 * Mock mínimo de localStorage. `throwAlways` simula modo privado (todo
 * acesso lança, inclusive a sonda de 1 caractere que getSafeStorage faz
 * antes de confiar no storage). `maxValueLength` simula cota estourada: a
 * sonda (1 caractere) passa, mas a gravação real do rascunho — bem maior —
 * lança no meio do uso normal, que é como cota estourada se comporta de
 * verdade (o acesso ao objeto não falha, a escrita falha).
 */
class MemoryStorage {
  constructor({ throwAlways = false, maxValueLength = Infinity } = {}) {
    this.store = new Map();
    this.throwAlways = throwAlways;
    this.maxValueLength = maxValueLength;
  }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) {
    const v = String(value);
    if (this.throwAlways || v.length > this.maxValueLength) {
      throw new Error('QuotaExceededError (simulado)');
    }
    this.store.set(key, v);
  }
  removeItem(key) { this.store.delete(key); }
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

(() => {
  const {
    edicaoPendente: { isDirty, buildDraftKey, salvarRascunho, lerRascunho, limparRascunho }
  } = carregarModulosSrc();

  // ── 1. isDirty: edição igual ao salvo não é pendência; alteração real é ─
  check('edição idêntica ao salvo não é suja', () => {
    assert.equal(isDirty({ pesoKg: '72.4', estaturaCm: '172' }, { pesoKg: '72.4', estaturaCm: '172' }), false);
  });

  check('espaço em branco a mais não conta como edição', () => {
    assert.equal(isDirty({ nome: '  Ana  ' }, { nome: 'Ana' }), false);
  });

  check('string vazia é ausência, igual a não informado', () => {
    assert.equal(isDirty({ sexo: '' }, {}), false);
  });

  check('reordenar chaves do mesmo objeto não é edição', () => {
    assert.equal(isDirty({ a: 1, b: 2 }, { b: 2, a: 1 }), false);
  });

  check('alteração real é suja', () => {
    assert.equal(isDirty({ pesoKg: '73' }, { pesoKg: '72.4' }), true);
  });

  check('zero é valor real e não se confunde com ausência (ausência é nulo, nunca zero)', () => {
    // Se isto virasse false, um card de "duração da sessão: 0" indistinto de
    // "sem registro" reapareceria aqui, na deteccao de pendencia.
    assert.equal(isDirty({ duracaoSessao: 0 }, { duracaoSessao: null }), true);
  });

  // ── 2. buildDraftKey isola por usuário e por registro ───────────────────
  check('chaves de usuários diferentes para a mesma tela/registro são diferentes', () => {
    const keyA = buildDraftKey('avaliacao-completa', 'usuarioA', 'paciente-1');
    const keyB = buildDraftKey('avaliacao-completa', 'usuarioB', 'paciente-1');
    assert.notEqual(keyA, keyB, 'a chave precisa distinguir usuários diferentes — se isto passar a ser igual, o teste tem que falhar');
  });

  check('chaves de registros diferentes para o mesmo usuário são diferentes', () => {
    const key1 = buildDraftKey('avaliacao-completa', 'usuarioA', 'paciente-1');
    const key2 = buildDraftKey('avaliacao-completa', 'usuarioA', 'paciente-2');
    assert.notEqual(key1, key2, 'a chave precisa distinguir registros diferentes');
  });

  check('falta usuário, registro ou tela: sem chave, sem persistência', () => {
    assert.equal(buildDraftKey('avaliacao-completa', '', 'paciente-1'), null);
    assert.equal(buildDraftKey('avaliacao-completa', 'usuarioA', ''), null);
    assert.equal(buildDraftKey('', 'usuarioA', 'paciente-1'), null);
  });

  // ── 3. Isolamento fim a fim: rascunho de A nunca chega em B ─────────────
  check('rascunho salvo pelo usuário A não é lido pela chave do usuário B', () => {
    global.window = { localStorage: new MemoryStorage() };
    try {
      const keyA = buildDraftKey('prescricao-plano', 'usuarioA', 'paciente-9');
      const keyB = buildDraftKey('prescricao-plano', 'usuarioB', 'paciente-9');

      const ok = salvarRascunho(keyA, { userId: 'usuarioA', recordId: 'paciente-9', dados: { plano: { kcalAlvo: 1800 } } });
      assert.equal(ok, true);

      // B nem tem onde procurar: a chave dele é outra (mesmo navegador, mesma
      // tela, mesmo paciente — só o usuário muda).
      assert.equal(lerRascunho(keyB, { userId: 'usuarioB', recordId: 'paciente-9' }), null);

      // Defesa em profundidade: mesmo apontando para a chave de A, o
      // conteúdo gravado (userId: 'usuarioA') barra uma leitura como se
      // fosse B — para o caso de uma versão antiga do formato ter usado
      // outro esquema de chave.
      assert.equal(lerRascunho(keyA, { userId: 'usuarioB', recordId: 'paciente-9' }), null);

      // A própria conta lê o que gravou.
      const lidoPorA = lerRascunho(keyA, { userId: 'usuarioA', recordId: 'paciente-9' });
      assert.deepEqual(lidoPorA.dados, { plano: { kcalAlvo: 1800 } });
    } finally {
      delete global.window;
    }
  });

  // ── 4. Salvar com sucesso limpa o rascunho ──────────────────────────────
  check('limparRascunho remove o que salvarRascunho gravou', () => {
    global.window = { localStorage: new MemoryStorage() };
    try {
      const key = buildDraftKey('prescricao-plano', 'usuarioA', 'paciente-9');
      salvarRascunho(key, { userId: 'usuarioA', recordId: 'paciente-9', dados: { plano: {} } });
      assert.notEqual(lerRascunho(key, { userId: 'usuarioA', recordId: 'paciente-9' }), null);

      limparRascunho(key);
      assert.equal(
        lerRascunho(key, { userId: 'usuarioA', recordId: 'paciente-9' }),
        null,
        'após salvar com sucesso, o rascunho local precisa sumir — senão reaparece oferecendo dado defasado'
      );
    } finally {
      delete global.window;
    }
  });

  // ── 5. Armazenamento indisponível não derruba a tela ─────────────────────
  check('sem window/localStorage, as funções degradam para no-op sem lançar', () => {
    delete global.window;
    const key = buildDraftKey('prescricao-plano', 'usuarioA', 'paciente-9');
    assert.equal(salvarRascunho(key, { userId: 'usuarioA', recordId: 'paciente-9', dados: {} }), false);
    assert.equal(lerRascunho(key, { userId: 'usuarioA', recordId: 'paciente-9' }), null);
    limparRascunho(key); // não deve lançar
  });

  check('modo privado (toda escrita lança, inclusive a sonda): não lança, retorna false', () => {
    global.window = { localStorage: new MemoryStorage({ throwAlways: true }) };
    try {
      const key = buildDraftKey('prescricao-plano', 'usuarioA', 'paciente-9');
      const ok = salvarRascunho(key, { userId: 'usuarioA', recordId: 'paciente-9', dados: { plano: {} } });
      assert.equal(ok, false);
    } finally {
      delete global.window;
    }
  });

  check('cota estourada (sonda passa, gravação real do rascunho lança): não lança, retorna false', () => {
    global.window = { localStorage: new MemoryStorage({ maxValueLength: 5 }) };
    try {
      const key = buildDraftKey('prescricao-plano', 'usuarioA', 'paciente-9');
      const ok = salvarRascunho(key, { userId: 'usuarioA', recordId: 'paciente-9', dados: { plano: { refeicoes: [1, 2, 3] } } });
      assert.equal(ok, false);
    } finally {
      delete global.window;
    }
  });

  check('registro corrompido no storage não derruba a leitura', () => {
    global.window = { localStorage: new MemoryStorage() };
    try {
      const key = buildDraftKey('prescricao-plano', 'usuarioA', 'paciente-9');
      global.window.localStorage.store.set(key, '{isso nao e json valido');
      assert.equal(lerRascunho(key, { userId: 'usuarioA', recordId: 'paciente-9' }), null);
    } finally {
      delete global.window;
    }
  });

  console.log(`\n${passed} verificações passaram (UPD-18 — proteção de edição não salva).`);
})();
