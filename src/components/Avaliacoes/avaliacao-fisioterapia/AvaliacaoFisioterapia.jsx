import React from 'react';
import { Activity } from 'lucide-react';
import AvaliacaoTextual from '../components/AvaliacaoTextual';
import './AvaliacaoFisioterapia.css';

const FISIOTERAPIA_CONFIG = {
  tipo: 'fisioterapia',
  formulaId: 'fisioterapia_funcional_basica',
  icon: <Activity size={22} />,
  title: 'Avaliacao de fisioterapia',
  subtitle: 'Registro funcional, dor e mobilidade',
  cssClass: 'avaliacao-fisioterapia',
  fields: [
    { key: 'queixaPrincipal', label: 'Queixa principal', type: 'text', placeholder: 'Descreva a queixa principal' },
    { key: 'dorLocal', label: 'Local da dor', type: 'text', placeholder: 'Ex: Joelho direito' },
    { key: 'intensidadeDor', label: 'Intensidade da dor (0-10)', type: 'number', min: '0', max: '10' },
    { key: 'mobilidade', label: 'Mobilidade', type: 'text', placeholder: 'Ex: Limitacao em flexao' },
    { key: 'observacoes', label: 'Observacoes', textarea: true, rows: 4, placeholder: 'Notas clinicas' }
  ]
};

const AvaliacaoFisioterapia = (props) => <AvaliacaoTextual {...props} config={FISIOTERAPIA_CONFIG} />;

export default AvaliacaoFisioterapia;
