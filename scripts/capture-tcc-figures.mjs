/**
 * Captura screenshots do LAINES App para o TCC.
 * Usa apenas dados fictícios dos fixtures E2E — nenhum dado real.
 *
 * Uso:
 *   node scripts/capture-tcc-figures.mjs
 *
 * Pré-requisitos:
 *   - API rodando em http://localhost:4000
 *   - Frontend preview em http://127.0.0.1:4173
 *   OU defina SKIP_SERVER_START=1 para usar servidores já ativos.
 *
 * Saída: ./tcc-figuras/figura*.png
 */

import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.resolve(ROOT, 'tcc-figuras');

const FRONTEND_URL = 'http://127.0.0.1:4173';
const API_URL = 'http://127.0.0.1:4000';

const PROF_EMAIL = 'e2e-prof@teste.com';
const PROF_PASSWORD = 'e2e-password';
const ADMIN_EMAIL = 'e2e-admin@teste.com';
const ADMIN_PASSWORD = 'e2e-password';
const ATLETA_EMAIL = 'e2e-atleta@teste.com';
const ATLETA_PASSWORD = 'e2e-password';

// Patient IDs criados pelo seed-ci-analytics — fixtures fixos
const LINKED_PATIENT_ID = '21111111-1111-4111-8111-111111111111';

/* ─── Utilitários ─────────────────────────────────────────── */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const log = (...args) => console.log('[tcc-capture]', ...args);

const isServerReady = async (url, timeout = 60_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok || res.status < 500) return true;
    } catch {
      // ainda não pronto
    }
    await sleep(1500);
  }
  return false;
};

const loginApi = async (email, password) => {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error(`Login API falhou: ${res.status}`);
  const body = await res.json();
  return body.accessToken || body.token;
};

const patchPaciente = async (id, data, token) => {
  const res = await fetch(`${API_URL}/pacientes/${id}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PATCH /pacientes/${id} falhou: ${res.status} — ${body}`);
  }
  return res.json();
};

/* ─── Gerenciamento de servidores ─────────────────────────── */

const runningServers = [];

const startServer = (label, cmd, args, cwd) => {
  log(`Iniciando ${label}…`);
  const proc = spawn(cmd, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    windowsHide: true
  });
  proc.stdout.on('data', (d) => {
    const line = d.toString().trim();
    if (line) log(`[${label}] ${line.slice(0, 120)}`);
  });
  proc.stderr.on('data', (d) => {
    const line = d.toString().trim();
    if (line) log(`[${label}:err] ${line.slice(0, 120)}`);
  });
  proc.on('exit', (code) => log(`[${label}] encerrou com código ${code}`));
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
    } catch {
      // ignorar erro de encerramento
    }
  }
};

/* ─── Fluxo de login no browser ──────────────────────────── */

const doLogin = async (page, email, password) => {
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('[data-testid="login-identifier"]', { timeout: 20_000 });

  const identifier = page.locator('[data-testid="login-identifier"], input[autocomplete="username"]').first();
  const passwordInput = page.locator('[data-testid="login-password"], input[autocomplete="current-password"]').first();

  await identifier.fill(email);
  await passwordInput.fill(password);
  await page.getByRole('button', { name: /entrar agora|entrando/i }).click();
};

const dismissOverlayIfPresent = async (page) => {
  const overlay = page.locator('.profile-completion-overlay');
  const visible = await overlay.isVisible().catch(() => false);
  if (visible) {
    // Tenta fechar pelo botão X (sair da sessão) — não é o que queremos para o screenshot
    // Se aparecer, indica que o perfil está incompleto; tentar ignorar clicando no fundo
    log('AVISO: overlay de perfil detectado. Tentando dispensar…');
    // O overlay não tem botão de dispensar sem sair — vamos checar se há um campo obrigatório vazio
    // e preencher o nome se necessário
    const nameInput = overlay.locator('input').first();
    if (await nameInput.isVisible().catch(() => false)) {
      const val = await nameInput.inputValue().catch(() => '');
      if (!val) {
        await nameInput.fill('Usuário E2E');
        await sleep(300);
      }
    }
    const saveBtn = overlay.getByRole('button', { name: /salvar|confirmar|concluir/i }).first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await sleep(1000);
    }
  }
};

