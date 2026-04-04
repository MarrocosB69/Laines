# Plano de Testes E2E — LAINES App
> Playwright 1.58.2 · Base URL: `http://127.0.0.1:4173` · Diretório: `tests/browser/`

---

## Visão geral

| Dimensão | Detalhe |
|---|---|
| Framework | Playwright 1.58.2 |
| Config | `playwright.readiness.config.mjs` |
| Test dir | `tests/browser/*.spec.js` |
| Browsers | Chromium Desktop, Firefox Desktop, WebKit Desktop, Mobile Chrome (Pixel 7), Mobile Safari (iPhone 14) |
| Paralelismo | Desabilitado (`fullyParallel: false`) |
| Timeout por teste | 60 s |
| Timeout de asserção | 10 s |
| Artefatos | `e2e-artifacts/playwright-readiness.json` + trace/screenshot/video em falha |

---

## Variáveis de ambiente necessárias

```env
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173   # URL do preview build
E2E_ADMIN_EMAIL=admin@laines.ufrn.br        # Usuário role=admin
E2E_ADMIN_PASSWORD=senha_admin

E2E_PROF_EMAIL=prof@laines.ufrn.br          # Usuário role=professor
E2E_PROF_PASSWORD=senha_prof

E2E_ALUNO_EMAIL=aluno@laines.ufrn.br        # Usuário role=aluno
E2E_ALUNO_PASSWORD=senha_aluno

E2E_TECNICO_EMAIL=tecnico@laines.ufrn.br    # Usuário role=tecnico
E2E_TECNICO_PASSWORD=senha_tecnico

E2E_ATLETA_EMAIL=atleta@laines.ufrn.br      # Usuário role=atleta
E2E_ATLETA_PASSWORD=senha_atleta
```

> Os seeds de CI já existem via `npm run seed:e2e` e `npm run seed:ci:users`.

---

## Estrutura de arquivos proposta

```
tests/
  browser/
    readiness.spec.js          ← já existe (login/logout/teclado/responsive)
    auth.spec.js               ← autenticação completa
    rbac.spec.js               ← controle de acesso por papel
    admin-users.spec.js        ← CRUD de usuários (admin)
    admin-patients.spec.js     ← gestão de pacientes (admin/prof)
    admin-scheduling.spec.js   ← agendamentos (admin)
    admin-dashboard.spec.js    ← dashboard admin (KPIs, tarefas, calendário)
    professor-dashboard.spec.js← dashboard professor
    student-dashboard.spec.js  ← dashboard aluno
    avaliacao-completa.spec.js ← fluxo de avaliação (abrir, editar, finalizar)
    prontuario.spec.js         ← prontuário do paciente (6 abas)
    reports.spec.js            ← relatórios e exportação
    fixtures/
      auth.fixture.js          ← storageState por papel
```

---

## Fixtures de autenticação

Cada suite que exige login deve usar `storageState` pré-salvo para evitar login repetido.

```js
// tests/browser/fixtures/auth.fixture.js
import { test as base } from '@playwright/test';
import path from 'path';

export const test = base.extend({
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: 'e2e-artifacts/auth-admin.json' });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
  profPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: 'e2e-artifacts/auth-prof.json' });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
  alunoPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: 'e2e-artifacts/auth-aluno.json' });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  }
});
```

> `globalSetup` em `playwright.readiness.config.mjs` deve fazer login de cada papel e salvar `storageState` em `e2e-artifacts/auth-*.json` antes das suites rodarem.

---

---

# SUITE 1 — `auth.spec.js` · Autenticação

## Tela: `/login`

**Seletores:**
```
input[placeholder="usuario@laines.ufrn.br"]   → campo e-mail/CPF
input[autocomplete="current-password"]         → campo senha
button[role="button"] /entrar agora|entrando/i → botão submit
.landing-error                                 → mensagem de erro
```

| # | Caso de teste | Asserção esperada |
|---|---|---|
| A-01 | Login com e-mail válido (admin) | Redireciona para `/admin` |
| A-02 | Login com e-mail válido (professor) | Redireciona para `/professor` |
| A-03 | Login com e-mail válido (aluno) | Redireciona para `/aluno` |
| A-04 | Login com e-mail válido (tecnico) | Redireciona para `/equipe` |
| A-05 | Login com e-mail válido (atleta) | Redireciona para `/atleta` |
| A-06 | Senha incorreta | `.landing-error` visível, contém `/credenciais\|inválid/i` |
| A-07 | Campos vazios ao submeter | Botão não dispara ou erro visível |
| A-08 | Toggle mostrar/ocultar senha | `input[type]` alterna entre `password` e `text` |
| A-09 | Logout (sidebar button) | Redireciona para `/login`, storageState limpo |
| A-10 | Acesso direto a `/admin` sem autenticação | Redireciona para `/login` |
| A-11 | Acesso direto a `/professor` sem autenticação | Redireciona para `/login` |
| A-12 | Redirecionamento pós-login preserva rota original | URL inicial mantida após login |

