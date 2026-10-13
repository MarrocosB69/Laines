# Onda 2 — UPD-12, 11, 13, 14, 15, 16, 17, 18

@work-item-id WI-003

[Intenção aprovada](change-intent.md). Ordem por dependência do backlog. Cada item traz comportamento, evidência e limites; o fechamento da versão continua sujeito à homologação (UPD-21).

## UPD-12 — contrato de autorização

| Antes | Depois |
|---|---|
| Regra clínica repetida em pacientes, avaliações, planos, agendamentos e realtime; planos e agendamentos ignoravam a cadeia de supervisão do aluno. | `server/src/auth/authorization.ts` decide o vínculo por objeto (`gestao`, `responsavel`, `supervisor`, `equipe`, `supervisao_aluno`, `atleta`) e gera um único filtro SQL; os cinco serviços chamam a mesma função. |
| Interface derivava capacidades do papel no cliente. | `/auth/me` e o login entregam `capabilities` (`liga`, `atendimento`, `gestao`); `AuthContext` expõe o objeto, com reserva local só para sessão antiga. |
| Admin/coordenação liam prontuário sem trilha. | Leitura de prontuário, avaliação e plano por gestão registra `acesso_clinico_gestao` na auditoria, uma vez por janela de 5 minutos por objeto; a trilha nunca bloqueia a leitura. |
| Diretoria ou presidência podiam parecer acesso clínico. | Diretoria e cargo acadêmico nunca concedem vínculo clínico; conteúdo publicado é transversal às quatro áreas e rascunho fica na área de origem. |

Evidência: `npm run test:security` inclui `scripts/test-security-authorization.cjs` (9 cenários: aluno sem/com diretoria, outra diretoria, professor com/sem cadeia, atleta próprio/alheio, admin, trilha, conteúdo). Regressões anteriores (16 credenciais, 8 realtime, 11 acesso/upload, 10 prescrição) continuam passando. `tsc` e ESLint sem erros.

Limites: retirar o acesso clínico de admin/coordenação é decisão operacional separada; a trilha em memória reinicia com o processo. Sem migração de banco.

## UPD-11 — referências e restrições

| Antes | Depois |
|---|---|
| Tabela DRI fixa de homem 19–30 anos; paciente do sexo feminino via a referência de homem. | `referencias-prescricao.ts` seleciona por sexo biológico e faixa etária (19–30, 31–50, 51–70, 71+) a partir do cadastro ou da anamnese finalizada. Mesmos oito nutrientes; nenhum campo novo de cadastro. Menores de 19 anos, sexo ausente ou data inválida ficam **sem valor**, com o motivo na tela. Gestação/lactação declaradas como fora do escopo desta versão. |
| Restrições da anamnese não chegavam às sugestões (`restricoes=[]`). | Painel de conferência na prescrição mapeia o texto livre da anamnese para grupos/alimentos do catálogo. O motor exclui o grupo restrito das sugestões e informa o motivo. |
| Nada impedia prescrever contra uma restrição registrada. | Envio para revisão exige conferência registrada; item em conflito exige justificativa clínica explícita (mín. 5 caracteres). Aprovação revalida no servidor. |
| Autoria da conferência vinha do cliente. | Servidor fixa autor e data. Conferência inalterada preserva o carimbo original; qualquer mudança gera carimbo novo. |
| Interface recomendava o GlobalDRO como validação de suplemento. | Texto alinhado ao do PDF: o GlobalDRO informa sobre substâncias/medicamentos e não certifica a segurança antidopagem do produto. |

Evidência: 3 cenários novos em `scripts/test-prescription-contract.cjs` (13 no total) e 1 no núcleo (101 no total).

**Incompatibilidade encontrada e corrigida:** `npm run test:core` estava falhando em dois casos (`metaAusenteNaoViraDeficit`, `direcao-limite-inverte-o-julgamento`) **antes desta onda**. O núcleo de prescrição já havia sido reescrito no working tree — separando meta individual, limite de segurança e referência populacional, e tratando ausência como nulo — mas os dois testes continuavam na semântica antiga (`percentual >= 90 → ok`; plano vazio com percentual `0`). Os testes foram alinhados à regra nova, que é a exigida por CLI-06/CLI-07. Plano sem itens agora é afirmado como valor nulo, não zero.

