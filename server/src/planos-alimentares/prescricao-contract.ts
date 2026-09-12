import { BadRequestException } from '@nestjs/common';

type RecordData = Record<string, any>;
export const SCHEMA_PRESCRICAO = 2;
const record = (v: any): RecordData => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const array = (v: any): any[] => Array.isArray(v) ? v : [];
const number = (v: any) => v === null || v === undefined || v === '' ? null : Number(v);
const nutrients = { calorias: 'kcal', cho: 'cho', ptn: 'ptn', lip: 'lip', fibra: 'fibra' };

function legacyFood(food: RecordData, id: string) {
  const grams = number(food.quantidadeGramas) ?? 100;
  return {
    ...food, id, nome: food.descricao || 'Alimento sem nome', fonte: 'plano',
    origemComposicao: 'legado_pendente', grupo: null, grupoEquivalencia: null, ig: null,
    medidas: [{ descricao: food.medidaCaseira || null, gramas: 1 }],
    comp: Object.fromEntries(Object.entries(nutrients).map(([old, key]) => [key,
      number(food[old]) === null || grams <= 0 ? null : Number(food[old]) * 100 / grams
    ]))
  };
}

/** Lossless lazy migration: source fields remain available; schema 2 items are authoritative. */
export function normalizePrescription(input: unknown): RecordData {
  const dados = record(input);
  if (dados.schemaVersion !== undefined && ![1, SCHEMA_PRESCRICAO].includes(dados.schemaVersion)) {
    throw new BadRequestException('Versão de prescrição não suportada. Atualize a aplicação antes de salvar.');
  }
  const catalogo = { ...record(dados.catalogo) };
  const refeicoes = array(dados.refeicoes).map((source, i) => {
    const meal = record(source);
    const oldFoods = array(meal.alimentos);
    const migrate = dados.schemaVersion !== SCHEMA_PRESCRICAO
      && (!Array.isArray(meal.itens) || (!meal.itens.length && oldFoods.length));
    let itens = array(meal.itens).map((item) => ({ ...item, substitutos: array(item.substitutos).map((sub) => ({ ...sub })) }));
    let unlinked = [...array(meal.substitutosSemVinculo)];
    if (migrate) {
      itens = oldFoods.map((food, j) => {
        const id = `legado-${i}-${j}`;
        catalogo[id] = legacyFood(food, id);
        return { id: `i${i}-${j}`, alimentoId: id, medidaIdx: 0, quantidade: number(food.quantidadeGramas) ?? 100, substitutos: [] };
      });
      const substitutes = array(meal.substitutos);
      if (itens.length === 1) {
        itens[0].substitutos = substitutes.map((food, j) => {
          const id = `legado-${i}-sub-${j}`;
          catalogo[id] = legacyFood(food, id);
          return { alimentoId: id, medidaIdx: 0, modo: 'fixa', quantidade: number(food.quantidadeGramas) ?? 100 };
        });
      } else if (!unlinked.length) unlinked = substitutes;
    }
    const horarioFixo = meal.horarioFixo || meal.horario || '';
    return { ...meal, id: meal.id || `r${i}`, nome: meal.nome || `Refeição ${i + 1}`, horarioFixo,
      itens, substitutosSemVinculo: unlinked };
  });
  return { ...dados, schemaVersion: SCHEMA_PRESCRICAO, catalogo, refeicoes };
}

export function validatePrescription(dados: RecordData) {
  if (dados.refeicoes.length > 40 || Object.keys(dados.catalogo).length > 2500) {
    throw new BadRequestException('Plano excede o limite de refeições ou alimentos.');
  }
  const validateItem = (item: RecordData, automatic = false) => {
    const food = dados.catalogo[item.alimentoId];
    const measure = food?.medidas?.[item.medidaIdx ?? 0];
    if (!food || !measure || !Number.isInteger(item.medidaIdx ?? 0)) {
      throw new BadRequestException('Alimento ou medida ausente do catálogo da prescrição.');
    }
    const qty = number(item.quantidade);
    if ((!automatic || qty !== null) && (!Number.isFinite(qty) || Number(qty) <= 0 || Number(qty) > 100000)) {
      throw new BadRequestException('Quantidade prescrita deve ser positiva e finita.');
    }
    if (!Number.isFinite(Number(measure.gramas)) || Number(measure.gramas) <= 0 || Number(measure.gramas) > 100000) {
      throw new BadRequestException('Medida em gramas inválida.');
    }
    for (const [key, value] of Object.entries(record(food.comp))) {
      const v = number(value);
      const max = key === 'kcal' ? 1000 : ['cho', 'ptn', 'lip', 'fibra'].includes(key) ? 100 : 1000000;
      if (v !== null && (!Number.isFinite(v) || v < 0 || v > max)) {
        throw new BadRequestException(`Composição inválida por 100 g: ${key}. Revise a origem do alimento.`);
      }
    }
  };
  for (const meal of dados.refeicoes) {
    if (meal.itens.length > 100) throw new BadRequestException('Refeição excede o limite de itens.');
    for (const item of meal.itens) {
      validateItem(item);
      if (array(item.substitutos).length > 30) throw new BadRequestException('Item excede o limite de alternativas.');
      for (const sub of array(item.substitutos)) validateItem(sub, sub.modo !== 'fixa');
    }
  }
}

