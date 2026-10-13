// Capturas, vídeo e medições da direção A2, "Pista em movimento".
//
// Uso (a partir da raiz do repositório):
//   node docs/design/landing-v2/a2-pista/capturar.mjs [pasta-extra]
//
// Grava nesta pasta: pista-1280.png e pista-390.png (estado final, depois da
// entrada), pista-sem-movimento-1280.png (reducedMotion: 'reduce') e
// pista-entrada.webm (a entrada a 1280×800). Se [pasta-extra] for informada,
// grava lá as capturas de conferência: 320 px, página inteira, quadros do meio
// da animação, foco, erro, envio e modal.
//
// Adaptado de ../capturar.mjs. As fontes do Google são baixadas uma vez e
// servidas da memória nas páginas seguintes (page.route), para que o vídeo e
// as capturas não mostrem a fonte de reserva.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const extra = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (extra) fs.mkdirSync(extra, { recursive: true });
const url = pathToFileURL(path.join(aqui, 'index.html')).href;
const FIM_DA_ENTRADA = 3400; // a coreografia termina em ~3,0 s

const medir = () => {
  const vw = document.documentElement.clientWidth;
  const foraDaJanela = [];
  const cortados = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('dialog:not([open])') || el.closest('svg')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden]')) continue;
    const temTexto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!temTexto) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 0.5 || r.left < -0.5) foraDaJanela.push(`${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 40)}"`);
    if (cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) cortados.push(`${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 40)}"`);
    if (cs.whiteSpace === 'nowrap' && el.parentElement) {
      const rp = el.parentElement.getBoundingClientRect();
      if (r.right > rp.right + 0.5) cortados.push(`nowrap ${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 40)}" passa do pai em ${Math.round(r.right - rp.right)} px`);
    }
  }
  const pequenos = [...document.querySelectorAll('button, a, input')]
    .filter((b) => !b.closest('dialog'))
    .map((b) => ({ b, r: b.getBoundingClientRect() }))
    .filter(({ r }) => r.width < 44 || r.height < 44)
    .map(({ b, r }) => `${b.textContent.trim() || b.getAttribute('aria-label') || b.id} ${Math.round(r.width)}×${Math.round(r.height)}`);
  const solidos = [...document.querySelectorAll('button, a')].filter((b) => {
    if (b.closest('dialog')) return false;
    const cs = getComputedStyle(b);
    return cs.backgroundImage !== 'none' || !['rgba(0, 0, 0, 0)', 'transparent', 'rgb(255, 255, 255)'].includes(cs.backgroundColor);
  }).map((b) => b.textContent.trim());
  const entrar = document.querySelector('.acesso button[type="submit"]').getBoundingClientRect();
  return {
    larguraJanela: vw,
    alturaPagina: document.documentElement.scrollHeight,
    rolagemHorizontal: document.documentElement.scrollWidth > vw,
    foraDaJanela,
    cortados,
    alvosMenoresQue44: pequenos,
    botoesSolidos: solidos,
    botaoEntrarBaseY: Math.round(entrar.bottom),
    fontes: [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`))]
  };
};

// Compara duas capturas no próprio navegador (canvas): quantos pixels diferem.
const comparar = async (browser, a, b) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const res = await p.evaluate(async ([da, db]) => {
    const carregar = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const [ia, ib] = await Promise.all([carregar(da), carregar(db)]);
    const px = (i) => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
    const pa = px(ia); const pb = px(ib);
    let dif = 0; let max = 0;
    for (let k = 0; k < pa.length; k += 4) {
      const d = Math.max(Math.abs(pa[k] - pb[k]), Math.abs(pa[k + 1] - pb[k + 1]), Math.abs(pa[k + 2] - pb[k + 2]));
      if (d > 8) dif += 1;
      if (d > max) max = d;
    }
    return { largura: ia.width, altura: ia.height, pixelsDiferentes: dif, maiorDiferencaDeCanal: max };
  }, [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`]);
  await ctx.close();
  return res;
};

const browser = await chromium.launch();
const relatorio = {};
const cache = new Map();
let bytesFonte = 0;

const novaPagina = async (opcoes) => {
  const context = await browser.newContext({ deviceScaleFactor: 1, ...opcoes });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => {
    const u = route.request().url();
    if (!cache.has(u)) {
      const r = await route.fetch();
      const body = await r.body();
      const headers = { ...r.headers() };
      delete headers['content-encoding'];
      delete headers['content-length'];
      cache.set(u, { status: r.status(), headers, body });
      if (u.includes('gstatic')) bytesFonte += body.length;
    }
    const c = cache.get(u);
    await route.fulfill({ status: c.status, headers: { ...c.headers, 'access-control-allow-origin': '*' }, body: c.body });
  });
  const page = await context.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  return { context, page, erros };
};

