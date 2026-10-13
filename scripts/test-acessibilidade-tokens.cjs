// UPD-16 — Mobile e acessibilidade (UX-08).
//
// Mede o contraste real dos tokens de texto claro contra os fundos em que
// eles de fato aparecem, usando a fórmula de luminância relativa do WCAG
// 2.2 (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
//
// Os valores de cada token NÃO são copiados à mão aqui: o teste lê os
// arquivos CSS de tokens (na mesma ordem em que main.jsx os carrega) e
// extrai o valor efetivo declarado por último — a mesma regra de cascata
// que o navegador aplica a `:root`. Se alguém voltar a clarear um token de
// texto abaixo do mínimo, este teste falha sem precisar saber que a cor
// mudou.
//
// Cada par texto/fundo documenta de onde vem o uso real (arquivo:seletor)
// que motivou a medição — não é uma varredura exaustiva do CSS, é a
// verificação dos casos que a auditoria (docs/auditoria-2026-09-11/
// interface-usabilidade.md, achado UX-08) apontou nominalmente, mais os
// usos equivalentes descobertos nos arquivos desta entrega.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

/* ── WCAG 2.2 contrast math ─────────────────────────────────────────── */

function hexToRgb(hex) {
  const clean = hex.trim().replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  assert.match(full, /^[0-9a-fA-F]{6}$/, `cor hex inválida: "${hex}"`);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
}

