# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tour-manual.spec.js >> 05 — Avaliacoes >> 05_22 evolucao e retorno clinico
- Location: tests\browser\tour-manual.spec.js:791:3

# Error details

```
Error: page.waitForTimeout: Test ended.
```

# Test source

```ts
  377 |       'button:has-text("Atleta")', 'a:has-text("Atleta")',
  378 |       'button:has-text("Meus Atletas")', '[data-tab="patients"]'
  379 |     ]);
  380 |     await screenshot(page, '04_03_aluno_meus_atletas');
  381 |   });
  382 | 
  383 |   test('04_04 prontuario visao geral', async ({ page }) => {
  384 |     await clicarAba(page, [
  385 |       'button:has-text("Atleta")', 'a:has-text("Atleta")', '[data-tab="patients"]'
  386 |     ]);
  387 |     await page.waitForTimeout(800);
  388 |     const row = page.locator('tr:has-text("Lucas Gabriel"), .patient-row:has-text("Lucas Gabriel"), button:has-text("Lucas Gabriel")').first();
  389 |     if (await row.isVisible({ timeout: 6_000 }).catch(() => false)) {
  390 |       await row.click();
  391 |       await page.waitForTimeout(2200);
  392 |       await screenshot(page, '04_04_aluno_prontuario_visao_geral');
  393 |     }
  394 |   });
  395 | 
  396 |   test('04_05 prontuario aba avaliacoes', async ({ page }) => {
  397 |     await clicarAba(page, [
  398 |       'button:has-text("Atleta")', 'a:has-text("Atleta")', '[data-tab="patients"]'
  399 |     ]);
  400 |     await page.waitForTimeout(800);
  401 |     const row = page.locator('tr:has-text("Lucas Gabriel"), .patient-row:has-text("Lucas Gabriel"), button:has-text("Lucas Gabriel")').first();
  402 |     if (await row.isVisible({ timeout: 6_000 }).catch(() => false)) {
  403 |       await row.click();
  404 |       await page.waitForTimeout(2200);
  405 |       await clicarAba(page, [
  406 |         'button:has-text("Avalia")', 'a:has-text("Avalia")',
  407 |         '[data-prontuario-tab="avaliacoes"]'
  408 |       ]);
  409 |       await screenshot(page, '04_05_aluno_prontuario_avaliacoes');
  410 |     }
  411 |   });
  412 | 
  413 |   test('04_06 prontuario aba situacao clinica', async ({ page }) => {
  414 |     await clicarAba(page, [
  415 |       'button:has-text("Atleta")', 'a:has-text("Atleta")', '[data-tab="patients"]'
  416 |     ]);
  417 |     await page.waitForTimeout(800);
  418 |     const row = page.locator('tr:has-text("Lucas Gabriel"), .patient-row:has-text("Lucas Gabriel"), button:has-text("Lucas Gabriel")').first();
  419 |     if (await row.isVisible({ timeout: 6_000 }).catch(() => false)) {
  420 |       await row.click();
  421 |       await page.waitForTimeout(2200);
  422 |       await clicarAba(page, [
  423 |         'button:has-text("Clínica")', 'button:has-text("Situação")',
  424 |         '[data-prontuario-tab="clinica"]'
  425 |       ]);
  426 |       await screenshot(page, '04_06_aluno_prontuario_situacao_clinica');
  427 |     }
  428 |   });
  429 | 
  430 |   test('04_07 tela de avaliacao completa', async ({ page }) => {
  431 |     await clicarAba(page, [
  432 |       'button:has-text("Atleta")', 'a:has-text("Atleta")', '[data-tab="patients"]'
  433 |     ]);
  434 |     await page.waitForTimeout(800);
  435 |     const row = page.locator('tr:has-text("Lucas Gabriel"), .patient-row:has-text("Lucas Gabriel"), button:has-text("Lucas Gabriel")').first();
  436 |     if (await row.isVisible({ timeout: 6_000 }).catch(() => false)) {
  437 |       await row.click();
  438 |       await page.waitForTimeout(2200);
  439 | 
  440 |       // Tentar abrir avaliação (nova sessão ou continuar)
  441 |       const iniciarBtn = page.getByRole('button', {
  442 |         name: /iniciar sessão|nova sessão|continuar|iniciar avaliação/i
  443 |       }).first();
  444 |       if (await iniciarBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
  445 |         const navPromise = page.waitForURL(/\/avaliacao\//, { timeout: 15_000 }).catch(() => null);
  446 |         await iniciarBtn.click();
  447 |         await navPromise;
  448 |         await page.waitForTimeout(2500);
  449 |         await screenshot(page, '04_07_aluno_avaliacao_completa_visao_geral');
  450 |       }
  451 |     }
  452 |   });
  453 | });
  454 | 
  455 | // ─────────────────────────────────────────────────────────────
  456 | // 05 — AVALIAÇÕES (dentro de /avaliacao/:id)
  457 | // ─────────────────────────────────────────────────────────────
  458 | test.describe('05 — Avaliacoes', () => {
  459 |   let pacienteId = null;
  460 | 
  461 |   // Navega para a tela de avaliação e retorna o ID
  462 |   const abrirAvaliacaoCompleta = async (page) => {
  463 |     await login(page, usuarios.aluno.email);
  464 |     await aguardarRota(page, '/aluno');
  465 | 
  466 |     await clicarAba(page, [
  467 |       'button:has-text("Atleta")', 'a:has-text("Atleta")', '[data-tab="patients"]'
  468 |     ]);
  469 |     await page.waitForTimeout(1000);
  470 | 
  471 |     const row = page.locator(
  472 |       'tr:has-text("Lucas Gabriel"), .patient-row:has-text("Lucas Gabriel"), button:has-text("Lucas Gabriel")'
  473 |     ).first();
  474 |     if (!await row.isVisible({ timeout: 8_000 }).catch(() => false)) return false;
  475 | 
  476 |     await row.click();
> 477 |     await page.waitForTimeout(2500);
      |                ^ Error: page.waitForTimeout: Test ended.
  478 | 
  479 |     const iniciarBtn = page.getByRole('button', {
  480 |       name: /iniciar sessão|nova sessão|continuar|iniciar avaliação/i
  481 |     }).first();
  482 |     if (!await iniciarBtn.isVisible({ timeout: 8_000 }).catch(() => false)) return false;
  483 | 
  484 |     const navPromise = page.waitForURL(/\/avaliacao\//, { timeout: 20_000 });
  485 |     await iniciarBtn.click();
  486 |     await navPromise;
  487 |     await page.waitForTimeout(2500);
  488 | 
  489 |     const url = page.url();
  490 |     const match = url.match(/\/avaliacao\/([^/?#]+)/);
  491 |     if (match) pacienteId = match[1];
  492 |     return true;
  493 |   };
  494 | 
  495 |   const abrirModulo = async (page, labelModulo) => {
  496 |     const btn = page.locator(`button:has-text("${labelModulo}"), .module-item:has-text("${labelModulo}"), li:has-text("${labelModulo}")`).first();
  497 |     if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
  498 |       await btn.click();
  499 |       await page.waitForTimeout(2000);
  500 |       return true;
  501 |     }
  502 |     // Tentar sidebar colapsada
  503 |     const sidebarBtn = page.locator(`[data-module="${labelModulo.toLowerCase()}"], [data-module-id*="anamnese"], .sidebar-module`).first();
  504 |     if (await sidebarBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
  505 |       await sidebarBtn.click();
  506 |       await page.waitForTimeout(2000);
  507 |       return true;
  508 |     }
  509 |     return false;
  510 |   };
  511 | 
  512 |   // ── Anamnese inicial ──────────────────────────────────────
  513 |   test('05_01 anamnese inicial — aba identificacao', async ({ page }) => {
  514 |     const ok = await abrirAvaliacaoCompleta(page);
  515 |     if (!ok) return;
  516 | 
  517 |     await abrirModulo(page, 'Anamnese inicial');
  518 |     await page.waitForTimeout(1500);
  519 | 
  520 |     // Preencher dados de identificação
  521 |     await preencherInput(page, 'input[placeholder*="Nome"], input[name*="nome"]', 'Lucas Gabriel Cunha');
  522 |     await selecionarOption(page, 'select[name*="sexo"], select[name*="biologico"]', 'masculino');
  523 | 
  524 |     // Marcar objetivo
  525 |     const checkPerformance = page.locator('input[type="checkbox"]').filter({ hasText: /performance/i }).first();
  526 |     const labelPerformance = page.locator('label').filter({ hasText: /performance/i }).first();
  527 |     if (await labelPerformance.isVisible({ timeout: 3_000 }).catch(() => false)) {
  528 |       await labelPerformance.click();
  529 |     }
  530 | 
  531 |     await page.waitForTimeout(800);
  532 |     await screenshot(page, '05_01_anamnese_aba_identificacao');
  533 |   });
  534 | 
  535 |   test('05_02 anamnese inicial — aba historico clinico', async ({ page }) => {
  536 |     const ok = await abrirAvaliacaoCompleta(page);
  537 |     if (!ok) return;
  538 |     await abrirModulo(page, 'Anamnese inicial');
  539 |     await page.waitForTimeout(1000);
  540 | 
  541 |     const abaHistorico = page.locator('button:has-text("Histórico clínico"), .anamnese-tab:has-text("Histórico")').first();
  542 |     if (await abaHistorico.isVisible({ timeout: 5_000 }).catch(() => false)) {
  543 |       await abaHistorico.click();
  544 |       await page.waitForTimeout(1200);
  545 |     }
  546 |     await screenshot(page, '05_02_anamnese_aba_historico');
  547 |   });
  548 | 
  549 |   test('05_03 anamnese inicial — aba estilo de vida e esportivo', async ({ page }) => {
  550 |     const ok = await abrirAvaliacaoCompleta(page);
  551 |     if (!ok) return;
  552 |     await abrirModulo(page, 'Anamnese inicial');
  553 |     await page.waitForTimeout(1000);
  554 | 
  555 |     const abaEstilo = page.locator('button:has-text("Estilo"), .anamnese-tab:has-text("Estilo")').first();
  556 |     if (await abaEstilo.isVisible({ timeout: 5_000 }).catch(() => false)) {
  557 |       await abaEstilo.click();
  558 |       await page.waitForTimeout(1200);
  559 |       // Preencher contexto esportivo
  560 |       await selecionarOption(page, 'select[value=""], select[name*="modalidade"]', 'natacao');
  561 |       await page.waitForTimeout(500);
  562 |     }
  563 |     await screenshot(page, '05_03_anamnese_aba_estilo_esportivo');
  564 |   });
  565 | 
  566 |   test('05_04 anamnese inicial — aba historico familiar e resumo de risco', async ({ page }) => {
  567 |     const ok = await abrirAvaliacaoCompleta(page);
  568 |     if (!ok) return;
  569 |     await abrirModulo(page, 'Anamnese inicial');
  570 |     await page.waitForTimeout(1000);
  571 | 
  572 |     const abaFamiliar = page.locator('button:has-text("familiar"), .anamnese-tab:has-text("familiar")').first();
  573 |     if (await abaFamiliar.isVisible({ timeout: 5_000 }).catch(() => false)) {
  574 |       await abaFamiliar.click();
  575 |       await page.waitForTimeout(1200);
  576 |     }
  577 |     await screenshot(page, '05_04_anamnese_aba_familiar_risco');
```