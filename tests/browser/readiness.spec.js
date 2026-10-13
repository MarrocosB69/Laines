/* global process */
import { test, expect } from '@playwright/test';

const adminEmail = process.env.E2E_ADMIN_EMAIL || process.env.E2E_EMAIL || 'e2e-admin@teste.com';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_PASSWORD || 'e2e-password';

test.describe('Readiness UI', () => {
  test('login admin e logout funcionam', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-identifier')).toBeVisible();

    await page.getByTestId('login-identifier').fill(adminEmail);
    await page.getByTestId('login-password').fill(adminPassword);
    await page.getByTestId('login-submit').click();

    await page.waitForURL('**/admin', { timeout: 30_000 });
    await expect(page).toHaveURL(/\/admin$/);

    const logoutButton = page.locator('button.laines-sidebar__logout').first();
    await expect(logoutButton).toBeVisible();
    await logoutButton.click();
    await page.waitForURL('**/login', { timeout: 30_000 });
    await expect(page).toHaveURL(/\/login$/);
  });

  test('erro de credencial exibe feedback amigavel', async ({ page }) => {
    await page.goto('/login');

    await page.getByTestId('login-identifier').fill(adminEmail);
    await page.getByTestId('login-password').fill('senha-errada');
    await page.getByTestId('login-submit').click();

    const errorAlert = page.locator('.landing-error');
    await expect(errorAlert).toBeVisible();
    // Mensagens de LoginPage.jsx para 401 e para bloqueio (423/429).
    await expect(errorAlert).toContainText(/incorretos|temporariamente/i);
  });

  test('layout de login responsivo sem overflow horizontal', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-identifier')).toBeVisible();

    const noHorizontalOverflow = await page.evaluate(() => (
      document.documentElement.scrollWidth <= (window.innerWidth + 1)
    ));
    expect(noHorizontalOverflow).toBeTruthy();
  });

  test('navegacao por teclado alcanca campos de login', async ({ page }) => {
    await page.goto('/login');

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const loginInputFocused = await page.getByTestId('login-identifier').evaluate((element) => element === document.activeElement);
    expect(loginInputFocused).toBeTruthy();

    await page.keyboard.press('Tab');
    const passwordInputFocused = await page.getByTestId('login-password').evaluate((element) => element === document.activeElement);
    expect(passwordInputFocused).toBeTruthy();
  });

  test('avaliacao completa carrega shell operacional e mantem responsividade', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-identifier')).toBeVisible();

    await page.getByTestId('login-identifier').fill(adminEmail);
    await page.getByTestId('login-password').fill(adminPassword);
    await page.getByTestId('login-submit').click();

    await page.waitForURL('**/admin', { timeout: 30_000 });
    await page.goto('/avaliacao/paciente-etapa8-smoke', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /Avaliação completa/i })).toBeVisible();
    await expect(page.getByText('Progresso clínico')).toBeVisible();
    await expect(page.getByText('Próximos passos')).toBeVisible();
    await expect(page.getByRole('button', { name: /Plano alimentar/i }).first()).toBeVisible();

    const stageTabCount = await page.locator('.avaliacao-stage-tab').count();
    expect(stageTabCount).toBeGreaterThan(1);

    const noOverflowDesktop = await page.evaluate(() => (
      document.documentElement.scrollWidth <= (window.innerWidth + 1)
    ));
    expect(noOverflowDesktop).toBeTruthy();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);

    const noOverflowMobile = await page.evaluate(() => (
      document.documentElement.scrollWidth <= (window.innerWidth + 1)
    ));
    expect(noOverflowMobile).toBeTruthy();
  });
});
