// Constantes, textos e rascunho do formulario publico de inscricao e triagem.
// Recortado de InscricaoPublica.jsx sem mudanca de valor (passo 0 de
// docs/implementacao/inscricao-v2/change-intent.md).
import { CLINICAL_SIGN_OPTIONS } from '../../../constants/clinicalInstruments';

export const TERMO_CONSENTIMENTO_URL = 'https://forms.gle/FJph7SvhsMresfHT9';
export const TRIAGEM_MEET_URL = 'https://meet.google.com/trn-vygt-nap';

// ── Constants ────────────────────────────────────────────────────────────────

export const GENEROS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'feminino', label: 'Feminino' },
  { value: 'nao_binario', label: 'Não binário' },
  { value: 'outro', label: 'Outro' },
  { value: 'nao_informado', label: 'Prefiro não informar' }
];

export const ESCOLARIDADES = [
  'Ensino Fundamental Incompleto',
  'Ensino Fundamental Completo',
  'Ensino Médio Incompleto',
  'Ensino Médio Completo',
  'Ensino Superior Incompleto',
  'Ensino Superior Completo',
  'Pós-graduação'
];

export const RENDAS = [
  'Até R$ 1.412 (1 salário mínimo)',
  'Entre R$ 1.412 e R$ 2.824',
  'Entre R$ 2.824 e R$ 7.060',
  'Entre R$ 7.060 e R$ 14.120',
  'Acima de R$ 14.120',
  'Prefiro não informar'
];

// Lista completa do IBGE (27 UFs, 5.571 municipios). Carregada sob demanda para
// nao entrar no bundle inicial — ver loadMunicipios().
export let municipiosCache = null;
export const loadMunicipios = async () => {
  if (municipiosCache) return municipiosCache;
  const mod = await import('../../../constants/municipios.json');
  municipiosCache = mod.default || mod;
  return municipiosCache;
};

export const SEXO_BIOLOGICO = [
  { value: 'feminino', label: 'Feminino' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'nao_informado', label: 'Prefiro não informar' }
];

export const FAMILIA_CONDICOES = [
  'Hipertensão', 'Diabetes', 'Obesidade', 'Doença cardíaca', 'AVC',
  'Colesterol alto', 'Câncer', 'Doença renal', 'Tireoide', 'Distúrbio alimentar'
];

export const FAMILIA_EXCLUSIVAS = ['Nenhuma', 'Não sei'];
export const FAMILIA_OPCOES = [...FAMILIA_CONDICOES, ...FAMILIA_EXCLUSIVAS];

export const SINAIS_NENHUM = 'nenhum';
export const SINAIS_OPCOES = [
  ...CLINICAL_SIGN_OPTIONS.map((item) => ({ value: item.value, label: item.publicLabel })),
  { value: SINAIS_NENHUM, label: 'Nada disso' }
];

export const SUPLEMENTO_OPCOES = ['Não', 'Sim', 'Não lembro'];

// Relato em copos/garrafas convertido para litros na gravacao: quase ninguem
// sabe quantos litros bebe, mas todo mundo sabe quantas garrafas.
export const HIDRATACAO_OPCOES = [
  { value: '0.75', label: 'Menos de 4 copos' },
  { value: '1.25', label: '4 a 6 copos' },
  { value: '1.75', label: '1 garrafa e meia' },
  { value: '2', label: '2 garrafas' },
  { value: '3', label: '3 garrafas' },
  { value: '3.5', label: 'Mais de 3 garrafas' }
];

export const TIPO_TREINO = [
  { value: 'forca', label: 'Força' },
  { value: 'resistencia', label: 'Resistência/Aeróbico' },
  { value: 'misto', label: 'Misto' },
  { value: 'tecnico', label: 'Técnico/Tático' }
];

export const INTENSIDADES = [
  { value: 'leve', label: 'Leve' },
  { value: 'moderada', label: 'Moderada' },
  { value: 'alta', label: 'Alta' },
  { value: 'muito_alta', label: 'Muito alta (alto desempenho)' }
];

export const OBJETIVOS = [
  { value: 'performance', label: 'Melhora de desempenho' },
  { value: 'saude', label: 'Saúde e qualidade de vida' },
  { value: 'estetica', label: 'Estética / composição corporal' },
  { value: 'reabilitacao', label: 'Reabilitação' },
  { value: 'outro', label: 'Outro' }
];

export const COMORBIDADES_OPCOES = [
  'Hipertensão arterial','Diabetes (tipo 1 ou 2)','Obesidade','Síndrome metabólica',
  'Doença cardíaca','Doença renal','Doença hepática','Dislipidemia',
  'Distúrbio alimentar (anorexia, bulimia, etc.)','Asma / doença pulmonar',
  'Ansiedade / depressão','Outra','Nenhuma'
];

