# Change Intent — ondas visuais A–D: o resto do sistema no padrão novo

Data: 28/09/2026. O usuário pediu, depois do mapa em `docs/implementacao/mapa-visual-pendente.md`: "vamos trabalhar em cada frente dessa até não ter mais nada pra mudar". O commit fica com o usuário.

## Problema
Cerca de 18 mil linhas de CSS em uso ainda estão no visual antigo (Poppins/Inter e cores fixas), enquanto landing, inscrição, barras laterais, Visão geral, áreas, plano alimentar e avaliações já seguem "Energia e velocidade".

## Ondas e arquivos (listas fechadas e disjuntas)
- **A — fundações:**
  - `src/index.css`, `src/App.css` e `src/styles/*` (`theme.css`, `modalSystem.css`);
  - `src/components/ui/*`;
  - `src/components/Auth/ProfileCompletionModal.*` e `PasswordChangeModal.*`;
  - `src/views/admin/AdminView/AdminHeader.*` e `AdminView.css`.
- **B — atleta e equipe:**
  - `src/views/Athlete/*`, exceto `AthleteVisaoGeral.jsx` e `AthleteHeader.jsx`;
  - `src/components/Atleta/*`;
  - `src/views/Team/TeamPortal.*`, exceto `TeamVisaoGeral.jsx`.
- **C — agendas e rotina:**
  - `src/views/Student/StudentAgenda/*` e `src/views/Student/StudentDashboard/StudentDashboard.css`;
  - `src/views/Student/Patients/AppointmentModal.*`;
  - `src/views/professor/ProfessorAgenda.*` e `ProfessorView.css`;
  - `src/components/shared/ClinicalEvaluationResultCard.*` e `EvaluationSummaryStrip.*`;
  - `src/components/Supervisao/FilaRevisao.*`.
- **D1 — gestão, parte 1:** `src/views/admin/ReportsPage/*`, `src/views/admin/AdminView/SettingsPage.*` e `src/views/admin/Requests/*`.
- **D2 — gestão, parte 2:** `src/views/admin/Registration/*` (ManagementPages, PatientManagement, UserManagement, PatientModal e UserModal) e `src/views/admin/Patients/LinkPatientModal.*`.
- **E — prontuário:** espera o WI-007. Ver o mapa.

## Coordenação com o WI-007
Em 28/09, entre 07:43 e 08:08, o WI-007 editou `AdminView.jsx`, `ProfessorView.jsx`, `StudentView.jsx` e `LainesSidebar.jsx`. **Nenhuma onda edita esses arquivos, nem** `src/components/Prontuario/*`, `PatientProntuario.*`, `App.jsx`, `RouteSidebarLayout.jsx` ou `sidebarModel.js`. Se uma onda precisar deles, registra o pedido no relatório.

## Não objetivos
- Mudar textos, chamadas de API, permissões, cálculos, estados, handlers ou rotas.
- Mexer em telas já migradas: landing, inscrição, sidebars, Visão geral, áreas, plano e avaliações.
- Modo escuro, que o usuário decide depois para todas as superfícies.
- Remover código morto, que depende de aprovação.

## Invariantes
1. **Lógica idêntica,** provada pelo diff contra `tmp/telas-v1/` (mesmos caminhos): só marcação, classes, acessibilidade e CSS mudam.
2. **Os mesmos textos visíveis, as mesmas condições de exibição e as mesmas props públicas** dos componentes compartilhados.
3. **Onda A, globais:**
   - tipografia e cores passam aos tokens;
   - **regras que mudam layout** (`button { display:inline-flex; white-space:nowrap }`, a especificidade de `input:not(...)`, `box-sizing`, margens de `p`) **só mudam com prova de que nenhuma tela depende delas**. Na dúvida, ficam como estão e entram no relatório;
   - as telas já migradas não podem mudar de aparência.
4. **Nenhum dado real.**

## Padrão visual
O mesmo das ondas anteriores:
- tokens `--lt-*` (`src/views/landing/landing-tokens.css`) e o par Sofia Sans;
- cartões brancos com `--lt-radius-card`;
- alvos de 44 px, campos de 48 px, foco `--lt-focus-ring` e contraste de 4,5:1 ou mais;
- estado escrito, não só cor.

Referências: `src/views/admin/Areas/Areas.css`, `src/components/painel/*`, `src/views/public/inscricao/campos.jsx` e a seção "Direção vigente" de `docs/design/landing-guia-visual.md`.

## Verificação
- **Por onda (leve, a máquina está pesada):** ESLint, postcss, os testes estáticos pertinentes e o diff contra o backup.
- **No fim:** `npm run lint`, `test:ui` e `build`, a rodada única de navegador do orquestrador com API sintética em todas as telas (1280 e 390 px, cada perfil) e a revisão independente.

