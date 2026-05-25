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

export const getAthleteSelfEvaluationRelease = (confirmacaoAtleta, type) => {
  const releases = confirmacaoAtleta?.formulariosLiberados;
  if (!releases || typeof releases !== 'object' || Array.isArray(releases)) return {};
  const release = releases[type];
  return release && typeof release === 'object' && !Array.isArray(release) ? release : {};
};

export const isAthleteSelfEvaluationReleased = (confirmacaoAtleta, type) => (
  Boolean(getAthleteSelfEvaluationRelease(confirmacaoAtleta, type)?.enabled)
);

export const listReleasedAthleteSelfEvaluationConfigs = (confirmacaoAtleta) => (
  ATHLETE_SELF_EVALUATION_CONFIGS.filter((config) => (
    isAthleteSelfEvaluationReleased(confirmacaoAtleta, config.type)
  ))
);
