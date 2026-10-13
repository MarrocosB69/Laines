/* global process */
/**
 * Manual LAINES — captura de screenshots para o manual do usuário.
 *
 * Credenciais: usuários criados por seed-print-users.ts
 * Senha padrão: PrintsLAINES#2026
 *
 * Execute com:
 *   npx playwright test --config playwright.manual.config.mjs
 */
import { test, expect } from 'playwright/test';
import path from 'path';
import fs from 'fs';

// ─────────────────────────────────────────────────────────────
// CONFIGURAÇÃO
// ─────────────────────────────────────────────────────────────
const SCREENSHOTS_DIR = path.resolve('e2e-artifacts/manual-screenshots');
const SENHA = process.env.PRINT_SCREENSHOT_PASSWORD || 'PrintsLAINES#2026';

const usuarios = {
  admin:      { email: 'print.admin@laines.ufrn.br',       rota: '/admin' },
  professor:  { email: 'print.professor@laines.ufrn.br',   rota: '/professor' },
  aluno:      { email: 'print.aluno@laines.ufrn.br',       rota: '/aluno' },
  atleta:     { email: 'print.atleta@laines.ufrn.br',      rota: '/atleta' },
  tecnico:    { email: 'print.tecnico@laines.ufrn.br',     rota: '/equipe' },
  presidente: { email: 'print.presidente@laines.ufrn.br',  rota: '/admin' },
};

// ─────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────────
const screenshot = async (page, nome) => {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const arquivo = path.join(SCREENSHOTS_DIR, `${nome}.png`);
  await page.screenshot({ path: arquivo, fullPage: true });
  console.log(`[print] ${nome}.png`);
};

const login = async (page, email) => {
  await page.goto('/login');
  await expect(page.getByText(/entrar na plataforma/i)).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="email"], input[placeholder*="ufrn.br"]').fill(email);
  await page.locator('input[type="password"], input[autocomplete="current-password"]').fill(SENHA);
  await page.getByRole('button', { name: /entrar agora|entrando/i }).click();
};

const aguardarRota = async (page, rota) => {
  await page.waitForURL(`**${rota}`, { timeout: 30_000 });
  await page.waitForTimeout(1800);
};

const clicarAba = async (page, seletores, aguardar = 1500) => {
  const lista = Array.isArray(seletores) ? seletores : [seletores];
  for (const seletor of lista) {
    const el = page.locator(seletor).first();
    if (await el.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await el.click();
      await page.waitForTimeout(aguardar);
      return true;
    }
  }
  return false;
};



const fecharModal = async (page) => {
  const seletores = [
    'button[aria-label="Fechar"]',
    'button:has-text("Cancelar")',
    'button:has-text("Fechar")',
    '.modal-close',
    '[data-modal-close]'
  ];
  for (const s of seletores) {
    const el = page.locator(s).first();
    if (await el.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await el.click();
      await page.waitForTimeout(600);
      return;
    }
  }
};

const preencherInput = async (page, seletor, valor) => {
  const el = page.locator(seletor).first();
  if (await el.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await el.fill(String(valor));
  }
};

const selecionarOption = async (page, seletor, valor) => {
  const el = page.locator(seletor).first();
  if (await el.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await el.selectOption(valor);
  }
};

// ─────────────────────────────────────────────────────────────
// 00 — TELA DE LOGIN
// ─────────────────────────────────────────────────────────────
test.describe('00 — Login', () => {
  test('00_01 tela inicial do login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(/entrar na plataforma/i)).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1000);
    await screenshot(page, '00_01_login_tela_inicial');
  });

  test('00_02 campo preenchido antes de entrar', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(600);
    await page.locator('input[type="email"], input[placeholder*="ufrn.br"]').fill('ana.silva@laines.ufrn.br');
    await page.locator('input[type="password"], input[autocomplete="current-password"]').fill('••••••••••••••••');
    await screenshot(page, '00_02_login_preenchido');
  });

  test('00_03 modal de solicitar acesso', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(600);
    const btn = page.getByRole('button', { name: /solicitar acesso|solicite/i }).first();
    if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1000);
      await screenshot(page, '00_03_login_solicitar_acesso');
    }
  });

  test('00_04 credencial errada exibe mensagem', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(600);
    await page.locator('input[type="email"], input[placeholder*="ufrn.br"]').fill('invalido@laines.ufrn.br');
    await page.locator('input[type="password"], input[autocomplete="current-password"]').fill('senhaerrada');
    await page.getByRole('button', { name: /entrar agora|entrando/i }).click();
    await page.waitForTimeout(2500);
    await screenshot(page, '00_04_login_erro_credencial');
  });
});

