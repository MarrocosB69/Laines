// Contraste dos pares de cor das duas direções da landing v2.
//
// Mesma fórmula WCAG 2.2 de scripts/test-landing-tokens.cjs (luminância
// relativa sRGB, razão (L1 + 0,05) / (L2 + 0,05)). Aquele arquivo não exporta
// módulo, então as quatro funções são repetidas aqui sem alteração.
//
// Uso: node docs/design/landing-v2/contraste.cjs
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
const DIRECOES = {
  'A — A curva': [
    ['#262947', '#ffffff', TEXTO, 'Tinta sobre cal: título, corpo, rótulos'],
    ['#555c78', '#ffffff', TEXTO, 'Apoio sobre cal: texto secundário, dica do campo'],
    ['#2560a8', '#ffffff', TEXTO, 'Pista sobre cal: links "Esqueci minha senha", "Solicitar acesso"'],
    ['#ffffff', '#2d7a1a', TEXTO, 'Cal sobre largada: rótulo do botão Entrar'],
    ['#b91c1c', '#fef2f2', TEXTO, 'Erro do formulário (mesmo par da landing atual)'],
    ['#7a8098', '#ffffff', GRAFICO, 'Borda do campo sobre cal (limite de componente)'],
    ['#ffffff', '#2560a8', GRAFICO, 'Linha da raia sobre a pista (gráfico)'],
    ['#3d8c2a', '#ffffff', GRAFICO, 'Gramado contra a página (gráfico)'],
    ['#2560a8', '#ffffff', GRAFICO, 'Anel de foco contra o halo branco']
  ],
  'B — O percurso': [
    ['#262947', '#ffffff', TEXTO, 'Tinta sobre folha: título, nomes das etapas, rótulos'],
    ['#555c78', '#ffffff', TEXTO, 'Apoio sobre folha: descrição das etapas, dica'],
    ['#262947', '#f2f7ef', TEXTO, 'Tinta sobre ficha: texto na coluna do percurso'],
    ['#555c78', '#f2f7ef', TEXTO, 'Apoio sobre ficha: descrição da etapa'],
    ['#2d7a1a', '#f2f7ef', TEXTO, 'Verde de ação sobre ficha: quem faz a etapa'],
    ['#2560a8', '#ffffff', TEXTO, 'Azul sobre folha: links'],
    ['#ffffff', '#2d7a1a', TEXTO, 'Folha sobre verde de ação: botão Entrar e número da etapa'],
    ['#b91c1c', '#fef2f2', TEXTO, 'Erro do formulário'],
    ['#7a8098', '#ffffff', GRAFICO, 'Borda do campo sobre folha'],
    ['#3d8c2a', '#f2f7ef', GRAFICO, 'Linha do percurso sobre ficha (gráfico)'],
    ['#2560a8', '#ffffff', GRAFICO, 'Anel de foco contra o halo branco']
  ]
};

let falhas = 0;
for (const [nome, pares] of Object.entries(DIRECOES)) {
  console.log(`\n${nome}`);
  for (const [fg, bg, min, uso] of pares) {
    const r = contrastRatio(fg, bg);
    const ok = r >= min;
    if (!ok) falhas += 1;
    console.log(`  ${ok ? 'ok  ' : 'FALHA'} ${fg} sobre ${bg}  ${r.toFixed(2)}:1  (mín. ${min}:1)  ${uso}`);
  }
}
console.log(falhas ? `\n${falhas} par(es) abaixo do mínimo.` : '\nTodos os pares no mínimo ou acima.');
process.exitCode = falhas ? 1 : 0;
