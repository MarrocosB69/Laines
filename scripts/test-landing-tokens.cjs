// UX-08 / redesenho da landing e login — guia visual.
//
// Mede o contraste real dos pares texto/fundo definidos em
// docs/design/landing-guia-visual.md, usando a fórmula de luminância
// relativa do WCAG 2.2 (https://www.w3.org/WAI/WCAG22/Understanding/
// contrast-minimum.html) — a mesma fórmula de
// scripts/test-acessibilidade-tokens.cjs. Não foi importada de lá porque
// aquele arquivo não exporta módulo (é autocontido, como todo script de
// teste deste projeto); as funções abaixo são a mesma matemática, não uma
// reescrita alternativa.
//
// Os valores de cada token NÃO são copiados à mão: o teste lê
// src/views/landing/landing-tokens.css e extrai o valor declarado em
// `:root`, igual à leitura que o navegador faz. Se um valor mudar no
// arquivo de tokens sem que o par correspondente seja revisado, o teste
// falha sozinho.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const TOKENS_CSS = path.join(root, 'src/views/landing/landing-tokens.css');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

/* ── WCAG 2.2 contrast math (mesma fórmula de test-acessibilidade-tokens.cjs) ── */

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

/* ── Extração do valor efetivo de um token CSS em :root ─────────────────
   Só landing-tokens.css declara `--lt-*`, e só em `:root` — um único
   arquivo, um único escopo, ao contrário do tema global (que resolve por
   cascata entre theme.css/index.css). Segue var(--outro-token) um nível,
   caso algum token passe a ser um alias em vez de um hex literal. */
function lastDeclaredValue(varName, css) {
  const re = new RegExp(`(?<!var\\()--${varName}\\s*:\\s*([^;]+);`, 'g');
  let match;
  let last = null;
  while ((match = re.exec(css)) !== null) {
    last = match[1].trim();
  }
  return last;
}

const VAR_ALIAS_RE = /^var\(\s*--([\w-]+)\s*(?:,.*)?\)$/;