## Reversão
O backup está em `tmp/telas-v1/` (106 arquivos, mesmos caminhos).

## Andamento

### Onda B — atleta e equipe: concluída (29/09)
**Conferência do orquestrador:**
- ESLint limpo e postcss ok;
- as ligações de campo e as chamadas iguais ao backup nos 4 JSX alterados;
- `AthleteVisaoGeral`, `AthleteHeader`, `TeamVisaoGeral` e `AthletePortal.jsx` intactos.

O executor comparou com SSR em 13 cenários, sem falhas.

**Correções de acessibilidade sem mudança de texto:**
- os grupos de caixas de marcação eram `label` dentro de `label` e viraram `role="group"`;
- os rótulos passaram a apontar para os campos;
- os botões de lixeira ganharam nome acessível.

**Para decidir:**
1. Remover os blocos "LEGADO SEM CONSUMIDOR" (cerca de 670 linhas no atleta e 72 na equipe).
2. Mostrar kcal no plano do atleta. É decisão clínica, e o componente nunca exibiu esse valor.
3. Levar `AthleteTab{Pendencias,Cadastro,Acompanhamento}.jsx` a uma onda B2: títulos que são `div`, nível da pendência não escrito e cores por `style` inline (`#16a34a` mede 3,30:1; hoje é neutralizado com `!important`).
4. O cabeçalho do atleta fica igual ao dos outros portais.
5. As autoavaliações passam a usar `.av-modulo`.
6. "Pendente" no Cadastro passa a ter o tom de atenção.

**Defeitos notados:**
- `scripts/journey-audit.mjs:262` procura "Salvar confirmacao", mas o texto real é "Salvar cadastro";
- o Wizard não tem trava de foco nem Esc;
- há textos sem acento em `AthletePortal.jsx`;
- o `:hover` de `modalSystem.css` fica fora de `@media (hover: hover)` (onda A).

### Onda C — agendas e rotina: concluída (29/09)
**Conferência do orquestrador:**
- ESLint limpo e postcss ok;
- as ligações e as chamadas iguais ao backup nos 4 JSX;
- `test-painel` passa;
- `ProfessorView.jsx`, `ProfessorDashboard.jsx` e `StudentDashboard.jsx` intactos.

O executor comparou com SSR em 28 cenários (mesmos textos, controles e classes), e a prova por mutação pegou 4 de 4.

**Mudanças de destaque:**
- calendário com hoje e selecionado distinguíveis sem cor (anel), com `aria-current="date"`;
- estado da consulta escrito;
- modal de agendamento com campos de 48 px e rodapé preso;
- cartão de resultado clínico com uma forma diferente por semântica;
- as cores de estado do painel do aluno passaram a cumprir o contraste (antes, cerca de 2,3:1).

**Pendências e decisões:**
1. **Cabeçalho do professor:** as regras em `ProfessorView.css` (`height: 56px`, `.header-btn` de 32 px) podem esconder o título atrás do botão da barra lateral no celular. Foram repassadas à onda A.
2. **Vazamento para o prontuário:** `.professor-view .chip` alcança o `ResumoClinico` do prontuário e sai na onda E.
3. **HTML inválido na Visão geral do professor:** `ClinicalEvaluationResultCard` fica dentro de `<button class="metric-item">` (há botão dentro de botão). É o JSX de `ProfessorDashboard`.
4. **Calendário do aluno:** os pontos de estado são só cor, e a dica aparece só no hover.
5. **Agenda do professor:** busca e selects só com `aria-label`, porque um rótulo visível seria texto novo.
6. **Dois `h1`** nas agendas.

### Onda A — fundações: concluída (29/09)
**Conferência do orquestrador:**
- ESLint limpo e ligações iguais nos 6 JSX;
- postcss ok nos 10 CSS;
- `test-landing-conteudo`, `test-sidebar-modelo`, `test-painel`, `test-avaliacao-base`, `test-inscricao-visual` e `test-landing-modais` passam, com as contagens de antes.

**Mudou:** fonte global Sofia; `h1` sem degradê; foco azul (6,33:1); modais `app-modal-*`, `components/ui`, cabeçalho dos portais e modais de perfil e senha no padrão novo; regras de cabeçalho removidas de `ProfessorView.css`.

**Ficou, por segurança:** `button` inline-flex/nowrap, `input` (0,2,1), `label`, `p`, tabelas e tamanhos. Migrar essas regras depois das ondas, com nova prova.

**Muda de propósito dentro de telas migradas:**
- a moldura dos modais da landing (raio de 20 px e superfície branca lisa);
- os modais da Pesquisa;
- os botões da `FilaRevisao`.