export const EXAMES_OPCOES = [
  'Hemograma completo','Glicemia em jejum','Insulina','HbA1c','Lipidograma (colesterol/triglicerídeos)',
  'TSH / T4 (tireoide)','Vitamina D','Vitamina B12','Ferritina / hemoglobina',
  'Ureia / Creatinina','TGO / TGP (fígado)','Nenhum no último ano'
];

export const AVALIACOES_OPCOES = [
  { value: 'nutricional', label: 'Avaliação nutricional' },
  { value: 'fisioterapia', label: 'Avaliação fisioterapêutica' },
  { value: 'psicologia', label: 'Acompanhamento psicológico' }
];

export const COMO_SOUBE_OPCOES = [
  'Indicação de amigo/familiar',
  'Redes sociais (Instagram, Facebook, etc.)',
  'Professor ou técnico esportivo',
  'Médico ou profissional de saúde',
  'Site / internet',
  'Universidade / faculdade',
  'Outro'
];

export const TEMPO_PRATICA_OPCOES = [
  'Menos de 6 meses',
  '6 meses a 1 ano',
  '1 a 2 anos',
  '2 a 5 anos',
  'Mais de 5 anos'
];

export const FREQUENCIA_SEMANAL_ROTULOS = [
  'Uma vez por semana', 'Duas vezes por semana', 'Três vezes por semana',
  'Quatro vezes por semana', 'Cinco vezes por semana', 'Seis vezes por semana',
  'Sete vezes por semana', 'Oito vezes por semana', 'Nove vezes por semana',
  'Dez vezes por semana', 'Onze vezes por semana', 'Doze vezes por semana',
  'Treze vezes por semana', 'Quatorze vezes por semana'
];
export const FREQUENCIA_SEMANAL_OPCOES = Array.from(
  { length: FREQUENCIA_SEMANAL_ROTULOS.length }, (_, index) => index + 1
);

export const EBIA_PERGUNTAS = [
  'Nos últimos 3 meses, os alimentos acabaram antes que você tivesse dinheiro para comprar mais?',
  'Nos últimos 3 meses, você ficou sem dinheiro para ter uma alimentação saudável e variada?',
  'Nos últimos 3 meses, você comeu apenas alguns alimentos por falta de dinheiro?'
];

// ── Termo texts ───────────────────────────────────────────────────────────────

export const TERMO_ADULTO = `TERMO DE COMPROMISSO E CONSENTIMENTO LIVRE E ESCLARECIDO

Eu, participante do programa de atendimento da Liga Acadêmica Interprofissional de Nutrição Esportiva (LAINES), vinculada à Faculdade de Ciências da Saúde do Trairi (FACISA/UFRN), declaro que:

1. Fui informado(a) sobre os objetivos, procedimentos e condições do atendimento e aceito participar voluntariamente do programa.

2. Autorizo a equipe multiprofissional (estudantes supervisionados, professores e coordenadores) a realizar avaliações, acompanhamentos e intervenções nas áreas de nutrição, fisioterapia e psicologia, conforme indicado.

3. Compreendo que meus dados pessoais, clínicos e antropométricos serão armazenados em prontuário eletrônico e utilizados exclusivamente para fins de atendimento e pesquisa acadêmica, em conformidade com a Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018).

4. Sei que posso solicitar a interrupção do atendimento a qualquer momento, sem qualquer prejuízo.

5. Tenho 18 anos de idade ou mais e tenho plena capacidade civil para este consentimento.

Ao marcar a caixa de aceite abaixo, confirmo que li, compreendi e concordo com os termos acima.`;

export const TERMO_MENOR = `TERMO DE COMPROMISSO E CONSENTIMENTO LIVRE E ESCLARECIDO
(Para participantes menores de 18 anos)

Eu, responsável legal pelo(a) participante menor de idade, declaro que:

1. Fui informado(a) sobre os objetivos, procedimentos e condições do atendimento da Liga Acadêmica Interprofissional de Nutrição Esportiva (LAINES), vinculada à FACISA/UFRN.

2. Autorizo a realização de avaliações e atendimentos nas áreas de nutrição, fisioterapia e psicologia para o(a) menor sob minha responsabilidade.

3. Compreendo que os dados do(a) menor serão armazenados em prontuário eletrônico e utilizados conforme a LGPD (Lei nº 13.709/2018).

4. Posso solicitar a interrupção do atendimento a qualquer momento.

5. Declaro ser o(a) responsável legal pelo(a) participante e ter plena capacidade civil para este consentimento.

Ao marcar a caixa de aceite abaixo, confirmo que li, compreendi e concordo com os termos acima.`;

// ── Initial form state ────────────────────────────────────────────────────────

