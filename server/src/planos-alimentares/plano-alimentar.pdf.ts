import { LainesPdfReport, PdfBlock, PdfChoice } from '../common/pdf/laines-pdf.types';
import { PlanoAlimentar, PlanoAlimentarStatus } from './plano-alimentar.entity';
import { prescriptionTotals } from './prescricao-contract';

type Data = Record<string, unknown>;
const record = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const list = (value: unknown): Data[] => Array.isArray(value) ? value.map(record) : [];
const label = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const number = (value: unknown): number | null => value === null || value === undefined || value === ''
  ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const decimal = (value: unknown): string => {
  const parsed = number(value);
  return parsed === null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(parsed);
};
const date = (value: unknown): string => {
  const token = label(value);
  if (!token) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(token);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : token;
};
const quantity = (food: Data): string => {
  if (food.quantidadePendente === true) return 'Quantidade não confirmada';
  const grams = number(food.quantidadeGramas);
  const measure = label(food.medidaCaseira);
  const amount = number(food.quantidadeMedidas);
  return [grams === null ? 'Quantidade não confirmada' : `${decimal(grams)} g`,
    measure ? `${amount === null ? '' : `${decimal(amount)} × `}${measure}` : ''].filter(Boolean).join(' · ');
};
const choice = (food: Data, fallback: string): PdfChoice => ({
  name: label(food.descricao) || fallback,
  quantity: quantity(food),
  ...(food.semEquivalenciaAutomatica === true && food.quantidadePendente !== true
    ? { note: 'Quantidade definida pela equipe' } : {})
});

function compositionRows(meals: Data[], totals: Data) {
  const foods = meals.flatMap((meal) => list(meal.alimentos));
  const nutrients = [
    ['Energia', 'calorias', 'kcal'], ['Carboidratos', 'cho', 'g'],
    ['Proteínas', 'ptn', 'g'], ['Lipídios', 'lip', 'g'], ['Fibras', 'fibra', 'g']
  ];
  let partial = false;
  const rows = nutrients.map(([name, key, unit]) => {
    const known = foods.filter((food) => number(food[key]) !== null).length;
    if (known < foods.length) partial = true;
    const value = !known ? '—' : `${decimal(totals[key])} ${unit}`;
    return [name, `${value}${known && known < foods.length ? '*' : ''}`];
  });
  return { rows, partial };
}

function choicesForMeal(meal: Data) {
  const originals = list(meal.itens);
  const printed = list(meal.alimentos);
  const alternatives = list(meal.substitutos);
  const expectedLinked = originals.reduce((sum, item) => sum + list(item.substitutos).length, 0);
  const unlinkedCount = list(meal.substitutosSemVinculo).length;
  const linkTrusted = originals.length === printed.length
    && alternatives.length === expectedLinked + unlinkedCount;
  let offset = 0;
  const entries = printed.map((food, index) => {
    const count = linkTrusted ? list(originals[index].substitutos).length : 0;
    const linked = alternatives.slice(offset, offset + count);
    offset += count;
    return { primary: choice(food, 'Alimento sem descrição'),
      alternatives: linked.map((item) => choice(item, 'Alternativa sem descrição')) };
  });
  const unlinked = alternatives.slice(offset)
    .map((item) => choice(item, 'Alternativa sem descrição'));
  return { entries, unlinked };
}

