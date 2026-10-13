// WI-006: somente dados sintéticos, sem API, banco ou paciente real.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const helperPath = path.join(__dirname, '..', 'src/views/avaliacoes/publicTriageContext.js');

const findItem = (context, label) => (
  context.sections.flatMap((section) => section.items).find((item) => item.label === label)
);

const run = async () => {
  const { getMergedOnboardingData, getPublicTriageContext } = await import(pathToFileURL(helperPath).href);

  for (const confirmation of [null, undefined, {}, { inscricaoPublica: { dados: [] } }]) {
    const context = getPublicTriageContext(confirmation);
    assert.deepEqual(context, {
      data: {}, updatedAt: null, hasData: false, summary: [], sections: []
    });
    assert.deepEqual(getMergedOnboardingData(confirmation), {});
  }
  assert.equal(getPublicTriageContext({ dados: { modalidadePrincipal: 'Dado posterior' } }).hasData, false,
    'dados posteriores isolados não podem parecer triagem pública');

  const publicData = Object.freeze({
    modalidadePrincipal: 'Corrida',
    frequenciaSemanal: 4,
    tipoTreino: 'forca',
    objetivo: 'performance',
    avaliacaoSolicitada: ['nutricional', 'fisioterapia'],
    cpf: '52998224725',
    telefone: '99999999999',
    email: 'pessoa@example.invalid'
  });
  const confirmation = Object.freeze({
    inscricaoPublica: Object.freeze({ atualizadoEm: '2026-09-20T10:00:00.000Z', dados: publicData }),
    dados: Object.freeze({ modalidadePrincipal: 'Natação', objetivo: 'saude', nome: 'Nome posterior' })
  });
  const context = getPublicTriageContext(confirmation);
  assert.strictEqual(context.data, publicData, 'data deve apontar somente para o snapshot público');
  assert.equal(context.updatedAt, '2026-09-20T10:00:00.000Z');
  assert.equal(context.hasData, true);
  assert.equal(findItem(context, 'Modalidade').value, 'Corrida');
  assert.equal(findItem(context, 'Tipo de treino').value, 'Força');
  assert.equal(findItem(context, 'Objetivo informado').value, 'Melhora de desempenho');
  assert.equal(findItem(context, 'Avaliações solicitadas').value, 'Avaliação nutricional, Avaliação fisioterapêutica');
  assert.deepEqual(getMergedOnboardingData(confirmation), {
    ...publicData,
    modalidadePrincipal: 'Natação',
    objetivo: 'saude',
    nome: 'Nome posterior'
  }, 'o onboarding posterior deve prevalecer campo a campo');
  assert.ok(context.summary.length <= 3);

  const newTriage = getPublicTriageContext({ inscricaoPublica: { dados: {
    esportes: [
      { modalidade: 'Corrida', tempoPratica: '2 a 5 anos', duracaoSessao: 60 },
      { modalidade: 'Natação', tempoPratica: '6 meses a 1 ano', duracaoSessao: 45 }
    ],
    modalidadePrincipal: 'Corrida', outrasModalidades: 'Natação',
    lesaoAtual: false, lesaoUltimos3Meses: true, impactoLesao: 'adaptada'
  } } });
  assert.equal(findItem(newTriage, 'Esporte 1').value, 'Corrida · 2 a 5 anos · 60 min/sessão');
  assert.equal(findItem(newTriage, 'Esporte 2').value, 'Natação · 6 meses a 1 ano · 45 min/sessão');
  assert.equal(findItem(newTriage, 'Modalidade'), undefined, 'não duplicar primeira modalidade legada');
  assert.equal(findItem(newTriage, 'Lesão ou dor atual relatada').value, 'Não');
  assert.equal(findItem(newTriage, 'Lesão nos últimos três meses relatada').value, 'Sim');
  assert.equal(findItem(newTriage, 'Impacto atual na prática').value, 'Treino adaptado');
  assert.match(newTriage.summary[0], /\+1/);
  const weeklySports = getPublicTriageContext({ inscricaoPublica: { dados: {
    esportes: [
      { modalidade: 'Corrida', frequenciaSemanal: 3, duracaoSessao: 60 },
      { modalidade: 'Nado', frequenciaSemanal: 5, duracaoSessao: 45 }
    ],
    frequenciaSemanal: 7
  } } });
  assert.match(findItem(weeklySports, 'Esporte 1').value, /Corrida · 3×\/semana/);
  assert.match(findItem(weeklySports, 'Esporte 2').value, /Nado · 5×\/semana/);
  assert.match(weeklySports.summary[0], /3×\/semana/);
  assert.equal(findItem(weeklySports, 'Frequência semanal'), undefined,
    'o valor principal não deve duplicar as frequências de cada esporte');
  const legacyWeeklySports = getPublicTriageContext({ inscricaoPublica: { dados: {
    esportes: [
      { modalidade: 'Corrida', duracaoSessao: 60 },
      { modalidade: 'Nado', duracaoSessao: 45 }
    ],
    frequenciaSemanal: 4
  } } });
  assert.match(findItem(legacyWeeklySports, 'Esporte 1').value, /Corrida · 4×\/semana/);
  assert.doesNotMatch(findItem(legacyWeeklySports, 'Esporte 2').value, /×\/semana/);
  assert.equal(findItem(legacyWeeklySports, 'Frequência semanal'), undefined);
  const noInjuryAnswer = getPublicTriageContext({ inscricaoPublica: { dados: {
    esportes: [{ modalidade: 'Vôlei' }]
  } } });
  assert.equal(findItem(noInjuryAnswer, 'Lesão ou dor atual relatada'), undefined,
    'ausência de resposta não é negativa');

  const visible = JSON.stringify({ summary: context.summary, sections: context.sections });
  for (const secret of ['52998224725', '99999999999', 'pessoa@example.invalid']) {
    assert.ok(!visible.includes(secret), `identificador pessoal exposto: ${secret}`);
  }
  for (const label of ['CPF', 'Telefone', 'Email']) {
    assert.ok(!visible.includes(label), `rótulo pessoal exposto: ${label}`);
  }

  const negatives = getPublicTriageContext({ inscricaoPublica: { dados: {
    comorbidadesPessoais: [], sinaisClinicos: [], examesRealizados: [],
    relatoNegativo: { comorbidades: true, sinais: true, exames: true },
    hidratacao: 0, suplementoNoDia: 'Não',
    redsInstrumento: 'leaf_q', redsRespostas: { leaf_q1: false }, redsScore: 0,
    ebia: { respostas: [{ pergunta: 'Sintética', resposta: 'Não' }, { pergunta: 'Sem resposta', resposta: null }] }
  } } });
  assert.match(findItem(negatives, 'Condições pessoais relatadas').value, /Nenhuma/);
  assert.match(findItem(negatives, 'Sinais relatados').value, /Nenhum/);
  assert.match(findItem(getPublicTriageContext({ inscricaoPublica: { dados: {
    sinaisClinicos: ['nenhum']
  } } }), 'Sinais relatados').value, /Nenhum/);
  assert.match(findItem(negatives, 'Exames informados').value, /Nenhum/);
  assert.equal(findItem(negatives, 'Líquidos por dia informados').value, '0 L/dia');
  assert.equal(findItem(negatives, 'Suplemento ou medicamento no dia').value, 'Não');
  assert.match(findItem(negatives, 'Rastreio de disponibilidade energética autorrelatado').value, /1 resposta registrada/);
  assert.match(findItem(negatives, 'Rastreio EBIA autorrelatado').value, /1 resposta registrada/);
  assert.ok(!JSON.stringify(negatives.sections).includes('score'));
  assert.ok(!JSON.stringify(negatives.sections).includes('classificação'));
  assert.equal(findItem(getPublicTriageContext({ inscricaoPublica: { dados: {
    suplementoNoDia: false
  } } }), 'Suplemento ou medicamento no dia').value, 'Não',
  'false explícito permanece visível');

  const unanswered = getPublicTriageContext({ inscricaoPublica: { dados: {
    comorbidadesPessoais: [], sinaisClinicos: [], examesRealizados: [],
    relatoNegativo: { comorbidades: false, sinais: false, exames: false }
  } } });
  assert.equal(unanswered.hasData, false, 'arrays vazios e flags falsas não são respostas negativas');
  assert.deepEqual(unanswered.sections, []);
  assert.equal(getPublicTriageContext({ inscricaoPublica: { dados: {
    cpf: '52998224725', telefone: '99999999999', email: 'pessoa@example.invalid'
  } } }).hasData, false, 'somente identificadores pessoais não geram painel');

  const conflict = getPublicTriageContext({ inscricaoPublica: { dados: {
    comorbidadesPessoais: ['Hipertensão'], relatoNegativo: { comorbidades: true }
  } } });
  assert.equal(findItem(conflict, 'Condições pessoais relatadas').value, 'Hipertensão',
    'lista preenchida prevalece sobre flag negativa contraditória');

  const detailed = getPublicTriageContext({ inscricaoPublica: { dados: {
    sexoBiologico: 'feminino', genero: 'outro',
    comorbidadesFamiliares: { pai: ['Hipertensão'], mae: ['Diabetes'] },
    historicoSaude: 'Pai: Hipertensão | Mãe: Diabetes | Cirurgia relatada em 2020',
    observacoes: 'Prefere consulta pela manhã. CPF 529.982.247-25; contato pessoa@example.invalid ou (84) 99999-9999.',
    rendaMensal: 'Até R$ 1.412', escolaridade: 'Ensino médio completo'
  } } });
  assert.equal(findItem(detailed, 'Sexo biológico informado').value, 'Feminino');
  assert.equal(findItem(detailed, 'Histórico familiar relatado').value, 'Pai: Hipertensão · Mãe: Diabetes');
  assert.equal(findItem(detailed, 'Histórico de saúde informado').value, 'Cirurgia relatada em 2020');
  assert.equal(findItem(detailed, 'Renda declarada').value, 'Até R$ 1.412');
  assert.equal(findItem(detailed, 'Escolaridade').value, 'Ensino médio completo');
  assert.match(findItem(detailed, 'Observações da inscrição').value, /Prefere consulta pela manhã/);
  const detailedDisplay = JSON.stringify({ summary: detailed.summary, sections: detailed.sections });
  for (const secret of ['529.982.247-25', 'pessoa@example.invalid', '(84) 99999-9999']) {
    assert.ok(!detailedDisplay.includes(secret), `identificador em texto livre exposto: ${secret}`);
  }
  const duplicated = getPublicTriageContext({ inscricaoPublica: { dados: {
    comorbidadesFamiliares: { pai: ['Hipertensão'], mae: ['Diabetes'] },
    historicoSaude: 'Pai: Hipertensão | Mãe: Diabetes'
  } } });
  assert.equal(findItem(duplicated, 'Histórico de saúde informado'), undefined,
    'resumo textual da família não deve aparecer duas vezes');
  assert.equal(findItem(getPublicTriageContext({ inscricaoPublica: { dados: {
    genero: 'feminino'
  } } }), 'Sexo biológico informado'), undefined,
  'gênero não substitui informação explícita de sexo biológico');

  console.log('PASS WI-006: contexto da triagem pública, precedência, ausência e privacidade de exibição');
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
