# Análise da exibição de resultados das avaliações — LAINES

> Metodologia: leitura de código em 30/09–01/10/2026, sem executar nada (sem `npm`, build, Vite ou navegador). Toda afirmação de fato vem com `arquivo:linha`. Julgamento clínico ou de leitura vem marcado **[julgamento]**. Ponto de partida: a análise conceitual de 27/09 (`docs/implementacao/avaliacoes-v2/analise-conceitual.md`) e os relatórios de onda (`docs/implementacao/avaliacoes-v2/change-intent.md`, `docs/implementacao/telas-v2/change-intent.md`), que já registram várias mudanças e defeitos entre 27/09 e 30/09. Onde reconfirmei algo desses documentos no código atual, digo "confirmado hoje" com a linha atual. Onde não tive tempo de reconferir, digo isso explicitamente.

**Este arquivo está em construção incremental** (Write inicial + Edits sucessivos). As seções abaixo são preenchidas na ordem: 1 (resumo, ao final), 2–3 (matriz e por avaliação), 4–9, 10 (limites).

---

## 1. Resumo executivo

O LAINES tem 17 avaliações no catálogo (`server/src/avaliacoes/evaluation-registry.ts:27-263`) e um contrato visual recente ("—" para ausência, classificação sempre escrita, unidade visível) que, onde conferi, é majoritariamente respeitado: o prontuário (`VisaoGeral.jsx`, `ResumoClinico.jsx`) e as telas do atleta tratam ausência como "—"/nulo, nunca 0, de forma deliberada e documentada em comentário no próprio código. A autonomia entre avaliações decidida no WI-007 também está implementada de fato, não só no papel: RED-S e GET não leem mais resultado de outra avaliação da mesma sessão, e a navegação para o plano alimentar só é interrompida pelo alerta de RED-S "estabelecido" (com escape), nunca por falta de outra avaliação.

Mas há quebras concretas do próprio contrato, ainda presentes hoje: o formulário de Avaliação clínica mostra literalmente "0 alertas" com formulário vazio (`AvaliacaoClinicaForm.jsx:889-900`); o cálculo de Evolução/retorno trata adesão ausente como 0, produzindo "0%"/prioridade "alta" sem nenhum dado real (`evolucao-retorno-normalizer.ts:110-123`); e o aviso de conduta de Exames laboratoriais pode mostrar "Exames consistentes para conduta" (verde) mesmo com um analito fora da referência, por um descasamento de tokens (`'critico'/'alto'` vs. o valor real `'alterado'`) em `AvaliacaoExamesLaboratoriais.jsx:500-529`.

No prontuário, dois dos indicadores mais ligados a risco — Carga de treino (ACWR) e Triagem RED-S (DE) — continuam caindo em "Sem indicadores configurados." no painel principal, apesar de calculados (`DashboardAvaliacoes.jsx:44-115,440`), e o card de "Composição corporal" do resumo clínico segue fixo em bioimpedância mesmo quando a fonte oficial escolhida é outra (`DashboardAvaliacoes.jsx:117-123`). O único canal de notificação push do sistema (RED-S, exames e psicologia para a equipe) calcula o detalhe clínico e depois descarta-o, enviando sempre uma mensagem genérica (`clinical-alerts.service.ts`). O atleta, pelo desenho das próprias telas, não vê PA/FC, PHQ-9/GAD-7, RED-S, exames ou flags de anamnese — mas o endpoint do PDF clínico que contém tudo isso não tem restrição de papel na rota (já documentado em `docs/rbac-matrix.md:99`), embora hoje nenhuma tela do sistema o chame.

---

## 2. O que mudou desde a análise de 27/09 (antes da matriz)

Fatos verificados agora, que alteram ou atualizam achados da análise anterior:

1. **`AlertaBanner.jsx` e `ModuloCard.jsx` continuam existindo como arquivos** em `src/components/Prontuario/` (confirmado por `Glob` em 01/10), mas com **0 importações** em qualquer outro lugar do `src/` (confirmado por `Grep` de `AlertaBanner|ModuloCard` em todo `src/`: só aparecem neles mesmos). O relatório da Onda E1 (`docs/implementacao/telas-v2/change-intent.md:244`) registra "Remoção do legado e de componentes mortos: ... `AlertaBanner` e `ModuloCard`" — isso descreve a remoção do uso, não a exclusão dos arquivos. Mesma situação para `MacroEtapaSection.jsx`, `PainelSituacaoClinica.jsx` e `ProximasConsultas.jsx` (ainda presentes em `Glob`, mesmo relatório os lista como removidos).
2. **WI-007 (autonomia entre avaliações) está implementado no código, não só no documento de decisão.** Verificado:
   - RED-S (`src/views/avaliacoes/AvaliacaoTriagemREDS.jsx:136-184`) usa só campos próprios (`ingestaoManual`, `gastoManual`, `massaMagraManual`); quando faltam, nomeia os campos ausentes (`missingFields`, linhas 174-176) em vez de buscar em Alimentar/GET/Composição integrada.
   - GET (`src/components/Avaliacoes/Antropometria/GastoEnergeticoTotalForm.jsx`) não referencia mais `composicao_corporal_integrada` nem `integratedBase` (0 ocorrências); a TMB usada vem de `getEvaluation?.base?.tmbUsedKcal` (linhas 281-292, 343-368, 484-485), calculada a partir do próprio perfil do módulo.
   - A navegação para o plano alimentar (`handleOpenPlanoAlimentar`, `src/views/AvaliacaoCompleta.jsx:2053-2067`) só é interrompida pelo alerta de RED-S "estabelecido" (linha 2056: `if (shouldWarnRedsPrescricao)`), nunca por exames, evolução ou qualquer outra avaliação — e mesmo esse alerta tem escape ("Abrir plano mesmo assim", linha 2060).
   - Isso **contradiz parcialmente** a seção 3.8 e 3.14 da análise de 27/09, que descreviam TMB herdada da composição integrada e dados do RED-S vindos automaticamente de outras avaliações da mesma sessão — essa descrição valia em 27/09 e foi alterada pelo WI-007 em 27-28/09, antes mesmo da conclusão da onda visual.
3. **A onda visual (avaliacoes-v2 e telas-v2) terminou** (Onda E1 e E2 concluídas em 30/09, por `docs/implementacao/telas-v2/change-intent.md:212-250`). Isso significa que a maioria dos números de linha da análise de 27/09 para os formulários (`src/components/Avaliacoes/**`, `src/views/avaliacoes/**`) **mudou**, porque a marcação foi reestruturada — embora a invariante declarada seja "lógica idêntica". Não reconferi arquivo por arquivo; usei os relatórios de onda (que já citam linhas atuais de alguns defeitos) e verificações pontuais próprias.
4. **Os relatórios de onda já documentam, como "defeito notado, sem correção"**, vários casos de "ausência exibida como 0" que o próprio contrato (`contrato-avaliacao.md`) proíbe. Reconferi os principais no código de hoje (ver seção 5).

---

## 3. Matriz avaliação × lugar × quem vê

Os "8 lugares" do pedido, numerados como no enunciado. "✓" = resultado aparece lá (com arquivo:linha na seção 4); "—" = não aparece; "parcial" = aparece de forma incompleta (ex.: card sem indicador configurado).