export function planoAlimentarPdfReport(
  plano: PlanoAlimentar,
  paciente: { nome?: string | null; prontuario?: string | null } | null,
  dados: Data,
  reviewed: boolean
): LainesPdfReport {
  const meals = list(dados.refeicoes);
  const review = reviewed ? record(dados.revisaoFinal) : {};
  const blocks: PdfBlock[] = [];
  const period = [date(plano.dataInicio), plano.dataFim ? date(plano.dataFim) : 'sem data final'].join(' a ');
  const patient = [{ label: 'Paciente', value: label(paciente?.nome) || 'Não informado' }];
  if (label(paciente?.prontuario)) patient.push({ label: 'Prontuário', value: label(paciente?.prontuario) });
  patient.push({ label: 'Período do plano', value: period });
  const planType = label(plano.tipoDieta);
  if (planType) patient.push({ label: 'Tipo de plano', value: planType === 'fixa' ? 'Fixo' : planType });
  if (reviewed && label(review.confirmadoPorNome)) {
    patient.push({ label: 'Profissional', value: label(review.confirmadoPorNome) });
  }
  const mealBlocks: PdfBlock[] = meals.map((meal, index) => {
    const name = label(meal.nome) || `Refeição ${index + 1}`;
    const time = label(meal.horario);
    const { entries, unlinked } = choicesForMeal(meal);
    return {
      kind: 'choiceList', title: name, time: time || undefined,
      entries, unlinked,
      note: label(meal.orientacoes) || undefined
    };
  });
  blocks.push({ kind: 'section', title: 'Refeições prescritas', blocks: mealBlocks.length
    ? mealBlocks : [{ kind: 'paragraph', text: 'Nenhuma refeição registrada neste plano.', subtle: true }],
    minHeight: 175 });

  const summary: PdfBlock[] = [];
  if (meals.some((meal) => list(meal.alimentos).length)) {
    const totals = prescriptionTotals(dados);
    const composition = compositionRows(meals, totals);
    const content: PdfBlock[] = [{
      kind: 'table',
      variant: 'plain',
      columns: [
        { label: 'Componente', width: 0.62 },
        { label: 'Total prescrito', width: 0.38, align: 'right' }
      ], rows: composition.rows, continuationTitle: 'Composição nutricional (continuação)'
    }];
    if (composition.partial) content.push({ kind: 'callout', title: 'Composição parcial',
      text: '* Subtotal conhecido dos alimentos com composição disponível. Sem composição: travessão indica ausência de dados.', tone: 'info' });
    summary.push({ kind: 'subsection', title: 'Composição nutricional', blocks: content });
  }

  const supplements = list(dados.suplementos);
  if (supplements.length) summary.unshift({ kind: 'subsection', title: 'Suplementos registrados', blocks: [{
    kind: 'table',
    variant: 'plain',
    columns: [
      { label: 'Suplemento', width: 0.35 }, { label: 'Dose', width: 0.25 },
      { label: 'Horário', width: 0.15 }, { label: 'Marca', width: 0.25 }
    ],
    rows: supplements.map((item) => [
      label(item.nome) || '—', label(item.dose) || '—',
      label(item.horario) || '—', label(item.marca) || '—'
    ]),
    continuationTitle: 'Suplementos registrados (continuação)'
  }] });
  if (label(dados.orientacoesGerais)) summary.unshift({ kind: 'subsection', title: 'Orientações gerais',
    blocks: [{ kind: 'paragraph', text: label(dados.orientacoesGerais) }] });
  if (summary.length) blocks.push({ kind: 'section', title: 'Resumo do plano',
    minHeight: 170,
    blocks: summary });

  if (reviewed && label(review.confirmadoPorNome)) {
    const crn = label(review.crn);
    const registration = crn ? /^CRN\b/i.test(crn) ? crn : `CRN ${crn}` : undefined;
    const content: PdfBlock[] = [{ kind: 'fields', variant: 'plain', items: [
      { label: 'Registro', value: registration || 'Não informado' },
      { label: 'Revisão confirmada em', value: date(review.confirmadoEm) }
    ] }];
    content.push({ kind: 'signature', name: label(review.confirmadoPorNome),
      area: 'Nutrição', registration, institution: 'LAINES' });
    blocks.push({ kind: 'section', title: 'Responsável pela revisão', blocks: content });
  }

  return {
    title: 'Plano alimentar', shortTitle: 'Prescrição nutricional',
    patient, patientVariant: 'compact',
    status: plano.status === PlanoAlimentarStatus.ATIVO && reviewed
      ? undefined : plano.status === PlanoAlimentarStatus.RASCUNHO
        ? 'Rascunho para conferência · Ainda não publicado ao paciente.'
        : plano.status === PlanoAlimentarStatus.EM_REVISAO
          ? 'Em revisão · Ainda não disponível ao paciente.'
          : plano.status === PlanoAlimentarStatus.ATIVO
            ? 'Documento em conferência · Ainda não disponível ao paciente.'
            : 'Plano não vigente · Documento para consulta histórica.',
    blocks
  };
}
