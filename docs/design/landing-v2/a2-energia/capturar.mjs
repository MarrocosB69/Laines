// Capturas, medições e vídeo da releitura A2 "energia".
// Adaptado de ../capturar.mjs.
//
// Uso (a partir da raiz do repositório):
//   node docs/design/landing-v2/a2-energia/capturar.mjs [pasta-de-conferencia]
//
// Grava nesta pasta:
//   energia-1280.png, energia-390.png          estado final, com movimento, depois da entrada
//   energia-sem-movimento-1280.png             prefers-reduced-motion: reduce
//   energia-1280-inteira.png, energia-390-inteira.png   a página inteira
//   energia-entrada.webm                       vídeo da entrada a 1280×800
// Se [pasta-de-conferencia] for informada, grava lá 320 px, foco, erro,
// diálogo e quadros intermediários da entrada.
//
// Também compara, pixel a pixel, o fim da animação com o estado sem
// movimento, e imprime as medições em JSON.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(path.join(aqui, 'index.html')).href;
const extra = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (extra) fs.mkdirSync(extra, { recursive: true });
// A entrada termina em 1,95 s, mas o Chromium só refaz a rasterização das
// camadas que animaram alguns segundos depois: com 2,3 s, a captura diferia
// do modo sem movimento na suavização das bordas (4,5% dos pixels, só
// contornos). Com 6 s, a diferença medida foi zero pixel na maioria das
// rodadas; numa delas sobrou ruído de suavização de até 7/255 em 0,08% dos
// pixels (rótulos do formulário). O teste 2 abaixo registra os números.
const FIM_DA_ENTRADA = 6000;

const medir = () => {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const foraDaJanela = [];
  const cortados = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('dialog:not([open])') || el.closest('[aria-hidden="true"]')) continue;
    const temTexto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!temTexto) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 0.5 || r.left < -0.5) foraDaJanela.push(`${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 40)}" (${Math.round(r.left)}–${Math.round(r.right)})`);
    if (cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) cortados.push(`${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 40)}"`);
    if (cs.whiteSpace === 'nowrap' && el.parentElement) {
      const rp = el.parentElement.getBoundingClientRect();
      if (r.right > rp.right + 0.5) cortados.push(`nowrap ${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 40)}" passa do pai em ${Math.round(r.right - rp.right)} px`);
    }
  }
  const alvosPequenos = [...document.querySelectorAll('button, a, input')]
    .filter((b) => !b.closest('dialog'))
    .map((b) => ({ b, r: b.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && (r.height < 44 || r.width < 44))
    .map(({ b, r }) => `${b.textContent.trim().slice(0, 30) || b.id} ${Math.round(r.width)}×${Math.round(r.height)}`);
  const fontes = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.style} ${f.weight}`);
  const solidos = [...document.querySelectorAll('button, a')].filter((b) => {
    if (b.closest('dialog')) return false;
    const cs = getComputedStyle(b);
    const bg = cs.backgroundColor;
    const temCor = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== 'rgb(255, 255, 255)';
    return temCor || /gradient/.test(cs.backgroundImage) && !b.classList.contains('link');
  }).map((b) => b.textContent.trim());
  const entrar = document.querySelector('button[type="submit"]').getBoundingClientRect();
  return {
    janela: `${vw}×${vh}`,
    alturaPagina: document.documentElement.scrollHeight,
    rolagemHorizontal: document.documentElement.scrollWidth > vw,
    foraDaJanela,
    cortados,
    alvosPequenos,
    fontes: [...new Set(fontes)],
    acoesSolidas: solidos,
    botaoEntrarBaseY: Math.round(entrar.bottom),
    botaoEntrarNaPrimeiraTela: entrar.bottom <= vh
  };
};

// Contraste medido sobre o fundo real. A cena é degradê (céu, luz do
// horizonte), então um par de tokens não prova nada ali. Esconde todo texto
// e as marcas de largada, fotografa a página inteira e, dentro do retângulo
// de cada linha de texto (Range.getClientRects), procura o pixel de fundo
// com pior contraste contra a cor do texto.
const contrasteSobreFundo = async (page) => {
  const alvos = await page.evaluate(() => {
    const sel = '.marca__sigla, .marca__inst, .titulo__linha, .frase, .areas h2, .raia h3, .raia p, .rodape p';
    const lum = (rgb) => {
      const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    return [...document.querySelectorAll(sel)].map((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()].filter((r) => r.width > 2 && r.height > 2)
        .map((r) => ({ x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }));
      return { nome: `${el.className || el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 28)}"`, lumTexto: lum(getComputedStyle(el).color), rects };
    });
  });
  const estilo = await page.addStyleTag({ content: '*{color:transparent!important;text-shadow:none!important}.titulo__linha::before,.titulo__linha::after,.raia h3::before{display:none!important}' });
  const png = await page.screenshot({ fullPage: true });
  await estilo.evaluate((el) => el.remove());
  return page.evaluate(async ({ b64, alvos }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const lin = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return alvos.map(({ nome, lumTexto, rects }) => {
      let pior = Infinity;
      for (const r of rects) {
        const d = ctx.getImageData(Math.round(r.x), Math.round(r.y), Math.max(1, Math.round(r.w)), Math.max(1, Math.round(r.h))).data;
        for (let i = 0; i < d.length; i += 4) {
          const L = 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
          const razao = (Math.max(L, lumTexto) + 0.05) / (Math.min(L, lumTexto) + 0.05);
          if (razao < pior) pior = razao;
        }
      }
      return { texto: nome, piorContraste: Number(pior.toFixed(2)), ok: pior >= 4.5 };
    });
  }, { b64: png.toString('base64'), alvos });
};

