import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

// Congela o estado visual das telas alvo do refino, para a revisao final ter
// contra o que comparar. Roda contra o BUILD (npm run preview).
//
//   npm run capture:visual -- --tag=antes
//   npm run capture:visual -- --tag=depois
//
// Depois: comparar as pastas antes/ e depois/ lado a lado, e cruzar com
// e2e-artifacts/visual-baseline-*.json (npm run audit:visual -- --baseline=...).

const BASE = String(process.env.CAPTURE_BASE_URL || 'http://localhost:4173').replace(/\/+$/, '');
const TAG = process.argv.find((a) => a.startsWith('--tag='))?.split('=')[1] || 'antes';
const OUT = path.resolve(process.cwd(), 'e2e-artifacts', 'visual', TAG);
const SENHA = String(process.env.CAPTURE_SENHA || 'PrintsLAINES#2026');

const VIEWPORTS = [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]];

// Telas por onda do plano de refino. Cada alvo e alcancado por navegacao real:
// login do perfil e clique no item de menu.
const ALVOS = [
  { onda: 1, perfil: 'print.aluno@laines.ufrn.br', nome: 'aluno-atletas', menu: 'Meus Atletas' },
  { onda: 1, perfil: 'print.aluno@laines.ufrn.br', nome: 'aluno-agenda', menu: 'Minha Agenda' },
  { onda: 3, perfil: 'print.tecnico@laines.ufrn.br', nome: 'team-portal', menu: null },
  { onda: 3, perfil: 'print.atleta@laines.ufrn.br', nome: 'atleta-portal', menu: null },
  { onda: 4, perfil: 'print.admin@laines.ufrn.br', nome: 'admin-inicio', menu: null },
  { onda: 4, perfil: 'print.admin@laines.ufrn.br', nome: 'admin-relatorios', menu: 'Relatórios' },
  { onda: 4, perfil: 'print.admin@laines.ufrn.br', nome: 'admin-membros', menu: 'Membros' },
  { onda: 4, perfil: 'print.admin@laines.ufrn.br', nome: 'admin-atletas', menu: 'Atletas' },
  { onda: 4, perfil: 'print.admin@laines.ufrn.br', nome: 'admin-pesquisa', menu: 'Pesquisa' },
  { onda: 4, perfil: 'print.admin@laines.ufrn.br', nome: 'admin-extensao', menu: 'Extensão' },
  { onda: 2, perfil: 'print.professor@laines.ufrn.br', nome: 'professor-inicio', menu: null }
];

const entrar = async (page, email) => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[autocomplete="username"]', { timeout: 30000 });
  await page.locator('input[autocomplete="username"]').fill(email);
  await page.locator('input[type="password"]').fill(SENHA);
  await page.locator('form button[type="submit"]').click();
  await page.waitForFunction(
    () => document.body.innerText.trim().length > 120,
    undefined,
    { timeout: 30000 }
  ).catch(() => {});
  await page.waitForTimeout(900);
};

// Fecha modal aberto para nao contaminar a captura seguinte.
const limpar = async (page) => {
  const sel = '.athlete-wizard-overlay, [role="dialog"]';
  if (await page.locator(sel).count()) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
};

async function main() {
  const browser = await chromium.launch();
  let ok = 0;
  let falhas = 0;

  for (const [nomeVp, viewport] of VIEWPORTS) {
    const dir = path.join(OUT, nomeVp);
    await fs.mkdir(dir, { recursive: true });
    console.log(`\n${nomeVp} — ${viewport.width}x${viewport.height}`);

    let perfilAtual = null;
    let ctx = null;
    let page = null;

    for (const alvo of ALVOS) {
      if (alvo.perfil !== perfilAtual) {
        if (ctx) await ctx.close();
        ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
        page = await ctx.newPage();
        await entrar(page, alvo.perfil);
        perfilAtual = alvo.perfil;
      }

      await limpar(page);
      if (alvo.menu) {
        const item = page.locator('.laines-sidebar__item', { hasText: alvo.menu }).first();
        if (await item.count()) {
          await item.click({ timeout: 8000 }).catch(() => {});
          await page.waitForTimeout(2200);
        }
      }

      const arquivo = path.join(dir, `onda${alvo.onda}-${alvo.nome}.png`);
      try {
        await page.screenshot({ path: arquivo, fullPage: true });
        const alt = await page.evaluate(() => document.documentElement.scrollHeight);
        console.log(`  onda${alvo.onda} ${alvo.nome.padEnd(20)} ${alt}px`);
        ok++;
      } catch (e) {
        console.log(`  onda${alvo.onda} ${alvo.nome.padEnd(20)} FALHOU: ${e.message.split('\n')[0]}`);
        falhas++;
      }
    }
    if (ctx) await ctx.close();
  }

  await browser.close();
  console.log(`\n[capture-visual] ${ok} capturas em ${path.relative(process.cwd(), OUT)}${falhas ? ` · ${falhas} falhas` : ''}`);
}

main().catch((e) => {
  console.error('[capture-visual] falhou:', e.message);
  process.exit(1);
});
