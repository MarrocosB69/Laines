/**
 * Seed da prescrição de plano alimentar.
 *
 * Enquanto a tela não fala com a API, isto alimenta o protótipo; nos testes,
 * é o cenário fixo do núcleo de cálculo. Fica fora dos componentes de
 * propósito: dado de exemplo dentro de componente vira dado de produção por
 * descuido, e o teste perde o cenário quando a tela muda.
 */

/**
 * Ausência de dado é null por padrão. Cada alimento declara só o que a tabela
 * informa; o resto permanece null e some dos somatórios em vez de virar zero.
 */
export const comp = (o) => ({
  kcal: null, cho: null, ptn: null, lip: null, fibra: null,
  ferro: null, calcio: null, zinco: null, magnesio: null,
  vitaminaD: null, potassio: null, sodio: null,
  ...o
});

/** Cada grupo declara o nutriente que ancora a equivalência — nunca caloria. */
export const GRUPOS = {
  frutas: { rotulo: 'Frutas', ancora: 'choDisponivel' },
  cereais: { rotulo: 'Cereais e tubérculos', ancora: 'choDisponivel' },
  carnes: { rotulo: 'Carnes e ovos', ancora: 'ptn' },
  leites: { rotulo: 'Leites e iogurtes', ancora: 'ptn' },
  gorduras: { rotulo: 'Gorduras', ancora: 'lip' }
};

