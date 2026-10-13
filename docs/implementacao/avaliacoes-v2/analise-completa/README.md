# Análise completa das avaliações (01/10/2026)

**O que esta análise cobre:** como as avaliações funcionam por dentro (independência, fluxo de dados, ciclo de vida) e tudo o que o sistema mostra a partir delas. O estado analisado é o atual, depois do WI-007 (autonomia das avaliações) e da onda visual.

**Como foi feita:**
- dois agentes (Sonnet) leram o código, sem executar nada pesado e sem dados reais;
- o orquestrador conferiu no código as afirmações centrais (lista no fim);
- os relatórios detalhados, com `arquivo:linha`, estão em [independencia.md](independencia.md) e [exibicao.md](exibicao.md).

Os julgamentos clínicos precisam de validação de um nutricionista. A análise anterior, de 27/09, está em [../analise-conceitual.md](../analise-conceitual.md). Esta a substitui no que mudou.

---

## 1. Resposta curta

**As avaliações são independentes.** Isso vale para as 17 do catálogo e também para a `composicao_corporal_integrada`, que fica fora dele.
- **Nenhuma lê resultado ou classificação de outra.** No servidor, os normalizadores são funções puras sobre o que o formulário envia: nenhum acessa o banco.
- **Só peso e estatura são reaproveitados** de outras avaliações, como o WI-007 permite. Idade e sexo vêm só do cadastro.
- **Nenhuma bloqueia outra.** A antiga `MODULE_DEPENDENCIES` não existe mais, e as validações de finalização usam só campos do próprio tipo.
- **O plano alimentar não é travado por nenhuma avaliação.** Ele lê só o GET e a anamnese finalizados, para leitura. A única interrupção é um **aviso** quando o RED-S está "estabelecido", com a opção "Abrir plano mesmo assim".
- **O achado de 27/09 foi resolvido.** O GET dependia da "composição integrada", que não tem tela. Agora ele calcula a TMB pelo próprio perfil, e há teste que prova isso.

**O que preocupa não é o acoplamento, e sim cálculo e exibição:**
- **6 defeitos de cálculo** que produzem números ou classificações enganosas, vários **gravados assim no banco**;
- **3 tipos importantes sem indicador** nos painéis centrais;
- **teste de servidor muito concentrado:** um único arquivo de teste cobre 3 dos 17 tipos.

---

## 2. Como funciona por dentro

### Independência (resumo)
| Situação | Avaliações |
|---|---|
| Independente | Anamnese, Clínica, Socioeconômica (EBIA), Carga de treino, Alimentar, Hidratação, Psicologia, Fisioterapia, RED-S, Exames, Evolução/retorno, Plano de metas e Imagem (esta não foi auditada a fundo) |
| Independente, com peso e estatura compartilhados (permitido) | Perímetros, Dobras, Bioimpedância, GET e Composição integrada |
| Acoplada | **nenhuma** |

### Quem calcula: cliente ou servidor
- **O servidor recalcula a partir dos campos primários:** Clínica, RED-S, EBIA, Carga, Exames, Evolução e Psicologia.
- **O servidor só armazena o que o cliente calculou:** Perímetros, Dobras, Bioimpedância, GET e Composição integrada. Um erro de fórmula no cliente, como o do YMCA, vai direto para o banco, sem segunda verificação.

### Ciclo de vida
- **Status:** `rascunho` ou `finalizada`. Uma avaliação finalizada pode ser **reaberta**: ao ser enviada para revisão, ela volta a rascunho, de forma explícita e nunca silenciosa.
- **Finalização:** exige 80% de completude e as validações do próprio tipo.
- **Salvamento automático:** grava o rascunho por tipo e anexa peso e estatura compartilhados.
- **Revisão:** usa a marca `aguardandoRevisao`. A fila aparece só para quem tem vínculo de gestão ou supervisão com o caso.
- **O atleta:**
  - pode autorrelatar Alimentar, Hidratação, Carga e Fisioterapia;
  - a EBIA tem liberação controlada;
  - os resultados de RED-S, Psicologia e Exames são marcados como sensíveis.
- **Nova sessão:** começa vazia e não copia conteúdo da sessão anterior, só o contexto de peso, estatura, idade e sexo. Os rascunhos antigos ficam na sessão antiga.

---

## 3. O que é mostrado

