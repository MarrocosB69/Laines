// Contraste dos pares de cor da direção A2, "Pista em movimento".
//
// Mesma fórmula WCAG 2.2 de scripts/test-landing-tokens.cjs (luminância
// relativa sRGB, razão (L1 + 0,05) / (L2 + 0,05)). Aquele arquivo não exporta
// módulo, então as quatro funções são repetidas aqui sem alteração.
//
// Uso: node docs/design/landing-v2/a2-pista/contraste.cjs
// Sai com código 1 se algum par ficar abaixo do mínimo.

const hexToRgb = (hex) => {
  const c = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
};
const srgbChannelToLinear = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const relativeLuminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(srgbChannelToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrastRatio = (a, b) => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const TEXTO = 4.5;
const GRAFICO = 3.0;

// [primeiro plano, fundo, mínimo, uso]
const PARES = [
  ['#ffffff', '#1c2150', TEXTO, 'Cal sobre noite: título, nomes das áreas, números de raia'],
  ['#c3c8e6', '#1c2150', TEXTO, 'Névoa sobre noite: instituição, frase, descrição das áreas'],
  ['#c3c8e6', '#232a5e', TEXTO, 'Névoa sobre o ponto mais claro da luz do painel'],
  ['#262947', '#ffffff', TEXTO, 'Tinta sobre cal: título Entrar, rótulos, texto digitado'],
  ['#555c78', '#ffffff', TEXTO, 'Apoio sobre cal: dica, perguntas das portas, rodapé'],
  ['#555c78', '#f6f7fb', TEXTO, 'Apoio sobre o fundo do campo: marcador CPF / E-mail'],
  ['#262947', '#f6f7fb', TEXTO, 'Tinta sobre o fundo do campo: texto digitado'],
  ['#2560a8', '#ffffff', TEXTO, 'Pista sobre cal: "Esqueci minha senha", ações das portas'],
  ['#2560a8', '#f3f7fd', TEXTO, 'Pista sobre o fundo da porta com o mouse em cima'],
  ['#ffffff', '#2d7a1a', TEXTO, 'Cal sobre largada: rótulo do botão Entrar'],
  ['#ffffff', '#256816', TEXTO, 'Cal sobre largada escura: botão com o mouse em cima'],
  ['#b91c1c', '#fef2f2', TEXTO, 'Erro do formulário'],
  ['#b91c1c', '#ffffff', TEXTO, 'Erro de campo, abaixo do campo'],
  ['#8a5a00', '#fff7e6', TEXTO, 'Aviso de Caps Lock'],
  ['#7a8098', '#ffffff', GRAFICO, 'Borda do campo sobre cal'],
  ['#7a8098', '#f6f7fb', GRAFICO, 'Borda do campo contra o próprio fundo'],
  ['#2560a8', '#ffffff', GRAFICO, 'Anel de foco e borda do campo em foco'],
  ['#ffffff', '#2560a8', GRAFICO, 'Linha de raia sobre a pista'],
  ['#ffffff', '#1d4f8e', GRAFICO, 'Linha de raia sobre a pista na sombra'],
  ['#ffffff', '#3d8c2a', GRAFICO, 'Meio-fio branco contra o gramado'],
  ['#3d8c2a', '#1c2150', GRAFICO, 'Gramado contra a noite'],
  ['#2560a8', '#1c2150', 1.0, 'Pista contra a noite (2,40:1; a borda da pista é a linha branca externa)']
];

let falhas = 0;
for (const [fg, bg, min, uso] of PARES) {
  const r = contrastRatio(fg, bg);
  const ok = r >= min;
  if (!ok) falhas += 1;
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${fg} sobre ${bg}  ${r.toFixed(2).replace('.', ',')}:1  (mín. ${String(min).replace('.', ',')}:1)  ${uso}`);
}
console.log(falhas ? `\n${falhas} par(es) abaixo do mínimo.` : '\nTodos os pares no mínimo ou acima.');
process.exitCode = falhas ? 1 : 0;
