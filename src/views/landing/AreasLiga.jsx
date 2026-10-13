import React from 'react';

/**
 * As quatro áreas da liga, abaixo da primeira tela (direção "Energia e
 * velocidade" — docs/design/landing-v2/a2-energia/plano.md, seção 1).
 *
 * O texto de cada área é literal das telas internas do sistema — não é
 * copy nova desta página. Origem de cada linha, conferida em 2026-09-25
 * contra o arquivo-fonte (comentários abaixo apontam arquivo e linha):
 * as quatro raízes coincidem com ACADEMIC_NAVIGATION em
 * src/constants/academicNavigation.js (ensino, research, extensao,
 * comunicacao). scripts/test-landing-conteudo.cjs prova essa origem.
 */
const AREAS = [
  {
    nome: 'Ensino',
    // src/views/admin/Areas/Ensino.jsx, linha 63
    // (sectionMeta.overview.description).
    descricao: 'Reuniões científicas, rodas de conversa e materiais de apoio.'
  },
  {
    nome: 'Pesquisa',
    // src/views/admin/Research/ResearchProjects.jsx, linha 77
    // (RESEARCH_SECTION_META.overview.description), sem o final "em um só
    // lugar" — corte documentado no plano de design (seção 1).
    descricao: 'Projetos, ideias e produções científicas da liga.'
  },
  {
    nome: 'Extensão',
    // src/views/admin/Areas/Extensao.jsx, linha 69
    // (sectionMeta.overview.description).
    descricao: 'Triagens, capacitações e materiais produzidos pela liga.'
  },
  {
    nome: 'Comunicação',
    // src/views/admin/Areas/Comunicacao.jsx, linha 70
    // (sectionMeta.comunicados.description, seção "Comunicados").
    descricao: 'Avisos, campanhas e divulgações da liga.'
  }
];

/** As quatro areas da liga, abaixo da primeira tela. */
const AreasLiga = () => (
  <section className="lp-areas" aria-labelledby="lp-areas-titulo">
    <h2 id="lp-areas-titulo">As quatro áreas da liga</h2>
    <ul className="lp-raias">
      {AREAS.map((area, index) => (
        <li className="lp-raia" key={area.nome} style={{ '--i': index }}>
          <h3>{area.nome}</h3>
          <p>{area.descricao}</p>
        </li>
      ))}
    </ul>
  </section>
);

export default AreasLiga;
