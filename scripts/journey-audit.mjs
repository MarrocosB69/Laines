import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.JOURNEY_BASE_URL || 'http://localhost:5173';
const OUT_DIR = path.resolve(process.cwd(), 'e2e-artifacts', 'journey-audit');
const STRICT_MODE = String(process.env.JOURNEY_STRICT || '').trim().toLowerCase() === 'true';

const envValue = (name, fallback = '') => {
  const value = String(process.env[name] || fallback).trim();
  return value;
};

const credential = (email, password) => ({ email, password });

const validCredential = (item) => (
  String(item?.email || '').trim().length > 0
  && String(item?.password || '').trim().length > 0
);

const uniqueCredentials = (items) => {
  const dedup = new Map();
  for (const item of items) {
    if (!validCredential(item)) continue;
    const key = `${String(item.email).toLowerCase()}::${item.password}`;
    if (!dedup.has(key)) dedup.set(key, item);
  }
  return Array.from(dedup.values());
};

const profiles = [
  {
    key: 'admin',
    role: 'admin',
    expectedPath: '/admin',
    credentials: uniqueCredentials([
      credential(envValue('E2E_ADMIN_EMAIL', 'admin.ci@laines.ufrn.br'), envValue('E2E_ADMIN_PASSWORD', 'Admin#123456'))
    ])
  },
  {
    key: 'presidente',
    role: 'presidente',
    expectedPath: '/admin',
    credentials: uniqueCredentials([
      credential(envValue('E2E_PRESIDENT_EMAIL', ''), envValue('E2E_PRESIDENT_PASSWORD', '')),
      credential('bruno.marrocos@laines.ufrn.br', 's4FVfSDsuhrqGf'),
      credential(envValue('E2E_ADMIN_EMAIL', 'admin.ci@laines.ufrn.br'), envValue('E2E_ADMIN_PASSWORD', 'Admin#123456'))
    ])
  },
  {
    key: 'aluno',
    role: 'aluno',
    expectedPath: '/aluno',
    credentials: uniqueCredentials([
      credential(envValue('E2E_STUDENT_EMAIL', 'aluno.ci@laines.ufrn.br'), envValue('E2E_STUDENT_PASSWORD', 'Aluno#123456'))
    ])
  },
  {
    key: 'professor',
    role: 'professor',
    expectedPath: '/professor',
    credentials: uniqueCredentials([
      credential(envValue('E2E_PROFESSOR_EMAIL', 'professor.ci@laines.ufrn.br'), envValue('E2E_PROFESSOR_PASSWORD', 'Professor#123456'))
    ])
  },
  {
    key: 'tecnico',
    role: 'tecnico',
    expectedPath: '/equipe',
    credentials: uniqueCredentials([
      credential(envValue('E2E_TEAM_EMAIL', 'tecnico.ci@laines.ufrn.br'), envValue('E2E_TEAM_PASSWORD', 'Tecnico#123456')),
      credential('tecnico.jornada@laines.ufrn.br', 'LAWr%hJx2FFwme')
    ])
  },
  {
    key: 'atleta',
    role: 'atleta',
    expectedPath: '/atleta',
    credentials: uniqueCredentials([
      credential(envValue('E2E_ATHLETE_EMAIL', 'atleta.ci@laines.ufrn.br'), envValue('E2E_ATHLETE_PASSWORD', 'Atleta#123456')),
      credential('renan.martins@laines.ufrn.br', 'dw4zQRfDFwKe@J')
    ])
  }
];

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const normalizeForMatch = (value) => normalizeText(value)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const unique = (items) => Array.from(new Set(items.filter(Boolean)));

const safeIsVisible = async (locator) => {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
};

const safeIsEnabled = async (locator) => {
  try {
    return await locator.isEnabled();
  } catch {
    return false;
  }
};

const safeFill = async (locator, value) => {
  try {
    if (!(await locator.isVisible())) return false;
    await locator.fill(value);
    return true;
  } catch {
    return false;
  }
};

const readFirstHeading = async (page) => {
  const candidates = page.locator(
    'main h1, main h2, .content-area h1, .content-area h2, .team-portal h1, .athlete-portal h1, .team-detail h2'
  );
  const count = await candidates.count();
  for (let i = 0; i < count; i += 1) {
    const node = candidates.nth(i);
    if (await safeIsVisible(node)) {
      const text = normalizeText(await node.textContent());
      if (text) return text;
    }
  }
  return '';
};

