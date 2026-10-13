// Apenas dados sintéticos para inspeção visual da exportação destinada ao paciente.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'node_modules/ts-node')).register({ project: path.join(root, 'tsconfig.json'), transpileOnly: true });
const { mealsForPrint } = require(path.join(root, 'src/planos-alimentares/prescricao-contract.ts'));
const { planoAlimentarPdfReport } = require(path.join(root, 'src/planos-alimentares/plano-alimentar.pdf.ts'));
const { renderLainesPdf } = require(path.join(root, 'src/common/pdf/laines-pdf.renderer.ts'));

const base = [
  ['arroz', 'Arroz integral cozido — exemplo', 100, 25, 2.5, 0.8, 1.8, 'colher de sopa', 25],
  ['feijao', 'Feijão carioca cozido — exemplo', 80, 14, 5, 0.5, 7, 'concha pequena', 80],
  ['frango', 'Frango desfiado — exemplo', 165, 0, 31, 3.6, 0, 'colher de sopa', 30],
  ['banana', 'Banana prata — exemplo', 90, 23, 1.2, 0.2, 2, 'unidade', 75],
  ['aveia', 'Aveia em flocos — exemplo', 380, 65, 14, 7, 9, 'colher de sopa', 15],
  ['iogurte', 'Iogurte natural — exemplo', 65, 5, 4, 3, 0, 'copo', 170],
  ['batata', 'Batata-doce cozida — exemplo', 86, 20, 1.5, 0.1, 3, 'unidade pequena', 100],
  ['mandioca', 'Mandioca cozida — exemplo', 125, 30, 1, 0.3, 2, 'pedaço pequeno', 80],
  ['ovo', 'Ovo cozido — exemplo', 150, 1, 13, 11, 0, 'unidade', 50]
];
const catalogo = Object.fromEntries(base.map(([id, nome, kcal, cho, ptn, lip, fibra, medida, gramas]) => [id, {
  id, nome, fonte: 'manual', grupo: 'exemplo', medidas: [{ descricao: medida, gramas }],
  comp: { kcal, cho, ptn, lip, fibra }
}]));
const mealData = [
  ['Café da manhã', '07:00', ['iogurte', 'aveia', 'banana']],
  ['Lanche da manhã', '10:00', ['banana', 'aveia']],
  ['Almoço', '12:30', ['arroz', 'feijao', 'frango']],
  ['Lanche da tarde', '16:00', ['iogurte', 'banana', 'aveia']],
  ['Jantar', '19:30', ['arroz', 'feijao', 'frango', 'batata']],
  ['Ceia', '21:30', ['iogurte', 'banana']]
];
const dados = {
  schemaVersion: 2, catalogo,
  refeicoes: mealData.map(([nome, horarioFixo, ids], mealIndex) => ({
    nome, horarioFixo, orientacoes: mealIndex === 2
      ? 'Texto fictício para testar uma orientação registrada com acentos, quebra de linha e leitura em papel.' : '',
    itens: ids.map((alimentoId, index) => ({ id: `${mealIndex}-${index}`, alimentoId, medidaIdx: 0,
      quantidade: index === 0 ? 2 : 1,
      substitutos: mealIndex === 2 && alimentoId === 'arroz'
        ? [{ alimentoId: 'batata', medidaIdx: 0, modo: 'fixa', quantidade: 1 },
          { alimentoId: 'mandioca', medidaIdx: 0, modo: 'fixa', quantidade: 1 }]
        : mealIndex === 2 && alimentoId === 'frango'
          ? [{ alimentoId: 'ovo', medidaIdx: 0, modo: 'fixa', quantidade: 2 }] : [] }))
  })),
  suplementos: [{ nome: 'Suplemento fictício', dose: 'Dose registrada no teste', horario: '16:00', marca: 'Marca exemplo' }],
  orientacoesGerais: 'Exemplo fictício de texto registrado pelo profissional. Não representa prescrição real.',
  revisaoFinal: { confirmada: true, origem: 'servidor', version: 3,
    confirmadoPorNome: 'Profissional Exemplo', crn: '00000', confirmadoEm: '2026-09-29T12:00:00.000Z' }
};
const plano = { status: 'ativo', dataInicio: '2026-09-29', dataFim: '2026-10-29', tipoDieta: 'fixa' };
const paciente = { nome: 'Atleta Exemplo — dados fictícios', prontuario: 'EXEMPLO-001' };
const output = process.argv[2] || path.join(root, '..', 'output/pdf/plano-alimentar-exemplo.pdf');

(async () => {
  const report = planoAlimentarPdfReport(plano, paciente,
    { ...dados, refeicoes: mealsForPrint(dados) }, true);
  const pdf = await renderLainesPdf(report);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, pdf);
  process.stdout.write(`PDF sintético do paciente: ${output} (${pdf.length} bytes)\n`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
