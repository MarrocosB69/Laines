/* global process */
import { test, expect } from 'playwright/test';

const API_URL = process.env.E2E_API_URL || 'http://localhost:4000';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'e2e-admin@teste.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-password';
const PROFESSOR_EMAIL = process.env.E2E_PROFESSOR_EMAIL || 'e2e-prof@teste.com';
const PROFESSOR_PASSWORD = process.env.E2E_PROFESSOR_PASSWORD || 'e2e-password';

const loginViaApi = async (request, email, password) => {
  const response = await request.post(`${API_URL}/auth/login`, {
    headers: { 'x-auth-flow': 'v2' },
    data: { email, password }
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  const accessToken = String(body?.accessToken || '').trim();
  expect(accessToken).toBeTruthy();
  return {
    accessToken,
    user: body?.user || null
  };
};

const loginViaUi = async (page, email, password, expectedPath) => {
  await page.goto('/login');
  await page.locator('input[placeholder="usuario@laines.ufrn.br"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: /entrar agora|entrando/i }).click();
  await page.waitForURL(`**${expectedPath}`, { timeout: 45_000 });
};

const closeBlockingOverlays = async (page) => {
  const profileOverlay = page.locator('.profile-completion-overlay');
  if (await profileOverlay.isVisible().catch(() => false)) {
    const logoutButton = profileOverlay.getByRole('button', { name: /sair/i }).first();
    if (await logoutButton.isVisible().catch(() => false)) {
      await logoutButton.click();
      await page.waitForURL('**/login', { timeout: 20_000 });
      throw new Error('Perfil E2E bloqueado por overlay de cadastro.');
    }
  }
};

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

test.describe('Realtime headers', () => {
  test('admin recebe notificacao e tarefa sem refresh', async ({ page, request }) => {
    const adminApi = await loginViaApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);

    let createdNotificationId = '';
    let createdTaskId = '';

    try {
      await loginViaUi(page, ADMIN_EMAIL, ADMIN_PASSWORD, '/admin');
      await closeBlockingOverlays(page);

      const notificationButton = page.locator('button.notifications-btn').first();
      await expect(notificationButton).toBeVisible();
      await notificationButton.click();
      await expect(page.locator('.notifications-panel')).toBeVisible();
      await page.waitForTimeout(1500);

      const notificationTitle = `E2E RT notif admin ${Date.now()}`;
      const notificationResponse = await request.post(`${API_URL}/notificacoes`, {
        headers: authHeaders(adminApi.accessToken),
        data: {
          titulo: notificationTitle,
          mensagem: 'validacao realtime admin',
          tipo: 'alerta'
        }
      });
      expect(notificationResponse.ok()).toBeTruthy();
      const createdNotification = await notificationResponse.json();
      createdNotificationId = String(createdNotification?.id || '');

      await expect(
        page.locator('.notifications-panel .panel-title', { hasText: notificationTitle })
      ).toBeVisible({ timeout: 10_000 });

      const tasksButton = page.locator('button.tasks-btn').first();
      await expect(tasksButton).toBeVisible();
      await tasksButton.click();
      await expect(page.locator('.tasks-panel')).toBeVisible();
      await page.waitForTimeout(1500);

      const taskTitle = `E2E RT tarefa admin ${Date.now()}`;
      const taskResponse = await request.post(`${API_URL}/tarefas`, {
        headers: authHeaders(adminApi.accessToken),
        data: {
          title: taskTitle,
          assignedRole: 'admin',
          status: 'pendente'
        }
      });
      expect(taskResponse.ok()).toBeTruthy();
      const createdTask = await taskResponse.json();
      createdTaskId = String(createdTask?.id || '');

      await expect(
        page.locator('.tasks-panel .panel-title', { hasText: taskTitle })
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      if (createdTaskId) {
        await request.delete(`${API_URL}/tarefas/${createdTaskId}`, {
          headers: authHeaders(adminApi.accessToken)
        });
      }
      if (createdNotificationId) {
        await request.delete(`${API_URL}/notificacoes/${createdNotificationId}`, {
          headers: authHeaders(adminApi.accessToken)
        });
      }
    }
  });

  test('professor recebe notificacao direcionada sem refresh', async ({ page, request }) => {
    const adminApi = await loginViaApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const professorApi = await loginViaApi(request, PROFESSOR_EMAIL, PROFESSOR_PASSWORD);

    const professorId = String(professorApi?.user?.id || '').trim();
    expect(professorId).toBeTruthy();

    let createdNotificationId = '';

    try {
      await loginViaUi(page, PROFESSOR_EMAIL, PROFESSOR_PASSWORD, '/professor');
      await closeBlockingOverlays(page);

      const notificationButton = page.locator('button.notifications-btn').first();
      await expect(notificationButton).toBeVisible();
      await notificationButton.click();
      await expect(page.locator('.notifications-panel')).toBeVisible();
      await page.waitForTimeout(1500);

      const notificationTitle = `E2E RT notif professor ${Date.now()}`;
      const notificationResponse = await request.post(`${API_URL}/notificacoes`, {
        headers: authHeaders(adminApi.accessToken),
        data: {
          userId: professorId,
          titulo: notificationTitle,
          mensagem: 'validacao realtime professor',
          tipo: 'info'
        }
      });
      expect(notificationResponse.ok()).toBeTruthy();
      const createdNotification = await notificationResponse.json();
      createdNotificationId = String(createdNotification?.id || '');

      await expect(
        page.locator('.notifications-panel .panel-title', { hasText: notificationTitle })
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      if (createdNotificationId) {
        await request.delete(`${API_URL}/notificacoes/${createdNotificationId}`, {
          headers: authHeaders(adminApi.accessToken)
        });
      }
    }
  });
});