**Tela: Modal "Solicitar acesso"**

| # | Caso de teste | Asserção esperada |
|---|---|---|
| A-13 | Abrir modal "Solicitar acesso" | Modal visível, focus trap ativo |
| A-14 | Fechar modal com Escape | Modal fecha |
| A-15 | Fechar modal com botão Cancelar | Modal fecha |
| A-16 | Submeter com campos obrigatórios vazios | Campos em estado de erro |
| A-17 | Submeter formulário válido (Professor) | Mensagem de sucesso / confirmação |

---

# SUITE 2 — `rbac.spec.js` · Controle de acesso por papel

| # | Papel tentando | Rota acessada | Resultado esperado |
|---|---|---|---|
| R-01 | aluno | `/admin` | Redireciona para `/aluno` ou `/login` |
| R-02 | aluno | `/professor` | Redireciona para `/aluno` ou `/login` |
| R-03 | professor | `/admin` | Redireciona para `/professor` |
| R-04 | professor | `/aluno` | Redireciona para `/professor` |
| R-05 | tecnico | `/admin` | Redireciona ou 403 |
| R-06 | atleta | `/admin` | Redireciona ou 403 |
| R-07 | admin | `/avaliacao/:id` | Acesso permitido |
| R-08 | aluno | `/avaliacao/:id` (paciente vinculado) | Acesso permitido |
| R-09 | aluno | `/avaliacao/:id` (paciente não vinculado) | Acesso negado ou redirect |
| R-10 | Sem autenticação | `/avaliacao/:id` | Redirect para `/login` |

---

# SUITE 3 — `admin-users.spec.js` · Gestão de usuários (Admin)

## Tela: Admin → Cadastros → Usuários

**Seletores:**
```
.admin-search-input[placeholder*="Buscar"]    → busca de usuários
button contendo UserPlus icon                 → "Novo usuário"
.admin-management-table                       → tabela
.role-btn                                     → seletores de papel no modal
#user-nome, #user-cpf, #user-data-nascimento  → campos comuns
.app-modal-btn--primary                       → "Criar acesso" / "Salvar"
.app-modal-btn--secondary                     → "Cancelar"
```

| # | Caso de teste | Passos resumidos | Asserção |
|---|---|---|---|
| U-01 | Criar aluno | Preencher nome, CPF, data nasc, matrícula, período, supervisor, curso, projeto → Salvar | Linha aparece na tabela |
| U-02 | Criar professor | Selecionar papel Docente → funcao=Professor → matrícula professor → Salvar | Linha na tabela |
| U-03 | Criar profissional | Selecionar papel Docente → funcao=Profissional → conselho CRN → número → Salvar | Linha na tabela |
| U-04 | Criar técnico (Equipe) | Selecionar papel Equipe → Salvar | Linha na tabela |
| U-05 | Criar atleta | Selecionar papel Atleta → Salvar | Linha na tabela |
| U-06 | Criar coordenação | Selecionar papel Coordenação → Salvar | Linha na tabela |
| U-07 | Campos role=aluno: supervisor obrigatório | Tentar salvar sem supervisor | Campo em erro |
| U-08 | E-mail gerado automaticamente | Criar usuário → campo e-mail readonly gerado | Valor visível |
| U-09 | CPF com formatação automática | Digitar 11 dígitos → campo exibe máscara | Formato `000.000.000-00` |
| U-10 | Editar usuário existente | Clicar edit → alterar nome → Salvar | Nome atualizado na tabela |
| U-11 | Excluir usuário | Clicar delete → confirmar | Linha removida da tabela |
| U-12 | Buscar usuário por nome | Digitar parcial do nome | Tabela filtrada |
| U-13 | Trocar papel no modal (aluno → professor) | Campos de aluno somem, campos de professor aparecem | Visibilidade condicional |
| U-14 | Cancelar modal com dados preenchidos | Fechar → reabrir | Dados limpos |
| U-15 | Paginação "Carregar mais" | Lista > 25 → botão visível → clicar | Novos itens carregados |

