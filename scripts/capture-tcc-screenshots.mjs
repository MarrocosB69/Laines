/**
 * capture-tcc-screenshots.mjs
 *
 * Captura 8 screenshots do LAINES App para apresentação de TCC.
 * Usa exclusivamente dados fictícios dos fixtures E2E — nenhum dado real.
 *
 * Uso:
 *   node scripts/capture-tcc-screenshots.mjs
 *   SKIP_SERVER_START=1 node scripts/capture-tcc-screenshots.mjs   (servidores já ativos)
 *   SKIP_SEEDS=1 node scripts/capture-tcc-screenshots.mjs          (seeds já aplicados)
 *
 * Saída: ./screenshots-tcc/
 */

import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.resolve(ROOT, 'screenshots-tcc');

const FRONTEND_URL = 'http://127.0.0.1:4173';
const API_URL     = 'http://127.0.0.1:4000';

// Credenciais E2E — dados fictícios (seed-e2e-users.ts / seed-ci-analytics.js)
const E2E = {
  admin:     { email: 'e2e-admin@teste.com',  password: 'e2e-password' },
  professor: { email: 'e2e-prof@teste.com',   password: 'e2e-password' },
  aluno:     { email: 'e2e-aluno@teste.com',  password: 'e2e-password' },
  atleta:    { email: 'e2e-atleta@teste.com', password: 'e2e-password' },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log   = (...args) => console.log('[tcc-screenshots]', ...args);

// ── Utilitários ──────────────────────────────────────────────────────────────

const isServerReady = async (url, timeout = 60_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok || res.status < 500) return true;
    } catch { /* ainda não pronto */ }
    await sleep(1500);
  }
  return false;
};

const getPngDimensions = (filepath) => {
  try {
    const buf = fs.readFileSync(filepath);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } catch { return { width: 0, height: 0 }; }
};

// ── Servidores ───────────────────────────────────────────────────────────────

const runningServers = [];

const startServer = (label, cmd, args, cwd) => {
  log(`Iniciando ${label}…`);
  const proc = spawn(cmd, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  proc.stdout.on('data', (d) => {
    const line = d.toString().trim();
    if (line) log(`[${label}] ${line.slice(0, 140)}`);
  });
  proc.stderr.on('data', (d) => {
    const line = d.toString().trim();
    if (line) log(`[${label}:err] ${line.slice(0, 140)}`);
  });
  proc.on('exit', (code) => log(`[${label}] encerrou (código ${code})`));
  runningServers.push({ label, proc });
  return proc;
};

const stopServers = () => {
  for (const { label, proc } of runningServers) {
    try {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { shell: false });
      } else {
        process.kill(-proc.pid, 'SIGTERM');
      }
      log(`[${label}] encerrado`);
    } catch { /* ignorar */ }
  }
};

// ── Seeds ────────────────────────────────────────────────────────────────────

