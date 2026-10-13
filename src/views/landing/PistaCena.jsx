import React from 'react';

/**
 * Cena da primeira tela: céu do estádio, luz do horizonte e a pista em
 * perspectiva CSS 3D, com as marcas da largada escalonada (direção
 * "Energia e velocidade" — docs/design/landing-v2/a2-energia/index.html,
 * `.cena`). Puramente decorativa: `aria-hidden`, nenhum texto, nenhum dado.
 * Estilo em landing-hero.css; a coreografia de entrada em
 * `.lp[data-entrada]` do mesmo arquivo.
 */
const PistaCena = () => (
  <div className="lp-cena" aria-hidden="true">
    <div className="lp-cena__luz" />
    <div className="lp-chao">
      <div className="lp-chao__plano">
        <div className="lp-chao__marcas">
          <div className="lp-chao__largada">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <i key={n} style={{ '--n': n }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default PistaCena;