const pronto = async (page) => {
  await page.waitForSelector('.acesso button[type="submit"]');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
};

try {
  // Aquecimento: baixa as fontes uma vez.
  {
    const { context, page } = await novaPagina({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    await page.goto(url);
    await pronto(page);
    await context.close();
  }

  // Vídeo da entrada, 1280×800.
  {
    const dir = path.join(aqui, '.video-tmp');
    fs.mkdirSync(dir, { recursive: true });
    const { context, page } = await novaPagina({ viewport: { width: 1280, height: 800 }, recordVideo: { dir, size: { width: 1280, height: 800 } } });
    await page.goto(url);
    await page.waitForTimeout(FIM_DA_ENTRADA + 900);
    const video = page.video();
    await context.close();
    const origem = await video.path();
    fs.copyFileSync(origem, path.join(aqui, 'pista-entrada.webm'));
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // Estado final com movimento, e o mesmo com movimento reduzido.
  const finais = {};
  for (const [nome, width, height] of [['1280', 1280, 800], ['390', 390, 844], ['375x667', 375, 667], ['320', 320, 700]]) {
    const { context, page, erros } = await novaPagina({ viewport: { width, height } });
    await page.goto(url);
    await pronto(page);
    if (extra && nome === '1280') {
      // Quadros da entrada: congela todas as animações e posiciona cada uma no
      // mesmo instante t (o tempo conta a partir do início, atraso incluído).
      await page.goto(url);
      await pronto(page);
      for (const t of [300, 700, 1100, 1300, 1600, 1850, 2100, 2350, 2600, 2900]) {
        await page.evaluate((alvo) => document.getAnimations().forEach((an) => { an.pause(); an.currentTime = alvo; }), t);
        await page.waitForTimeout(60);
        await page.screenshot({ path: path.join(extra, `quadro-${String(t).padStart(4, '0')}ms.png`) });
      }
      await page.goto(url);
      await pronto(page);
    }
    await page.waitForTimeout(FIM_DA_ENTRADA);
    const m = await page.evaluate(medir);
    m.errosConsole = erros;
    relatorio[`final-${nome}`] = m;
    const entrega = nome === '1280' || nome === '390';
    const png = await page.screenshot({ path: entrega ? path.join(aqui, `pista-${nome}.png`) : (extra ? path.join(extra, `pista-${nome}.png`) : undefined) });
    finais[nome] = png;
    if (extra) await page.screenshot({ path: path.join(extra, `pista-${nome}-inteira.png`), fullPage: true });

    if (extra && entrega) {
      await page.keyboard.press('Tab');
      await page.screenshot({ path: path.join(extra, `pista-${nome}-foco-campo.png`) });
      await page.fill('#login-id', '12345678900');
      await page.focus('#login-senha');
      await page.screenshot({ path: path.join(extra, `pista-${nome}-cpf-reconhecido.png`) });
      await page.fill('#login-id', '');
      await page.fill('#login-senha', '');
      await page.click('.acesso button[type="submit"]');
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(extra, `pista-${nome}-campos-vazios.png`), fullPage: nome === '390' });
      await page.fill('#login-id', 'pessoa@exemplo.org');
      await page.fill('#login-senha', 'senha-ficticia');
      await page.click('.acesso button[type="submit"]');
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(extra, `pista-${nome}-enviando.png`) });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(extra, `pista-${nome}-erro.png`) });
      await page.mouse.move(10, 10);
      await page.focus('#abrir-solicitacao');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(extra, `pista-${nome}-modal.png`) });
    }
    await context.close();
  }

  {
    const { context, page, erros } = await novaPagina({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    await page.goto(url);
    await pronto(page);
    await page.waitForTimeout(300);
    const png = await page.screenshot({ path: path.join(aqui, 'pista-sem-movimento-1280.png') });
    relatorio['sem-movimento-1280'] = { errosConsole: erros, animarNaRaiz: await page.evaluate(() => document.documentElement.classList.contains('animar')) };
    relatorio['comparacao-final-x-sem-movimento-1280'] = await comparar(browser, finais['1280'], png);
    await context.close();
  }
  {
    const { context, page } = await novaPagina({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await page.goto(url);
    await pronto(page);
    await page.waitForTimeout(300);
    const png = await page.screenshot();
    relatorio['comparacao-final-x-sem-movimento-390'] = await comparar(browser, finais['390'], png);
    await context.close();
  }
} finally {
  await browser.close();
}

relatorio.bytesFonte = bytesFonte;
console.log(JSON.stringify(relatorio, null, 2));