Limites: as referências cobrem adultos; a tabela não foi ampliada para gestação, lactação ou menores de 19 anos. O mapeamento de restrição continua sendo uma decisão profissional — o sistema não interpreta texto livre automaticamente.

## UPD-14 — prontuário e pendências

Executado por agente, revisado por agente independente. Veredito: **aprovado com ressalvas**.

| Antes | Depois |
|---|---|
| A categoria "não aplicável" existia como rótulo na tela, mas `categoryOf()` nunca a atribuía: três categorias reais de quatro. | As quatro categorias são derivadas de fato. Instrumento restrito a uma área vira "não aplicável" somente quando o caso já tem equipe registrada e nenhum membro cobre aquela área. **Equipe desconhecida nunca produz "não aplicável"** — senão esconderia pendência real de um caso ainda sem equipe montada. |
| Obrigatória e solicitada tinham a mesma severidade e nenhuma ordem declarada. | Fila ordenada por relevância: revisão pendente → obrigatória → solicitada → continuidade de agenda. Severidade alta para obrigatória, média para solicitada, sempre com rótulo textual além da cor. |
| CSS de um widget triplicado já removido da tela continuava no arquivo. | ~63 linhas de CSS morto removidas (`.passo-item*`, `.proximos-passos-list`, `.pendencias-list`, `.pendencia-item*`). O revisor refez a busca classe por classe em todo `src`, incluindo template strings: zero referências vivas. As classes em uso são `pron-*`, de outro arquivo. |

Origem dos dados: `patient.equipeProfissional`, campo já existente, cruzado com as áreas do registro de avaliações. Nenhum campo de cadastro, formulário ou migração novos.

Evidência: `scripts/test-prontuario-pendencias.cjs`, 5 verificações. Paciente novo sem contexto de atendimento produz **0 tarefas** e os 17 instrumentos ficam como opcionais; com consulta do dia, exatamente as **3 obrigatórias**, nunca as 14 restantes. O revisor confirmou que o teste **não é tautológico**: mutou `categoryOf` para devolver sempre `obrigatoria` e as três asserções centrais falharam, como devem.

### Achados registrados, não corrigidos neste item

1. **Regra de área duplicada entre cliente e servidor.** `PatientProntuario.jsx:362-377` deriva `canCreateEvaluation`, `canCreateMealPlan` e `canEditClinicalSummary` no cliente, a partir de `equipeProfissional` e curso, sem consultar `capabilities`. **Não é brecha**: o servidor impõe a mesma regra em `avaliacoes.service.ts:637` (`assertCaseAreaEditAccess`), chamada na criação e na edição. É duplicação: duas implementações da mesma regra que podem divergir, fazendo a tela oferecer uma ação que o servidor recusa, ou esconder uma que ele permitiria. A correção coerente com o UPD-12 é o servidor projetar as capacidades **do caso** na resposta do paciente. Tratar junto de UPD-13.
2. **`src/constants/evaluationRegistry.js` está fora de qualquer fronteira atribuída** e ganhou uma camada de autorização por área/curso não commitada. Nenhum agente reivindica a autoria; o revisor não conseguiu prová-la nem descartá-la, porque o working tree não tem fronteira de commit. Arquivo a tratar como compartilhado.
3. **`src/components/Prontuario/ProximasConsultas.jsx` está órfão** — nenhum import em `src`. É o resíduo do antigo "Próximos passos". Candidato a remoção num item de limpeza.
4. **`estado.js` permanece ativo**, ao contrário do que o executor supôs: `estadoDoProntuario` ainda alimenta contagem e divergências. O que está morto é apenas `pendenciasDo`, substituída por `buildProntuarioOverview`. Não foi tocado, o que estava correto.

## UPD-15 — gráficos e tabelas

Executado por agente, revisado por agente independente. Veredito: **aprovado com ressalvas**; as ressalvas foram corrigidas na integração.

