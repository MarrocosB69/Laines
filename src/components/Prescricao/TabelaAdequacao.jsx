import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import LinhaAdequacao from './LinhaAdequacao.jsx';

/**
 * Apresentacional. O estado aqui é só de dobra visual, não de cálculo.
 *
 * Micronutrientes ficam FORA do DOM enquanto fechados, não escondidos por
 * CSS: a lista tem oito linhas e ninguém navegando por teclado ou leitor de
 * tela deveria atravessá-las para chegar ao resto da página.
 */
export default function TabelaAdequacao({ macros, micros }) {
  const [microAberto, setMicroAberto] = useState(false);

  return (
    <div className="mt-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm text-stone-900">Adequação nutricional</p>
        <span className="whitespace-nowrap text-xs text-stone-400">DRI · homem 19–30 anos</span>
      </div>

      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">
          Adequação do plano frente às referências de ingestão
        </caption>
        <thead>
          <tr className="border-b border-stone-200 text-stone-400">
            <th scope="col" className="pb-1 text-left font-normal">Nutriente</th>
            <th scope="col" className="pb-1 text-right font-normal">Plano</th>
            <th scope="col" className="pb-1 text-right font-normal">Referência</th>
            <th scope="col" className="pb-1">
              <span className="sr-only">Proporção</span>
            </th>
            <th scope="col" className="pb-1 text-right font-normal">Cobert.</th>
          </tr>
        </thead>
        <tbody>
          {macros.map((l) => <LinhaAdequacao key={l.nutriente} linha={l} />)}

          <tr>
            <td colSpan={5} className="pt-1">
              <button
                type="button"
                onClick={() => setMicroAberto((v) => !v)}
                aria-expanded={microAberto}
                className="flex w-full items-center gap-1.5 py-1.5 text-xs text-stone-600 hover:text-stone-900"
              >
                {microAberto
                  ? <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                  : <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
                Micronutrientes
              </button>
            </td>
          </tr>

          {microAberto && micros.map((l) => <LinhaAdequacao key={l.nutriente} linha={l} />)}
        </tbody>
      </table>
    </div>
  );
}
