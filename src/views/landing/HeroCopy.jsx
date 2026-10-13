import React from 'react';
import logoLaines from '../../assets/LogoLaines.webp';

/**
 * Marca, título e frase da primeira tela (direção "Energia e velocidade" —
 * docs/design/landing-v2/a2-energia/index.html). Sem framer-motion: a
 * entrada é só CSS, escopada em `.lp[data-entrada]` (landing-hero.css).
 *
 * Fragment: os três elementos são itens diretos da grade `.lp-primeira`
 * (landing-base.css), cada um posicionado pelo próprio `grid-area`.
 */
const HeroCopy = () => (
  <>
    <header className="lp-marca">
      <span className="lp-marca__emblema">
        <img src={logoLaines} alt="" width="512" height="512" decoding="async" />
      </span>
      <span className="lp-marca__sigla">LAINES</span>
      <span className="lp-marca__inst">FACISA, UFRN</span>
    </header>

    <h1 className="lp-titulo">
      <span className="lp-titulo__linha" style={{ '--i': 0 }}>Liga Acadêmica</span>
      <span className="lp-titulo__linha" style={{ '--i': 1 }}>Interprofissional de</span>
      <span className="lp-titulo__linha" style={{ '--i': 2 }}>Nutrição Esportiva</span>
    </h1>

    <p className="lp-frase">
      A liga da FACISA/UFRN que reúne estudantes e profissionais de saúde em
      torno da nutrição no esporte.
    </p>
  </>
);

export default HeroCopy;