| Antes | Depois |
|---|---|
| Eixo do tempo categórico por índice: um intervalo de um dia e um de seis meses ocupavam a mesma largura. | Eixo numérico pela data real; a distância no gráfico é proporcional ao tempo decorrido. |
| **Falha de rede reescrevia os indicadores do painel para zero** — a tela afirmava zero atletas, zero fila, enquanto o aviso dizia estar exibindo a última versão. | Indicador que nunca carregou mostra `—`; falha em atualização silenciosa preserva o último valor bom. Ausência e zero deixaram de ser a mesma coisa na tela. |
| Origem e método da medida existiam no dado mas nunca apareciam. | Método (perímetros, dobras cutâneas, bioimpedância) aparece no gráfico e na tabela; métrica alimentada por métodos diferentes recebe aviso explícito. |
| Detalhes só por `hover`; nenhuma alternativa textual. | Tabela alternativa por unidade, com `aria-expanded`/`aria-controls`, ordenável e com "sem registro" explícito. Popover do calendário abre por clique e foco, fecha com `Escape`. |
| Nenhuma medida de cobertura. | Cobertura = pontos com dado ÷ **sessões elegíveis para aquela métrica**. Abaixo de 100%, é declarada. |

A separação de gráficos por unidade, que a auditoria mandou preservar, continua intacta.

`SparkLine.jsx` foi **removido**, não corrigido: estava órfão, e seu defeito era o mesmo já resolvido em `EvolucaoAnalytics` com outra arquitetura. Integrá-lo duplicaria a correção sem resolver tela alguma. O CSS órfão correspondente em `PatientProntuario.css` foi removido na integração, após confirmar que nenhum JSX o referencia.

### Ressalvas do revisor, corrigidas na integração

1. **Dois avisos de ESLint foram apresentados como pré-existentes, mas eram novos.** O revisor mostrou que `isElevatedRole` é um `useMemo` criado nesta entrega e ausente das dependências de dois hooks. Corrigido: as dependências foram completadas e o lint saiu limpo. Registro o erro de autorrelato porque ele importa mais que o aviso: um executor que classifica o próprio aviso como legado transfere dívida sem que ninguém decida.
2. **O teste de cobertura não discriminava o defeito que prometia prevenir.** Todas as fixtures usavam instrumentos com a mesma elegibilidade, então um denominador errado passaria despercebido. Acrescentei o caso que mistura, no mesmo grupo, `perimetros` (alimenta peso, não gordura) e `dobras_cutaneas` (o inverso). Provei por mutação que o teste falha quando o denominador passa a contar todas as sessões do grupo. Sem isso, um peso medido em todas as sessões possíveis apareceria como cobertura de 67% — um dado completo desacreditado por causa de outro instrumento no meio do caminho.

Evidência: `npm run test:ui` — 5 verificações de pendências e 9 de visualização. Os dois testes ficaram ligados ao projeto na integração; os agentes não podiam tocar `package.json`.

## UPD-12 (complemento) — regra de área unificada

Fecha o achado 1 do UPD-14. A regra "qual instrumento cada membro pode preencher neste caso" existia duas vezes: em `AvaliacoesService` (TypeScript, a que barra de fato) e em `evaluationRegistry.js` (JavaScript, a que a tela usava para mostrar botões). Duas implementações podem divergir; a tela oferecer o que o servidor recusa era o risco concreto.

| Antes | Depois |
|---|---|
| Mapa de áreas por tipo, normalização e cálculo de áreas do usuário privados em `avaliacoes.service.ts`. | Movidos para `server/src/auth/authorization.ts` (`AREAS_POR_TIPO_AVALIACAO`, `normalizeAreaToken`, `resolveCaseAreas`, `resolveCaseCapabilities`). O serviço de avaliações delega; a regra que barra a criação e a regra que a tela consome são a mesma função. |
| `GET /pacientes/:id` não dizia o que o usuário pode fazer naquele caso. | Devolve `capacidadesDoCaso`: vínculo, áreas, tipos editáveis, `criaAvaliacao`, `criaPlano`, `editaResumoClinico`. Gestão edita todos os tipos; supervisor revisa e edita o resumo, mas não preenche instrumento pelo aluno; sem vínculo, nada. |
| `PatientProntuario.jsx` recalculava no cliente. | Consome `capacidadesDoCaso.tiposEditaveis`. O cálculo local permanece só como reserva para resposta de API antiga. |