const abrir = async (browser, { width, height, reduzir, video }) => {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: reduzir ? 'reduce' : 'no-preference',
    ...(video ? { recordVideo: { dir: video, size: { width, height } } } : {})
  });
  const page = await context.newPage();
  const bytesFonte = [];
  const erros = [];
  page.on('response', async (res) => {
    if (res.url().includes('fonts.gstatic.com')) {
      try { bytesFonte.push({ url: res.url().split('/').pop().slice(0, 40), bytes: (await res.body()).length }); } catch { /* sem corpo */ }
    }
  });
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  return { context, page, bytesFonte, erros };
};

const pronto = async (page) => {
  await page.waitForSelector('button[type="submit"]');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
};

const browser = await chromium.launch();
const relatorio = {};
try {
  // 1. Estado final com movimento, depois da entrada, e sem movimento.
  for (const l of [
    { nome: '1280', width: 1280, height: 800 },
    { nome: '390', width: 390, height: 844 },
    { nome: '320', width: 320, height: 640, conferencia: true }
  ]) {
    for (const reduzir of [false, true]) {
      const { context, page, bytesFonte, erros } = await abrir(browser, { ...l, reduzir });
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await pronto(page);
      await page.waitForTimeout(reduzir ? 300 : FIM_DA_ENTRADA);
      const m = await page.evaluate(medir);
      m.bytesFonte = bytesFonte;
      m.totalBytesFonte = bytesFonte.reduce((a, b) => a + b.bytes, 0);
      m.errosConsole = erros;
      const chave = `${l.nome}${reduzir ? '-sem-movimento' : ''}`;
      relatorio[chave] = m;
      if (reduzir) {
        const c = await contrasteSobreFundo(page);
        m.contrasteSobreFundo = { piorCaso: c.reduce((a, b) => (b.piorContraste < a.piorContraste ? b : a)), falhas: c.filter((x) => !x.ok), todos: c };
      }

      // Entrega: 1280 e 390 com movimento (e página inteira), 1280 sem
      // movimento. O resto vai para a pasta de conferência.
      const nome = reduzir ? `energia-sem-movimento-${l.nome}.png` : `energia-${l.nome}.png`;
      const entrega = !l.conferencia && (!reduzir || l.nome === '1280');
      const destino = entrega ? aqui : extra;
      if (destino) {
        await page.screenshot({ path: path.join(destino, nome) });
        if (!reduzir) await page.screenshot({ path: path.join(destino, `energia-${l.nome}-inteira.png`), fullPage: true });
      }

      if (extra && !reduzir && l.nome !== '320') {
        // Depois da captura de página inteira, o primeiro Tab nem sempre cai
        // no campo; foca direto (campo de texto sempre casa :focus-visible).
        await page.focus('#login-id');
        await page.waitForTimeout(400); // borda, halo e raia têm transição de 160–320 ms
        await page.screenshot({ path: path.join(extra, `energia-${l.nome}-foco-campo.png`) });
        await page.click('button[type="submit"]');
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(extra, `energia-${l.nome}-erro-vazio.png`) });
        await page.fill('#login-id', '12345678900');
        await page.fill('#login-senha', 'senha-sintetica');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(extra, `energia-${l.nome}-enviando.png`) });
        await page.waitForTimeout(1200);
        await page.screenshot({ path: path.join(extra, `energia-${l.nome}-erro-credencial.png`) });
        await page.focus('a.porta');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(extra, `energia-${l.nome}-foco-porta.png`) });
        await page.click('button.porta');
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(extra, `energia-${l.nome}-dialogo.png`) });
      }
      await context.close();
    }
  }

  // 2. O fim da animação é igual ao estado sem movimento? Compara pixels.
  const capturaFinal = async (reduzir) => {
    const { context, page } = await abrir(browser, { width: 1280, height: 800, reduzir });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await pronto(page);
    await page.waitForTimeout(reduzir ? 300 : FIM_DA_ENTRADA);
    const buf = await page.screenshot();
    await context.close();
    return buf;
  };
  // O momento em que o compositor refaz a rasterização varia com a carga da
  // máquina: se ainda diferir, tenta de novo a cada 2 s, até 12 s. Compara
  // pixel a pixel (não só bytes) e registra quantos pixels diferem e por
  // quanto, para separar diferença de estado de ruído de suavização.
  const b = await capturaFinal(true);
  let a;
  let tempo = FIM_DA_ENTRADA;
  let pixels;
  {
    const { context, page } = await abrir(browser, { width: 1280, height: 800, reduzir: false });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await pronto(page);
    await page.waitForTimeout(FIM_DA_ENTRADA);
    const comparar = (x, y) => page.evaluate(async ([pa, pb]) => {
      const ler = async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const cv = document.createElement('canvas');
        cv.width = img.width; cv.height = img.height;
        const ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, img.width, img.height).data;
      };
      const [da, db] = [await ler(pa), await ler(pb)];
      let diferentes = 0; let maior = 0;
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
        if (d > 0) { diferentes += 1; if (d > maior) maior = d; }
      }
      return { diferentes, maiorDiferenca: maior, total: da.length / 4 };
    }, [x.toString('base64'), y.toString('base64')]);
    a = await page.screenshot();
    pixels = await comparar(a, b);
    while (pixels.diferentes > 0 && tempo < 12000) {
      await page.waitForTimeout(2000);
      tempo += 2000;
      a = await page.screenshot();
      pixels = await comparar(a, b);
    }
    await context.close();
  }
  relatorio.fimIgualSemMovimento = { bytesIguais: a.equals(b), aposMs: tempo, pixelsDiferentes: pixels.diferentes, maiorDiferencaPorCanal: pixels.maiorDiferenca, pixelsTotais: pixels.total };
  // O par entregue é exatamente o par medido aqui (substitui o do passo 1,
  // tirado aos 6 s, quando ainda pode sobrar ruído de suavização).
  fs.writeFileSync(path.join(aqui, 'energia-1280.png'), a);
  fs.writeFileSync(path.join(aqui, 'energia-sem-movimento-1280.png'), b);
  if (extra) {
    fs.writeFileSync(path.join(extra, 'teste-fim-com-movimento.png'), a);
    fs.writeFileSync(path.join(extra, 'teste-fim-sem-movimento.png'), b);
  }

  // 3. Vídeo da entrada a 1280×800, num navegador próprio.
  // Gravado no mesmo navegador, depois de vários contextos com o plano 3D
  // da pista, o vídeo saiu com quadros parciais (faixas brancas) e com o
  // título em fonte substituta, porque as fontes chegaram depois da
  // primeira pintura. Por isso: navegador novo; um primeiro contexto baixa
  // o CSS e as fontes do Google Fonts para a memória; o contexto que grava
  // os recebe da memória, antes da primeira pintura. Sem capturas durante a
  // gravação: elas atrasam quadros.
  const pastaVideo = path.join(aqui, '.video-tmp');
  fs.rmSync(pastaVideo, { recursive: true, force: true });
  // Com GPU, como num navegador de verdade. O Chromium sem GPU do modo
  // headless roda a entrada a 18 quadros/s e o gravador perde quadros; com
  // estas opções, no Windows, a medição deu ~50 quadros/s depois de um
  // aquecimento (o primeiro contexto, que baixa as fontes, faz esse papel).
  // Sem GPU disponível, o Chromium volta sozinho ao modo por software.
  const navVideo = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
  let caminhoVideo;
  try {
    const cache = new Map();
    {
      const c = await navVideo.newContext({ viewport: { width: 1280, height: 800 } });
      const p = await c.newPage();
      const pendentes = [];
      p.on('response', (res) => {
        if (/fonts\.(googleapis|gstatic)\.com/.test(res.url())) {
          pendentes.push(res.body().then((body) => cache.set(res.url(), { body, tipo: res.headers()['content-type'] })).catch(() => {}));
        }
      });
      await p.goto(url, { waitUntil: 'networkidle' });
      await p.evaluate(() => document.fonts.ready);
      await Promise.all(pendentes);
      await c.close();
    }
    const c = await navVideo.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      reducedMotion: 'no-preference',
      recordVideo: { dir: pastaVideo, size: { width: 1280, height: 800 } }
    });
    await c.route(/fonts\.(googleapis|gstatic)\.com/, (route) => {
      const r = cache.get(route.request().url());
      return r
        ? route.fulfill({ status: 200, body: r.body, headers: { 'content-type': r.tipo, 'access-control-allow-origin': '*' } })
        : route.continue();
    });
    const p = await c.newPage();
    await p.goto(url, { waitUntil: 'domcontentloaded' });
    await p.evaluate(() => document.fonts.ready);
    relatorio.fontesNoVideo = { daMemoria: cache.size, status: await p.evaluate(() => document.fonts.status) };
    await p.waitForTimeout(3000); // 1,95 s de entrada e ~1 s no estado final
    caminhoVideo = await p.video().path();
    await c.close();
  } finally {
    await navVideo.close();
  }

  // O tempo até a primeira pintura varia entre execuções (numa delas, 2,6 s
  // de quadros brancos). Apara pelo conteúdo: abre o vídeo bruto num
  // <video>, acha o primeiro quadro que não é branco e corta ali com o
  // ffmpeg que acompanha o Playwright.
  const bruto = path.join(pastaVideo, 'bruto.webm');
  fs.copyFileSync(caminhoVideo, bruto);
  const destinoVideo = path.join(aqui, 'energia-entrada.webm');
  const primeiroQuadro = await (async () => {
    const { context, page } = await abrir(browser, { width: 1280, height: 800, reduzir: true });
    // Vídeo entregue como Blob (mesma origem): por file://, o canvas fica
    // contaminado e getImageData é bloqueado.
    await page.setContent('<video id="v" muted></video>');
    const t = await page.evaluate(async (b64) => {
      const vid = document.getElementById('v');
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      vid.src = URL.createObjectURL(new Blob([bytes], { type: 'video/webm' }));
      await new Promise((ok) => (vid.readyState >= 1 ? ok() : vid.addEventListener('loadedmetadata', ok, { once: true })));
      const ir = (s) => new Promise((ok) => { vid.addEventListener('seeked', ok, { once: true }); vid.currentTime = s; });
      if (!isFinite(vid.duration)) { await ir(1e6); }
      const dur = isFinite(vid.duration) ? vid.duration : vid.currentTime;
      const cv = document.createElement('canvas');
      cv.width = 160; cv.height = 100;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      for (let s = 0; s < dur; s += 0.04) {
        await ir(s);
        ctx.drawImage(vid, 0, 0, 160, 100);
        const d = ctx.getImageData(0, 0, 160, 100).data;
        let escuros = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 600) escuros += 1;
        if (escuros > 1600) return { inicio: s, duracao: dur }; // >10% da tela pintada
      }
      return { inicio: 0, duracao: dur };
    }, fs.readFileSync(bruto).toString('base64'));
    await context.close();
    return t;
  })();
  const raizPw = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  const pastaFfmpeg = fs.existsSync(raizPw) ? fs.readdirSync(raizPw).filter((d) => d.startsWith('ffmpeg')).sort().pop() : null;
  const ffmpeg = pastaFfmpeg ? fs.readdirSync(path.join(raizPw, pastaFfmpeg)).find((f) => /^ffmpeg.*\.exe$|^ffmpeg$|^ffmpeg-linux$|^ffmpeg-mac$/.test(f)) : null;
  if (ffmpeg && primeiroQuadro.inicio > 0) {
    const { execFileSync } = await import('node:child_process');
    execFileSync(path.join(raizPw, pastaFfmpeg, ffmpeg), [
      '-y', '-loglevel', 'error', '-i', bruto, '-ss', primeiroQuadro.inicio.toFixed(2),
      '-c:v', 'libvpx', '-b:v', '4M', '-crf', '6', '-an', destinoVideo
    ]);
  } else {
    fs.copyFileSync(bruto, destinoVideo);
  }
  fs.rmSync(pastaVideo, { recursive: true, force: true });
  relatorio.video = {
    arquivo: 'energia-entrada.webm',
    duracaoBrutaS: Number(primeiroQuadro.duracao.toFixed(2)),
    aparadoNoInicioS: ffmpeg ? Number(primeiroQuadro.inicio.toFixed(2)) : 0,
    ...(ffmpeg ? {} : { aviso: 'ffmpeg do Playwright não encontrado; vídeo sem aparar' })
  };

  // 4. Quadros intermediários da entrada, com as animações pausadas em
  // tempos exatos (Web Animations API), para conferir a coreografia.
  if (extra) {
    const q = await abrir(browser, { width: 1280, height: 800, reduzir: false });
    await q.page.goto(url, { waitUntil: 'domcontentloaded' });
    await pronto(q.page);
    // Com preenchimento "backwards", animação terminada some de
    // getAnimations(). Reinicia todas e pausa na hora.
    await q.page.evaluate(() => {
      const s = document.createElement('style');
      s.textContent = '*,*::before,*::after{animation:none!important}';
      document.head.append(s);
      void document.body.offsetWidth;
      s.remove();
      void document.body.offsetWidth;
      for (const an of document.getAnimations()) an.pause();
    });
    for (const t of [0, 300, 450, 600, 800, 1000, 1300, 1700]) {
      await q.page.evaluate((ms) => {
        for (const an of document.getAnimations()) { an.pause(); an.currentTime = ms; }
      }, t);
      await q.page.screenshot({ path: path.join(extra, `entrada-${String(t).padStart(4, '0')}ms.png`) });
    }
    await q.context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(relatorio, null, 2));
