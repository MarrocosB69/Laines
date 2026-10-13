# Change Intent — "Visão geral" padronizada nos cinco portais

Data: 26/09/2026. O usuário pediu para organizar a aba "Visão geral" de todos os perfis, bem organizada, padronizada e com padrão visual coerente com a primeira página. A execução começa depois de encerradas as sidebars (`docs/implementacao/sidebars-v2/`), porque as duas frentes mexem no modelo de navegação. O commit fica com o usuário.

## Decisões do usuário (26/09/2026)

1. **Estrutura de quatro blocos fixos nos cinco portais**, na ordem abaixo, seguida pelo bloco específico do papel:
   1. **Cabeçalho:** saudação, papel e data.
   2. **Faixa de indicadores:** de 3 a 4 números.
   3. **"O que precisa de você":** pendências, revisões e tarefas.
   4. **Agenda próxima.**
2. **Equipe técnica e atleta ganham uma Visão geral**, que passa a ser a aba inicial desses dois portais. Hoje eles começam em "Meus Atletas" e "Pendências".

## Estado de hoje (inventário de 26/09/2026)

| Portal | Componente | Blocos | Dados |
|---|---|---|---|
| Admin | `src/views/admin/.../DashboardStats.jsx` (1.110 linhas) com `DashboardStats.css` (1.239) | saudação, pulso (hoje, fila), KPIs, quadro operacional, atividades, tarefas, calendário, insights | `GET /analytics/dashboard/summary`, `/tarefas`, `/analytics/dashboard/operational-board` |
| Aluno | `StudentDashboard.jsx` (498) com `StudentDashboard.css` (737) | saudação, calendário, próximas ações, atletas | `GET /agendamentos` |
| Professor | `ProfessorDashboard.jsx` (997) com `ProfessorView.css` (872) | supervisionados, pacientes, fila de revisão, avaliações, agenda | `GET /avaliacoes`, `/users/meus-supervisionados`, `/agendamentos` |
| Equipe | não existe (primeira aba: atletas, em `TeamPortal.jsx`) | — | `GET /pacientes`; avaliações e agenda por atleta selecionado |
| Atleta | não existe (primeira aba: pendências, em `AthletePortal.jsx`) | — | `GET /pacientes`, `/avaliacoes`, `/agendamentos` |

Todos usam Inter e Poppins, fora do padrão da landing.

## Comportamento esperado

- **Peças compartilhadas** em `src/components/painel/` (cabeçalho, faixa de indicadores, seção com título e ação, lista, estados de carregando, vazio e erro), com o visual da landing: tokens `--lt-*`, par Sofia Sans, voz de campanha nos títulos, alvos de 44 px ou mais e contraste de 4,5:1 ou mais.
- **Admin, aluno e professor:** o mesmo conteúdo de hoje, reorganizado nos quatro blocos mais o bloco do papel, com as peças compartilhadas.
- **Equipe e atleta:** Visão geral nova montada **só com os dados que esses portais já carregam**, sem endpoint novo e sem ampliar o que cada perfil vê. Se um número desejado exigir uma chamada nova, ele fica de fora e isso é relatado.

## Invariantes

1. **Mesmos dados.** Os endpoints, os parâmetros e os cálculos dos painéis de admin, aluno e professor não mudam. Um número que aparece hoje continua com o mesmo valor.
2. **Nenhum dado a mais.** Equipe e atleta veem na Visão geral só o que já veem nas próprias telas.
3. **Navegação.** A nova aba inicial de equipe e atleta entra no modelo de sidebar (`src/navigation/sidebarModel.js`) e no teste de paridade, como decisão do usuário. As outras abas desses portais continuam iguais.
4. **Layout e tipografia.** Nada cortado e nenhuma rolagem horizontal a 1280 e 390 px. Só as duas famílias Sofia.

## Donos (a confirmar ao abrir a frente)

- **Agente A:** peças compartilhadas e o CSS delas, com o contrato da interface definido antes pelo orquestrador.
- **Agente B:** Visões gerais de admin e professor.
- **Agente C:** Visões gerais de aluno, equipe e atleta, mais a entrada nova no modelo de navegação.

A verificação em navegador fica numa rodada única do orquestrador, com API sintética. Depois vem a revisão independente.