export const CATALOGO = [
  { id: 'taco-banana-prata', nome: 'Banana prata, crua', fonte: 'TACO', grupo: 'frutas', ig: 51,
    medidas: [{ descricao: 'unidade média', gramas: 60 }],
    comp: comp({ kcal: 98, cho: 26, ptn: 1.3, lip: 0.1, fibra: 2, ferro: 0.4, calcio: 8, zinco: 0.1, magnesio: 26, potassio: 358, sodio: 0 }) },

  { id: 'taco-maca', nome: 'Maçã, com casca', fonte: 'TACO', grupo: 'frutas', ig: 36,
    medidas: [{ descricao: 'unidade média', gramas: 130 }],
    comp: comp({ kcal: 56, cho: 15.2, ptn: 0.3, lip: 0, fibra: 1.3, ferro: 0.1, calcio: 2, zinco: 0.1, magnesio: 3, potassio: 116, sodio: 0 }) },

  { id: 'taco-mamao-papaia', nome: 'Mamão papaia, cru', fonte: 'TACO', grupo: 'frutas', ig: 60,
    medidas: [{ descricao: 'fatia média', gramas: 100 }],
    comp: comp({ kcal: 40, cho: 10.4, ptn: 0.5, lip: 0.1, fibra: 1, ferro: 0.2, calcio: 25, zinco: 0.1, magnesio: 10, potassio: 222, sodio: 1 }) },

  { id: 'taco-laranja-pera', nome: 'Laranja pera, crua', fonte: 'TACO', grupo: 'frutas', ig: 43,
    medidas: [{ descricao: 'unidade média', gramas: 130 }],
    comp: comp({ kcal: 37, cho: 8.9, ptn: 1, lip: 0.1, fibra: 0.8, ferro: 0.1, calcio: 22, zinco: 0.1, magnesio: 10, potassio: 163, sodio: 1 }) },

  { id: 'tbca-aveia-flocos', nome: 'Aveia, flocos', fonte: 'TBCA', grupo: 'cereais', ig: 55,
    medidas: [{ descricao: 'colher de sopa', gramas: 15 }],
    comp: comp({ kcal: 394, cho: 66.6, ptn: 13.9, lip: 8.5, fibra: 9.1, ferro: 4.4, calcio: 48, zinco: 2.6, magnesio: 119, potassio: 336, sodio: 5 }) },

  { id: 'ibge-tapioca-goma', nome: 'Tapioca, goma hidratada', fonte: 'IBGE', grupo: 'cereais', ig: 85,
    medidas: [{ descricao: 'colher de servir', gramas: 25 }],
    comp: comp({ kcal: 236, cho: 60, ptn: 0.2, lip: 0, fibra: 0.5 }) },

  { id: 'taco-pao-frances', nome: 'Pão, francês', fonte: 'TACO', grupo: 'cereais', ig: 71,
    medidas: [{ descricao: 'unidade', gramas: 50 }],
    comp: comp({ kcal: 300, cho: 58.6, ptn: 8, lip: 3.1, fibra: 2.3, ferro: 1.1, calcio: 16, zinco: 0.6, magnesio: 24, potassio: 108, sodio: 648 }) },

  { id: 'taco-batata-doce', nome: 'Batata doce, cozida', fonte: 'TACO', grupo: 'cereais', ig: 63,
    medidas: [{ descricao: 'colher de servir', gramas: 60 }],
    comp: comp({ kcal: 77, cho: 18.4, ptn: 0.6, lip: 0.1, fibra: 2.2, ferro: 0.1, calcio: 17, zinco: 0.2, magnesio: 15, potassio: 148, sodio: 5 }) },

  { id: 'taco-arroz-branco', nome: 'Arroz, branco, cozido', fonte: 'TACO', grupo: 'cereais', ig: 73,
    medidas: [{ descricao: 'colher de sopa', gramas: 25 }],
    comp: comp({ kcal: 128, cho: 28.1, ptn: 2.5, lip: 0.2, fibra: 1.6, ferro: 0.1, calcio: 4, zinco: 0.5, magnesio: 3, potassio: 15, sodio: 1 }) },

  { id: 'taco-macarrao', nome: 'Macarrão, cozido', fonte: 'TACO', grupo: 'cereais', ig: 49,
    medidas: [{ descricao: 'escumadeira', gramas: 80 }],
    comp: comp({ kcal: 102, cho: 19.9, ptn: 3.3, lip: 1.1, fibra: 1.6, ferro: 0.5, calcio: 5, zinco: 0.4, magnesio: 12, potassio: 22, sodio: 1 }) },

  { id: 'taco-frango-peito', nome: 'Frango, peito, grelhado', fonte: 'TACO', grupo: 'carnes', ig: null,
    medidas: [{ descricao: 'filé médio', gramas: 100 }],
    comp: comp({ kcal: 159, cho: 0, ptn: 32, lip: 2.5, fibra: 0, ferro: 0.4, calcio: 4, zinco: 0.9, magnesio: 29, vitaminaD: 0.2, potassio: 260, sodio: 50 }) },

  { id: 'taco-ovo-cozido', nome: 'Ovo de galinha, cozido', fonte: 'TACO', grupo: 'carnes', ig: null,
    medidas: [{ descricao: 'unidade', gramas: 50 }],
    comp: comp({ kcal: 146, cho: 0.6, ptn: 13.3, lip: 9.5, fibra: 0, ferro: 1.6, calcio: 49, zinco: 1.1, magnesio: 12, vitaminaD: 1.1, potassio: 132, sodio: 140 }) },

  { id: 'taco-patinho', nome: 'Carne bovina, patinho, grelhado', fonte: 'TACO', grupo: 'carnes', ig: null,
    medidas: [{ descricao: 'bife médio', gramas: 100 }],
    comp: comp({ kcal: 219, cho: 0, ptn: 35.9, lip: 7.3, fibra: 0, ferro: 2.7, calcio: 4, zinco: 7.6, magnesio: 25, potassio: 320, sodio: 54 }) },

  { id: 'taco-tilapia', nome: 'Tilápia, filé, grelhado', fonte: 'TACO', grupo: 'carnes', ig: null,
    medidas: [{ descricao: 'filé médio', gramas: 100 }],
    comp: comp({ kcal: 128, cho: 0, ptn: 26.2, lip: 2.6, fibra: 0, ferro: 0.3, calcio: 14, zinco: 0.5, magnesio: 31, potassio: 380, sodio: 60 }) },

  { id: 'taco-iogurte-natural', nome: 'Iogurte natural, integral', fonte: 'TACO', grupo: 'leites', ig: 35,
    medidas: [{ descricao: 'pote', gramas: 170 }],
    comp: comp({ kcal: 51, cho: 1.9, ptn: 4.1, lip: 3, fibra: 0, ferro: 0.1, calcio: 143, zinco: 0.5, magnesio: 12, potassio: 172, sodio: 52 }) },

  { id: 'taco-leite-integral', nome: 'Leite de vaca, integral', fonte: 'TACO', grupo: 'leites', ig: 27,
    medidas: [{ descricao: 'copo', gramas: 200 }],
    comp: comp({ kcal: 61, cho: 4.7, ptn: 3.2, lip: 3.3, fibra: 0, ferro: 0.1, calcio: 123, zinco: 0.4, magnesio: 11, potassio: 152, sodio: 45 }) }
];