/* ─── Helpers de navegação ────────────────────────────────── */

const waitForNetworkStable = async (page, timeout = 10_000) => {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {
    // networkidle pode não chegar em apps com polling — apenas aguardamos o timeout
  });
};

/* ─── Captura 1: Prontuário (professor) ───────────────────── */

const capturaProntuario = async (context, filename) => {
  const page = await context.newPage();
  try {
    log('Captura 1: login como professor…');
    await doLogin(page, PROF_EMAIL, PROF_PASSWORD);

    // Aguarda redirecionamento para /professor
    await page.waitForURL(/\/professor/, { timeout: 30_000 });
    await dismissOverlayIfPresent(page);
    await waitForNetworkStable(page);

    // Clica em "Alunos e Atletas" na sidebar
    log('Navegando para aba de pacientes…');
    const patientsTab = page.locator('.laines-sidebar__item', { hasText: 'Alunos e Atletas' });
    await patientsTab.waitFor({ state: 'visible', timeout: 15_000 });
    await patientsTab.click();
    await sleep(800);

    // Aguarda a lista de alunos carregar
    await page.waitForSelector('.student-list', { state: 'visible', timeout: 20_000 });
    await sleep(500);

    // Clica no primeiro aluno que aparecer
    const firstStudent = page.locator('.student-card').first();
    await firstStudent.waitFor({ state: 'visible', timeout: 15_000 });
    await firstStudent.click();
    await sleep(600);

    // Aguarda o grid de pacientes
    await page.waitForSelector('.patient-grid, .patient-card', { state: 'visible', timeout: 20_000 });
    await sleep(400);

    // Clica no primeiro paciente (preferencialmente o fixture PRT-CI-001)
    let patientClicked = false;
    const prtCard = page.locator('.patient-card', { hasText: 'Paciente CI' });
    if (await prtCard.first().isVisible().catch(() => false)) {
      await prtCard.first().click();
      patientClicked = true;
    } else {
      const anyCard = page.locator('.patient-card').first();
      if (await anyCard.isVisible().catch(() => false)) {
        await anyCard.click();
        patientClicked = true;
      }
    }

    if (!patientClicked) {
      // Fallback: tentar pelo dashboard (stat card)
      log('Nenhum patient-card visível. Tentando via stat card no dashboard…');
      await page.locator('.laines-sidebar__item', { hasText: 'Visão Geral' }).click();
      await sleep(600);
      await page.locator('.stat-card-action', { hasText: 'Atletas supervisionados' }).first().click();
      await sleep(600);
      const metricItem = page.locator('.metric-item').first();
      await metricItem.waitFor({ state: 'visible', timeout: 15_000 });
      await metricItem.click();
    }

    // Aguarda o prontuário abrir
    await page.waitForSelector('.prontuario-header, [class*="prontuario"]', { state: 'visible', timeout: 30_000 });
    await waitForNetworkStable(page, 12_000);
    await sleep(1200);

    // Garante que as abas principais estão visíveis antes do screenshot
    const tabs = page.locator('.prontuario-tabs, [class*="tab"]');
    await tabs.first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});

    log(`Salvando ${filename}…`);
    await page.screenshot({ path: filename, fullPage: false });
    log(`Salvo: ${filename}`);
  } finally {
    await page.close();
  }
};

/* ─── Captura 2: Portal do atleta ─────────────────────────── */

