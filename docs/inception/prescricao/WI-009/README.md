# WI-009 — funcionamento da prescrição e nomes dos alimentos

@work-item-id WI-009

## Intenção de mudança

O profissional precisa montar, salvar, revisar, publicar e entregar um plano alimentar com itens identificáveis. A tela já existe, mas seu funcionamento atual deve ser verificado de ponta a ponta. TACO e TBCA exibem descrições heterogêneas; a busca atual ignora acentos, mas depende de trechos literais, de modo que pontuação e abreviações dificultam encontrar alimentos.

## Comportamento esperado

- Documentar o percurso em uso, os cálculos, as permissões e a publicação, distinguindo o que foi exercitado do que depende de banco/navegador.
- Corrigir falhas reproduzidas no escopo da prescrição, sem alterar silenciosamente valores nutricionais, critérios clínicos ou aprovações.
- Tornar os nomes legíveis e a busca tolerante a acentos, caixa, separadores e ordem de palavras, preservando identidade da fonte, preparo e composição de cada alimento.
- Manter a busca de alimento junto à refeição e somente uma busca ativa; distinguir claramente item prescrito de opção de substituição.
- Garantir que orientações da refeição e conflitos de restrição em substitutos cheguem à revisão e à entrega.
- Manter descrições oficiais e snapshots históricos rastreáveis; qualquer nome de apresentação ou chave de busca deve ser derivado e reversível.

## Escopo provável

- Rota ativa `src/views/planos/PrescricaoPlano.jsx`, `src/hooks/usePrescricaoApi.js`, componentes usados e motor `src/core/prescricao/**` somente se um defeito reproduzido exigir.
- Catálogo `server/src/taco/**`, adaptador `src/services/prescricaoCatalogo.js`, testes sintéticos pertinentes e documentação de produto.
- Componentes `src/components/Prescricao/**`, projeção `server/src/planos-alimentares/**` e validação de restrições, apenas nos defeitos concretos reproduzidos.
- Não editar `PrescricaoPlanoAlimentar.jsx`, que não é a rota ativa.

## Não objetivos

- Renomear em massa descrições oficiais TACO/TBCA, fundir alimentos por similaridade, trocar nutrientes, realizar migração do banco real ou publicar planos de pacientes.
- Tornar o sistema prescritor automático ou inferir medidas caseiras/índice glicêmico ausentes.
- Tratar uma avaliação clínica como pré-requisito obrigatório da prescrição.

## Invariantes

- Permissões, vínculo paciente-equipe, autoria, revisão CRN, versão otimista, publicação, PDF e projeção ao atleta permanecem sob autoridade do servidor.
- IDs/fonte/código/preparo continuam distinguindo itens de nomes parecidos; plano salvo conserva o snapshot do alimento e seus nutrientes.
- Substitutos não entram nos totais; ausência de nutriente não vira zero; restrições e conflitos continuam exigindo conferência/justificativa.
- O texto editado como orientação da refeição deve aparecer no plano entregue; alternativas restritas exigem a mesma justificativa das linhas principais.
- Somente dados sintéticos em testes; nenhum envio de mensagem nem alteração de banco real.

## Verificação e reversão

- Executar testes de contrato, adequação e núcleo relevantes, lint/build, checagens PhaseGate e, se viável sem iniciar serviços externos, cenários de busca e nomes.
- Registrar falhas preexistentes e limites de câmera/navegador/PostgreSQL separadamente dos resultados obtidos.
- Reverter somente arquivos WI-009; descrições oficiais, históricos e planos publicados não serão regravados.