// ─────────────────────────────────────────────────────────────
// 01 — ADMIN / COORDENAÇÃO
// ─────────────────────────────────────────────────────────────
test.describe('01 — Admin', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, usuarios.admin.email);
    await aguardarRota(page, '/admin');
  });

  test('01_01 dashboard do admin', async ({ page }) => {
    await screenshot(page, '01_01_admin_dashboard');
  });

  test('01_02 aba membros (usuarios)', async ({ page }) => {
    await clicarAba(page, [
      'button:has-text("Membros")', 'a:has-text("Membros")',
      '[data-tab="users"]'
    ]);
    await screenshot(page, '01_02_admin_membros_lista');
  });

  test('01_03 modal novo membro — formulario vazio', async ({ page }) => {
    await clicarAba(page, ['button:has-text("Membros")', 'a:has-text("Membros")', '[data-tab="users"]']);
    const btn = page.getByRole('button', { name: /novo membro|novo usuario|adicionar/i }).first();
    if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1200);
      await screenshot(page, '01_03_admin_modal_novo_membro_vazio');
      await fecharModal(page);
    }
  });

  test('01_04 modal novo membro — preenchido com exemplo', async ({ page }) => {
    await clicarAba(page, ['button:has-text("Membros")', 'a:has-text("Membros")', '[data-tab="users"]']);
    const btn = page.getByRole('button', { name: /novo membro|novo usuario|adicionar/i }).first();
    if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1000);

      // Preencher campos comuns de cadastro de membro
      await preencherInput(page, 'input[placeholder*="Nome"], input[name="name"]', 'Joao Pedro Alves');
      await preencherInput(page, 'input[placeholder*="email"], input[type="email"]', 'joao.alves@laines.ufrn.br');
      await preencherInput(page, 'input[placeholder*="CPF"], input[name="cpf"]', '123.456.789-00');
      await selecionarOption(page, 'select[name="role"], select[name="perfil"]', 'aluno');

      await page.waitForTimeout(800);
      await screenshot(page, '01_04_admin_modal_novo_membro_preenchido');
      await fecharModal(page);
    }
  });

  test('01_05 aba atletas', async ({ page }) => {
    await clicarAba(page, [
      'button:has-text("Atletas")', 'a:has-text("Atletas")',
      '[data-tab="patients"]'
    ]);
    await screenshot(page, '01_05_admin_atletas_lista');
  });

  test('01_06 wizard novo atleta — passo 1 identificacao', async ({ page }) => {
    await clicarAba(page, ['button:has-text("Atletas")', 'a:has-text("Atletas")', '[data-tab="patients"]']);
    const btn = page.getByRole('button', { name: /novo atleta|cadastrar atleta/i }).first();
    if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1200);
      await screenshot(page, '01_06_admin_wizard_atleta_passo1');
    }
  });

  test('01_07 wizard novo atleta — passo 2 esporte', async ({ page }) => {
    await clicarAba(page, ['button:has-text("Atletas")', 'a:has-text("Atletas")', '[data-tab="patients"]']);
    const btn = page.getByRole('button', { name: /novo atleta|cadastrar atleta/i }).first();
    if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1000);

      // Preencher passo 1
      await preencherInput(page, 'input[name="nome"], input[placeholder*="Nome"]', 'Maria Fernanda Lima');
      await preencherInput(page, 'input[name="cpf"], input[placeholder*="CPF"]', '000.111.222-33');
      await preencherInput(page, 'input[type="date"][name="dataNascimento"], input[placeholder*="nascimento"]', '1998-03-21');

      const proximoBtn = page.getByRole('button', { name: /proximo|continuar|next/i }).first();
      if (await proximoBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await proximoBtn.click();
        await page.waitForTimeout(1200);
        await screenshot(page, '01_07_admin_wizard_atleta_passo2');
      }
    }
  });

  test('01_08 wizard novo atleta — passo 3 projeto', async ({ page }) => {
    await clicarAba(page, ['button:has-text("Atletas")', 'a:has-text("Atletas")', '[data-tab="patients"]']);
    const btn = page.getByRole('button', { name: /novo atleta|cadastrar atleta/i }).first();
    if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1000);

      await preencherInput(page, 'input[name="nome"], input[placeholder*="Nome"]', 'Maria Fernanda Lima');
      const prox1 = page.getByRole('button', { name: /proximo|continuar/i }).first();
      if (await prox1.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await prox1.click();
        await page.waitForTimeout(800);
        const prox2 = page.getByRole('button', { name: /proximo|continuar/i }).first();
        if (await prox2.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await prox2.click();
          await page.waitForTimeout(1200);
          await screenshot(page, '01_08_admin_wizard_atleta_passo3');
        }
      }
    }
    await fecharModal(page);
  });

  test('01_09 aba relatorios', async ({ page }) => {
    await clicarAba(page, ['button:has-text("Relatório")', 'a:has-text("Relatório")', '[data-tab="reports"]']);
    await screenshot(page, '01_09_admin_relatorios');
  });

  test('01_10 aba solicitacoes de acesso', async ({ page }) => {
    await clicarAba(page, ['button:has-text("Solicita")', 'a:has-text("Solicita")', '[data-tab="requests"]']);
    await screenshot(page, '01_10_admin_solicitacoes');
  });

  test('01_11 aba configuracoes', async ({ page }) => {
    await clicarAba(page, ['button:has-text("Configura")', 'a:has-text("Configura")', '[data-tab="settings"]']);
    await screenshot(page, '01_11_admin_configuracoes');
  });
});

