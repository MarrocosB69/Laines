#!/usr/bin/env node
// Ferramenta permanente de verificação visual de telas do LAINES.
//
// Sobe o Vite (API createServer, não CLI) numa porta fora do uso comum do
// projeto (não 5173/5174/4173), intercepta a API (a app lê VITE_API_URL) com
// dados sintéticos, navega a rota pedida em várias larguras e mede o que uma
// leitura só de captura de tela não pega: rolagem
// horizontal, texto cortado elemento a elemento, fontes realmente usadas,
// colunas do layout e erros de console que não sejam o 401 esperado das
// chamadas de autenticação sintéticas. Nenhum dado real; nenhum destino
// externo além de Google Fonts.
//
// Uso:
//   node scripts/verificar-tela.mjs --help
//   node scripts/verificar-tela.mjs --rota=/ --rodada=antes
//
// Ver .claude/skills/laines-verificar-tela/SKILL.md para quando e como usar,
// e como ler o relatório.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const AJUDA = `
Uso: node scripts/verificar-tela.mjs [opções]

Sobe o app (Vite, via API — não o servidor de outra pessoa) numa porta
descartável, navega até a rota pedida com uma API sintética interceptada, e
mede defeitos que uma captura de tela sozinha não revela.

Opções:
  --rota=<caminho>        Rota da SPA a visitar. Padrão: /
  --larguras=<lista>      Larguras de viewport em px, separadas por vírgula.
                          Padrão: 1280,768,390,320
  --saida=<pasta>         Pasta onde salvar capturas e relatório.
                          Padrão: tmp/verificar-tela
  --rodada=<nome>         Prefixo desta execução nos arquivos, para não
                          sobrescrever capturas de uma rodada anterior.
                          Padrão: carimbo de data/hora desta execução.
  --papel=<papel>         Sessão sintética autenticada: aluno, professor,
                          tecnico, atleta ou admin. Mocka GET /auth/me com um
                          usuário de exemplo e suas capabilities. Sem esta
                          opção, a navegação é anônima (como em /).
  --seletor=<css>         Seletor cuja presença com conteúdo indica que a
                          página renderizou. Padrão: #root
  --espera=<ms>           Espera adicional após o seletor aparecer, para
                          fontes e dados assentarem. Padrão: 1200
  --raiz=<pasta>          Pasta que o Vite serve como raiz. Use para apontar
                          para uma cópia/fixture fora do repositório (prova
                          de detecção, por exemplo). Padrão: diretório atual.
  --porta=<n>             Porta inicial do Vite. Padrão: 57431, uma porta fora
                          do uso comum do projeto (5173/5174/4173). Se estiver
                          ocupada, o Vite sobe na próxima livre (strictPort
                          desligado) — não use 0: o Vite trata porta 0 como
                          "não informada" e volta ao padrão 5173, colidindo
                          com qualquer outro Vite já rodando.
  -h, --help              Mostra esta ajuda e sai sem abrir navegador.

Saída:
  <saida>/<rodada>__w<largura>__pagina.png             página inteira, rolada
  <saida>/<rodada>__w<largura>__foco.png                foco no 1º campo
  <saida>/<rodada>__w<largura>__modal-acesso.png        só na rota /
  <saida>/<rodada>__w<largura>__modal-recuperacao.png   só na rota /
  <saida>/<rodada>__relatorio.json                      medidas de todas as larguras

Código de saída: 0 se nenhuma largura tiver rolagem horizontal, texto
cortado ou erro de console inesperado; 1 caso contrário (ou se a execução
falhar). Nenhum processo do Vite ou do Chromium fica vivo ao final, mesmo em
falha ou com Ctrl+C.

Exemplos:
  node scripts/verificar-tela.mjs --rota=/ --rodada=antes --saida=docs/design/landing-v2/antes
  node scripts/verificar-tela.mjs --rota=/aluno --papel=aluno --rodada=onda3