Evidência: 10ª verificação em `scripts/test-security-authorization.cjs` — aluno de psicologia só preenche o instrumento da própria área e não prescreve plano; supervisor não preenche pelo aluno; sem vínculo, o curso não concede nada; curso desconhecido do responsável cai em nutrição. `tsc` limpo fora do bloqueio externo; `test:security` 50 verificações.

Não tocado: `src/constants/evaluationRegistry.js`, por ser arquivo de autoria não reivindicada. As funções dele continuam existindo; deixaram de ser a fonte primária.

## UPD-13 — navegação da liga

Executado por agente. Revisor independente: **reprovado** na primeira rodada; corrigido na integração e reavaliado.

| Antes | Depois |
|---|---|
| Aluno de Ensino ou Marketing era jogado em `/admin`, num painel genérico, com a rotina de atendimento deslocada. Papéis legados `diretoria_*` idem. | Todo membro discente entra em `/aluno`. Diretoria **acrescenta** a seção "Minha diretoria" na mesma rotina; nunca troca o ambiente. |
| Navegação acadêmica com três áreas. | "Liga" mostra as quatro — Ensino, Pesquisa, Extensão e **Comunicação** — a qualquer membro. `Comunicacao.jsx` segue o padrão de `Ensino.jsx`, alimentado pelas categorias de marketing que já existiam no servidor; estado vazio diz "nenhum publicado" sem insinuar atraso. |
| Abas do `/admin` vinham de tabela fixa por papel/diretoria. | Vêm de `capabilities.liga.gerencia` e `capabilities.gestao.*`. Diretoria sozinha não abre `/admin`. |
| "Consultar ou gerenciar" dito a todos (UX-05). | Texto muda conforme quem gerencia a área. |
| Cadastro exigia supervisor e projeto de todo aluno, bloqueando quem só lê a Liga. | Participação acadêmica (nome, CPF, telefone, nascimento, matrícula, curso, período) separada da habilitação para atendimento (supervisor, projeto). |

### O que o revisor reprovou, e como ficou

1. **`coord_atendimento` não conseguia entrar em `/admin`.** O gate da rota é `allowedRoles={ADMIN_AREA_ROLES}` mais `canAccessAdmin`; esse papel não está em nenhum dos dois, era redirecionado para `/admin` e caía na trava anti-laço do `PrivateRoute` com "perfil sem área liberada". Rastreio: no último commit `ADMIN_AREA_ROLES` ainda incluía `coord_atendimento`; o working tree encontrado no início desta onda já não incluía — a porta foi fechada por trabalho anterior não commitado. O UPD-13 não a fechou, mas seu teste afirmava que ela estava aberta exercitando a função errada (`getRedirectPathFromRole`, cujo ramo para esse papel é incondicional). Correção pelo contrato, não por lista: `resolveAdminAccess` em `capabilities.js` considera papel administrativo, permissão explícita **ou capacidade de gestão projetada pelo servidor** (`gestao.pacientes` é verdadeiro para coordenação de atendimento). `AuthContext` usa essa função e o teste exercita **a mesma função**, mais o gate real do `PrivateRoute`, com e sem `capabilities` do servidor. 23 verificações.
2. **O modal de cadastro ainda barrava o envio.** Os campos de supervisor e projeto mantinham `required` nativo; sem `noValidate`, o navegador recusava o formulário antes do `handleSubmit`. Um aluno que abrisse o modal por falta de telefone ficava preso sem supervisor. O executor havia registrado como marcação visual; era bloqueio real. Corrigido: `noValidate`, campos sem `required`, rótulo "necessário para atender; não bloqueia a Liga".
3. **Escopo.** `AuthContext.jsx` aparece alterado por trabalho anterior e pelo UPD-12 (meu), não pelo executor — falha minha ao não listar isso ao revisor. `settingsModel.js` (`SETTINGS_ALLOWED_ROLES` sem presidente/vice) tem autoria não confirmada, coerente com a mudança anterior de `ADMIN_AREA_ROLES`.