**Para decidir:**
1. A paleta legada do `:root` (`--color-primary` e outras).
2. Tirar o `@import` de Inter e Poppins, depois da onda E.
3. Os modais da landing com a moldura nova.
4. O fundo da moldura dos portais, que ficou branco.
5. `ui-button-sm` com 36 px.
6. O `role="status"` do carregamento passa a anunciar "Carregando".

### Onda F — acabamentos: em andamento
Pendências deixadas fora das listas das ondas B, C e A. O backup está em `tmp/telas-v1b/`.

### Onda F — acabamentos: concluída (29/09)
**Conferência do orquestrador:**
- ESLint limpo e ligações iguais nos 4 JSX;
- postcss ok;
- nenhum `!important` restante em `AthletePortal.css`;
- `StudentDashboard.jsx` intacto e `test-painel` passa.

**Mudou:**
- **Abas do atleta:** títulos reais (`h2`/`h3`); cores inline trocadas por classes de tom (antes, o verde media 3,30:1); selo de nível ("Prioritário", "Pendente" e "Informativo", reaproveitando `NIVEL_ROTULO`).
- **Portal do professor:** avatar e ícone nos tokens.
- **Visão geral do professor:** o cartão de resultado saiu de dentro do botão da linha. Não há mais botão dentro de botão.
- **Painel do aluno:** a animação só roda sem preferência por menos movimento, e os pontos do calendário têm uma forma para cada estado.

**Para decidir:**
1. **Área de clique na Visão geral do professor:** hoje, só o botão do alto abre o prontuário, e "Ver detalhes" só expande (antes, abria o prontuário junto).
2. **`NIVEL_ROTULO` duplicado:** a constante não é exportada por `AthleteVisaoGeral`.
3. **Cores dos pontos por tipo:** o violeta `#7c3aed` na fisioterapia fica fora dos tokens.
4. **Dica do calendário do aluno:** continua aparecendo só no hover.

### Onda D1 — Relatórios, Configurações e Solicitações: concluída (29/09)
**Conferência do orquestrador:** ESLint limpo; ligações e chamadas iguais ao backup em todos os JSX de `ReportsPage/`, `Requests/` e `SettingsPage`; postcss ok. O executor comparou com SSR em 15 cenários, sem falhas, e a prova por mutação pegou 3 de 3.

**Destaques:**
- o interruptor de privacidade dos Relatórios voltou a ser alcançável pelo teclado (antes era `display:none`);
- a tabela do drill-down rola por dentro, com foco;
- nas Solicitações, "Aprovar" e "Recusar" levam o nome da pessoa no rótulo;
- as animações do framer-motion respeitam quem pede menos movimento (`MotionConfig reducedMotion="user"`).

**Para decidir:**
1. Escrever na tela a severidade dos alertas e o estado da meta; hoje, isso só chega ao leitor de tela.
2. "Ligado/Desligado" dos interruptores gerado por CSS; o melhor seria movê-lo para `ToggleSetting.jsx`.
3. A cor nova da série Avaliações (`#6d28d9`).
4. Remover os blocos "LEGADO SEM CONSUMIDOR".

**Defeitos notados (sem correção):**
- `settings/ToggleSetting.jsx` e `SettingsTabContent.jsx` têm rótulos não ligados aos campos;
- ausência vira 0 nas contagens das Solicitações e nas métricas dos Relatórios;
- o selo de tendência dos Relatórios está sempre em "alta", sem comparação real;
- há textos sem acento em `AccessRequests.jsx`.

### Onda D2 — cadastros de atletas e usuários: concluída (29/09)
**Conferência do orquestrador:** ESLint limpo; ligações (inclusive `required` e `maxLength`) e chamadas iguais ao backup nos 5 JSX; postcss ok nas 4 folhas. Máscaras, validações e o CPF parcial ficaram intactos, pela comparação do executor.

**Destaques:**
- os 26 campos do `PatientModal` ligados aos rótulos;
- tabelas com `th scope`, rolando por dentro, com foco;
- perfil, estado e acesso escritos e com forma, além da cor;
- ações com o nome da pessoa no rótulo;
- permissões como botões `aria-pressed`, em vez de estilos inline.

**Para decidir:**
1. Caixas de seleção da tabela com 20 px.
2. Remover os blocos de legado.
3. Os textos sem acento da interface.

**Defeitos notados (sem correção):**
- `LinkPatientModal` com `div`/`h5` dentro de `<button>`;
- o modal de permissões não prende o foco;
- ausência vira 0 quando `/pacientes` falha.

**Fim de linha:** 6 arquivos passaram de CRLF para LF. Com `core.autocrlf=true`, isso não aparece no `git diff`.

