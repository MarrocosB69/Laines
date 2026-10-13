import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { FieldGroup } from './campos';
import { FREQUENCIA_SEMANAL_OPCOES, FREQUENCIA_SEMANAL_ROTULOS, TEMPO_PRATICA_OPCOES } from './constantes';

const esporteVazio = { modalidade: '', tempoPratica: '', frequenciaSemanal: '', duracaoSessao: '' };

export default function Step3Esporte({ form, setForm, errors = {} }) {
  const esportes = form.esportes?.length ? form.esportes : [esporteVazio];
  const atualizar = (index, field, value) => setForm((current) => {
    const lista = current.esportes?.length ? [...current.esportes] : [{ ...esporteVazio }];
    lista[index] = { ...lista[index], [field]: value };
    return { ...current, esportes: lista };
  });
  const adicionar = () => setForm((current) => {
    const lista = current.esportes?.length ? current.esportes : [{ ...esporteVazio }];
    if (lista.length >= 5) return current;
    return { ...current, esportes: [...lista, { ...esporteVazio }] };
  });
  const remover = (index) => setForm((current) => ({
    ...current, esportes: current.esportes.filter((_, itemIndex) => itemIndex !== index)
  }));

  return (
    <div className="ip-step">
      <h2 className="ip-step-title">Prática esportiva</h2>
      <p className="ip-step-subtitle">
        Conte quais esportes pratica. Para cada um, informe há quanto tempo pratica,
        quantas sessões faz por semana e quantos minutos dura uma sessão típica.
      </p>
      {esportes.map((esporte, index) => (
        <div className="ip-panel ip-sport-card" key={index}>
          <div className="ip-sport-card-header">
            <p className="ip-panel-title">Esporte {index + 1}</p>
            {esportes.length > 1 && (
              <button type="button" className="ip-btn ip-btn--ghost ip-sport-remove" onClick={() => remover(index)}>
                <Trash2 size={16} aria-hidden="true" /> Remover
              </button>
            )}
          </div>
          <FieldGroup label="Qual esporte você pratica?" required error={errors[`esportes_${index}_modalidade`]}>
            <input className="ip-input" value={esporte.modalidade || ''}
              onChange={(event) => atualizar(index, 'modalidade', event.target.value)}
              placeholder="Ex.: futebol, natação, corrida" maxLength={120} />
          </FieldGroup>
          <div className="ip-grid-2">
            <FieldGroup label="Há quanto tempo pratica?" required error={errors[`esportes_${index}_tempoPratica`]}>
              <select className="ip-input" value={esporte.tempoPratica || ''}
                onChange={(event) => atualizar(index, 'tempoPratica', event.target.value)}>
                <option value="">Selecione...</option>
                {TEMPO_PRATICA_OPCOES.map((tempo) => <option key={tempo} value={tempo}>{tempo}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Minutos por sessão" required error={errors[`esportes_${index}_duracaoSessao`]}>
              <input className="ip-input" type="number" inputMode="numeric" min="1" max="480" step="1"
                value={esporte.duracaoSessao ?? ''}
                onChange={(event) => atualizar(index, 'duracaoSessao', event.target.value)}
                placeholder="Ex.: 60" />
            </FieldGroup>
          </div>
          <FieldGroup label="Frequência semanal" required error={errors[`esportes_${index}_frequenciaSemanal`]}>
            <select className="ip-input" value={esporte.frequenciaSemanal ?? ''}
              onChange={(event) => atualizar(index, 'frequenciaSemanal', event.target.value)}>
              <option value="">Selecione...</option>
              {FREQUENCIA_SEMANAL_OPCOES.map((frequencia) => (
                <option key={frequencia} value={frequencia}>
                  {FREQUENCIA_SEMANAL_ROTULOS[frequencia - 1]}
                </option>
              ))}
            </select>
          </FieldGroup>
        </div>
      ))}
      {esportes.length < 5 && (
        <button type="button" className="ip-btn ip-btn--ghost ip-sport-add" onClick={adicionar}>
          <Plus size={18} aria-hidden="true" /> Adicionar outro esporte
        </button>
      )}
      <p className="ip-help-text ip-sport-limit">Você pode informar até cinco esportes.</p>
    </div>
  );
}