const runSeed = () => {
  log('Executando seed:e2e…');
  const r = spawnSync('npm', ['run', 'seed:e2e'], {
    cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (r.status !== 0) log('AVISO: seed:e2e retornou erro — continuando.');
};

const runAnalyticsSeed = () => {
  log('Executando seed-ci-analytics…');
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    E2E_STUDENT_EMAIL:    E2E.aluno.email,
    E2E_STUDENT_PASSWORD: E2E.aluno.password,
    E2E_PROFESSOR_EMAIL:    E2E.professor.email,
    E2E_PROFESSOR_PASSWORD: E2E.professor.password,
    E2E_TEAM_EMAIL:    'e2e-tecnico@teste.com',
    E2E_TEAM_PASSWORD: 'e2e-password',
    E2E_ATHLETE_EMAIL:    E2E.atleta.email,
    E2E_ATHLETE_PASSWORD: E2E.atleta.password,
    DOTENV_CONFIG_PATH: path.resolve(ROOT, 'server', '.env'),
  };
  const r = spawnSync(
    'node',
    ['-r', 'dotenv/config', path.resolve(ROOT, 'server', 'scripts', 'seed-ci-analytics.js')],
    { cwd: path.resolve(ROOT, 'server'), env, stdio: 'inherit', shell: process.platform === 'win32' },
  );
  if (r.status !== 0) log('AVISO: seed-ci-analytics retornou erro — continuando.');
};

// ── Helpers de navegação ─────────────────────────────────────────────────────

const waitStable = async (page, ms = 10_000) => {
  await page.waitForLoadState('networkidle', { timeout: ms }).catch(() => {});
};

const waitNoShimmer = async (page, timeout = 8_000) => {
  await page.waitForFunction(
    () => !document.querySelector('.prof-shimmer, [class*="shimmer"i], [class*="skeleton"i]'),
    { timeout },
  ).catch(() => {});
};

/**
 * Login via data-testid estáveis — não digita credenciais "na mão"
 * nos seletores; usa as referências testadas pelos scripts E2E existentes.
 */
const doLogin = async (page, email, password) => {
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector(
    '[data-testid="login-identifier"], input[autocomplete="username"]',
    { timeout: 25_000 },
  );
  await page.locator('[data-testid="login-identifier"], input[autocomplete="username"]').first().fill(email);
  await page.locator('[data-testid="login-password"], input[autocomplete="current-password"]').first().fill(password);
  await page.getByRole('button', { name: /entrar agora|entrando/i }).click();
};

const dismissModals = async (page) => {
  for (let i = 0; i < 8; i++) {
    const closeBtn = page.locator(
      '[aria-label="Fechar"], [aria-label="fechar"], button.app-modal-close, button[data-close]',
    ).first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click({ force: true });
      await sleep(500);
      continue;
    }
    const modal = page.locator(
      '.app-modal-shell, .athlete-wizard-grid, .ebia-modal-content, [role="dialog"]',
    ).first();
    if (await modal.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await sleep(500);
      continue;
    }
    break;
  }
  // Sinaliza para o app que o EBIA já foi dispensado nesta sessão
  await page.evaluate(() => {
    try { sessionStorage.setItem('laines_ebia_dismissed', '1'); } catch { /* ignore */ }
  }).catch(() => {});
};

const dismissProfileOverlay = async (page) => {
  const overlay = page.locator('.profile-completion-overlay, .profile-completion-modal').first();
  if (!await overlay.isVisible().catch(() => false)) return;
  log('  overlay de perfil — tentando preencher e dispensar…');
  const nameInput = overlay.locator('input').first();
  if (await nameInput.isVisible().catch(() => false)) {
    const val = await nameInput.inputValue().catch(() => '');
    if (!val) await nameInput.fill('Usuário E2E');
    await sleep(200);
  }
  const saveBtn = overlay.getByRole('button', { name: /salvar|confirmar|concluir/i }).first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await sleep(1000);
  }
};

/**
 * Recorta apenas o elemento da sidebar (sem o conteúdo principal).
 * Usa element.screenshot() que clipa naturalmente no bounding box.
 */
const clipSidebar = async (page, filepath) => {
  const candidates = [
    '.laines-sidebar',
    'aside[class*="sidebar"]',
    'nav[class*="sidebar"]',
    '[class*="athlete-sidebar"]',
    'aside',
  ];
  for (const sel of candidates) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await el.screenshot({ path: filepath });
      log(`  sidebar clipped (${sel})`);
      return;
    }
  }
  // Fallback: faixa esquerda de 300 px
  const vp = page.viewportSize();
  await page.screenshot({
    path: filepath,
    clip: { x: 0, y: 0, width: 300, height: vp?.height ?? 900 },
  });
  log('  sidebar fallback (faixa 300 px esquerda)');
};

// ── Capturas ─────────────────────────────────────────────────────────────────

/** 1. login.png — tela de login antes de preencher qualquer campo */
const captLogin = async (ctx, filepath) => {
  const page = await ctx.newPage();
  try {
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector(
      '[data-testid="login-identifier"], input[autocomplete="username"]',
      { timeout: 25_000 },
    );
    await waitStable(page, 6_000);
    await sleep(700);
    await page.screenshot({ path: filepath, fullPage: false });
  } finally { await page.close(); }
};