| # | Avaliação | 1. Próprio formulário | 2. AvaliacaoCompleta (visão geral/módulos/histórico) | 3. Prontuário (Dashboard/VisãoGeral/Resumo/Evolução) | 4. Componentes compartilhados | 5. Painéis (prof./aluno/admin) | 6. Atleta | 7. Relatório clínico (PDF) | 8. Alertas clínicos (server) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Anamnese inicial | ✓ | ✓ (resumo clínico, atrás de flag) | ✓ (card dashboard; ResumoClinico) | — | ✓ (ramo próprio, `evaluationResultAdapter.js:362-395`) | — (dados clínicos não aparecem nas abas do atleta) | ✓ (`extractAnamnese`) | — |
| 2 | Avaliação clínica | ✓ | ✓ (balanço/alertas não cobrem PA/FC) | ✓ (card; EvolucaoAnalytics grupo "Clínico") | ✓ (`ClinicalEvaluationResultCard`, domínio `clinica`) | ✓ (ramo próprio, `evaluationResultAdapter.js:396-445`) | — | ✓ (`extractClinica`) | — |
| 3 | Socioeconômica (EBIA) | ✓ | parcial (não entra no balanço/alertas da página) | ✓ (card dashboard) | — | ✓ (ramo próprio, `evaluationResultAdapter.js:530-559`) | — (preenchida pelo atleta via `AthleteEbiaModal`, resultado não é lido de volta a ele) | — (fora do `TIPO_ORDER`/extratores do PDF) | — |
| 4 | Perímetros | ✓ | parcial (entra na composição integrada, não aparece isolado na visão geral) | ✓ (card; EvolucaoAnalytics grupo "Composição corporal": peso/IMC/circ. abdominal) | — | ✓ (ramo próprio, `evaluationResultAdapter.js:269-285`) | — | parcial (só via `composicao_corporal_integrada`, ver seção 7) | — |
| 5 | Dobras cutâneas | ✓ | parcial | ✓ (card; EvolucaoAnalytics grupo "Composição": %gordura/massa magra) | — | ✓ (ramo próprio, `evaluationResultAdapter.js:250-268`) | parcial (painel "Composição corporal" do atleta mostra %gordura/massa magra agregados, sem dizer a fonte) | parcial (via integrada) | — |
| 6 | Bioimpedância | ✓ | parcial | ✓ (card; **fixo** como fonte do resumo clínico "Composição", `PRONTUARIO_SUMMARY_TYPES.COMPOSICAO`); EvolucaoAnalytics mesmo grupo | ✓ (`ClinicalEvaluationResultCard`, layout dedicado `isBioimp`) | ✓ (ramo próprio e enriquecido, `evaluationResultAdapter.js:176-249,713-733`) | parcial (mesmo painel de composição do atleta) | parcial (via integrada) | — |
| 7 | Composição corporal por imagem | ✓ (modal próprio) | — (fora da hierarquia, por decisão) | ✓ (card dashboard) | — | **parcial** (professor: cartão genérico "Sem resumo clínico padronizado", sem valor — `evaluationResultAdapter.js:655-664`) | — | — | — |
| 8 | Gasto energético total | ✓ | ✓ (balanço energético usa GET; "próximos passos" cita GET sem total semanal) | ✓ (card; EvolucaoAnalytics grupo "Gasto energético": GET/TMB) | — | ✓ (ramo próprio, `evaluationResultAdapter.js:320-361`) | — (não aparece nas abas do atleta) | ✓ (`extractGet`) | — |
| 9 | Carga de treino e periodização | ✓ | — (não entra no balanço/alertas da página) | **parcial** ("Sem indicadores configurados.", `DashboardAvaliacoes.jsx:440`, porque `carga_treino` não está em `METRIC_SPECS`) | — | ✓ (único tipo dos 3 "órfãos" que **tem** ramo em `evaluationResultAdapter.js:504-529` — aparece normalmente para o professor) | parcial (painel "Treino" do atleta mostra fase/carga/RPE, sem ACWR) | — | — |
| 10 | Avaliação alimentar (NOVA) | ✓ | ✓ (balanço energético alimentar×GET, `AvaliacaoCompleta.jsx:984-1018`) | ✓ (card dashboard) | — | ✓ (ramo próprio, `evaluationResultAdapter.js:446-476`) | parcial (painel "Alimentação" do atleta mostra só "adesão ao plano", não o padrão NOVA) | — | — |
| 11 | Hidratação | ✓ | — | ✓ (card dashboard) | — | ✓ (ramo próprio, `evaluationResultAdapter.js:477-503`) | parcial (painel "Hidratação" do atleta: status + perda de peso + sede percebida) | — | — |
| 12 | Psicologia | ✓ | — (PHQ-9/GAD-7 não entram no balanço/alertas da página) | ✓ (card dashboard) | — | ✓ (ramo próprio, `evaluationResultAdapter.js:575-589`) | — (nenhuma tela do atleta mostra PHQ-9/GAD-7/humor) | ✓ (`extractPsicologia`, inclui PHQ-9/GAD-7 e texto livre) | ✓ (`handlePsicologia`, mensagem genérica) |
| 13 | Fisioterapia | ✓ | — | ✓ (card dashboard) | — | ✓ (ramo próprio, `evaluationResultAdapter.js:560-574`) | — (não aparece nas abas do atleta; só o "ponto" na timeline de autorrelato) | — | — |
| 14 | Triagem RED-S | ✓ | ✓ (único aviso real: diálogo "estabelecido" antes do plano) | **parcial** ("Sem indicadores configurados.", mesma causa do item 9) | — | **parcial** (professor: cartão genérico sem DE/classificação — `evaluationResultAdapter.js:655-664`; é o único dos 3 tipos "órfãos" que também já falhava no prontuário, agravando o mesmo indicador em 2 lugares) | — | ✓ (`extractReds`) | ✓ (`handleReds`, mensagem genérica) |
| 15 | Exames laboratoriais | ✓ | ✓ (card de insights + alerta cruzado se alterado) | ✓ (card dashboard) | — | ✓ (ramo próprio, `evaluationResultAdapter.js:590-625`) | — | ✓ (tabela `extractLab`, até 20 analitos) | ✓ (`handleLab`, mensagem genérica) |
| 16 | Evolução e retorno | ✓ | ✓ (alertas cruzados: metas zeradas, adesão baixa) | ✓ (card; EvolucaoAnalytics grupo "Adesão") | — | ✓ (ramo próprio, `evaluationResultAdapter.js:626-653`) | — | ✓ (`extractEvolucao`) | — |
| 17 | Plano de metas | ✓ | — | **parcial** (não está em `METRIC_SPECS`; mesma causa, mas aqui é mais aceitável — é texto livre motivacional) | — | **parcial** (professor: mesmo cartão genérico de fallback — `evaluationResultAdapter.js:655-664`; aqui é mais aceitável, igual ao prontuário) | — | — (fora do `TIPO_ORDER` do PDF) | — |

**Painel do professor (lido com mais profundidade agora):** `ProfessorDashboard.jsx` importa e usa `ClinicalEvaluationResultCard`/`EvaluationSummaryStrip`/`buildEvaluationResultCollection` (`src/views/professor/ProfessorDashboard.jsx:32,33,38`) dentro do painel de métricas ("Avaliações realizadas (mês)" e "Avaliações pendentes", linhas 634-764): cada avaliação da lista vira uma linha com nome do atleta + data/status (botão) e, ao lado, um `ClinicalEvaluationResultCard` compacto com o resultado (linhas 693-723 e 734-764). **Achado confirmado:** `normalizeEvaluationResult` (`src/components/shared/evaluationResultAdapter.js:705-750`) só tem ramo dedicado para 15 dos 17 tipos (todos, exceto `triagem_reds`, `composicao_corporal_imagem` e `plano_metas` — confirmado varrendo todos os `if (type === ...)` do arquivo, linhas 176-626 e 823-1026). Para esses 3 tipos, cai no fallback genérico (`evaluationResultAdapter.js:655-664`): `title: 'Resultado principal'`, `value: null`, `classification: 'Sem classificação'`, `interpretation: 'Tipo {typeLabel} sem resumo clinico padronizado.'`. Ou seja: quando uma Triagem RED-S (ou Composição por imagem, ou Plano de metas) aparece na lista de "avaliações realizadas/pendentes" do professor, o cartão ao lado mostra só esse texto genérico — **nenhum valor de DE, classificação RED-S ou LEAF-Q chega a essa tela**, mesmo já calculado. É a mesma lacuna de `METRIC_SPECS` (seção 4.9/4.14), agora confirmada numa **terceira** peça de infraestrutura de indicadores (depois de `DashboardAvaliacoes.METRIC_SPECS` e da ausência de ícone em `ICONS_BY_TYPE`).

**Painéis de aluno e admin (não aprofundados):** confirmei por `Grep` que `StudentDashboard.jsx` **não** importa `ClinicalEvaluationResultCard`/`EvaluationSummaryStrip`/`evaluationResultAdapter` (o painel do aluno/interno parece ser agenda-first; resultados individuais ficam no prontuário, já coberto nas seções 3–5) e que nada em `src/views/admin/**` importa esses três símbolos — os relatórios do admin (`ReportsPage`) são agregados institucionais (contagens pela população, não o resultado individual de uma avaliação específica). Não abri `ReportsPage` por dentro para confirmar como ele resume avaliações agregadamente; isso fica nos limites (seção 11).

---

## 4. Seção por avaliação

Formato por avaliação: o que ela produz, onde aparece (com linha), e um veredito curto sobre ajuda/atrapalha a leitura — não sobre entrar ou não automaticamente na prescrição (ver `docs/implementacao/avaliacoes-v2/analise-conceitual.md` para o critério completo, que mantenho aqui).

