# Mapa das telas ainda fora da identidade visual nova

Data: 28/09/2026. O usuário pediu uma pesquisa, feita por um agente menor, sobre quais telas ainda precisam da onda visual ("Energia e velocidade": o par Sofia Sans e os tokens `--lt-*`).

**Método.** Um script mediu cada CSS de `src/`: tokens `--lt-*`, fontes antigas, cores fixas e quem importa o arquivo. O agente (Haiku) mapeou rotas e abas, mas errou classificações: deu como pendentes telas já migradas e como "nova" uma tela reescrita por outra frente. Por isso o orquestrador remontou este mapa direto da medição.
- **Script:** `scratchpad/medir-visual.cjs`.
- **Tabela bruta:** `scratchpad/medicao-visual.tsv` (84 arquivos CSS).
- **Nesta medição:** 46 CSS sem nenhum token novo, com cerca de 23 mil linhas.
- **Descontado o código morto:** cerca de 18 mil linhas em telas em uso.

## Situação em 30/09/2026 — ondas A a F concluídas
Todo o CSS de telas **em uso** está no padrão novo, com checagem leve: ESLint, postcss, SSR sintético e diff contra os backups. Na nova medição (`scratchpad/medicao-visual-final.tsv`), sobram sem nenhum token `--lt-*` só estes casos:
- **Código morto:**
  - `PrescricaoPlanoAlimentar.css`, `RefeicaoBuilder.css`, `SuplementoCard.css`;
  - `AvaliacaoAlimentarNOVA.css`, `ComposicaoCorporalIntegradaForm.css`;
  - `ProximasAcoes.css`, `MacroEtapaSection.css`.
- **Base protegida + legado isolado:** `PatientProntuario.css` (27 linhas vivas) e `ProntuarioTheme.css` (175 linhas vivas, iguais para não mexer na página de avaliações).
- **`avaliacoes.css`:** as classes `eval-*` legadas continuam no DOM dos formulários, mas a base nova as restiliza dentro de `.av-modulo`. Aposentar exige uma passada própria.

**Pendentes:**
- o navegador e a revisão independente;
- as decisões registradas em `docs/implementacao/telas-v2/change-intent.md` e `docs/implementacao/avaliacoes-v2/change-intent.md`;
- a remoção do código morto e do legado, que depende de aprovação.

## Já no padrão novo
- Landing e inscrição pública.
- Barras laterais.
- Visão geral dos 5 portais.
- Áreas da Liga e Pesquisa.
- Página do plano alimentar (prescrição).
- Página de avaliações e 14 das 17 avaliações (`docs/implementacao/avaliacoes-v2/`).

O "Poppins" que aparece nesses arquivos está em comentários que explicam a neutralização da fonte global.

## Pendentes, agrupados em ondas sugeridas

### Onda A — fundações globais (afeta todas as telas; fazer primeiro, com verificação em navegador)
| CSS | Linhas | O que é |
|---|---|---|
| `src/index.css` | 1.108 | globais: Poppins em h1–h6, h1 em degradê, `button` nowrap, `input` (0,2,1) |
| `src/styles/theme.css` | 485 | tema global |
| `src/styles/modalSystem.css` | 430 | todos os modais `app-modal-*` |
| `src/components/ui/ui.css` | 545 | Button, anexos e outros (22 telas importam `components/ui`) |
| `src/views/admin/AdminView/AdminHeader.css` | 310 | cabeçalho de todos os portais |
| `src/views/admin/AdminView/AdminView.css` | 137 | moldura dos portais |
| `src/components/Auth/ProfileCompletionModal.css` | 164 | modal de completar perfil (todo perfil vê) |
| `src/components/Auth/PasswordChangeModal.css` | 145 | troca de senha |
| `src/App.css` | 48 | raiz |

**Risco:** as ondas anteriores neutralizaram essas regras dentro dos próprios escopos. Mudar as globais pode alterar telas já prontas, por isso esta onda exige a rodada de navegador.

