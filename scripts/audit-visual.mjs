import fs from 'node:fs';
import path from 'node:path';

// Auditoria visual: mede o quanto cada folha de estilo fala a lingua do sistema.
//
//   npm run audit:visual              relatorio completo
//   npm run audit:visual -- --check   falha se alguma tela regredir
//
// A metrica e a taxa de tokenizacao: var(--token) sobre var(--token) + hex
// literal. Nao mede beleza — mede se a tela usa a paleta do sistema ou inventa
// a propria. Tela com taxa baixa e tela que vai parecer de outro produto,
// independente de quao bem desenhada esteja isoladamente.
//
// A superficie publica (landing e triagem) tem linguagem propria por decisao
// de design e e auditada contra os proprios tokens.

const RAIZ = path.resolve(process.cwd(), 'src');
const MINIMO = Number(process.env.AUDIT_VISUAL_MINIMO || 85);
const CHECAR = process.argv.includes('--check');
const JSON_OUT = process.argv.includes('--json');
const BASELINE = process.argv.find((a) => a.startsWith('--baseline='))?.split('=')[1] || null;

// Superficie publica: identidade propria, tokens --lp-* e --ip-*.
const PUBLICOS = ['views/LoginPage.css', 'views/public/InscricaoPublica.css', 'components/Triagem/EscalasVisuais.css'];
// Arquivos que definem tokens em vez de consumir.
const DEFINIDORES = ['index.css', 'styles/theme.css'];

const listar = (dir, acc = []) => {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) listar(full, acc);
    else if (item.name.endsWith('.css')) acc.push(full);
  }
  return acc;
};

const analisar = (arquivo) => {
  const rel = path.relative(RAIZ, arquivo).replace(/\\/g, '/');
  const texto = fs.readFileSync(arquivo, 'utf8');
  const linhas = texto.split('\n').length;

  // Hex dentro de comentario nao conta.
  let limpo = texto.replace(/\/\*[\s\S]*?\*\//g, '');

  const tokens = (limpo.match(/var\(--/g) || []).length;

  // O fallback de var(--token, #hex) nunca pinta quando o token existe — e os
  // --eval-*, --pn-* e --color-* sao todos definidos em :root por theme.css e
  // index.css, ambos carregados no main.jsx. Contar esse hex como hardcoded
  // penalizava arquivos que ja usam o sistema. So conta hex que chega a pintar.
  limpo = limpo.replace(/var\(\s*--[\w-]+\s*,[^()]*\)/g, 'var(--x)');

  const hex = (limpo.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
  const total = tokens + hex;
  const taxa = total === 0 ? 100 : Math.round((tokens / total) * 100);

  const publico = PUBLICOS.includes(rel);
  const definidor = DEFINIDORES.includes(rel);
  const fontesProprias = (texto.match(/fonts\.googleapis/g) || []).length;

  return { rel, linhas, tokens, hex, taxa, publico, definidor, fontesProprias };
};

const arquivos = listar(RAIZ).map(analisar);
const auditaveis = arquivos.filter((a) => !a.definidor && !a.publico);

// Fonte nova fora da superficie publica quebra a unidade tipografica.
const fontesIndevidas = auditaveis.filter((a) => a.fontesProprias > 0);

const abaixo = auditaveis
  .filter((a) => a.taxa < MINIMO && a.linhas >= 40)
  .sort((a, b) => (a.taxa - b.taxa) || (b.linhas - a.linhas));

const somaLinhas = auditaveis.reduce((s, a) => s + a.linhas, 0);
const somaTokens = auditaveis.reduce((s, a) => s + a.tokens, 0);
const somaHex = auditaveis.reduce((s, a) => s + a.hex, 0);
const taxaGeral = Math.round((somaTokens / (somaTokens + somaHex)) * 100);

console.log(`\n[audit-visual] ${auditaveis.length} folhas · ${somaLinhas} linhas · tokenizacao geral ${taxaGeral}%`);
console.log(`[audit-visual] minimo por folha: ${MINIMO}%\n`);

if (abaixo.length) {
  console.log('folha                                                    linhas   tok   hex   taxa');
  for (const a of abaixo) {
    console.log(
      `  ${a.rel.padEnd(54)} ${String(a.linhas).padStart(5)} ${String(a.tokens).padStart(5)} ${String(a.hex).padStart(5)} ${String(`${a.taxa}%`).padStart(6)}`
    );
  }
} else {
  console.log('todas as folhas acima do minimo.');
}

if (fontesIndevidas.length) {
  console.log('\nfontes importadas fora da superficie publica:');
  fontesIndevidas.forEach((a) => console.log(`  ${a.rel}`));
}

const proximas = abaixo.slice(0, 5);
if (proximas.length) {
  console.log('\nmaior ganho por esforco (menor taxa entre as folhas mais pesadas):');
  [...abaixo].sort((a, b) => (b.linhas * (100 - b.taxa)) - (a.linhas * (100 - a.taxa)))
    .slice(0, 5)
    .forEach((a, i) => console.log(`  ${i + 1}. ${a.rel} — ${a.linhas} linhas a ${a.taxa}%`));
}

// Linha de base congelada antes do refino: a revisao final compara contra ela.
if (JSON_OUT || BASELINE) {
  const destino = BASELINE || path.resolve(process.cwd(), 'e2e-artifacts', 'visual-baseline.json');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, `${JSON.stringify({
    geradoEm: new Date().toISOString(),
    minimo: MINIMO,
    taxaGeral,
    somaLinhas,
    folhas: auditaveis.map(({ rel, linhas, tokens, hex, taxa }) => ({ rel, linhas, tokens, hex, taxa }))
      .sort((a, b) => a.rel.localeCompare(b.rel))
  }, null, 2)}\n`, 'utf8');
  console.log(`\n[audit-visual] baseline gravada em ${path.relative(process.cwd(), destino)}`);
}

if (CHECAR && (abaixo.length || fontesIndevidas.length)) {
  console.error(`\n[audit-visual] ${abaixo.length} folhas abaixo de ${MINIMO}%.`);
  process.exit(1);
}
console.log('');
