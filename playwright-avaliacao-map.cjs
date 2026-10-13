/**
 * playwright-avaliacao-map.cjs
 * Captura screenshots de todas as telas de avaliação do LAINES.
 * Uso: node playwright-avaliacao-map.cjs
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ───── Configuração ─────────────────────────────────────────────────────────
const FRONTEND_URL = 'http://[::1]:5173';
const API_HOST = '127.0.0.1';
const API_PORT = 4000;
const EMAIL = 'e2e-admin@teste.com';
const PASSWORD = 'e2e-password';
const SCREENSHOTS_DIR = path.join(__dirname, 'playwright-screenshots');
const VIEWPORT = { width: 1440, height: 900 };
const CI_PACIENTE_ID = '21111111-1111-4111-8111-111111111111';

// Módulos de avaliação na ordem do registry
const EVALUATION_MODULES = [
  { moduleId: 'anamnese-inicial',      label: 'Anamnese Inicial',                  ordem: 1  },
  { moduleId: 'avaliacao-clinica',     label: 'Avaliação Clínica',                 ordem: 2  },
  { moduleId: 'exames-laboratoriais',  label: 'Exames Laboratoriais',              ordem: 3  },
  { moduleId: 'socioeconomica',        label: 'Socioeconômica (EBIA)',             ordem: 4  },
  { moduleId: 'triagem-reds',          label: 'Disponibilidade energética',        ordem: 5  },
  { moduleId: 'perimetros',            label: 'Perímetros Corporais',              ordem: 7  },
  { moduleId: 'dobras-cutaneas',       label: 'Dobras Cutâneas',                   ordem: 8  },
  { moduleId: 'bioimpedancia',         label: 'Bioimpedância',                     ordem: 9  },
  { moduleId: 'composicao-integrada',  label: 'Composição Corporal Integrada',     ordem: 10 },
  { moduleId: 'gasto-energetico',      label: 'Gasto Energético Total',            ordem: 11 },
  { moduleId: 'carga-treino',          label: 'Carga de Treino e Periodização',    ordem: 12 },
  { moduleId: 'alimentar',             label: 'Avaliação Alimentar (NOVA)',         ordem: 13 },
  { moduleId: 'hidratacao',            label: 'Hidratação',                        ordem: 14 },
  { moduleId: 'psicologia',            label: 'Psicologia',                        ordem: 16 },
  { moduleId: 'fisioterapia',          label: 'Fisioterapia',                      ordem: 17 },
  { moduleId: 'evolucao-retorno',      label: 'Evolução / Retorno',                ordem: 18 },
];

// ───── Utilitários ────────────────────────────────────────────────────────────
function apiRequest(method, urlPath, token, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const req = http.request({ hostname: API_HOST, port: API_PORT, path: urlPath, method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (_) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getApiToken() {
  const res = await apiRequest('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD });
  if (!res.body?.accessToken) throw new Error(`Login API failed: ${JSON.stringify(res.body)}`);
  return res.body.accessToken;
}

function slugify(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function waitForStable(page, timeout = 8000) {
  try { await page.waitForLoadState('networkidle', { timeout }); } catch (_) {}
}

// ───── Main ───────────────────────────────────────────────────────────────────
(async () => {
  ensureDir(SCREENSHOTS_DIR);

  console.log('Iniciando Playwright...');
  const browser = await chromium.launch({ headless: true });

  const results = [];
  const errors = [];

  // ─── FASE 1: Tela de login (sem autenticar) ────────────────────────────────
  console.log('\n[Fase 1] Capturando tela de login...');
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    const pg = await ctx.newPage();
    await pg.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await waitForStable(pg, 5000);
    await pg.waitForTimeout(1000);
    const f = 'tela-00-login.png';
    await pg.screenshot({ path: path.join(SCREENSHOTS_DIR, f), fullPage: true });
    results.push({ label: 'Tela de Login', file: f, url: '/login', status: 'ok', grupo: 'Contexto' });
    console.log('  [OK] tela-00-login.png');
    await ctx.close();
  }

  // ─── FASE 2: Login + captura do painel admin ───────────────────────────────
  console.log('\n[Fase 2] Login + painel admin...');
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await waitForStable(page, 5000);

  try {
    await page.fill('input[autocomplete="username"]', EMAIL);
    await page.fill('input[autocomplete="current-password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15000 });
    console.log('  Login UI OK ->', page.url());
  } catch (e) {
    console.error('  ERRO no login UI:', e.message);
    await browser.close(); process.exit(1);
  }

  await waitForStable(page, 6000);
  await page.waitForTimeout(1500);
  {
    const f = 'tela-00-painel-admin.png';
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, f), fullPage: true });
    results.push({ label: 'Painel do Admin', file: f, url: '/admin', status: 'ok', grupo: 'Contexto' });
    console.log('  [OK] tela-00-painel-admin.png');
  }

  // ─── FASE 3: Navegar para AvaliacaoCompleta usando SPA routing ────────────
  // Como o token é in-memory, usamos window.history para navegar sem reload.
  // Isso mantém o contexto React e o token em memória.
  console.log('\n[Fase 3] Navegando para Avaliação Completa (SPA)...');

  // Tentar navegar via SPA (click em link ou React Router)
  // Estratégia: usar page.evaluate para disparar evento de navegação
  // O React Router escuta o popstate/pushState
  const navResult = await page.evaluate((pacienteId) => {
    try {
      window.history.pushState({}, '', `/avaliacao/${pacienteId}`);
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
      return 'ok';
    } catch (e) {
      return 'error: ' + e.message;
    }
  }, CI_PACIENTE_ID);
  console.log('  SPA nav result:', navResult);

  await waitForStable(page, 8000);
  await page.waitForTimeout(3000);

  console.log('  URL apos nav:', page.url());

  // Verificar se chegou na tela de avaliação (não redirecionou para login)
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    console.warn('  Redirecionou para /login. Tentando via link direto na UI...');

    // Estratégia alternativa: procurar um link de paciente no painel
    // Tentar navegar usando o context do aluno (que tem acesso direto)
    console.log('  Mudando para login como aluno...');
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForStable(page, 4000);
    await page.fill('input[autocomplete="username"]', 'e2e-aluno@teste.com');
    await page.fill('input[autocomplete="current-password"]', 'e2e-password');
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15000 });
    console.log('  Login aluno OK ->', page.url());
    await waitForStable(page, 5000);
    await page.waitForTimeout(1500);

    // Navegar para avaliacao via SPA
    await page.evaluate((pacienteId) => {
      window.history.pushState({}, '', `/avaliacao/${pacienteId}`);
      window.dispatchEvent(new PopStateEvent('popstate', {}));
    }, CI_PACIENTE_ID);
    await waitForStable(page, 8000);
    await page.waitForTimeout(3000);
    console.log('  URL apos nav (aluno):', page.url());
  }

  // Screenshot da tela completa (visão geral / primeiro módulo padrão)
  {
    const f = 'tela-01-avaliacao-completa-visao-geral.png';
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, f), fullPage: true });
    results.push({ label: 'Avaliação Completa — Visão Geral', file: f, url: `/avaliacao/${CI_PACIENTE_ID}`, status: 'ok', grupo: 'Contexto', ordem: 0 });
    console.log('  [OK] tela-01-avaliacao-completa-visao-geral.png');
  }

  // ─── FASE 4: Capturar cada módulo via clique na sidebar ───────────────────
  console.log('\n[Fase 4] Capturando módulos de avaliação...');

  // Listar botões disponíveis na sidebar para debug
  const availableBtns = await page.evaluate(() => {
    const btns = document.querySelectorAll('button.avaliacao-module-btn');
    return Array.from(btns).map((b) => ({
      text: b.textContent?.trim().slice(0, 50),
      title: b.getAttribute('title') || '',
      classes: b.className
    }));
  });
  console.log(`  Botões encontrados na sidebar: ${availableBtns.length}`);
  if (availableBtns.length === 0) {
    // Tentar diagnóstico: mostrar a URL atual e o conteúdo da página
    const diagHtml = await page.evaluate(() => document.body?.innerHTML?.slice(0, 500) || 'VAZIO');
    console.log('  Body snippet:', diagHtml);
  } else {
    availableBtns.slice(0, 5).forEach((b) => console.log(`    - "${b.text}"`));
  }

  for (const mod of EVALUATION_MODULES) {
    const filename = `avaliacao-${String(mod.ordem).padStart(2, '0')}-${slugify(mod.label)}.png`;
    console.log(`  -> [${mod.ordem}] ${mod.label}`);

    try {
      // Tentar clicar via índice de posição ou texto do botão na sidebar
      // O texto do botão é o label do registry (sem acentos, ex: "Anamnese inicial")
      let clicked = false;

      // 1. Tentar por qualquer texto que comece com as primeiras palavras
      const firstWord = mod.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ')[0];
      const allBtns = page.locator('button.avaliacao-module-btn');
      const count = await allBtns.count();
      for (let i = 0; i < count; i++) {
        const btnText = await allBtns.nth(i).textContent();
        const normalized = (btnText || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (normalized.includes(firstWord.toLowerCase())) {
          await allBtns.nth(i).click({ timeout: 5000 });
          clicked = true;
          break;
        }
      }

      if (!clicked) {
        // 2. Tentar pelo título com índice
        const byTitle = page.locator(`button.avaliacao-module-btn[title*="${firstWord}"]`);
        if (await byTitle.count() > 0) {
          await byTitle.first().click({ timeout: 5000 });
          clicked = true;
        }
      }

      if (!clicked) {
        throw new Error(`Botão não encontrado para módulo "${mod.label}" (total botões: ${count})`);
      }

      await page.waitForTimeout(1800);
      await waitForStable(page, 5000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, filename), fullPage: true });
      results.push({ label: mod.label, file: filename, url: `/avaliacao/${CI_PACIENTE_ID}#${mod.moduleId}`, status: 'ok', grupo: 'Módulo de Avaliação', ordem: mod.ordem });
      console.log(`     [OK] ${filename}`);
    } catch (e) {
      console.error(`     [ERRO] ${e.message.slice(0, 100)}`);
      errors.push({ label: mod.label, error: e.message });
      results.push({ label: mod.label, file: null, url: null, status: 'error', grupo: 'Módulo de Avaliação', ordem: mod.ordem, error: e.message });
    }
  }

  await browser.close();

  // ─── FASE 5: Gerar relatório HTML ─────────────────────────────────────────
  console.log('\nGerando relatorio HTML...');
  const okResults = results.filter((r) => r.status === 'ok');
  const errResults = results.filter((r) => r.status === 'error');

  const thumbs = okResults.map((r) => `
    <div class="card">
      <div class="badge">${r.ordem !== undefined ? (r.ordem === 0 ? 'Overview' : `#${r.ordem}`) : 'Extra'}</div>
      <a href="${r.file}" target="_blank">
        <img src="${r.file}" alt="${r.label}" loading="lazy" />
      </a>
      <div class="card-body">
        <div class="card-label">${r.label}</div>
        <div class="card-grupo">${r.grupo || ''}</div>
        <div class="card-url"><code>${r.url || ''}</code></div>
      </div>
    </div>`).join('\n');

  const errHtml = errResults.length === 0 ? '' : `
    <section class="errors">
      <div class="section-title">Erros (${errResults.length})</div>
      <ul>${errResults.map((e) => `<li><strong>${e.label}</strong> &mdash; ${e.error}</li>`).join('\n')}</ul>
    </section>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LAINES — Mapa Visual de Avaliações</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:2.5rem 2rem}
    header{text-align:center;margin-bottom:3rem;padding-bottom:2rem;border-bottom:1px solid #1e293b}
    header h1{font-size:2.2rem;font-weight:800;color:#f8fafc;margin-bottom:.4rem}
    header p{color:#94a3b8;font-size:.95rem}
    .meta{display:flex;gap:1rem;justify-content:center;margin-top:1.2rem;flex-wrap:wrap}
    .meta-pill{background:#1e293b;border:1px solid #334155;padding:.35rem .9rem;border-radius:999px;font-size:.78rem;color:#94a3b8}
    .meta-pill b{color:#38bdf8}
    .section-title{font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#475569;margin:2.5rem 0 1.2rem;padding-left:.5rem;border-left:3px solid #38bdf8}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:1.5rem;max-width:1700px}
    .card{background:#1e293b;border:1px solid #334155;border-radius:14px;overflow:hidden;position:relative;transition:box-shadow .2s,transform .2s}
    .card:hover{transform:translateY(-4px);box-shadow:0 20px 60px rgba(0,0,0,.5)}
    .badge{position:absolute;top:10px;left:10px;z-index:1;background:rgba(15,23,42,.85);color:#38bdf8;font-weight:700;font-size:.68rem;padding:.18rem .55rem;border-radius:6px;border:1px solid rgba(56,189,248,.2);backdrop-filter:blur(4px)}
    .card>a{display:block}
    .card img{width:100%;height:220px;object-fit:cover;object-position:top center;border-bottom:1px solid #334155;display:block;transition:height .2s}
    .card:hover img{height:260px}
    .card-body{padding:.8rem 1rem 1rem}
    .card-label{font-weight:700;font-size:1rem;color:#f1f5f9;margin-bottom:.2rem}
    .card-grupo{font-size:.7rem;color:#38bdf8;font-weight:600;margin-bottom:.25rem}
    .card-url{font-size:.68rem;color:#475569}
    .card-url code{background:#0f172a;padding:.1rem .4rem;border-radius:4px}
    .errors{background:#1a0000;border:1px solid #7f1d1d;border-radius:12px;padding:1.5rem;max-width:1700px;margin:2rem 0}
    .errors .section-title{color:#f87171;border-left-color:#f87171}
    .errors ul{list-style:disc;padding-left:1.5rem}
    .errors li{padding:.35rem 0;color:#fca5a5;font-size:.9rem}
    .errors li strong{color:#f87171}
    footer{text-align:center;color:#334155;font-size:.78rem;margin-top:3rem;padding-top:2rem;border-top:1px solid #1e293b}
  </style>
</head>
<body>
  <header>
    <h1>LAINES — Mapa Visual de Avaliações</h1>
    <p>Screenshots capturados automaticamente via Playwright · Viewport 1440 × 900</p>
    <div class="meta">
      <div class="meta-pill">Gerado em <b>${new Date().toLocaleString('pt-BR')}</b></div>
      <div class="meta-pill">Telas: <b>${okResults.length}</b></div>
      <div class="meta-pill">Erros: <b>${errResults.length}</b></div>
      <div class="meta-pill">Módulos: <b>${EVALUATION_MODULES.length}</b></div>
    </div>
  </header>
  <div class="section-title">Todas as telas capturadas</div>
  <div class="grid">${thumbs}</div>
  ${errHtml}
  <footer>
    LAINES — Liga Acadêmica Interprofissional de Nutrição Esportiva<br/>
    Gerado por <code>playwright-avaliacao-map.cjs</code>
  </footer>
</body>
</html>`;

  fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'index.html'), html, 'utf8');
  console.log('  index.html gerado!');

  const line = '='.repeat(62);
  console.log(`\n${line}\n  RESUMO FINAL\n${line}`);
  console.log(`  OK     : ${okResults.length}`);
  console.log(`  Erros  : ${errResults.length}`);
  console.log(`  HTML   : ${path.join(SCREENSHOTS_DIR, 'index.html')}`);
  console.log('\n  Arquivos:');
  okResults.forEach((r) => console.log(`    [OK] ${r.file}`));
  if (errResults.length > 0) {
    console.log('\n  Erros:');
    errResults.forEach((e) => console.log(`    [!]  ${e.label}: ${String(e.error).slice(0, 80)}`));
  }
  console.log(`${line}\n`);
})();
