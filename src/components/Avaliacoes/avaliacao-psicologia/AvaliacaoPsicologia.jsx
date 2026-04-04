import React from 'react';
import { Brain } from 'lucide-react';
import AvaliacaoTextual from '../components/AvaliacaoTextual';
import './AvaliacaoPsicologia.css';

const PSICOLOGIA_CONFIG = {
  tipo: 'psicologia',
  formulaId: 'psicologia_triagem_emocional',
  icon: <Brain size={22} />,
  title: 'Avaliacao de psicologia',
  subtitle: 'Registro emocional e comportamental',
  cssClass: 'avaliacao-psicologia',
  fields: [
    { key: 'objetivo', label: 'Objetivo do atendimento', type: 'text', placeholder: 'Ex: Controle de ansiedade' },
    { key: 'humorAtual', label: 'Humor atual', type: 'text', placeholder: 'Ex: Motivado' },
    { key: 'estresse', label: 'Nivel de estresse (0-10)', type: 'number', min: '0', max: '10' },
    { key: 'sono', label: 'Qualidade do sono', type: 'text', placeholder: 'Ex: Regular' },
    { key: 'observacoes', label: 'Observacoes', textarea: true, rows: 4, placeholder: 'Notas clinicas' }
  ]
};

const AvaliacaoPsicologia = (props) => <AvaliacaoTextual {...props} config={PSICOLOGIA_CONFIG} />;

export default AvaliacaoPsicologia;