### Onda E — prontuário e avaliações restantes: em andamento (29/09)
O usuário confirmou que o WI-007 terminou. A base nova é `tmp/prontuario-v1/` (36 arquivos, mesmos caminhos), que inclui o estado final do WI-007. Todas as mudanças do WI-007 (lógica, textos, autonomia das avaliações e a página própria do prontuário) são o novo "antes" e devem ser preservadas.

- **E1, prontuário:**
  - `src/components/Prontuario/*`, com `ProntuarioTheme.css` (também importado por `AvaliacaoCompleta.jsx`), `ProntuarioPatch.css` do WI-007, o cabeçalho, as abas, os painéis e a evolução;
  - `src/views/Student/Patients/PatientProntuario.*`;
  - a regra `.professor-view .chip` de `ProfessorView.css`, que vaza para o prontuário.
- **E2, avaliações restantes:** o GET, a Imagem e `src/components/AlimentoBuscador.*`, este usado dentro da avaliação Alimentar.

### Onda E2 — GET, Imagem e busca de alimentos: concluída (30/09)
**Conferência do orquestrador:**
- `test-image-evaluation` (17), `test-avaliacao-base` (36) e `test-get-autonomy` passam;
- ESLint limpo;
- ligações e chamadas iguais a `tmp/prontuario-v1/` nos 3 JSX.

O executor gravou cada arquivo uma vez, com o hash conferido, e comparou com SSR em 46 cenários, sem falhas. `Body3D.jsx` ficou intacto. Tudo o que o WI-007 fez foi preservado: TMB pelo perfil, `readOnly`, trava de foco e movimento reduzido.

**Limite:** a revisão e o resultado da Imagem não usam `ResultadoCalculado`/`AvaliacaoSecao`, porque `test-image-evaluation.cjs` renderiza esses passos isolados, sem empacotar `../base`. Ganharam o mesmo desenho por CSS. Para usar os componentes, o teste precisa empacotar a base.

**Correção de um relatório:** o executor disse que `PrescricaoPlanoAlimentar` tem rota. **Não tem:** `App.jsx:31` só importa, e nenhuma rota usa. Ela e o `RefeicaoBuilder` continuam como código morto. A busca de alimentos manteve a camada compacta fora de `.av-modulo`, então nada muda se a página voltar a ter rota.

**Defeito de cálculo (preexistente, igual na versão de 27/09):** no GET, com o registro semanal vazio, `sumGastoSemanal` devolve 0. Aí `palRealCalculado` vale 1,0 e vence o nível de atividade em `fatorAtividadeFinal`. Resultado: GET = TMB × 1,0, e o select "Nível de atividade" deixa de ter efeito. Esse 0 e esse 1,0 vão para o dado salvo.

**Para decidir:**
- o `aria-label` do diálogo da Imagem ("Avaliação corporal…") diverge do h2 visível ("Composição corporal…");
- remover os blocos de legado (1.211 linhas na Imagem e 211 no GET).

### Onda E1 — prontuário: concluída (30/09)
**Conferência do orquestrador:**
- ESLint limpo; ligações e chamadas iguais a `tmp/prontuario-v1/` em todos os JSX alterados;
- postcss ok nas 8 folhas;
- `test-prontuario-pendencias`, `test-visualizacao-dados` e `test-acessibilidade-tokens` passam;
- **`AvaliacaoCompleta` sem mudança:** o `e1/protegidas.cjs`, refeito depois da E2, mostra as 71 regras que podem casar com a página idênticas e na mesma ordem.

O executor comparou com SSR em 39 cenários, sem falhas, e a prova por mutação pegou 3 de 3.

**CSS do prontuário:** as camadas antigas (`ProntuarioTheme.css` e `PatientProntuario.css`) foram reduzidas à base protegida e ao legado. A camada viva está consolidada em `ProntuarioPatch.css` (631 usos de `--lt-*`). `ProntuarioHeader.css` e `EvolucaoAnalytics.css` foram reescritas. São 385 regras de legado isoladas.

**Para decidir:**
1. **Cores por semântica:** a variação passou a neutra, porque subir nem sempre é bom; comorbidades ficaram neutras; divergências passaram de perigo a atenção; a pendência "alta" ganhou traço de atenção largo.
2. **Regras protegidas:** o `pron-fadein` no contêiner da avaliação embutida roda sem guarda de movimento reduzido.
3. **Remoção do legado e de componentes mortos:** `MacroEtapaSection`, `PainelSituacaoClinica`, `ProximasConsultas`, `AlertaBanner` e `ModuloCard`.

**Defeitos notados (sem correção):**
- `ProntuarioTabs.jsx:60-75`: as setas trocam a aba, mas o foco não acompanha;
- ausência vira 0 no resumo de consultas;
- textos sem acento em `ResumoClinico.jsx`;
- o `.spin` global gira sem guarda de movimento reduzido.
