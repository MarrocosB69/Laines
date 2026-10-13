import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

// Captura o fluxo completo da triagem publica (/inscricao) em desktop e mobile.
//
//   npm run screenshots:triagem
//
// Variaveis:
//   TRIAGEM_SCREENSHOT_BASE_URL   default http://localhost:5173
//   TRIAGEM_SCREENSHOT_RUN_ID     default timestamp ISO
//   TRIAGEM_SCREENSHOT_HEADLESS   default true

const BASE_URL = String(process.env.TRIAGEM_SCREENSHOT_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
const RUN_ID = process.env.TRIAGEM_SCREENSHOT_RUN_ID || new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const OUT_DIR = path.resolve(process.cwd(), 'e2e-artifacts', 'triagem-screenshots', RUN_ID);
const HEADLESS = !/^(0|false|no)$/i.test(String(process.env.TRIAGEM_SCREENSHOT_HEADLESS || 'true'));

const DESKTOP = { width: 1280, height: 1000 };
const MOBILE = { width: 390, height: 844 };

// CPF valido apenas para preenchimento de captura.
const AMOSTRA = {
  nome: 'Maria Souza Andrade',
  cpf: '529.982.247-25',
  nascimento: '2001-04-12',
  telefone: '(84) 99988-7766',
  email: 'maria.andrade@exemplo.com'
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const campo = (page, rotulo) => page
  .locator('.ip-field')
  .filter({ has: page.locator('.ip-label', { hasText: rotulo }) });

const avancar = async (page) => {
  await page.getByRole('button', { name: /Avançar/i }).click();
  await sleep(550);
};

const abrir = async (page) => {
  await page.goto(`${BASE_URL}/inscricao`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ip-card', { timeout: 20000 });
  await sleep(900);
};

const shot = async (page, ordem, nome, sufixo) => {
  const arquivo = `${String(ordem).padStart(2, '0')}-${nome}-${sufixo}.png`;
  await page.screenshot({ path: path.join(OUT_DIR, arquivo), fullPage: true });
  const altura = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log(`  ${arquivo.padEnd(38)} ${altura}px`);
  return { arquivo, altura };
};

const preencherDados = async (page) => {
  await campo(page, 'Nome completo').locator('input').fill(AMOSTRA.nome);
  await campo(page, 'CPF').locator('input').fill(AMOSTRA.cpf);
  await campo(page, 'Data de nascimento').locator('input').fill(AMOSTRA.nascimento);
  await campo(page, 'Telefone').locator('input').fill(AMOSTRA.telefone);
  await campo(page, 'E-mail').locator('input').fill(AMOSTRA.email);
  await campo(page, 'Sexo biológico').locator('select').selectOption('feminino');
  await campo(page, 'Estado').locator('select').selectOption('RN');
  await sleep(400);
  await campo(page, 'Cidade').locator('select').selectOption('Santa Cruz');
  await sleep(200);
};

// Marca algumas opcoes para as capturas mostrarem estado selecionado, nao so vazio.
const marcarAmostras = async (page) => {
  const chips = page.locator('.ip-chip');
  if (await chips.count()) await chips.first().click();
  const urinas = page.locator('.ip-urine-strip');
  if (await urinas.count()) {
    await urinas.nth(0).locator('.ip-urine-opt').nth(1).click();
    await urinas.nth(1).locator('.ip-urine-opt').nth(5).click();
  }
  const bristol = page.locator('.ip-bristol-opt');
  if (await bristol.count()) await bristol.nth(3).click();
  const sim = page.locator('.ip-qbtn', { hasText: 'Sim' });
  if (await sim.count()) {
    await sim.nth(0).click();
    await sim.nth(3).click();
  }
  await sleep(350);
};

const percorrer = async (page, sufixo) => {
  await abrir(page);
  const etapas = [];

  etapas.push(await shot(page, 1, 'termo', sufixo));
  await page.locator('.ip-consent-label input[type="checkbox"]').check();
  await avancar(page);

  await preencherDados(page);
  etapas.push(await shot(page, 2, 'dados-pessoais', sufixo));
  await avancar(page);

  etapas.push(await shot(page, 3, 'esporte', sufixo));
  await avancar(page);

  await marcarAmostras(page);
  etapas.push(await shot(page, 4, 'saude', sufixo));
  await avancar(page);

  await marcarAmostras(page);
  etapas.push(await shot(page, 5, 'rotina', sufixo));
  await avancar(page);

  await marcarAmostras(page);
  etapas.push(await shot(page, 6, 'finalizacao', sufixo));

  // Tela de sucesso sem depender da API: a resposta e interceptada.
  await page.route('**/public/inscricao', (route) => route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ prontuario: 'LAI-2026-0184', message: 'Inscrição realizada com sucesso!' })
  }));
  await page.getByRole('button', { name: /Enviar inscrição/i }).click();
  await page.waitForSelector('.ip-success', { timeout: 15000 });
  await sleep(700);
  etapas.push(await shot(page, 7, 'sucesso', sufixo));

  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: window.innerWidth
  }));
  return { etapas, overflow };
};

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: HEADLESS });
  const resumo = {};

  try {
    for (const [sufixo, viewport] of [['desktop', DESKTOP], ['mobile', MOBILE]]) {
      console.log(`\n${sufixo} — ${viewport.width}x${viewport.height}`);
      const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
      resumo[sufixo] = await percorrer(page, sufixo);
      const { scroll, viewport: vw } = resumo[sufixo].overflow;
      console.log(`  overflow horizontal: ${scroll === vw ? 'nenhum' : `${scroll}px > ${vw}px`}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }

  await fs.writeFile(
    path.join(OUT_DIR, 'resumo.json'),
    `${JSON.stringify({ baseUrl: BASE_URL, runId: RUN_ID, ...resumo }, null, 2)}\n`,
    'utf8'
  );
  console.log(`\nCapturas em ${OUT_DIR}`);
}

main().catch((error) => {
  console.error('[triagem-screenshots] falhou:', error.message);
  process.exitCode = 1;
});
