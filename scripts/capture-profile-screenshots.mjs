import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = String(process.env.PROFILE_SCREENSHOT_BASE_URL || 'http://10.3.227.82').replace(/\/+$/, '');
const PASSWORD = process.env.PRINT_SCREENSHOT_PASSWORD || 'PrintsLAINES#2026';
const RUN_ID = process.env.PROFILE_SCREENSHOT_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');
const OUT_DIR = path.resolve(process.cwd(), 'e2e-artifacts', 'profile-screenshots', RUN_ID);
const HEADLESS = !/^(0|false|no)$/i.test(String(process.env.PROFILE_SCREENSHOT_HEADLESS || 'true'));

const profiles = [
  { key: 'admin', role: 'admin', email: 'print.admin@laines.ufrn.br', expectedPath: '/admin' },
  { key: 'coordenacao', role: 'coordenacao', email: 'print.coordenacao@laines.ufrn.br', expectedPath: '/admin' },
  { key: 'presidente', role: 'presidente', email: 'print.presidente@laines.ufrn.br', expectedPath: '/admin' },
  { key: 'vice', role: 'vice', email: 'print.vice@laines.ufrn.br', expectedPath: '/admin' },
  { key: 'diretoria-marketing', role: 'diretoria_marketing', email: 'print.marketing@laines.ufrn.br', expectedPath: '/admin' },
  { key: 'diretoria-ensino', role: 'diretoria_ensino', email: 'print.ensino@laines.ufrn.br', expectedPath: '/admin' },
  { key: 'diretoria-pesquisa', role: 'diretoria_pesquisa', email: 'print.pesquisa@laines.ufrn.br', expectedPath: '/admin' },
  { key: 'diretoria-extensao', role: 'diretoria_extensao', email: 'print.extensao@laines.ufrn.br', expectedPath: '/admin' },
  { key: 'coord-atendimento', role: 'coord_atendimento', email: 'print.atendimento@laines.ufrn.br', expectedPath: '/admin' },
  { key: 'professor', role: 'professor', email: 'print.professor@laines.ufrn.br', expectedPath: '/professor' },
  { key: 'profissional', role: 'profissional', email: 'print.profissional@laines.ufrn.br', expectedPath: '/professor' },
  { key: 'pesquisador', role: 'pesquisador', email: 'print.pesquisador@laines.ufrn.br', expectedPath: '/professor' },
  { key: 'colaborador', role: 'colaborador', email: 'print.colaborador@laines.ufrn.br', expectedPath: '/professor' },
  { key: 'tecnico', role: 'tecnico', email: 'print.tecnico@laines.ufrn.br', expectedPath: '/equipe' },
  { key: 'aluno', role: 'aluno', email: 'print.aluno@laines.ufrn.br', expectedPath: '/aluno' },
  { key: 'atleta', role: 'atleta', email: 'print.atleta@laines.ufrn.br', expectedPath: '/atleta' }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const normalizeForMatch = (value) => normalizeText(value)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const slug = (value) => normalizeForMatch(value)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || 'tela';

const unique = (items) => Array.from(new Set(items.filter(Boolean)));

const safeVisible = async (locator) => {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
};

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const writeIndex = async (entries) => {
  const lines = [
    '# Capturas por perfil',
    '',
    `Base URL: ${BASE_URL}`,
    `Gerado em: ${new Date().toISOString()}`,
    '',
    '| Perfil | Tela | Arquivo |',
    '| --- | --- | --- |',
    ...entries.map((entry) => `| ${entry.profile} | ${entry.label} | ${entry.relativePath} |`),
    ''
  ];
  await fs.writeFile(path.join(OUT_DIR, 'index.md'), lines.join('\n'), 'utf8');
};

const createCapture = (page, profile, entries) => {
  let count = 0;
  return async (label) => {
    count += 1;
    const profileDir = path.join(OUT_DIR, profile.key);
    await ensureDir(profileDir);
    const fileName = `${String(count).padStart(2, '0')}-${slug(label)}.png`;
    const absolutePath = path.join(profileDir, fileName);
    await page.screenshot({ path: absolutePath, fullPage: true });
    const relativePath = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
    entries.push({
      profile: profile.key,
      label,
      relativePath
    });
    console.log(`[screenshot] ${relativePath}`);
  };
};

const fillFields = async (page, seedLabel) => {
  const textValue = `Print ${seedLabel}`;

  const inputs = page.locator('input:not([type="hidden"]):not([disabled]):not([readonly])');
  const inputCount = await inputs.count();
  for (let index = 0; index < inputCount; index += 1) {
    const input = inputs.nth(index);
    if (!(await safeVisible(input))) continue;
    const type = String(await input.getAttribute('type') || 'text').toLowerCase();
    const name = normalizeForMatch(await input.getAttribute('name') || '');
    const placeholder = normalizeForMatch(await input.getAttribute('placeholder') || '');
    const currentValue = await input.inputValue().catch(() => '');
    if (currentValue && type !== 'checkbox' && type !== 'radio') continue;

    if (type === 'checkbox') {
      await input.check().catch(() => undefined);
      continue;
    }
    if (type === 'radio') {
      await input.check().catch(() => undefined);
      continue;
    }
    if (type === 'email' || name.includes('email') || placeholder.includes('email')) {
      await input.fill(`print.${slug(seedLabel)}@laines.ufrn.br`).catch(() => undefined);
      continue;
    }
    if (type === 'tel' || name.includes('telefone') || placeholder.includes('telefone')) {
      await input.fill('(84) 99999-0000').catch(() => undefined);
      continue;
    }
    if (type === 'date' || name.includes('data')) {
      await input.fill('2026-05-26').catch(() => undefined);
      continue;
    }
    if (type === 'number' || name.includes('cpf') || placeholder.includes('cpf')) {
      await input.fill(name.includes('cpf') || placeholder.includes('cpf') ? '99999999999' : '1').catch(() => undefined);
      continue;
    }
    if (type === 'password') {
      await input.fill('PrintsLAINES#2026').catch(() => undefined);
      continue;
    }
    await input.fill(textValue).catch(() => undefined);
  }

  const textareas = page.locator('textarea:not([disabled]):not([readonly])');
  const textareaCount = await textareas.count();
  for (let index = 0; index < textareaCount; index += 1) {
    const textarea = textareas.nth(index);
    if (await safeVisible(textarea)) {
      await textarea.fill(`Conteudo temporario para print: ${seedLabel}.`).catch(() => undefined);
    }
  }

  const selects = page.locator('select:not([disabled])');
  const selectCount = await selects.count();
  for (let index = 0; index < selectCount; index += 1) {
    const select = selects.nth(index);
    if (!(await safeVisible(select))) continue;
    const values = await select.locator('option').evaluateAll((options) => (
      options.map((option) => option.value).filter(Boolean)
    )).catch(() => []);
    if (values.length > 0) {
      await select.selectOption(values[0]).catch(() => undefined);
    }
  }
};

const closeModal = async (page) => {
  await page.keyboard.press('Escape').catch(() => undefined);
  await sleep(250);

  const closeCandidates = [
    'button[aria-label*="Fechar"]',
    'button[title*="Fechar"]',
    '.modal button.close',
    '.app-modal button.close',
    'button.modal-close',
    'button.close-button',
    'button:has-text("Cancelar")',
    'button:has-text("Fechar")',
    'button:has-text("Voltar")',
    '.modal button:has-text("x")',
    '.app-modal button:has-text("x")'
  ];

  for (const selector of closeCandidates) {
    const button = page.locator(selector).first();
    if (await safeVisible(button)) {
      await button.click({ force: true }).catch(() => undefined);
      await sleep(350);
      return;
    }
  }
};

const hasVisibleDialog = async (page) => {
  const dialog = page.locator('[role="dialog"], .modal, .app-modal, .profile-completion-modal, .password-modal, .modal-overlay').first();
  return safeVisible(dialog);
};

const resolveProfileCompletion = async (page, capture, profile) => {
  const modal = page.locator('.profile-completion-modal, .profile-completion-overlay').first();
  if (!(await safeVisible(modal))) return;

  await fillFields(page, `${profile.key}-perfil`);
  await capture('modal-completar-cadastro-preenchido');

  const submit = page.locator('.profile-completion-modal button:has-text("Salvar"), .profile-completion-modal button:has-text("Continuar"), .profile-completion-modal button:has-text("Concluir")').first();
  if (await safeVisible(submit)) {
    await submit.click().catch(() => undefined);
    await sleep(1200);
  }
};

const login = async (page, profile, capture) => {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator([
    'input[name="email"]',
    'input[type="email"]',
    'input[placeholder*="usuario" i]',
    'input[placeholder*="e-mail" i]',
    'input[placeholder*="CPF" i]'
  ].join(', ')).first().fill(profile.email);
  await page.locator([
    'input[autocomplete="current-password"]',
    'input[name="password"]',
    'input[type="password"]',
    'input[placeholder*="senha" i]'
  ].join(', ')).first().fill(PASSWORD);
  await capture('login-preenchido');
  await page.getByRole('button', { name: /entrar agora|entrando|entrar/i }).click();
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  await page.waitForURL((url) => url.pathname.startsWith(profile.expectedPath), { timeout: 45_000 }).catch(() => undefined);
  await page.waitForFunction(() => (document.body?.innerText || '').trim().length > 80, null, { timeout: 15_000 }).catch(() => undefined);
  await sleep(2500);
  await resolveProfileCompletion(page, capture, profile);
};

const sidebarLabels = async (page) => {
  const labels = await page.locator('.laines-sidebar__nav .laines-sidebar__item, .laines-sidebar__item, aside a, aside button')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent || ''))
    .catch(() => []);
  return unique(labels.map(normalizeText).filter((label) => label.length > 1));
};

