// Instrumentos clinicos compartilhados entre a triagem publica e os modulos de avaliacao.
//
// Os campos `value` e `label` sao a verdade historica: eles ja existem em registros
// gravados e nos normalizers do backend, entao NAO devem ser alterados. O campo
// `publicLabel` e apenas apresentacao para quem responde a triagem publica.
//
// Consumidores:
//   - src/components/Avaliacoes/clinica/AvaliacaoClinicaForm.jsx
//   - src/views/avaliacoes/AvaliacaoTriagemREDS.jsx
//   - src/views/public/InscricaoPublica.jsx

// ── Sinais e sintomas clinico-nutricionais ───────────────────────────────────

export const CLINICAL_SIGN_OPTIONS = [
  {
    value: 'caibras_qualquer_hora',
    label: 'Caibras a qualquer hora',
    publicLabel: 'Câimbra em qualquer hora do dia',
    nutrientDeficiency: 'Calcio, magnesio, acido pantotenico e potassio',
    nutrientExcess: 'Chumbo e sodio',
    source: 'Relacao de sintomas clinicos em atletas'
  },
  {
    value: 'formigamento',
    label: 'Formigamento',
    publicLabel: 'Formigamento nas mãos ou nos pés',
    nutrientDeficiency: 'Acido pantotenico, omega 3, potassio, magnesio, B1, B3, B6 e B12',
    nutrientExcess: null,
    source: 'Relacao de sintomas clinicos em atletas'
  },
  {
    value: 'contracoes_musculares_persistentes',
    label: 'Contracoes musculares persistentes',
    publicLabel: 'Músculo que fica contraído e não relaxa',
    nutrientDeficiency: 'Calcio e magnesio',
    nutrientExcess: null,
    source: 'Relacao de sintomas clinicos em atletas'
  },
  {
    value: 'tremores_musculos',
    label: 'Tremores nos musculos',
    publicLabel: 'Tremor nos músculos',
    nutrientDeficiency: 'Magnesio e niacina',
    nutrientExcess: 'Sodio',
    source: 'Relacao de sintomas clinicos em atletas'
  },
  {
    value: 'movimentos_involuntarios',
    label: 'Movimentos involuntarios',
    publicLabel: 'Movimentos que acontecem sozinhos',
    nutrientDeficiency: 'Magnesio e B6',
    nutrientExcess: null,
    source: 'Relacao de sintomas clinicos em atletas'
  },
  {
    value: 'caibras_noturnas',
    label: 'Caibras noturnas',
    publicLabel: 'Câimbra à noite, dormindo',
    nutrientDeficiency: 'B1 e B6',
    nutrientExcess: null,
    source: 'Relacao de sintomas clinicos em atletas'
  },
  {
    value: 'sensacao_choque_eletrico',
    label: 'Sensacao de choque eletrico',
    publicLabel: 'Sensação de choque elétrico',
    nutrientDeficiency: 'B6',
    nutrientExcess: null,
    source: 'Relacao de sintomas clinicos em atletas'
  },
  {
    value: 'cansaco_fadiga',
    label: 'Cansaco e fadiga',
    publicLabel: 'Cansaço que não passa',
    nutrientDeficiency: 'Zinco, ferro, selenio, potassio, acido pantotenico, vitamina C, B1, B3, B6 e B12',
    nutrientExcess: null,
    source: 'Relacao de sintomas clinicos em atletas'
  },
  {
    value: 'mialgia',
    label: 'Mialgia',
    publicLabel: 'Dor muscular sem ter treinado forte',
    nutrientDeficiency: 'Magnesio, selenio, potassio, vitamina C, B1, B3 e B6',
    nutrientExcess: null,
    source: 'Relacao de sintomas clinicos em atletas'
  },
  {
    value: 'fraqueza_muscular',
    label: 'Fraqueza muscular',
    publicLabel: 'Força menor que o normal',
    nutrientDeficiency: 'Magnesio, potassio, acido pantotenico, vitamina C, B1, B3, B6 e B12',
    nutrientExcess: null,
    source: 'Relacao de sintomas clinicos em atletas'
  },
  {
    value: 'palidez',
    label: 'Palidez',
    publicLabel: 'Pele mais pálida que o normal',
    nutrientDeficiency: null,
    nutrientExcess: null
  },
  {
    value: 'queda_cabelo',
    label: 'Queda de cabelo',
    publicLabel: 'Queda de cabelo acima do normal',
    nutrientDeficiency: null,
    nutrientExcess: null
  },
  {
    value: 'unhas_frageis',
    label: 'Unhas frageis',
    publicLabel: 'Unha quebrando fácil',
    nutrientDeficiency: null,
    nutrientExcess: null
  },
  {
    value: 'glossite',
    label: 'Glossite',
    publicLabel: 'Língua vermelha, lisa ou dolorida',
    nutrientDeficiency: null,
    nutrientExcess: null
  },
  {
    value: 'queilite_angular',
    label: 'Queilite angular',
    publicLabel: 'Rachadura no canto da boca',
    nutrientDeficiency: null,
    nutrientExcess: null
  },
  {
    value: 'xeroftalmia',
    label: 'Xeroftalmia',
    publicLabel: 'Olho seco ou dificuldade de enxergar à noite',
    nutrientDeficiency: null,
    nutrientExcess: null
  }
];

