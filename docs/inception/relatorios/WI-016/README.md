# WI-016 — Relatórios: números confiáveis, perfil dos atletas e produção da liga

@work-item-id WI-016

## Intenção de mudança

A análise de 02/10/2026 (`docs/implementacao/relatorios-v2/analise.md`) mostrou que o módulo de Relatórios exibe números que enganam:
- **a meta trimestral é tautológica:** `meta = max(realizado, 10)` fica sempre "atingida";
- **a tendência é fixa em "alta"**;
- **ausência vira 0**;
- **o filtro de período** muda só 1 de cerca de 10 números;
- **a exportação ignora o período**;
- **a aba aparece para quem recebe 403.**

O usuário pediu para trabalhar exclusivamente na melhora do módulo.

**Público definido pelo usuário:** direção da liga, prestação de contas e equipe de atendimento.
**Prioridades:** números confiáveis, perfil dos atletas atendidos e produção da liga.

## Decisões do usuário (02/10/2026)
1. **Meta trimestral:** sai. O relatório mostra só o realizado até a direção definir uma meta real.
2. **Perfil agregado dos atletas:** visível para coordenação/admin, presidência e vice com relatórios, e coordenação de atendimento. Sempre agregado, nunca por pessoa.
3. **Grupo mínimo de 5 pessoas:** abaixo disso, o número não aparece e fica "grupo pequeno demais".
4. **Aba Relatórios só para quem pode usar:** quem não tem o acesso dos dados deixa de ver a aba. Ninguém ganha acesso novo.
5. **A frente de tarefas** (`docs/inception/tarefas-equipe/WI-014`) ainda vai mexer nos Relatórios. O painel de tarefas (`TaskPerformancePanel.jsx`, `/tarefas/relatorio`) e os arquivos dela ficam fora. Em `ReportsPage.jsx`, que é compartilhado, cada gravação confere o hash antes.

## Etapas

### 1. Números confiáveis
- **Período explícito:** os indicadores ficam separados em "Situação atual" (estoque: alunos, atletas e vínculos) e "No período" (fluxo: avaliações, atendimentos, novos atletas e retornos). Todos os indicadores de fluxo, o uso por tipo e o trimestral respeitam o período.
- **Datas e trimestres** em `America/Sao_Paulo`.
- **Sem meta trimestral.**
- **Tendência:** só nos indicadores de fluxo, comparando com o período anterior de mesmo tamanho. Sem base de comparação, não há seta.
- **Ausência aparece como "—",** não 0.
- **A exportação detalhada respeita o período e o projeto.**
- **Definições estáveis:** "Total de alunos" e "Professores" não mudam de sentido conforme o projeto filtrado. A definição fica escrita.
- **Drivers e correlações:** o n aparece em todo destaque. Abaixo de 5, não entra nos destaques.
- **Interruptor de privacidade honesto:** o rótulo diz o que ele faz. Para quem não é admin, a privacidade fica sempre ligada, e a tela diz isso.
- **Aba Relatórios** liberada pela mesma capacidade que os endpoints exigem.

### 2. Perfil dos atletas atendidos (novo)
Atletas com avaliação finalizada no período, sempre agregados, com mínimo de 5 por grupo:
- **Quem são:** modalidades, sexo e faixa etária.
- **Composição corporal:** faixas de % de gordura por sexo, da avaliação de composição mais recente de cada atleta, dizendo o método.
- **Disponibilidade energética:** adequada, reduzida ou baixa.
- **Insegurança alimentar (EBIA):** segurança, leve, moderada ou grave.
- **Outros:** padrão NOVA e hidratação, se houver dado.

Cada número vem com o denominador ("n atletas com essa avaliação"). Nenhuma lista de pessoas e nenhum dado individual.

### 3. Produção da liga (novo)
No período, por área:
- **Ensino:** reuniões e materiais.
- **Extensão:** capacitações, materiais e triagens públicas recebidas.
- **Comunicação:** comunicados e materiais.
- **Pesquisa:** projetos ativos, produções por situação e ideias.

### 4. Organização da tela
As seções seguem o público: resumo para a direção, atendimento, perfil dos atletas e produção da liga. Os drivers ficam como análise de apoio, e a exportação continua.