Os resultados aparecem em:
- o próprio formulário;
- a página de avaliações (Visão geral, mapa e alertas);
- o prontuário (Visão geral, aba Avaliações, Evolução e resumo clínico);
- o painel do professor (cartões de resultado);
- o portal do atleta;
- o relatório clínico em PDF;
- os alertas clínicos.

A matriz completa, avaliação × lugar × quem vê, está em [exibicao.md](exibicao.md).

**O que funciona bem:**
- No prontuário e nas telas do atleta, a ausência de valor aparece como "—" de propósito.
- O atleta **não vê** pressão arterial e frequência cardíaca, PHQ-9/GAD-7, RED-S, exames nem as marcações da anamnese nas telas dele.
- Nenhuma tela apresenta uma avaliação como "pré-requisito" de outra. O que existe são agregações só para leitura, com fonte.

---

## 4. Problemas encontrados, por prioridade

### A. Cálculo (precisam de correção de lógica e da sua aprovação)
| # | Problema | Onde | Efeito | Gravidade |
|---|---|---|---|---|
| 1 | **% de gordura YMCA com unidades erradas** (cm e kg numa equação calibrada para polegadas e libras) | `calculationEngine.js:322-326`; cópia em `PerimetrosCorporaisForm.jsx` | Mostra e **grava** cerca de 300–345% | Alta |
| 2 | **Exames:** o aviso de conduta procura "critico"/"alto", mas o status usa "alterado" | `AvaliacaoExamesLaboratoriais.jsx:500-520` contra `exames-laboratoriais-normalizer.ts:136-142` | Com analito alterado, mostra "Exames consistentes para conduta" | Alta |
| 3 | **Evolução:** um campo de adesão ausente conta como 0 | `evolucao-retorno-normalizer.ts:110-114` (servidor) | Formulário vazio vira 0%, prioridade "alta" e "Retorno exige conduta prioritária", **gravado** | Alta |
| 4 | **GET:** com o registro semanal vazio, o PAL vira 1,0 e ignora o "Nível de atividade" | `GastoEnergeticoTotalForm.jsx:279-305, 1534-1539` | GET = TMB × 1,0, **gravado** | Média/alta |
| 5 | **Hidratação:** ganho de peso gera perda, sudorese e reposição negativas | `hidratacao-normalizer.ts:99-117` (servidor) | Valores negativos **gravados** (por exemplo, "-600 ml") | Média |
| 6 | **Alimentar:** sem nenhum registro, a classificação é "Padrão saudável" | `alimentar-normalizer.ts:84-89, 203-205` | Uma avaliação vazia parece saudável | Média |
| 7 | **Servidor só armazena o cálculo do cliente** em 5 tipos | normalizadores de Perímetros, Dobras, Bioimpedância, GET e Composição integrada | Erro de fórmula ou payload manipulado vai ao banco sem verificação | Média |
| 8 | **GET:** a fórmula para atletas (Cunningham) nunca é a padrão | `calculationEngine.js:2349-2355` | Hoje o GET só recebe peso, estatura, idade e sexo, sem massa magra, então Cunningham nem é possível. É decisão clínica: pedir massa magra no GET ou aceitar Henry/Schofield | Média |
| 9 | **Bioimpedância:** a classificação reserva do servidor ignora sexo e idade | `bioimpedancia-normalizer.ts:61-67` | Só aparece se o payload chegar sem classificação | Baixa |

### B. Exibição (só tela; correção mais simples)
| # | Problema | Onde | Gravidade |
|---|---|---|---|
| 10 | **Carga de treino e RED-S** aparecem como "Sem indicadores configurados" no painel de avaliações do prontuário (o Plano de metas também) | `DashboardAvaliacoes.jsx:44-115, 440` | Alta |
| 11 | **RED-S, Imagem e Plano de metas** caem num cartão genérico, sem nenhum valor, no painel do professor. O RED-S falha nos dois painéis centrais | `evaluationResultAdapter.js` (falta ramo para os 3) | Alta |
| 12 | **O cartão "Composição" do resumo clínico** está fixo em bioimpedância (`COMPOSICAO: 'bioimpedancia'`), mesmo quando a fonte é outra | `DashboardAvaliacoes.jsx:117-123, 906` | Alta |
| 13 | **Clínica:** com o formulário vazio, mostra "0 alertas · Sem alertas" em verde | `AvaliacaoClinicaForm.jsx:889-900` | Média |
| 14 | **Evolução:** a prioridade aparece como código cru ("sem_classificacao") | `AvaliacaoEvolucaoRetorno.jsx:173-174, 215` | Média |
| 15 | **Notificação de alerta clínico** sempre genérica: o detalhe é calculado e depois descartado | `clinical-alerts.service.ts:120-163` | Média |
| 16 | **`DOMAIN_BY_TYPE`** tem chaves que não existem no catálogo | `ClinicalEvaluationResultCard.jsx:8-23` | Baixa |

