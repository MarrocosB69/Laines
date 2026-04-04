# LAINES V1.0 — Hardening Sprint (Frontend)

## 1) Ficheiros alterados
- `src/index.css`
- `src/components/ui/Button.jsx`
- `src/components/ui/ui.css`
- `src/components/Avaliacoes/avaliacoes.css`
- `src/components/Avaliacoes/avaliacao-alimentar/AvaliacaoAlimentarNOVA.css`
- `src/components/Avaliacoes/avaliacao-socioeconomica/AvaliacaoSocioeconomica.css`
- `src/components/Avaliacoes/avaliacao-hidratacao/AvaliacaoHidratacao.css`
- `src/components/Avaliacoes/avaliacao-psicologia/AvaliacaoPsicologia.css`
- `src/components/Avaliacoes/avaliacao-fisioterapia/AvaliacaoFisioterapia.css`
- `src/components/Avaliacoes/avaliacao-exames-laboratoriais/AvaliacaoExamesLaboratoriais.css`
- `src/components/Avaliacoes/avaliacao-evolucao-retorno/AvaliacaoEvolucaoRetorno.css`
- `src/components/Avaliacoes/anamnese/AnamneseInicialForm.css`
- `src/components/Avaliacoes/clinica/AvaliacaoClinicaForm.css`
- `src/components/Avaliacoes/Antropometria/BioimpedanciaForm.css`
- `src/components/Avaliacoes/Antropometria/DobrasCutaneasForm.css`
- `src/components/Avaliacoes/Antropometria/PerimetrosCorporaisForm.css`
- `src/components/Avaliacoes/Antropometria/GastoEnergeticoTotalForm.css`
- `src/components/Avaliacoes/Antropometria/ComposicaoCorporalIntegradaForm.css`
- `src/components/Avaliacoes/anamnese/AnamneseInicialForm.jsx`
- `src/components/Avaliacoes/clinica/AvaliacaoClinicaForm.jsx`
- `src/components/Avaliacoes/Antropometria/BioimpedanciaForm.jsx`
- `src/components/Avaliacoes/Antropometria/DobrasCutaneasForm.jsx`
- `src/components/Avaliacoes/Antropometria/PerimetrosCorporaisForm.jsx`
- `src/components/Avaliacoes/Antropometria/GastoEnergeticoTotalForm.jsx`
- `src/components/Avaliacoes/Antropometria/ComposicaoCorporalIntegradaForm.jsx`
- `src/views/Athlete/AthleteOnboardingModal.jsx`
- `src/views/Athlete/AthleteOnboardingModal.css`
- `src/views/admin/Registration/PatientManagement.jsx`
- `src/views/admin/Registration/UserManagement.jsx`
- `src/views/admin/Registration/ManagementPages.css`
- `src/views/admin/Registration/PatientModal.jsx`
- `src/views/admin/Patients/LinkPatientModal.jsx`
- `src/views/admin/Dashboard/DashboardStats.jsx`
- `src/views/admin/Areas/Extensao.jsx`
- `src/views/Student/StudentView/StudentSideBar.jsx`
- `src/views/Student/StudentView/StudentHeader.jsx`
- `src/views/Student/StudentDashboard/StudentDashboard.jsx`
- `src/views/Student/StudentAgenda/StudentAgenda.jsx`
- `src/views/Student/Patients/AppointmentModal.jsx`
- `src/views/Student/Patients/PatientProntuario.jsx`
- `src/views/professor/ProfessorSidebar.jsx`
- `src/views/professor/ProfessorHeader.jsx`
- `src/views/professor/ProfessorAgenda.jsx`
- `src/views/professor/agenda/ProfessorAgendaDayAppointments.jsx`
- `src/views/Athlete/AthletePortal.jsx`
- `src/views/AvaliacaoCompleta.jsx`
- `src/views/NotFound.jsx`
- `src/components/Prontuario/ProntuarioHeader.jsx`
- `src/components/Prontuario/DashboardAvaliacoes.jsx`
- `src/components/Prontuario/TimelineConsultas.jsx`
- `src/components/Prontuario/ResumoClinico.jsx`

## 2) O que foi feito por fase

## Fase 1 — Responsividade crítica (mobile)
- Adicionadas media queries `@media (max-width: 768px)` e `@media (max-width: 480px)` para os formulários de avaliação que não tinham cobertura suficiente.
- Em `768px`: grids de formulários colapsam para 1 coluna.
- Em `480px`: padding reduzido em containers/cartões para evitar overflow horizontal.

## Fase 2 — Padronização de erros
- Confirmado padrão global em `index.css`: `.input-error` e `.form-error-message`.
- Removidos usos restantes de erro em inline style (cor vermelha em JSX), mantendo mensagem visual padronizada.

## Fase 3 — Feedback de auto-save
- Estado de save (`saving`, `saved`, `error`) consolidado com `.save-indicator`.
- Integração aplicada também em formulários críticos que faltavam:
  - `AnamneseInicialForm`
  - `AvaliacaoClinicaForm`
  - `BioimpedanciaForm`
  - `DobrasCutaneasForm`
  - `PerimetrosCorporaisForm`
  - `GastoEnergeticoTotalForm`
  - `ComposicaoCorporalIntegradaForm`