const clickSidebar = async (page, label) => {
  const target = normalizeForMatch(label);
  const items = page.locator('.laines-sidebar__nav .laines-sidebar__item, .laines-sidebar__item, aside a, aside button');
  const count = await items.count();
  for (let index = 0; index < count; index += 1) {
    const item = items.nth(index);
    if (!(await safeVisible(item))) continue;
    const text = normalizeForMatch(await item.textContent());
    if (text !== target) continue;
    await item.click({ force: true }).catch(() => undefined);
    await sleep(1200);
    return true;
  }
  return false;
};

const tabCandidates = async (page) => {
  const selectors = [
    'main [role="tab"]',
    'main [data-tab]',
    'main .tab-btn',
    'main .admin-tabs button',
    'main .settings-tab',
    'main .reports-tab',
    'main .area-tab'
  ].join(', ');
  const labels = await page.locator(selectors)
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-tab') || node.textContent || ''))
    .catch(() => []);
  return unique(labels.map(normalizeText).filter((label) => label.length > 1)).slice(0, 20);
};

const clickTab = async (page, label) => {
  const target = normalizeForMatch(label);
  const selectors = [
    'main [role="tab"]',
    'main [data-tab]',
    'main .tab-btn',
    'main .admin-tabs button',
    'main .settings-tab',
    'main .reports-tab',
    'main .area-tab'
  ].join(', ');
  const items = page.locator(selectors);
  const count = await items.count();
  for (let index = 0; index < count; index += 1) {
    const item = items.nth(index);
    if (!(await safeVisible(item))) continue;
    const text = normalizeForMatch((await item.getAttribute('data-tab')) || await item.textContent());
    if (text !== target) continue;
    await item.click({ force: true }).catch(() => undefined);
    await sleep(1000);
    return true;
  }
  return false;
};