const capturaAtleta = async (context, filename) => {
  const page = await context.newPage();
  try {
    log('Captura 2: login como atleta…');
    await doLogin(page, ATLETA_EMAIL, ATLETA_PASSWORD);
    await page.waitForURL(/\/atleta/, { timeout: 30_000 });
    await dismissOverlayIfPresent(page);

    // Fechar quaisquer modais que abram automaticamente (EBIA, onboarding, etc.)
    await sleep(1500);
    for (let attempt = 0; attempt < 5; attempt++) {
      // Tentar fechar via botão X / aria-label="Fechar"
      const closeBtn = page.locator(
        '[aria-label="Fechar"], [aria-label="fechar"], button.app-modal-close, button[data-close]'
      ).first();
      const isClose = await closeBtn.isVisible().catch(() => false);
      if (isClose) {
        await closeBtn.click({ force: true });
        await sleep(600);
        continue;
      }
      // Tentar fechar via Escape
      const anyModal = page.locator('.app-modal-shell, .athlete-wizard-grid, .ebia-modal-content');
      if (await anyModal.first().isVisible().catch(() => false)) {
        await page.keyboard.press('Escape');
        await sleep(600);
        continue;
      }
      break; // nenhum modal visível
    }
    // Armazenar flag de dispensa do EBIA no sessionStorage para evitar reabertura
    await page.evaluate(() => {
      sessionStorage.setItem('laines_ebia_dismissed', '1');
    }).catch(() => {});

    await waitForNetworkStable(page, 12_000);
    await sleep(800);

    // Fechar sidebar mobile se estiver aberta (usar JS click pois nav intercepta pointer events)
    const sidebarOverlayExists = await page.locator('button.sidebar-overlay').count().catch(() => 0);
    if (sidebarOverlayExists > 0) {
      await page.evaluate(() => {
        const overlay = document.querySelector('button.sidebar-overlay');
        if (overlay) overlay.click();
      });
      await sleep(600);
    }

    await sleep(500);
    log(`Salvando ${filename}…`);
    await page.screenshot({ path: filename, fullPage: false });
    log(`Salvo: ${filename}`);
  } finally {
    await page.close();
  }
};

/* ─── Captura 3: Página de Relatórios (admin) ─────────────── */

const capturaRelatorios = async (context, filename) => {
  const page = await context.newPage();
  try {
    log('Captura 3: login como admin…');
    await doLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.waitForURL(/\/admin/, { timeout: 30_000 });
    await dismissOverlayIfPresent(page);
    await waitForNetworkStable(page, 8_000);
    await sleep(600);

    // Clica em "Relatórios" na sidebar do admin
    log('Navegando para Relatórios…');
    const reportsItem = page.locator('.laines-sidebar__item', { hasText: 'Relatórios' });
    await reportsItem.waitFor({ state: 'visible', timeout: 15_000 });
    await reportsItem.click();

    // Aguarda o conteúdo dos relatórios carregar
    await page.waitForSelector('.reports-page, [class*="reports"]', { state: 'visible', timeout: 20_000 })
      .catch(() => sleep(3000));
    await waitForNetworkStable(page, 12_000);
    await sleep(1500);

    // Aguarda StatCards ou indicadores ficarem visíveis
    await page.waitForSelector('.stat-card, [class*="stat"]', { state: 'visible', timeout: 10_000 })
      .catch(() => {});
    await sleep(800);

    log(`Salvando ${filename}…`);
    await page.screenshot({ path: filename, fullPage: false });
    log(`Salvo: ${filename}`);
  } finally {
    await page.close();
  }
};

/* ─── Preparação do paciente do atleta via API ────────────── */

