# WI-006 — contexto da triagem pública nas avaliações

@work-item-id WI-006

## Intenção de mudança

Os módulos de avaliação funcionam, mas a visão geral repete contagens e o formulário abre depois de vários blocos de contexto. A equipe também precisa consultar na avaliação o autorrelato da inscrição pública, hoje visível principalmente no prontuário. O pedido do usuário autoriza modernizar esta interface e aproveitar a triagem pública sem refazer os módulos.

Comportamento esperado: a visão geral mantém progresso, alertas, próximos passos e acesso a todos os módulos, mas reduz informação duplicada. No módulo, o contexto da sessão anterior fica recolhível e a triagem pública aparece em um resumo discreto, somente leitura, com origem e data, que pode ser expandido para consultar treino, saúde relatada e rotina/solicitações. A triagem orienta a entrevista e pode fornecer apenas valores ausentes ao contexto de onboarding já usado por alguns formulários; registros clínicos salvos e edições em andamento prevalecem.

Escopo mínimo: `src/views/AvaliacaoCompleta.jsx` e CSS correspondente, um seletor puro de dados da triagem e teste sintético desse seletor. Ajuste pontual na anamnese se necessário para manter sexo biológico distinto de gênero. Registro em `docs/implementacao/avaliacoes-contexto/README.md`.

Não objetivos: remover campos ou módulos, alterar cálculo/escore/classificação, transformar o rastreio público RED-S ou EBIA em avaliação finalizada, criar endpoint/migração, modificar autorização, gravar a triagem em snapshots clínicos, mudar o formulário público ou alterar o prontuário.

Invariantes: `GET /pacientes/:id` e o vínculo clínico continuam a única origem de acesso nesta tela (INV-002); inscrição repetida não altera cadastro (INV-003); testes usam somente paciente sintético (INV-005); trabalho local anterior é preservado (INV-006). Ausência de resposta não vira resposta negativa. Água por dia não é volume ingerido durante exercício. Nenhum dado da triagem sobrescreve avaliação salva ou edição do profissional. Em 320 px, abrir o contexto não pode deslocar horizontalmente o formulário dentro do contêiner da rota.

Verificação: teste do seletor para ausência, precedência, origem/data e valores explícitos; `npm run test:ui`, `npm run lint`, `npm run build` e PhaseGate L2/check-ready. Captura sintética em 1280, 390 e 320 px, medindo também `scrollWidth` de `.content-area` e `.avaliacao-layout-grid` antes/depois da expansão. Não usar banco real, email real ou deploy.

Rollback: reverter somente o seletor, os blocos JSX/CSS deste item e eventual ajuste de prefill, preservando outros trabalhos locais e documentação histórica.
