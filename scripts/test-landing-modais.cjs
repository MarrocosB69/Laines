// UX-08 / redesenho da landing — modais de solicitação de acesso e de
// recuperação de senha (docs/design/landing-guia-visual.md).
//
// Não repete o que scripts/test-landing-tokens.cjs já garante (contraste dos
// tokens --lt-*, que os dois modais só consomem, não declaram). Este script
// prova três coisas que são específicas do trabalho feito nestes dois
// arquivos e que nenhum outro teste do projeto cobre:
//
//   1. Nenhuma regra em landing-modais.css estiliza um elemento identificado
//      só por classes .app-modal-* (compartilhadas com o resto do sistema
//      via src/styles/modalSystem.css) — toda regra que toca essas classes
//      precisa de uma classe própria da landing (.request-*/.recovery-*) no
//      mesmo seletor, senão o estilo vazaria para outros modais do app.
//   2. As quatro etapas do indicador visual da recuperação de senha
//      (PasswordRecoveryModal.jsx) batem exatamente com as quatro etapas
//      que o componente realmente usa (step === '...'), na mesma ordem —
//      o indicador não pode inventar uma etapa que o fluxo não tem, nem
//      esquecer uma que tem.
//   3. Duas regressões pontuais que a auditoria já tinha achado: o aviso de
//      privacidade não volta ao tom de baixo contraste (#7a96ae, 3,09:1) e o
//      foco dos campos do formulário longo não volta ao brilho verde
//      translúcido (substituído por --lt-focus-ring).
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const CSS_PATH = path.join(root, 'src/views/landing/landing-modais.css');
const RECOVERY_JSX_PATH = path.join(root, 'src/views/landing/PasswordRecoveryModal.jsx');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

const css = fs.readFileSync(CSS_PATH, 'utf8');
const recoveryJsx = fs.readFileSync(RECOVERY_JSX_PATH, 'utf8');

/* ── 1. Nenhuma regra estiliza um elemento só por classes app-modal-* ──── */
check('landing-modais.css não redefine nenhuma classe app-modal-* sozinha (sempre com classe própria da landing junto)', () => {
  // Remove comentários antes de varrer seletores, senão exemplos de código
  // citados em comentário (há vários, de propósito, explicando a regra)
  // seriam lidos como regras reais.
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const ruleRe = /([^{}]+)\{[^}]*\}/g;
  const offenders = [];
  let match;
  while ((match = ruleRe.exec(withoutComments)) !== null) {
    const selectorList = match[1];
    // Ignora at-rules (@media, @keyframes) capturadas como "selector" pelo
    // regex simplificado acima — não têm classe nenhuma, então o loop
    // abaixo não encontra nada e não achata falso positivo.
    const selectors = selectorList.split(',').map((s) => s.trim()).filter(Boolean);
    for (const selector of selectors) {
      const classes = selector.match(/\.[\w-]+/g) || [];
      if (classes.length === 0) continue;
      const hasAppModalClass = classes.some((c) => c.startsWith('.app-modal-'));
      if (!hasAppModalClass) continue;
      const hasLandingScopeClass = classes.some((c) => c.startsWith('.request-') || c.startsWith('.recovery-'));
      if (!hasLandingScopeClass) {
        offenders.push(selector);
      }
    }
  }
  assert.deepStrictEqual(
    offenders, [],
    `seletor(es) estilizando app-modal-* sem uma classe própria da landing junto (vazaria para outros modais do sistema): ${JSON.stringify(offenders)}`
  );
});

/* ── 2. As 4 etapas do indicador batem com as etapas reais do componente ── */
check('RECOVERY_STEPS do indicador visual bate, na mesma ordem, com os step === "..." usados no componente', () => {
  const stepsArrayMatch = recoveryJsx.match(/const RECOVERY_STEPS = \[([\s\S]*?)\];/);
  assert.ok(stepsArrayMatch, 'RECOVERY_STEPS não encontrado em PasswordRecoveryModal.jsx');
  const declaredKeys = [...stepsArrayMatch[1].matchAll(/key:\s*'([^']+)'/g)].map((m) => m[1]);

  // Etapas realmente renderizadas pelo componente: toda ocorrência de
  // `step === 'xxx' &&` (o padrão de renderização condicional em JSX) fora
  // da declaração de RECOVERY_STEPS, na ordem em que aparecem no arquivo —
  // que é a ordem em que o JSX as decide/renderiza. Usa só o padrão com
  // "&&" (não o "step === 'done' ? ... : ..." do título do cabeçalho, que
  // legitimamente checa "done" cedo só para trocar um texto, sem que isso
  // signifique que "done" é a primeira etapa do fluxo).
  const bodyAfterArray = recoveryJsx.slice(stepsArrayMatch.index + stepsArrayMatch[0].length);
  const usedSteps = [...bodyAfterArray.matchAll(/step === '([^']+)' &&/g)].map((m) => m[1]);
  const usedStepsUnique = [...new Set(usedSteps)];

  console.log(`     RECOVERY_STEPS: ${JSON.stringify(declaredKeys)}`);
  console.log(`     step === '...' usados no componente (ordem de 1ª ocorrência): ${JSON.stringify(usedStepsUnique)}`);

  assert.deepStrictEqual(
    declaredKeys, usedStepsUnique,
    'o indicador visual (RECOVERY_STEPS) precisa listar exatamente as etapas que o componente usa, na mesma ordem — nem mais, nem menos, nem fora de ordem'
  );
  assert.strictEqual(declaredKeys.length, 4, 'a recuperação de senha tem quatro etapas — identificar, enviado, redefinir, concluído');
});

/* ── 3. Duas regressões pontuais achadas pela auditoria ──────────────────── */
check('o aviso de privacidade (.request-privacy-notice) não volta ao tom de baixo contraste #7a96ae (3,09:1)', () => {
  const ruleMatch = css.match(/\.request-privacy-notice\s*\{[^}]*\}/);
  assert.ok(ruleMatch, '.request-privacy-notice não encontrado em landing-modais.css');
  assert.ok(!/#7a96ae/i.test(ruleMatch[0]), '.request-privacy-notice voltou a usar #7a96ae — esse tom mede 3,09:1 sobre branco, abaixo do mínimo AA (ver guia visual)');
  assert.ok(/var\(--lt-color-text-subtle\)/.test(ruleMatch[0]), '.request-privacy-notice precisa usar var(--lt-color-text-subtle), o tom corrigido (5,02:1)');
});

check('o foco dos campos do formulário longo usa --lt-focus-ring, não o brilho verde translúcido anterior', () => {
  const ruleMatch = css.match(/\.request-field input(?::not\(\[type=\"(?:checkbox|radio)\"\]\))*:focus,\s*\.request-field select:focus,\s*\.request-field textarea:focus\s*\{[^}]*\}/);
  assert.ok(ruleMatch, 'regra de :focus de .request-field input/select/textarea não encontrada em landing-modais.css');
  assert.ok(/var\(--lt-focus-ring\)/.test(ruleMatch[0]), 'o foco precisa usar var(--lt-focus-ring) (halo + anel sólido), não um box-shadow rgba solto');
  assert.ok(!/rgba\(61,\s*140,\s*42/.test(ruleMatch[0]), 'o foco voltou a usar o brilho verde translúcido (rgba(61,140,42,...)) que o guia visual rejeitou por não cruzar 3:1 contra o botão primário');
});

console.log(`\n${passed}/4 verificações dos modais da landing dentro do esperado.`);