function srgbChannelToLinear(c8bit) {
  const c = c8bit / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const R = srgbChannelToLinear(r);
  const G = srgbChannelToLinear(g);
  const B = srgbChannelToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(hexA, hexB) {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/* ── Extração do valor efetivo de um token CSS ──────────────────────── */

/**
 * Lê `--nome: valor;` de um arquivo CSS e devolve o ÚLTIMO valor declarado
 * nele (mesma regra do navegador para propriedades customizadas repetidas
 * na mesma especificidade). Ignora declarações dentro de var(--x, fallback)
 * — só captura a declaração do próprio token.
 */
function lastDeclaredValue(varName, filePath) {
  const css = fs.readFileSync(filePath, 'utf8');
  const re = new RegExp(`(?<!var\\()--${varName}\\s*:\\s*([^;]+);`, 'g');
  let match;
  let last = null;
  while ((match = re.exec(css)) !== null) {
    last = match[1].trim();
  }
  return last;
}

/**
 * Resolve o valor EFETIVO de um token `:root` considerando vários arquivos
 * na ordem real de carregamento (src/main.jsx importa styles/theme.css e
 * depois index.css). O arquivo carregado por último que declarar o token
 * vence — é assim que --color-text-muted, declarado em theme.css (fora da
 * fronteira deste item) e sobrescrito em index.css (dentro dela), resolve
 * no navegador.
 */
function declaredAcrossFiles(varName, filesInLoadOrder) {
  let value = null;
  let sourceFile = null;
  for (const file of filesInLoadOrder) {
    const found = lastDeclaredValue(varName, file);
    if (found !== null) {
      value = found;
      sourceFile = file;
    }
  }
  return { value, sourceFile };
}

const VAR_ALIAS_RE = /^var\(\s*--([\w-]+)\s*(?:,.*)?\)$/;

/**
 * Resolve um token até um hex literal, seguindo `var(--outro-token)` quando
 * o valor declarado é um alias em vez de uma cor (caso de
 * --color-text-secondary: var(--color-gray) em theme.css). Sempre procura
 * o alias nos MESMOS arquivos, na mesma ordem — um alias declarado em
 * theme.css aponta para outro token de theme.css, não de index.css.
 */
function resolveEffectiveToken(varName, filesInLoadOrder, depth = 0) {
  assert.ok(depth < 5, `cadeia de var() longa demais para --${varName} — possível ciclo`);
  const { value, sourceFile } = declaredAcrossFiles(varName, filesInLoadOrder);
  assert.ok(value, `token --${varName} não encontrado em nenhum dos arquivos: ${filesInLoadOrder.join(', ')}`);

  const alias = value.match(VAR_ALIAS_RE);
  if (alias) {
    const resolved = resolveEffectiveToken(alias[1], filesInLoadOrder, depth + 1);
    return { value: resolved.value, sourceFile: `${path.relative(root, sourceFile)} → --${alias[1]} (${path.relative(root, resolved.sourceFile)})` };
  }
  return { value, sourceFile: path.relative(root, sourceFile) };
}

/* ── Ordem real de carregamento (src/main.jsx) ──────────────────────── */
const THEME_CSS = path.join(root, 'src/styles/theme.css');
const INDEX_CSS = path.join(root, 'src/index.css');
const LOAD_ORDER = [THEME_CSS, INDEX_CSS]; // theme.css primeiro, index.css depois

/* ── Pares texto/fundo medidos ───────────────────────────────────────
   normal: WCAG AA exige 4,5:1. large: 18,66px+ (ou 14pt+ bold) exige 3:1.
   Nenhum dos usos abaixo é "texto grande" — todos ficam entre ~9px e
   ~17,6px, a maioria sem negrito. */
const PARES = [
  {
    nome: '--pn-text-4 sobre fundo branco/quase-branco',
    token: '--pn-text-4',
    arquivos: [INDEX_CSS],
    fundo: '#ffffff',
    fundoDescricao: '--color-white / --ap-surface / --prof-surface / --tp-surface (cartões claros)',
    usoReal: [
      'src/views/Student/Patients/PatientProntuario.css — .vital-card__empty, .gc-bar-label, .evolucao-item__content time, .pron-kpi-card__unit, .prof-msg-item__meta',
      'src/components/RefeicaoBuilder.css — rótulos de unidade e separador de macro',
      'src/components/SuplementoCard.css:126',
      'src/views/Athlete/AthletePortal.css — .athlete-empty, .ap-dossie__subtitle, .ap-domain-panel__empty, .ap-domain-panel__date',
      'src/views/professor/ProfessorView.css — .search-box (ícone) e .search-box input::placeholder'
    ],
    categoria: 'normal',
    minimo: 4.5
  },
  {
    nome: '--pn-text-4 sobre --pp-fundo (tela de prescrição)',
    token: '--pn-text-4',
    arquivos: [INDEX_CSS],
    fundo: '#f5f7fa',
    fundoDescricao: '--pp-fundo em src/views/planos/PrescricaoPlano.css (fundo da tela de prescrição)',
    usoReal: [
      'src/components/RefeicaoBuilder.css:722,773,785 — regras com "background: none", que herdam o fundo da tela em vez de ficarem sobre um cartão branco'
    ],
    categoria: 'normal',
    minimo: 4.5
  },
  {
    nome: '--pn-text-3 sobre fundo branco/quase-branco',
    token: '--pn-text-3',
    arquivos: [INDEX_CSS],
    fundo: '#ffffff',
    fundoDescricao: '--color-white (padrão de cartão)',
    usoReal: [
      'src/views/Student/Patients/PatientProntuario.css — --color-text-secondary: var(--pn-text-3) dentro de .pron-root, bridge para componentes que ainda usam --color-* (envolve toda a tela de prontuário)'
    ],
    categoria: 'normal',
    minimo: 4.5
  },
  {
    nome: '--pn-text-3 sobre --pn-surface-3 (cartão mais escuro do prontuário)',
    token: '--pn-text-3',
    arquivos: [INDEX_CSS],
    fundo: '#f1f5f9',
    fundoDescricao: '--pn-surface-3 — o fundo catalogado mais escuro entre os que --pn-text-3/--pn-text-4 tocam',
    usoReal: [
      'src/views/Student/Patients/PatientProntuario.css — cartões e listas internas sobre --pn-surface-3, com texto secundário via --color-text-secondary: var(--pn-text-3)'
    ],
    categoria: 'normal',
    minimo: 4.5
  },
  {
    nome: '--color-text-muted (efetivo) sobre fundo branco',
    token: 'color-text-muted',
    arquivos: LOAD_ORDER,
    fundo: '#ffffff',
    fundoDescricao: '--color-white / --color-surface (padrão de cartão em quase toda a aplicação)',
    usoReal: [
      'src/components/ui/ui.css — .ui-section-header p, .ui-stat-label, .ui-stat-meta, .ui-feedback-state__description',
      'src/views/admin/Registration/PatientModal.css, UserModal.css — descrições de campo',
      'dezenas de outras telas listadas por "grep --color-text-muted"; o token é global (theme.css)'
    ],
    categoria: 'normal',
    minimo: 4.5
  },
  {
    nome: '--color-text-muted (efetivo) sobre --ap-surface-2 (cartão do portal do atleta)',
    token: 'color-text-muted',
    arquivos: LOAD_ORDER,
    fundo: '#f3f8fb',
    fundoDescricao: '--ap-surface-2 em src/views/Athlete/AthletePortal.css',
    usoReal: ['src/views/Athlete/AthletePortal.css:997 — .ap-card__header'],
    categoria: 'normal',
    minimo: 4.5
  },
  {
    nome: '--color-text-secondary sobre fundo branco (guarda de regressão)',
    token: '--color-text-secondary',
    arquivos: [THEME_CSS],
    fundo: '#ffffff',
    fundoDescricao: '--color-white (padrão de cartão)',
    usoReal: [
      'src/styles/theme.css — label, .form-label, .eval-label, thead th, .laines-page-subtitle',
      'Token vizinho a --color-text-muted; já cumpria 4,5:1 antes desta entrega — guardado aqui para não regredir junto.'
    ],
    categoria: 'normal',
    minimo: 4.5
  }
];

/* ── Redeclarações locais de --pn-text-* e --color-text-muted fora de :root
   ─────────────────────────────────────────────────────────────────────── */
/*
   UX-08 (revisão independente): --pn-text-3/--pn-text-4 eram redeclarados
   dentro de `.pron-root` (PatientProntuario.css) com um valor mais claro
   que o token global corrigido em index.css. Variável CSS resolve por
   ESCOPO — o valor declarado mais próximo do elemento na árvore vence,
   independente de especificidade — então essa redeclaração local anulava
   silenciosamente a correção para toda a tela de prontuário, e os PARES
   acima nunca detectavam isso: eles só resolvem o valor via LOAD_ORDER
   (:root de theme.css/index.css), nunca inspecionam seletores de escopo.
   Este bloco varre todo arquivo .css dentro de src/ (recursivo) por declarações LITERAIS (hex) de
   --pn-text-1..4 e --color-text-muted em qualquer seletor que não seja
   `:root`, e mede o contraste de cada uma contra o fundo real daquele
   escopo. Declarações via var(--outro-token) (ex.: App.css e o bridge em
   PatientProntuario.css que aponta --color-text-secondary para
   --pn-text-3) são ignoradas de propósito: elas herdam a cadeia normal e
   já são cobertas pelos PARES acima — não introduzem um valor novo. */

// Só os tokens citados nominalmente pela auditoria (achado UX-08): os
// demais --color-text-* (inverse, light, tertiary) são usados como texto
// claro SOBRE fundo escuro por design — testá-los contra um fundo claro
// seria um falso positivo, não uma redeclaração perigosa.
const SCOPED_TOKEN_RE = /--(pn-text-[1-4]|color-text-muted)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g;
const SCOPED_TOKEN_MIN = 4.5;

// Fundo real de cada seletor de escopo conhecido, para medir a redeclaração
// no lugar em que ela de fato aparece na tela.
const SCOPE_BACKGROUNDS = {
  '.pron-root': {
    hex: '#f4f7fb',
    desc: 'background declarado no próprio seletor .pron-root (PatientProntuario.css) — envolve toda a tela de prontuário'
  }
};
// Escopo ainda não catalogado: verifica pelo menos contra branco, o fundo
// mais indulgente para texto escuro — não deixa a redeclaração passar sem
// nenhuma checagem só por não estarmos com o fundo real documentado.
const DEFAULT_SCOPE_BG = { hex: '#ffffff', desc: 'fundo não catalogado para este seletor — verificação conservadora contra branco' };

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Extrai blocos { selector, body } de nível 0 (não desce em @media,
 * @keyframes etc. — this é uma rede de segurança para seletores de classe
 * simples como `.pron-root`, não um parser CSS completo) de um CSS já sem
 * comentários.
 */
function extractTopLevelRules(css) {
  const rules = [];
  let depth = 0;
  let cursor = 0;
  let current = null;
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) {
        current = { selector: css.slice(cursor, i).trim(), start: i + 1 };
      }
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && current) {
        current.body = css.slice(current.start, i);
        rules.push(current);
        current = null;
        cursor = i + 1;
      }
    }
  }
  return rules;
}

function listCssFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listCssFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.css')) {
      out.push(full);
    }
  }
  return out;
}

function findScopedTokenRedeclarations() {
  const cssFiles = listCssFiles(path.join(root, 'src'));
  const findings = [];
  for (const file of cssFiles) {
    const raw = fs.readFileSync(file, 'utf8');
    const css = stripCssComments(raw);
    const rules = extractTopLevelRules(css);
    for (const rule of rules) {
      if (rule.selector === ':root' || rule.selector.startsWith('@')) continue;
      SCOPED_TOKEN_RE.lastIndex = 0;
      let match;
      while ((match = SCOPED_TOKEN_RE.exec(rule.body)) !== null) {
        findings.push({
          file: path.relative(root, file),
          selector: rule.selector,
          token: `--${match[1]}`,
          value: match[2]
        });
      }
    }
  }
  return findings;
}

/* ── Ordem monotônica da escala --pn-text-1..4 ───────────────────────
   A escala vai do nível mais forte (1) ao mais fraco (4). O contraste
   precisa ser não crescente ao longo da escala — senão o nível "fraco"
   lê mais escuro que o "intermediário" e a hierarquia visual se inverte
   (era exatamente o caso de --pn-text-3 vs --pn-text-4 antes desta
   correção). Medido sobre branco, o fundo em que os tokens são
   declarados (:root). */
