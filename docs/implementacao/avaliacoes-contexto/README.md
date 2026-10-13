# WI-006 — avaliações com contexto progressivo

@work-item-id WI-006

## Entrega

- A visão geral mantém o mapa navegável de módulos como leitura por etapa; o cartão de progresso deixa de repetir as mesmas contagens.
- Na avaliação, a última sessão vira um resumo recolhível. A inscrição pública aparece em uma faixa recolhível, identificada como autorrelato, com data e grupos de treino, saúde relatada e rotina/solicitações.
- O contexto de onboarding combina o snapshot da inscrição pública com os dados posteriores de confirmação, seguindo a precedência já usada no prontuário. O snapshot público segue disponível separadamente para consulta; não é transformado em avaliação finalizada.
- A anamnese usa sexo biológico explícito ao iniciar campo vazio. Gênero e sexo biológico deixam de ser inferidos um do outro nesse prefill. Nenhum módulo, campo, cálculo, endpoint ou regra de autorização foi removido.
- A grade dos módulos em telas estreitas passa a encolher até a largura disponível; abrir a triagem não desloca o formulário para fora da área visível.

## Arquivos do item

`src/views/AvaliacaoCompleta.jsx`, `src/views/AvaliacaoCompleta.css`, `src/views/avaliacoes/publicTriageContext.js`, `src/components/Avaliacoes/anamnese/AnamneseInicialForm.jsx`, `scripts/test-public-triage-context.cjs` e os documentos `docs/inception/avaliacoes/WI-006/README.md` e `docs/product/construction/avaliacoes/contexto_triagem_publica.md`.

## Verificação

- `node scripts/test-public-triage-context.cjs`: passou, com dados sintéticos e cenários de ausência, precedência, negativas explícitas, rastreios, privacidade de exibição e rótulos.
- `npm.cmd run test:ui`: passou.
- `node scripts/test-security-authorization.cjs`: 15 verificações passaram.
- `npm.cmd run lint`: passou com 8 avisos preexistentes, nenhum erro.
- `npm.cmd run build`: passou; aviso de chunks grandes já existente.
- PhaseGate `phasegate:check-ready` e `validate --layer L2 --format human`: passaram. `doctor` permanece vermelho por hooks/configuração do repositório fora do escopo deste item.
- Prévia isolada em Chromium com API interceptada e paciente sintético: 1280, 390 e 320 px. O contexto abriu em todos, mostrou os três grupos, sem erro de console, writes ou acesso a origem externa. Após o ajuste da grade responsiva, `.content-area` manteve `scrollWidth === clientWidth` em 390 e 320 px, fechado e expandido. Evidências temporárias: `tmp/wi-006-preview.report.json` e capturas `tmp/wi-006-preview.*.png`.
- Visão geral sintética em 1280 e 320 px: cartão superior mostrou apenas o total consolidado, o mapa preservou as contagens das seis etapas, sem erros ou overflow em 320 px (`tmp/wi-006-preview.overview-report.json`).

Limite: ainda não há validação em atendimento real ou banco. A prévia visual usa somente paciente e API sintéticos; não substitui homologação clínica. As informações da inscrição são autorrelato e precisam ser confirmadas pela equipe. O diagnóstico geral `phasegate doctor` continua vermelho por configuração prévia de hooks/CI; os checks relevantes do item passaram.

Rollback: retirar apenas o seletor, a faixa de triagem, o recolhimento do contexto, o ajuste visual da tela e a correção de sexo biológico da anamnese. Preservar os demais arquivos locais e as evidências anteriores.
