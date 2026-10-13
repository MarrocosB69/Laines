import React from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { FieldGroup } from './campos';
import {
  TERMO_CONSENTIMENTO_URL,
  TERMO_ADULTO,
  TERMO_MENOR
} from './constantes';

export default function Step1Termo({ form, setForm }) {
  return (
    <div className="ip-step">
      <h2 className="ip-step-title">Termo de Compromisso</h2>
      <p className="ip-step-subtitle">
        Leia o termo abaixo com atenção e indique sua situação para continuar.
        {' '}
        <a
          className="ip-termo-link"
          href={TERMO_CONSENTIMENTO_URL}
          target="_blank"
          rel="noreferrer"
        >
          Abrir termo externo
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </p>

      <FieldGroup label="Você é:">
        <div className="ip-radio-group">
          <label className={`ip-radio-item${form.tipoParticipante === 'adulto' ? ' selected' : ''}`}>
            <input
              type="radio"
              name="tipoParticipante"
              value="adulto"
              checked={form.tipoParticipante === 'adulto'}
              onChange={() => setForm((f) => ({ ...f, tipoParticipante: 'adulto', consentimentoAceito: false }))}
            />
            Maior de 18 anos
          </label>
          <label className={`ip-radio-item${form.tipoParticipante === 'menor' ? ' selected' : ''}`}>
            <input
              type="radio"
              name="tipoParticipante"
              value="menor"
              checked={form.tipoParticipante === 'menor'}
              onChange={() => setForm((f) => ({ ...f, tipoParticipante: 'menor', consentimentoAceito: false }))}
            />
            Menor de 18 anos (responsável preenche)
          </label>
        </div>
      </FieldGroup>

      <div className="ip-termo-wrap">
        <div className="ip-termo-box">
          <pre className="ip-termo-text">
            {form.tipoParticipante === 'adulto' ? TERMO_ADULTO : TERMO_MENOR}
          </pre>
        </div>
      </div>
      <p className="ip-termo-hint">
        <ChevronDown size={13} aria-hidden="true" />
        Role para ler o termo completo
      </p>

      <label className={`ip-consent-label${form.consentimentoAceito ? ' accepted' : ''}`}>
        <input
          type="checkbox"
          checked={form.consentimentoAceito}
          onChange={(e) => setForm((f) => ({ ...f, consentimentoAceito: e.target.checked }))}
        />
        <span>
          Li e aceito o Termo de Compromisso e Consentimento Livre e Esclarecido
        </span>
      </label>
    </div>
  );
}