---

# SUITE 4 — `admin-patients.spec.js` · Gestão de pacientes

## Tela: Admin/Professor → Pacientes

**Seletores:**
```
.admin-search-input[placeholder*="nome ou modalidade"]  → busca
button contendo UserPlus icon                           → "Novo Paciente"
button contendo Link2 icon                              → "Vincular"
#patients-filter-status                                 → filtro status
#patients-filter-project                                → filtro projeto
.admin-management-table                                 → tabela
button contendo Eye icon (por linha)                    → "Visualizar"
button contendo Edit icon (por linha)                   → "Editar"
button contendo Trash2 icon (por linha)                 → "Excluir"
```

| # | Caso de teste | Asserção |
|---|---|---|
| P-01 | Listar pacientes (admin) | Tabela visível, colunas corretas |
| P-02 | Busca por nome parcial | Linhas filtradas |
| P-03 | Busca por modalidade | Linhas filtradas |
| P-04 | Filtro por status "Em Atendimento" | Apenas pacientes com esse status |
| P-05 | Filtro por projeto | Apenas pacientes do projeto |
| P-06 | Criar novo paciente | Preencher campos → Salvar → linha na tabela |
| P-07 | Editar paciente | Alterar telefone → Salvar → dado atualizado |
| P-08 | Excluir paciente | Confirmar deleção → linha removida |
| P-09 | Visualizar prontuário via Eye | Navega para prontuário do paciente |
| P-10 | Vincular paciente a aluno | Selecionar paciente → Vincular → escolher aluno | Vínculo criado |
| P-11 | Cards estatísticos batem com tabela | Contagem de "Total" = linhas visíveis | Valores consistentes |
| P-12 | Exportar CSV (Relatório) | Download disparado | Arquivo `.csv` baixado |
| P-13 | Paginação incremental (25 por página) | Lista > 25 → "Carregar mais" visível → clicar | Itens adicionais carregados |
| P-14 | Professor vê apenas seus pacientes | Logar como professor → lista restrita | Pacientes vinculados ao professor |

---

# SUITE 5 — `admin-scheduling.spec.js` · Agendamentos

## Tela: Admin → Agendamentos

| # | Caso de teste | Asserção |
|---|---|---|
| S-01 | Listar agendamentos | Tabela ou calendário carrega |
| S-02 | Criar novo agendamento | Preencher paciente, data, hora, profissional → Salvar | Item na lista |
| S-03 | Editar agendamento (remarcar) | Alterar data/hora → Salvar | Data atualizada |
| S-04 | Cancelar agendamento | Ação cancelar → status atualizado | Status "Cancelado" |
| S-05 | Filtro por data | Selecionar intervalo | Agendamentos filtrados |
| S-06 | Filtro por profissional | Selecionar profissional | Agendamentos filtrados |

---

# SUITE 6 — `admin-dashboard.spec.js` · Dashboard Admin

## Tela: `/admin`

**Seletores:**
```
.dashboard-greeting          → saudação com nome
.kpi-section                 → cards KPI
.recent-section              → atividades recentes
.tasks-section               → seção tarefas
.calendar-section            → calendário
.insights-section            → insights operacionais
input[placeholder="Nova tarefa..."]  → campo nova tarefa
```

| # | Caso de teste | Asserção |
|---|---|---|
| D-01 | KPI cards carregam com valores numéricos | 4 cards visíveis, valores não são "—" |
| D-02 | Saudação personalizada | "Olá, {primeiroNome}" visível |
| D-03 | Feed de atividades recentes carrega | Lista `.activity-item` visível |
| D-04 | Criar tarefa nova | Digitar título → selecionar papel → Adicionar | Item aparece na lista |
| D-05 | Alterar status de tarefa | Clicar toggle → status muda | Badge de status atualizado |
| D-06 | Filtro de tarefas por status | Clicar "Pendentes" | Apenas tarefas pendentes visíveis |
| D-07 | Busca de tarefas | Digitar parte do título | Lista filtrada |
| D-08 | Calendário: navegar mês anterior | Clicar botão "anterior" | Mês decrementado |
| D-09 | Calendário: navegar próximo mês | Clicar botão "próximo" | Mês incrementado |
| D-10 | Calendário: tooltip ao passar em dia com evento | Hover em data marcada | Tooltip com detalhes |
| D-11 | Cards de insights carregam (5 cards) | % e contagens visíveis | Sem placeholders vazios |
| D-12 | Pulse cards (4) no topo | "Hoje", "Próximos 7 dias", "Conclusão", "Fila" | Valores numéricos |