const modalButtons = async (page) => {
  const actionPattern = /(novo|nova|adicionar|cadastrar|criar|solicitar|vincular|agendar|registrar|lancar)/i;
  const blockPattern = /(sair|logout|excluir|remover|deletar|finalizar|salvar|entrar)/i;
  const buttons = page.locator('main button, main a[role="button"]');
  const count = await buttons.count();
  const result = [];
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    if (!(await safeVisible(button))) continue;
    const text = normalizeText(await button.textContent());
    if (!text || !actionPattern.test(text) || blockPattern.test(text)) continue;
    result.push(text);
  }
  return unique(result).slice(0, 4);
};

const clickActionButton = async (page, label) => {
  const target = normalizeForMatch(label);
  const buttons = page.locator('main button, main a[role="button"]');
  const count = await buttons.count();
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    if (!(await safeVisible(button))) continue;
    const text = normalizeForMatch(await button.textContent());
    if (text !== target) continue;
    await button.click({ force: true }).catch(() => undefined);
    await sleep(700);
    return true;
  }
  return false;
};

const captureVisibleModals = async (page, capture, contextLabel) => {
  const buttons = await modalButtons(page);
  for (const buttonLabel of buttons) {
    const beforeUrl = page.url();
    const opened = await clickActionButton(page, buttonLabel);
    if (!opened) continue;
    if (!(await hasVisibleDialog(page))) {
      if (page.url() !== beforeUrl) {
        await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
        await sleep(700);
      }
      continue;
    }
    await fillFields(page, `${contextLabel}-${buttonLabel}`);
    await capture(`modal-${contextLabel}-${buttonLabel}-preenchido`);
    await closeModal(page);
  }
};

const captureProfile = async (browser, profile, entries) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  const capture = createCapture(page, profile, entries);

  page.on('pageerror', (error) => {
    console.log(`[pageerror][${profile.key}] ${error.message}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 500) {
      console.log(`[api-500][${profile.key}] ${response.status()} ${response.url()}`);
    }
  });

  try {
    await login(page, profile, capture);
    await capture('home');
    await captureVisibleModals(page, capture, 'home');

    const labels = await sidebarLabels(page);
    for (const label of labels) {
      if (/sair|logout/i.test(label)) continue;
      const clicked = await clickSidebar(page, label);
      if (!clicked) continue;
      await capture(`sidebar-${label}`);
      await captureVisibleModals(page, capture, `sidebar-${label}`);

      const tabs = await tabCandidates(page);
      for (const tab of tabs) {
        const tabClicked = await clickTab(page, tab);
        if (!tabClicked) continue;
        await capture(`aba-${label}-${tab}`);
        await captureVisibleModals(page, capture, `aba-${label}-${tab}`);
      }
    }
  } catch (error) {
    await capture('erro');
    console.error(`[profile-screenshots] ${profile.key}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await context.close();
  }
};

const main = async () => {
  await ensureDir(OUT_DIR);
  const browser = await chromium.launch({ headless: HEADLESS });
  const entries = [];
  try {
    for (const profile of profiles) {
      console.log(`[profile-screenshots] perfil: ${profile.key}`);
      await captureProfile(browser, profile, entries);
    }
  } finally {
    await browser.close();
  }

  await writeIndex(entries);
  console.log(`[profile-screenshots] index: ${path.join(OUT_DIR, 'index.md')}`);
};

main().catch((error) => {
  console.error(`[profile-screenshots] falha fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
