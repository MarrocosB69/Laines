/* Cascata entre as folhas da landing.
 *
 * Media query nao aumenta especificidade: uma regra de celular so vale se vier
 * DEPOIS da regra de desktop do mesmo seletor e propriedade. Quando a folha
 * unica da landing foi dividida por peca, o bloco responsivo foi parar no
 * arquivo base, importado antes das pecas - e as regras de desktop do hero
 * anularam as de celular. A 390px a pagina ficou em duas colunas espremidas;
 * lint, build e todos os testes continuaram passando, porque nenhum deles olha
 * a ordem das regras entre arquivos. Este teste olha.
 *
 * Node puro, sem navegador. Le a ordem real dos imports em LoginPage.jsx. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`PASS ${name}`); };

const normalizar = (seletor) => seletor.trim().replace(/\s+/g, ' ');

// Extrai regras na ordem do arquivo: { seletores, propriedades, media }.
function regras(css) {
  const texto = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const saida = [];
  const lerCorpo = (corpo, media) => {
    let i = 0;
    while (i < corpo.length) {
      const abre = corpo.indexOf('{', i);
      if (abre < 0) break;
      const prelude = corpo.slice(i, abre).trim();
      if (prelude.startsWith('@')) {
        // Bloco aninhado (@media, @supports, @keyframes): acha o fechamento correspondente.
        let prof = 1; let j = abre + 1;
        while (j < corpo.length && prof > 0) { if (corpo[j] === '{') prof += 1; else if (corpo[j] === '}') prof -= 1; j += 1; }
        if (prelude.startsWith('@media')) lerCorpo(corpo.slice(abre + 1, j - 1), prelude);
        i = j;
        continue;
      }
      const fecha = corpo.indexOf('}', abre);
      const propriedades = corpo.slice(abre + 1, fecha).split(';')
        .map((d) => d.split(':')[0].trim().toLowerCase())
        .filter((p) => p && !p.startsWith('--'));
      if (prelude) saida.push({ seletores: prelude.split(',').map(normalizar), propriedades, media });
      i = fecha + 1;
    }
  };
  lerCorpo(texto, null);
  return saida;
}

/** Media queries anuladas: mesma (seletor, propriedade) redeclarada sem media depois. */
function mediaAnuladas(folhas) {
  const todas = [];
  folhas.forEach(({ nome, css }) => regras(css).forEach((r) => todas.push({ ...r, nome })));
  const achados = [];
  todas.forEach((regra, pos) => {
    if (!regra.media) return;
    for (const seletor of regra.seletores) {
      for (const prop of regra.propriedades) {
        const posterior = todas.slice(pos + 1).find((r) => !r.media && r.seletores.includes(seletor) && r.propriedades.includes(prop));
        if (posterior) achados.push(`${regra.nome} ${regra.media} { ${seletor} { ${prop} } } e anulada por ${posterior.nome}`);
      }
    }
  });
  return achados;
}

function folhasNaOrdemDeImport() {
  const pagina = fs.readFileSync(path.join(root, 'src/views/LoginPage.jsx'), 'utf8');
  const imports = [...pagina.matchAll(/import\s+'\.\/(landing\/[\w-]+\.css)'/g)].map((m) => m[1]);
  assert.ok(imports.length >= 5, 'LoginPage.jsx precisa importar as folhas da landing');
  return imports.map((rel) => ({ nome: path.basename(rel), css: fs.readFileSync(path.join(root, 'src/views', rel), 'utf8') }));
}

check('nenhuma regra responsiva da landing e anulada por regra de desktop carregada depois', () => {
  const folhas = folhasNaOrdemDeImport();
  const achados = mediaAnuladas(folhas);
  assert.deepEqual(achados, [], `media queries sem efeito:\n  ${achados.join('\n  ')}`);
});

check('a folha responsiva e a ultima importada', () => {
  const folhas = folhasNaOrdemDeImport();
  assert.equal(folhas[folhas.length - 1].nome, 'landing-responsivo.css');
});

check('o teste detecta o defeito (reproducao sintetica da divisao que quebrou o celular)', () => {
  const base = { nome: 'landing-base.css', css: '@media (max-width: 1080px) { .landing-hero__grid { grid-template-columns: 1fr; } }' };
  const hero = { nome: 'landing-hero.css', css: '.landing-hero__grid { display: grid; grid-template-columns: 1fr 0.84fr; }' };
  assert.equal(mediaAnuladas([base, hero]).length, 1, 'base antes do hero: a regra de celular morre');
  assert.equal(mediaAnuladas([hero, base]).length, 0, 'responsivo por ultimo: a regra de celular vale');
});

console.log(`\n${passed} verificações de cascata da landing passaram.`);