const prepareAthletePatient = async () => {
  log('Preparando confirmacaoAtleta via API (todos os pacientes do atleta)…');
  let adminToken;
  try {
    adminToken = await loginApi(ADMIN_EMAIL, ADMIN_PASSWORD);
  } catch (e) {
    log(`AVISO: login admin falhou (${e.message}). Pulando preparo.`);
    return;
  }

  // Buscar todos os pacientes com o atletaUserId do atleta E2E
  const atletaId = await (async () => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: ATLETA_EMAIL, password: ATLETA_PASSWORD })
    });
    const body = await res.json();
    // Decode JWT para pegar o sub/id
    const payload = JSON.parse(Buffer.from(body.accessToken.split('.')[1], 'base64url').toString());
    return payload.sub;
  })().catch((e) => {
    log(`AVISO: não foi possível obter ID do atleta: ${e.message}`);
    return null;
  });

  if (!atletaId) return;
  log(`Atleta ID: ${atletaId}`);

  // Buscar todos os pacientes (como admin)
  let allPatients = [];
  try {
    const res = await fetch(`${API_URL}/pacientes`, {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    allPatients = await res.json();
  } catch (e) {
    log(`AVISO: falha ao listar pacientes: ${e.message}`);
    return;
  }

  const athletePatients = Array.isArray(allPatients)
    ? allPatients.filter((p) => p.atletaUserId === atletaId || p.id === LINKED_PATIENT_ID)
    : [{ id: LINKED_PATIENT_ID }];

  log(`${athletePatients.length} paciente(s) vinculado(s) ao atleta — aplicando confirmacaoAtleta…`);

  const now = new Date().toISOString();
  const confirmacaoAtleta = {
    completed: true,
    completadoEm: now,
    submittedAt: now,
    versao: '1.0',
    dados: {
      nomeCompleto: 'Atleta E2E',
      dataNascimento: '1995-06-15',
      genero: 'masculino',
      modalidadePrincipal: 'Atletismo',
      objetivo: 'Performance'
    },
    ebiaSelfForm: {
      enabled: true,
      releaseId: 'ebia-tcc-fixture',
      releasedAt: now,
      releasedById: adminToken.slice(0, 8),
      releasedByName: 'Admin E2E',
      consumedAt: null,
      consumedByAvaliacaoId: null
    },
    formulariosLiberados: {
      hidratacao: {
        enabled: true,
        releasedAt: now,
        releasedById: adminToken.slice(0, 8),
        releasedByName: 'Admin E2E'
      }
    }
  };

  for (const patient of athletePatients) {
    try {
      await patchPaciente(patient.id, { confirmacaoAtleta }, adminToken);
      log(`  PATCH OK: ${patient.id} (${patient.nome || '?'})`);
    } catch (e) {
      log(`  AVISO PATCH falhou (${patient.id}): ${e.message}`);
    }
  }
};

/* ─── Seed ────────────────────────────────────────────────── */

const runSeed = () => {
  log('Executando seed:e2e…');
  const result = spawnSync('npm', ['run', 'seed:e2e'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) {
    log('AVISO: seed:e2e retornou erro — continuando mesmo assim.');
  }
};

const runAnalyticsSeed = () => {
  log('Executando seed-ci-analytics com usuários E2E…');
  const env = {
    ...process.env,
    NODE_ENV: 'development',
    E2E_STUDENT_EMAIL: 'e2e-aluno@teste.com',
    E2E_STUDENT_PASSWORD: 'e2e-password',
    E2E_PROFESSOR_EMAIL: 'e2e-prof@teste.com',
    E2E_PROFESSOR_PASSWORD: 'e2e-password',
    E2E_TEAM_EMAIL: 'e2e-tecnico@teste.com',
    E2E_TEAM_PASSWORD: 'e2e-password',
    E2E_ATHLETE_EMAIL: 'e2e-atleta@teste.com',
    E2E_ATHLETE_PASSWORD: 'e2e-password',
    DOTENV_CONFIG_PATH: path.resolve(ROOT, 'server', '.env')
  };
  const result = spawnSync(
    'node',
    ['-r', 'dotenv/config', path.resolve(ROOT, 'server', 'scripts', 'seed-ci-analytics.js')],
    {
      cwd: path.resolve(ROOT, 'server'),
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    }
  );
  if (result.status !== 0) {
    log('AVISO: seed-ci-analytics retornou erro — continuando mesmo assim.');
  }
};

/* ─── Obtenção das dimensões do arquivo PNG ───────────────── */

const getPngDimensions = (filepath) => {
  try {
    const buf = fs.readFileSync(filepath);
    // Bytes 16-20: largura, 20-24: altura (big-endian)
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return { width, height };
  } catch {
    return { width: 0, height: 0 };
  }
};

/* ─── Main ────────────────────────────────────────────────── */

const main = async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const skipServerStart = /^(1|true)$/i.test(String(process.env.SKIP_SERVER_START || ''));

  // 1. Verificar se servidores já estão ativos
  const apiReady = await isServerReady(`${API_URL}/health`, 3000);
  const frontendReady = await isServerReady(FRONTEND_URL, 3000);

  // 2. Subir servidores que estiverem faltando
  if (!apiReady && !skipServerStart) {
    startServer('api', 'npm', ['--prefix', 'server', 'run', 'start'], ROOT);
  } else if (apiReady) {
    log('API já está rodando.');
  }

  if (!frontendReady && !skipServerStart) {
    startServer('preview', 'npm', ['run', 'preview', '--', '--host', '127.0.0.1'], ROOT);
  } else if (frontendReady) {
    log('Frontend preview já está rodando.');
  }

  // 3. Aguardar servidores ficarem prontos
  if (!apiReady) {
    log('Aguardando API ficar pronta…');
    const ok = await isServerReady(`${API_URL}/health`, 90_000);
    if (!ok) {
      log('ERRO: API não ficou pronta em 90 s. Encerrando.');
      stopServers();
      process.exit(1);
    }
  }

  if (!frontendReady) {
    log('Aguardando frontend ficar pronto…');
    const ok = await isServerReady(FRONTEND_URL, 60_000);
    if (!ok) {
      log('ERRO: Frontend não ficou pronto em 60 s. Encerrando.');
      stopServers();
      process.exit(1);
    }
  }

  log('Ambos os servidores estão prontos.');

  // 4. Seeds (pode ser pulado com SKIP_SEEDS=1)
  const skipSeeds = /^(1|true)$/i.test(String(process.env.SKIP_SEEDS || ''));
  if (!skipSeeds) {
    runSeed();
    runAnalyticsSeed();
  } else {
    log('Seeds pulados (SKIP_SEEDS=1).');
  }

  // 5. Preparar paciente do atleta
  await prepareAthletePatient();

  // 6. Playwright — Desktop 1440×900 @2x
  log('Iniciando capturas desktop (1440×900 @2x)…');
  const browser = await chromium.launch({ headless: true });

  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: 'pt-BR',
    timezoneId: 'America/Fortaleza'
  });

  const figuras = [];

  await capturaProntuario(desktopCtx, path.join(OUTPUT_DIR, 'figura1-prontuario.png'));
  figuras.push('figura1-prontuario.png');

  await capturaAtleta(desktopCtx, path.join(OUTPUT_DIR, 'figura2-portal-atleta.png'));
  figuras.push('figura2-portal-atleta.png');

  await capturaRelatorios(desktopCtx, path.join(OUTPUT_DIR, 'figura3-relatorios.png'));
  figuras.push('figura3-relatorios.png');

  await desktopCtx.close();

  // 7. Extra: mobile 390×844 @3x
  log('Captura extra mobile (390×844 @3x)…');
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    locale: 'pt-BR',
    timezoneId: 'America/Fortaleza',
    isMobile: true
  });

  await capturaAtleta(mobileCtx, path.join(OUTPUT_DIR, 'figura-extra-mobile.png'));
  figuras.push('figura-extra-mobile.png');

  await mobileCtx.close();
  await browser.close();

  // 8. Resumo
  log('\n=== Capturas concluídas ===');
  for (const fig of figuras) {
    const filepath = path.join(OUTPUT_DIR, fig);
    const { width, height } = getPngDimensions(filepath);
    const sizeMB = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
    log(`  ${fig}: ${width}×${height} px  (${sizeMB} MB)`);
  }
  log(`\nArquivos em: ${OUTPUT_DIR}`);

  // 9. Encerrar servidores que iniciamos
  if (runningServers.length > 0) {
    log('Encerrando servidores…');
    stopServers();
  }

  log('Pronto!');
};

main().catch((err) => {
  console.error('[tcc-capture] Erro fatal:', err.message || err);
  stopServers();
  process.exit(1);
});