---

# SUITE 7 — `professor-dashboard.spec.js` · Dashboard Professor

## Tela: `/professor`

| # | Caso de teste | Asserção |
|---|---|---|
| PD-01 | Lista de pacientes vinculados carrega | Cards ou lista visíveis |
| PD-02 | Busca de paciente por nome | Resultado filtrado |
| PD-03 | Toggle visualização Cards / Lista | View alterna |
| PD-04 | Calendário do professor carrega | Meses e dias visíveis |
| PD-05 | Clicar em paciente — navega para prontuário | URL muda para prontuário |
| PD-06 | "Próxima ação" exibe consulta futura | Card com data/hora do paciente |

---

# SUITE 8 — `student-dashboard.spec.js` · Dashboard Aluno

## Tela: `/aluno`

| # | Caso de teste | Asserção |
|---|---|---|
| SD-01 | Lista de pacientes do aluno carrega | Pacientes vinculados visíveis |
| SD-02 | Busca por nome filtra lista | Resultado filtrado |
| SD-03 | Toggle Cards/Lista | View alterna |
| SD-04 | Clicar paciente → prontuário | URL muda |
| SD-05 | Calendário carrega | Widget visível |
| SD-06 | Agenda "Próxima ação" carrega | Card visível (consulta ou "Agenda livre") |

---

# SUITE 9 — `prontuario.spec.js` · Prontuário do paciente

## Tela: `/avaliacao/:id` (PatientProntuario — 6 abas)

**Seletores:**
```
.prontuario-tab[data-tab="visao-geral"]          → Visão geral
.prontuario-tab[data-tab="avaliações"]           → Avaliações
.prontuario-tab[data-tab="agendamentos"]         → Agendamentos
.prontuario-tab[data-tab="historico"]            → Histórico
.prontuario-tab[data-tab="documentos"]           → Documentos
.prontuario-tab[data-tab="vinculo"]              → Vínculo
```

| # | Caso de teste | Asserção |
|---|---|---|
| PR-01 | Aba Visão Geral carrega | 8 sinais clínicos visíveis (prontuárioSignals) |
| PR-02 | Sinais com valor 0 exibem "—" | Sem "0" literal nos cards |
| PR-03 | Aba Avaliações carrega | Lista de avaliações visível |
| PR-04 | Aba Agendamentos carrega | Lista de consultas visível |
| PR-05 | Aba Histórico carrega | Histórico de ações visível |
| PR-06 | Aba Documentos carrega | Área de documentos visível |
| PR-07 | Aba Vínculo carrega | Info de vínculo aluno-paciente |
| PR-08 | Navegar entre abas | URL ou estado atualizado sem erro |

---

# SUITE 10 — `avaliacao-completa.spec.js` · Formulários de avaliação

## Tela: AvaliacaoCompleta (14 módulos)

**Seletores:**
```
.eval-card                             → card base de cada formulário
.eval-card--readonly                   → modo leitura (stripe diagonal visível)
.eval-results-section                  → seção de resultados calculados
.eval-field--critical .eval-input      → campo crítico (borda 1.5px)
.eval-status-badge                     → badge de status da avaliação
.eval-status-badge--finalizada         → badge verde finalizada
.eval-status-badge--andamento          → badge laranja em andamento
.eval-status-badge--leitura            → badge cinza somente leitura
```

**Módulos a cobrir:**

| Módulo | Domínio | Campos críticos |
|---|---|---|
| Anamnese Inicial | Anamnese (índigo) | — |
| Avaliação Clínica | Clínica (rose) | PA sistólica, PA diastólica |
| Bioimpedância | Antropometria (teal) | % Gordura, Peso kg, Massa Magra |
| Dobras Cutâneas | Antropometria (teal) | Peso kg, Estatura cm |
| Perimetros Corporais | Antropometria (teal) | — |
| Composição Corporal | Antropometria (teal) | — |
| Gasto Energético | Antropometria (teal) | — |
| Avaliação Alimentar | Nutrição (green) | — |
| Avaliação Hidratação | Nutrição (green) | — |
| Exames Laboratoriais | Clínica (rose) | — |
| Avaliação Psicologia | Multiprofissional (purple) | — |
| Avaliação Fisioterapia | Multiprofissional (purple) | — |
| Avaliação Socioeconômica | Social (amber) | — |
| Evolução/Retorno | Multiprofissional (purple) | — |