const listSidebarItems = async (page) => {
  const labels = await page.locator('.laines-sidebar__nav .laines-sidebar__item span').allTextContents();
  return unique(labels.map((item) => normalizeText(item)));
};

const clickSidebarItem = async (page, label) => {
  const target = normalizeForMatch(label);
  const items = page.locator('.laines-sidebar__nav .laines-sidebar__item');
  const count = await items.count();
  for (let i = 0; i < count; i += 1) {
    const node = items.nth(i);
    if (!(await safeIsVisible(node))) continue;
    const text = normalizeForMatch(await node.textContent());
    if (text !== target) continue;
    await node.click();
    await page.waitForTimeout(900);
    return true;
  }
  return false;
};

const menuHasLabel = (menu, label) => {
  const target = normalizeForMatch(label);
  return menu.some((item) => normalizeForMatch(item) === target);
};

const tryResolvePasswordModal = async (page, notes, currentPassword) => {
  const passwordModal = page.locator('text=Atualize sua senha');
  if (!(await safeIsVisible(passwordModal))) return;

  notes.push('modal_primeiro_acesso_senha_exibido');

  const closeIcon = page.locator('.password-modal button[aria-label="Fechar"]').first();
  const cancelBtn = page.locator('.password-modal button:has-text("Cancelar")').first();
  if (await safeIsVisible(closeIcon)) {
    await closeIcon.click();
    await page.waitForTimeout(500);
    notes.push('modal_primeiro_acesso_senha_fechado');
    return;
  }
  if (await safeIsVisible(cancelBtn)) {
    await cancelBtn.click();
    await page.waitForTimeout(500);
    notes.push('modal_primeiro_acesso_senha_cancelado');
    return;
  }

  const currentField = page.locator('.password-modal input[placeholder="Digite a senha atual"]').first();
  const newField = page.locator('.password-modal input[placeholder="Digite a nova senha"]').first();
  const confirmField = page.locator('.password-modal input[placeholder="Repita a nova senha"]').first();
  const submitBtn = page.locator('.password-modal button:has-text("Salvar nova senha")').first();

  const canSubmitUpdate = await safeIsVisible(currentField)
    && await safeIsVisible(newField)
    && await safeIsVisible(confirmField)
    && await safeIsVisible(submitBtn)
    && await safeIsEnabled(submitBtn);

  if (!canSubmitUpdate || !currentPassword) {
    notes.push('modal_primeiro_acesso_senha_bloqueando_jornada');
    return;
  }

  const nextPassword = `TmpA#${Date.now().toString().slice(-6)}z1`;
  try {
    await currentField.fill(currentPassword);
    await newField.fill(nextPassword);
    await confirmField.fill(nextPassword);
    await submitBtn.click();
    await page.waitForTimeout(1200);
    notes.push('modal_primeiro_acesso_senha_atualizada_automaticamente');
  } catch {
    notes.push('modal_primeiro_acesso_senha_nao_foi_atualizada');
  }
};

const tryResolveProfileCompletionModal = async (page, notes, role = '') => {
  const profileModal = page.locator('.profile-completion-modal').first();
  if (!(await safeIsVisible(profileModal))) return;
  notes.push('modal_completar_cadastro_exibido');

  const fullName = `${(role || 'usuario').toUpperCase()} Jornada`;
  await safeFill(page.locator('.profile-completion-field:has-text("Nome completo") input').first(), fullName);
  await safeFill(page.locator('.profile-completion-field:has-text("CPF") input').first(), '12345678901');
  await safeFill(page.locator('.profile-completion-field:has-text("Telefone") input').first(), '(84) 99999-1111');
  await safeFill(page.locator('.profile-completion-field:has-text("Data de nascimento") input').first(), '1996-08-10');
  await safeFill(page.locator('.profile-completion-field:has-text("Matricula") input').first(), '202699999');
  await safeFill(page.locator('.profile-completion-field:has-text("Curso") input').first(), 'Nutricao');
  await safeFill(page.locator('.profile-completion-field:has-text("Periodo") input').first(), '8');

  const selects = page.locator('.profile-completion-field select');
  const selectCount = await selects.count();
  for (let i = 0; i < selectCount; i += 1) {
    const select = selects.nth(i);
    if (!(await safeIsVisible(select))) continue;
    try {
      const currentValue = await select.inputValue();
      if (String(currentValue || '').trim()) continue;
      await select.selectOption({ index: 1 });
    } catch {
      // ignore
    }
  }

  const saveBtn = page.locator('.profile-completion-modal button:has-text("Salvar cadastro")').first();
  if (await safeIsVisible(saveBtn) && await safeIsEnabled(saveBtn)) {
    await saveBtn.click();
    await page.waitForTimeout(1800);
  }

  if (await safeIsVisible(profileModal)) {
    notes.push('modal_completar_cadastro_bloqueando_jornada');
  } else {
    notes.push('modal_completar_cadastro_resolvido');
  }
};