export const CLINICAL_SIGN_BY_VALUE = CLINICAL_SIGN_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item;
  return acc;
}, {});

// ── Questionarios de disponibilidade energetica (triagem REDs) ───────────────

export const LEAF_Q_QUESTIONS = [
  { key: 'leaf_q1', label: 'Ciclos menstruais irregulares nos últimos 12 meses?' },
  { key: 'leaf_q2', label: 'Ausência menstrual por 3 meses ou mais?' },
  { key: 'leaf_q3', label: 'Sangramento menstrual muito reduzido?' },
  { key: 'leaf_q4', label: 'Dor abdominal recorrente associada ao treino?' },
  { key: 'leaf_q5', label: 'Desconforto gastrointestinal em treinos intensos?' },
  { key: 'leaf_q6', label: 'Constipação frequente nas últimas semanas?' },
  { key: 'leaf_q7', label: 'Sensação de fadiga persistente no dia a dia?' },
  { key: 'leaf_q8', label: 'Queda de rendimento sem causa aparente?' },
  { key: 'leaf_q9', label: 'Histórico de fratura por estresse?' },
  { key: 'leaf_q10', label: 'Dor óssea recorrente durante o treino?' },
  { key: 'leaf_q11', label: 'Uso de restrição calórica frequente?' },
  { key: 'leaf_q12', label: 'Dificuldade para recuperar após sessões intensas?' }
];

export const LEA_Q13_QUESTIONS = [
  { key: 'lea_q1', label: 'Fadiga persistente sem explicação clínica?' },
  { key: 'lea_q2', label: 'Queda de performance nas últimas 4 semanas?' },
  { key: 'lea_q3', label: 'Perda de massa corporal involuntária recente?' },
  { key: 'lea_q4', label: 'Perda de libido ou queda de interesse sexual?' },
  { key: 'lea_q5', label: 'Alterações de humor associadas ao treinamento?' },
  { key: 'lea_q6', label: 'Dificuldade de recuperação entre sessões?' },
  { key: 'lea_q7', label: 'Infecções recorrentes no último trimestre?' },
  { key: 'lea_q8', label: 'Dor óssea recorrente ao esforço?' },
  { key: 'lea_q9', label: 'Histórico de fratura por estresse?' },
  { key: 'lea_q10', label: 'Sinais de baixa disponibilidade energética?' },
  { key: 'lea_q11', label: 'Restrição alimentar para controle de peso?' },
  { key: 'lea_q12', label: 'Sono não reparador na maior parte da semana?' },
  { key: 'lea_q13', label: 'Dificuldade para manter carga de treino planejada?' }
];

export const SINTOMAS_OPTIONS = [
  { value: 'fadiga', label: 'Fadiga' },
  { value: 'queda_performance', label: 'Queda de performance' },
  { value: 'libido_baixa', label: 'Libido baixa' },
  { value: 'irritabilidade', label: 'Irritabilidade' }
];

export const normalizeSexoBiologico = (...values) => {
  for (const value of values) {
    const token = String(value || '').trim().toLowerCase();
    if (!token) continue;
    if (token.includes('fem') || token === 'f') return 'feminino';
    if (token.includes('masc') || token === 'm') return 'masculino';
  }
  return '';
};

// Blocos locais de perguntas relacionados ao RED-S. Os IDs legados preservam
// os dados existentes, mas não significam aplicação integral de instrumentos validados.
export const getQuestionnaireForSex = (sexo) => {
  const normalized = normalizeSexoBiologico(sexo);
  if (normalized === 'feminino') {
    return { id: 'leaf_q', label: 'LEAF-Q', questions: LEAF_Q_QUESTIONS };
  }
  if (normalized === 'masculino') {
    return { id: 'lea_q13', label: 'LEA-Q13', questions: LEA_Q13_QUESTIONS };
  }
  return null;
};

// Contagem simples de respostas afirmativas; não mede disponibilidade energética,
// não diagnostica RED-S e não determina sozinha a prioridade de contato.
export const scoreQuestionnaire = (answers = {}) => (
  Object.values(answers || {}).reduce((total, value) => {
    const token = String(value ?? '').trim().toLowerCase();
    return total + (token === 'sim' || token === 'true' || value === true ? 1 : 0);
  }, 0)
);