### Registrado, não corrigido neste item

- `capabilities.atendimento.motivo` (`sem_vinculo`) ainda não é lido por tela nenhuma — `StudentDashboard` está fora deste item. Tratar em UPD-18.
- `ProfessorView` e `TeamPortal` não ganharam Comunicação — pertencem a UPD-17/UPD-16.
- `tests/core/` está órfão (nenhum script o executa). `roles.test.mjs` foi alinhado à regra atual; `date-utils.test.mjs` falha por depender do fuso da máquina (`00:00Z` vira dia anterior em UTC-3). Tratar em UPD-20.
- Sessão antiga sem `capabilities` continua dependendo da reserva local por papel — documentada como conservadora, não é a rota principal.

## UPD-16 — mobile e acessibilidade

Executado e revisado por agentes; as ressalvas do revisor foram fechadas por um segundo executor e conferidas por mim.

**O UX-01 já estava resolvido** por trabalho anterior não commitado: os quatro shells iniciam com o menu fechado no celular, fecham por Escape e backdrop, e um hook compartilhado marca o conteúdo como inerte, prende o foco no menu e o devolve ao botão que o abriu. A barra recolhida sai inteiramente da tela (240 px de largura, deslocamento de 260 px), então os ~78 px sobrepostos que a auditoria fotografou não existem mais. O que estava quebrado era a quinta casca, `RouteSidebarLayout` (rotas de avaliação e prescrição): qualquer redimensionamento no desktop reabria a barra que a pessoa tinha acabado de recolher.

| Antes | Depois |
|---|---|
| Na prescrição em celular, o resumo gráfico vinha antes do nome do paciente — o primeiro bloco da tela era um anel vazio. Um hack de CSS neutralizava isso por especificidade. | Ordem corrigida na origem e hack removido: paciente/status/ação → restrições → treino → refeições → total do dia → adequação → análises (recolhidas) → resumo gráfico. |
| `--pn-text-4` em 2,56:1 e `--color-text-muted` em 2,68:1 — abaixo do mínimo AA. | 5,00:1 e 4,97:1, medidos pela fórmula WCAG a partir dos arquivos, não de valores decorados. |

### O que a revisão independente pegou

1. **O fix não chegava ao prontuário.** `PatientProntuario.css` redeclarava `--pn-text-4: #94a3b8` dentro de `.pron-root`. Variável CSS resolve por escopo, então a redeclaração vencia sobre o `:root` corrigido e a tela clínica inteira continuava em 2,56:1 — e o teste **listava justamente os seletores dessa tela** como cobertos, sem nunca olhar redeclarações locais. Cobertura falsa. Redeclaração removida; o teste agora varre todo `src/**/*.css` atrás de redeclarações fora de `:root` e mede o contraste no fundo daquele escopo.
2. **A correção inverteu a hierarquia.** `text-4`, o nível mais fraco da escala, ficou mais contrastado (5,00:1) que `text-3` (4,45:1, também abaixo de AA). Quem devia ler como terciário lia mais forte que o secundário — o oposto do que a auditoria pede. Escala refeita com duas condições verificáveis ao mesmo tempo: ordem monotônica (12,79 → 7,23 → 5,58 → 5,00 sobre branco) e piso AA em todos os níveis, preservando matiz e saturação.
3. **`--color-text-muted` valia por acidente de ordem de import.** Consolidado em `theme.css`, declaração única.
4. Ponto de status sem rótulo em `TeamPortal` recebeu `role="img"` e `aria-label`, como o da lista de atletas.

Evidência: `scripts/test-acessibilidade-tokens.cjs`, 9 verificações, com prova por mutação em cópia isolada de que reintroduzir o token claro ou inverter a escala derruba o teste.

Fora do alcance desta verificação: renderização real em 320/390/768 px e leitor de tela. O contraste é calculado sobre os fundos catalogados, não sobre todo fundo possível.

## UPD-17 (servidor) — fila de revisão e devolução

Executado e revisado por agentes. Veredito: **aprovado com ressalvas**.

