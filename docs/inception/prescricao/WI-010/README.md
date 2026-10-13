# WI-010 — fluxo de montagem e conferência da prescrição

@work-item-id WI-010

## Problema e comportamento esperado

A prescrição já permite montar refeições, substituir alimentos e revisar o plano, mas a página longa dificulta localizar a refeição certa. Abrir um cartão marca o plano como alterado, o primeiro salvamento não mostra estado claro e uma edição durante a requisição pode ser sobrescrita pela resposta. A busca adiciona o primeiro resultado com uma quantidade implícita. Totais com composição incompleta parecem totais fechados.

O profissional deve navegar por um mapa compacto de refeições, escolher a quantidade antes de incluir um alimento, distinguir alterações clínicas de simples expansão visual, ver o estado de salvamento, conferir refeições e alternativas antes de enviar/revisar/ativar, e reconhecer subtotais nutricionais quando houver dados ausentes. Falhas e impedimentos devem apontar a correção possível.

## Escopo

- Rota ativa `src/views/planos/PrescricaoPlano.jsx`, estilo correspondente e componentes de prescrição usados por ela.
- Estado e persistência em `src/hooks/usePrescricaoApi.js`, sem alterar endpoints ou formato do plano.
- Rótulos de cobertura na tela e no PDF de `server/src/planos-alimentares/plano-alimentar.service.ts`, sem alterar os valores calculados.
- Testes sintéticos de fluxo, contrato e interface, mais documentação de produto.

## Não objetivos

- Mudar fórmulas, metas, equivalência clínica, permissões, estados, contratos de API, banco real ou plano já publicado.
- Criar receitas, modelos persistentes ou medidas caseiras que o catálogo não fornece.
- Exigir uma avaliação anterior para prescrever.

## Invariantes

- O servidor continua autoridade sobre autoria, versão, revisão CRN, publicação, restrições e PDF.
- ID, fonte, composição e descrição oficial dos alimentos permanecem intactos; substitutos não entram nos totais.
- Quantidade informada e medida escolhida devem chegar ao item salvo sem conversão implícita de unidade.
- Navegar/recolher cartões não deve habilitar ações de persistência nem ocultar edição clínica pendente.
- Edição iniciada depois do começo de um salvamento não pode ser perdida pela resposta atrasada.
- Ausência de nutriente não deve ser apresentada como zero conhecido; números persistidos não mudam nesta onda.

## Verificação e reversão

- Rodar ESLint dos arquivos alterados, `npm run test:ui`, testes de núcleo/contrato/adequação pertinentes, build e PhaseGate.
- Usar somente dados sintéticos e não iniciar Vite, Playwright nem tocar no banco real.
- Conferir manualmente navegação, foco, rolagem e largura de 390/1280 px quando houver ambiente de navegador disponível.
- Reverter somente WI-010; não regravar descrições do catálogo ou planos históricos.