const dismissBlockingModals = async (page, notes, profile, currentPassword = '') => {
  await tryResolvePasswordModal(page, notes, currentPassword);

  const onboardingModal = page.locator('.athlete-onboarding-modal').first();
  if (await safeIsVisible(onboardingModal)) {
    notes.push('modal_onboarding_atleta_exibido');
    await safeFill(page.locator('.athlete-onboarding-modal input[name="nomeCompleto"]').first(), 'Atleta Jornada');
    await safeFill(page.locator('.athlete-onboarding-modal input[name="dataNascimento"]').first(), '1998-04-15');

    const saveBtn = page.locator('.athlete-onboarding-modal button:has-text("Salvar confirmacao")').first();
    if (await safeIsVisible(saveBtn) && await safeIsEnabled(saveBtn)) {
      await saveBtn.click();
      await page.waitForTimeout(1800);
    }

    if (await safeIsVisible(onboardingModal)) {
      notes.push('modal_onboarding_atleta_bloqueando_jornada');
    } else {
      notes.push('modal_onboarding_atleta_resolvido');
    }
  }

  await tryResolveProfileCompletionModal(page, notes, profile?.role || '');
};

const attemptLogin = async (page, email, password) => {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[placeholder="usuario@laines.ufrn.br"]').fill(email);
  await page.locator('input[placeholder="Sua senha"]').fill(password);
  await page.locator('button:has-text("Entrar agora")').click();
  await page.waitForTimeout(1800);

  const currentPath = new URL(page.url()).pathname;
  const invalidToast = await safeIsVisible(page.getByText(/Credenciais inv[aá]lidas/i).first());
  const blockedOnLogin = currentPath === '/login' && invalidToast;
  return {
    ok: !blockedOnLogin && currentPath !== '/login',
    currentPath,
    blockedOnLogin
  };
};

const loginAndPrepare = async (page, profile, reportItem) => {
  const candidates = Array.isArray(profile.credentials) ? profile.credentials : [];
  let loginOk = false;
  let lastPath = '/login';

  for (const candidate of candidates) {
    const attempt = await attemptLogin(page, candidate.email, candidate.password);
    lastPath = attempt.currentPath;
    if (!attempt.ok) continue;
    reportItem.email = candidate.email;
    loginOk = true;
    await dismissBlockingModals(page, reportItem.notes, profile, candidate.password);
    break;
  }

  if (!loginOk) {
    reportItem.currentPath = lastPath;
    reportItem.redirectOk = false;
    reportItem.notes.push(`redirecionamento_inesperado:${lastPath}`);
    return;
  }

  const currentPath = new URL(page.url()).pathname;
  reportItem.currentPath = currentPath;
  reportItem.redirectOk = currentPath === profile.expectedPath;
  if (!reportItem.redirectOk) {
    reportItem.notes.push(`redirecionamento_inesperado:${currentPath}`);
  }
};

