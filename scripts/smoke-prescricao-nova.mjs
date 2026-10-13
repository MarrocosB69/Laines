import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

// Smoke da tela de prescricao construida sobre o nucleo puro (/prescricao-plano).
//
//   npm run test:smoke:prescricao:nova
//
// Cobre o que so o DOM prova. As regras de calculo ja tem teste unitario em
// run-core-tests.mjs; aqui ficam as afirmacoes que dependem de renderizacao:
//
//   1. Micronutrientes ficam FORA do DOM antes de expandir. Escondidos por CSS
//      ainda seriam percorridos por leitor de tela e por navegacao com Tab.
//   2. Tabelas sao semanticas (th com scope) — a tela e densa e navegada por
//      teclado durante o atendimento.
//   3. Editar a quantidade recalcula refeicao, dia, rosca e adequacao. Nenhum
//      total e armazenado: se algum numero ficar parado, ha estado guardado.
//   4. A medida caseira nao e truncada. "colher de servir · 50 g" cortado em
//      "colher de servir · 50…" perde justamente o que se usa para prescrever.
//   5. O substituto nao soma ao total do dia.

const BASE = String(process.env.SMOKE_PRESCRICAO_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
const PACIENTE = process.env.SMOKE_PACIENTE_ID || '1bf05737-dc5b-40dd-97f9-003940adfd6b';
const OUT = path.resolve(process.cwd(), 'e2e-artifacts', 'smoke-prescricao-nova');
const HEADLESS = !/^(0|false|no)$/i.test(String(process.env.SMOKE_PRESCRICAO_HEADLESS || 'true'));
const TIMEOUT = Number(process.env.SMOKE_PRESCRICAO_TIMEOUT_MS || 30000);
const EMAIL = String(process.env.SMOKE_PRESCRICAO_EMAIL || 'print.aluno@laines.ufrn.br');
const SENHA = String(process.env.SMOKE_PRESCRICAO_SENHA || 'PrintsLAINES#2026');

const checagens = [];
const registrar = (nome, ok, detalhe = '') => {
  checagens.push({ nome, ok, detalhe });
  console.log(`  ${(ok ? 'ok' : 'FALHOU').padEnd(7)} ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
};

const numeroDe = (texto) => {
  const m = String(texto || '').replace(/\./g, '').match(/-?\d+(,\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : null;
};

async function main() {
  console.log(`[smoke-prescricao-nova] ${BASE}\n`);
  await fs.mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: HEADLESS });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await ctx.newPage();

  const errosJs = [];
  page.on('pageerror', (e) => errosJs.push(String(e).split('\n')[0].slice(0, 160)));

  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[autocomplete="username"]', { timeout: TIMEOUT });
    await page.locator('input[autocomplete="username"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(SENHA);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/(aluno|admin|professor)/, { timeout: TIMEOUT });
    await page.waitForTimeout(2000);

    // A tela roda sobre o seed: nao depende de paciente nem de API.
    await page.goto(`${BASE}/prescricao-plano/${PACIENTE}`, { waitUntil: 'domcontentloaded' });
    // O chunk da tela e carregado sob demanda (React.lazy) e em dev o Vite
    // ainda transforma os modulos na primeira visita: esperar a tabela existir
    // e mais confiavel do que esperar um tempo fixo.
    await page.waitForSelector('table', { timeout: TIMEOUT }).catch(() => {});
    await page.waitForTimeout(1200);

    const temTela = (await page.locator('table').count()) > 0;
    registrar('a tela abre e renderiza tabelas', temTela);
    if (!temTela) throw new Error('nenhuma tabela na tela');

    // ── 2. tabelas semanticas ─────────────────────────────────────────
    const cabecalhos = await page.locator('th[scope="col"]').count();
    const linhasTh = await page.locator('th[scope="row"]').count();
    registrar(
      'tabelas com th scope',
      cabecalhos > 0 && linhasTh > 0,
      `${cabecalhos} th[scope=col] · ${linhasTh} th[scope=row]`
    );

    // ── 1. micronutrientes fora do DOM antes de expandir ──────────────
    const botaoMicro = page.locator('button:has-text("Micronutrientes")').first();
    const linhasAntes = await page.locator('th[scope="row"]').count();
    const temFerroAntes = await page.locator('th[scope="row"]:has-text("Ferro")').count();
    registrar(
      'micronutrientes ausentes do DOM antes de expandir',
      temFerroAntes === 0,
      `${temFerroAntes} linha(s) de micro no DOM`
    );
    registrar(
      'o botao de micronutrientes declara aria-expanded',
      (await botaoMicro.getAttribute('aria-expanded')) === 'false'
    );

    await botaoMicro.click();
    await page.waitForTimeout(600);
    const linhasDepois = await page.locator('th[scope="row"]').count();
    registrar(
      'expandir acrescenta os micronutrientes',
      linhasDepois > linhasAntes,
      `${linhasAntes} → ${linhasDepois} linhas`
    );

    // ── 4. medida caseira nao truncada ────────────────────────────────
    const medidas = page.locator('td:has-text("·")').filter({ hasText: /\bg$/ });
    const truncadas = await page.evaluate(() => {
      const celulas = [...document.querySelectorAll('td')];
      return celulas.filter((c) => /·\s*\d/.test(c.textContent || '') && c.scrollWidth > c.clientWidth + 1).length;
    });
    registrar(
      'medida caseira nao e truncada',
      truncadas === 0,
      `${truncadas} celula(s) com corte · ${await medidas.count()} medida(s) na tela`
    );

    // ── 3. editar quantidade recalcula tudo ───────────────────────────
    // <text> dentro de SVG nao e HTMLElement: innerText nao existe nele.
    const conteudo = (seletor) => page.evaluate(
      (sel) => document.querySelector(sel)?.textContent?.trim() ?? '',
      seletor
    );
    const totalDia = () => conteudo('.bg-stone-100.px-4');
    const roscaKcal = () => conteudo('svg[role="img"] text');
    const planoEnergia = () => page.locator('th[scope="row"]:has-text("Energia")').first()
      .locator('xpath=following-sibling::td[1]').innerText();

    const antes = {
      dia: await totalDia(),
      rosca: numeroDe(await roscaKcal()),
      adequacao: numeroDe(await planoEnergia())
    };

    // O plano de um paciente real comeca vazio; o seed vinha com alimentos.
    // Montar a refeicao aqui exercita a busca no catalogo real de quebra.
    // Contar `tbody tr` nao serve: a tabela de adequacao ja tem cinco linhas
    // sem alimento nenhum. O que revela a refeicao vazia e nao haver campo de
    // quantidade.
    // Escopado ao corpo da tabela: a barra de treino tambem tem um campo
    // numerico, e conta-lo fazia o smoke achar que a refeicao ja tinha comida.
    if (await page.locator('.prescricao-plano tbody input[type="number"]').count() === 0) {
      await page.locator('button:has-text("Adicionar alimento")').first().click();
      await page.waitForTimeout(700);
      await page.locator('#busca-alimento').fill('arroz');
      await page.waitForTimeout(2800);
      const primeiro = page.locator('.pp-busca__linha').first();
      registrar('a busca no catalogo real devolve resultado', await primeiro.count() > 0);
      if (await primeiro.count()) {
        await primeiro.click();
        await page.waitForTimeout(1800);
      }
    }

    const qtd = page.locator('.prescricao-plano tbody input[type="number"]').first();
    const valorAtual = Number(await qtd.inputValue());
    await qtd.fill(String(valorAtual + 2));
    await qtd.dispatchEvent('change');
    await page.waitForTimeout(900);

    const depois = {
      dia: await totalDia(),
      rosca: numeroDe(await roscaKcal()),
      adequacao: numeroDe(await planoEnergia())
    };

    registrar('editar quantidade move o total do dia', antes.dia !== depois.dia,
      `${antes.dia.replace(/\s+/g, ' ')} → ${depois.dia.replace(/\s+/g, ' ')}`);
    registrar('editar quantidade move a rosca', antes.rosca !== depois.rosca,
      `${antes.rosca} → ${depois.rosca}`);
    registrar('editar quantidade move a adequacao', antes.adequacao !== depois.adequacao,
      `${antes.adequacao} → ${depois.adequacao}`);

    // ── 5. substituto nao soma ao total ───────────────────────────────
    const trocar = page.locator('button[aria-label^="Opções de substituição"]').first();
    await trocar.click();
    await page.waitForTimeout(700);
    const painel = await page.locator('text=/âncora/i').count();
    registrar('o painel de substituicao abre com a ancora nomeada', painel > 0);

    const diaComPainel = await totalDia();
    const adicionar = page.locator('button[aria-label^="Adicionar"]').first();
    if (await adicionar.count()) {
      await adicionar.click();
      await page.waitForTimeout(900);
    }
    registrar(
      'adicionar substituto NAO move o total do dia',
      diaComPainel === (await totalDia()),
      `${diaComPainel.replace(/\s+/g, ' ')}`
    );

    await page.screenshot({ path: path.join(OUT, 'prescricao-nova.png'), fullPage: true }).catch(() => {});
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
    console.error(`[smoke-prescricao-nova] ${falhas.length} de ${checagens.length} checagens falharam.`);
    console.error(`[smoke-prescricao-nova] artefatos em ${path.relative(process.cwd(), OUT)}`);
    process.exitCode = 1;
  } else {
    console.log(`[smoke-prescricao-nova] ${checagens.length} checagens passaram.`);
  }
}

main().catch((erro) => {
  console.error('[smoke-prescricao-nova] falha inesperada:', erro?.message || erro);
  process.exit(1);
});