## Não objetivos
- O painel de tarefas, da outra frente.
- Dados individuais de atletas nos relatórios.
- Metas novas: a direção define depois.
- Mudança no banco real e deploy.
- Ampliar o acesso de qualquer papel.

## Invariantes
- **O servidor** continua decidindo o acesso. O perfil clínico agregado tem capacidade própria, restrita ao público da decisão 2.
- **Supressão de grupos:** nenhum agregado clínico com n entre 1 e 4 sai do servidor. A supressão é no servidor, não só na tela.
- **Escopo por projeto** (`analyticsProjectScope`) preservado.
- **Nenhum dado real** em teste.

## Verificação
- Specs do servidor para período, tendência, ausência, exportação, supressão k ≥ 5 e acesso.
- Testes de cliente para os cartões.
- ESLint e `tsc` nos arquivos tocados.
- **Quando a máquina for liberada:** navegador com dados sintéticos e revisão independente.

## Rollback
Os backups estão em `tmp/wi016-v1/`, nos mesmos caminhos. Os endpoints novos são aditivos.

## Andamento (12/10/2026)

### Etapa 1 — números confiáveis: gravada
- Período em calendário de Brasília em todos os indicadores de fluxo, com "Situação atual" separada de "No período"; sem meta trimestral; tendência só nos indicadores de fluxo, contra o período anterior de mesmo tamanho; "—" no lugar de 0; exportação recortada pelo período; destaques só com n ≥ 5.
- Verificado pelo executor: spec 16/16, `tsc` e ESLint limpos, mutação 10/10; `roles.test` 10/10 e `test-sidebar-modelo` 40/40.
- **Hashes novos dos arquivos compartilhados:** `ReportsPage.jsx` `dd346ee4eb78`, `ReportsPage.css` `0334012cf458`. A frente de tarefas deve partir deles.

### Etapas 2 e 3 — perfil dos atletas e produção da liga: endpoints e painéis prontos, ainda não ligados
- `GET /analytics/reports/perfil-atletas` (supressão k ≥ 5 no servidor, sem id nem nome) e `GET /analytics/reports/producao`.
- Verificado: specs 23/23, `tsc` e ESLint limpos, `test-security-authorization` 15/15; mutação 21/21 no servidor e 8/8 no cliente.
- Conferido pelo orquestrador: a regra `canAccessAthleteProfileAggregates` (admin, coordenação, `coord_atendimento`, presidente e vice com relatórios) e que a consulta de pacientes só pede id, nascimento, sexo e modalidade.

### Pendente de decisão
1. A aba Relatórios passou a exigir `relatorios.exportacao`. Perdem a aba: alunos de diretoria (Ensino, Extensão, Pesquisa) e quem só tem permissões avulsas. Efeito no WI-015: eles voltam a entrar por `/admin` e perdem a seção "Direção".
2. `coord_atendimento` recebe o perfil dos atletas, mas não vê a aba Relatórios.
3. `scripts/test-navegacao-liga.cjs` e `scripts/test-contexto-navegacao.cjs` falham com a regra nova; correção pronta, depende da decisão 1.
4. O fim do período da etapa 1 é "hoje"; o da etapa 2/3 é o fim do mês.

### Fechamento (12/10/2026)
- Decisões aplicadas: aba Relatórios por `exportacao || perfilAtletas` (só `coord_atendimento` ganha a aba, vendo só o Perfil; alunos de diretoria só com o painel perdem a aba e voltam a `/admin`); Perfil e Produção terminam hoje, via `resolveReportPeriods`; painéis integrados em `ReportsPage.jsx` (hash `915ffc25772d`).
- Specs de analytics 42/42, `roles.test` 11/11, testes de navegação e `test-security-authorization` passando; `tsc` e ESLint limpos. **Sem verificação em navegador.**
- Pendências: tarefas ainda vão até o fim do mês (`tarefas-report.service.ts:77-84`, outra frente); `coord_atendimento` sem projeto recebe 403 no Perfil; URL direta sem capacidade mostra só o cabeçalho; falta documento de produto em `docs/product/`.