### 4.1 Anamnese inicial
Resultados: flags de risco (comorbidade, comportamento alimentar, polifarmácia, sono, estresse, tabagismo, álcool, sedentarismo, ciclo menstrual irregular) com `severity`/`referrals`; `scoreRisco`/`prioridade`.
- **Formulário:** 4 abas (`AnamneseInicialForm.jsx`, estrutura preservada pela onda — não reconferi linhas exatas hoje).
- **Prontuário:** card no `DashboardAvaliacoes` (chave `anamnese_inicial` em `METRIC_SPECS`, `DashboardAvaliacoes.jsx:65-69`: Queixa/Risco/Prioridade); dados declarados pelo atleta e resumo clínico em `ResumoClinico.jsx` (lido hoje por inteiro) — campos vazios ficam ocultos por padrão com um botão "Ver N campos não preenchidos" (`ResumoClinico.jsx:70-78,222-233`) e os que aparecem mostram "—" quando vazios (`ResumoClinico.jsx:212`), nunca 0 — bom exemplo de ausência tratada corretamente.
- **Relatório PDF:** `extractAnamnese` (`relatorio-clinico.service.ts:37-48`) imprime objetivo/histórico/modalidade como texto livre.
- **Atleta:** não vê as flags de risco nem o score — confirmado por leitura completa de `AthleteVisaoGeral.jsx` e `AthleteTabAcompanhamento.jsx` (nenhuma menção a anamnese/risco/queixa).
- **Veredito:** ajuda, com a mesma ressalva da análise anterior (flags de segurança sem destaque visual dentro do próprio formulário — não reconferida hoje).

### 4.2 Avaliação clínica
Resultados: PA/FC/glicemia classificados (SBC 2020), `redFlagsCount`, `prioridadeCuidado`.
- **Formulário:** card "Red flags" com `valueDisplay={formatMetricValue(redFlags.length, 'alertas', 0)}` (`src/components/Avaliacoes/clinica/AvaliacaoClinicaForm.jsx:889-900`) — **confirmado hoje**: com formulário vazio, `redFlags.length === 0` e o card mostra literalmente **"0 alertas"**, com classificação textual "Sem alertas" em tom `success` (verde) logo ao lado (linhas 892-898). O texto "Sem alertas" evita a leitura de "0 = sem dado", mas o valor numérico em si é exatamente o antipadrão citado no contrato ("0 alertas" é um dos exemplos explícitos a evitar). Diferença entre "formulário vazio" e "formulário preenchido com zero red flags de fato" não é distinguida visualmente.
- **Prontuário:** card (`METRIC_SPECS.avaliacao_clinica`, `DashboardAvaliacoes.jsx:70-74`: PA/FC/HAS); `EvolucaoAnalytics` grupo "Clínico" com PAS/PAD/FC (`EvolucaoAnalytics.jsx:99-132`).
- **Relatório PDF:** `extractClinica` (`relatorio-clinico.service.ts:50-64`) — PA, FC, peso, estatura.
- **Atleta:** não vê PA/FC/HAS em nenhuma aba (confirmado pela leitura completa das telas do atleta).
- **Veredito:** ajuda na organização (seções com prioridade visual, classificação com referência), mas o "0 alertas" é um ponto de exibição a corrigir (ver seção 5).

### 4.3 Socioeconômica (EBIA)
Resultados: `pontuacaoEBIA`, `classificacaoLabel` (14 ou 8 itens).
- **Formulário:** segundo o relatório da Onda C (`docs/implementacao/avaliacoes-v2/change-intent.md:208`), a EBIA sem respostas passou a mostrar "—" em vez de "0 pontos · Segurança Alimentar" — **não reconferi essa linha hoje**, cito como reportado pela onda.
- **Prontuário:** card (`METRIC_SPECS.avaliacao_socioeconomica`, `DashboardAvaliacoes.jsx:85-89`: EBIA/Pontuação/Faixa).
- **Atleta:** preenche via `AthleteEbiaModal.jsx` (autorrelato) mas não há evidência de que o resultado/classificação seja mostrado de volta a ele em nenhuma tela lida.
- **Relatório PDF:** EBIA **não está** em `TIPO_ORDER` nem tem função `extract*` própria em `relatorio-clinico.service.ts:165-199` — cai no ramo genérico (linhas 369-373: mostra só `av.classificacao` se existir, senão "Dados registrados. Consulte o prontuário eletrônico para detalhes.").
- **Veredito:** ajuda quando consultada; fica fora do PDF clínico e fora da visão geral da página de avaliação (fato, não necessariamente defeito, já que EBIA é contexto social, não meta nutricional).

### 4.4 Perímetros
Resultados: IMC, RCQ, índice cintura-estatura, conicidade, %gordura YMCA.
- **Cálculo com bug confirmado hoje:** a equação YMCA de %gordura é aplicada com cintura em cm e peso em kg (`src/services/calculationEngine.js:322-325`), mas foi calibrada em polegadas/libras — está **duplicada** em `src/components/Avaliacoes/Antropometria/PerimetrosCorporaisForm.jsx:2661-2667` (`computeYmcaPercentFat`), com a mesma fórmula. Isso é um erro de **cálculo**, não de exibição — mas o resultado que chega à tela pode ser um número sem sentido fisiológico (a análise de 27/09 mediu ~345% com dados plausíveis). Incluo aqui porque afeta diretamente o que a tela mostra, mas separo da lista de problemas de exibição (seção 5) por ser lógica, não marcação.
- **Prontuário:** card (`METRIC_SPECS.perimetros`, `DashboardAvaliacoes.jsx:55-59`: IMC/Cintura/RCQ); `EvolucaoAnalytics` grupo "Composição corporal" (peso/IMC/circ. abdominal, `EvolucaoAnalytics.jsx:40-67`).
- **Atleta:** peso aparece agregado no painel "Composição corporal" do atleta (`AthleteTabAcompanhamento.jsx:167-187`), sem indicar que a fonte é Perímetros especificamente (o painel mistura peso/%gordura/massa magra de fontes diferentes sob um único rótulo "Composição corporal" — ver seção 5 sobre fonte não declarada).
- **Veredito:** ajuda, com a ressalva (já na análise anterior) do IMC sem ressalva para atleta e, agora, com o bug de cálculo do YMCA confirmado e ainda presente.

### 4.5 Dobras cutâneas
Resultados: %gordura/massa magra via Siri/Brozek, soma de dobras.
- **Prontuário:** card (`METRIC_SPECS.dobras_cutaneas`, `DashboardAvaliacoes.jsx:50-54`); `EvolucaoAnalytics` grupo "Composição corporal" junto com Bioimpedância (`EvolucaoAnalytics.jsx:69-96`) — o gráfico/tabela de %gordura e massa magra mistura as duas fontes sob o mesmo rótulo de métrica, sem indicar qual registro veio de qual instrumento (ver seção 5).
- **Atleta:** %gordura/massa magra aparecem agregados no painel "Composição corporal" (`AthleteTabAcompanhamento.jsx:173-183`), sem indicar fonte.
- **Veredito:** ajuda; mantenho a ressalva da análise anterior sobre o protocolo não aparecer junto do valor no card — não reconferi a linha exata hoje.

### 4.6 Bioimpedância
Resultados: %gordura, massa magra, água corporal, TMB do aparelho, ângulo de fase.
- **Prontuário — inconsistência confirmada hoje:** `PRONTUARIO_SUMMARY_TYPES.COMPOSICAO` continua fixo em `'bioimpedancia'` (`src/components/Prontuario/DashboardAvaliacoes.jsx:117-123`, especificamente linha 121: `COMPOSICAO: 'bioimpedancia'`), usado para resolver o card de "Composição" do resumo clínico (`resolveLatestByType(byType, PRONTUARIO_SUMMARY_TYPES.COMPOSICAO)`, linha 906). Ou seja: mesmo que o profissional tenha escolhido Dobras cutâneas como fonte oficial na composição corporal integrada, esse card específico do resumo clínico sempre busca o último registro de **bioimpedância**, não a fonte oficial. Esse é o mesmo achado da análise de 27/09, ainda presente, com linha atualizada.
- **Componente compartilhado:** `ClinicalEvaluationResultCard.jsx` tem um layout dedicado (`isBioimp`, linhas 46-132) com métricas primárias/secundárias, chip de distância da meta (`targetDiff`, linhas 48-50,75-79) e detalhes expansíveis (água/peso, água/massa magra, alvo de %gordura e peso) — é o card mais elaborado dos 17 tipos.
- **Veredito:** ajuda; a inconsistência do card fixo em bioimpedância é real e seria simples de corrigir (ver seção 9).

