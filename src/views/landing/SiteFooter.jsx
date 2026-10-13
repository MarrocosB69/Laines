import React from 'react';

/**
 * Rodapé da landing (direção "Energia e velocidade"): sem logotipo, só o
 * crédito institucional. A expansão de FACISA segue a fonte já usada em
 * src/views/public/InscricaoPublica.jsx, linha 177.
 */
const SiteFooter = () => (
  <footer className="lp-rodape">
    <p>© {new Date().getFullYear()} LAINES, Faculdade de Ciências da Saúde do Trairi (FACISA), Universidade Federal do Rio Grande do Norte</p>
  </footer>
);

export default SiteFooter;