## Fase 4 — Onboarding do atleta
- Implementado progress indicator por etapas no modal de onboarding:
  - Etapas numeradas
  - Estado ativo
  - Estado concluído
  - Barra de progresso
  - Contador visível `etapa X/Y` e `campos respondidos`

## Fase 5 — Terminologia global
- Iniciado ajuste de terminologia visível de UI:
  - `Paciente` → `Participante` em headers, dashboards, agenda, prontuário e modais-chave.
- Mantidos nomes técnicos internos (`pacienteId`, endpoints, contextos) sem alterações para evitar breaking change.

## Fase 6 — Paginação admin (clareza)
- Adicionado texto de contexto junto ao carregamento incremental:
  - `A mostrar X de Y`
- Aplicado em:
  - `PatientManagement`
  - `UserManagement`

## Fase 7 — Formulários longos
- Aplicado agrupamento semântico com `fieldset/legend` no formulário longo de perímetros:
  - Dados obrigatórios
  - Dados opcionais
  - Contexto da medição
  - Circunferências
  - Comparativo de TMB

## Fase 8 — Padronização de botões
- Removido uso remanescente de `.eval-btn` em JSX.
- Ações de avaliação migradas para `src/components/ui/Button` com suporte `loading`/`disabled`.

## Fase 9 — Design tokens
- Reforço de uso de tokens globais em componentes base (`Button`, feedback de erro/save e onboarding).
- Mantida abordagem incremental para não gerar regressão visual ampla nesta fase.

## 3) Contagens
- Erros inline removidos (padrão `style={{ color: ... }}`): `7`
- Formulários ajustados para responsividade mobile: `14`
- Botões legados `.eval-btn` substituídos em JSX: `9`
- Ocorrências restantes de `.eval-btn` em JSX: `0`

## 4) Problemas não resolvidos
- Migração de terminologia (`Paciente` → `Participante`) ainda não está 100% completa em todas as telas administrativas e relatórios.
- Padronização total de botões fora do domínio de avaliações (ex.: botões administrativos próprios) ainda é parcial.
- Fase 9 (tokens) foi aplicada nos pontos críticos; ainda há hardcodes legados em módulos antigos não críticos.

## 5) Sugestões para V1.1
- Finalizar migração de terminologia com checklist por módulo e revisão de conteúdo de relatórios.
- Completar unificação de botões para `ui/Button` em todos os módulos (admin/professor/team).
- Adotar lint de estilos para bloquear novas cores hardcoded fora de tokens.
- Adicionar testes visuais por breakpoint (desktop/tablet/mobile) para formulários críticos.
- Criar smoke tests E2E focados em:
  - criação/edição de avaliação
  - auto-save + feedback visual
  - agendamento/remarcação

---

## Patch V1.0.1 — 2026-04-04 (pós-auditoria de código)

### Ficheiros modificados
- `src/components/Avaliacoes/Antropometria/BioimpedanciaForm.css`
- `src/components/Avaliacoes/Antropometria/PerimetrosCorporaisForm.css`
- `src/components/ui/Button.jsx`
- `src/components/ui/ui.css`
- `src/views/professor/ProfessorDashboard.jsx`
- `src/views/Student/StudentDashboard/StudentDashboard.jsx`

### O que foi corrigido

**Responsividade (crítico):**
- `BioimpedanciaForm.css`: adicionado padding interno de `.eval-card`, `.eval-section` e `.bia-section` em `@media (max-width: 480px)` — cards deixavam de sobrar no ecrã em telemoveis pequenos
- `PerimetrosCorporaisForm.css`: mesma correção para `.eval-card`, `.eval-section`, `.perimetros-section`

**Button.jsx — funcionalidades novas:**
- Adicionada prop `size` com valores `sm | md | lg` (padrão `md`)
- Adicionada prop `fullWidth` — aplica `width: 100%; justify-content: center`

**ui.css — variante ghost:**
- Adicionada `.ui-button-ghost` (fundo transparente, sem borda, hover suave)
- Adicionadas classes de tamanho `.ui-button-sm` e `.ui-button-lg`
- Adicionada `.ui-button-full` para botão de largura total

**Terminologia (ProfessorDashboard.jsx):**
- Fallback `'Paciente'` → `'Participante'` (linhas 187, 377, 378)
- Label "Pacientes supervisionados" → "Participantes supervisionados" (stat card + painel de detalhe)
- Meta "Pacientes aguardando" → "Participantes aguardando"
- Texto "Clique em um paciente" → "Clique em um participante"

**Empty state (StudentDashboard.jsx):**
- Estado vazio de participantes melhorado: adicionado ícone `UserPlus`, título em bold e instrução de ação ("Acesse Meus Participantes na barra lateral")

### O que ainda falta (V1.1)
- Migração de terminologia não está 100% — verificar: relatórios admin, modais de agendamento do professor, PatientManagement headers
- 50+ cores hardcoded em BioimpedanciaForm.css e PerimetrosCorporaisForm.css não foram migradas para tokens (débito técnico, sem impacto visual imediato)
- Border-radius valores não padrão (9px, 18px, 20px) nos formulários maiores
- Padronização de botões nos módulos admin/professor ainda parcial (botões fora do domínio de avaliações)
- Lint de CSS para bloquear hardcodes não está configurado

## Validação executada
- Build de produção executado com sucesso em `2026-04-04` (sprint inicial): `npm run build` ✅
- Build de produção executado com sucesso em `2026-04-04` (patch V1.0.1): `npm run build` ✅
