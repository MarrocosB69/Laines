import React from 'react';
import {
  ChipGroup
} from '../../../components/Triagem/EscalasVisuais';
import { FieldGroup } from './campos';
import {
  FAMILIA_EXCLUSIVAS,
  FAMILIA_OPCOES,
  SINAIS_NENHUM,
  SINAIS_OPCOES,
  COMORBIDADES_OPCOES,
  EXAMES_OPCOES
} from './constantes';

function RespostaLesao({ label, name, value, onChange }) {
  const opcoes = [
    { value: true, label: 'Sim' },
    { value: false, label: 'Não' },
    { value: null, label: 'Prefiro não responder' }
  ];
  return (
    <FieldGroup label={label}>
      <div className="ip-radio-group ip-radio-group--inline">
        {opcoes.map((opcao) => (
          <label className={`ip-radio-item${value === opcao.value ? ' selected' : ''}`} key={String(opcao.value)}>
            <input type="radio" name={name} checked={value === opcao.value}
              onChange={() => onChange(opcao.value)} />
            <span>{opcao.label}</span>
          </label>
        ))}
      </div>
    </FieldGroup>
  );
}

export default function Step4Saude({ form, setForm }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setLesao = (field, value) => setForm((current) => {
    const next = { ...current, [field]: value };
    if (next.lesaoAtual !== true && next.lesaoUltimos3Meses !== true) next.impactoLesao = '';
    return next;
  });

  return (
    <div className="ip-step">
      <h2 className="ip-step-title">Saúde e Rotina</h2>
      <p className="ip-step-subtitle">
        Nada aqui é obrigatório. Responda o que souber — a equipe completa o restante na consulta.
      </p>

      <div className="ip-panel">
        <p className="ip-panel-title">Lesões e prática esportiva</p>
        <p className="ip-help-text">Suas respostas ajudam a equipe a organizar o contato. Elas não substituem uma avaliação de saúde.</p>
        <RespostaLesao label="Você tem lesão ou dor atual?" name="lesaoAtual"
          value={form.lesaoAtual} onChange={(value) => setLesao('lesaoAtual', value)} />
        <RespostaLesao label="Você teve alguma lesão nos últimos 3 meses?" name="lesaoUltimos3Meses"
          value={form.lesaoUltimos3Meses} onChange={(value) => setLesao('lesaoUltimos3Meses', value)} />
        {(form.lesaoAtual === true || form.lesaoUltimos3Meses === true) && (
          <FieldGroup label="Hoje, como isso afeta sua prática?">
            <div className="ip-radio-group">
              {[
                { value: 'normal', label: 'Pratico normalmente' },
                { value: 'adaptada', label: 'Precisei adaptar o treino' },
                { value: 'interrompida', label: 'Interrompi a prática' },
                { value: '', label: 'Prefiro não responder' }
              ].map((opcao) => (
                <label className={`ip-radio-item${form.impactoLesao === opcao.value ? ' selected' : ''}`} key={opcao.value}>
                  <input type="radio" name="impactoLesao" checked={form.impactoLesao === opcao.value}
                    onChange={() => setForm((current) => ({ ...current, impactoLesao: opcao.value }))} />
                  <span>{opcao.label}</span>
                </label>
              ))}
            </div>
          </FieldGroup>
        )}
      </div>
      <p className="ip-urgent-guidance" role="note">
        Esta inscrição não atende urgências. Em caso de dor no peito, desmaio, falta de ar intensa
        ou outro sintoma grave, procure atendimento imediatamente. Em emergência, ligue 192 (SAMU).
      </p>

      <FieldGroup label="Condições de saúde que você tem ou já teve">
        <ChipGroup
          multiple
          options={COMORBIDADES_OPCOES}
          value={form.comorbidadesPessoais}
          exclusiveValues={['Nenhuma']}
          onChange={(val) => setForm((f) => ({ ...f, comorbidadesPessoais: val }))}
          ariaLabel="Condições de saúde pessoais"
        />
        {form.comorbidadesPessoais.includes('Outra') && (
          <input
            className="ip-input ip-input--mt"
            value={form.outraComorbidadePessoal}
            onChange={set('outraComorbidadePessoal')}
            placeholder="Especifique a condição"
            aria-label="Especifique a condição"
            maxLength={200}
          />
        )}
      </FieldGroup>

      <div className="ip-panel">
        <p className="ip-panel-title">Histórico do pai e da mãe</p>
        <p className="ip-help-text">
          Marque o que souber. Se não tiver certeza, escolha &ldquo;Não sei&rdquo; — é diferente de não ter.
        </p>
        <FieldGroup label="Pai">
          <ChipGroup
            multiple
            options={FAMILIA_OPCOES}
            value={form.familiaPai}
            exclusiveValues={FAMILIA_EXCLUSIVAS}
            onChange={(val) => setForm((f) => ({ ...f, familiaPai: val }))}
            ariaLabel="Condições do pai"
          />
        </FieldGroup>
        <FieldGroup label="Mãe">
          <ChipGroup
            multiple
            options={FAMILIA_OPCOES}
            value={form.familiaMae}
            exclusiveValues={FAMILIA_EXCLUSIVAS}
            onChange={(val) => setForm((f) => ({ ...f, familiaMae: val }))}
            ariaLabel="Condições da mãe"
          />
        </FieldGroup>
      </div>

      <FieldGroup label="Você tem sentido alguma dessas coisas nas últimas semanas?">
        <ChipGroup
          multiple
          options={SINAIS_OPCOES}
          value={form.sinaisClinicos}
          exclusiveValues={[SINAIS_NENHUM]}
          onChange={(val) => setForm((f) => ({ ...f, sinaisClinicos: val }))}
          ariaLabel="Sinais e sintomas"
        />
      </FieldGroup>

      <FieldGroup label="Exames realizados no último ano">
        <ChipGroup
          multiple
          options={EXAMES_OPCOES}
          value={form.examesRealizados}
          exclusiveValues={['Nenhum no último ano']}
          onChange={(val) => setForm((f) => ({ ...f, examesRealizados: val }))}
          ariaLabel="Exames realizados"
        />
      </FieldGroup>

    </div>
  );
}
