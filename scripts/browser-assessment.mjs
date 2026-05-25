import fs from 'node:fs';
import path from 'node:path';
import { chromium, firefox, webkit, devices } from 'playwright';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';
const outputPath = process.env.BROWSER_REPORT_PATH || 'e2e-artifacts/browser-assessment.json';
const adminEmail = process.env.E2E_ADMIN_EMAIL || process.env.E2E_EMAIL || 'e2e-admin@teste.com';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_PASSWORD || 'e2e-password';

const projects = [
  {
    name: 'chromium-desktop',
    browserType: chromium,
    contextOptions: { ...devices['Desktop Chrome'] }
  },
  {
    name: 'firefox-desktop',
    browserType: firefox,
    contextOptions: { ...devices['Desktop Firefox'] }
  },
  {
    name: 'webkit-desktop',
    browserType: webkit,
    contextOptions: { ...devices['Desktop Safari'] }
  },
  {
    name: 'mobile-chrome',
    browserType: chromium,
    contextOptions: { ...devices['Pixel 7'] }
  },
  {
    name: 'mobile-safari',
    browserType: webkit,
    contextOptions: { ...devices['iPhone 14'] }
  }
];

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const runCase = async (page, name, callback) => {
  const startedAt = Date.now();
  try {
    await callback();
    return {
      name,
      status: 'passed',
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      name,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error)
    };
  }
};

const isMissingBrowserInstall = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  return /Executable doesn't exist|Please run.*playwright install|browser executable.*doesn't exist/i.test(message);
};

const createLaunchResult = (project, error) => {
  const message = error instanceof Error ? error.message : String(error);
  const missingInstall = isMissingBrowserInstall(error);
  const status = missingInstall ? 'skipped' : 'failed';
  const reportMessage = missingInstall
    ? 'Browser do Playwright nao instalado. Execute "npx playwright install" para habilitar este projeto.'
    : message;

  return {
    project: project.name,
    status,
    passed: 0,
    failed: missingInstall ? 0 : 1,
    skipped: missingInstall ? 1 : 0,
    checks: [
      {
        name: 'browser_launch',
        status,
        durationMs: 0,
        message: reportMessage
      }
    ]
  };
};

const runProject = async (project) => {
  let browser;
  try {
    browser = await project.browserType.launch({ headless: true });
  } catch (error) {
    return createLaunchResult(project, error);
  }

  const context = await browser.newContext(project.contextOptions);
  const page = await context.newPage();
  const checks = [];

  try {
    checks.push(await runCase(page, 'login_page_loads', async () => {
      await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForSelector('text=Entrar na plataforma', { timeout: 15_000 });
    }));

    checks.push(await runCase(page, 'responsive_no_horizontal_overflow', async () => {
      const noOverflow = await page.evaluate(() => (
        document.documentElement.scrollWidth <= (window.innerWidth + 1)
      ));
      assert(noOverflow, 'detectado overflow horizontal na pagina de login');
    }));

    checks.push(await runCase(page, 'invalid_login_feedback', async () => {
      await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.locator('input[placeholder="usuario@laines.ufrn.br"]').fill(adminEmail);
      await page.locator('input[autocomplete="current-password"]').fill('senha-invalida');
      await page.getByRole('button', { name: /entrar agora|entrando/i }).click();
      const error = page.locator('.landing-error');
      await error.waitFor({ state: 'visible', timeout: 20_000 });
      const text = await error.innerText();
      assert(/credenciais|inv[aá]lid/i.test(text), `mensagem inesperada de erro: ${text}`);
    }));

    checks.push(await runCase(page, 'admin_login_logout', async () => {
      const clickWithFallback = async (locator) => {
        try {
          await locator.click();
        } catch {
          try {
            // Alguns navegadores mobile reportam "outside of viewport" mesmo com elemento visivel.
            await locator.click({ force: true });
          } catch {
            await locator.evaluate((node) => {
              if (node && typeof node.click === 'function') {
                node.click();
              }
            });
          }
        }
      };

      await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.locator('input[placeholder="usuario@laines.ufrn.br"]').fill(adminEmail);
      await page.locator('input[autocomplete="current-password"]').fill(adminPassword);
      await page.getByRole('button', { name: /entrar agora|entrando/i }).click();
      await page.waitForURL(/\/admin$/, { timeout: 45_000 });

      const profileOverlay = page.locator('.profile-completion-overlay');
      const overlayVisible = await profileOverlay.isVisible().catch(() => false);

      if (overlayVisible) {
        const modalLogoutButton = profileOverlay.getByRole('button', { name: /sair/i }).first();
        await modalLogoutButton.waitFor({ state: 'visible', timeout: 20_000 });
        await clickWithFallback(modalLogoutButton);
      } else {
        const menuToggle = page.locator('button.laines-sidebar__toggle, button[aria-label="Abrir menu"]').first();
        const logoutButton = page
          .locator('button.laines-sidebar__logout, button.sb-footer__logout, button[aria-label*="Encerrar"], button[title*="Encerrar"]')
          .first();

        if (!(await logoutButton.isVisible().catch(() => false)) && await menuToggle.isVisible().catch(() => false)) {
          await clickWithFallback(menuToggle);
        }

        await logoutButton.waitFor({ state: 'visible', timeout: 20_000 });
        await logoutButton.scrollIntoViewIfNeeded();
        await clickWithFallback(logoutButton);
      }

      await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/login', { timeout: 45_000 });
      await page.waitForSelector('text=Entrar na plataforma', { timeout: 20_000 });
    }));
  } finally {
    const failedChecks = checks.filter((item) => item.status === 'failed');
    if (failedChecks.length > 0) {
      const screenshotPath = path.resolve(`e2e-artifacts/browser-${project.name}-failure.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }
    await context.close();
    await browser.close();
  }

  return {
    project: project.name,
    status: checks.some((item) => item.status === 'failed') ? 'failed' : 'passed',
    passed: checks.filter((item) => item.status === 'passed').length,
    failed: checks.filter((item) => item.status === 'failed').length,
    skipped: checks.filter((item) => item.status === 'skipped').length,
    checks
  };
};

const run = async () => {
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    projects: []
  };

  for (const project of projects) {
    const result = await runProject(project);
    report.projects.push(result);
    console.log(`[browser] ${project.name}: status=${result.status} passed=${result.passed} failed=${result.failed} skipped=${result.skipped}`);
  }

  report.summary = {
    totalProjects: report.projects.length,
    totalChecks: report.projects.reduce((acc, item) => acc + item.checks.length, 0),
    passed: report.projects.reduce((acc, item) => acc + item.passed, 0),
    failed: report.projects.reduce((acc, item) => acc + item.failed, 0),
    skipped: report.projects.reduce((acc, item) => acc + item.skipped, 0)
  };

  const absolutePath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[browser] report gerado em ${absolutePath}`);

  if (report.summary.failed > 0) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error(`[browser] Falha fatal: ${error.message}`);
  process.exitCode = 1;
});
