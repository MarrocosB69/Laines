/* global process */
import { test, expect } from 'playwright/test';
import path from 'path';
import fs from 'fs';

// Credenciais dos usuários de teste
const usuarios = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'e2e-admin@teste.com',
    senha: process.env.E2E_ADMIN_PASSWORD || 'e2e-password',
    role: 'admin',
    rotaEsperada: '/admin'
  },
  professor: {
    email: process.env.E2E_PROFESSOR_EMAIL || 'e2e-prof@teste.com',
    senha: process.env.E2E_PROFESSOR_PASSWORD || 'e2e-password',
    role: 'professor',
    rotaEsperada: '/professor'
  },
  aluno: {
    email: process.env.E2E_STUDENT_EMAIL || 'e2e-aluno@teste.com',
    senha: process.env.E2E_STUDENT_PASSWORD || 'e2e-password',
    role: 'aluno',
    rotaEsperada: '/aluno'
  },
  atleta: {
    email: process.env.E2E_ATHLETE_EMAIL || 'e2e-atleta@teste.com',
    senha: process.env.E2E_ATHLETE_PASSWORD || 'e2e-password',
    role: 'atleta',
    rotaEsperada: '/atleta'
  }
};

const SCREENSHOTS_DIR = path.resolve('e2e-artifacts/tour-screenshots');

const screenshot = async (page, nome) => {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
  const arquivo = path.join(SCREENSHOTS_DIR, `${nome}.png`);
  await page.screenshot({ path: arquivo, fullPage: true });
  console.log(`[screenshot] ${arquivo}`);
};

const fazerLogin = async (page, email, senha) => {
  await page.goto('/login');
  await expect(page.getByTestId('login-identifier')).toBeVisible();
  await screenshot(page, `login_tela`);

  await page.getByTestId('login-identifier').fill(email);
  await page.getByTestId('login-password').fill(senha);
  await screenshot(page, `login_preenchido_${email.split('@')[0]}`);
  await page.getByTestId('login-submit').click();
};

const fazerLogout = async (page, role) => {
  const logoutBtn = page.locator('button.laines-sidebar__logout').first();
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await page.waitForURL('**/login', { timeout: 15_000 });
    await screenshot(page, `${role}_logout`);
  }
};

const clicarAba = async (page, seletor, aguardar = 500) => {
  const el = page.locator(seletor).first();
  if (await el.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await el.click();
    await page.waitForTimeout(aguardar);
    return true;
  }
  return false;
};

