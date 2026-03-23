// services/calculos.js

/**
 * Bioimpedância (BIA) - Fórmulas básicas
 * Nota: As Fórmulas específicas podem variar dependendo do equipamento
 */

export const calcularBioimpedancia = (dados) => {
  const { impedancia: _impedancia, peso, altura, idade, sexo, nivelAtividade } = dados;
  
  // Fórmula simplificada para % de gordura (exemplo)
  let percentualGordura;
  if (sexo === 'M') {
    percentualGordura = (1.2 * (peso / (altura * altura / 10000))) + (0.23 * idade) - 16.2;
  } else {
    percentualGordura = (1.2 * (peso / (altura * altura / 10000))) + (0.23 * idade) - 5.4;
  }
  
  const massaGorda = (percentualGordura / 100) * peso;
  const massaMagra = peso - massaGorda;
  const aguaCorporal = massaMagra * 0.73; // Aproximadamente 73% da massa magra
  
  // TMB (Taxa Metabólica Basal) - Harris-Benedict
  let tmb;
  if (sexo === 'M') {
    tmb = 66 + (13.7 * peso) + (5 * altura) - (6.8 * idade);
  } else {
    tmb = 655 + (9.6 * peso) + (1.8 * altura) - (4.7 * idade);
  }
  
  // Ajustar pelo nível de atividade
  const fatoresAtividade = {
    sedentario: 1.2,
    leve: 1.375,
    moderado: 1.55,
    intenso: 1.725,
    muitoIntenso: 1.9
  };
  
  const getTMB = tmb * (fatoresAtividade[nivelAtividade] || 1.2);
  
  return {
    percentualGordura: Math.max(0, Math.min(100, percentualGordura)),
    massaGorda: Math.max(0, massaGorda),
    massaMagra: Math.max(0, massaMagra),
    aguaCorporal: Math.max(0, aguaCorporal),
    tmb: Math.round(tmb),
    getTMB: Math.round(getTMB)
  };
};

/**
 * Dobras cutâneas - Fórmulas de Jackson & Pollock
 */
export const calcularDobrasCutaneas = (dobras, idade, sexo, peso) => {
  // Soma das dobras (exemplo: 3 dobras para homens, 4 para mulheres)
  const somaDobras = Object.values(dobras).reduce((a, b) => a + b, 0);
  
  // Densidade corporal (Jackson & Pollock)
  let densidade;
  if (sexo === 'M') {
    densidade = 1.10938 - (0.0008267 * somaDobras) + (0.0000016 * Math.pow(somaDobras, 2)) - (0.0002574 * idade);
  } else {
    // Fórmula para mulheres (7 dobras)
    densidade = 1.097 - (0.00046971 * somaDobras) + (0.00000056 * Math.pow(somaDobras, 2)) - (0.00012828 * idade);
  }
  
  // % de gordura (Fórmula de Siri)
  const percentualGordura = (495 / densidade) - 450;
  
  const massaGorda = (percentualGordura / 100) * peso;
  const massaMagra = peso - massaGorda;
  
  // TMB de Cunningham (baseado na massa magra)
  const tmbCunningham = 500 + (22 * massaMagra);
  
  return {
    densidadeCorporal: densidade,
    percentualGordura: Math.max(0, Math.min(100, percentualGordura)),
    massaGorda,
    massaMagra,
    tmbCunningham: Math.round(tmbCunningham)
  };
};

/**
 * Perímetros corporais e cálculos inteligentes
 */
export const calcularPerimetros = (medidas) => {
  const {
    cintura,
    quadril,
    bracoRelaxado,
    bracoContraido: _bracoContraido,
    coxa: _coxa,
    panturrilha: _panturrilha,
    dobraTricipital
  } = medidas;
  
  // WHR (Waist-Hip Ratio)
  const whr = cintura / quadril;
  
  // AMC (Área Muscular do Braço)
  const amc = Math.pow(bracoRelaxado - (Math.PI * dobraTricipital), 2) / (4 * Math.PI);
  
  // AMA (Área Muscular do Braço Ajustada)
  const ama = amc - 6.5; // Constante de correção para sexo feminino
  
  // AFA (Área de Gordura do Braço)
  const areaTotalBraco = Math.PI * Math.pow(bracoRelaxado / (2 * Math.PI), 2);
  const afa = areaTotalBraco - amc;
  
  return {
    whr: whr.toFixed(2),
    amc: amc.toFixed(2),
    ama: ama.toFixed(2),
    afa: afa.toFixed(2),
    classificacaoWHR: classificarWHR(whr),
    classificacaoAMC: classificarAMC(amc, medidas.sexo)
  };
};

/**
 * Avaliação de hidratação
 */
export const calcularHidratacao = (dados) => {
  const { pesoPre, pesoPos, duracaoExercicio, volumeLiquidos, pesoSeco: _pesoSeco } = dados;
  
  const perdaSuor = pesoPre - pesoPos;
  const taxaSudorese = (perdaSuor / duracaoExercicio) * 60; // kg/h
  const percentualPerdaPeso = ((pesoPre - pesoPos) / pesoPre) * 100;
  
  // Balanço hídrico
  const balancoHidrico = volumeLiquidos - perdaSuor;
  
  return {
    perdaSuor: perdaSuor.toFixed(2),
    taxaSudorese: taxaSudorese.toFixed(2),
    percentualPerdaPeso: percentualPerdaPeso.toFixed(2),
    balancoHidrico: balancoHidrico.toFixed(2),
    statusHidratacao: classificarHidratacao(percentualPerdaPeso)
  };
};

// Funções de classificação
export const classificarIMC = (imc) => {
  if (imc < 18.5) return { classificacao: 'Abaixo do peso', cor: 'warning' };
  if (imc < 25) return { classificacao: 'Peso normal', cor: 'success' };
  if (imc < 30) return { classificacao: 'Sobrepeso', cor: 'warning' };
  if (imc < 35) return { classificacao: 'Obesidade Grau I', cor: 'danger' };
  if (imc < 40) return { classificacao: 'Obesidade Grau II', cor: 'danger' };
  return { classificacao: 'Obesidade Grau III', cor: 'danger' };
};

export const classificarWHR = (whr) => {
  if (whr < 0.9) return 'Baixo risco';
  if (whr < 1.0) return 'Risco moderado';
  return 'Alto risco';
};

export const classificarAMC = (amc, sexo) => {
  const valores = sexo === 'M' 
    ? { abaixo: 20, normal: [20, 32], acima: 32 }
    : { abaixo: 18, normal: [18, 28], acima: 28 };
  
  if (amc < valores.abaixo) return 'Abaixo do normal';
  if (amc > valores.acima) return 'Acima do normal';
  return 'Normal';
};

export const classificarHidratacao = (percentualPerdaPeso) => {
  const value = Number(percentualPerdaPeso);
  if (!Number.isFinite(value)) return 'Indefinido';
  if (value <= 1) return 'Adequada';
  if (value <= 2) return 'Leve desidratacao';
  if (value <= 5) return 'Desidratacao moderada';
  return 'Desidratacao severa';
};