Quatro endpoints novos, sem migração, usando os campos JSON existentes:

| Rota | O que faz |
|---|---|
| `GET /avaliacoes/fila-revisao` | Itens aguardando decisão do usuário, no seu escopo clínico, mais antigo primeiro. |
| `GET /planos-alimentares/fila-revisao` | Idem, para planos em revisão. Mesma forma de item, para a tela juntar as duas. |
| `PATCH /avaliacoes/:id/devolver` | Devolve com observação obrigatória (5–1000). Volta a rascunho, registra autor, data e histórico. |
| `POST /planos-alimentares/:id/devolver` | Idem, com `expectedVersion` — preserva o histórico de revisões e invalida a aprovação anterior. |

Autoria e data vêm do servidor; identidade forjada no corpo não chega nem a ser parâmetro. Só vínculo de supervisão ou gestão devolve: equipe, aluno responsável e atleta não. O aluno recebe notificação sem nome de paciente nem tipo de instrumento. A fila devolve apenas identificação — nenhum campo clínico.

Evidência: `scripts/test-supervisao-fila.cjs`, 14 verificações; `test:security` com 63; `tsc` e lint limpos.

### Ressalvas registradas

1. **Violação de escopo que corrigiu um bug meu.** O executor alterou `notificacoes.service.ts`, fora da sua lista, para incluir `userId` no evento de exclusão. A causa era minha: ao reescrever o gateway no UPD-12, passei a exigir `data.userId` nos eventos de notificação, e o emissor de exclusão não o enviava — o evento morria silenciosamente para todo mundo. Mantive a correção e varri os demais emissores: `created`, `updated` e os de tarefas já estavam corretos. A violação de fronteira segue registrada como tal, mas reverter reintroduziria o defeito.
2. **Paginação depois do filtro e N+1.** A fila carrega todos os candidatos do sistema, filtra em memória e só então fatia por `limit`/`offset`; o paciente é buscado item a item, sem `In()`, apesar de os nomes dos alunos já usarem busca em lote duas linhas depois. Numa liga o volume é pequeno, mas o custo cresce com o total do sistema, não com o escopo de quem consulta. A resposta também não informa se há próxima página.
3. **Assimetria de tempo real.** Devolver avaliação emite invalidação; devolver plano não — o módulo de planos nunca teve o gateway injetado. O aluno só sabe pela notificação.
4. **`enfileiradoEm` do plano usa `updatedAt`.** Editar um plano já enfileirado o joga para o fim da fila sem novo envio. Avaliações não têm esse problema: usam `submittedAt` dedicado.

## UPD-17 (completo) — envio pelo aluno e fila na tela

Decisão do produto tomada pelo usuário: **envio opcional**. Nada passa a ser obrigatório; o aluno pede conferência quando quer.

| Antes | Depois |
|---|---|
| Só autorrelato do atleta entrava na fila. Avaliação preenchida pelo aluno no atendimento nunca chegava ao supervisor. | `PATCH /avaliacoes/:id/enviar-revisao`: o responsável ou a equipe enfileira a avaliação, com uma pergunta opcional ao supervisor. Autoria e data do servidor. |
| Tela do professor abria com seis contadores. | A fila é o primeiro bloco: avaliações e planos juntos, mais antigo primeiro, com paciente, instrumento, quem enviou, tempo de espera e a pergunta do aluno. Aprovar e devolver sem sair da fila. |
| Devolução não voltava ao aluno de forma visível. | No histórico do prontuário, a avaliação mostra quem devolveu, quando e a observação — e oferece reenvio. Se já aguarda, diz isso em vez de oferecer envio de novo. |

Quem não revisa não vê a fila; o gate é `capabilities.atendimento.revisaPlano`, não o papel.

### Dois defeitos corrigidos na integração