export const catalogoPorId = Object.fromEntries(CATALOGO.map((a) => [a.id, a]));

export const REFERENCIAS = [
  { nutriente: 'fibra', rotulo: 'Fibra', unidade: 'g', valor: 38, tipo: 'AI', direcao: 'meta' },
  { nutriente: 'ferro', rotulo: 'Ferro', unidade: 'mg', valor: 8, tipo: 'RDA', direcao: 'meta' },
  { nutriente: 'calcio', rotulo: 'Cálcio', unidade: 'mg', valor: 1000, tipo: 'RDA', direcao: 'meta' },
  { nutriente: 'zinco', rotulo: 'Zinco', unidade: 'mg', valor: 11, tipo: 'RDA', direcao: 'meta' },
  { nutriente: 'magnesio', rotulo: 'Magnésio', unidade: 'mg', valor: 400, tipo: 'RDA', direcao: 'meta' },
  { nutriente: 'vitaminaD', rotulo: 'Vitamina D', unidade: 'µg', valor: 15, tipo: 'RDA', direcao: 'meta' },
  { nutriente: 'potassio', rotulo: 'Potássio', unidade: 'mg', valor: 3400, tipo: 'AI', direcao: 'meta' },
  { nutriente: 'sodio', rotulo: 'Sódio', unidade: 'mg', valor: 2300, tipo: 'CDRR', direcao: 'limite' }
];

export const METAS = { kcal: 2450, cho: 296, ptn: 157, lip: 71, peso: 78.4 };

/** Restrições vindas da anamnese. Exclusão dura na busca de substitutos. */
export const RESTRICOES = ['taco-mamao-papaia'];

export const PLANO_INICIAL = {
  paciente: { nome: 'João Silva', idade: 24, peso: 78.4 },
  dia: 'Dia A · treino',
  refeicoes: [
    { id: 'r1', nome: 'Pré-treino', horario: '16h30', etiqueta: 'peri-treino', aberta: true,
      itens: [
        { id: 'i1', alimentoId: 'taco-banana-prata', medidaIdx: 0, quantidade: 2, substitutos: [] },
        { id: 'i2', alimentoId: 'tbca-aveia-flocos', medidaIdx: 0, quantidade: 4,
          substitutos: [{ alimentoId: 'taco-batata-doce', medidaIdx: 0, modo: 'auto' }] },
        { id: 'i3', alimentoId: 'ibge-tapioca-goma', medidaIdx: 0, quantidade: 2, substitutos: [] }
      ] },
    { id: 'r2', nome: 'Pós-treino', horario: '19h30', etiqueta: null, aberta: false,
      itens: [
        { id: 'i4', alimentoId: 'taco-arroz-branco', medidaIdx: 0, quantidade: 6, substitutos: [] },
        { id: 'i5', alimentoId: 'taco-frango-peito', medidaIdx: 0, quantidade: 1.5, substitutos: [] }
      ] },
    { id: 'r3', nome: 'Ceia', horario: '22h', etiqueta: null, aberta: false,
      itens: [
        { id: 'i6', alimentoId: 'taco-iogurte-natural', medidaIdx: 0, quantidade: 1, substitutos: [] },
        { id: 'i7', alimentoId: 'taco-ovo-cozido', medidaIdx: 0, quantidade: 2, substitutos: [] }
      ] }
  ]
};

/** Biblioteca do profissional: alimento + suas opções, reaproveitável entre planos. */
export const BIBLIOTECA_INICIAL = [
  { id: 'b1', nome: 'Frango do almoço', alimentoId: 'taco-frango-peito', escopo: 'pessoal',
    substitutos: [
      { alimentoId: 'taco-patinho', medidaIdx: 0, modo: 'auto' },
      { alimentoId: 'taco-tilapia', medidaIdx: 0, modo: 'auto' },
      { alimentoId: 'taco-ovo-cozido', medidaIdx: 0, modo: 'auto' }
    ] }
];

// Paleta dos macros alinhada ao app (acento --pn-accent, verde --pn-green).
// O roxo e o laranja originais vinham do prototipo e destoavam do navy.
export const COR = { cho: '#3E86B8', ptn: '#5C9150', lip: '#B08348' };