### 4.7 Composição corporal por imagem
Resultados: %gordura/massa gorda/massa magra por IA a partir de fotos — rotulada `body3d_experimental_v1`.
- **Fora da hierarquia de composição integrada por decisão** (não entra em `calculateIntegratedBodyComposition`) — correto dado o estágio experimental.
- **Prontuário:** card próprio (`METRIC_SPECS.composicao_corporal_imagem`, `DashboardAvaliacoes.jsx:110-114`).
- **Atleta:** modal próprio, fora do fluxo das outras 16 abas (mantém-se como descrito em 27/09).
- **Veredito:** neutra, como na análise anterior.

### 4.8 Gasto energético total
Resultados: TMB (agora calculada no próprio módulo, ver seção 2), GET, PAL real vs. subjetivo, metas calóricas.
- **Mudança confirmada (WI-007):** a TMB não vem mais da composição corporal integrada; vem do próprio formulário (`GastoEnergeticoTotalForm.jsx:281-292`).
- **Defeito de cálculo confirmado pelo relatório da onda, não reconferido por mim linha a linha hoje:** com o registro semanal de atividades vazio, `sumGastoSemanal` retorna 0, o que faz `palRealCalculado` valer 1,0 e vencer o fator de atividade escolhido no select — o GET sai igual à TMB×1,0 e o campo "Nível de atividade" perde efeito; esse 0 e esse 1,0 vão para o dado salvo (`docs/implementacao/telas-v2/change-intent.md:224`, que cita isso como "preexistente, igual na versão de 27/09").
- **Visão geral da página:** o balanço energético (Alimentar × GET) usa o GET estimado (`AvaliacaoCompleta.jsx:984-1018,1073-1092`) e aparece como card com rótulo e tom (`AvaliacaoCompleta.jsx:2969-2992`).
- **Relatório PDF:** `extractGet` (`relatorio-clinico.service.ts:82-95`) — GET, TMB, fator de atividade.
- **Veredito:** ajuda; mantenho a ressalva de 27/09 sobre a fórmula padrão (Henry vs. Cunningham) — não reconferi o parâmetro `context: 'atleta'` hoje, então não confirmo se esse ponto específico mudou.

### 4.9 Carga de treino e periodização
Resultados: carga diária/semanal, monotonia, strain, ACWR classificado.
- **Confirmado hoje: o card do "Painel de avaliações" não tem indicador configurado.** `carga_treino` não aparece em `METRIC_SPECS` (`src/components/Prontuario/DashboardAvaliacoes.jsx:44-115`, lista completa: bioimpedancia, dobras_cutaneas, perimetros, gasto_energetico_total, anamnese_inicial, avaliacao_clinica, alimentar, hidratacao, avaliacao_socioeconomica, fisioterapia, psicologia, exames_laboratoriais, evolucao_retorno, composicao_corporal_imagem — 14 tipos, faltam `carga_treino`, `triagem_reds` e `plano_metas`). O card cai no texto literal **"Sem indicadores configurados."** (`DashboardAvaliacoes.jsx:440`), mesmo depois do ACWR já calculado — é exatamente a lacuna já registrada em 27/09, ainda presente hoje, com a mesma causa (tabela de specs incompleta).
- **Atleta:** painel "Treino" mostra fase/carga semanal/RPE médio (`AthleteTabAcompanhamento.jsx:221-237`), mas não mostra o ACWR nem sua classificação de risco.
- **Veredito: atrapalha por omissão**, igual à análise anterior — é o indicador mais ligado a risco de lesão do sistema e o único lugar "central" (painel do prontuário) onde ele deveria aparecer resumido continua vazio.

### 4.10 Avaliação alimentar (NOVA)
Resultados: % de cada categoria NOVA, classificação do padrão (saudável/moderado/risco/alto risco).
- **Visão geral da página:** sinal de divergência entre ingestão (desta avaliação) e GET, calculado em `AvaliacaoCompleta.jsx:984-1018` e mostrado como alerta cruzado (déficit/superávit >500 kcal).
- **Atleta:** painel "Alimentação" mostra só "adesão ao plano" (`AthleteTabAcompanhamento.jsx:209-219`) — a classificação NOVA em si (padrão saudável/moderado/risco) não aparece nessa tela do atleta.
- **Veredito:** ajuda, como em 27/09.

### 4.11 Hidratação
Resultados: perda de peso %, taxa de sudorese, classificação de desidratação.
- **Defeito relatado pela onda, não reconferido hoje linha a linha:** com ganho de peso (peso depois > peso antes), perda/taxa de sudorese/meta de reposição aparecem negativos (ex. "-600 ml") (`docs/implementacao/avaliacoes-v2/change-intent.md:234`).
- **Atleta:** painel "Hidratação" mostra status + perda de peso % + "sede percebida" (autorrelato) (`AthleteTabAcompanhamento.jsx:189-207`).
- **Veredito:** ajuda quando os valores fazem sentido; o caso de ganho de peso é uma leitura claramente errada quando ocorre.

### 4.12 Psicologia
Resultados: PHQ-9 (0–27), GAD-7 (0–21), com corte ≥10; campos de risco de compulsão/sinais de alerta em texto livre.
- **Relatório PDF:** `extractPsicologia` (`relatorio-clinico.service.ts:128-143`) imprime PHQ-9/GAD-7 com severidade e **até 200 caracteres de observações livres** (linha 141) — é o tipo com mais conteúdo sensível exposto no PDF.
- **Alerta clínico — achado novo (não estava na análise de 27/09):** `ClinicalAlertsService.handlePsicologia` (`server/src/avaliacoes/clinical-alerts.service.ts:148-165`) monta um array `parts` com os valores exatos de PHQ-9/GAD-7 (linhas 152-157), mas **nunca usa essa variável** — a notificação enviada à equipe é sempre o texto genérico fixo da linha 161-163 ("Há uma avaliação que requer atenção..."). O mesmo padrão se repete em `handleReds` (variável `label` calculada na linha 120 e nunca usada na mensagem da linha 122-125) e `handleLab` (variável `parts` calculada nas linhas 133-139 e nunca usada na mensagem da linha 141-144). Ou seja: o único canal de notificação push do sistema para achados clínicos relevantes **descarta o dado específico antes de notificar** — quem recebe o alerta sabe que "há algo para revisar", mas não sabe o quê, obrigando a abrir o registro para descobrir.
- **Atleta:** nenhuma tela do atleta lida menciona PHQ-9/GAD-7/humor/estresse.
- **Veredito:** neutra/atrapalha, como em 27/09 (falta de destaque visual nos campos de risco dentro do próprio formulário — não reconferido hoje), mais o achado novo do alerta genérico.

### 4.13 Fisioterapia
Resultados: registro estruturado (queixa, dor, mobilidade, sessões, condutas); sem score numérico.
- **Defeito relatado pela onda, não reconferido hoje:** a tabela de perimetria usa o nome do segmento como chave de linha, então cada tecla digitada remonta a linha e tira o foco do campo (`docs/implementacao/avaliacoes-v2/change-intent.md:201`).
- **Atleta:** só aparece como um ponto na timeline de "Meus auto-relatos" quando a fisioterapia foi preenchida pelo próprio atleta (`AthleteTabAcompanhamento.jsx:93-98,139-157`, token `fisioterapia` no dicionário `EVAL_TYPE_DOTS`); não há painel de resultado clínico de fisioterapia nas abas do atleta.
- **Veredito:** neutra, como em 27/09.

### 4.14 Triagem de disponibilidade energética (RED-S)
Resultados: DE (kcal/kg MLG), classificação (ótima/risco relativo/estabelecido), LEAF-Q/LEA-Q13.
- **Confirmado hoje: mesma lacuna do painel principal que a Carga de treino.** `triagem_reds` também está fora de `METRIC_SPECS` (lista completa citada em 4.9) — o card cai em "Sem indicadores configurados." (`DashboardAvaliacoes.jsx:440`), apesar de a DE e a classificação já estarem calculadas.
- **Confirmado hoje: o aviso de prescrição só dispara para "estabelecido".** `shouldWarnRedsPrescricao = triagemRedsClassificacao === 'reds_estabelecido'` (`AvaliacaoCompleta.jsx:757`) — a faixa "risco_relativo" (DE 30–45) não aciona nenhum aviso equivalente, nem na navegação (`handleOpenPlanoAlimentar`, linhas 2053-2067) nem no card do painel (que fica vazio, ver acima). O diálogo de confirmação em si continua bem desenhado: título "Alerta RED-S — Disponibilidade Energética Crítica" (linha 1907 e 2058), mensagem com o valor de corte (`REDS_PRESCRICAO_WARNING`, linha 199), botão "Abrir plano mesmo assim" (linha 2060) e registro de override (linhas 1817-1879, `reason: 'prescricao_dieta_override_reds_estabelecido'`, linha 1841).
- **Alerta clínico ao professor/equipe:** `handleReds` dispara notificação quando a classificação contém "risco" (`isRedsRisk`, `clinical-alerts.service.ts:31-38`, que também cobre tokens de risco moderado/subclínico) — então, diferente do aviso de navegação, a notificação à equipe **cobre uma faixa mais ampla que só "estabelecido"**. Mas, como descrito em 4.12, a mensagem enviada é genérica (a classificação calculada em `label`, linha 120, não é usada no texto).
- **Veredito:** ajuda fortemente no caso "estabelecido" (aviso com trilha de auditoria); atrapalha por omissão no painel principal e na faixa "risco_relativo" na navegação.

