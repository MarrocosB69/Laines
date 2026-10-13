// Capturas e verificações dos mockups da landing v2.
//
// Uso (a partir da raiz do repositório):
//   node docs/design/landing-v2/capturar.mjs [pasta-extra]
//
// Grava em docs/design/landing-v2/ as capturas pedidas (1280×800 e 390×844,
// só a primeira tela) e a página inteira a 390 px. Se [pasta-extra] for
// informada, grava lá as capturas de conferência (320 px, foco, erro).
//
// Método da skill webapp-testing, caminho "HTML estático": abre o arquivo por
// file://, espera as fontes carregarem, reconhece a página renderizada e só
// então mede e captura. Emula prefers-reduced-motion: reduce para que a
// captura não pegue a curva da direção A no meio da animação (e para provar
// que, sem movimento, a página já aparece completa).
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const extra = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (extra) fs.mkdirSync(extra, { recursive: true });

// SO=a ou SO=b limita a uma direção.
const DIRECOES = process.env.SO ? [process.env.SO] : ['a', 'b'];
const LARGURAS = [
  { nome: '1280', width: 1280, height: 800, entrega: true },
  { nome: '390', width: 390, height: 844, entrega: true, inteira: true },
  { nome: '320', width: 320, height: 700, entrega: false, inteira: true }
];

// Mede: rolagem horizontal; elementos com texto que passam da borda direita
// da janela; elementos que cortam o próprio conteúdo (scrollWidth maior que
// clientWidth com overflow diferente de visible); famílias de fonte usadas.
const medir = () => {
  const vw = document.documentElement.clientWidth;
  const rolagemHorizontal = document.documentElement.scrollWidth > vw;
  const foraDaJanela = [];
  const cortados = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const temTexto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!temTexto) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 0.5 || r.left < -0.5) foraDaJanela.push(`${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 40)}" (${Math.round(r.left)}–${Math.round(r.right)})`);
    if (cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) cortados.push(`${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 40)}"`);
    // Texto que não quebra e é mais largo que o pai.
    if (cs.whiteSpace === 'nowrap' && el.parentElement) {
      const rp = el.parentElement.getBoundingClientRect();
      if (r.right > rp.right + 0.5) cortados.push(`nowrap ${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 40)}" passa do pai em ${Math.round(r.right - rp.right)} px`);
    }
  }
  const fontes = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`);
  const botoesSolidos = [...document.querySelectorAll('button, a')].filter((b) => {
    const bg = getComputedStyle(b).backgroundColor;
    return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
  }).map((b) => b.textContent.trim());
  const entrar = document.querySelector('button[type="submit"]').getBoundingClientRect();
  return {
    larguraJanela: vw,
    alturaPagina: document.documentElement.scrollHeight,
    rolagemHorizontal,
    foraDaJanela,
    cortados,
    fontes: [...new Set(fontes)],
    botoesSolidos,
    botaoEntrarBaseY: Math.round(entrar.bottom)
  };
};

const browser = await chromium.launch();
const relatorio = {};
try {
  for (const d of DIRECOES) {
    const arquivo = path.join(aqui, `direcao-${d}.html`);
    for (const l of LARGURAS) {
      const context = await browser.newContext({
        viewport: { width: l.width, height: l.height },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce'
      });
      const page = await context.newPage();
      const bytesFonte = [];
      page.on('response', async (res) => {
        if (res.url().includes('fonts.gstatic.com')) {
          try { bytesFonte.push((await res.body()).length); } catch { /* sem corpo */ }
        }
      });
      const erros = [];
      page.on('pageerror', (e) => erros.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });

      await page.goto(pathToFileURL(arquivo).href, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('button[type="submit"]');
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => [...document.images].every((i) => i.complete));
      await page.waitForTimeout(300);

      const m = await page.evaluate(medir);
      m.bytesFonte = bytesFonte.reduce((a, b) => a + b, 0);
      m.errosConsole = erros;
      relatorio[`direcao-${d}-${l.nome}`] = m;

      if (l.entrega) {
        await page.screenshot({ path: path.join(aqui, `direcao-${d}-${l.nome}.png`) });
      }
      if (l.inteira) {
        const destino = l.entrega ? aqui : extra;
        if (destino) await page.screenshot({ path: path.join(destino, `direcao-${d}-${l.nome}-inteira.png`), fullPage: true });
      }
      if (extra && l.nome !== '320') {
        // Foco pelo teclado no primeiro campo e no botão Entrar.
        await page.keyboard.press('Tab');
        await page.screenshot({ path: path.join(extra, `direcao-${d}-${l.nome}-foco-campo.png`) });
        await page.focus('button[type="submit"]');
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await page.screenshot({ path: path.join(extra, `direcao-${d}-${l.nome}-foco-botao.png`) });
        // Estado de erro.
        await page.evaluate(() => { document.getElementById('erro-login').hidden = false; });
        await page.screenshot({ path: path.join(extra, `direcao-${d}-${l.nome}-erro.png`) });
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(relatorio, null, 2));