| # | Caso de teste | Asserção |
|---|---|---|
| AV-01 | Abrir avaliação existente em leitura | `.eval-card--readonly` presente, campos `disabled` |
| AV-02 | Badge "Somente leitura" visível | `.eval-status-badge--leitura` visível |
| AV-03 | Badge "Em andamento" visível | `.eval-status-badge--andamento` visível |
| AV-04 | Badge "Finalizada" visível | `.eval-status-badge--finalizada` visível |
| AV-05 | Abrir Bioimpedância editável → preencher campos críticos | % gordura, peso, massa magra preenchidos |
| AV-06 | Seção "Resultados calculados" visível após preencher | `.eval-results-section` visível |
| AV-07 | Salvar Bioimpedância | POST/PUT → feedback de sucesso |
| AV-08 | Campo PA sistólica em Clínica — borda crítica | `border-width: 1.5px` aplicado (inspeção DOM) |
| AV-09 | Grupos anatômicos em Perimetros (Tronco/Membros sup/inf) | `.eval-field-group` com 3 labels visíveis |
| AV-10 | Finalizar avaliação | Status muda para "Finalizada", badge verde |
| AV-11 | Cor do `.eval-icon` corresponde ao domínio | Teal em Bioimpedância, Rose em Clínica, etc. |
| AV-12 | Navegação entre módulos (abas ou lista) | Troca de módulo sem perda de dados preenchidos |

---

# SUITE 11 — `reports.spec.js` · Relatórios

## Tela: Admin → Relatórios

| # | Caso de teste | Asserção |
|---|---|---|
| RE-01 | Página de relatórios carrega | Conteúdo visível |
| RE-02 | Alternar entre 4 modos de visualização | UI atualiza |
| RE-03 | Exportar CSV | Download disparado |
| RE-04 | Exportar Excel (se disponível) | Download disparado |
| RE-05 | Exportar PDF (se disponível) | Download disparado |
| RE-06 | Filtro por período | Dados atualizados |

---

# SUITE 12 — Casos transversais

| # | Caso | Asserção |
|---|---|---|
| TX-01 | Página 404 real | Acessar `/rota-inexistente` → componente NotFound renderizado |
| TX-02 | Skeleton no dashboard durante carregamento | Skeleton visível antes dos dados |
| TX-03 | Timeout de API → feedback amigável | Mensagem de erro exibida, sem crash |
| TX-04 | PasswordChangeModal aparece para usuário com `mustChangePassword` | Modal de troca de senha visível |
| TX-05 | ProfileCompletionModal aparece para perfil incompleto | Modal de completar perfil visível |
| TX-06 | Overflow horizontal ausente em todas as telas (mobile) | `scrollWidth <= innerWidth + 1` em cada rota |
| TX-07 | Navegação por teclado: Tab alcança todos campos críticos | Focus order lógico |

---

## Ordem de execução sugerida

```
1. globalSetup   → seed banco + login de cada papel → salvar storageState
2. auth.spec.js         (sem storageState, login fresh)
3. rbac.spec.js         (usa storageState dos 5 papéis)
4. admin-users.spec.js  (usa storageState admin)
5. admin-patients.spec.js
6. admin-scheduling.spec.js
7. admin-dashboard.spec.js
8. professor-dashboard.spec.js
9. student-dashboard.spec.js
10. prontuario.spec.js
11. avaliacao-completa.spec.js
12. reports.spec.js
13. casos transversais (TX)
```

---

## Critérios de qualidade

- Nenhum teste usa `page.waitForTimeout()` — sempre `waitForURL`, `waitForSelector`, ou asserções Playwright
- Seletores em ordem de preferência: `getByRole` > `getByLabel` > `getByPlaceholder` > `.class` CSS
- Dados de teste isolados: cada `describe` cria e remove seus próprios registros
- Todos os downloads verificados via `page.waitForEvent('download')`
- Asserções visuais (cor do domínio, badge) via inspeção de `computedStyle` ou `getAttribute`

---

## Cobertura estimada

| Área | Testes | Prioridade |
|---|---|---|
| Autenticação | 17 | P0 |
| RBAC | 10 | P0 |
| CRUD Usuários | 15 | P1 |
| CRUD Pacientes | 14 | P1 |
| Agendamentos | 6 | P1 |
| Dashboard Admin | 12 | P2 |
| Dashboards Prof/Aluno | 12 | P2 |
| Prontuário | 8 | P1 |
| Avaliações | 12 | P1 |
| Relatórios | 6 | P2 |
| Transversais | 7 | P0/P1 |
| **Total** | **119** | — |
