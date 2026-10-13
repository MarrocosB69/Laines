import React from 'react';
import MacroRosca from './MacroRosca.jsx';
import { n } from './formato.js';

/** Apresentacional. */
export default function PainelMacros({ dia, metas, distribuicao, cores, macros = [] }) {
  const porNutriente = Object.fromEntries(macros.map((linha) => [linha.nutriente, linha]));
  const semDado = (chave) => porNutriente[chave]?.valor === null;
  const parcial = (chave) => !semDado(chave)
    && Number.isFinite(porNutriente[chave]?.cobertura)
    && porNutriente[chave].cobertura < 1;
  const composicaoIncompleta = ['kcal', 'cho', 'ptn', 'lip'].some((chave) => semDado(chave) || parcial(chave));
  const linhas = [
    { k: 'cho', rotulo: 'Carboidrato', valor: dia.cho, meta: metas.cho, cor: cores.cho },
    { k: 'ptn', rotulo: 'Proteína', valor: dia.ptn, meta: metas.ptn, cor: cores.ptn },
    { k: 'lip', rotulo: 'Lipídio', valor: dia.lip, meta: metas.lip, cor: cores.lip }
  ];

  return (
    <div className="pp-cartao pp-macros">
      <div className="pp-macros__rosca">
        <MacroRosca dia={dia} metas={metas} distribuicao={distribuicao} cores={cores}
          energia={porNutriente.kcal} composicaoIncompleta={composicaoIncompleta} />
      </div>
      <div className="pp-macros__linhas">
        {linhas.map((l) => (
          <div key={l.k} className="pp-macros__linha">
            <span className="pp-macros__rotulo">
              <span
                className="pp-macros__cor"
                style={{ background: l.cor }}
                aria-hidden="true"
              />
              {l.rotulo}
            </span>
            <span className="pp-macros__valor">
              {semDado(l.k) ? '—' : n(l.valor)}{parcial(l.k) && <span aria-hidden="true">*</span>} / {n(l.meta)} g
              {/* Sem peso cadastrado nao ha g/kg: dividir por nulo daria
                  Infinity, e a regra e mostrar travessao, nao numero falso. */}
              {' · '}{metas.peso && !semDado(l.k) ? `${n(l.valor / metas.peso, 1)} g/kg` : '— g/kg'}
            </span>
          </div>
        ))}
        {composicaoIncompleta && (
          <p className="pp-nota">* Subtotal conhecido; — indica composição ausente. Confira a cobertura na tabela de adequação. A rosca usa apenas os nutrientes conhecidos.</p>
        )}
      </div>
    </div>
  );
}
