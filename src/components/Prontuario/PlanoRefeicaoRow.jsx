import React from 'react';

/**
 * PlanoRefeicaoRow — linha de uma refeição no plano alimentar.
 *
 * @param {{ refeicao: { horario?: string, nome?: string, calorias?: number, macros?: { cho?: number, ptn?: number, lip?: number } } }} props
 */
const PlanoRefeicaoRow = ({ refeicao }) => {
  if (!refeicao) return null;
  const { horario, nome, calorias, macros } = refeicao;

  const macroStr = macros
    ? [
        macros.cho != null ? `CHO ${macros.cho}g` : null,
        macros.ptn != null ? `PTN ${macros.ptn}g` : null,
        macros.lip != null ? `LIP ${macros.lip}g` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <div className="plano-ref-row">
      {horario && <span className="plano-ref-row__hora">{horario}</span>}
      <div className="plano-ref-row__corpo">
        <span className="plano-ref-row__nome">{nome || 'Refeição'}</span>
        <div className="plano-ref-row__detalhes">
          {calorias != null && (
            <span className="plano-ref-row__kcal">{calorias} kcal</span>
          )}
          {macroStr && (
            <span className="plano-ref-row__macros">{macroStr}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanoRefeicaoRow;