### Onda B — portais do atleta e da equipe
| CSS | Linhas |
|---|---|
| `src/views/Athlete/AthletePortal.css` | 1.508 |
| `src/views/Team/TeamPortal.css` | 648 |
| `src/components/Atleta/AthleteOnboardingWizard.css` | 376 |
| `src/views/Athlete/AthleteOnboardingModal.css` | 324 |
| `src/views/Athlete/AthleteMealPlan.css` (plano visto pelo atleta) | 135 |
| `AthleteSelfEvaluationModal.css`, `AthleteEbiaModal.css`, `AthleteView.css` | 123 |

### Onda C — agendas e rotina do professor e do aluno
| CSS | Linhas |
|---|---|
| `src/views/Student/StudentAgenda/StudentAgenda.css` | 1.169 |
| `src/views/professor/ProfessorView.css` | 645 |
| `src/views/professor/ProfessorAgenda.css` | 594 |
| `src/components/shared/ClinicalEvaluationResultCard.css` (painel do professor) | 398 |
| `src/views/Student/Patients/AppointmentModal.css` | 222 |
| `src/components/Supervisao/FilaRevisao.css` | 161 |
| `src/components/shared/EvaluationSummaryStrip.css` | 125 |
| `src/views/Student/StudentDashboard/StudentDashboard.css` (misto: 8 tokens e 26 cores fixas) | 803 |

### Onda D — gestão administrativa
| CSS | Linhas |
|---|---|
| `src/views/admin/ReportsPage/ReportsPage.css` | 1.717 |
| `src/views/admin/Registration/ManagementPages.css` (pacientes e usuários) | 1.381 |
| `src/views/admin/Patients/LinkPatientModal.css` | 750 |
| `src/views/admin/Registration/PatientModal.css` | 613 |
| `src/views/admin/Requests/AccessRequests.css` | 530 |
| `src/views/admin/Registration/UserModal.css` | 525 |
| `src/views/admin/AdminView/SettingsPage.css` | 511 |

### Onda E — prontuário (depois que o WI-007 terminar)
O WI-007 já aplica a identidade nova em `ProntuarioPatch.css` (104 tokens). Continuam antigos:
| CSS | Linhas |
|---|---|
| `src/components/Prontuario/ProntuarioTheme.css` (também importado pela página de avaliações) | 1.136 |
| `src/views/Student/Patients/PatientProntuario.css` | 1.057 |
| `src/components/Prontuario/EvolucaoAnalytics.css` | 350 |
| `src/components/Prontuario/ProntuarioHeader.css` | 321 |
| `src/components/Prontuario/MacroEtapaSection.css` | 81 |

Entram também as pendências da onda de avaliações:
- GET (`GastoEnergeticoTotalForm.css`, 362);
- Imagem;
- `src/components/AlimentoBuscador.css` (280, dentro da avaliação Alimentar);
- o `avaliacoes.css` legado (1.100), que só pode sair quando nenhum consumidor usar mais `eval-*` fora de `.av-modulo`. Um deles é a autoavaliação do atleta.

## Código morto (sem rota nem import): remover depende de aprovação
| Arquivo | Linhas de CSS |
|---|---|
| `src/views/planos/PrescricaoPlanoAlimentar.jsx`/`.css`: tem import em `App.jsx:31`, mas nenhuma rota o usa | 1.088 |
| `src/components/RefeicaoBuilder.*` e `src/components/SuplementoCard.*`: usados só pela página acima | 1.018 |
| `src/components/Avaliacoes/avaliacao-alimentar/AvaliacaoAlimentarNOVA.*` | 251 |
| `src/components/Avaliacoes/Antropometria/ComposicaoCorporalIntegradaForm.*`: o GET lia registros deste tipo, confirmar com o WI-007 | 201 |
| `src/components/Dashboard/ProximasAcoes.*` | 182 |
| `AlertaBanner.jsx`, `ModuloCard.jsx`, `AvaliacaoTextual.jsx`, `ResultadosAntropometricos.jsx` | — |

## Ordem sugerida
A → B → C → D → E. A onda A vem primeiro porque mexe no que todas as telas herdam. A onda E espera o WI-007. As ondas B, C e D podem correr em paralelo depois da A, porque os arquivos são disjuntos.
