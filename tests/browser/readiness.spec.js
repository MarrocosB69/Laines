/* global process */
import { test, expect } from '@playwright/test';

const adminEmail = process.env.E2E_ADMIN_EMAIL || process.env.E2E_EMAIL || 'e2e-admin@teste.com';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_PASSWORD || 'e2e-password';

test.describe('Readiness UI', () => {
  test('login admin e logout funcionam', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Entrar na plataforma')).toBeVisible();

    await page.locator('input[placeholder="usuario@laines.ufrn.br"]').fill(adminEmail);
    await page.locator('input[autocomplete="current-password"]').fill(adminPassword);
    await page.getByRole('button', { name: /entrar agora|entrando/i }).click();

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

    await page.locator('input[placeholder="usuario@laines.ufrn.br"]').fill(adminEmail);
    await page.locator('input[autocomplete="current-password"]').fill('senha-errada');
    await page.getByRole('button', { name: /entrar agora|entrando/i }).click();

    const errorAlert = page.locator('.landing-error');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/credenciais|inválid|inválidas|inválido|erro/i);
  });

  test('layout de login responsivo sem overflow horizontal', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Entrar na plataforma')).toBeVisible();

    const noHorizontalOverflow = await page.evaluate(() => (
      document.documentElement.scrollWidth <= (window.innerWidth + 1)
    ));
    expect(noHorizontalOverflow).toBeTruthy();
  });

  test('navegacao por teclado alcanca campos de login', async ({ page }) => {
    await page.goto('/login');

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const loginInputFocused = await page.locator('input[placeholder="usuario@laines.ufrn.br"]').evaluate((element) => element === document.activeElement);
    expect(loginInputFocused).toBeTruthy();

    await page.keyboard.press('Tab');
    const passwordInputFocused = await page.locator('input[autocomplete="current-password"]').evaluate((element) => element === document.activeElement);
    expect(passwordInputFocused).toBeTruthy();
  });
});