/** 2. lista-atletas.png — listagem de pacientes/atletas como Professor */
const captListaAtletas = async (ctx, filepath) => {
  const page = await ctx.newPage();
  try {
    await doLogin(page, E2E.professor.email, E2E.professor.password);
    await page.waitForURL(/\/professor/, { timeout: 30_000 });
    await dismissProfileOverlay(page);
    await waitStable(page);

    // Clica no item de pacientes da sidebar
    const patientsTab = page.locator('.laines-sidebar__item', {
      hasText: /Alunos.*Atletas|Pacientes|Atletas/i,
    }).first();
    await patientsTab.waitFor({ state: 'visible', timeout: 15_000 });
    await patientsTab.click();
    await sleep(800);

    // Se aparecer lista de alunos, clica no primeiro para ver os atletas daquele aluno
    const studentCard = page.locator(
      '.student-card, .student-list-item, [class*="student-card"]',
    ).first();
    if (await studentCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await studentCard.click();
      await sleep(800);
    }

    // Aguarda cards de pacientes / métricas aparecerem
    await page.waitForSelector(
      '.patient-card, .metric-item, [class*="patient-card"], .patient-grid',
      { state: 'visible', timeout: 20_000 },
    ).catch(() => {});

    await waitStable(page, 8_000);
    await waitNoShimmer(page);
    await sleep(600);
    await page.screenshot({ path: filepath, fullPage: false });
  } finally { await page.close(); }
};

/**
 * 3. modulo-antropometria.png — formulário de composição corporal aberto.
 *
 *    Estratégia:
 *    - Login como ALUNO (e2e-aluno@teste.com) — tem paciente vinculado pelo seed.
 *    - Navega via UI até o prontuário do paciente (sem page.goto → sem reload → auth mantido).
 *    - Clica em "Nova Avaliação" dentro do prontuário (React Router navigate → URL muda
 *      para /avaliacao/:patientId mantendo o token em memória).
 *    - Aguarda o formulário multi-tab carregar e captura.
 */