export const initialForm = {
  // Step 1
  tipoParticipante: 'adulto',
  consentimentoAceito: false,

  // Step 2
  nome: '',
  cpf: '',
  dataNascimento: '',
  genero: '',
  sexoBiologico: '',
  telefone: '',
  email: '',
  profissao: '',
  rendaMensal: '',
  escolaridade: '',
  cidade: '',
  estado: '',
  bairro: '',
  endereco: '',
  nomeResponsavel: '',
  cpfResponsavel: '',

  // Step 3
  esportes: [],
  modalidadePrincipal: '',
  outrasModalidades: '',
  tempoPratica: '',
  frequenciaSemanal: '',
  duracaoSessao: '',
  tipoTreino: '',
  intensidade: '',
  objetivo: '',
  comorbidadesPessoais: [],
  outraComorbidadePessoal: '',
  familiaPai: [],
  familiaMae: [],
  sinaisClinicos: [],
  examesRealizados: [],
  lesaoAtual: null,
  lesaoUltimos3Meses: null,
  impactoLesao: '',
  hidratacao: '',
  bristol: '',
  urinaPrimeira: '',
  urinaUltima: '',
  suplementoNoDia: '',

  // Step 4
  avaliacaoSolicitada: [],
  ebia: ['', '', ''],
  redsRespostas: {},
  comoSoube: '',
  observacoes: ''
};

// ── Rascunho local ──────────────────────────────────────────────────────────

export const DRAFT_KEY = 'laines_triagem_rascunho_v1';
export const DRAFT_TTL_MS = 6 * 60 * 60 * 1000;

// Allowlist, nunca denylist: campo novo so e gravado se for adicionado aqui de
// propria vontade. Fica de fora tudo que e clinico (comorbidades, historico
// familiar, sinais, exames, hidratacao, Bristol, urina, REDs, EBIA), o
// socioeconomico (renda), o texto livre de observacoes e o aceite do termo —
// que precisa ser reafirmado a cada visita.
export const DRAFT_FIELDS = [
  'tipoParticipante',
  'nome', 'cpf', 'dataNascimento', 'genero', 'sexoBiologico',
  'telefone', 'email', 'profissao', 'escolaridade',
  'estado', 'cidade', 'bairro', 'endereco',
  'nomeResponsavel', 'cpfResponsavel',
  'esportes', 'modalidadePrincipal', 'outrasModalidades', 'tempoPratica', 'frequenciaSemanal', 'duracaoSessao',
  'avaliacaoSolicitada', 'comoSoube'
];

export const readDraft = () => {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.salvoEm || Date.now() - parsed.salvoEm > DRAFT_TTL_MS) {
      window.localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    const dados = {};
    DRAFT_FIELDS.forEach((field) => {
      if (parsed.dados?.[field] !== undefined) dados[field] = parsed.dados[field];
    });
    if (!Array.isArray(dados.esportes) && dados.modalidadePrincipal) {
      dados.esportes = [{
        modalidade: dados.modalidadePrincipal,
        tempoPratica: dados.tempoPratica || '',
        frequenciaSemanal: dados.frequenciaSemanal || '',
        duracaoSessao: dados.duracaoSessao || ''
      }, ...String(dados.outrasModalidades || '').split(/[,;]+/)
        .map((modalidade) => modalidade.trim()).filter(Boolean).slice(0, 4)
        .map((modalidade) => ({ modalidade, tempoPratica: '', frequenciaSemanal: '', duracaoSessao: '' }))];
    }
    if (Array.isArray(dados.esportes)) {
      dados.esportes = dados.esportes.slice(0, 5).map((esporte, index) => ({
        modalidade: String(esporte?.modalidade || '').slice(0, 120),
        tempoPratica: String(esporte?.tempoPratica || ''),
        frequenciaSemanal: String(esporte?.frequenciaSemanal || (index === 0 ? dados.frequenciaSemanal : '') || ''),
        duracaoSessao: String(esporte?.duracaoSessao || '')
      }));
    }
    return Object.keys(dados).length ? dados : null;
  } catch {
    return null;
  }
};

export const writeDraft = (form) => {
  try {
    const dados = {};
    DRAFT_FIELDS.forEach((field) => { dados[field] = form[field]; });
    const preenchido = Object.values(dados).some((value) => (
      Array.isArray(value) ? value.length > 0 : Boolean(value) && value !== 'adulto'
    ));
    if (!preenchido) {
      window.localStorage.removeItem(DRAFT_KEY);
      return;
    }
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ salvoEm: Date.now(), dados }));
  } catch {
    // Sem localStorage (aba privada, storage bloqueado) o formulario segue normal.
  }
};

export const clearDraft = () => {
  try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignorado */ }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