### 4.15 Exames laboratoriais
Resultados: status por analito (alterado/limítrofe/normal/sem_classificacao), `scoreRisco` do painel.
- **Bug confirmado hoje, com linha atual — o aviso de conduta pode classificar errado um painel com analito alterado.** Em `AvaliacaoExamesLaboratoriais.jsx:500-529` (`condutaLabStatus`), o primeiro teste (linha 503) procura os tokens `'critico'`/`'alto'` dentro da classificação; mas a classificação real do painel (`statusPainel`, obtida em `exames-laboratoriais-normalizer.ts:136-142`) só assume os valores `'alterado'`, `'limitrofe'`, `'normal'` ou `'sem_classificacao'` (`server/src/avaliacoes/exames-laboratoriais-normalizer.ts:49,56,136-142`) — **nenhum desses contém "critico" ou "alto"**. Então esse primeiro teste só é satisfeito via `scoreRisco >= 70` (linha 503), nunca pelo texto da classificação. O segundo teste (linha 510) já foi corrigido para reconhecer `'limitro'` (bate com `'limitrofe'`), mas ainda não reconhece `'alterado'`. **Resultado prático:** um painel com 1 analito alterado entre vários normais (`scoreRisco = (1×2)×10 = 20`, abaixo dos dois limiares de 70 e 40) cai no `else` da linha 517 e mostra **"Exames consistentes para conduta"** (tom `ok`, verde) — a leitura mais tranquilizadora possível, exatamente quando há um analito fora da referência. Isso é diferente do que a visão geral da página mostra para o mesmo dado (que sinaliza corretamente analitos alterados como alerta `danger`, `AvaliacaoCompleta.jsx:961-972`) — ou seja, **dois lugares do sistema avaliam o mesmo painel de exames com conclusões opostas**.
- **Prontuário:** card (`METRIC_SPECS.exames_laboratoriais`, `DashboardAvaliacoes.jsx:100-104`: Analitos/Alterados/Painel).
- **Relatório PDF:** `extractLab` monta uma tabela com até 20 analitos, nome/valor/status, com cor por status (`relatorio-clinico.service.ts:111-126,294-306`: vermelho se contém "alterado", laranja se "limitrofe").
- **Alerta clínico:** `handleLab` dispara se `scoreRisco >= 40` ou `alteracoesCount > 0` (`clinical-alerts.service.ts:130`) — este teste usa a contagem numérica diretamente, não o texto, então **não tem o mesmo bug** do `condutaLabStatus` do formulário; mas a mensagem enviada também é genérica (ver 4.12).
- **Veredito:** atrapalha por omissão/erro — o selo de conduta dentro do próprio formulário pode mostrar "tudo bem" quando não está.

### 4.16 Evolução e retorno
Resultados: `scoreAdesaoGeral` (ponderação 50/35/15), `prioridadeRetorno`.
- **Bug de cálculo confirmado hoje, com linha atual — ausência tratada como 0.** Em `server/src/avaliacoes/evolucao-retorno-normalizer.ts:110-114`, o `computedScore` soma `(adesaoPlanoAlimentar ?? 0) × 0,5 + (adesaoAtividadeFisica ?? 0) × 0,35 + (responseScore ?? 0) × 0,15` — quando os três campos estão vazios (formulário não preenchido), o resultado não é "sem dado", é **0**. Daí `scoreAdesaoGeral = 0` (linha 116) e `prioridadeRetorno = 'alta'` (linha 119-123, porque `0 < 50`). Um formulário de Evolução em branco produz, matematicamente, o mesmo resultado que o pior caso real (adesão zero), com prioridade "alta" de retorno — isso é lógica de cálculo, não só exibição, mas o efeito visível é o card mostrando "0%" e prioridade alta sem nenhum dado real por trás.
- **Classificação crua na tela:** se `classifications?.prioridadeRetorno` vier vazio, o fallback no formulário é o literal `'sem_classificacao'` (`src/components/Avaliacoes/avaliacao-evolucao-retorno/AvaliacaoEvolucaoRetorno.jsx:173-174,215`) — um código interno aparecendo como texto, sem tradução para um rótulo legível.
- **Prontuário:** card (`METRIC_SPECS.evolucao_retorno`, `DashboardAvaliacoes.jsx:105-109`: rótulo "Aplicação da Dieta" para um score que mistura dieta+atividade física+resposta percebida — mesma observação de nome enganoso já feita em 27/09); `EvolucaoAnalytics` grupo "Adesão" (`EvolucaoAnalytics.jsx:171-191`).
- **Relatório PDF:** `extractEvolucao` (`relatorio-clinico.service.ts:145-161`) imprime o score, adesões, conduta e próxima avaliação.
- **Veredito:** ajuda quando preenchida de verdade; atrapalha quando vazia, porque o sistema não distingue "sem dado" de "pior caso" — e isso é visível tanto no card quanto no texto cru "sem_classificacao".

### 4.17 Plano de metas
Resultados: nenhum score — registro qualitativo de entrevista motivacional.
- **Confirmado: fora de `METRIC_SPECS`** (lista citada em 4.9) — cai em "Sem indicadores configurados.", mas aqui isso é menos grave (não há de fato um número a resumir).
- **Relatório PDF:** fora de `TIPO_ORDER`/extratores (`relatorio-clinico.service.ts:165-199`) — cai no ramo genérico.
- **Veredito:** neutra, como em 27/09.

---

## 5. Consistência entre lugares

Achados que cruzam mais de um lugar de exibição:

1. **Card "Composição corporal" do resumo clínico fixo em bioimpedância**, mesmo quando a fonte oficial escolhida na composição integrada é outra (ex. dobras cutâneas). `PRONTUARIO_SUMMARY_TYPES.COMPOSICAO = 'bioimpedancia'` (`DashboardAvaliacoes.jsx:121`), usado em `resolveLatestByType(byType, PRONTUARIO_SUMMARY_TYPES.COMPOSICAO)` (linha 906). Confirmado hoje, mesma linha de raciocínio da análise de 27/09.
2. **%gordura/massa magra de Dobras e Bioimpedância aparecem fundidos num único grupo "Composição corporal" em dois lugares** sem indicar a fonte: `EvolucaoAnalytics.jsx:69-96` (gráfico/tabela do prontuário) e `AthleteTabAcompanhamento.jsx:167-187` (painel do atleta). Em ambos os casos, o rótulo da métrica é genérico ("Gordura", "% Gordura") e não diz se o número veio de Dobras ou de Bioimpedância — duas fontes com métodos e margens de erro diferentes tratadas como uma série contínua.
3. **O mesmo painel de exames laboratoriais recebe conclusões opostas em dois lugares do próprio sistema:** a visão geral da página (`AvaliacaoCompleta.jsx:961-972`) sinaliza corretamente um analito alterado como alerta `danger`; o aviso de conduta dentro do formulário de Exames (`AvaliacaoExamesLaboratoriais.jsx:500-529`) pode mostrar "Exames consistentes para conduta" (verde) para o mesmo registro, por causa do descasamento de tokens já descrito em 4.15.
4. **Notificações push (alertas clínicos ao professor/equipe) descartam o dado específico que motivou o alerta** em todos os 3 tipos que a disparam (RED-S, exames, psicologia) — `clinical-alerts.service.ts:120,133-139,152-157` calculam o detalhe e depois usam mensagens fixas genéricas (linhas 122-125,141-144,160-163). A pessoa recebe "há algo para revisar", nunca "o quê".
5. **`DOMAIN_BY_TYPE` do `ClinicalEvaluationResultCard.jsx:8-23`** usa chaves (`avaliacao_alimentar`, `registro_consumo`, `avaliacao_fisioterapia`, `avaliacao_psicologia`) que **não batem** com os tokens reais do catálogo (`alimentar`, `fisioterapia`, `psicologia`, confirmados em `server/src/avaliacoes/evaluation-registry.ts`). Na prática, `domain` sai `null` para esses três tipos quando exibidos por esse card, e o atributo `data-domain` (provável gancho de estilo por domínio) nunca é aplicado a eles — inconsistência pequena, mas real, entre o dicionário do componente compartilhado e o catálogo oficial.
6. **`EvolucaoAnalytics` (gráficos/tabela longitudinal do prontuário) cobre só 6 dos 17 tipos** (perímetros, dobras cutâneas, bioimpedância, avaliação clínica, gasto energético total, evolução/retorno — `GROUP_CONFIGS`, `EvolucaoAnalytics.jsx:35-192`), enquanto o catálogo marca `supportsLongitudinalComparison: true` para a maioria dos 17 tipos (`server/src/avaliacoes/evaluation-registry.ts`, campo presente em quase todos, `false` só em `anamnese_inicial:38`). Socioeconômica, hidratação, psicologia, fisioterapia, RED-S, exames, carga de treino, composição por imagem e plano de metas são marcados como "comparáveis ao longo do tempo" no catálogo, mas não têm gráfico nem tabela na tela de evolução do prontuário.
7. **`DashboardAvaliacoes.METRIC_SPECS` (14 tipos) e o catálogo de 17 tipos divergem nos mesmos 3 tipos** (`carga_treino`, `triagem_reds`, `plano_metas`) em que falta configuração — mesma lacuna aparece em `ICONS_BY_TYPE` (`DashboardAvaliacoes.jsx:27-42`, também sem ícone para esses 3).
8. **A mesma lacuna de 3 tipos se repete numa terceira peça de infraestrutura, de forma quase idêntica:** `normalizeEvaluationResult` (`src/components/shared/evaluationResultAdapter.js:176-653`, usado pelo painel do professor via `ClinicalEvaluationResultCard`) só tem ramo dedicado para 15 tipos — faltam exatamente `triagem_reds`, `composicao_corporal_imagem` e `plano_metas` (confirmado varrendo todos os `if (type === ...)` do arquivo). Para esses 3, o fallback genérico (`evaluationResultAdapter.js:655-664`) mostra "Sem classificação"/"Tipo {label} sem resumo clinico padronizado.", sem nenhum valor. **RED-S é o único dos 17 tipos que falha nas duas peças ao mesmo tempo** (painel do prontuário e painel do professor) — o indicador mais ligado a risco de disponibilidade energética fica sem resumo numérico em ambos os lugares centrais do sistema, mesmo com DE e classificação já calculadas no próprio registro.

---

## 6. Problemas de exibição (tabela)

Critérios do contrato (`contrato-avaliacao.md`, seção 5): "—" para ausência (nunca 0), classificação sempre escrita, unidade visível, referência presente, sem código cru, sem texto sem acento como conteúdo permanente de interface.

| Lugar | Problema | arquivo:linha | Gravidade |
|---|---|---|---|
| Avaliação clínica (formulário) | Formulário vazio mostra "0 alertas" / "Sem alertas" (verde) — ausência tratada como contagem zero confirmada | `src/components/Avaliacoes/clinica/AvaliacaoClinicaForm.jsx:889-900` | Média (a classificação escrita mitiga, mas o valor numérico viola o contrato) |
| Exames laboratoriais (formulário) | Aviso de conduta pode mostrar "Exames consistentes para conduta" (verde) com analito alterado presente, por descasamento de tokens (`'critico'/'alto'` vs. `'alterado'`) | `src/components/Avaliacoes/avaliacao-exames-laboratoriais/AvaliacaoExamesLaboratoriais.jsx:500-529`; tokens em `server/src/avaliacoes/exames-laboratoriais-normalizer.ts:49,56,136-142` | Alta (classificação textual incorreta, não só estética) |
| Evolução e retorno (cálculo servidor) | Ausência de adesão alimentar/atividade/resposta tratada como 0 no cálculo ponderado; formulário vazio produz `scoreAdesaoGeral=0` e `prioridadeRetorno='alta'` | `server/src/avaliacoes/evolucao-retorno-normalizer.ts:110-123` | Alta (é cálculo, não só exibição, mas o efeito é "0%"/"alta" sem dado real) |
| Evolução e retorno (formulário) | Classificação crua `'sem_classificacao'` aparece como texto quando ausente | `src/components/Avaliacoes/avaliacao-evolucao-retorno/AvaliacaoEvolucaoRetorno.jsx:173-174,215` | Média |
| Perímetros (cálculo, reflete na tela) | %gordura YMCA calculado com fórmula calibrada em polegadas/libras, aplicada com cm/kg — pode exibir percentuais sem sentido fisiológico | `src/services/calculationEngine.js:322-325`; duplicado em `src/components/Avaliacoes/Antropometria/PerimetrosCorporaisForm.jsx:2661-2667` | Alta (erro de cálculo, não de marcação — mas é o que a tela mostra) |
| Gasto energético total (cálculo) | Registro semanal vazio → gasto semanal=0 → PAL real=1,0 → anula o fator de atividade escolhido; 0 e 1,0 vão para o dado salvo | reportado em `docs/implementacao/telas-v2/change-intent.md:224`; não reconferido linha a linha hoje | Média (não verifiquei a linha atual do `GastoEnergeticoTotalForm.jsx`) |
| Hidratação (cálculo) | Ganho de peso produz perda/taxa de sudorese/meta de reposição negativos (ex. "-600 ml") | reportado em `docs/implementacao/avaliacoes-v2/change-intent.md:234`; não reconferido hoje | Média |
| Prontuário — Composição (resumo clínico) | Card sempre lê `bioimpedancia`, mesmo quando a fonte oficial da composição integrada é outra | `src/components/Prontuario/DashboardAvaliacoes.jsx:117-123` (`COMPOSICAO`), uso em linha 906 | Alta (dois números diferentes com o mesmo rótulo "composição corporal") |
| Prontuário — Painel de avaliações | "Sem indicadores configurados." para Carga de treino e RED-S, apesar de ACWR/DE já calculados; mesmo para Plano de metas (aqui, menos grave) | `src/components/Prontuario/DashboardAvaliacoes.jsx:44-115` (specs), `:440` (texto) | Alta para Carga de treino/RED-S (ligados a risco); baixa para Plano de metas |
| Alertas clínicos (server) | Mensagem de notificação sempre genérica; classificação/score calculados e descartados antes do envio | `server/src/avaliacoes/clinical-alerts.service.ts:120,122-125,133-139,141-144,152-157,160-163` | Média (reduz a utilidade do único canal push do sistema) |
| Componente compartilhado | `DOMAIN_BY_TYPE` usa chaves que não existem no catálogo real (`avaliacao_alimentar`, `avaliacao_fisioterapia`, `avaliacao_psicologia`, `registro_consumo`) | `src/components/shared/ClinicalEvaluationResultCard.jsx:8-23` | Baixa (afeta só uma categorização de estilo, não o valor exibido) |
| Relatório clínico PDF | Rota sem restrição de role (`JwtAuthGuard` apenas); servidor permite papel `atleta` quando `atletaUserId` bate — já documentado como risco conhecido | `server/src/avaliacoes/avaliacoes.controller.ts:117-128`; `server/src/avaliacoes/relatorio-clinico.service.ts:208-224` (linha 222 cobre `atleta`); já citado em `docs/rbac-matrix.md:99` | Alta como exposição potencial; hoje sem caminho de UI confirmado (ver seção 7) |

---

## 7. Independência na exibição

A decisão do usuário (WI-007, `docs/product/construction/prontuario/organizacao_e_autonomia.md`) é clara: avaliações não são pré-requisito do plano alimentar; o prontuário pode **agregar para leitura**, com fonte e data, mas não bloquear/preencher/finalizar uma avaliação com base em outra.

**O que confirmei hoje que respeita essa regra:**
- `handleOpenPlanoAlimentar` (`AvaliacaoCompleta.jsx:2053-2067`) só interrompe a navegação para o plano por causa do RED-S "estabelecido" — e mesmo assim com escape ("Abrir plano mesmo assim"). Não há bloqueio por exames, evolução, ou qualquer combinação de `condutaContext.readyForPlano`.
- RED-S (`AvaliacaoTriagemREDS.jsx:136-184`) e GET (`GastoEnergeticoTotalForm.jsx`, ver seção 2) não leem mais resultado de outras avaliações da mesma sessão — cada um usa campo próprio ou o cadastro/contexto estável do paciente.
- `prontuarioOverview.js:131-157` gera "tarefas" (pendências) com base em **quais instrumentos são obrigatórios/solicitados para o atendimento do dia** (`OBRIGATORIAS`, `core/prontuario/estado.js`), não com base no resultado de outra avaliação — é bookkeeping de "o que falta preencher hoje", não "X depende do resultado de Y".
- `VisaoGeral.jsx` do prontuário (síntese do atendimento) mostra 4 métricas agregadas (peso, %gordura, GET, FC) sempre com `getEvaluationTypeLabel(metric.item.tipo)` e a data (`VisaoGeral.jsx:70-75`) — fonte e data visíveis, como o WI-007 pede.