const captModuloAntropometria = async (ctx, filepath) => {
  const page = await ctx.newPage();
  try {
    await doLogin(page, E2E.aluno.email, E2E.aluno.password);
    await page.waitForURL(/\/aluno/, { timeout: 30_000 });
    await dismissModals(page);
    await dismissProfileOverlay(page);
    await waitStable(page, 8_000);
    await sleep(600);

    // Navega para o prontuário clicando no primeiro paciente visível
    // (o StudentView do aluno exibe sua lista de pacientes)
    const patientCard = page.locator(
      '.patient-card, .metric-item, [class*="patient-card"], .student-patient-card',
    ).first();

    if (await patientCard.isVisible({ timeout: 8_000 }).catch(() => false)) {
      log('  abrindo prontuário via patient-card…');
      await patientCard.click();
    } else {
      // Tenta via sidebar / aba de pacientes
      const patientsLink = page.locator(
        '.laines-sidebar__item, aside a, nav a',
        { hasText: /Pacientes|Atletas|Meus\s+atletas/i },
      ).first();
      if (await patientsLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await patientsLink.click();
        await sleep(800);
        const card = page.locator('.patient-card, .metric-item').first();
        await card.waitFor({ state: 'visible', timeout: 12_000 });
        await card.click();
      }
    }

    // Aguarda o prontuário renderizar (ainda em /aluno — SPA, sem reload)
    await page.waitForSelector(
      '.prontuario-header, [class*="prontuario-header"], .pron-header, [class*="pron-header"]',
      { state: 'visible', timeout: 25_000 },
    ).catch(() => {});
    await waitStable(page, 10_000);
    await sleep(800);

    // Clica em "Nova Avaliação" — usa React Router navigate(), não recarrega a página
    const novaBtn = page.getByRole('button', { name: /Nova\s+Avaliação/i }).first();
    if (await novaBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      log('  clicando "Nova Avaliação"…');
      await novaBtn.click();
    } else {
      // Tenta seletor CSS direto
      const cssBtn = page.locator('button.pron-btn-primary, button.pron-btn.pron-btn-primary').first();
      if (await cssBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        log('  clicando pron-btn-primary…');
        await cssBtn.click();
      } else {
        log('  AVISO: botão Nova Avaliação não encontrado — capturando prontuário.');
      }
    }

    // Aguarda URL mudar para /avaliacao/:id (React Router)
    await page.waitForURL(/\/avaliacao\//, { timeout: 20_000 }).catch(() => {});
    log(`  URL após clique: ${page.url()}`);

    // Aguarda os tabs/formulário de avaliação carregarem
    await page.waitForSelector(
      '.tab-btn, [class*="avaliacao-tab"], .avaliacao-content, [class*="avaliacao-form"]',
      { state: 'visible', timeout: 20_000 },
    ).catch(() => {});

    await waitStable(page, 12_000);
    await waitNoShimmer(page);
    await sleep(1000);

    // Tenta ativar tab de composição corporal se existir
    const tabTerms = [/Composição/i, /Dobras/i, /Bioimpedância/i, /Perímetros/i];
    for (const term of tabTerms) {
      const tab = page.locator('.tab-btn, [role="tab"]', { hasText: term }).first();
      if (await tab.isVisible({ timeout: 1_500 }).catch(() => false)) {
        log(`  ativando tab "${term.source}"…`);
        await tab.click();
        await sleep(900);
        break;
      }
    }

    await waitNoShimmer(page);
    await sleep(600);
    await page.screenshot({ path: filepath, fullPage: false });
  } finally { await page.close(); }
};

/** 4. relatorios-admin.png — seção de relatórios/analytics como Admin */
const captRelatoriosAdmin = async (ctx, filepath) => {
  const page = await ctx.newPage();
  try {
    await doLogin(page, E2E.admin.email, E2E.admin.password);
    await page.waitForURL(/\/admin/, { timeout: 30_000 });
    await dismissProfileOverlay(page);
    await waitStable(page, 8_000);
    await sleep(600);

    const relItem = page.locator('.laines-sidebar__item', {
      hasText: /Relatórios|Relatorios|Analytics|Indicadores/i,
    }).first();
    await relItem.waitFor({ state: 'visible', timeout: 15_000 });
    await relItem.click();

    await page.waitForSelector(
      '.reports-page, [class*="report"], .stat-card, [class*="stat-card"], [class*="analytics"], [class*="indicator"]',
      { state: 'visible', timeout: 20_000 },
    ).catch(() => sleep(3000));

    await waitStable(page, 12_000);
    await waitNoShimmer(page);
    await sleep(1200);
    await page.screenshot({ path: filepath, fullPage: false });
  } finally { await page.close(); }
};

/** 5. sidebar-admin.png — apenas a sidebar do perfil Administrador */
const captSidebarAdmin = async (ctx, filepath) => {
  const page = await ctx.newPage();
  try {
    await doLogin(page, E2E.admin.email, E2E.admin.password);
    await page.waitForURL(/\/admin/, { timeout: 30_000 });
    await dismissProfileOverlay(page);
    await waitStable(page, 8_000);
    await waitNoShimmer(page);
    await sleep(900);
    await clipSidebar(page, filepath);
  } finally { await page.close(); }
};

/** 6. sidebar-professor.png — apenas a sidebar do perfil Professor */
const captSidebarProfessor = async (ctx, filepath) => {
  const page = await ctx.newPage();
  try {
    await doLogin(page, E2E.professor.email, E2E.professor.password);
    await page.waitForURL(/\/professor/, { timeout: 30_000 });
    await dismissProfileOverlay(page);
    await waitStable(page, 8_000);
    await waitNoShimmer(page);
    await sleep(900);
    await clipSidebar(page, filepath);
  } finally { await page.close(); }
};

/** 7. sidebar-aluno.png — apenas a sidebar do perfil Aluno/Membro da liga */
const captSidebarAluno = async (ctx, filepath) => {
  const page = await ctx.newPage();
  try {
    await doLogin(page, E2E.aluno.email, E2E.aluno.password);
    await page.waitForURL(/\/aluno/, { timeout: 30_000 });
    await dismissModals(page);
    await dismissProfileOverlay(page);
    await waitStable(page, 8_000);
    await waitNoShimmer(page);
    await sleep(900);
    await clipSidebar(page, filepath);
  } finally { await page.close(); }
};

/** 8. sidebar-atleta.png — apenas a sidebar do perfil Atleta */
const captSidebarAtleta = async (ctx, filepath) => {
  const page = await ctx.newPage();
  try {
    await doLogin(page, E2E.atleta.email, E2E.atleta.password);
    await page.waitForURL(/\/atleta/, { timeout: 30_000 });
    await dismissModals(page);
    await dismissProfileOverlay(page);
    await waitStable(page, 8_000);
    await waitNoShimmer(page);
    await sleep(900);
    await clipSidebar(page, filepath);
  } finally { await page.close(); }
};

// ── Main ─────────────────────────────────────────────────────────────────────

const main = async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const skipStart = /^(1|true)$/i.test(String(process.env.SKIP_SERVER_START || ''));
  const skipSeeds = /^(1|true)$/i.test(String(process.env.SKIP_SEEDS || ''));

  // 1. Verificar / iniciar servidores
  const apiReady = await isServerReady(`${API_URL}/health`, 3_000);
  const feReady  = await isServerReady(FRONTEND_URL, 3_000);

  if (!apiReady && !skipStart) {
    startServer('api', 'npm', ['--prefix', 'server', 'run', 'start'], ROOT);
  } else if (apiReady) {
    log('API já está rodando.');
  }

  if (!feReady && !skipStart) {
    startServer('preview', 'npm', ['run', 'preview', '--', '--host', '127.0.0.1'], ROOT);
  } else if (feReady) {
    log('Frontend já está rodando.');
  }

  if (!apiReady) {
    log('Aguardando API ficar pronta…');
    if (!await isServerReady(`${API_URL}/health`, 90_000)) {
      log('ERRO: API não ficou pronta em 90 s.'); stopServers(); process.exit(1);
    }
  }
  if (!feReady) {
    log('Aguardando frontend ficar pronto…');
    if (!await isServerReady(FRONTEND_URL, 60_000)) {
      log('ERRO: Frontend não ficou pronto em 60 s.'); stopServers(); process.exit(1);
    }
  }

  log('Servidores prontos.');

  // 2. Seeds (podem ser pulados com SKIP_SEEDS=1)
  if (!skipSeeds) {
    runSeed();
    runAnalyticsSeed();
  } else {
    log('Seeds pulados (SKIP_SEEDS=1).');
  }

  // 3. Playwright — 1440×900 @2x (retina)
  log('\nIniciando capturas (viewport 1440×900, deviceScaleFactor 2)…');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport:         { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale:           'pt-BR',
    timezoneId:       'America/Fortaleza',
  });

  const out = (name) => path.join(OUTPUT_DIR, name);

  const capturas = [
    { name: 'login.png',                fn: captLogin            },
    { name: 'lista-atletas.png',         fn: captListaAtletas     },
    { name: 'modulo-antropometria.png',  fn: captModuloAntropometria },
    { name: 'relatorios-admin.png',      fn: captRelatoriosAdmin  },
    { name: 'sidebar-admin.png',         fn: captSidebarAdmin     },
    { name: 'sidebar-professor.png',     fn: captSidebarProfessor },
    { name: 'sidebar-aluno.png',         fn: captSidebarAluno     },
    { name: 'sidebar-atleta.png',        fn: captSidebarAtleta    },
  ];

  const results = [];

  for (const { name, fn } of capturas) {
    log(`\n→ ${name}…`);
    try {
      await fn(ctx, out(name));
      results.push({ name, ok: true });
      log(`  ✓ salvo`);
    } catch (err) {
      log(`  ✗ ERRO: ${err.message}`);
      results.push({ name, ok: false, err: err.message });
    }
  }

  await ctx.close();
  await browser.close();

  // 4. Sumário
  log('\n══════════════════════════════════════');
  log('RESULTADO FINAL');
  log('══════════════════════════════════════');
  for (const r of results) {
    const fp = out(r.name);
    if (r.ok && fs.existsSync(fp)) {
      const { width, height } = getPngDimensions(fp);
      const kb = (fs.statSync(fp).size / 1024).toFixed(0);
      log(`  ✓  ${r.name.padEnd(30)}  ${width}×${height}px  ${kb} KB`);
    } else {
      log(`  ✗  ${r.name.padEnd(30)}  ${r.err || 'arquivo não gerado'}`);
    }
  }

  log(`\nPasta: ${OUTPUT_DIR}`);
  log('Dados: exclusivamente fictícios (seed E2E — e2e-admin@teste.com, e2e-prof@teste.com, e2e-aluno@teste.com, e2e-atleta@teste.com).');

  if (runningServers.length > 0) {
    log('\nEncerrando servidores iniciados pelo script…');
    stopServers();
  }
};

main().catch((err) => {
  console.error('[tcc-screenshots] Erro fatal:', err.message ?? err);
  stopServers();
  process.exit(1);
});