### C. Acesso (decisão de política)
| # | Situação | Onde |
|---|---|---|
| 17 | **Relatório clínico em PDF:** a rota não restringe o perfil (já registrado em `docs/rbac-matrix.md:99`), mas o serviço confere o vínculo com o paciente (`canAccess`), então **não há vazamento entre pacientes**. Porém o **atleta pode baixar o próprio PDF completo** por chamada direta à API, com PHQ-9/GAD-7, RED-S e exames, que as telas dele escondem de propósito. Nenhuma tela chama esse PDF hoje. **Decidir:** o atleta deve ter acesso ao próprio relatório clínico? Se não, restringir a rota por perfil. | `avaliacoes.controller.ts:117-128`; `relatorio-clinico.service.ts:208-224` |

### D. Testes
| # | Lacuna |
|---|---|
| 18 | **Um único teste de servidor** (`avaliacoes.service.spec.ts`), que cobre Clínica, RED-S e Carga. Os outros 14 normalizadores, o plano alimentar, os alertas e o relatório não têm teste. |
| 19 | **Nenhum dos defeitos de cálculo 1–6 tem teste de regressão.** Os testes de autonomia (`test-reds-autonomy`, `test-get-autonomy` e `test-integrated-composition-autonomy`) provam a independência, não a correção numérica. |

---

## 5. Próximos passos sugeridos (dependem de aprovação; envolvem lógica clínica)
1. **Corrigir os cálculos 1–6, cada um com teste de regressão.** São correções pequenas e localizadas. No caso da Evolução e da Alimentar, a regra é "ausência é nula, nunca zero".
2. **Indicadores e cartões que faltam:** dar indicadores à Carga e ao RED-S no prontuário, criar os ramos de RED-S, Imagem e Plano de metas no cartão do professor e fazer o cartão "Composição" seguir a fonte real (itens 10–12). É exibição, de esforço baixo.
3. **Decidir o acesso do atleta ao PDF clínico** (item 17).
4. **Servidor recalculando** Perímetros, Dobras, Bioimpedância e GET (item 7), ou ao menos validando faixas fisiológicas.
5. **Ampliar os testes de servidor** para os normalizadores sem cobertura.
6. **Decisão clínica sobre a TMB do GET** para atletas (item 8).

---

## 6. O que o orquestrador conferiu no código
- **Normalizadores:** nenhum acessa o banco (`grep Repository|createQueryBuilder|InjectRepository` sem ocorrência).
- **`MODULE_DEPENDENCIES`:** zero ocorrências.
- **Peso e estatura compartilhados:** `AvaliacaoCompleta.jsx:1232-1258`.
- **Teste de servidor:** existe um único, `server/src/avaliacoes/avaliacoes.service.spec.ts`.
- **Defeitos confirmados:**
  - YMCA (`calculationEngine.js:322-326`);
  - Evolução com ausência virando 0 (`evolucao-retorno-normalizer.ts:110-114`);
  - Alimentar "Padrao saudavel" com ultraprocessados abaixo de 10, inclusive com total zero (`alimentar-normalizer.ts:86, 203-205`);
  - GET sem `context` (`calculationEngine.js:2346-2355`).
- **PDF:** a rota tem só `JwtAuthGuard`, e `gerarPDF` chama `canAccess`, que lança `NotFound` quando falha. O atleta acessa só o próprio paciente (`relatorio-clinico.service.ts:222`).
- **Painéis:** `DashboardAvaliacoes` não tem `carga_treino` nem `triagem_reds`, e `COMPOSICAO: 'bioimpedancia'` está fixo. `evaluationResultAdapter.js` não tem ramo para `triagem_reds`, `composicao_corporal_imagem` nem `plano_metas`.

## Limites
- Não houve execução em navegador nem acesso a banco. Os agentes não abriram por inteiro todos os 17 formulários.
- Os painéis do aluno e do admin foram vistos só por grep.
- O efeito exato de `ATHLETE_SENSITIVE_RESULT_TYPES` na leitura do atleta não foi auditado a fundo.