`;

// Áreas da Liga, espelhando src/constants/capabilities.js só para preencher
// o formato do dado sintético — não importa o módulo de src/ (fronteira).
const LIGA_AREAS = ['ensino', 'pesquisa', 'extensao', 'comunicacao'];
const gestaoVazia = () => ({
  painel: false, usuarios: false, solicitacoes: false, pacientes: false, configuracoes: false,
  relatorios: { painel: false, operacional: false, detalhado: false, exportacao: false }
});

// Usuários sintéticos para --papel. Formato de `capabilities` conforme o
// contrato do servidor (server/src/auth/authorization.ts, projetado por
// /auth/me) — a interface só consome, nunca decide acesso por conta própria.
const PERFIS = {
  aluno: {
    id: 'sint-aluno-1', name: 'Aluno Exemplo', nome: 'Aluno Exemplo',
    email: 'aluno.exemplo@laines.ufrn.br', role: 'aluno',
    mustChangePassword: false, passwordChanged: true,
    capabilities: {
      liga: { leitura: true, areas: LIGA_AREAS, gerencia: [], aprovaConteudo: false },
      atendimento: { habilitado: true, escopo: 'vinculo', motivo: null, criaPaciente: false, gerenciaVinculos: false, revisaPlano: false },
      gestao: gestaoVazia(),
      acessoClinicoGestao: false
    }
  },
  professor: {
    id: 'sint-professor-1', name: 'Professor Exemplo', nome: 'Professor Exemplo',
    email: 'professor.exemplo@laines.ufrn.br', role: 'professor',
    mustChangePassword: false, passwordChanged: true,
    capabilities: {
      liga: { leitura: true, areas: LIGA_AREAS, gerencia: [], aprovaConteudo: false },
      atendimento: { habilitado: true, escopo: 'vinculo', motivo: null, criaPaciente: true, gerenciaVinculos: false, revisaPlano: true },
      gestao: gestaoVazia(),
      acessoClinicoGestao: false
    }
  },
  tecnico: {
    id: 'sint-tecnico-1', name: 'Técnico Exemplo', nome: 'Técnico Exemplo',
    email: 'tecnico.exemplo@laines.ufrn.br', role: 'tecnico',
    mustChangePassword: false, passwordChanged: true,
    capabilities: {
      liga: { leitura: true, areas: LIGA_AREAS, gerencia: [], aprovaConteudo: false },
      atendimento: { habilitado: true, escopo: 'vinculo', motivo: null, criaPaciente: false, gerenciaVinculos: false, revisaPlano: false },
      gestao: gestaoVazia(),
      acessoClinicoGestao: false
    }
  },
  atleta: {
    id: 'sint-atleta-1', name: 'Atleta Exemplo', nome: 'Atleta Exemplo',
    email: 'atleta.exemplo@laines.ufrn.br', role: 'atleta',
    mustChangePassword: false, passwordChanged: true,
    capabilities: {
      liga: { leitura: false, areas: [], gerencia: [], aprovaConteudo: false },
      atendimento: { habilitado: true, escopo: 'proprio', motivo: null, criaPaciente: false, gerenciaVinculos: false, revisaPlano: false },
      gestao: gestaoVazia(),
      acessoClinicoGestao: false
    }
  },
  admin: {
    id: 'sint-admin-1', name: 'Admin Exemplo', nome: 'Admin Exemplo',
    email: 'admin.exemplo@laines.ufrn.br', role: 'admin',
    mustChangePassword: false, passwordChanged: true,
    capabilities: {
      liga: { leitura: true, areas: LIGA_AREAS, gerencia: [...LIGA_AREAS], aprovaConteudo: true },
      atendimento: { habilitado: true, escopo: 'gestao', motivo: null, criaPaciente: true, gerenciaVinculos: true, revisaPlano: false },
      gestao: { painel: true, usuarios: true, solicitacoes: true, pacientes: true, configuracoes: true, relatorios: { painel: true, operacional: true, detalhado: true, exportacao: true } },
      acessoClinicoGestao: true
    }
  }
};

// Mensagens de console esperadas do 401 sintético de /auth/* — não contam
// como defeito. Qualquer outro erro de console é reportado como inesperado.
const ESPERADO_401 = /(\b401\b|unauthorized|sem sess[aã]o|\/auth\/me|\/auth\/refresh)/i;

function parseArgs(argv) {
  const args = {
    rota: '/',
    larguras: [1280, 768, 390, 320],
    saida: path.join('tmp', 'verificar-tela'),
    rodada: new Date().toISOString().replace(/[:.]/g, '-'),
    papel: '',
    seletor: '#root',
    espera: 1200,
    raiz: process.cwd(),
    // Vite trata port:0 como "não informado" e cai no padrão 5173 (não pede
    // uma porta ao sistema operacional) — por isso o padrão aqui é uma porta
    // alta e específica, fora do uso comum do projeto, com strictPort
    // desligado para subir na próxima livre se esta estiver ocupada.
    porta: 57431,
    ajuda: false
  };

  for (const bruto of argv) {
    if (bruto === '-h' || bruto === '--help') { args.ajuda = true; continue; }
    const m = /^--([^=]+)=(.*)$/.exec(bruto);
    if (!m) throw new Error(`Argumento não reconhecido: "${bruto}". Use --chave=valor. Veja --help.`);
    const [, chave, valor] = m;
    switch (chave) {
      case 'rota': args.rota = valor.startsWith('/') ? valor : `/${valor}`; break;
      case 'larguras':
        args.larguras = valor.split(',').map((v) => Number(v.trim())).filter((n) => Number.isFinite(n) && n > 0);
        break;
      case 'saida': args.saida = valor; break;
      case 'rodada': args.rodada = valor; break;
      case 'papel': args.papel = valor; break;
      case 'seletor': args.seletor = valor; break;
      case 'espera': args.espera = Number(valor); break;
      case 'raiz': args.raiz = path.resolve(valor); break;
      case 'porta': args.porta = Number(valor); break;
      default: throw new Error(`Argumento desconhecido: --${chave}. Veja --help.`);
    }
  }

  if (args.papel && !PERFIS[args.papel]) {
    throw new Error(`--papel deve ser um de: ${Object.keys(PERFIS).join(', ')}.`);
  }
  if (!args.larguras.length) throw new Error('--larguras precisa de ao menos um número válido.');
  if (!args.rodada.trim()) throw new Error('--rodada não pode ser vazio.');
  if (!Number.isInteger(args.porta) || args.porta <= 0) {
    // Vite trata port:0 como "não informado" e volta ao padrão 5173 — não é
    // "o sistema escolhe uma porta livre" como seria com um socket TCP puro.
    throw new Error('--porta precisa ser um inteiro positivo (o Vite não aceita 0 como "porta livre qualquer").');
  }

  return args;
}

// Altura de viewport por largura — aproximação (desktop/tablet/celular);
// não crítica para as medidas, só para a proporção da captura.
function alturaParaLargura(largura) {
  if (largura >= 1200) return 800;
  if (largura >= 760) return 1024;
  return 844;
}

function construirRoteador({ apiOrigin, papel }) {
  const usuarioSintetico = papel ? PERFIS[papel] : null;

  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());

    if (url.origin === apiOrigin) {
      const caminho = url.pathname;
      if (usuarioSintetico && caminho.endsWith('/auth/me') && req.method() === 'GET') {
        return route.fulfill({ json: usuarioSintetico });
      }
      if (caminho.endsWith('/public/stats')) {
        return route.fulfill({ json: { atletas: 48, avaliacoes: 312, membros: 37 } });
      }
      if (caminho.endsWith('/projetos/public')) {
        return route.fulfill({ json: [{ id: 'p1', nome: 'Projeto sintético de extensão', status: 'ativo' }] });
      }
      if (caminho.includes('/auth/')) {
        return route.fulfill({ status: 401, json: { message: 'Sem sessão (sintético)' } });
      }
      // Endpoint não mapeado por esta ferramenta. Ver limite documentado na
      // skill: telas internas de onda futura precisam de mocks próprios.
      return route.fulfill({ status: 404, json: { message: 'Rota não mapeada pela verificação sintética' } });
    }

    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) return route.continue();
    return route.abort();
  };
}

// Roda no navegador via page.evaluate — não pode referenciar nada do escopo
// externo do Node.
function medirDom() {
  const doc = document.documentElement;
  const todos = [...document.querySelectorAll('body *')];

  // Visível e com texto próprio (nó de texto direto, não só descendentes) —
  // o mesmo critério serve para corte e para fonte "realmente em uso": um
  // contêiner escondido (display:none) ou sem texto próprio não conta,
  // mesmo que herde font-family de uma variável CSS global.
  const visivelComTexto = (el) => {
    if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const comTexto = todos.filter(visivelComTexto);

  // Rolagem horizontal sozinha não pega conteúdo cortado dentro do próprio
  // elemento — por isso a checagem elemento a elemento.
  const textoCortado = comTexto.filter((el) => (
    el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > doc.clientWidth + 1
  )).map((el) => ({
    seletor: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).join('.')}` : ''}`,
    texto: el.textContent.trim().slice(0, 40)
  })).slice(0, 20);

  const familiasTipograficasEmUso = [...new Set(comTexto.map((el) => {
    const f = getComputedStyle(el).fontFamily || '';
    return f.split(',')[0].replace(/["']/g, '').trim();
  }))].filter(Boolean).sort();

  // Heurística genérica de colunas do layout principal: entre <main> e
  // qualquer elemento com "grid" na classe, o maior em área que de fato usa
  // display:grid decide o número de colunas.
  const candidatos = [document.querySelector('main'), ...document.querySelectorAll('[class*="grid" i]')].filter(Boolean);
  let colunasLayoutPrincipal = null;
  let maiorArea = 0;
  for (const el of candidatos) {
    const cs = getComputedStyle(el);
    if (!cs.display.includes('grid')) continue;
    const partes = cs.gridTemplateColumns.split(' ').filter(Boolean);
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (partes.length > 0 && area > maiorArea) { maiorArea = area; colunasLayoutPrincipal = partes.length; }
  }

  return {
    rolagemHorizontal: doc.scrollWidth > doc.clientWidth + 1,
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    alturaPagina: doc.scrollHeight,
    familiasTipograficasEmUso,
    colunasLayoutPrincipal,
    textoCortado
  };
}

async function verificarLargura({ browser, baseUrl, rota, largura, apiOrigin, papel, seletorPronto, esperaMs, comModais, saida, rodada }) {
  const rotulo = `w${largura}`;
  const caminhoBase = path.join(saida, `${rodada}__${rotulo}`);
  const context = await browser.newContext({
    viewport: { width: largura, height: alturaParaLargura(largura) },
    reducedMotion: 'reduce'
  });
  const page = await context.newPage();

  const errosConsole = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errosConsole.push({ texto: msg.text(), local: msg.location() }); });
  page.on('pageerror', (err) => errosConsole.push({ texto: String(err?.message || err), local: null }));

  await page.route('**/*', construirRoteador({ apiOrigin, papel }));

  const arquivos = {};

  try {
    // 90s, não 30s: sob carga de CPU nesta máquina (vários agentes/processos
    // concorrentes), a navegação a um Vite recém-subido já foi observada
    // levando mais de 60s — não é sinal de página quebrada.
    await page.goto(`${baseUrl}${rota}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return !!el && (el.children.length > 0 || el.textContent.trim().length > 0);
    }, seletorPronto, { timeout: 90000 });
    await page.waitForTimeout(esperaMs);
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {});

    // Rolagem instantânea: a página pode usar scroll-behavior:smooth, e uma
    // rolagem animada pode ser capturada no meio do caminho de volta ao topo.
    await page.addStyleTag({ content: '*, *::before, *::after { scroll-behavior: auto !important; }' });

    // Imagens com loading="lazy" só carregam quando entram na tela — desce
    // em passos até o fim (para disparar o carregamento) e volta ao topo.
    await page.evaluate(async () => {
      const alturaTotal = document.body.scrollHeight;
      for (let y = 0; y <= alturaTotal; y += 350) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
      window.scrollTo(0, 0);
    });
    // Bounded: networkidle pode nunca disparar sob carga (ver ORIGEM.md); só
    // damos uma chance curta às imagens recém-disparadas antes da captura.
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

    const medidas = await page.evaluate(medirDom);

    await page.screenshot({ path: `${caminhoBase}__pagina.png`, fullPage: true });
    arquivos.pagina = `${caminhoBase}__pagina.png`;

    const campo = page.locator('input, textarea, select').first();
    if (await campo.count()) {
      await campo.focus();
      await campo.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${caminhoBase}__foco.png` });
      arquivos.foco = `${caminhoBase}__foco.png`;
    } else {
      arquivos.foco = null;
    }

    let modalAcesso = 'nao_aplicavel';
    let modalRecuperacao = 'nao_aplicavel';
    if (comModais) {
      const botaoAcesso = page.getByRole('button', { name: /solicitar acesso/i }).first();
      if (await botaoAcesso.count()) {
        await botaoAcesso.click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${caminhoBase}__modal-acesso.png` });
        arquivos.modalAcesso = `${caminhoBase}__modal-acesso.png`;
        modalAcesso = 'capturado';
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      } else {
        modalAcesso = 'nao_encontrado';
      }

      const botaoRecuperar = page.getByRole('button', { name: /esque|recuper/i }).first();
      if (await botaoRecuperar.count()) {
        await botaoRecuperar.click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${caminhoBase}__modal-recuperacao.png` });
        arquivos.modalRecuperacao = `${caminhoBase}__modal-recuperacao.png`;
        modalRecuperacao = 'capturado';
      } else {
        modalRecuperacao = 'nao_encontrado';
      }
    }

    const errosConsoleInesperados = errosConsole.filter((e) => !ESPERADO_401.test(e.texto));

    return {
      largura,
      rotulo,
      ...medidas,
      modalAcesso,
      modalRecuperacao,
      arquivos,
      errosConsole,
      errosConsoleInesperados
    };
  } finally {
    await context.close().catch(() => {});
  }
}

let servidorAtivo = null;
let navegadorAtivo = null;

process.on('SIGINT', async () => {
  console.error('\n[verificar-tela] interrompido — encerrando Vite e Chromium antes de sair.');
  if (navegadorAtivo) await navegadorAtivo.close().catch(() => {});
  if (servidorAtivo) await servidorAtivo.close().catch(() => {});
  process.exit(130);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.ajuda) {
    console.log(AJUDA);
    return;
  }

  await fs.mkdir(args.saida, { recursive: true });

  const apiOrigin = 'http://127.0.0.1:59999'; // nunca escutado de verdade: só um rótulo para a interceptação
  process.env.VITE_API_URL = apiOrigin;

  const usandoRaizPropria = args.raiz !== process.cwd();
  const comModais = args.rota === '/';

  const relatorio = {
    rota: args.rota,
    rodada: args.rodada,
    papel: args.papel || null,
    geradoEm: new Date().toISOString(),
    larguras: []
  };

  try {
    servidorAtivo = await createServer({
      root: args.raiz,
      configFile: usandoRaizPropria ? false : undefined,
      logLevel: 'error',
      server: { port: args.porta, strictPort: false, host: '127.0.0.1' }
    });
    await servidorAtivo.listen();
    const endereco = servidorAtivo.httpServer?.address();
    const porta = typeof endereco === 'object' && endereco ? endereco.port : args.porta;
    const baseUrl = `http://127.0.0.1:${porta}`;

    navegadorAtivo = await chromium.launch();

    for (const largura of args.larguras) {
      const resultado = await verificarLargura({
        browser: navegadorAtivo,
        baseUrl,
        rota: args.rota,
        largura,
        apiOrigin,
        papel: args.papel,
        seletorPronto: args.seletor,
        esperaMs: args.espera,
        comModais,
        saida: args.saida,
        rodada: args.rodada
      });
      relatorio.larguras.push(resultado);
      const cortes = resultado.textoCortado.length;
      const inesperados = resultado.errosConsoleInesperados.length;
      console.log(`[verificar-tela] ${resultado.rotulo}px — rolagem horizontal: ${resultado.rolagemHorizontal ? 'SIM' : 'não'}, texto cortado: ${cortes}, colunas: ${resultado.colunasLayoutPrincipal ?? 'n/d'}, erros de console inesperados: ${inesperados}`);
    }
  } finally {
    if (navegadorAtivo) { await navegadorAtivo.close().catch(() => {}); navegadorAtivo = null; }
    if (servidorAtivo) { await servidorAtivo.close().catch(() => {}); servidorAtivo = null; }
  }

  const problemas = [];
  for (const l of relatorio.larguras) {
    if (l.rolagemHorizontal) problemas.push(`${l.rotulo}px: rolagem horizontal (scrollWidth ${l.scrollWidth} > clientWidth ${l.clientWidth})`);
    if (l.textoCortado.length) problemas.push(`${l.rotulo}px: ${l.textoCortado.length} elemento(s) com texto cortado`);
    if (l.errosConsoleInesperados.length) problemas.push(`${l.rotulo}px: ${l.errosConsoleInesperados.length} erro(s) de console inesperado(s)`);
  }
  relatorio.problemas = problemas;
  relatorio.ok = problemas.length === 0;

  const relatorioPath = path.join(args.saida, `${args.rodada}__relatorio.json`);
  await fs.writeFile(relatorioPath, JSON.stringify(relatorio, null, 2), 'utf8');

  console.log(`\n[verificar-tela] relatório: ${relatorioPath}`);
  if (problemas.length) {
    console.log(`[verificar-tela] ${problemas.length} problema(s):`);
    problemas.forEach((p) => console.log(`  - ${p}`));
  } else {
    console.log('[verificar-tela] sem problemas detectados.');
  }

  process.exitCode = problemas.length ? 1 : 0;
}

main().catch((erro) => {
  console.error('[verificar-tela] falhou:', erro?.stack || erro?.message || erro);
  process.exitCode = 1;
});
