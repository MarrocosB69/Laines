import { BadRequestException } from '@nestjs/common';

type RecordData = Record<string, any>;
export const SCHEMA_PRESCRICAO = 2;
const record = (v: any): RecordData => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const array = (v: any): any[] => Array.isArray(v) ? v : [];
const number = (v: any) => v === null || v === undefined || v === '' ? null : Number(v);
const nutrients = { calorias: 'kcal', cho: 'cho', ptn: 'ptn', lip: 'lip', fibra: 'fibra' };

/** Derivado para entrega; `nome` do snapshot continua sendo a descricao oficial. */
export function nomeAlimentoParaEntrega(food: RecordData): string {
  const nome = String(food?.nome ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (!['TACO', 'TBCA'].includes(String(food?.fonte ?? '').toUpperCase())) return nome;
  const expandido = nome.replace(/(^|[\s,(])c\/(?=\s|$)/giu, '$1com')
    .replace(/(^|[\s,(])s\/(?=\s|$)/giu, '$1sem');
  let profundidade = 0;
  let resultado = '';
  for (const caractere of expandido) {
    if (caractere === '(') profundidade += 1;
    if (caractere === ')') profundidade = Math.max(0, profundidade - 1);
    resultado += caractere === ',' && profundidade === 0 ? ' · ' : caractere;
  }
  return resultado.replace(/\s*·\s*/gu, ' · ').replace(/\s+/gu, ' ').trim();
}

const ANCORAS_POR_GRUPO: Record<string, 'ptn' | 'choDisponivel' | 'lip'> = {
  'carnes e derivados': 'ptn', 'pescados e frutos do mar': 'ptn',
  'peixes e frutos do mar': 'ptn', 'ovos e derivados': 'ptn',
  'leite e derivados': 'ptn', 'leguminosas e derivados': 'ptn',
  'cereais e derivados': 'choDisponivel', 'frutas e derivados': 'choDisponivel',
  'verduras, hortalicas e derivados': 'choDisponivel',
  'vegetais e derivados': 'choDisponivel', 'produtos acucarados': 'choDisponivel',
  'gorduras e oleos': 'lip', 'gorduras e azeites': 'lip',
  'nozes e sementes': 'lip', 'sementes e oleaginosas': 'lip'
};

/** Mesma classificacao explícita da edição; o snapshot recebido não escolhe a âncora. */
export function ancoraDoGrupoParaEntrega(value: unknown) {
  const key = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
  return ANCORAS_POR_GRUPO[key] ?? null;
}

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

const valorAncora100 = (comp: RecordData, ancora: string | null) => {
  if (!ancora) return null;
  const valor = ancora === 'choDisponivel'
    ? (number(comp.cho) === null || number(comp.fibra) === null
      ? null : Math.max(0, Number(comp.cho) - Number(comp.fibra)))
    : number(comp[ancora]);
  return valor !== null && Number.isFinite(valor) && valor > 0 ? valor : null;
};

/** Sem âncora verificável, a quantidade da alternativa precisa ser prescrita. */
export function assertSubstitutosAutomaticos(dados: RecordData) {
  for (const meal of dados.refeicoes) for (const item of meal.itens) {
    const base = record(dados.catalogo[item.alimentoId]);
    for (const sub of array(item.substitutos)) {
      if (sub.modo === 'fixa') continue;
      const food = record(dados.catalogo[sub.alimentoId]);
      const ancora = base.grupo === food.grupo ? ancoraDoGrupoParaEntrega(base.grupo) : null;
      if (!valorAncora100(record(base.comp), ancora) || !valorAncora100(record(food.comp), ancora)) {
        throw new BadRequestException('Substituto sem equivalência automática: informe a quantidade prescrita antes da revisão.');
      }
    }
  }
}

export function portion(item: RecordData, catalogo: RecordData) {
  const food = catalogo[item.alimentoId];
  const medida = food?.medidas?.[item.medidaIdx ?? 0];
  if (!food || !medida) throw new BadRequestException('Alimento ou medida ausente do catálogo da prescrição.');
  const grams = Number(item.quantidade) * Number(medida.gramas);
  return { descricao: nomeAlimentoParaEntrega(food), quantidadeGramas: grams, medidaCaseira: medida.descricao,
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
      const anchor = base.grupo === food.grupo ? ancoraDoGrupoParaEntrega(base.grupo) : null;
      const a = valorAncora100(record(base.comp), anchor);
      const b = valorAncora100(record(food.comp), anchor);
      if (sub.modo !== 'fixa' && (!a || !b)) {
        return { descricao: nomeAlimentoParaEntrega(food), quantidadeGramas: null,
          medidaCaseira: medida.descricao, quantidadeMedidas: null,
          substitui: nomeAlimentoParaEntrega(base), semEquivalenciaAutomatica: true,
          quantidadePendente: true };
      }
      let quantidade = number(sub.quantidade);
      if (sub.modo !== 'fixa' && a && b) {
        quantidade = Math.max(0.5, Math.round((a * item.quantidade * baseMeasure.gramas / (b * medida.gramas)) / 0.5) * 0.5);
      }
      quantidade ??= Number(medida.gramas) === 1 ? 100 : 1;
      return { ...portion({ ...sub, quantidade }, dados.catalogo), substitui: nomeAlimentoParaEntrega(base),
        semEquivalenciaAutomatica: !a || !b };
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
    return { ...meal, horario, orientacoes: meal.orientacoes ?? meal.orientacao ?? '',
      alimentos, totalRefeicao, substitutos: [...substitutos, ...array(meal.substitutosSemVinculo)] };
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
