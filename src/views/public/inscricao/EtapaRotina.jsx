import React from 'react';
import {
  BristolScale,
  ChipGroup,
  UrineScale,
  URINE_DARK_THRESHOLD
} from '../../../components/Triagem/EscalasVisuais';
import { FieldGroup } from './campos';
import {
  SUPLEMENTO_OPCOES,
  HIDRATACAO_OPCOES
} from './constantes';

export default function Step5Rotina({ form, setForm }) {
  const urinaEscura = Number(form.urinaPrimeira) >= URINE_DARK_THRESHOLD
    || Number(form.urinaUltima) >= URINE_DARK_THRESHOLD;

  return (
    <div className="ip-step">
      <h2 className="ip-step-title">Hidratação e Rotina</h2>
      <p className="ip-step-subtitle">
        Três perguntas com figuras. Escolha a opção mais parecida com o seu dia a dia.
      </p>

      <FieldGroup label="Quanto de líquido você costuma beber por dia?">
        <p className="ip-help-text">Pense em copos de 250 ml ou garrafas de 500 ml.</p>
        <ChipGroup
          options={HIDRATACAO_OPCOES}
          value={form.hidratacao}
          onChange={(val) => setForm((f) => ({ ...f, hidratacao: val || '' }))}
          ariaLabel="Ingestão diária de líquidos"
        />
      </FieldGroup>

      <FieldGroup label="Qual a cor da sua urina?">
        <p className="ip-help-text">
          Compare com as faixas abaixo e escolha a mais parecida em cada momento.
        </p>
        <div className="ip-urine-pair">
          <div>
            <span className="ip-label">Primeira do dia</span>
            <p className="ip-urine-when">Logo ao acordar, antes de beber água</p>
            <UrineScale
              value={form.urinaPrimeira}
              onChange={(val) => setForm((f) => ({ ...f, urinaPrimeira: val }))}
              ariaLabel="Cor da primeira urina do dia"
            />
          </div>
          <div>
            <span className="ip-label">Última do dia</span>
            <p className="ip-urine-when">No fim da tarde ou à noite</p>
            <UrineScale
              value={form.urinaUltima}
              onChange={(val) => setForm((f) => ({ ...f, urinaUltima: val }))}
              ariaLabel="Cor da última urina do dia"
            />
          </div>
        </div>
        {urinaEscura && (
          <div className="ip-input--mt">
            <span className="ip-label">Você tomou algum suplemento, vitamina ou remédio hoje?</span>
            <p className="ip-help-text">
              Complexo B, riboflavina e alguns medicamentos mudam a cor da urina.
            </p>
            <ChipGroup
              options={SUPLEMENTO_OPCOES}
              value={form.suplementoNoDia}
              onChange={(val) => setForm((f) => ({ ...f, suplementoNoDia: val || '' }))}
              ariaLabel="Uso de suplemento ou medicamento hoje"
            />
          </div>
        )}
      </FieldGroup>

      <FieldGroup label="Como costuma ser a consistência das suas fezes?">
        <p className="ip-help-text">
          Escolha a figura mais parecida com o que acontece na maioria das vezes.
        </p>
        <BristolScale
          value={form.bristol}
          onChange={(val) => setForm((f) => ({ ...f, bristol: val }))}
        />
      </FieldGroup>
    </div>
  );
}