const runAdminJourney = async (page, reportItem) => {
  const item = {
    menu: [],
    headingsByMenu: {},
    openedProntuarioFromPatients: false,
    linkModalOpened: false,
    linkModalClosedByOverlay: false,
    settingsSaveMessage: '',
    researchCreateButtonVisible: false
  };

  item.menu = await listSidebarItems(page);

  for (const label of item.menu) {
    const clicked = await clickSidebarItem(page, label);
    if (!clicked) continue;
    item.headingsByMenu[label] = await readFirstHeading(page);
  }

  if (menuHasLabel(item.menu, 'Participantes')) {
    await clickSidebarItem(page, 'Participantes');
    const linkBtn = page.locator('button[title="Vincular"]').first();
    if (await safeIsVisible(linkBtn)) {
      await linkBtn.click();
      await page.waitForTimeout(800);
      const linkModal = page.locator('.link-modal-overlay .modal-container').first();
      item.linkModalOpened = await safeIsVisible(linkModal);

      if (item.linkModalOpened) {
        const overlay = page.locator('.link-modal-overlay.app-modal-overlay').first();
        if (await safeIsVisible(overlay)) {
          await overlay.click({ position: { x: 12, y: 12 } });
          await page.waitForTimeout(600);
        }
        item.linkModalClosedByOverlay = !(await safeIsVisible(linkModal));

        if (!item.linkModalClosedByOverlay) {
          const closeBtn = page.locator('.link-modal-overlay button[aria-label="Fechar"]').first();
          if (await safeIsVisible(closeBtn)) {
            await closeBtn.click();
            await page.waitForTimeout(300);
          }
        }
      }
    }

    const viewBtn = page.locator('button[title="Visualizar"]').first();
    if (await safeIsVisible(viewBtn)) {
      await viewBtn.click();
      await page.waitForTimeout(1200);
      const prontuarioTitle = page.locator('text=Prontuário do atleta');
      item.openedProntuarioFromPatients = await safeIsVisible(prontuarioTitle);
      const backBtn = page.locator('button[aria-label="Voltar"]').first();
      if (await safeIsVisible(backBtn)) {
        await backBtn.click();
        await page.waitForTimeout(900);
      }
    }
  }

  if (menuHasLabel(item.menu, 'Configurações')) {
    await clickSidebarItem(page, 'Configurações');
    const saveBtn = page.getByRole('button', { name: /Salvar Altera[cç][oõ]es/i }).first();
    if (await safeIsVisible(saveBtn) && await safeIsEnabled(saveBtn)) {
      await saveBtn.click();
      await page.waitForTimeout(1500);
      const status = page.locator('.status-message').first();
      if (await safeIsVisible(status)) {
        item.settingsSaveMessage = normalizeText(await status.textContent());
      }
    } else if (await safeIsVisible(saveBtn)) {
      item.settingsSaveMessage = 'sem_alteracoes_pendentes';
    }
  }

  if (menuHasLabel(item.menu, 'Projetos')) {
    await clickSidebarItem(page, 'Projetos');
    const createBtn = page.locator('button:has-text("Novo projeto")').first();
    item.researchCreateButtonVisible = await safeIsVisible(createBtn);
    if (item.researchCreateButtonVisible) {
      await createBtn.click();
      await page.waitForTimeout(700);
      const closeBtn = page.locator('.research-project-modal button[aria-label="Fechar"]').first();
      if (await safeIsVisible(closeBtn)) await closeBtn.click();
      await page.waitForTimeout(400);
    }
  }

  reportItem.journey = item;
};

const runStudentJourney = async (page, reportItem) => {
  const item = {
    menu: [],
    dashboardHeading: '',
    openedProntuario: false,
    agendaLoaded: false,
    agendaErrorVisible: false,
    agendaRefreshAvailable: false,
    patientEmptyState: false
  };

  item.menu = await listSidebarItems(page);
  item.dashboardHeading = await readFirstHeading(page);

  if (menuHasLabel(item.menu, 'Meus Pacientes')) {
    await clickSidebarItem(page, 'Meus Pacientes');
    const emptyState = page.locator('text=Nenhum paciente vinculado ainda.').first();
    item.patientEmptyState = await safeIsVisible(emptyState);

    const card = page.locator('.patient-card').first();
    const row = page.locator('.patient-list-item').first();
    if (await safeIsVisible(card)) {
      await card.click();
      await page.waitForTimeout(1000);
    } else if (await safeIsVisible(row)) {
      await row.click();
      await page.waitForTimeout(1000);
    }

    const prontuarioTitle = page.locator('text=Prontuário do atleta').first();
    item.openedProntuario = await safeIsVisible(prontuarioTitle);
    if (item.openedProntuario) {
      const backBtn = page.locator('button[aria-label="Voltar"]').first();
      if (await safeIsVisible(backBtn)) {
        await backBtn.click();
        await page.waitForTimeout(800);
      }
    }
  }

  if (menuHasLabel(item.menu, 'Minha Agenda')) {
    await clickSidebarItem(page, 'Minha Agenda');
    item.agendaLoaded = await safeIsVisible(page.locator('text=Minha agenda').first());
    const refreshBtn = page.locator('button:has-text("Atualizar agenda")').first();
    item.agendaRefreshAvailable = await safeIsVisible(refreshBtn);
    if (item.agendaRefreshAvailable) {
      await refreshBtn.click();
      await page.waitForTimeout(900);
    }
    item.agendaErrorVisible = await safeIsVisible(page.locator('.agenda-empty--error').first());
  }

  reportItem.journey = item;
};