1. **Pedir revisão rebaixava o dado — e travaria a prescrição.** A implementação mudava o status para `rascunho` ao enviar, para que a fila (que buscava só rascunhos) enxergasse o item. O efeito colateral é clínico: o plano alimentar exige avaliação `finalizada` para ler as metas do gasto energético (`plano-alimentar.service.ts:376`). Um aluno que finalizasse o GET e pedisse conferência veria a prescrição travar com "paciente ainda não possui GET cadastrado" — por ter pedido ajuda. Corrigido pela causa: **quem enfileira é a flag, não o status**. O envio preserva o status, e a fila passou a selecionar por `meta.aguardandoRevisao`. Em `devolver()` o rebaixamento **permanece** e está certo: ali o supervisor apontou defeito, e o dado não deve alimentar prescrição até ser corrigido.
2. **A rota de retorno apontava o registro errado.** A fila devolvia `/avaliacao/{id da avaliação}`, mas essa rota resolve o parâmetro como **paciente** (`AvaliacaoCompleta.jsx`: `const id = pacienteId || params.id`). Abriria o paciente errado, ou nenhum. O executor da tela contornou no cliente; corrigi na origem, no servidor, e alinhei as asserções dos dois testes, que fixavam a rota errada.

Evidência: `scripts/test-supervisao-envio.cjs` (12) e `test-supervisao-fila.cjs` (14); `test:security` 68; núcleo e `test:ui` sem regressão; `tsc` e lint limpos.

### Registrado, não corrigido

- **Custo da fila** (decisão do usuário: tratar depois): carrega os candidatos e só então pagina, e busca paciente item a item sem busca em lote. Agora que a seleção é pela flag e não pelo status, a varredura cobre todas as avaliações não excluídas — o diagnóstico continua o mesmo e a dívida ficou um pouco maior.
- A tela busca cada avaliação da fila individualmente para exibir a pergunta do envio, porque `findFilaRevisao` não devolve esse campo.
- Voltar da avaliação à fila exige dois passos; o caminho de volta de `AvaliacaoCompleta` estava fora da fronteira.
- Aprovar plano com composição manual pendente ainda exige abrir a prescrição — o servidor pede confirmação profissional explícita, e forçá-la na fila puluaria essa conferência.

## UPD-18 — contexto e preenchimento

Três frentes com fronteiras disjuntas, executadas em paralelo.

### Contexto na navegação (UX-07)

| Antes | Depois |
|---|---|
| Área e aba viviam em `useState` nos shells do aluno, professor, equipe e atleta. Vários cliques mantinham a URL em `/aluno`. Atualizar a página, voltar no navegador ou compartilhar o endereço perdia o lugar. | Área na query string nos quatro shells, pelo mesmo padrão `useSearchParams` que a área administrativa já usava, extraído para `src/hooks/useAreaNavegacao.js`. F5 reabre onde estava; voltar desfaz a última troca de área. |
| — | Área que o perfil não pode ver não é aceita nem vinda pela URL; valor inválido cai no padrão sem erro e sem laço de redirecionamento. |

Evidência: `scripts/test-contexto-navegacao.cjs`, 11 verificações.

### Proteção de edição não salva

Dois cenários que a auditoria manda separar, e estavam ambos descobertos:

| Situação | Depois |
|---|---|
| **Abandono deliberado** — fechar a aba ou sair da tela com edição pendente. | Confirmação antes de sair, na avaliação e na prescrição. Sem edição pendente não há diálogo — falso alarme treina a pessoa a ignorar aviso. |
| **Sessão expirada** — o token vence, a aplicação redireciona ao login e leva junto o que foi digitado. Ninguém escolheu sair. | No instante do evento de sessão expirada (disparado antes do redirecionamento), a edição pendente é gravada como rascunho local. Ao reabrir a mesma tela, um aviso oferece recuperar ou descartar — **nunca aplica sozinho**. |

Rascunho local é dado clínico num computador possivelmente compartilhado. O isolamento foi a exigência inegociável e está verificado: a chave é `laines:rascunho:<tela>:<usuário>:<registro>`; faltando qualquer parte, não há persistência; e a leitura **reconfere** usuário e registro dentro do conteúdo, como defesa em profundidade. Executei a função real: contas distintas produzem chaves distintas, e sem usuário o resultado é nulo. Salvar com sucesso limpa o rascunho; armazenamento indisponível não derruba a tela.

