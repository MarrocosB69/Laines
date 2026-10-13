import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

// Smoke de perfis: cada papel do sistema consegue entrar e chegar numa tela
// utilizavel?
//
//   npm run test:smoke:perfis
//
// Existe por causa de um apagao real: em agosto/2026, oito dos dezesseis perfis
// ficaram sem conseguir entrar — tela branca, sem erro e sem log — porque
// getRedirectPathFromRole devolvia '/' e a rota '/' redirecionava de volta para
// ela mesma. Nada acusou: nem o lint, nem os core tests, nem a suite E2E, que
// so exercita a API e nunca abre o navegador.
//
// O teste afirma tres coisas por perfil:
//   1. o login leva a alguma rota que nao seja a landing;
//   2. essa rota renderiza conteudo de verdade;
//   3. existe ao menos uma area navegavel.
//
// Roda contra o BUILD (npm run preview), nunca contra o dev server: em dev a
// primeira renderizacao leva segundos e o resultado deixa de ser deterministico.

const require = createRequire(import.meta.url);
const DATASET = require('../server/scripts/seed-datasets/e2e-users.json');

const BASE = String(process.env.SMOKE_PERFIS_BASE_URL || 'http://localhost:4173').replace(/\/+$/, '');
const OUT = path.resolve(process.cwd(), 'e2e-artifacts', 'smoke-perfis');
const HEADLESS = !/^(0|false|no)$/i.test(String(process.env.SMOKE_PERFIS_HEADLESS || 'true'));
const TIMEOUT = Number(process.env.SMOKE_PERFIS_TIMEOUT_MS || 30000);
// Em CI todo perfil do dataset precisa passar. Localmente, perfis sem
// credencial configurada sao apenas pulados.
const EXIGE_TODOS = /^(1|true)$/i.test(String(process.env.CI || process.env.SMOKE_PERFIS_STRICT || ''));

const MIN_CONTEUDO = 120;
const ROTAS_INVALIDAS = new Set(['/', '/login']);

