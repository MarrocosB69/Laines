/* Isolamento do CSS da landing.
 *
 * A landing carrega sob demanda (React.lazy). Uma tela de fora que use uma
 * classe definida SO pela landing fica com visual dependente do caminho de
 * navegacao: sem estilo para quem abre a tela direto, com o estilo da landing
 * vazando para quem passou pelo login antes. Foi o que aconteceu com os modais
 * de gestao de usuarios: `.request-modal` fixava 880px e o cartao de credencial,
 * desenhado com 420px, abria esticado no caminho normal (login -> admin).
 *
 * Node puro, sem banco, rede ou .env. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`PASS ${name}`); };

const escape = (value) => value.replace(/[-]/g, '\\-');
const walk = (dir, accept, skip, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skip(full) && entry.name !== 'node_modules') walk(full, accept, skip, out);
    } else if (accept(full)) {
      out.push(full);
    }
  }
  return out;
};

/**
 * Devolve os usos, fora da landing, de classes que so a landing define.
 * Classes que tambem aparecem em CSS de fora sao vocabulario compartilhado
 * (ex.: app-modal-*) e nao contam.
 */
function usosForaDaLanding(srcDir) {
  const landingDir = path.join(srcDir, 'views', 'landing');
  const dentroDaLanding = (p) => p.startsWith(landingDir);

  const definidas = new Set();
  for (const file of fs.readdirSync(landingDir).filter((f) => f.endsWith('.css') && f !== 'landing-tokens.css')) {
    // Sem comentarios e sem url(...): o ".webp" de url('../../assets/x.webp')
    // era lido como a classe "webp" (falso positivo).
    const css = fs.readFileSync(path.join(landingDir, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/url\([^)]*\)/g, 'url()');
    for (const match of css.matchAll(/\.([a-zA-Z][\w-]*)/g)) definidas.add(match[1]);
  }

  const cssDeFora = walk(srcDir, (p) => p.endsWith('.css'), dentroDaLanding)
    .map((p) => fs.readFileSync(p, 'utf8'));
  const exclusivas = [...definidas].filter((classe) => {
    const re = new RegExp(`\\.${escape(classe)}(?![\\w-])`);
    return !cssDeFora.some((css) => re.test(css));
  });

  const usos = [];
  const fontes = walk(srcDir, (p) => /\.(jsx?|tsx?)$/.test(p), dentroDaLanding)
    .filter((p) => path.basename(p) !== 'LoginPage.jsx');
  for (const file of fontes) {
    const source = fs.readFileSync(file, 'utf8');
    for (const classe of exclusivas) {
      if (new RegExp(`["'\` ]${escape(classe)}(?![\\w-])`).test(source)) {
        usos.push(`${path.relative(srcDir, file)} -> ${classe}`);
      }
    }
  }
  return { definidas: definidas.size, exclusivas: exclusivas.length, usos };
}

check('nenhuma tela fora da landing usa classe que so a landing define', () => {
  const resultado = usosForaDaLanding(path.join(root, 'src'));
  assert.ok(resultado.exclusivas > 0, 'a varredura precisa encontrar as classes da landing');
  assert.deepEqual(resultado.usos, [], `classes da landing usadas fora dela:\n  ${resultado.usos.join('\n  ')}`);
});

check('a varredura detecta a violacao (caso sintetico que reproduz o defeito do admin)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'landing-isolamento-'));
  try {
    fs.mkdirSync(path.join(tmp, 'views', 'landing'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'views', 'admin'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'views', 'landing', 'landing-modais.css'), '.request-modal { width: 880px; }\n');
    fs.writeFileSync(path.join(tmp, 'views', 'shared.css'), '.app-modal-shell { width: 980px; }\n');
    fs.writeFileSync(
      path.join(tmp, 'views', 'admin', 'UserManagement.jsx'),
      'export default () => <div className="request-modal app-modal-shell admin-cred-card" />;\n'
    );
    const resultado = usosForaDaLanding(tmp);
    assert.deepEqual(resultado.usos, [path.join('views', 'admin', 'UserManagement.jsx') + ' -> request-modal']);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

console.log(`\n${passed} verificações de isolamento do CSS da landing passaram.`);
