// Contraste dos pares de cor da releitura A2 "energia".
//
// Mesma fórmula WCAG 2.2 de scripts/test-landing-tokens.cjs (luminância
// relativa sRGB, razão (L1 + 0,05) / (L2 + 0,05)), repetida aqui porque aquele
// arquivo não exporta módulo. Adaptado de ../contraste.cjs.
//
// Uso: node docs/design/landing-v2/a2-energia/contraste.cjs
// Sai com código 1 se algum par ficar abaixo do mínimo.
//
// Os fundos em degradê da cena (céu e luz do horizonte) não cabem num par
// de tokens: capturar.mjs mede, pixel a pixel, o fundo real atrás de cada
// texto sobre a cena e sobre a faixa das áreas.

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
  // Cena
  ['#ffffff', '#0b2a5e', TEXTO, 'Cal sobre Estádio: título, marca LAINES'],
  ['#ffffff', '#1b4f93', TEXTO, 'Cal sobre o céu mais claro acima do horizonte'],
  ['#d6e3f5', '#0b2a5e', TEXTO, 'Névoa sobre Estádio: frase, FACISA, UFRN, rodapé'],
  ['#d6e3f5', '#1b4f93', TEXTO, 'Névoa sobre o céu mais claro (pior caso da frase no desktop)'],
  ['#d6e3f5', '#2560a8', TEXTO, 'Névoa sobre Pista (pior caso teórico)'],
  // Faixa das áreas
  ['#ffffff', '#13397a', TEXTO, 'Cal sobre a raia (início do degradê): nome da área'],
  ['#ffffff', '#1b4c96', TEXTO, 'Cal sobre a raia (fim do degradê)'],
  ['#d6e3f5', '#1b4c96', TEXTO, 'Névoa sobre a raia (fim do degradê): descrição da área'],
  // Painel
  ['#262947', '#ffffff', TEXTO, 'Tinta sobre Cal: "Entrar", rótulos, texto digitado'],
  ['#555c78', '#ffffff', TEXTO, 'Apoio sobre Cal: dica, perguntas das portas'],
  ['#2560a8', '#ffffff', TEXTO, 'Pista sobre Cal: "Esqueci minha senha", "Mostrar", ações das portas'],
  ['#2560a8', '#f5f8fd', TEXTO, 'Pista sobre a porta em hover'],
  ['#555c78', '#f5f8fd', TEXTO, 'Apoio sobre a porta em hover'],
  ['#2560a8', '#eaf1fa', TEXTO, 'Pista sobre o fundo do "Mostrar" em hover'],
  ['#ffffff', '#33821f', TEXTO, 'Cal sobre o topo do degradê do botão Entrar'],
  ['#ffffff', '#2d7a1a', TEXTO, 'Cal sobre Largada (meio do botão)'],
  ['#ffffff', '#2a6f18', TEXTO, 'Cal sobre a base do degradê do botão Entrar'],
  ['#b91c1c', '#fef2f2', TEXTO, 'Erro geral: texto sobre fundo de erro'],
  ['#b91c1c', '#ffffff', TEXTO, 'Erro do campo: texto sob o campo'],
  ['#262947', '#f3f6fb', TEXTO, 'Tinta sobre a nota do diálogo'],
  // Limites e foco
  ['#7a8098', '#ffffff', GRAFICO, 'Borda do campo sobre Cal'],
  ['#b91c1c', '#ffffff', GRAFICO, 'Borda do campo com erro'],
  ['#2560a8', '#ffffff', GRAFICO, 'Anel de foco (Pista) sobre Cal'],
  ['#3d8c2a', '#0b2a5e', GRAFICO, 'Marca de largada (Gramado) sobre Estádio'],
  ['#ffffff', '#2560a8', GRAFICO, 'Linha da raia sobre a pista']
];

let falhas = 0;
for (const [fg, bg, min, uso] of PARES) {
  const r = contrastRatio(fg, bg);
  const ok = r >= min;
  if (!ok) falhas += 1;
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${fg} sobre ${bg}  ${r.toFixed(2)}:1  (mín. ${min}:1)  ${uso}`);
}
console.log(falhas ? `\n${falhas} par(es) abaixo do mínimo.` : '\nTodos os pares no mínimo ou acima.');
process.exitCode = falhas ? 1 : 0;