// ─────────────────────────────────────────────────────────────
// TELA DE LOGIN
// ─────────────────────────────────────────────────────────────
test.describe('Tela de Login', () => {
  test('login - tela inicial', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-identifier')).toBeVisible();
    await screenshot(page, '00_login_inicial');
  });

  test('login - credencial errada exibe erro', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-identifier').fill('invalido@teste.com');
    await page.getByTestId('login-password').fill('senha-errada');
    await page.getByTestId('login-submit').click();
    await page.waitForTimeout(2000);
    await screenshot(page, '00_login_erro_credencial');
  });

  test('login - modal de acesso (solicitacao)', async ({ page }) => {
    await page.goto('/login');
    const btnSolicitar = page.getByRole('button', { name: /solicitar acesso|solicite/i }).first();
    if (await btnSolicitar.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btnSolicitar.click();
      await page.waitForTimeout(1000);
      await screenshot(page, '00_login_modal_solicitar_acesso');

      const modal = page.locator('[aria-labelledby="request-access-modal-title"]');
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        await modal.locator('input[placeholder="Seu nome"]').fill('Carlos Eduardo Ferreira');
        await modal.locator('input[placeholder="000.000.000-00"]').fill('529.982.247-25');
        await modal.locator('input[type="date"]').fill('1995-03-10');
        await modal.locator('input[placeholder="seu@email.com"]').fill('carlos.ferreira@ufrn.br');
        await modal.locator('input[placeholder="(00) 00000-0000"]').fill('(84) 99123-4567');
        await modal.locator('input[placeholder*="Universidade"]').fill('UFRN');
        await modal.locator('textarea').fill('Interesse em acompanhamento nutricional de atletas universitários.');
        await page.waitForTimeout(400);
        await screenshot(page, '00_login_modal_solicitar_acesso_preenchido');
      }

      const btnFechar = page.getByRole('button', { name: /fechar|cancelar/i }).first();
      if (await btnFechar.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btnFechar.click();
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────
test.describe('Perfil Admin', () => {
  test.beforeEach(async ({ page }) => {
    const { email, senha, rotaEsperada } = usuarios.admin;
    await fazerLogin(page, email, senha);
    await page.waitForURL(`**${rotaEsperada}`, { timeout: 30_000 });
  });

  test('admin - dashboard', async ({ page }) => {
    await page.waitForTimeout(1500);
    await screenshot(page, '01_admin_dashboard');
  });

  test('admin - aba membros (usuarios)', async ({ page }) => {
    await clicarAba(page, '[data-tab="users"], button:has-text("Membros"), a:has-text("Membros")');
    await page.waitForTimeout(1500);
    await screenshot(page, '01_admin_membros');
  });

  test('admin - aba atletas (pacientes)', async ({ page }) => {
    await clicarAba(page, '[data-tab="patients"], button:has-text("Atletas"), a:has-text("Atletas")');
    await page.waitForTimeout(1500);
    await screenshot(page, '01_admin_atletas');
  });

  test('admin - aba relatorios', async ({ page }) => {
    await clicarAba(page, '[data-tab="reports"], button:has-text("Relatório"), a:has-text("Relatório")');
    await page.waitForTimeout(1500);
    await screenshot(page, '01_admin_relatorios');
  });

  test('admin - aba pesquisa', async ({ page }) => {
    await clicarAba(page, '[data-tab="research"], button:has-text("Pesquisa"), a:has-text("Pesquisa")');
    await page.waitForTimeout(1500);
    await screenshot(page, '01_admin_pesquisa');
  });

  test('admin - aba ensino', async ({ page }) => {
    await clicarAba(page, '[data-tab="ensino"], button:has-text("Ensino"), a:has-text("Ensino")');
    await page.waitForTimeout(1500);
    await screenshot(page, '01_admin_ensino');
  });

  test('admin - aba extensao', async ({ page }) => {
    await clicarAba(page, '[data-tab="extensao"], button:has-text("Extensão"), a:has-text("Extensão")');
    await page.waitForTimeout(1500);
    await screenshot(page, '01_admin_extensao');
  });

  test('admin - aba solicitacoes', async ({ page }) => {
    await clicarAba(page, '[data-tab="requests"], button:has-text("Solicita"), a:has-text("Solicita")');
    await page.waitForTimeout(1500);
    await screenshot(page, '01_admin_solicitacoes');
  });

  test('admin - aba configuracoes', async ({ page }) => {
    await clicarAba(page, '[data-tab="settings"], button:has-text("Configura"), a:has-text("Configura")');
    await page.waitForTimeout(1500);
    await screenshot(page, '01_admin_configuracoes');
  });

  test('admin - modal novo usuario', async ({ page }) => {
    await clicarAba(page, '[data-tab="users"], button:has-text("Membros"), a:has-text("Membros")');
    await page.waitForTimeout(1000);
    const btnNovo = page.getByRole('button', { name: /novo|adicionar|cadastrar/i }).first();
    if (await btnNovo.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btnNovo.click();
      await page.waitForTimeout(1000);
      await screenshot(page, '01_admin_modal_novo_usuario');

      // Identificação
      await page.fill('input[name="nome"]', 'Juliana Martins Costa');
      await page.fill('input[name="cpf"]', '529.982.247-25');
      await page.fill('input[name="dataNascimento"]', '2001-07-14');
      await screenshot(page, '01_admin_modal_novo_usuario_identificacao');

      // Dados acadêmicos (role padrão: aluno)
      await page.fill('input[name="matricula"]', '20230055123');
      const periodoSel = page.locator('select[name="periodo"]');
      if (await periodoSel.isVisible().catch(() => false)) await periodoSel.selectOption('3º');
      const supervisorSel = page.locator('select[name="supervisorId"]');
      if (await supervisorSel.isVisible().catch(() => false)) {
        const supervisorOpts = await supervisorSel.locator('option[value]:not([value=""])').all();
        if (supervisorOpts.length > 0) {
          const val = await supervisorOpts[0].getAttribute('value');
          if (val) await supervisorSel.selectOption(val);
        }
      }
      const cursoSel = page.locator('select[name="curso"]');
      if (await cursoSel.isVisible().catch(() => false)) await cursoSel.selectOption('nutricao');
      const projetoSel = page.locator('#user-projeto-id');
      if (await projetoSel.isVisible().catch(() => false)) {
        const projetoOpts = await projetoSel.locator('option[value]:not([value=""])').all();
        if (projetoOpts.length > 0) {
          const val = await projetoOpts[0].getAttribute('value');
          if (val) await projetoSel.selectOption(val);
        }
      }
      await page.waitForTimeout(400);
      await screenshot(page, '01_admin_modal_novo_usuario_preenchido');

      const btnFechar = page.getByRole('button', { name: /fechar|cancelar|×/i }).first();
      if (await btnFechar.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btnFechar.click();
      }
    }
  });

  test('admin - modal novo atleta', async ({ page }) => {
    await clicarAba(page, '[data-tab="patients"], button:has-text("Atletas"), a:has-text("Atletas")');
    await page.waitForTimeout(1000);
    const btnNovo = page.getByRole('button', { name: /novo|adicionar|cadastrar/i }).first();
    if (await btnNovo.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btnNovo.click();
      await page.waitForTimeout(1000);
      await screenshot(page, '01_admin_modal_novo_atleta');

      const wizard = page.locator('.athlete-wizard-overlay');
      if (await wizard.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Passo 1 — Dados pessoais
        await page.locator('select[name="genero"]').selectOption('masculino');
        await page.fill('input[name="dataNascimento"]', '2000-04-22');
        await page.fill('input[name="telefone"]', '(84) 98765-4321');
        await page.fill('input[name="cidade"]', 'Natal');
        await page.fill('input[name="estado"]', 'RN');
        await page.waitForTimeout(300);
        await screenshot(page, '01_admin_modal_novo_atleta_passo1');

        // Avançar para passo 2
        await page.getByRole('button', { name: 'Continuar' }).click();
        await page.waitForTimeout(600);

        // Passo 2 — Contexto esportivo
        await page.locator('select[name="modalidade"]').selectOption('futebol');
        await page.waitForTimeout(300);
        const posicaoSel = page.locator('select[name="posicao"]');
        if (await posicaoSel.isVisible().catch(() => false)) await posicaoSel.selectOption('meia');
        await page.locator('select[name="nivel"]').selectOption('semi-pro');
        await page.fill('input[name="clube"]', 'ABC Futebol Clube');
        await page.fill('input[name="frequenciaSemanal"]', '5');
        await page.fill('input[name="duracaoSessao"]', '90');
        await page.locator('select[name="fasePeriodizacao"]').selectOption('temporada');
        await page.waitForTimeout(300);
        await screenshot(page, '01_admin_modal_novo_atleta_passo2');

        // Avançar para passo 3
        await page.getByRole('button', { name: 'Continuar' }).click();
        await page.waitForTimeout(600);

        // Passo 3 — Histórico clínico
        await page.locator('.athlete-wizard-checkbox-grid label').filter({ hasText: 'Performance' }).click();
        const queixaTextarea = page.locator('textarea[name="queixaPrincipal"]');
        if (await queixaTextarea.isVisible().catch(() => false)) {
          await queixaTextarea.fill('Melhora de performance e composição corporal para a temporada.');
        }
        await page.waitForTimeout(300);
        await screenshot(page, '01_admin_modal_novo_atleta_passo3');

        // Avançar para passo 4
        await page.getByRole('button', { name: 'Continuar' }).click();
        await page.waitForTimeout(600);

        // Passo 4 — Estilo de vida
        const sonoInput = page.locator('input[name="sonoHoras"]');
        if (await sonoInput.isVisible().catch(() => false)) await sonoInput.fill('7');
        await page.locator('select[name="alcoolUso"]').selectOption('eventual');
        await page.locator('select[name="tabacoUso"]').selectOption('nao');
        await page.waitForTimeout(300);
        await screenshot(page, '01_admin_modal_novo_atleta_passo4');

        // Wizard não tem botão de cancelar — recarregar para fechar
        await page.reload();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('admin - logout', async ({ page }) => {
    await fazerLogout(page, 'admin');
  });
});

// ─────────────────────────────────────────────────────────────
// PROFESSOR
// ─────────────────────────────────────────────────────────────
test.describe('Perfil Professor', () => {
  test.beforeEach(async ({ page }) => {
    const { email, senha, rotaEsperada } = usuarios.professor;
    await fazerLogin(page, email, senha);
    await page.waitForURL(`**${rotaEsperada}`, { timeout: 30_000 });
  });

  test('professor - dashboard', async ({ page }) => {
    await page.waitForTimeout(1500);
    await screenshot(page, '02_professor_dashboard');
  });

  test('professor - aba alunos e atletas', async ({ page }) => {
    await clicarAba(page, '[data-tab="patients"], button:has-text("Aluno"), a:has-text("Aluno"), button:has-text("Atleta"), a:has-text("Atleta")');
    await page.waitForTimeout(1500);
    await screenshot(page, '02_professor_alunos_atletas');
  });

  test('professor - aba agenda', async ({ page }) => {
    await clicarAba(page, '[data-tab="agenda"], button:has-text("Agenda"), a:has-text("Agenda")');
    await page.waitForTimeout(1500);
    await screenshot(page, '02_professor_agenda');
  });

  test('professor - aba pesquisa', async ({ page }) => {
    await clicarAba(page, '[data-tab="research"], button:has-text("Pesquisa"), a:has-text("Pesquisa")');
    await page.waitForTimeout(1500);
    await screenshot(page, '02_professor_pesquisa');
  });

  test('professor - logout', async ({ page }) => {
    await fazerLogout(page, 'professor');
  });
});

// ─────────────────────────────────────────────────────────────
// ALUNO
// ─────────────────────────────────────────────────────────────
test.describe('Perfil Aluno', () => {
  test.beforeEach(async ({ page }) => {
    const { email, senha, rotaEsperada } = usuarios.aluno;
    await fazerLogin(page, email, senha);
    await page.waitForURL(`**${rotaEsperada}`, { timeout: 30_000 });
  });

  test('aluno - dashboard', async ({ page }) => {
    await page.waitForTimeout(1500);
    await screenshot(page, '03_aluno_dashboard');
  });

  test('aluno - aba meus atletas', async ({ page }) => {
    await clicarAba(page, '[data-tab="patients"], button:has-text("Atleta"), a:has-text("Atleta"), button:has-text("Meus"), a:has-text("Meus")');
    await page.waitForTimeout(1500);
    await screenshot(page, '03_aluno_meus_atletas');
  });

  test('aluno - aba agenda', async ({ page }) => {
    await clicarAba(page, '[data-tab="agenda"], button:has-text("Agenda"), a:has-text("Agenda")');
    await page.waitForTimeout(1500);
    await screenshot(page, '03_aluno_agenda');
  });

  test('aluno - logout', async ({ page }) => {
    await fazerLogout(page, 'aluno');
  });
});

// ─────────────────────────────────────────────────────────────
// ATLETA
// ─────────────────────────────────────────────────────────────
test.describe('Perfil Atleta', () => {
  test.beforeEach(async ({ page }) => {
    const { email, senha, rotaEsperada } = usuarios.atleta;
    await fazerLogin(page, email, senha);
    await page.waitForURL(`**${rotaEsperada}`, { timeout: 30_000 });
  });

  test('atleta - dashboard', async ({ page }) => {
    await page.waitForTimeout(1500);
    await screenshot(page, '04_atleta_dashboard');
  });

  test('atleta - aba prontuario', async ({ page }) => {
    await clicarAba(page, '[data-tab="prontuario"], button:has-text("Prontuário"), a:has-text("Prontuário")');
    await page.waitForTimeout(1500);
    await screenshot(page, '04_atleta_prontuario');
  });

  test('atleta - aba agenda', async ({ page }) => {
    await clicarAba(page, '[data-tab="agenda"], button:has-text("Agenda"), a:has-text("Agenda")');
    await page.waitForTimeout(1500);
    await screenshot(page, '04_atleta_agenda');
  });

  test('atleta - aba avaliacoes', async ({ page }) => {
    await clicarAba(page, '[data-tab="avaliacoes"], button:has-text("Avaliação"), a:has-text("Avaliação")');
    await page.waitForTimeout(1500);
    await screenshot(page, '04_atleta_avaliacoes');
  });

  test('atleta - aba pendencias', async ({ page }) => {
    await clicarAba(page, '[data-tab="pendencias"], button:has-text("Pendência"), a:has-text("Pendência")');
    await page.waitForTimeout(1500);
    await screenshot(page, '04_atleta_pendencias');
  });

  test('atleta - logout', async ({ page }) => {
    await fazerLogout(page, 'atleta');
  });
});

// ─────────────────────────────────────────────────────────────
// PÁGINA 404
// ─────────────────────────────────────────────────────────────
test.describe('Página 404', () => {
  test('rota inexistente exibe 404', async ({ page }) => {
    await page.goto('/rota-que-nao-existe');
    await page.waitForTimeout(1500);
    await screenshot(page, '05_pagina_404');
  });
});
