export const ATHLETE_SELF_EVALUATION_CONFIGS = [
  {
    type: 'alimentar',
    title: 'Registro alimentar',
    subtitle: 'Informe o consumo alimentar para a equipe revisar.',
    iconKey: 'alimentar'
  },
  {
    type: 'hidratacao',
    title: 'Hidratacao de treino',
    subtitle: 'Registre peso, liquidos e sinais de hidratacao da sessao.',
    iconKey: 'hidratacao'
  },
  {
    type: 'carga_treino',
    title: 'Carga de treino',
    subtitle: 'Informe duracao e intensidade percebida da semana.',
    iconKey: 'carga_treino'
  },
  {
    type: 'fisioterapia',
    title: 'Relato de dor/lesao',
    subtitle: 'Registre sintomas funcionais para triagem da equipe.',
    iconKey: 'fisioterapia'
  }
];

export const getAthleteSelfEvaluationConfig = (type) => (
  ATHLETE_SELF_EVALUATION_CONFIGS.find((item) => item.type === type) || null
);

/** Accepts formulariosLiberados map directly (not the parent confirmacaoAtleta). */
export const getAthleteSelfEvaluationRelease = (formulariosLiberados, type) => {
  if (!formulariosLiberados || typeof formulariosLiberados !== 'object' || Array.isArray(formulariosLiberados)) return {};
  const release = formulariosLiberados[type];
  return release && typeof release === 'object' && !Array.isArray(release) ? release : {};
};

export const isAthleteSelfEvaluationReleased = (formulariosLiberados, type) => (
  Boolean(getAthleteSelfEvaluationRelease(formulariosLiberados, type)?.enabled)
);

export const listReleasedAthleteSelfEvaluationConfigs = (formulariosLiberados) => (
  ATHLETE_SELF_EVALUATION_CONFIGS.filter((config) => (
    isAthleteSelfEvaluationReleased(formulariosLiberados, config.type)
  ))
);