**Bug adicional encontrado e corrigido pelo caminho:** o salvamento automático não limpava o rascunho ao concluir — só o salvamento manual limpava. Um rascunho obsoleto reapareceria depois como "recuperar" e poderia sobrescrever uma edição mais nova por uma mais velha.

Evidência: `scripts/test-edicao-pendente.cjs`, 15 verificações, com prova por mutação de que o teste falha se a chave deixar de distinguir usuários.

**Nota de processo:** esta frente foi interrompida por limite de uso no meio de uma edição e deixou o projeto com seis erros de lint — quatro funções órfãs (a lógica de recuperação existia, o aviso que a usaria não tinha sido renderizado) e uma atualização de referência durante a renderização. A conferência do estado do disco antes de relançar é o que impediu isso de ficar no projeto; a execução seguinte recebeu o diagnóstico com arquivo e linha.

### Contexto do vínculo e recadastro

| Antes | Depois |
|---|---|
| Quem não podia atender via "Nenhum atleta vinculado ainda" — igual a quem podia atender e ainda não cadastrou ninguém. Falha de rede caía no mesmo texto. | Quatro estados distintos: habilitação pendente (com o caminho: supervisor e projeto, procure a coordenação), perfil que não atende (a área não se oferece), vazio legítimo, e erro de carregamento com opção de tentar de novo. Precedência testada: erro de rede nunca vira "sem vínculo". |
| O assistente do atleta abria em branco mesmo quando o cadastro já tinha telefone, cidade, estado, nascimento, frequência e modalidade. | Campos vêm preenchidos do que já existe, dizendo a origem e a data, e continuam editáveis. Nada digitado na sessão é sobrescrito. |

Isso fecha a pendência que o UPD-13 deixou registrada: `capabilities.atendimento.motivo` existia desde o UPD-12 e nenhuma tela o lia.

Evidência: `scripts/test-vinculo-atendimento.cjs`, 10 verificações, com prova por mutação de que os estados não colapsam.

**Decisão do executor que merece registro:** ele **não** preencheu o campo de sexo biológico automaticamente, embora houvesse um valor disponível. O motivo é correto — o único campo acessível ao atleta (`genero`) é ambíguo: pode ser sexo biológico, se veio deste mesmo assistente, ou identidade de gênero, se veio da inscrição pública. Como o campo alimenta fórmula clínica, deixar em branco é melhor que herdar um valor com significado errado.

### Defeito encontrado na junção das frentes, corrigido por mim

O assistente do atleta exibe o rótulo **"Sexo biológico"**, mas gravava o valor no campo `genero` — nunca em `sexoBiologico`. O servidor só preenche `sexoBiologico` quando o cliente envia esse campo.

O efeito atravessa duas ondas: a referência nutricional do UPD-11 lê `paciente.sexoBiologico`. Uma atleta que respondesse "feminino" no assistente continuava sem referência DRI, com a tela dizendo "sexo biológico não informado no cadastro" — logo depois de ela o ter informado. Pior que ausência: contradiz o que a pessoa acabou de fazer.

Corrigido no envio do assistente, que agora grava o campo clinicamente correto; identidade de gênero permanece em campo próprio, com outro significado. Teste de ponta a ponta acrescentado em `test-prescription-contract.cjs` (14): `genero` sozinho **não** produz referência — porque de fato não é sexo biológico — e `sexoBiologico` produz, com o valor de ferro correto para mulher adulta.

**Não corrigido:** pacientes que já passaram pelo assistente antes desta correção têm `sexoBiologico` vazio no banco. Preencher exigiria migração de dados e uma decisão sobre inferir do campo ambíguo — fica para a homologação (UPD-21), com o diagnóstico registrado aqui.

## Onda 2 — fechamento

Todos os itens com evidência local registrada: UPD-11, 12, 13, 14, 15, 16, 17 e 18.

Suítes ligadas ao projeto e passando: `npm run test:security` (82 verificações), `npm run test:ui` (82), `node scripts/run-core-tests.mjs` (101), `tsc` do servidor limpo.

Verificação local não é homologação. Continuam pendentes por natureza: renderização real em 320/390/768 px, leitor de tela, banco populado, CI em revisão imutável e a homologação integrada do UPD-21.