const runProfessorJourney = async (page, reportItem) => {
  const item = {
    menu: [],
    openedProntuarioFromAgenda: false,
    activeAfterBackFromProntuario: '',
    researchCreateButtonVisible: false,
    researchSaveAttempted: false,
    researchErrorToast: ''
  };

  item.menu = await listSidebarItems(page);

  if (menuHasLabel(item.menu, 'Agenda')) {
    await clickSidebarItem(page, 'Agenda');
    const openBtn = page.getByRole('button', { name: /Abrir prontu[aá]rio/i }).first();
    if (await safeIsVisible(openBtn)) {
      await openBtn.click();
      await page.waitForTimeout(1200);
      item.openedProntuarioFromAgenda = await safeIsVisible(page.locator('text=Prontuário do atleta').first());
      const backBtn = page.locator('button[aria-label="Voltar"]').first();
      if (await safeIsVisible(backBtn)) {
        await backBtn.click();
        await page.waitForTimeout(900);
        const activeMenu = page.locator('.laines-sidebar__item--active span').first();
        if (await safeIsVisible(activeMenu)) {
          item.activeAfterBackFromProntuario = normalizeText(await activeMenu.textContent());
        }
      }
    }
  }

  if (menuHasLabel(item.menu, 'Pesquisas')) {
    await clickSidebarItem(page, 'Pesquisas');
    const createBtn = page.locator('button:has-text("Novo projeto")').first();
    item.researchCreateButtonVisible = await safeIsVisible(createBtn);
    if (item.researchCreateButtonVisible) {
      await createBtn.click();
      await page.waitForTimeout(700);
      const nameInput = page.locator('.research-project-modal input').first();
      if (await safeIsVisible(nameInput)) {
        await nameInput.fill(`Projeto Jornada ${Date.now()}`);
      }
      const saveBtn = page.locator('.research-project-modal button:has-text("Salvar projeto")').first();
      if (await safeIsVisible(saveBtn)) {
        item.researchSaveAttempted = true;
        await saveBtn.click();
        await page.waitForTimeout(1500);
        const lastToast = page.locator('.ui-toast').last();
        if (await safeIsVisible(lastToast)) {
          item.researchErrorToast = normalizeText(await lastToast.textContent());
        }
      }
      const closeBtn = page.locator('.research-project-modal button[aria-label="Fechar"]').first();
      if (await safeIsVisible(closeBtn)) {
        await closeBtn.click();
        await page.waitForTimeout(400);
      }
    }
  }

  reportItem.journey = item;
};

const runTeamJourney = async (page, reportItem) => {
  const item = {
    heading: '',
    patientCount: 0,
    selectedPatientName: '',
    emptyStateVisible: false
  };

  item.heading = await readFirstHeading(page);
  const listItems = page.locator('.team-list-item');
  item.patientCount = await listItems.count();
  item.emptyStateVisible = await safeIsVisible(page.locator('text=Nenhum atleta vinculado.').first());

  if (item.patientCount > 0) {
    await listItems.first().click();
    await page.waitForTimeout(800);
    const name = page.locator('.team-detail h2').first();
    if (await safeIsVisible(name)) {
      item.selectedPatientName = normalizeText(await name.textContent());
    }
  }

  reportItem.journey = item;
};

const runAthleteJourney = async (page, reportItem) => {
  const item = {
    heading: '',
    onboardingModalVisible: false,
    hasNextAppointment: false,
    hasRescheduleAction: false,
    hasNoShowAction: false,
    openedRescheduleModal: false
  };

  item.heading = await readFirstHeading(page);
  item.onboardingModalVisible = await safeIsVisible(page.locator('text=Confirmacao inicial do atleta').first());
  item.hasNextAppointment = await safeIsVisible(page.locator('text=Proxima consulta').first());

  const rescheduleBtn = page.locator('button:has-text("Remarcar consulta")').first();
  item.hasRescheduleAction = await safeIsVisible(rescheduleBtn);
  const noShowBtn = page.locator('button:has-text("Registrar falta")').first();
  item.hasNoShowAction = await safeIsVisible(noShowBtn);

  if (item.hasRescheduleAction) {
    await rescheduleBtn.click();
    await page.waitForTimeout(700);
    item.openedRescheduleModal = await safeIsVisible(page.locator('text=Remarcar consulta').first());
    const closeBtn = page.locator('.appointment-modal button[aria-label="Fechar"]').first();
    if (await safeIsVisible(closeBtn)) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }
  }

  reportItem.journey = item;
};