export function portion(item: RecordData, catalogo: RecordData) {
  const food = catalogo[item.alimentoId];
  const medida = food?.medidas?.[item.medidaIdx ?? 0];
  if (!food || !medida) throw new BadRequestException('Alimento ou medida ausente do catálogo da prescrição.');
  const grams = Number(item.quantidade) * Number(medida.gramas);
  return { descricao: food.nome, quantidadeGramas: grams, medidaCaseira: medida.descricao,
    quantidadeMedidas: medida.descricao && food.fonte !== 'plano' ? Number(item.quantidade) : null,
    ...Object.fromEntries(Object.entries(nutrients).map(([label, key]) => [label,
      number(food.comp?.[key]) === null ? null : Number(food.comp[key]) * grams / 100
    ])) };
}

/** Shared delivery projection for PDF and athlete portal; alternatives never contribute to totals. */
export function mealsForPrint(dados: RecordData) {
  return dados.refeicoes.map((meal: RecordData) => {
    const alimentos = meal.itens.map((item: RecordData) => portion(item, dados.catalogo));
    const substitutos = meal.itens.flatMap((item: RecordData) => array(item.substitutos).map((sub) => {
      const food = dados.catalogo[sub.alimentoId];
      const base = dados.catalogo[item.alimentoId];
      const medida = food.medidas[sub.medidaIdx ?? 0];
      const baseMeasure = base.medidas[item.medidaIdx ?? 0];
      const anchor = base.grupoEquivalencia;
      const value = (comp: RecordData) => anchor === 'choDisponivel'
        ? (number(comp.cho) === null || number(comp.fibra) === null ? null : Math.max(0, comp.cho - comp.fibra))
        : number(comp[anchor]);
      let quantidade = number(sub.quantidade);
      if (sub.modo !== 'fixa' && anchor) {
        const a = value(base.comp), b = value(food.comp);
        if (a && b) quantidade = Math.max(0.5, Math.round((a * item.quantidade * baseMeasure.gramas / (b * medida.gramas)) / 0.5) * 0.5);
      }
      quantidade ??= Number(medida.gramas) === 1 ? 100 : 1;
      return { ...portion({ ...sub, quantidade }, dados.catalogo), substitui: base.nome };
    }));
    const treino = String(dados.treinoInicio || '').split(':').map(Number);
    let horario = meal.horarioFixo || meal.horario || '';
    if (meal.ancora) {
      horario = '';
      if (treino.length === 2 && treino.every(Number.isFinite)) {
        const minutes = ((treino[0] * 60 + treino[1] + (meal.ancora.ref === 'fim' ? Number(dados.treinoDuracao || 0) : 0) + Number(meal.ancora.min || 0)) % 1440 + 1440) % 1440;
        horario = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      }
    }
    const totalRefeicao = prescriptionTotals({ ...dados, refeicoes: [meal] });
    return { ...meal, horario, alimentos, totalRefeicao, substitutos: [...substitutos, ...array(meal.substitutosSemVinculo)] };
  });
}

export function prescriptionTotals(dados: RecordData) {
  validatePrescription(dados);
  const totals = { calorias: 0, cho: 0, ptn: 0, lip: 0, fibra: 0 };
  for (const meal of dados.refeicoes) for (const item of meal.itens) {
    const food = portion(item, dados.catalogo);
    for (const key of Object.keys(totals)) totals[key] += food[key] ?? 0;
  }
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Math.round(value * 100) / 100])) as typeof totals;
}