// ─────────────────────────────────────────────────────────────
// 02 — PRESIDENTE (acesso duplo)
// ─────────────────────────────────────────────────────────────
test.describe('02 — Presidente', () => {
  test('02_01 dashboard do presidente', async ({ page }) => {
    await login(page, usuarios.presidente.email);
    await aguardarRota(page, '/admin');
    await screenshot(page, '02_01_presidente_dashboard');
  });

  test('02_02 troca de perfil (switcher)', async ({ page }) => {
    await login(page, usuarios.presidente.email);
    await aguardarRota(page, '/admin');
    const switcher = page.locator('.profile-switcher, [data-profile-switch], button:has-text("Perfil")').first();
    if (await switcher.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await switcher.click();
      await page.waitForTimeout(1200);
      await screenshot(page, '02_02_presidente_troca_perfil');
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 03 — PROFESSOR
// ─────────────────────────────────────────────────────────────
test.describe('03 — Professor', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, usuarios.professor.email);
    await aguardarRota(page, '/professor');
  });

  test('03_01 dashboard do professor', async ({ page }) => {
    await screenshot(page, '03_01_professor_dashboard');
  });

  test('03_02 aba turma (alunos)', async ({ page }) => {
    await clicarAba(page, [
      'button:has-text("Turma")', 'a:has-text("Turma")',
      'button:has-text("Aluno")', '[data-tab="students"]'
    ]);
    await screenshot(page, '03_02_professor_turma_alunos');
  });

  test('03_03 aba atletas do professor', async ({ page }) => {
    await clicarAba(page, [
      'button:has-text("Atleta")', 'a:has-text("Atleta")',
      '[data-tab="patients"]'
    ]);
    await screenshot(page, '03_03_professor_atletas');
  });

  test('03_04 prontuario de atleta (aberto pelo professor)', async ({ page }) => {
    await clicarAba(page, [
      'button:has-text("Atleta")', 'a:has-text("Atleta")', '[data-tab="patients"]'
    ]);
    await page.waitForTimeout(800);
    // Clicar no atleta print para abrir prontuário
    const row = page.locator('tr:has-text("Lucas Gabriel"), .patient-row:has-text("Lucas Gabriel"), .atleta-item:has-text("Lucas Gabriel")').first();
    if (await row.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await row.click();
      await page.waitForTimeout(2000);
      await screenshot(page, '03_04_professor_prontuario_atleta');
    }
  });

  test('03_05 aba agenda do professor', async ({ page }) => {
    await clicarAba(page, ['button:has-text("Agenda")', 'a:has-text("Agenda")', '[data-tab="agenda"]']);
    await screenshot(page, '03_05_professor_agenda');
  });

  test('03_06 aba projetos vinculados', async ({ page }) => {
    await clicarAba(page, [
      'button:has-text("Projeto")', 'a:has-text("Projeto")',
      'button:has-text("Pesquisa")', '[data-tab="research"]'
    ]);
    await screenshot(page, '03_06_professor_projetos');
  });
});

// ─────────────────────────────────────────────────────────────
// 04 — ALUNO
// ─────────────────────────────────────────────────────────────
test.describe('04 — Aluno', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, usuarios.aluno.email);
    await aguardarRota(page, '/aluno');
  });

  test('04_01 dashboard do aluno', async ({ page }) => {
    await screenshot(page, '04_01_aluno_dashboard');
  });

  test('04_02 proximas acoes na sidebar', async ({ page }) => {
    // Capturar a sidebar com próximas ações visíveis
    await screenshot(page, '04_02_aluno_proximas_acoes');
  });

  test('04_03 aba meus atletas', async ({ page }) => {
    await clicarAba(page, [
      'button:has-text("Atleta")', 'a:has-text("Atleta")',
      'button:has-text("Meus Atletas")', '[data-tab="patients"]'
    ]);
    await screenshot(page, '04_03_aluno_meus_atletas');
  });

  test('04_04 prontuario visao geral', async ({ page }) => {
    await clicarAba(page, [
      'button:has-text("Atleta")', 'a:has-text("Atleta")', '[data-tab="patients"]'
    ]);
    await page.waitForTimeout(800);
    const row = page.locator('tr:has-text("Lucas Gabriel"), .patient-row:has-text("Lucas Gabriel"), button:has-text("Lucas Gabriel")').first();
    if (await row.isVisible({ timeout: 6_000 }).catch(() => false)) {
      await row.click();
      await page.waitForTimeout(2200);
      await screenshot(page, '04_04_aluno_prontuario_visao_geral');
    }
  });

  test('04_05 prontuario aba avaliacoes', async ({ page }) => {
    await clicarAba(page, [
      'button:has-text("Atleta")', 'a:has-text("Atleta")', '[data-tab="patients"]'
    ]);
    await page.waitForTimeout(800);
    const row = page.locator('tr:has-text("Lucas Gabriel"), .patient-row:has-text("Lucas Gabriel"), button:has-text("Lucas Gabriel")').first();
    if (await row.isVisible({ timeout: 6_000 }).catch(() => false)) {
      await row.click();
      await page.waitForTimeout(2200);
      await clicarAba(page, [
        'button:has-text("Avalia")', 'a:has-text("Avalia")',
        '[data-prontuario-tab="avaliacoes"]'
      ]);
      await screenshot(page, '04_05_aluno_prontuario_avaliacoes');
    }
  });

  test('04_06 prontuario aba situacao clinica', async ({ page }) => {
    await clicarAba(page, [
      'button:has-text("Atleta")', 'a:has-text("Atleta")', '[data-tab="patients"]'
    ]);
    await page.waitForTimeout(800);
    const row = page.locator('tr:has-text("Lucas Gabriel"), .patient-row:has-text("Lucas Gabriel"), button:has-text("Lucas Gabriel")').first();
    if (await row.isVisible({ timeout: 6_000 }).catch(() => false)) {
      await row.click();
      await page.waitForTimeout(2200);
      await clicarAba(page, [
        'button:has-text("Clínica")', 'button:has-text("Situação")',
        '[data-prontuario-tab="clinica"]'
      ]);
      await screenshot(page, '04_06_aluno_prontuario_situacao_clinica');
    }
  });

  test('04_07 tela de avaliacao completa', async ({ page }) => {
    await clicarAba(page, [
      'button:has-text("Atleta")', 'a:has-text("Atleta")', '[data-tab="patients"]'
    ]);
    await page.waitForTimeout(800);
    const row = page.locator('tr:has-text("Lucas Gabriel"), .patient-row:has-text("Lucas Gabriel"), button:has-text("Lucas Gabriel")').first();
    if (await row.isVisible({ timeout: 6_000 }).catch(() => false)) {
      await row.click();
      await page.waitForTimeout(2200);

      // Tentar abrir avaliação (nova sessão ou continuar)
      const iniciarBtn = page.getByRole('button', {
        name: /iniciar sessão|nova sessão|continuar|iniciar avaliação/i
      }).first();
      if (await iniciarBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        const navPromise = page.waitForURL(/\/avaliacao\//, { timeout: 15_000 }).catch(() => null);
        await iniciarBtn.click();
        await navPromise;
        await page.waitForTimeout(2500);
        await screenshot(page, '04_07_aluno_avaliacao_completa_visao_geral');
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 05 — AVALIAÇÕES (dentro de /avaliacao/:id)
// ─────────────────────────────────────────────────────────────
test.describe('05 — Avaliacoes', () => {

  // Navega para a tela de avaliação
  const abrirAvaliacaoCompleta = async (page) => {
    await login(page, usuarios.aluno.email);
    await aguardarRota(page, '/aluno');

    await clicarAba(page, [
      'button:has-text("Atleta")', 'a:has-text("Atleta")', '[data-tab="patients"]'
    ]);
    await page.waitForTimeout(1000);

    const row = page.locator(
      'tr:has-text("Lucas Gabriel"), .patient-row:has-text("Lucas Gabriel"), button:has-text("Lucas Gabriel")'
    ).first();
    if (!await row.isVisible({ timeout: 8_000 }).catch(() => false)) return false;

    await row.click();
    await page.waitForTimeout(2500);

    const iniciarBtn = page.getByRole('button', {
      name: /iniciar sessão|nova sessão|continuar|iniciar avaliação/i
    }).first();
    if (!await iniciarBtn.isVisible({ timeout: 8_000 }).catch(() => false)) return false;

    const navPromise = page.waitForURL(/\/avaliacao\//, { timeout: 20_000 });
    await iniciarBtn.click();
    await navPromise;
    await page.waitForTimeout(2500);

    return true;
  };

  const abrirModulo = async (page, labelModulo) => {
    const btn = page.locator(`button:has-text("${labelModulo}"), .module-item:has-text("${labelModulo}"), li:has-text("${labelModulo}")`).first();
    if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(2000);
      return true;
    }
    // Tentar sidebar colapsada
    const sidebarBtn = page.locator(`[data-module="${labelModulo.toLowerCase()}"], [data-module-id*="anamnese"], .sidebar-module`).first();
    if (await sidebarBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await sidebarBtn.click();
      await page.waitForTimeout(2000);
      return true;
    }
    return false;
  };

  // ── Anamnese inicial ──────────────────────────────────────
  test('05_01 anamnese inicial — aba identificacao', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;

    await abrirModulo(page, 'Anamnese inicial');
    await page.waitForTimeout(1500);

    // Preencher dados de identificação
    await preencherInput(page, 'input[placeholder*="Nome"], input[name*="nome"]', 'Lucas Gabriel Cunha');
    await selecionarOption(page, 'select[name*="sexo"], select[name*="biologico"]', 'masculino');

    // Marcar objetivo
    
    const labelPerformance = page.locator('label').filter({ hasText: /performance/i }).first();
    if (await labelPerformance.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await labelPerformance.click();
    }

    await page.waitForTimeout(800);
    await screenshot(page, '05_01_anamnese_aba_identificacao');
  });

  test('05_02 anamnese inicial — aba historico clinico', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Anamnese inicial');
    await page.waitForTimeout(1000);

    const abaHistorico = page.locator('button:has-text("Histórico clínico"), .anamnese-tab:has-text("Histórico")').first();
    if (await abaHistorico.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await abaHistorico.click();
      await page.waitForTimeout(1200);
    }
    await screenshot(page, '05_02_anamnese_aba_historico');
  });

  test('05_03 anamnese inicial — aba estilo de vida e esportivo', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Anamnese inicial');
    await page.waitForTimeout(1000);

    const abaEstilo = page.locator('button:has-text("Estilo"), .anamnese-tab:has-text("Estilo")').first();
    if (await abaEstilo.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await abaEstilo.click();
      await page.waitForTimeout(1200);
      // Preencher contexto esportivo
      await selecionarOption(page, 'select[value=""], select[name*="modalidade"]', 'natacao');
      await page.waitForTimeout(500);
    }
    await screenshot(page, '05_03_anamnese_aba_estilo_esportivo');
  });

  test('05_04 anamnese inicial — aba historico familiar e resumo de risco', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Anamnese inicial');
    await page.waitForTimeout(1000);

    const abaFamiliar = page.locator('button:has-text("familiar"), .anamnese-tab:has-text("familiar")').first();
    if (await abaFamiliar.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await abaFamiliar.click();
      await page.waitForTimeout(1200);
    }
    await screenshot(page, '05_04_anamnese_aba_familiar_risco');
  });

  // ── Perímetros corporais ──────────────────────────────────
  test('05_05 perimetros corporais — campos obrigatorios', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Perímetros');
    await page.waitForTimeout(1500);

    // Peso e estatura (obrigatórios)
    await preencherInput(page, 'input[placeholder="70,5"], input[placeholder*="peso"], input[name*="peso"]', '78.5');
    await preencherInput(page, 'input[placeholder="165"], input[placeholder*="estatura"], input[name*="estatura"]', '182');
    await page.waitForTimeout(500);
    await screenshot(page, '05_05_perimetros_obrigatorios');
  });

  test('05_06 perimetros corporais — campos opcionais preenchidos', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Perímetros');
    await page.waitForTimeout(1500);

    await preencherInput(page, 'input[name*="pesoKg"], input[placeholder="70,5"]', '78.5');
    await preencherInput(page, 'input[name*="estaturaCm"], input[placeholder="165"]', '182');
    await preencherInput(page, 'input[name*="cintura"]', '82');
    await preencherInput(page, 'input[name*="quadril"]', '98');
    await preencherInput(page, 'input[name*="pescoco"], input[name*="pescocoCm"]', '38');
    await page.waitForTimeout(800);
    await screenshot(page, '05_06_perimetros_campos_opcionais');
  });

  test('05_07 perimetros corporais — resultados calculados', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Perímetros');
    await page.waitForTimeout(1500);

    await preencherInput(page, 'input[name*="pesoKg"], input[placeholder="70,5"]', '78.5');
    await preencherInput(page, 'input[name*="estaturaCm"], input[placeholder="165"]', '182');
    await preencherInput(page, 'input[name*="cintura"]', '82');
    await preencherInput(page, 'input[name*="quadril"]', '98');
    await page.waitForTimeout(1500);
    // Rolar para os resultados
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(600);
    await screenshot(page, '05_07_perimetros_resultados');
  });

  // ── Dobras cutâneas ───────────────────────────────────────
  test('05_08 dobras cutaneas — selecao de protocolo', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Dobras');
    await page.waitForTimeout(1500);
    await screenshot(page, '05_08_dobras_tela_inicial');
  });

  test('05_09 dobras cutaneas — protocolo pollock7 preenchido', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Dobras');
    await page.waitForTimeout(1500);

    await selecionarOption(page, 'select.eval-input', 'pollock7');
    await page.waitForTimeout(800);

    await preencherInput(page, 'input[name*="pesoKg"], .dobras-grid input[placeholder="70,5"]', '78.5');
    await preencherInput(page, 'input[name*="estaturaCm"], .dobras-grid input[placeholder="165"]', '182');
    await preencherInput(page, 'input[name*="idade"], .dobras-grid input[placeholder="32"]', '23');
    await selecionarOption(page, 'select:has(option[value="MASCULINO"])', 'MASCULINO');
    await page.waitForTimeout(500);

    // Preencher dobras do Pollock 7
    const inputs = page.locator('.dobras-grid .eval-input[type="text"][inputmode="decimal"]');
    const valores = ['8.5', '11', '13', '15', '20', '14', '17'];
    const count = await inputs.count();
    for (let i = 0; i < Math.min(count, valores.length); i++) {
      await inputs.nth(i).fill(valores[i]);
    }
    await page.waitForTimeout(1200);
    await screenshot(page, '05_09_dobras_pollock7_preenchido');
  });

  test('05_10 dobras cutaneas — resultados e radar', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Dobras');
    await page.waitForTimeout(1500);

    await selecionarOption(page, 'select.eval-input', 'pollock7');
    await page.waitForTimeout(600);
    await preencherInput(page, '.dobras-grid input[placeholder="70,5"]', '78.5');
    await preencherInput(page, '.dobras-grid input[placeholder="165"]', '182');
    await preencherInput(page, '.dobras-grid input[placeholder="32"]', '23');
    await selecionarOption(page, 'select:has(option[value="MASCULINO"])', 'MASCULINO');
    await page.waitForTimeout(400);
    const inputs = page.locator('.dobras-grid .eval-input[type="text"][inputmode="decimal"]');
    const valores = ['8.5', '11', '13', '15', '20', '14', '17'];
    const count = await inputs.count();
    for (let i = 0; i < Math.min(count, valores.length); i++) {
      await inputs.nth(i).fill(valores[i]);
    }
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(600);
    await screenshot(page, '05_10_dobras_resultados_radar');
  });

  // ── Bioimpedância ─────────────────────────────────────────
  test('05_11 bioimpedancia', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Bioimpedância');
    await page.waitForTimeout(1500);
    await preencherInput(page, 'input[name*="peso"]', '78.5');
    await preencherInput(page, 'input[name*="estatura"], input[name*="altura"]', '182');
    await preencherInput(page, 'input[name*="gordura"], input[name*="percentual"]', '14.2');
    await preencherInput(page, 'input[name*="massa_magra"], input[name*="massaMagra"]', '67.3');
    await page.waitForTimeout(800);
    await screenshot(page, '05_11_bioimpedancia');
  });

  // ── Gasto Energético Total ────────────────────────────────
  test('05_12 gasto energetico total', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Gasto Energético');
    await page.waitForTimeout(1500);
    await screenshot(page, '05_12_gasto_energetico');
  });

  // ── Avaliação Clínica ─────────────────────────────────────
  test('05_13 avaliacao clinica', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Avaliação clínica');
    await page.waitForTimeout(1500);
    await screenshot(page, '05_13_avaliacao_clinica');
  });

  // ── Carga de Treino ───────────────────────────────────────
  test('05_14 carga de treino', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Carga de treino');
    await page.waitForTimeout(1500);
    await screenshot(page, '05_14_carga_treino');
  });

  // ── Avaliação Alimentar ───────────────────────────────────
  test('05_15 avaliacao alimentar', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Alimentar');
    await page.waitForTimeout(1500);
    await screenshot(page, '05_15_avaliacao_alimentar');
  });

  // ── Avaliação de Hidratação ───────────────────────────────
  test('05_16 avaliacao hidratacao', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Hidratação');
    await page.waitForTimeout(1500);
    await screenshot(page, '05_16_avaliacao_hidratacao');
  });

  // ── Disponibilidade energética ────────────────────────────
  test('05_17 disponibilidade energetica', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Disponibilidade energética');
    await page.waitForTimeout(1500);
    await screenshot(page, '05_17_triagem_reds');
  });

  // ── Exames Laboratoriais ──────────────────────────────────
  test('05_18 exames laboratoriais', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Exames');
    await page.waitForTimeout(1500);
    await screenshot(page, '05_18_exames_laboratoriais');
  });

  // ── Avaliação Socioeconômica ──────────────────────────────
  test('05_19 avaliacao socioeconomica', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Socioeconômica');
    await page.waitForTimeout(1500);
    await screenshot(page, '05_19_avaliacao_socioeconomica');
  });

  // ── Fisioterapia ──────────────────────────────────────────
  test('05_20 avaliacao fisioterapia', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Fisioterapia');
    await page.waitForTimeout(1500);
    await screenshot(page, '05_20_avaliacao_fisioterapia');
  });

  // ── Psicologia ────────────────────────────────────────────
  test('05_21 avaliacao psicologia', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Psicologia');
    await page.waitForTimeout(1500);
    await screenshot(page, '05_21_avaliacao_psicologia');
  });

  // ── Evolução / Retorno ────────────────────────────────────
  test('05_22 evolucao e retorno clinico', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Evolução');
    await page.waitForTimeout(1500);
    await screenshot(page, '05_22_evolucao_retorno');
  });

  // ── Composição corporal integrada ─────────────────────────
  test('05_23 composicao corporal integrada', async ({ page }) => {
    const ok = await abrirAvaliacaoCompleta(page);
    if (!ok) return;
    await abrirModulo(page, 'Composição Corporal');
    await page.waitForTimeout(1500);
    await screenshot(page, '05_23_composicao_corporal_integrada');
  });
});