const runJourneyForProfile = async (browser, profile) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const apiErrors = [];
  const pageErrors = [];

  page.on('response', (response) => {
    try {
      const url = new URL(response.url());
      if (url.port !== '4000') return;
      if (response.status() < 400) return;
      if (url.pathname === '/auth/login' && response.status() === 401) return;
      apiErrors.push({
        status: response.status(),
        method: response.request().method(),
        path: `${url.pathname}${url.search || ''}`
      });
    } catch {
      // ignore parse errors
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(normalizeText(error?.message || String(error)));
  });

  const reportItem = {
    profile: profile.role,
    email: profile.credentials?.[0]?.email || '',
    expectedPath: profile.expectedPath,
    currentPath: '',
    redirectOk: false,
    notes: [],
    apiErrors,
    pageErrors,
    journey: {},
    viewportChecks: {
      desktopOverflow: false,
      mobileOverflow: false
    }
  };

  try {
    await loginAndPrepare(page, profile, reportItem);

    if (profile.key === 'admin' || profile.key === 'presidente') {
      await runAdminJourney(page, reportItem);
    } else if (profile.key === 'aluno') {
      await runStudentJourney(page, reportItem);
    } else if (profile.key === 'professor') {
      await runProfessorJourney(page, reportItem);
    } else if (profile.key === 'tecnico') {
      await runTeamJourney(page, reportItem);
    } else if (profile.key === 'atleta') {
      await runAthleteJourney(page, reportItem);
    }
  } catch (error) {
    reportItem.notes.push(`journey_exception:${normalizeText(error?.message || String(error))}`);
  }

  const screenshotPath = path.join(OUT_DIR, `${profile.key}.png`);
  const mobileScreenshotPath = path.join(OUT_DIR, `${profile.key}-mobile.png`);
  try {
    reportItem.viewportChecks.desktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2
    );
  } catch {
    // ignore
  }
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
    reportItem.screenshot = screenshotPath;
  } catch {
    reportItem.screenshot = '';
  }

  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(950);
    reportItem.viewportChecks.mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2
    );
  } catch {
    // ignore
  }

  try {
    await page.screenshot({ path: mobileScreenshotPath, fullPage: true });
    reportItem.mobileScreenshot = mobileScreenshotPath;
  } catch {
    reportItem.mobileScreenshot = '';
  }

  await context.close();
  return reportItem;
};

const main = async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    profiles: {}
  };

  try {
    for (const profile of profiles) {
      report.profiles[profile.key] = await runJourneyForProfile(browser, profile);
    }
  } finally {
    await browser.close();
  }

  const entries = Object.entries(report.profiles);
  const blockedProfiles = entries
    .filter(([, item]) => !item.redirectOk)
    .map(([key]) => key);
  const profilesWithPageErrors = entries
    .filter(([, item]) => Array.isArray(item.pageErrors) && item.pageErrors.length > 0)
    .map(([key]) => key);
  const profilesWithApiErrors = entries
    .filter(([, item]) => Array.isArray(item.apiErrors) && item.apiErrors.length > 0)
    .map(([key]) => key);

  report.summary = {
    strictMode: STRICT_MODE,
    totalProfiles: entries.length,
    okProfiles: entries.length - blockedProfiles.length,
    blockedProfiles,
    profilesWithPageErrors,
    profilesWithApiErrors
  };

  const reportPath = path.join(OUT_DIR, 'journey-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(reportPath);
  if (report.summary.blockedProfiles.length > 0) {
    console.log(`[journey-audit] blocked profiles: ${report.summary.blockedProfiles.join(', ')}`);
  }
  if (report.summary.profilesWithPageErrors.length > 0) {
    console.log(`[journey-audit] page errors: ${report.summary.profilesWithPageErrors.join(', ')}`);
  }
  if (report.summary.profilesWithApiErrors.length > 0) {
    console.log(`[journey-audit] api errors: ${report.summary.profilesWithApiErrors.join(', ')}`);
  }
  if (
    STRICT_MODE
    && (
      report.summary.blockedProfiles.length > 0
      || report.summary.profilesWithPageErrors.length > 0
      || report.summary.profilesWithApiErrors.length > 0
    )
  ) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
