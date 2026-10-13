// Regressão dos defeitos de cálculo do WI-013 (frente 1) nas funções puras do
// motor do cliente. Dados sintéticos; nenhum paciente real.
import assert from 'node:assert/strict';
import {
  calculateCircumferenceIndicators,
  calculateEvolutionReturnEvaluation,
  calculateGetEvaluation,
  calculateHydrationEvaluation,
  calculateNovaEvaluation,
  calculateWeeklyPal,
  calculateYmcaPercentFat,
  classifyNovaPattern,
  readSavedYmcaPercentFat,
  resolveLaboratoryConductTone,
  sumWeeklyActivityExpenditure,
  YMCA_PERCENT_FAT_RANGE
} from '../src/services/calculationEngine.js';

// Defeito 1: YMCA em polegadas e libras, com faixa plausível.
{
  const homem = calculateYmcaPercentFat({ sex: 'male', waistCm: 80, weightKg: 75 });
  assert.ok(Math.abs(homem.value - 11.33) < 0.05, `homem 80 cm / 75 kg: esperado ~11,3%, veio ${homem.value}`);
  const mulher = calculateYmcaPercentFat({ sex: 'female', waistCm: 75, weightKg: 60 });
  assert.ok(Math.abs(mulher.value - 26.41) < 0.05, `mulher 75 cm / 60 kg: esperado ~26,4%, veio ${mulher.value}`);

  const indicadores = calculateCircumferenceIndicators({ weightKg: 75, heightCm: 178, waistCm: 80, sex: 'male' });
  assert.equal(indicadores.indicators.ymcaPercentFat, homem.value);
  assert.equal(indicadores.classifications.ymcaPercentFat.label, 'Adequado');
  assert.equal(indicadores.flags.ymcaPercentFatOutOfRange, false);

  assert.deepEqual(YMCA_PERCENT_FAT_RANGE, { min: 2, max: 70 });
  const magro = calculateCircumferenceIndicators({ weightKg: 80, heightCm: 180, waistCm: 70, sex: 'male' });
  assert.equal(magro.indicators.ymcaPercentFat, null, 'abaixo de 2% vira null');
  assert.equal(magro.flags.ymcaPercentFatOutOfRange, true);
  assert.match(magro.classifications.ymcaPercentFat.label, /fora da faixa plaus/i);
  const absurdo = calculateYmcaPercentFat({ sex: 'male', waistCm: 200, weightKg: 50 });
  assert.equal(absurdo.value, null, 'acima de 70% vira null');
  assert.equal(absurdo.outOfRange, true);

  const semSexo = calculateCircumferenceIndicators({ weightKg: 75, waistCm: 80 });
  assert.equal(semSexo.indicators.ymcaPercentFat, null);
  assert.equal(semSexo.flags.ymcaPercentFatOutOfRange, false, 'sem sexo é ausência, não valor fora da faixa');

  assert.deepEqual(readSavedYmcaPercentFat(303.24), { value: null, legacyUnits: true }, 'registro antigo absurdo');
  assert.deepEqual(readSavedYmcaPercentFat(18.5), { value: 18.5, legacyUnits: false });
  assert.deepEqual(readSavedYmcaPercentFat(null), { value: null, legacyUnits: false });
}

// Defeito 2: o tom de conduta dos Exames lê os status reais do painel.
{
  assert.equal(resolveLaboratoryConductTone({ statusPainel: 'alterado', scoreRisco: 20 }), 'warn',
    'um analito alterado (escore 20) é no mínimo atenção, nunca "consistente"');
  assert.equal(resolveLaboratoryConductTone({ statusPainel: 'alterado', scoreRisco: 70 }), 'risk');
  assert.equal(resolveLaboratoryConductTone({ statusPainel: 'limitrofe', scoreRisco: 10 }), 'warn');
  assert.equal(resolveLaboratoryConductTone({ statusPainel: 'normal', scoreRisco: 0 }), 'ok');
  assert.equal(resolveLaboratoryConductTone({ statusPainel: 'sem_classificacao', scoreRisco: 0 }), 'sem_dados');
  assert.equal(resolveLaboratoryConductTone({}), 'sem_dados');
}

// Defeito 3: componente ausente sai do escore e os pesos se redistribuem.
{
  const completo = calculateEvolutionReturnEvaluation({ adesaoPlanoAlimentar: 80, adesaoAtividadeFisica: 70, respostaPercebida: 4 });
  assert.equal(completo.calculated.scoreAdesaoGeral, 75.75);
  assert.equal(completo.classifications.prioridadeRetorno, 'baixa');

  const soAlimentar = calculateEvolutionReturnEvaluation({ adesaoPlanoAlimentar: 80 });
  assert.equal(soAlimentar.calculated.scoreAdesaoGeral, 80, 'antes: 40 (ausentes contavam 0)');
  assert.equal(soAlimentar.classifications.prioridadeRetorno, 'baixa');

  const semResposta = calculateEvolutionReturnEvaluation({ adesaoPlanoAlimentar: 80, adesaoAtividadeFisica: 60 });
  assert.equal(semResposta.calculated.scoreAdesaoGeral, 71.76);
  assert.equal(semResposta.classifications.prioridadeRetorno, 'moderada');

  const vazio = calculateEvolutionReturnEvaluation({ sintomas: 'fadiga recorrente ha duas semanas' });
  assert.equal(vazio.calculated.scoreAdesaoGeral, null);
  assert.equal(vazio.classifications.prioridadeRetorno, null, 'sem componente não há "conduta prioritária"');
  assert.equal(vazio.calculated.resumoObjetivos[0].status, 'sem_classificacao');
}