**Pontos que ficam numa zona cinzenta, não uma violação clara:**
- A seção "Próximos passos" da própria página de avaliação (`nextSteps`, `AvaliacaoCompleta.jsx:2281-2370`) inclui um item `'next-module'` que sugere "Avançar para [próximo módulo pendente]" seguindo a ordem do catálogo (`nextPendingModule`) — isso é navegação sequencial sugerida, não uma trava, mas pode ler como "este módulo vem depois daquele" para quem não olha com cuidado. Não encontrei nenhum lugar em que o conteúdo ou os campos de um módulo mudem de comportamento por causa de outro módulo — apenas a ordem de sugestão de navegação na página-mãe.
- Os itens `'conduta-exames'`/`'conduta-evolucao'` (mesmas linhas) sugerem "Registrar exames laboratoriais"/"Registrar evolução e retorno" como prioridade alta quando a etapa ativa é "conduta" — de novo, é texto de sugestão de navegação na página, não uma trava de dado.

**Não verificado:** se existe alguma trava de dado dentro de um formulário individual (ex. um campo desabilitado até outro módulo estar preenchido) — não tive tempo de ler os 17 formulários por inteiro linha a linha; busquei apenas pelos padrões de leitura automática entre módulos (RED-S e GET) citados no próprio WI-007 como os dois pontos de contrato.

---

## 8. O que o atleta vê

Leitura completa de `AthleteVisaoGeral.jsx` (178 linhas) e `AthleteTabAcompanhamento.jsx` (275 linhas); leitura parcial de `AthleteEbiaModal.jsx` e `AthleteSelfEvaluationModal.jsx`.

**Desenho deliberado de separação, confirmado no próprio código:**
- `AthleteVisaoGeral.jsx:14-17`: comentário no código diz "Invariante 2 — nenhum dado a mais: tudo chega por props, já calculado pelo AthletePortal... Este componente não faz chamada nenhuma."
- `AthleteVisaoGeral.jsx:47-48`: "Ausência é nulo: se a agenda e as avaliações não carregaram, os cards dizem isso em vez de mostrar zero" — e de fato, `valor: detailsError ? null : ...` em todos os 4 indicadores (linhas 53,64,75,83), sem nenhum "0" substituindo ausência.
- `AthleteVisaoGeral.jsx:116-117`: "Resumo que leva ao Acompanhamento: só data e situação de revisão de cada domínio, **sem os valores clínicos**, que continuam naquela aba" — e de fato, os itens de `itensAcompanhamento` (linhas 118-130) só mostram título, data da última avaliação e status de revisão, nunca o valor.

**O que o atleta efetivamente vê de valores (na aba "Meu acompanhamento" / `AthleteTabAcompanhamento.jsx`):**
- Composição corporal: peso, %gordura (com variação/tendência), massa magra (linhas 167-187) — **sem indicar se o valor vem de Dobras, Bioimpedância ou Perímetros** (achado 5.2).
- Hidratação: status, perda de peso %, "sede percebida" (autorrelato) (linhas 189-207).
- Alimentação: "adesão ao plano" de 0 a 10 (linha 212-213) — não mostra a classificação NOVA (saudável/moderado/risco).
- Treino: fase, carga semanal, RPE médio (linhas 221-237) — sem o ACWR nem sua classificação de risco.
- Timeline de "Meus auto-relatos" (linhas 129-159): só data + status (enviado/concluído/revisado) + tipo, sem nenhum valor.

**O que o atleta confirmadamente NÃO vê em nenhuma das telas lidas:** PA/FC/classificação HAS (avaliação clínica), PHQ-9/GAD-7 e qualquer campo de psicologia, classificação RED-S/DE/LEAF-Q, resultados de exames laboratoriais, scoreRisco/flags da anamnese, ACWR, classificação NOVA detalhada, IMC/RCQ/índice de conicidade. Isso é compatível com boas práticas de não expor dado clínico sensível diretamente ao paciente sem mediação profissional — e, pelo que vi, é uma decisão de desenho explícita e documentada em comentário no próprio código, não um acaso.

**Risco teórico, não confirmado como acessível por UI:** o endpoint do relatório clínico em PDF (`GET /avaliacoes/paciente/:pacienteId/relatorio-clinico`, `server/src/avaliacoes/avaliacoes.controller.ts:117-128`) tem só `JwtAuthGuard`, sem checagem de papel na rota; o serviço permite o papel `atleta` quando `paciente.atletaUserId === user.id` (`relatorio-clinico.service.ts:208-224`, linha 222). Esse PDF inclui PHQ-9/GAD-7 com severidade e até 200 caracteres de observação livre (`relatorio-clinico.service.ts:136-141`), classificação RED-S/LEAF-Q (`:97-109`) e até 20 analitos de exame com status (`:111-126`) — ou seja, exatamente o conjunto de dados que as telas do atleta evitam mostrar. **Busquei em todo `src/` por uma chamada a essa rota e não encontrei nenhuma** (o único resultado fora do próprio servidor foi um arquivo solto em `.claude/worktrees/...`, que não faz parte da árvore `src/` da aplicação viva) — então, hoje, não há botão em nenhum portal (nem admin, nem professor, nem atleta) que dispare esse PDF; ele só seria alcançável por chamada direta à API. Esse ponto já está documentado como risco conhecido em `docs/rbac-matrix.md:99` ("⚠️ sem restrição de role"), então não é um achado novo — é uma confirmação de que a lacuna segue aberta no código de hoje, mas sem caminho de UI que a torne praticável por acidente no momento.

---

## 9. Quem prescreve: o que está à mão, o que falta, o que sobra

**O que chega pronto à tela de prescrição (automático):** meta calórica do GET e restrições/referência DRI da anamnese (`server/src/planos-alimentares/plano-alimentar.service.ts`, não reaberto hoje — herdado da análise de 27/09, que cito como não reconferida). Isso não mudou pelo que vi na navegação (`handleOpenPlanoAlimentar` não lê nenhum dado adicional das 17 avaliações além do que já ia para o `getPacienteContext`).

**O que está à mão, mas exige abrir outra tela:** balanço energético (alimentar × GET), analitos alterados/limítrofes, adesão da evolução, classificação EBIA, RED-S em risco relativo — todos calculados em algum lugar do sistema, nenhum deles aparece na tela de prescrição em si (nenhuma leitura encontrada em `handleOpenPlanoAlimentar`/navegação que leve esse contexto adiante).

**O que sobra, em sentido de risco de leitura, não de poluição visual:** o "Painel de avaliações" do prontuário (`DashboardAvaliacoes.jsx`) tem exatamente 17 cartões (14 com indicador, 3 sem) — não é visualmente poluído; o problema é a ausência pontual (Carga de treino, RED-S) e a inconsistência pontual (Composição = bioimpedância fixo), não excesso de números.

**Lembrete explícito do pedido:** nada disso é — nem deveria ser — pré-requisito do plano; o ponto é só se o que está disponível ajuda ou atrapalha a leitura de quem já decidiu abrir aquela avaliação.

---

## 10. Sugestões priorizadas

Separando **exibição** (marcação/classe/texto, sem mudar cálculo) de **lógica** (mudaria o dado calculado ou a regra).

### Alta prioridade