const PN_TEXT_SCALE = ['pn-text-1', 'pn-text-2', 'pn-text-3', 'pn-text-4'];

(async () => {
  for (const par of PARES) {
    check(par.nome, () => {
      const tokenName = par.token.replace(/^--/, '');
      const resolved = resolveEffectiveToken(tokenName, par.arquivos);

      // resolveEffectiveToken já segue var(--alias)) até um valor literal e
      // falha com asserção própria se não encontrar o token em nenhum dos
      // arquivos — chegar aqui com um não-hex é sinal de um terceiro caso
      // não previsto (ex.: rgb()/hsl()) que este teste ainda não decodifica.
      assert.match(resolved.value, /^#[0-9a-fA-F]{3,6}$/, `${par.token} não resolveu para um hex literal: "${resolved.value}" (em ${resolved.sourceFile})`);

      const ratio = contrastRatio(resolved.value, par.fundo);
      const ratioFmt = ratio.toFixed(2);
      console.log(`     ${par.token} = ${resolved.value} (de ${resolved.sourceFile}) sobre ${par.fundo} (${par.fundoDescricao}) → ${ratioFmt}:1`);
      for (const uso of par.usoReal) console.log(`       usado em: ${uso}`);

      assert.ok(
        ratio >= par.minimo,
        `${par.token} = ${resolved.value} sobre ${par.fundo} mede ${ratioFmt}:1, abaixo do mínimo WCAG AA de ${par.minimo}:1 para texto ${par.categoria}. `
        + `Usos reais: ${par.usoReal.join(' · ')}`
      );
    });
  }

  check('nenhuma redeclaração local de --pn-text-*/--color-text-muted fica abaixo de AA no fundo do escopo', () => {
    const findings = findScopedTokenRedeclarations();
    if (findings.length === 0) {
      console.log('     nenhuma redeclaração local encontrada fora de :root em src/**/*.css.');
      return;
    }
    for (const f of findings) {
      const scopeBg = SCOPE_BACKGROUNDS[f.selector] || DEFAULT_SCOPE_BG;
      const ratio = contrastRatio(f.value, scopeBg.hex);
      const ratioFmt = ratio.toFixed(2);
      console.log(`     ${f.token} = ${f.value} redeclarado em "${f.selector}" (${f.file}) sobre ${scopeBg.hex} (${scopeBg.desc}) → ${ratioFmt}:1`);
      assert.ok(
        ratio >= SCOPED_TOKEN_MIN,
        `${f.token} redeclarado em "${f.selector}" (${f.file}) = ${f.value} mede ${ratioFmt}:1 sobre ${scopeBg.hex} (${scopeBg.desc}), `
        + `abaixo do mínimo WCAG AA de ${SCOPED_TOKEN_MIN}:1. Uma redeclaração de escopo anula o token global corrigido para todo `
        + `elemento dentro desse seletor, sem que os pares acima (que só leem :root) percebam.`
      );
    }
  });

  check('ordem monotônica da escala --pn-text-1..4 (contraste não pode subir do nível mais forte para o mais fraco)', () => {
    const medidos = PN_TEXT_SCALE.map((name) => {
      const resolved = resolveEffectiveToken(name, LOAD_ORDER);
      const ratio = contrastRatio(resolved.value, '#ffffff');
      console.log(`     --${name} = ${resolved.value} (de ${resolved.sourceFile}) sobre #ffffff → ${ratio.toFixed(2)}:1`);
      return { name, ratio };
    });
    for (let i = 1; i < medidos.length; i += 1) {
      const anterior = medidos[i - 1];
      const atual = medidos[i];
      assert.ok(
        anterior.ratio >= atual.ratio - 1e-9,
        `hierarquia de ênfase invertida: --${anterior.name} (${anterior.ratio.toFixed(2)}:1) precisa ter contraste >= --${atual.name} `
        + `(${atual.ratio.toFixed(2)}:1) — o nível mais fraco da escala não pode ficar mais contrastado que um nível intermediário.`
      );
    }
  });

  const totalChecks = PARES.length + 2;
  console.log(`\n${passed}/${totalChecks} verificações de acessibilidade de tokens dentro do esperado.`);
})().catch((err) => {
  console.error('FAIL', err.message);
  process.exitCode = 1;
});
