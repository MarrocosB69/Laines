import React, { useMemo } from 'react';
import {
  ChipGroup,
  YesNoQuestionnaire
} from '../../../components/Triagem/EscalasVisuais';
import {
  getQuestionnaireForSex
} from '../../../constants/clinicalInstruments';
import { FieldGroup } from './campos';
import {
  AVALIACOES_OPCOES,
  COMO_SOUBE_OPCOES,
  EBIA_PERGUNTAS
} from './constantes';

export default function Step6Finalizacao({ form, setForm }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  // Perguntas de energia e treino conforme o sexo informado; sem esse dado,
  // o bloco não aparece. As respostas não são um diagnóstico de RED-S.
  const questionario = useMemo(() => getQuestionnaireForSex(form.sexoBiologico), [form.sexoBiologico]);
  const setEbia = (idx, val) => setForm((f) => {
    const ebia = [...f.ebia];
    ebia[idx] = val;
    return { ...f, ebia };
  });

  return (
    <div className="ip-step">
      <h2 className="ip-step-title">Avaliações e Finalização</h2>
      <p className="ip-step-subtitle">Últimas informações para concluir sua inscrição.</p>

      <FieldGroup label="Quais avaliações você gostaria de realizar?">
        <ChipGroup
          multiple
          options={AVALIACOES_OPCOES}
          value={form.avaliacaoSolicitada}
          onChange={(val) => setForm((f) => ({ ...f, avaliacaoSolicitada: val }))}
          ariaLabel="Avaliações de interesse"
        />
      </FieldGroup>

      {questionario ? (
        <div className="ip-panel">
          <p className="ip-panel-title">Energia e treino · rastreio RED-S</p>
          <p className="ip-help-text">
            Responda Sim ou Não em cada linha, pensando nos últimos meses. As respostas
            ajudam a equipe a organizar o contato; não fazem diagnóstico de RED-S.
          </p>
          <YesNoQuestionnaire
            questions={questionario.questions}
            answers={form.redsRespostas}
            onChange={(key, value) => setForm((f) => ({
              ...f,
              redsRespostas: { ...f.redsRespostas, [key]: value }
            }))}
            ariaLabel="Perguntas de energia e treino relacionadas ao RED-S"
          />
        </div>
      ) : (
        <div className="ip-panel">
          <p className="ip-panel-title">Energia e treino · rastreio RED-S</p>
          <p className="ip-help-text">
            Este bloco é aplicado conforme o sexo biológico. Informe o campo na etapa de dados
            pessoais para respondê-lo, ou siga sem ele — a inscrição é enviada normalmente.
          </p>
        </div>
      )}

      <div className="ip-panel">
        <p className="ip-panel-title">Segurança alimentar</p>
        <p className="ip-help-text">
          Responda com Sim ou Não às perguntas sobre os últimos 3 meses:
        </p>
        {/* Mesmo par segmentado Sim/Não do questionário de energia acima
            (ip-qlist/ip-qrow/ip-qbtn, EscalasVisuais.css, mesmo padrão de
            YesNoQuestionnaire): troca os radios nativos de 13x13px (alvo
            abaixo do mínimo) por botões com pelo menos 44px, cada um
            rotulado por aria-label próprio. setEbia continua a única
            função chamada — o valor gravado em form.ebia não muda. */}
        <div className="ip-qlist" role="group" aria-label="Segurança alimentar">
          {EBIA_PERGUNTAS.map((pergunta, idx) => (
            <div key={idx} className="ip-qrow">
              <span className="ip-qrow-q">{`${idx + 1}. ${pergunta}`}</span>
              <span className="ip-qrow-a">
                {['Não', 'Sim'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className="ip-qbtn"
                    aria-pressed={form.ebia[idx] === opt}
                    aria-label={`${opt} — ${pergunta}`}
                    onClick={() => setEbia(idx, opt)}
                  >
                    {opt}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>

      <FieldGroup label="Como você conheceu a LAINES?">
        <select className="ip-input" value={form.comoSoube} onChange={set('comoSoube')}>
          <option value="">Selecione...</option>
          {COMO_SOUBE_OPCOES.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </FieldGroup>

      <FieldGroup label="Observações ou dúvidas (opcional)">
        <textarea
          className="ip-input ip-textarea"
          value={form.observacoes}
          onChange={set('observacoes')}
          placeholder="Informe algo que ache relevante para a equipe saber..."
          rows={4}
          maxLength={1000}
        />
      </FieldGroup>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