// Defeito 4: semana sem atividade não vira PAL 1,0.
{
  const semanaVazia = [
    { dia: 'segunda', duracaoHoras: '', gastoKcal: null },
    { dia: 'terca', duracaoHoras: '0', gastoKcal: 0 }
  ];
  assert.equal(sumWeeklyActivityExpenditure([]), null);
  assert.equal(sumWeeklyActivityExpenditure(semanaVazia), null, 'antes: 0');
  assert.equal(calculateWeeklyPal({ weeklyActivityKcal: null, tmbKcal: 1700 }), null, 'antes: 1,0');

  const perfil = { sex: 'male', weightKg: 72, heightCm: 178, ageYears: 27, activityLevel: 'muito_ativo' };
  const peloNivel = calculateGetEvaluation({ ...perfil, customActivityFactor: null });
  assert.equal(peloNivel.activity.factorApplied, 1.725, 'vale o fator do nível escolhido');

  const semana = [
    { dia: 'segunda', duracaoHoras: '1,5', gastoKcal: 600 },
    { dia: 'quarta', duracaoHoras: '1', gastoKcal: 400 },
    { dia: 'sexta', duracaoHoras: '', gastoKcal: 300 }
  ];
  assert.equal(sumWeeklyActivityExpenditure(semana), 1000, 'só conta atividade com duração positiva');
  assert.equal(calculateWeeklyPal({ weeklyActivityKcal: 1000, tmbKcal: 1700 }), 1.084);
}

// Defeito 5: ganho de peso não gera perda, sudorese nem reposição negativas.
{
  const perda = calculateHydrationEvaluation({
    pesoAntesExercicio: 70, pesoAposExercicio: 68.9, duracaoExercicioMin: 60, volumeIngeridoMl: 500, volumeUrinarioMl: 100
  });
  assert.equal(Math.round(perda.metrics.perdaHidricaLiquidaMl), 1500);
  assert.equal(perda.metrics.metaReposicaoMl, 2250);
  assert.equal(perda.metrics.ganhoPesoKg, null);

  const ganho = calculateHydrationEvaluation({ pesoAntesExercicio: 70, pesoAposExercicio: 71, duracaoExercicioMin: 60 });
  assert.equal(ganho.metrics.perdaPesoAbsolutaKg, null, 'ganho não é "perda negativa"');
  assert.equal(ganho.metrics.perdaPesoPercentual, null);
  assert.ok(Math.abs(ganho.metrics.ganhoPesoKg - 1) < 1e-9, 'o ganho aparece como ganho');
  assert.equal(ganho.metrics.perdaHidricaLiquidaMl, null);
  assert.equal(ganho.metrics.taxaSudoreseLh, null);
  assert.equal(ganho.metrics.taxaSudoreseMlMin, null);
  assert.equal(ganho.metrics.metaReposicaoMl, null);
  assert.equal(ganho.flags.perdaSuorInconsistente, true);
  assert.ok(ganho.warnings.some((item) => /Balanco hidrico liquido negativo ou zero/i.test(item)));
  assert.equal(ganho.classification.label, 'Sem perda relevante');

  const ganhoComIngestao = calculateHydrationEvaluation({
    pesoAntesExercicio: 70, pesoAposExercicio: 70.3, duracaoExercicioMin: 60, volumeIngeridoMl: 1000
  });
  assert.equal(Math.round(ganhoComIngestao.metrics.perdaHidricaLiquidaMl), 700, 'Δpeso + ingestão − urina');
  assert.equal(ganhoComIngestao.metrics.metaReposicaoMl, 1050);
  assert.equal(ganhoComIngestao.flags.perdaSuorInconsistente, false);

  const zero = calculateHydrationEvaluation({
    pesoAntesExercicio: 70, pesoAposExercicio: 70.5, duracaoExercicioMin: 60, volumeIngeridoMl: 500
  });
  assert.equal(zero.metrics.perdaHidricaLiquidaMl, null, 'perda de suor igual a zero também vira null');

  for (const resultado of [ganho, ganhoComIngestao, zero, perda]) {
    for (const [chave, valor] of Object.entries(resultado.metrics)) {
      assert.ok(!(Number.isFinite(valor) && valor < 0), `${chave} negativo: ${valor}`);
    }
  }
}

// Defeito 6: total zero não é "Padrão saudável".
{
  const vazio = calculateNovaEvaluation({});
  assert.deepEqual(vazio.percentuais, {
    in_natura: null, minimamente_processados: null, processados: null, ultraprocessados: null
  });
  assert.equal(vazio.classification.label, 'Sem classificacao', 'antes: "Padrao saudavel"');
  assert.equal(classifyNovaPattern({}).label, 'Sem classificacao');

  const comDados = calculateNovaEvaluation({
    kcalInNatura: 400, kcalMinimamenteProcessados: 300, kcalProcessados: 200, kcalUltraprocessados: 100
  });
  assert.equal(comDados.percentuais.ultraprocessados, 10);
  assert.equal(comDados.classification.label, 'Padrao moderado');
}

console.log('test-calculos-avaliacoes: defeitos 1 a 6 do WI-013 cobertos e aprovados.');
