# Change Intent — as quatro áreas da Liga no padrão visual da landing

Data: 27/09/2026. O usuário pediu a melhoria visual das partes em comum (Pesquisa, Ensino, Extensão e Comunicação), **pasta por pasta**. O commit fica com o usuário.

## Decisões do usuário (26–27/09/2026)

1. **Onda só visual.** Mesmo conteúdo, mesmos dados e mesmas permissões, no padrão da landing.
2. **Adiado, próximo item:** quem não gerencia uma área hoje vê a tela de quem gerencia, com avisos ("Visualizacao dos itens publicados…", "Cadastro restrito a coordenacao…", "Você está em modo de leitura…"). O usuário prefere mostrar só o que a pessoa pode usar. **Esta onda não mexe nisso.** Os avisos continuam, com novo visual. O orquestrador leva uma proposta ao usuário depois.

## Estado de hoje (inventário de 26/09/2026)

| Pasta | Arquivos | CSS | Dados |
|---|---|---|---|
| `src/views/admin/Areas/` | `Ensino.jsx` (665), `Extensao.jsx` (876), `Comunicacao.jsx` (666), `contentAreaUtils.js` (54) | `Areas.css` (775), com o vocabulário `area-*` compartilhado pelas três | `GET/POST/DELETE /conteudos` por categoria; `GET /pacientes/triagem-publica` (Extensão) |
| `src/views/admin/Research/` | `ResearchProjects.jsx` (1.741), `ResearchProjectModal.jsx` (355), `ProductionModal.jsx` (248), `IdeaModal.jsx` (193), `IdeaDetailModal.jsx` (214) | `ResearchProjects.css` (1.432) | `/projetos`, `/projetos/producoes`, `/projetos/ideias`, `/avaliacoes`, `/users/equipe-atendimento` |

Todas usam Inter, Poppins ou as cores antigas (`#2f6fa6`, `#143554` e outras), fora do padrão da landing. As telas aparecem nos portais de admin, aluno, professor e equipe.

## Ordem: uma área de cada vez (pedido do usuário, 27/09/2026)

Cada etapa segue o mesmo ciclo: um executor em Opus edita, o orquestrador verifica em navegador (como quem gerencia e como quem só lê) e só então vem a próxima.

1. **Ensino e a base compartilhada `Areas.css`.** O vocabulário `area-*` é comum às três áreas de conteúdo, então esta etapa já muda o visual base de Extensão e Comunicação. Os JSX dessas duas não são tocados aqui.
2. **Extensão:** o que é específico dela (triagens, capacitações).
3. **Comunicação.**
4. **Pesquisa:** `src/views/admin/Research/`, com o JSX principal, os quatro modais e `ResearchProjects.css`.

`contentAreaUtils.js` **não muda** em nenhuma etapa. A revisão independente vem depois da etapa 4.

## Padrão visual

- O mesmo das ondas anteriores: tokens `--lt-*` (`src/views/landing/landing-tokens.css`), par Sofia Sans, títulos na voz de campanha, cartões brancos com `--lt-radius-card`, alvos de 44 px ou mais, foco com `--lt-focus-ring` e contraste de 4,5:1 ou mais.
- **Painel de cada área:** usar as peças de `src/components/painel/Painel.jsx` (`PainelSecao`, `PainelIndicadores`, `PainelLista`) onde a estrutura casar, para ficar coerente com a Visão geral. Componentes locais novos ficam dentro da própria pasta.
- **Armadilhas globais:** `h1…h6`, `p`, `button` e `input:not(...)` de `src/index.css` e `src/styles/theme.css`. Ver a seção "Direção vigente" de `docs/design/landing-guia-visual.md`.

## Invariantes

1. **Mesmos dados:** chamadas de API, parâmetros, estados derivados e cálculos não mudam. A prova é o diff contra a cópia de antes.
2. **Mesmas permissões e mesmos avisos:** `canManageContentArea`, `canApproveContent`, `canManageResearch` e as condições que escondem formulários e botões ficam iguais. Os textos dos avisos também, por enquanto.
3. **Mesmas subseções, na mesma ordem,** e as mesmas abas de `academicNavigation.js`.
4. **Nenhum texto de conteúdo muda.** Títulos e descrições de `sectionMeta` ficam iguais; `test-landing-conteudo.cjs` lê três deles.
5. **Layout e tipografia:** nada cortado e nenhuma rolagem horizontal a 1280 e 390 px. Só as duas famílias Sofia.

## Verificação

- `npm run lint`, `npm run test:ui` e `npm run build`.
- Navegador numa rodada única do orquestrador, com API sintética: as quatro áreas e as subseções, como quem gerencia e como quem só lê, a 1280 e 390 px.
- Revisão independente em Opus.

## Reversão

As cópias de antes ficam em `tmp/areas-v1/`.

## Achados durante a onda (27/09/2026)

- **Modo escuro:** o portal do aluno tem modo escuro (`StudentView`, classe `dark-mode`). O `Areas.css` antigo tinha um bloco `.admin-view.dark-mode .area-page`. O novo não tem, e `painel.css` também não, então no modo escuro os cartões ficam claros. A etapa 4 segue o mesmo caminho na Pesquisa. O modo escuro das superfícies novas fica para uma decisão única do usuário, a conferir na rodada de navegador.
- **Triagens (Extensão), para quem não gerencia:** o cartão mostrava "0" sem ter carregado a lista. Agora mostra "—". Para reverter: `valor: card.count`.
- **Pesquisa decide a permissão pelo papel** (`RESEARCH_ADMIN_ROLES`), não pelas `capabilities` do servidor, como as outras áreas fazem. Esta onda não mexe nisso. O tema entra no próximo item: mostrar a quem não gerencia só o que a pessoa pode usar.
- **Pesquisa, "Resumo de impacto" (defeito anterior à onda):** Avaliações e Pacientes, e a coluna Impacto, mostram 0 até alguém clicar em "Sincronizar avaliações". O motivo é que `loadOperationalData` só roda dentro de `handleSyncEvaluations`. Como é lógica, fica fora desta onda, que é só visual.
- **Pesquisa, modais (anterior à onda):** `IdeaDetailModal` usa `project-tag`, `research-interest-pill` e `research-action-link`. Essas classes são escopadas em `.research-projects` e não chegam ao modal, que vai para o `body` pelo portal. Isso fica para a onda de `modalSystem.css`.
- **Pesquisa, cores de status (confirmar com o usuário):**
  - "atenção": pausado e em discussão;
  - "positivo": em andamento, publicado e prioridade;
  - apoio em contorno: concluído e arquivada.
- **Pesquisa, tabela estreita:** abaixo de 52rem, cada linha vira um cartão, e o rótulo "Coordenação" é repetido por CSS com texto alternativo vazio. Ainda falta medir no Safari e conferir no build.

## Estado das etapas (27/09/2026)

As quatro etapas estão editadas. Até aqui, cada uma foi verificada com ESLint e comparada com `tmp/areas-v1/`: chamadas de API, lógica antes do `return`, permissões e textos iguais. Os modais da Pesquisa ficaram idênticos. **Falta,** quando a máquina for liberada:
- `npm run lint`, `test:ui` e `build`;
- a rodada de navegador das quatro áreas, como quem gerencia e como quem só lê;
- a revisão independente.