// ─────────────────────────────────────────────────────────────
// 06 — PLANO ALIMENTAR (aluno)
// ─────────────────────────────────────────────────────────────
test.describe('06 — Plano Alimentar', () => {
  test('06_01 tela principal do plano alimentar', async ({ page }) => {
    await login(page, usuarios.aluno.email);
    await aguardarRota(page, '/aluno');

    await clicarAba(page, [
      'button:has-text("Atleta")', 'a:has-text("Atleta")', '[data-tab="patients"]'
    ]);
    await page.waitForTimeout(800);
    const row = page.locator('tr:has-text("Lucas Gabriel"), button:has-text("Lucas Gabriel")').first();
    if (await row.isVisible({ timeout: 6_000 }).catch(() => false)) {
      await row.click();
      await page.waitForTimeout(2000);
      const planoBtn = page.getByRole('button', { name: /plano alimentar/i }).first();
      if (await planoBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        const navPromise = page.waitForURL(/\/planos-alimentares\//, { timeout: 15_000 }).catch(() => null);
        await planoBtn.click();
        await navPromise;
        await page.waitForTimeout(2500);
        await screenshot(page, '06_01_plano_alimentar_tela');
      }
    }
  });

  test('06_02 refeicao builder — adicionar alimento', async ({ page }) => {
    await login(page, usuarios.aluno.email);
    await aguardarRota(page, '/aluno');
    await clicarAba(page, ['button:has-text("Atleta")', '[data-tab="patients"]']);
    await page.waitForTimeout(800);
    const row = page.locator('tr:has-text("Lucas Gabriel"), button:has-text("Lucas Gabriel")').first();
    if (!await row.isVisible({ timeout: 6_000 }).catch(() => false)) return;
    await row.click();
    await page.waitForTimeout(2000);
    const planoBtn = page.getByRole('button', { name: /plano alimentar/i }).first();
    if (!await planoBtn.isVisible({ timeout: 5_000 }).catch(() => false)) return;
    const navPromise = page.waitForURL(/\/planos-alimentares\//, { timeout: 15_000 }).catch(() => null);
    await planoBtn.click();
    await navPromise;
    await page.waitForTimeout(2500);

    // Abrir builder de refeição
    const addRefeicao = page.getByRole('button', { name: /adicionar refeição|nova refeição|adicionar/i }).first();
    if (await addRefeicao.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await addRefeicao.click();
      await page.waitForTimeout(1500);
      await screenshot(page, '06_02_plano_refeicao_builder');
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 07 — ATLETA
// ─────────────────────────────────────────────────────────────
test.describe('07 — Atleta', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, usuarios.atleta.email);
    await aguardarRota(page, '/atleta');
  });

  test('07_01 dashboard do atleta', async ({ page }) => {
    await screenshot(page, '07_01_atleta_dashboard');
  });

  test('07_02 prontuario do atleta (leitura)', async ({ page }) => {
    await clicarAba(page, [
      'button:has-text("Prontuário")', 'a:has-text("Prontuário")',
      '[data-tab="prontuario"]'
    ]);
    await screenshot(page, '07_02_atleta_prontuario');
  });

  test('07_03 agenda do atleta', async ({ page }) => {
    await clicarAba(page, [
      'button:has-text("Agenda")', 'a:has-text("Agenda")',
      '[data-tab="agenda"]'
    ]);
    await screenshot(page, '07_03_atleta_agenda');
  });

  test('07_04 avaliacoes do atleta (resultados)', async ({ page }) => {
    await clicarAba(page, [
      'button:has-text("Avaliação")', 'a:has-text("Avaliação")',
      '[data-tab="avaliacoes"]'
    ]);
    await screenshot(page, '07_04_atleta_avaliacoes');
  });

  test('07_05 pendencias do atleta', async ({ page }) => {
    await clicarAba(page, [
      'button:has-text("Pendência")', 'a:has-text("Pendência")',
      '[data-tab="pendencias"]'
    ]);
    await screenshot(page, '07_05_atleta_pendencias');
  });
});

// ─────────────────────────────────────────────────────────────
// 08 — EQUIPE TÉCNICA
// ─────────────────────────────────────────────────────────────
test.describe('08 — Equipe Tecnica', () => {
  test('08_01 portal da equipe tecnica', async ({ page }) => {
    await login(page, usuarios.tecnico.email);
    await aguardarRota(page, '/equipe');
    await screenshot(page, '08_01_equipe_tecnica_portal');
  });

  test('08_02 atletas da equipe', async ({ page }) => {
    await login(page, usuarios.tecnico.email);
    await aguardarRota(page, '/equipe');
    await clicarAba(page, [
      'button:has-text("Atleta")', 'a:has-text("Atleta")', '[data-tab="atletas"]'
    ]);
    await screenshot(page, '08_02_equipe_tecnica_atletas');
  });
});

// ─────────────────────────────────────────────────────────────
// 09 — EXTRAS
// ─────────────────────────────────────────────────────────────
test.describe('09 — Extras', () => {
  test('09_01 pagina 404', async ({ page }) => {
    await page.goto('/rota-inexistente-manual');
    await page.waitForTimeout(1500);
    await screenshot(page, '09_01_pagina_404');
  });

  test('09_02 logout do sistema', async ({ page }) => {
    await login(page, usuarios.aluno.email);
    await aguardarRota(page, '/aluno');
    const logoutBtn = page.locator('button.laines-sidebar__logout, button[aria-label*="sair"], button:has-text("Sair")').first();
    if (await logoutBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await logoutBtn.click();
      await page.waitForURL('**/login', { timeout: 15_000 });
      await page.waitForTimeout(1000);
      await screenshot(page, '09_02_logout_redirecionado');
    }
  });
});
