/**
 * playwright-avaliacao-map.js
 * Mapeia e captura screenshots de todas as telas de avaliação do LAINES.
 * Uso: node playwright-avaliacao-map.js
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// ───── Configuração ─────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:4000';
const EMAIL = 'e2e-admin@teste.com';
const PASSWORD = 'e2e-password';
const SCREENSHOTS_DIR = path.join(__dirname, 'playwright-screenshots');
const VIEWPORT = { width: 1440, height: 900 };

// Módulos de avaliação (de evaluationRegistry.js) na ordem de exibição
const EVALUATION_MODULES = [
  { type: 'anamnese_inicial',           label: 'Anamnese Inicial',                  ordem: 1  },
  { type: 'avaliacao_clinica',          label: 'Avaliação Clínica',                 ordem: 2  },
  { type: 'exames_laboratoriais',       label: 'Exames Laboratoriais',              ordem: 3  },
  { type: 'avaliacao_socioeconomica',   label: 'Socioeconômica (EBIA)',             ordem: 4  },
  { type: 'triagem_reds',               label: 'Disponibilidade energética',        ordem: 5  },
  { type: 'perimetros',                 label: 'Perímetros Corporais',              ordem: 7  },
  { type: 'dobras_cutaneas',            label: 'Dobras Cutâneas',                   ordem: 8  },
  { type: 'bioimpedancia',              label: 'Bioimpedância',                     ordem: 9  },
  { type: 'composicao_corporal_integrada', label: 'Composição Corporal Integrada', ordem: 10 },
  { type: 'gasto_energetico_total',     label: 'Gasto Energético Total',            ordem: 11 },
  { type: 'carga_treino',               label: 'Carga de Treino e Periodização',    ordem: 12 },
  { type: 'alimentar',                  label: 'Avaliação Alimentar (NOVA)',         ordem: 13 },
  { type: 'hidratacao',                 label: 'Hidratação',                        ordem: 14 },
  { type: 'psicologia',                 label: 'Psicologia',                        ordem: 16 },
  { type: 'fisioterapia',               label: 'Fisioterapia',                      ordem: 17 },
  { type: 'evolucao_retorno',           label: 'Evolução / Retorno',                ordem: 18 },
];

// Telas extras (não dentro de AvaliacaoCompleta)
const EXTRA_SCREENS = [
  { id: 'login',        label: 'Login',                    url: '/login' },
  { id: 'painel-aluno', label: 'Painel do Aluno',          url: '/aluno' },
  { id: 'painel-admin', label: 'Painel do Admin',          url: '/admin' },
];

// ───── Utilitários ────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slugify(str) {
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function getFirstPatientId(token) {
  const http = require('http');
  return new Promise((resolve, reject) => {
    const req = http.get(
      `${API_URL}/pacientes?limit=5`,
      { headers: { Authorization: `Bearer ${token}` } },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const items = Array.isArray(json) ? json : (json.data || []);
            // Preferir paciente CI Vinculado (21111111...)
            const ci = items.find((p) => p.id && p.id.startsWith('21111111'));
            resolve((ci || items[0] || {}).id || null);
          } catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
  });
}

async function getOrCreateAvaliacao(token, pacienteId) {
  const http = require('http');
  // Buscar avaliações existentes do paciente
  const list = await new Promise((resolve, reject) => {
    const req = http.get(
      `${API_URL}/avaliacoes?pacienteId=${pacienteId}&limit=10`,
      { headers: { Authorization: `Bearer ${token}` } },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
        });
      }
    );
    req.on('error', () => resolve(null));
  });

  const items = Array.isArray(list) ? list : (list?.data || []);
  if (items.length > 0) {
    console.log(`  → Usando avaliação existente: ${items[0].id}`);
    return items[0].id;
  }

  // Criar nova avaliação
  console.log('  → Criando nova avaliação...');
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ pacienteId, tipo: 'anamnese_inicial', status: 'em_andamento' });
    const url = new URL(`${API_URL}/avaliacoes`);
    const options = {
      hostname: url.hostname,
      port: url.port || 4000,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve(j.id || null);
        } catch (e) { resolve(null); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function waitForPage(page, timeout = 8000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch (_) {
    // não bloquear em timeout
  }
}

// ───── Main ───────────────────────────────────────────────────────────────────
(async () => {
  ensureDir(SCREENSHOTS_DIR);

  console.log('🚀 Iniciando Playwright...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  const results = [];
  const errors = [];

  // ── 1. Login ────────────────────────────────────────────────────────────────
  console.log('\n[1/3] Fazendo login na aplicação...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await waitForPage(page, 5000);

  // Capturar tela de login antes de preencher
  const loginFile = 'tela-login.png';
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, loginFile), fullPage: true });
  results.push({ id: 'login', label: 'Tela de Login', file: loginFile, url: '/login', status: 'ok' });
  console.log('  → Screenshot: tela-login.png');

  // Preencher credenciais
  try {
    await page.fill('input[type="email"], input[name="email"]', EMAIL);
    await page.fill('input[type="password"], input[name="password"], input[name="senha"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 10000 });
    console.log('  → Login OK! Redirecionado para:', page.url());
  } catch (e) {
    console.error('  ✗ Falha no login:', e.message);
    errors.push({ id: 'login', error: e.message });
    await browser.close();
    process.exit(1);
  }

  // Capturar painel pós-login
  await waitForPage(page, 5000);
  const painelFile = 'tela-painel-admin.png';
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, painelFile), fullPage: true });
  results.push({ id: 'painel-admin', label: 'Painel do Admin', file: painelFile, url: page.url(), status: 'ok' });
  console.log('  → Screenshot: tela-painel-admin.png');

  // ── 2. Obter token via localStorage e buscar paciente ──────────────────────
  console.log('\n[2/3] Buscando paciente e avaliação para navegar...');
  const token = await page.evaluate(() => {
    // Tentar várias chaves de storage
    for (const key of ['laines_access_token', 'access_token', 'token', 'accessToken']) {
      const v = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (v && v.length > 20) return v;
    }
    // Tentar via cookie ou extrair do state
    return null;
  });

  // Se não encontrou no storage, usar a API diretamente para obter token
  let apiToken = token;
  if (!apiToken) {
    console.log('  → Token não encontrado no storage, usando API direta...');
    const http = require('http');
    apiToken = await new Promise((resolve) => {
      const body = JSON.stringify({ email: EMAIL, password: PASSWORD });
      const req = http.request({
        hostname: 'localhost', port: 4000, path: '/auth/login', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => { try { resolve(JSON.parse(d).accessToken); } catch (_) { resolve(null); } });
      });
      req.on('error', () => resolve(null));
      req.write(body);
      req.end();
    });
  }

  const pacienteId = await getFirstPatientId(apiToken);
  console.log(`  → Paciente ID: ${pacienteId}`);
  const avaliacaoId = await getOrCreateAvaliacao(apiToken, pacienteId);
  console.log(`  → Avaliação ID: ${avaliacaoId}`);

  // ── 3. Navegar para cada módulo de avaliação ────────────────────────────────
  console.log('\n[3/3] Capturando screenshots dos módulos de avaliação...');

  if (avaliacaoId) {
    for (const mod of EVALUATION_MODULES) {
      const url = `/avaliacao/${avaliacaoId}?modulo=${mod.type}`;
      const filename = `avaliacao-${String(mod.ordem).padStart(2, '0')}-${slugify(mod.label)}.png`;
      console.log(`  → [${mod.ordem}] ${mod.label} → ${url}`);

      try {
        await page.goto(`${BASE_URL}${url}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await waitForPage(page, 7000);

        // Aguardar o conteúdo do formulário aparecer
        await page.waitForTimeout(1500);

        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, filename),
          fullPage: true
        });

        results.push({
          id: mod.type,
          label: mod.label,
          file: filename,
          url,
          ordem: mod.ordem,
          status: 'ok'
        });
        console.log(`     ✓ ${filename}`);
      } catch (e) {
        console.error(`     ✗ Erro em ${mod.label}: ${e.message}`);
        errors.push({ id: mod.type, label: mod.label, url, error: e.message });
        results.push({ id: mod.type, label: mod.label, file: null, url, ordem: mod.ordem, status: 'error', error: e.message });
      }
    }
  } else {
    console.warn('  ⚠ Sem avaliação disponível — pulando módulos internos');
  }

  // ── 4. Capturar aluno view ──────────────────────────────────────────────────
  // Logar como aluno para capturar tela /aluno
  const alunoFile = 'tela-painel-aluno.png';
  try {
    const http = require('http');
    const alunoToken = await new Promise((resolve) => {
      const body = JSON.stringify({ email: 'e2e-aluno@teste.com', password: 'e2e-password' });
      const req = http.request({
        hostname: 'localhost', port: 4000, path: '/auth/login', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => { try { resolve(JSON.parse(d).accessToken); } catch (_) { resolve(null); } });
      });
      req.on('error', () => resolve(null));
      req.write(body);
      req.end();
    });
    if (alunoToken) {
      await context.addCookies([]);
      // Usar nova página com contexto de aluno não é trivial; apenas relogar via UI seria melhor
      // Por ora, capturar a /aluno como admin (redireciona para /admin)
    }
  } catch (_) {}

  await browser.close();

  // ── 5. Gerar relatório HTML ──────────────────────────────────────────────────
  console.log('\n📄 Gerando relatório HTML...');

  const okResults = results.filter((r) => r.status === 'ok');
  const errResults = results.filter((r) => r.status === 'error');

  const thumbs = okResults.map((r) => `
    <div class="card">
      <div class="badge">${r.ordem !== undefined ? `#${r.ordem}` : 'Extra'}</div>
      <a href="${r.file}" target="_blank">
        <img src="${r.file}" alt="${r.label}" loading="lazy" />
      </a>
      <div class="card-label">${r.label}</div>
      <div class="card-url"><code>${r.url || ''}</code></div>
    </div>`).join('\n');

  const errHtml = errResults.length === 0 ? '' : `
    <section class="errors">
      <h2>⚠ Erros (${errResults.length})</h2>
      <ul>
        ${errResults.map((e) => `<li><strong>${e.label || e.id}</strong> — ${e.error}</li>`).join('\n')}
      </ul>
    </section>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LAINES — Mapa Visual de Avaliações</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 2rem;
    }
    header {
      text-align: center;
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid #1e293b;
    }
    header h1 { font-size: 2rem; font-weight: 700; color: #f8fafc; margin-bottom: 0.5rem; }
    header p { color: #94a3b8; font-size: 0.95rem; }
    .meta { display: flex; gap: 1.5rem; justify-content: center; margin-top: 1rem; flex-wrap: wrap; }
    .meta-item { background: #1e293b; padding: 0.4rem 1rem; border-radius: 999px; font-size: 0.8rem; color: #94a3b8; }
    .meta-item span { color: #38bdf8; font-weight: 600; }

    h2 { font-size: 1.3rem; color: #94a3b8; margin-bottom: 1.5rem; font-weight: 500;
         letter-spacing: 0.05em; text-transform: uppercase; }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
      max-width: 1600px;
      margin: 0 auto 3rem;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      overflow: hidden;
      transition: transform 0.2s, box-shadow 0.2s;
      position: relative;
    }
    .card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.5); }
    .badge {
      position: absolute; top: 10px; left: 10px;
      background: rgba(15,23,42,0.85);
      color: #38bdf8; font-weight: 700; font-size: 0.75rem;
      padding: 0.2rem 0.6rem; border-radius: 6px;
      border: 1px solid #38bdf833;
      backdrop-filter: blur(4px);
    }
    .card a { display: block; }
    .card img {
      width: 100%; height: 200px; object-fit: cover;
      object-position: top; border-bottom: 1px solid #334155;
      transition: height 0.2s;
    }
    .card:hover img { height: 220px; }
    .card-label {
      padding: 0.75rem 1rem 0.25rem;
      font-weight: 600; font-size: 0.95rem; color: #f1f5f9;
    }
    .card-url {
      padding: 0 1rem 0.75rem;
      font-size: 0.75rem; color: #64748b;
    }
    .card-url code { background: #0f172a; padding: 0.1rem 0.4rem; border-radius: 4px; }

    .errors {
      background: #450a0a; border: 1px solid #7f1d1d;
      border-radius: 12px; padding: 1.5rem;
      max-width: 1600px; margin: 0 auto 3rem;
    }
    .errors h2 { color: #fca5a5; margin-bottom: 1rem; }
    .errors li { padding: 0.4rem 0; color: #fca5a5; }
    .errors li strong { color: #f87171; }

    footer {
      text-align: center; color: #334155; font-size: 0.8rem;
      margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #1e293b;
    }
  </style>
</head>
<body>
  <header>
    <h1>LAINES — Mapa Visual de Avaliações</h1>
    <p>Screenshots capturados automaticamente via Playwright</p>
    <div class="meta">
      <div class="meta-item">Gerado em: <span>${new Date().toLocaleString('pt-BR')}</span></div>
      <div class="meta-item">Total: <span>${okResults.length}</span> telas</div>
      <div class="meta-item">Erros: <span>${errResults.length}</span></div>
      <div class="meta-item">Viewport: <span>1440 × 900</span></div>
    </div>
  </header>

  <h2>Telas Capturadas</h2>
  <div class="grid">
    ${thumbs}
  </div>

  ${errHtml}

  <footer>
    LAINES — Liga Acadêmica Interprofissional de Nutrição Esportiva &nbsp;·&nbsp;
    Gerado por playwright-avaliacao-map.js
  </footer>
</body>
</html>`;

  fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'index.html'), html, 'utf8');
  console.log('  → index.html gerado!');

  // ── 6. Resumo ────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  RESUMO FINAL');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Screenshots OK  : ${okResults.length}`);
  console.log(`  Erros           : ${errResults.length}`);
  console.log(`  Relatório HTML  : ${path.join(SCREENSHOTS_DIR, 'index.html')}`);
  console.log('');
  console.log('  Arquivos gerados:');
  okResults.forEach((r) => console.log(`    ✓ ${r.file}  (${r.label})`));
  if (errResults.length > 0) {
    console.log('\n  Erros:');
    errResults.forEach((e) => console.log(`    ✗ ${e.label || e.id}: ${e.error}`));
  }
  console.log('═══════════════════════════════════════════════════════\n');
})();
