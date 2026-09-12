import React from 'react';
import MacroRosca from './MacroRosca.jsx';
import { n } from './formato.js';

/** Apresentacional. */
export default function PainelMacros({ dia, metas, distribuicao, cores }) {
  const linhas = [
    { k: 'cho', rotulo: 'Carboidrato', valor: dia.cho, meta: metas.cho, cor: cores.cho },
    { k: 'ptn', rotulo: 'Proteína', valor: dia.ptn, meta: metas.ptn, cor: cores.ptn },
    { k: 'lip', rotulo: 'Lipídio', valor: dia.lip, meta: metas.lip, cor: cores.lip }
  ];

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 max-[999px]:flex max-[999px]:items-center max-[999px]:gap-4">
      <div className="flex justify-center">
        <MacroRosca dia={dia} metas={metas} distribuicao={distribuicao} cores={cores} />
      </div>
      <div className="mt-2 max-[999px]:mt-0 max-[999px]:flex-1">
        {linhas.map((l) => (
          <div key={l.k} className="flex items-baseline border-t border-stone-200 py-1 text-xs">
            <span className="flex-1 text-stone-700">
              <span
                className="mr-2 inline-block h-2 w-2 rounded-sm align-middle"
                style={{ background: l.cor }}
              />
              {l.rotulo}
            </span>
            <span className="text-stone-500">
              {n(l.valor)} / {n(l.meta)} g
              {/* Sem peso cadastrado nao ha g/kg: dividir por nulo daria
                  Infinity, e a regra e mostrar travessao, nao numero falso. */}
              {' · '}{metas.peso ? `${n(l.valor / metas.peso, 1)} g/kg` : '— g/kg'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
