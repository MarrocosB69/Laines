import React, { useId, useMemo } from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';
import './SuplementoCard.css';

const WADA_OPTIONS = [
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'risco', label: 'Risco' },
  { value: 'proibido', label: 'Proibido' }
];

const SuplementoCard = ({
  value,
  onChange,
  onRemove,
  readOnly = false
}) => {
  const idPrefix = useId();
  const wadaStatus = String(value?.statusWADA || 'risco').toLowerCase();
  const wadaBadgeClass = useMemo(() => {
    if (wadaStatus === 'aprovado') return 'wada-ok';
    if (wadaStatus === 'proibido') return 'wada-proibido';
    return 'wada-verificar';
  }, [wadaStatus]);

  const patch = (changes) => {
    onChange?.({
      ...value,
      ...changes
    });
  };

  return (
    <div className="suplemento-item" data-wada={String(value?.statusWADA || 'risco').toLowerCase()}>
      <div className="suplemento-card__field suplemento-card__field--nome">
          <label htmlFor={`${idPrefix}-nome`}>Nome</label>
          <input
            id={`${idPrefix}-nome`}
            type="text"
            value={value?.nome || ''}
            onChange={(event) => patch({ nome: event.target.value })}
            disabled={readOnly}
            aria-required="true"
          />
      </div>

      <div className="suplemento-card__field suplemento-card__field--dose">
          <label htmlFor={`${idPrefix}-dose`}>Dose</label>
          <input
            id={`${idPrefix}-dose`}
            type="text"
            value={value?.dose || ''}
            onChange={(event) => patch({ dose: event.target.value })}
            placeholder="Ex.: 30 g, 5 g, 1 caps"
            disabled={readOnly}
            aria-required="true"
          />
      </div>

      <div className="suplemento-card__field suplemento-card__field--horario">
          <label htmlFor={`${idPrefix}-horario`}>Horario</label>
          <input
            id={`${idPrefix}-horario`}
            type="time"
            value={value?.horario || ''}
            onChange={(event) => patch({ horario: event.target.value })}
            disabled={readOnly}
            aria-required="true"
          />
      </div>

      <div className="suplemento-card__field suplemento-card__field--marca">
          <label htmlFor={`${idPrefix}-marca`}>Marca</label>
          <input
            id={`${idPrefix}-marca`}
            type="text"
            value={value?.marca || ''}
            onChange={(event) => patch({ marca: event.target.value })}
            disabled={readOnly}
          />
      </div>

      <div className="suplemento-card__field suplemento-card__field--lote">
          <label htmlFor={`${idPrefix}-lote`}>Lote</label>
          <input
            id={`${idPrefix}-lote`}
            type="text"
            value={value?.loteVerificado || ''}
            onChange={(event) => patch({ loteVerificado: event.target.value })}
            disabled={readOnly}
          />
      </div>

      <div className="suplemento-card__field suplemento-card__field--status">
          <label htmlFor={`${idPrefix}-wada`}>Status WADA</label>
          <select
            id={`${idPrefix}-wada`}
            value={value?.statusWADA || 'risco'}
            onChange={(event) => patch({ statusWADA: event.target.value })}
            disabled={readOnly}
            aria-required="true"
          >
            {WADA_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
      </div>

      <span className={`wada-badge ${wadaBadgeClass}`}>
        {wadaStatus === 'aprovado'
          ? 'WADA: OK'
          : wadaStatus === 'proibido'
            ? 'WADA: Proibido'
            : 'WADA: Verificar'}
      </span>

      {(wadaStatus === 'risco' || value?.justificativaClinica) && (
        <div className="suplemento-card__field suplemento-card__field--justificativa">
          <label htmlFor={`${idPrefix}-justificativa`}>Justificativa clinica</label>
          <textarea
            id={`${idPrefix}-justificativa`}
            value={value?.justificativaClinica || ''}
            onChange={(event) => patch({ justificativaClinica: event.target.value })}
            placeholder="Conduta, avaliacao de risco e motivo da prescricao."
            disabled={readOnly}
            rows={2}
          />
        </div>
      )}

      {!readOnly && (
        <button type="button" className="btn-remover-suplemento" onClick={onRemove} aria-label="Remover suplemento">
          <Trash2 size={14} /> Remover
        </button>
      )}

      <div className="wada-aviso">
        <AlertCircle size={14} />
        <span>
          {/* O GlobalDRO responde sobre substancias e medicamentos; ele nao
              certifica a seguranca antidopagem de um suplemento, e consulta sem
              resultado nao equivale a liberacao (CLI-09). */}
          {wadaStatus === 'proibido'
            ? 'Suplemento proibido bloqueia a ativacao do plano. Remova ou substitua antes da liberacao clinica.'
            : 'Suplementos exigem avaliacao profissional especifica. Consultar substancias no GlobalDRO nao certifica a seguranca antidopagem do produto.'}
        </span>
      </div>
    </div>
  );
};

export default SuplementoCard;
