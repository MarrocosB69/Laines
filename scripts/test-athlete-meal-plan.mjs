import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright';

// Component smoke: synthetic HTTP responses only. No credentials or real patients.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'tmp', 'onda1-athlete-meal-plan');
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'index.html'), '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="./preview.jsx"></script></body></html>');
await fs.writeFile(path.join(output, 'preview.jsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import AthleteMealPlan from '/src/views/Athlete/AthleteMealPlan.jsx';
import '/src/index.css';
import '/src/views/Athlete/AthletePortal.css';
createRoot(document.getElementById('root')).render(<main className="athlete-portal"><AthleteMealPlan patientId="00000000-0000-4000-8000-000000000001" /></main>);
`);

const fixture = {
  id: '00000000-0000-4000-8000-000000000002', pacienteId: '00000000-0000-4000-8000-000000000001',
  status: 'ativo', dataInicio: '2026-09-12', dataFim: '2026-10-12',
  entrega: { version: 3, refeicoes: [
    { id: 'ref-1', nome: 'Café da manhã', horario: '07:00', orientacoes: 'Comer com calma.',
      alimentos: [{ descricao: 'Pão integral', quantidadeGramas: 50, quantidadeMedidas: 2, medidaCaseira: 'fatia' },
        { descricao: 'Queijo branco', quantidadeGramas: 30, quantidadeMedidas: 1, medidaCaseira: 'fatia' }],
      substitutos: [{ descricao: 'Tapioca', substitui: 'Pão integral', quantidadeGramas: 40, quantidadeMedidas: 2, medidaCaseira: 'colher de sopa' }] },
    { id: 'ref-2', nome: 'Almoço', horario: '12:00',
      alimentos: [{ descricao: 'Arroz cozido', quantidadeGramas: 100, quantidadeMedidas: 4, medidaCaseira: 'colher de sopa' }], substitutos: [] }
  ] },
  dados: { version: 3, orientacoesGerais: 'Respeite os horários combinados.\nUse as substituições indicadas pela equipe.',
    revisaoFinal: { confirmadoPorNome: 'Revisora sintética', crn: 'TESTE-123', confirmadoEm: '2026-09-12T12:00:00Z' },
    suplementos: [{ nome: 'Suplemento sintético', marca: 'Marca de teste', dose: 'Dose de teste', horario: '15:00' }] }
};
const failures = [];
const checks = [];
let browser;
let server;
try {
  console.log('Starting isolated component server');
  server = await createServer({ root: output, configFile: false, envFile: false, publicDir: false,
    plugins: [react(), tailwindcss()], resolve: { alias: { '/src': path.join(root, 'src') } },
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify('http://127.0.0.1:44100') },
    logLevel: 'error', cacheDir: path.join(root, 'node_modules', '.vite-onda1-meal-plan'),
    optimizeDeps: { entries: ['index.html'] },
    server: { host: '127.0.0.1', port: 54111, strictPort: true, open: false, watch: null, fs: { allow: [root] } } });
  await server.listen();
  console.log('Server ready; opening Chromium');
  const port = server.httpServer.address().port;
  const uiOrigin = `http://127.0.0.1:${port}`;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  let mode = 'plan';
  let version = 3;
  let pdfConflict = false;
  let pdfRequests = 0;
  let downloads = 0;
  let listRequests = 0;
  const pdfVersions = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/planos-alimentares')) {
      if (url.pathname.endsWith('/pdf')) {
        pdfRequests += 1;
        pdfVersions.push(url.searchParams.get('expectedVersion'));
        if (pdfConflict) {
          version = 4;
          await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'Plano atualizado.' }) });
        } else {
          await route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\n% synthetic download fixture\n%%EOF' });
        }
        return;
      }
      listRequests += 1;
      assert.equal(url.searchParams.get('pacienteId'), fixture.pacienteId);
      assert.equal(url.searchParams.get('status'), 'ativo');
      assert.equal(url.searchParams.get('limit'), '2');
      const plan = structuredClone(fixture);
      plan.entrega.version = version;
      plan.dados.version = version;
      if (mode === 'missing-projection') delete plan.entrega;
      if (mode === 'wrong-patient') plan.pacienteId = 'outro-paciente';
      if (mode === 'error') {
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      } else {
        const data = mode === 'empty' ? [] : mode === 'multiple' ? [plan, { ...plan, id: 'outro-plano' }] : [plan];
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
      }
      return;
    }
    if (url.origin === uiOrigin) await route.continue();
    else await route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('download', () => { downloads += 1; });
  const open = async () => {
    await page.goto(`${uiOrigin}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Meu plano alimentar' }).waitFor();
  };
  await open();
  console.log('Component mounted');
  await page.getByText('Plano vigente · Versão 3', { exact: true }).waitFor();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByText('Substituições desta refeição (1)', { exact: true }).click();
    await page.getByText('Tapioca', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await page.getByText('Pão integral', { exact: true }).count(), 1);
    assert.equal(await page.getByText('2 × fatia', { exact: true }).count(), 1);
    assert.equal(await page.getByText('50 g', { exact: true }).count(), 1);
    assert.equal(await page.getByText('Revisado por Revisora sintética · CRN TESTE-123', { exact: true }).count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `Overflow at ${width}px`);
    await page.screenshot({ path: path.join(output, `plano-${width}.png`), fullPage: true });
    await page.getByText('Substituições desta refeição (1)', { exact: true }).click();
    checks.push(`Plano e substituições legíveis sem overflow em ${width}px`);
  }

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar PDF' }).click();
  const downloaded = await downloadPromise;
  assert.equal(downloaded.suggestedFilename(), 'plano-alimentar-v3.pdf');
  assert.equal(pdfVersions.at(-1), '3');
  checks.push('Download solicita expectedVersion exibida e identifica versão no nome');

  pdfConflict = true;
  const beforeLists = listRequests;
  const beforePdfs = pdfRequests;
  const beforeDownloads = downloads;
  await page.getByRole('button', { name: 'Baixar PDF' }).click();
  await page.getByText('Plano vigente · Versão 4', { exact: true }).waitFor();
  await page.getByRole('status').filter({ hasText: 'Confira a versão atual' }).waitFor();
  assert.ok(listRequests > beforeLists);
  assert.equal(pdfRequests, beforePdfs + 1);
  assert.equal(downloads, beforeDownloads);
  checks.push('Conflito 409 recarrega versão atual e não baixa automaticamente');

  mode = 'empty';
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await page.getByText('Nenhum plano alimentar publicado', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Baixar PDF' }).count(), 0);
  checks.push('Ausência de publicação mostra estado vazio sem download');

  mode = 'error';
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await page.getByText('Plano indisponível', { exact: true }).waitFor();
  mode = 'plan';
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await page.getByText('Plano vigente · Versão 4', { exact: true }).waitFor();
  checks.push('Falha de API permite nova tentativa');

  for (const invalid of ['multiple', 'missing-projection', 'wrong-patient']) {
    mode = invalid;
    await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
    await page.getByText('Plano indisponível', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Baixar PDF' }).count(), 0);
    checks.push(`Resposta ${invalid} não apresenta uma prescrição como vigente`);
  }
  assert.deepEqual(failures, []);
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ passed: checks.length, checks, pageErrors: failures,
    scope: 'Componente React real, respostas HTTP sintéticas; não valida autorização Nest, cálculo de porções nem conteúdo real do PDF.' }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks, artifacts: output }, null, 2));
} finally {
  await browser?.close();
  await server?.close();
}