1. **[Lógica]** Corrigir o descasamento de tokens em `condutaLabStatus` (Exames): reconhecer `'alterado'` (não só `'critico'`/`'alto'`) como gatilho do tom `risk`. `src/components/Avaliacoes/avaliacao-exames-laboratoriais/AvaliacaoExamesLaboratoriais.jsx:503,510`. Esforço: baixo (ajustar a condição). Evita que um painel com analito fora da referência mostre "Exames consistentes para conduta".
2. **[Exibição]** Adicionar `carga_treino` e `triagem_reds` (e, se fizer sentido, `plano_metas`) a `METRIC_SPECS`/`ICONS_BY_TYPE` em `src/components/Prontuario/DashboardAvaliacoes.jsx:44-115,27-42` **e** um ramo dedicado para esses mesmos 3 tipos em `normalizeEvaluationResult` (`src/components/shared/evaluationResultAdapter.js:176-664`), usando os campos já calculados (ACWR/fase/sessões; DE/classificação/LEAF-Q). Esforço: baixo — são os indicadores mais ligados a risco (lesão, disponibilidade energética) e ficam invisíveis tanto no painel do prontuário quanto no painel do professor hoje; RED-S falha nos dois ao mesmo tempo.
3. **[Exibição]** Corrigir o card "Composição" do resumo clínico para acompanhar a fonte oficial da composição integrada, em vez de ficar fixo em `bioimpedancia`. `src/components/Prontuario/DashboardAvaliacoes.jsx:117-123,906`. Esforço: baixo/médio (precisa saber qual é a fonte oficial da sessão, que já existe em outro lugar do sistema).
4. **[Lógica]** Corrigir a equação YMCA de %gordura (unidades erradas: cm/kg aplicados numa fórmula calibrada em polegadas/libras). `src/services/calculationEngine.js:322-325` e a cópia em `src/components/Avaliacoes/Antropometria/PerimetrosCorporaisForm.jsx:2661-2667`. Esforço: médio (corrigir nos dois lugares e decidir se há dado histórico salvo com o valor errado). Fora do escopo de "só exibição" pedido pelo contrato visual — precisa aprovação separada, como o próprio relatório da onda já registrou.
5. **[Lógica]** Evolução/retorno: não tratar adesão/resposta ausentes como 0 no cálculo do score; usar "sem dado suficiente" quando os 3 insumos estiverem vazios, em vez de computar 0% e prioridade "alta". `server/src/avaliacoes/evolucao-retorno-normalizer.ts:110-123`. Esforço: médio.

### Média prioridade

6. **[Exibição]** Clínica: diferenciar "0 alertas, formulário vazio" de "0 alertas, formulário preenchido e confirmado" — por exemplo, só mostrar o card de Red flags depois que ao menos os campos obrigatórios estiverem preenchidos, ou trocar "0 alertas" por "—" quando não houver nenhum sinal vital digitado ainda. `src/components/Avaliacoes/clinica/AvaliacaoClinicaForm.jsx:889-900`. Esforço: baixo.
7. **[Exibição]** Indicar a fonte (Dobras/Bioimpedância/Perímetros) junto dos valores de composição corporal agregados em `EvolucaoAnalytics.jsx:69-96` e no painel "Composição corporal" do atleta (`AthleteTabAcompanhamento.jsx:167-187`), para não tratar métodos diferentes como uma série única. Esforço: médio.
8. **[Exibição]** Evolução/retorno: traduzir o fallback cru `'sem_classificacao'` para um rótulo escrito ("Prioridade não calculada" ou similar). `src/components/Avaliacoes/avaliacao-evolucao-retorno/AvaliacaoEvolucaoRetorno.jsx:173-174,215`. Esforço: baixo.
9. **[Lógica]** Incluir o detalhe calculado (classificação, score, nomes de analitos) no texto das notificações de `ClinicalAlertsService`, em vez de mensagens genéricas fixas. `server/src/avaliacoes/clinical-alerts.service.ts:120-125,133-144,152-163`. Esforço: baixo/médio (os dados já estão calculados, só não chegam ao texto).
10. **[Exibição]** Corrigir `DOMAIN_BY_TYPE` em `ClinicalEvaluationResultCard.jsx:8-23` para usar os tokens reais do catálogo (`alimentar`, `fisioterapia`, `psicologia`) em vez de variantes que não existem no registro. Esforço: baixo.
11. **[Lógica/decisão de produto]** Resolver a rota do relatório clínico sem restrição de papel (`avaliacoes.controller.ts:117-128`), já documentada em `docs/rbac-matrix.md:99`. Esforço: baixo a nível de código (adicionar guard de papel); decisão de produto sobre se o atleta deveria mesmo ter acesso a esse PDF específico.
12. **[Lógica]** Estender um aviso mais leve (sem o diálogo de confirmação) para a faixa RED-S "risco_relativo" na navegação para o plano, hoje só coberta pelo alerta à equipe (que já reconhece essa faixa) mas não pelo aviso de navegação. `AvaliacaoCompleta.jsx:757` (`shouldWarnRedsPrescricao`). Esforço: médio.

### Baixa prioridade

13. **[Exibição]** Renomear o rótulo "Aplicação da Dieta" do card de Evolução/retorno para algo que reflita a mistura de adesão alimentar + atividade física + resposta percebida. `src/components/Prontuario/DashboardAvaliacoes.jsx:105-109`. Esforço: baixo.
14. **[Lógica, fora do escopo de exibição]** Corrigir o cálculo de GET quando o registro semanal está vazio (gasto semanal=0 → PAL real=1,0 → anula o fator de atividade escolhido). Não reconferi a linha atual; reportado em `docs/implementacao/telas-v2/change-intent.md:224`. Esforço: médio.
15. **[Lógica, fora do escopo de exibição]** Corrigir Hidratação para não produzir perda/sudorese/reposição negativos em caso de ganho de peso. Não reconferido hoje; reportado em `docs/implementacao/avaliacoes-v2/change-intent.md:234`. Esforço: baixo/médio.

---

## 11. Limites da análise

- **Só leitura de código, sem executar nada** — sem `npm`, build, Vite ou navegador, por instrução explícita (a máquina está pesada). Tudo que descrevo como "aparece na tela" é inferido de JSX/props, não de uma captura real.
- **Cobertura desigual.** Aprofundei bastante em: `evaluation-registry.ts`, `contrato-avaliacao.md`, os dois `change-intent.md` de onda, `DashboardAvaliacoes.jsx`, `AvaliacaoCompleta.jsx` (trechos-chave, não as 3.603 linhas inteiras), os componentes do prontuário lidos por inteiro (`VisaoGeral.jsx`, `ResumoClinico.jsx`, `TimelineConsultas.jsx`, `ProntuarioPendencias.jsx`, `prontuarioOverview.js`, `ClinicalEvaluationResultCard.jsx`, `EvaluationSummaryStrip.jsx`), `clinical-alerts.service.ts` e `relatorio-clinico.service.ts` (ambos por inteiro), as telas do atleta citadas (lidas por inteiro). **Não abri por inteiro:** a maioria dos 17 formulários individuais (`src/components/Avaliacoes/**`, 40 mil linhas no total), `PatientProntuario.jsx` (2.280 linhas), `evaluationResultAdapter.js` (1.047 linhas, só vi as assinaturas exportadas), `EvolucaoAnalytics.jsx` além das definições de grupo, `ProfessorDashboard.jsx` além dos pontos de uso dos componentes compartilhados, `StudentDashboard.jsx` e as páginas de `admin/ReportsPage`.
- **Painel do professor foi auditado com profundidade razoável** (`ProfessorDashboard.jsx:630-764` lido por inteiro; `evaluationResultAdapter.js` varrido por inteiro para mapear os 15 tipos com ramo próprio e os 3 sem). **Painéis de aluno e admin não foram auditados célula a célula** — confirmei só que `StudentDashboard.jsx` e `src/views/admin/**` não importam os componentes compartilhados de resultado clínico (`ClinicalEvaluationResultCard`, `EvaluationSummaryStrip`, `evaluationResultAdapter`), o que sugere que resultados individuais de avaliação não passam por ali (ficam no prontuário) e que os relatórios do admin são agregados institucionais — mas não abri essas telas por dentro para confirmar como cada uma resume avaliações. Isso é a lacuna mais importante que resta nesta análise.
- **Números de linha podem ter se movido.** A onda visual (concluída em 30/09) reescreveu marcação de praticamente todos os 17 formulários; onde cito linha de um formulário individual sem ter reconferido hoje, isso vem da análise de 27/09 ou dos relatórios de onda, e pode já ter mudado de posição (a lógica deveria ser idêntica, pela invariante declarada da onda, mas não testei isso diretamente).
- **Não tive acesso a dado real de paciente** — toda descrição de comportamento com formulário vazio/preenchido é inferida da leitura do código, não observada em uso real.
- **Referências clínicas** (cortes de PA, RED-S, ACWR, EBIA, hidratação) não foram reconferidas contra a literatura original nesta rodada — onde a análise de 27/09 já marcava confiança baixa/média, mantive essa marcação sem nova verificação.
- **Separação fato/julgamento:** marquei como **[julgamento]** as poucas vezes em que interpretei intenção de design a partir de um comentário no código; o resto das afirmações de comportamento vem direto da leitura do trecho citado.