function resolveToken(varName, css, depth = 0) {
  assert.ok(depth < 5, `cadeia de var() longa demais para --${varName} — possível ciclo`);
  const value = lastDeclaredValue(varName, css);
  assert.ok(value, `token --${varName} não encontrado em landing-tokens.css`);
  const alias = value.match(VAR_ALIAS_RE);
  if (alias) return resolveToken(alias[1], css, depth + 1);
  assert.match(value, /^#[0-9a-fA-F]{3,6}$/, `--${varName} não resolveu para um hex literal: "${value}"`);
  return value;
}

const css = fs.readFileSync(TOKENS_CSS, 'utf8');
const token = (name) => resolveToken(`lt-${name}`, css);

/* ── Pares texto/fundo documentados em docs/design/landing-guia-visual.md
   ─────────────────────────────────────────────────────────────────────
   Todos tratados como texto normal (piso 4,5:1) — nenhum par depende da
   folga de "texto grande" (3:1), mesmo nos usos que se qualificariam
   (H1/H2), como o guia explica. */
const PARES = [
  {
    nome: '--lt-color-text sobre --lt-color-surface (corpo/título sobre painel branco)',
    fg: 'color-text', bg: 'color-surface',
    uso: 'Título H1, corpo de texto, rótulos de campo'
  },
  {
    nome: '--lt-color-text sobre --lt-color-surface-field (texto digitado no campo)',
    fg: 'color-text', bg: 'color-surface-field',
    uso: 'Valor digitado em input'
  },
  {
    nome: '--lt-color-text sobre --lt-color-bg-app (texto direto sobre o fundo da página)',
    fg: 'color-text', bg: 'color-bg-app',
    uso: 'Qualquer texto fora de cartão, direto sobre o fundo da landing'
  },
  {
    nome: '--lt-color-text-muted sobre --lt-color-surface',
    fg: 'color-text-muted', bg: 'color-surface',
    uso: 'Subtítulo do hero, texto secundário de cartão'
  },
  {
    nome: '--lt-color-text-muted sobre --lt-color-surface-field',
    fg: 'color-text-muted', bg: 'color-surface-field',
    uso: 'Texto de apoio dentro de campo/área com fundo field'
  },
  {
    nome: '--lt-color-text-muted sobre --lt-color-bg-app',
    fg: 'color-text-muted', bg: 'color-bg-app',
    uso: 'Texto secundário direto sobre o fundo da página'
  },
  {
    nome: '--lt-color-text-subtle sobre --lt-color-surface',
    fg: 'color-text-subtle', bg: 'color-surface',
    uso: 'Metadado terciário sobre cartão — legenda, timestamp'
  },
  {
    nome: '--lt-color-text-subtle sobre --lt-color-surface-field',
    fg: 'color-text-subtle', bg: 'color-surface-field',
    uso: 'Metadado terciário sobre fundo de campo — pior caso catalogado'
  },
  {
    nome: '--lt-color-text-subtle sobre --lt-color-bg-app',
    fg: 'color-text-subtle', bg: 'color-bg-app',
    uso: 'Metadado terciário direto sobre o fundo da página (rodapé)'
  },
  {
    nome: '--lt-color-brand-green-text sobre --lt-color-surface',
    fg: 'color-brand-green-text', bg: 'color-surface',
    uso: 'Eyebrow/rótulo de marca em verde sobre cartão branco'
  },
  {
    nome: '--lt-color-brand-green-text sobre --lt-color-surface-field',
    fg: 'color-brand-green-text', bg: 'color-surface-field',
    uso: 'Texto de marca em verde sobre fundo de campo'
  },
  {
    nome: '--lt-color-brand-blue sobre --lt-color-surface',
    fg: 'color-brand-blue', bg: 'color-surface',
    uso: 'Link, ação secundária, "Esqueci minha senha" sobre cartão branco'
  },
  {
    nome: '--lt-color-brand-blue sobre --lt-color-surface-field',
    fg: 'color-brand-blue', bg: 'color-surface-field',
    uso: 'Ícone/link sobre fundo de campo'
  },
  {
    nome: '--lt-color-text-inverse sobre --lt-color-brand-green-text (rótulo do botão primário)',
    fg: 'color-text-inverse', bg: 'color-brand-green-text',
    uso: 'Rótulo branco sobre o verde sólido de texto (botão primário dos modais)'
  },
  {
    nome: '--lt-color-danger-text sobre --lt-color-danger-bg',
    fg: 'color-danger-text', bg: 'color-danger-bg',
    uso: 'Mensagem de erro do formulário'
  },
  {
    nome: '--lt-color-success-text sobre --lt-color-success-bg',
    fg: 'color-success-text', bg: 'color-success-bg',
    uso: 'Mensagem de sucesso (ex.: senha redefinida)'
  },
  /* ── Cena da primeira tela (direção "Energia e velocidade") ───────────
     A cena é um degradê: do azul-estádio em cima ao azul da pista perto
     da câmera. Os dois extremos são medidos — o texto branco e a névoa
     precisam valer sobre qualquer ponto entre eles. A medição por pixel
     sobre o fundo real renderizado fica com a captura em navegador. */
  {
    nome: '--lt-color-text-inverse sobre --lt-color-stadium (título e nomes das áreas sobre a cena)',
    fg: 'color-text-inverse', bg: 'color-stadium',
    uso: 'Nome da liga, marca LAINES, nomes das quatro áreas'
  },
  {
    nome: '--lt-color-text-inverse sobre --lt-color-brand-blue (título no ponto mais claro da cena)',
    fg: 'color-text-inverse', bg: 'color-brand-blue',
    uso: 'Título quando a cena clareia para o azul da pista'
  },
  {
    nome: '--lt-color-mist sobre --lt-color-stadium (frase e descrições sobre a cena)',
    fg: 'color-mist', bg: 'color-stadium',
    uso: 'Frase sobre a liga, descrição das áreas, "FACISA, UFRN"'
  },
  {
    nome: '--lt-color-mist sobre --lt-color-brand-blue (pior caso: frase no ponto mais claro da cena)',
    fg: 'color-mist', bg: 'color-brand-blue',
    uso: 'Frase sobre a liga se encostar no azul claro do chão'
  },
  {
    nome: '--lt-color-text-inverse sobre --lt-color-start-top (botão Entrar, topo do degradê)',
    fg: 'color-text-inverse', bg: 'color-start-top',
    uso: '"Entrar" — ponto mais claro do degradê do único sólido'
  },
  {
    nome: '--lt-color-text-inverse sobre --lt-color-start-bottom (botão Entrar, base do degradê)',
    fg: 'color-text-inverse', bg: 'color-start-bottom',
    uso: '"Entrar" — ponto mais escuro do degradê do único sólido'
  },
  {
    nome: '--lt-color-brand-blue sobre --lt-color-track-tint (ação da porta secundária no hover)',
    fg: 'color-brand-blue', bg: 'color-track-tint',
    uso: '"Entrar na lista de espera", "Solicitar acesso" com o fundo aceso'
  },
  {
    nome: '--lt-color-text-muted sobre --lt-color-track-tint (pergunta da porta secundária no hover)',
    fg: 'color-text-muted', bg: 'color-track-tint',
    uso: '"É atleta e quer ser atendido pela liga?" com o fundo aceso'
  }
];

/* Componentes (não-texto, WCAG 1.4.11, piso 3:1). */
const PARES_NAO_TEXTO = [
  {
    nome: '--lt-color-border-field sobre --lt-color-surface (limite do campo do painel)',
    fg: 'color-border-field', bg: 'color-surface',
    uso: 'Borda do campo de CPF/e-mail e de senha em repouso'
  }
];

const MINIMO_TEXTO_NORMAL = 4.5;
const MINIMO_NAO_TEXTO = 3.0;

(async () => {
  for (const par of PARES) {
    check(par.nome, () => {
      const fgHex = token(par.fg);
      const bgHex = token(par.bg);
      const ratio = contrastRatio(fgHex, bgHex);
      const ratioFmt = ratio.toFixed(2);
      console.log(`     --lt-${par.fg} = ${fgHex} sobre --lt-${par.bg} = ${bgHex} → ${ratioFmt}:1 (uso: ${par.uso})`);
      assert.ok(
        ratio >= MINIMO_TEXTO_NORMAL,
        `--lt-${par.fg} (${fgHex}) sobre --lt-${par.bg} (${bgHex}) mede ${ratioFmt}:1, abaixo do mínimo WCAG AA de `
        + `${MINIMO_TEXTO_NORMAL}:1 para texto normal. Uso real: ${par.uso}.`
      );
    });
  }

  for (const par of PARES_NAO_TEXTO) {
    check(par.nome, () => {
      const fgHex = token(par.fg);
      const bgHex = token(par.bg);
      const ratio = contrastRatio(fgHex, bgHex);
      console.log(`     --lt-${par.fg} = ${fgHex} sobre --lt-${par.bg} = ${bgHex} → ${ratio.toFixed(2)}:1 (uso: ${par.uso})`);
      assert.ok(
        ratio >= MINIMO_NAO_TEXTO,
        `--lt-${par.fg} (${fgHex}) sobre --lt-${par.bg} (${bgHex}) mede ${ratio.toFixed(2)}:1, abaixo do mínimo de `
        + `${MINIMO_NAO_TEXTO}:1 para componente não-textual. Uso real: ${par.uso}.`
      );
    });
  }

  check('hierarquia de texto não se inverte (text >= muted >= subtle, todos >= 4,5:1 sobre branco)', () => {
    const white = token('color-surface');
    const textRatio = contrastRatio(token('color-text'), white);
    const mutedRatio = contrastRatio(token('color-text-muted'), white);
    const subtleRatio = contrastRatio(token('color-text-subtle'), white);
    console.log(`     text=${textRatio.toFixed(2)}:1  muted=${mutedRatio.toFixed(2)}:1  subtle=${subtleRatio.toFixed(2)}:1`);
    assert.ok(textRatio >= mutedRatio, `--lt-color-text (${textRatio.toFixed(2)}:1) precisa ler mais forte que --lt-color-text-muted (${mutedRatio.toFixed(2)}:1)`);
    assert.ok(mutedRatio >= subtleRatio, `--lt-color-text-muted (${mutedRatio.toFixed(2)}:1) precisa ler mais forte que --lt-color-text-subtle (${subtleRatio.toFixed(2)}:1)`);
    assert.ok(subtleRatio >= MINIMO_TEXTO_NORMAL, `--lt-color-text-subtle (${subtleRatio.toFixed(2)}:1) é o nível mais fraco da escala e ainda precisa cruzar ${MINIMO_TEXTO_NORMAL}:1`);
  });

  check('anel de foco: o anel azul cruza 3:1 contra o halo branco que o isola do fundo real (não-texto, WCAG 1.4.11)', () => {
    // O guia documenta que --lt-focus-ring funciona sobre QUALQUER fundo
    // (campo, painel, botão verde) porque o halo branco de --lt-color-surface
    // desacopla o anel do que está atrás do controle. A prova automatizável
    // é essa: o anel só precisa de 3:1 contra esse halo conhecido, nunca
    // contra o fundo variável — por isso um único par já sustenta a garantia.
    const ring = token('color-brand-blue');
    const halo = token('color-surface');
    const ratio = contrastRatio(ring, halo);
    console.log(`     --lt-color-brand-blue = ${ring} sobre o halo --lt-color-surface = ${halo} → ${ratio.toFixed(2)}:1`);
    assert.ok(
      ratio >= MINIMO_NAO_TEXTO,
      `anel de foco (${ring}) sobre o halo (${halo}) mede ${ratio.toFixed(2)}:1, abaixo do mínimo de ${MINIMO_NAO_TEXTO}:1 `
      + 'para contraste de componente não-textual — o desacoplamento do fundo real deixaria de valer.'
    );
  });

  console.log(`\n${passed}/${PARES.length + PARES_NAO_TEXTO.length + 2} verificações de contraste da landing dentro do esperado.`);
})().catch((err) => {
  console.error('FAIL', err.message);
  process.exitCode = 1;
});
