// Exemplo sintético multipágina; nunca consulta dados reais nem rede.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'node_modules/ts-node')).register({ project: path.join(root, 'tsconfig.json'), transpileOnly: true });
const { renderLainesPdf } = require(path.join(root, 'src/common/pdf/laines-pdf.renderer.ts'));

const rows = Array.from({ length: 55 }, (_, index) => [
  `Alimento sintético ${index + 1} com nome de teste para verificar quebra de linha`,
  `${80 + index} g`,
  index % 4 === 0 ? 'Medida caseira conforme orientação registrada' : '1 porção'
]);
const report = {
  title: 'Plano alimentar de exemplo', shortTitle: 'Plano alimentar',
  subtitle: 'Exemplo com dados fictícios para revisão do template A4.',
  patient: [
    { label: 'Paciente', value: 'Atleta Exemplo da Silva' },
    { label: 'Data da avaliação', value: '29/09/2026' },
    { label: 'Profissional responsável', value: 'Profissional Exemplo · Nutrição' },
    { label: 'Registro', value: 'CRN 00000' }
  ],
  blocks: [
    { kind: 'metrics', items: [
      { label: 'Energia prescrita', value: '2.450', unit: 'kcal' },
      { label: 'Proteínas', value: '125', unit: 'g' },
      { label: 'Água informada', value: '2,2', unit: 'L' }
    ] },
    { kind: 'section', title: 'Refeições prescritas', blocks: [
      { kind: 'paragraph', text: 'Os itens abaixo são dados sintéticos. Quantidades e substituições são apresentadas para testar legibilidade, sem recomendação clínica.' },
      { kind: 'table', columns: [
        { label: 'Alimento', width: 0.5 }, { label: 'Quantidade', width: 0.18 },
        { label: 'Medida caseira', width: 0.32 }
      ], rows },
      { kind: 'subsection', title: 'Orientações registradas', blocks: [
        { kind: 'paragraph', text: 'Texto sintético longo com acentos: maçã, feijão, atenção e orientação. '.repeat(28) }
      ] }
    ] },
    { kind: 'section', title: 'Trocas vinculadas — teste de paginação', blocks: [
      { kind: 'choiceList',
        title: 'Refeição longa com descrição extensa para validar a continuação',
        entries: [{
          primary: { name: 'Alimento principal sintético com nome bastante extenso para quebrar a linha',
            quantity: '120 g · 2 × colher de sopa' },
          alternatives: Array.from({ length: 16 }, (_, index) => ({
            name: `Opção sintética ${index + 1} com descrição extensa e acentos: maçã e feijão`,
            quantity: `${90 + index} g · 1 × medida caseira descrita com bastante detalhe`,
            note: index % 2 ? 'Quantidade definida pela equipe' : undefined
          }))
        }, {
          primary: { name: 'Outro alimento de teste', quantity: '80 g · 1 concha pequena' },
          alternatives: Array.from({ length: 4 }, (_, index) => ({
            name: `Alternativa curta ${index + 1}`,
            quantity: `${70 + index} g · 1 medida caseira`
          }))
        }],
        unlinked: [{ name: 'Alternativa legada sem alimento de origem',
          quantity: '100 g · 1 × unidade', note: 'Quantidade definida pela equipe' }],
        note: 'Observação sintética longa registrada para verificar a separação entre o alimento e a alternativa. '.repeat(6)
      }
    ] },
    { kind: 'callout', title: 'Composição parcial', text: 'Subtotal conhecido; alguns alimentos do exemplo não possuem composição completa.', tone: 'info' },
    { kind: 'image', source: path.join(root, 'src/common/pdf/assets/logo-laines.png'),
      title: 'Imagem institucional de teste', caption: 'Imagem preservada em sua proporção original.', maxHeight: 150 },
    { kind: 'signature', name: 'Profissional Exemplo', area: 'Nutrição', registration: 'CRN 00000', institution: 'LAINES' }
  ]
};

(async () => {
  const pdf = await renderLainesPdf(report);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 5000);
  const output = process.argv[2] || path.join(root, '..', 'tmp/pdfs/laines-template-exemplo.pdf');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, pdf);
  process.stdout.write(`PASS template PDF LAINES: ${output} (${pdf.length} bytes)\n`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
