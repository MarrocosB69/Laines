import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

// Smoke da prescricao de plano alimentar.
//
//   npm run test:smoke:prescricao
//
// Existe por causa de quatro defeitos reais encontrados nesta tela, todos
// invisiveis para lint, core tests e para a suite E2E — que exercita a API e
// nunca abre o navegador:
//
//   1. A busca do catalogo comparava com acento. Havia 35 alimentos grafados
//      "Feijao" com til e nenhum era alcancavel digitando "feijao", que e como
//      se digita. Boa parte do catalogo ficava invisivel.
//   2. Medida, quantidade e "Adicionar" apareciam antes de escolher o alimento,
//      ocupando quatro linhas mortas por refeicao.
//   3. O substituto pertencia a refeicao, nao ao alimento: numa refeicao com
//      arroz, feijao e ovo ninguem sabia qual deles cada substituto trocava.
//   4. O substituto poderia somar ao total da refeicao. Ele e alternativa: se
//      somar, o plano inteiro passa a mentir sobre a energia prescrita.
//
// O invariante 4 e o mais grave e o mais silencioso — nada na tela denunciaria.

const BASE = String(process.env.SMOKE_PRESCRICAO_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
const OUT = path.resolve(process.cwd(), 'e2e-artifacts', 'smoke-prescricao');
const HEADLESS = !/^(0|false|no)$/i.test(String(process.env.SMOKE_PRESCRICAO_HEADLESS || 'true'));
const TIMEOUT = Number(process.env.SMOKE_PRESCRICAO_TIMEOUT_MS || 30000);
const EMAIL = String(process.env.SMOKE_PRESCRICAO_EMAIL || 'print.aluno@laines.ufrn.br');
const SENHA = String(process.env.SMOKE_PRESCRICAO_SENHA || 'PrintsLAINES#2026');

// Termo sem acento cujo equivalente no catalogo tem acento. Se a busca voltar
// a comparar com acento, este e o primeiro a falhar.
const TERMO_SEM_ACENTO = String(process.env.SMOKE_PRESCRICAO_TERMO || 'feijao');
// Termo usado para montar a refeicao; precisa existir em qualquer catalogo.
const TERMO_ALIMENTO = String(process.env.SMOKE_PRESCRICAO_ALIMENTO || 'arroz');

const checagens = [];
const registrar = (nome, ok, detalhe = '') => {
  checagens.push({ nome, ok, detalhe });
  console.log(`  ${(ok ? 'ok' : 'FALHOU').padEnd(7)} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
};

const abrirPrescricao = async (page) => {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[autocomplete="username"]', { timeout: TIMEOUT });
  await page.locator('input[autocomplete="username"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(SENHA);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/(aluno|admin|professor)/, { timeout: TIMEOUT });
  await page.waitForTimeout(2500);

  // O prontuario e a porta: a prescricao nao aceita link direto enquanto o
  // fluxo de sessao nao emitir refresh token.
  await page.locator('button:has-text("Lucas Gabriel Cunha")').first().click();
  await page.waitForTimeout(3800);
  await page.locator('button:has-text("Nova avaliação")').first().click();
  await page.waitForTimeout(9000);
  await page.locator('.avaliacao-nav__plano').click();
  await page.waitForFunction(
    () => window.location.pathname.includes('planos-alimentares'),
    { timeout: TIMEOUT }
  );
  await page.waitForTimeout(4000);
};

const buscarNoCampo = async (page, campo, termo) => {
  await campo.fill('');
  await campo.fill(termo);
  await page.waitForTimeout(2600);
};

async function main() {
  console.log(`[smoke-prescricao] ${BASE}\n`);
  await fs.mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: HEADLESS });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await ctx.newPage();

  const errosJs = [];
  page.on('pageerror', (e) => errosJs.push(String(e).split('\n')[0].slice(0, 160)));

  try {
    await abrirPrescricao(page);
    registrar('a tela de prescricao abre', page.url().includes('planos-alimentares'), page.url().replace(BASE, ''));

    // ── 2. nenhuma UI morta antes de escolher o alimento ──────────────
    const controlesOrfaos = await page.locator('.alimento-buscador__row-controls').count();
    registrar(
      'medida e quantidade so aparecem com alimento escolhido',
      controlesOrfaos === 0,
      `${controlesOrfaos} bloco(s) visivel(is) sem selecao`
    );

    const campoBusca = page.locator('.refeicao-col--unica .alimento-buscador input[type="text"]').first();

    // ── 1. busca insensivel a acento ──────────────────────────────────
    await buscarNoCampo(page, campoBusca, TERMO_SEM_ACENTO);
    const semAcento = await page.locator('.alimento-buscador__results button').count();
    registrar(
      `busca sem acento encontra resultados ("${TERMO_SEM_ACENTO}")`,
      semAcento > 0,
      semAcento === 0
        ? 'zero resultados — o backend pode estar rodando o codigo anterior a unaccent'
        : `${semAcento} resultado(s)`
    );

    // ── monta a refeicao ──────────────────────────────────────────────
    await buscarNoCampo(page, campoBusca, TERMO_ALIMENTO);
    const primeiro = page.locator('.alimento-buscador__results button').first();
    const achouAlimento = (await primeiro.count()) > 0;
    registrar(`busca encontra "${TERMO_ALIMENTO}"`, achouAlimento);

    if (!achouAlimento) throw new Error(`catalogo nao devolveu resultado para "${TERMO_ALIMENTO}"`);

    await primeiro.click();
    await page.waitForTimeout(900);
    await page.locator('.btn-adicionar-alimento').first().click();
    await page.waitForTimeout(1800);

    const itens = await page.locator('.refeicao-col--unica .alimentos-lista > li.alimento-item').count();
    registrar('alimento entra na refeicao', itens >= 1, `${itens} item(ns)`);

    const kcalAntes = (await page.locator('.macro-chip').first().innerText()).trim();

    // ── 3. o substituto pertence ao alimento ──────────────────────────
    const botaoOpcoes = page.locator('.btn-opcoes-alimento').first();
    const temBotao = (await botaoOpcoes.count()) > 0;
    registrar('a linha do alimento oferece opcoes de substituicao', temBotao);

    if (!temBotao) throw new Error('linha do alimento sem botao de opcoes');

    await botaoOpcoes.click();
    await page.waitForTimeout(900);
    const painel = await page.locator('.alimento-opcoes').count();
    registrar('o painel de opcoes abre sob o alimento', painel === 1);

    const campoSub = page.locator('.alimento-opcoes .alimento-buscador input[type="text"]').first();
    await buscarNoCampo(page, campoSub, TERMO_ALIMENTO);
    const primeiroSub = page.locator('.alimento-opcoes .alimento-buscador__results button').first();
    if (await primeiroSub.count()) {
      await primeiroSub.click();
      await page.waitForTimeout(900);
      await page.locator('.alimento-opcoes .btn-adicionar-alimento').first().click();
      await page.waitForTimeout(1800);
    }

    const opcoes = await page.locator('.alimento-opcoes .alimento-item--opcao').count();
    registrar('o substituto entra vinculado ao alimento', opcoes >= 1, `${opcoes} opcao(oes)`);

    // ── 3b. a linha do substituto fala de troca, nao de valor absoluto ─
    const textoOpcao = opcoes > 0
      ? (await page.locator('.alimento-item--opcao').first().innerText()).replace(/\s+/g, ' ')
      : '';
    registrar(
      'o substituto mostra o delta em relacao ao alimento',
      /CHO\s*[+−=]/.test(textoOpcao),
      textoOpcao ? textoOpcao.slice(0, 70) : 'sem opcao para inspecionar'
    );

    // ── 4. o invariante: substituto nao soma ao total ─────────────────
    const kcalDepois = (await page.locator('.macro-chip').first().innerText()).trim();
    registrar(
      'o substituto NAO soma ao total da refeicao',
      kcalAntes === kcalDepois,
      `antes ${kcalAntes} · depois ${kcalDepois}`
    );

    await page.screenshot({ path: path.join(OUT, 'prescricao.png'), fullPage: false }).catch(() => {});
  } catch (erro) {
    registrar('execucao sem excecao', false, erro.message.split('\n')[0]);
    await page.screenshot({ path: path.join(OUT, 'falha.png'), fullPage: false }).catch(() => {});
  } finally {
    registrar('nenhum erro de javascript', errosJs.length === 0, errosJs.slice(0, 2).join(' | '));
    await ctx.close();
    await browser.close();
  }

  const falhas = checagens.filter((c) => !c.ok);
  console.log('');
  if (falhas.length) {
    console.error(`[smoke-prescricao] ${falhas.length} de ${checagens.length} checagens falharam.`);
    console.error(`[smoke-prescricao] artefatos em ${path.relative(process.cwd(), OUT)}`);
    process.exitCode = 1;
  } else {
    console.log(`[smoke-prescricao] ${checagens.length} checagens passaram.`);
  }
}

main().catch((erro) => {
  console.error('[smoke-prescricao] falha inesperada:', erro?.message || erro);
  process.exit(1);
});