const slug = (v) => String(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'perfil';

const perfis = DATASET.map((item) => {
  const email = String(process.env[item.ciEmailEnv] || item.defaultEmail || '').trim();
  const senha = String(process.env[item.ciPasswordEnv] || item.defaultPassword || '').trim();
  return { key: item.key, role: item.role, email, senha, pendente: item.pendente || null };
}).filter((p) => p.email && p.senha);

const verificar = async (browser, perfil) => {
  // Contexto novo por perfil: sessao vazada entre perfis ja produziu medicao
  // falsa antes — a pagina medida era a landing, nao a tela logada.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const falhas = [];

  try {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[autocomplete="username"]', { timeout: TIMEOUT });
    await page.locator('input[autocomplete="username"]').fill(perfil.email);
    await page.locator('input[type="password"]').fill(perfil.senha);
    await page.locator('form button[type="submit"]').click();

    const navegou = await page
      .waitForFunction(
        (landing) => !landing.includes(window.location.pathname),
        ['/', '/login'],
        { timeout: TIMEOUT }
      )
      .then(() => true)
      .catch(() => false);

    // Espera por sinal real de montagem, nunca por tempo fixo: com espera fixa
    // o mesmo perfil passava numa rodada e falhava na seguinte com "0 caracteres",
    // e teste instavel treina o time a ignorar o vermelho.
    await page.waitForFunction(
      (minimo) => {
        const texto = document.body.innerText.trim();
        return texto.length >= minimo || /não tem uma área liberada/i.test(texto);
      },
      MIN_CONTEUDO,
      { timeout: TIMEOUT }
    ).catch(() => {});

    const rota = new URL(page.url()).pathname;
    const corpo = (await page.locator('body').innerText().catch(() => '')).trim();
    const areas = await page.locator('.laines-sidebar__item').count();

    if (!navegou || ROTAS_INVALIDAS.has(rota)) {
      falhas.push(`login nao saiu da landing (rota ${rota}) — provavel laco de redirecionamento`);
    }
    if (corpo.length < MIN_CONTEUDO) {
      falhas.push(`tela praticamente vazia em ${rota} (${corpo.length} caracteres)`);
    }
    if (/não tem uma área liberada/i.test(corpo)) {
      falhas.push(`perfil sem area configurada em ${rota}`);
    } else if (areas === 0 && corpo.length >= MIN_CONTEUDO) {
      falhas.push(`nenhuma area navegavel em ${rota}`);
    }

    await fs.mkdir(OUT, { recursive: true });
    await page.screenshot({ path: path.join(OUT, `${slug(perfil.key)}.png`) }).catch(() => {});

    return { ...perfil, rota, areas, tamanho: corpo.length, falhas };
  } catch (erro) {
    return { ...perfil, rota: null, areas: 0, tamanho: 0, falhas: [`erro: ${erro.message.split('\n')[0]}`] };
  } finally {
    await ctx.close();
  }
};

async function main() {
  if (!perfis.length) {
    console.error('[smoke-perfis] nenhum perfil com credencial configurada.');
    process.exit(1);
  }
  if (EXIGE_TODOS && perfis.length !== DATASET.length) {
    console.error(`[smoke-perfis] ${DATASET.length - perfis.length} perfis sem credencial — obrigatorio em CI.`);
    process.exit(1);
  }

  console.log(`[smoke-perfis] ${BASE} — ${perfis.length} perfis\n`);
  const browser = await chromium.launch({ headless: HEADLESS });
  const resultados = [];

  try {
    for (const perfil of perfis) {
      let r = await verificar(browser, perfil);
      // Uma repeticao apenas quando a falha foi de ambiente (a pagina nao
      // carregou). Falha de acesso nao e repetida: se o perfil chegou numa tela
      // sem area, repetir so esconde o defeito.
      if (r.falhas.some((f) => f.startsWith('erro:'))) {
        console.log(`  repetindo ${perfil.key} (falha de carregamento)`);
        r = await verificar(browser, perfil);
      }
      resultados.push(r);
      const marca = r.falhas.length ? (r.pendente ? 'pendente' : 'FALHOU') : 'ok';
      console.log(
        `  ${marca.padEnd(7)} ${r.key.padEnd(22)} ${String(r.rota || '-').padEnd(13)} areas=${String(r.areas).padStart(2)}`
      );
      r.falhas.forEach((f) => console.log(`          ${f}`));
    }
  } finally {
    await browser.close();
  }

  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(
    path.join(OUT, 'resultado.json'),
    `${JSON.stringify({ baseUrl: BASE, executadoEm: new Date().toISOString(), resultados }, null, 2)}\n`,
    'utf8'
  );

  // Pendencia e defeito conhecido e datado, aguardando decisao de negocio:
  // aparece no relatorio mas nao derruba o build. O que derruba e o perfil que
  // quebrou sem ninguem saber — o caso que este teste existe para pegar.
  const quebrados = resultados.filter((r) => r.falhas.length && !r.pendente);
  const pendentes = resultados.filter((r) => r.falhas.length && r.pendente);
  const utilizaveis = resultados.length - quebrados.length - pendentes.length;

  console.log(`\n[smoke-perfis] ${utilizaveis}/${resultados.length} perfis utilizaveis`);

  if (pendentes.length) {
    console.log('[smoke-perfis] pendencias conhecidas (nao derrubam o build):');
    pendentes.forEach((r) => console.log(`  ${r.key} — ${r.pendente}`));
  }

  if (quebrados.length) {
    console.error(`[smoke-perfis] REGRESSAO: ${quebrados.map((r) => r.key).join(', ')}`);
    process.exit(1);
  }

  console.log('[smoke-perfis] nenhuma regressao de acesso.');
}

main().catch((erro) => {
  console.error('[smoke-perfis] falhou:', erro.message);
  process.exit(1);
});
