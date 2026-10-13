> **Origem e conferência.** Esta é uma análise conceitual gerada por um agente (Sonnet) a partir da leitura do código em 27/09/2026, sem executar nada. O orquestrador conferiu no código as afirmações centrais:
>
> - `AlertaBanner.jsx` não é importado em lugar nenhum;
> - `context: 'atleta'` não é passado nas chamadas de `calculateTmbComparative`;
> - o aviso de RED-S com "Prosseguir mesmo assim" existe em `AvaliacaoCompleta.jsx` (~1982);
> - "Sem indicadores configurados" aparece em `DashboardAvaliacoes.jsx:423`;
> - `PrescricaoPlanoAlimentar` é importado em `App.jsx:31`, mas nenhuma rota o usa.
>
> **Achado acrescentado pelo orquestrador:** o GET busca a TMB na última avaliação `composicao_corporal_integrada` (`calculationEngine.js` ~2212–2233). O formulário que cria esse registro, `ComposicaoCorporalIntegradaForm.jsx`, não é montado em nenhuma tela. Sem um registro antigo, o GET só funciona com TMB manual. Isso ainda precisa ser confirmado em uso real.
>
> Os julgamentos clínicos são do agente e precisam da validação de um nutricionista. **As avaliações não são pré-requisito do plano** (decisão do usuário).

# Análise conceitual das 17 avaliações do LAINES — coleta, exibição e ligação com a prescrição

Metodologia: leitura de código (sem execução, sem dados reais), cobrindo `server/src/avaliacoes/*`, `src/services/calculationEngine.js`, os formulários em `src/components/Avaliacoes/**` e `src/views/avaliacoes/**`, os painéis de prontuário em `src/components/Prontuario/**`, a prescrição (`src/views/planos/**`, `src/core/prescricao/**`, `src/hooks/usePrescricaoApi.js`, `server/src/planos-alimentares/**`) e a documentação já existente em `docs/auditoria-2026-09-11/**` e `docs/metodologia-tecnica-tcc.md`.

Convenção: afirmações com `arquivo:linha` vêm do código. Frases marcadas **[julgamento clínico]** ou **[julgamento conceitual]** são interpretação minha, não fato extraído do código; quando cito literatura, digo isso explicitamente e sinalizo quando não tenho certeza da referência exata.

**Critério do veredito (ajuda/neutra/atrapalha):** nenhuma das 17 avaliações é pré-requisito da prescrição, e não deveria ser — cada uma existe por um propósito próprio (triagem, acompanhamento, registro interprofissional, evolução), não para "alimentar o plano alimentar". Uma avaliação **não** ser lida automaticamente pela prescrição não é, por si, um defeito. O veredito aqui julga outra coisa: **o que a avaliação mostra ajuda ou atrapalha o raciocínio de quem vai prescrever, no momento em que essa pessoa consulta aquela avaliação** — se o número vem com unidade, referência e interpretação, se o excesso de números ou a falta de contexto pode levar a uma leitura errada, e se a tela está organizada de um jeito que facilita ou confunde essa leitura. A coluna "o que alimenta na prescrição" na tabela abaixo é só um fato à parte (o que chega automaticamente ao motor de metas), não o critério do veredito. Alertas de segurança (RED-S de risco, exame alterado etc.) são discutidos como **avisos** desejáveis — não como recomendação de bloquear a emissão do plano por falta de alguma avaliação.

---

## 1. Resumo executivo

O LAINES tem 17 avaliações registradas (`server/src/avaliacoes/evaluation-registry.ts:26-243`) mais uma décima-oitava, `composicao_corporal_integrada`, que não está nesse catálogo mas é o nó que decide qual %gordura e qual fórmula de TMB "valem" e produz o Gasto Energético Total (GET). Da prescrição em si, só duas avaliações são lidas automaticamente pelo motor de metas (`getPacienteContext`, `server/src/planos-alimentares/plano-alimentar.service.ts:911-938`): o GET (meta calórica) e a anamnese (restrições em texto livre + referência DRI). Isso não é uma falha das outras 15 — cada uma tem função própria —, mas há casos em que a *falta de aviso* no momento de prescrever é um risco real, não só uma escolha de escopo: RED-S estabelecido, PHQ-9/GAD-7 acima do corte e exame laboratorial alterado deveriam poder aparecer como aviso na tela de prescrição, e hoje só o primeiro aparece.

O ponto mais forte do sistema é a triagem de RED-S: quando a classificação é "estabelecido", um diálogo de confirmação com registro de autor/hora interrompe a navegação até o plano alimentar e pede uma justificativa explícita para prosseguir (`src/views/AvaliacaoCompleta.jsx:1982-2002,2106-2120`) — um aviso de segurança real, com trilha de auditoria, não decorativo. Esse padrão não existe para a faixa "risco_relativo" do RED-S, nem para PHQ-9/GAD-7 acima do corte, nem para exame alterado — e um componente inteiro de alerta clínico (`AlertaBanner.jsx`, que cobriria RED-S, vitamina D baixa, ferritina baixa e ACWR de risco) está escrito mas nunca é importado em lugar nenhum do sistema (`src/components/Prontuario/AlertaBanner.jsx`), portanto nunca aparece a ninguém. Esse é um padrão que se repete: várias telas de exibição foram construídas e ficaram órfãs (`AlertaBanner.jsx`, `ModuloCard.jsx`, a função `getModuleMetrics`, a tela `PrescricaoPlanoAlimentar.jsx` de 988 linhas) — o que chega ao usuário é mais pobre do que o que existe no código.

Na organização das telas, o padrão mais comum é bom (seções com `<h4 className="eval-section-title">` ou `<legend>` agrupando por assunto, ex. `AvaliacaoClinicaForm.jsx:753-754,831-832,960-961`), mas nem sempre acompanha o peso clínico do campo — em psicologia, por exemplo, "Risco de compulsão alimentar" e "Sinais de alerta psicológico" ficam num grid plano, com o mesmo destaque visual de "Humor atual" (`AvaliacaoPsicologia.jsx:226-274`). E dois dos 17 tipos — carga de treino e triagem de RED-S — não têm nenhuma métrica configurada no card principal do "Painel de avaliações" e aparecem com "Sem indicadores configurados" mesmo depois de calculados (`DashboardAvaliacoes.jsx:43-114,422-424`), justamente as duas avaliações mais ligadas a risco (lesão por sobrecarga e disponibilidade energética).

O cálculo de gasto energético compara 9 fórmulas de TMB e escolhe uma automaticamente, mas a fórmula "para atletas com massa magra conhecida" (Cunningham) nunca é escolhida por padrão porque o parâmetro `context: 'atleta'` que ativaria essa regra nunca é passado em lugar nenhum do código (`calculationEngine.js:571-578` vs. os dois únicos pontos de chamada, `PerimetrosCorporaisForm.jsx:756-769` e `calculationEngine.js:2068-2077`) — quem lê o número de GET não tem como saber, sem abrir o detalhe, que a fórmula usada foi pensada para "população tropical" e não para atleta. O IMC usa os cortes da OMS para sedentários sem nenhuma ressalva visível para atleta, o que é um risco de leitura, não de cálculo errado. Já a resolução de qual fonte de composição corporal "vale" (dobras × bioimpedância × perímetros) é bem desenhada — hierarquia explícita, spread entre métodos calculado e sinalizado, override do profissional com justificativa obrigatória — e a avaliação por imagem 3D fica de fora dessa hierarquia e é tratada como experimental, o que é coerente com a documentação de auditoria já existente (`docs/auditoria-2026-09-11/produto-clinico.md`).

Boa parte dos achados aqui coincide com o que a auditoria de 2026-09-11 já registrou sob os IDs CLI-01 a CLI-09; onde os commits recentes (UPD-06 a UPD-10, ver `git log`) já corrigiram o problema, eu sinalizo isso explicitamente em vez de reportar como novidade.

---

## 2. Tabela-síntese das 17 avaliações

Veredito: julgado pela clareza do que a avaliação mostra a quem a consulta (ver critério na introdução) — não por ela "alimentar" ou não a prescrição, que é um dado à parte, na coluna do meio.

| # | Avaliação | O que alimenta na prescrição (automático, fato à parte) | Veredito (clareza para quem consulta) |
|---|---|---|---|
| 1 | Anamnese inicial | Restrições/alergias (texto livre) e perfil sexo/idade para a referência DRI | **Ajuda** |
| 2 | Avaliação clínica | Nada chega numericamente à prescrição; PA/FC ficam só no prontuário | **Ajuda** |
| 3 | Socioeconômica (EBIA) | Nada | **Ajuda** (quando consultada — exige abrir o módulo por conta própria) |
| 4 | Perímetros | Peso/estatura entram na composição corporal integrada como fonte de última instância; IMC/RCQ só informativos | **Ajuda**, com ressalva de leitura do IMC |
| 5 | Dobras cutâneas | %gordura/massa magra alimentam a composição corporal integrada → TMB → GET | **Ajuda** |
| 6 | Bioimpedância | %gordura/massa magra/TMB do aparelho alimentam a composição corporal integrada → GET | **Ajuda** |
| 7 | Composição corporal por imagem | Nada (fica fora da hierarquia de fontes, corretamente) | **Neutra** |
| 8 | Gasto energético total | Meta calórica (kcal) direto na prescrição | **Ajuda**, com ressalva sobre a fórmula padrão |
| 9 | Carga de treino e periodização | Indiretamente informa o registro semanal de MET do GET; ACWR não chega a lugar nenhum | **Atrapalha** por omissão (sem indicador no painel principal) |
| 10 | Avaliação alimentar (NOVA) | Nada na meta; só um sinal de "balanço energético" na tela de avaliação | **Neutra** |
| 11 | Hidratação | Nada | **Neutra** |
| 12 | Psicologia | Nada (só notificação best-effort à equipe) | **Neutra**, tendendo a **atrapalhar** por falta de destaque visual nos campos de maior risco |
| 13 | Fisioterapia | Nada | **Neutra** |
| 14 | Triagem RED-S | Bloqueia/exige override para abrir o plano quando "estabelecido"; não ajusta meta calórica | **Ajuda** (com lacuna na faixa moderada) |
| 15 | Exames laboratoriais | Nada na meta; sinal de alerta na tela de avaliação, não na prescrição | **Neutra**, com risco de **atrapalhar** por omissão |
| 16 | Evolução/retorno | Score de adesão trava o checklist de "conduta pronta para plano" | **Ajuda** (indireta) |
| 17 | Plano de metas | Nada | **Neutra** |
| — | *Composição corporal integrada (não está nos 17)* | É o hub: decide %gordura oficial e fórmula de TMB, produz o GET | **Ajuda** (crítica, mas invisível ao catálogo oficial) |

---

## 3. Seção por avaliação

### 3.1 Anamnese inicial

**Objetivo clínico.** Primeiro contato: objetivos, histórico clínico/familiar, hábitos de sono/estresse/álcool/tabaco, ciclo menstrual, nível competitivo, fase de treino, alergias. Serve de base de triagem de risco e de fonte única de restrições alimentares para a prescrição.

**O que pede.** Campos obrigatórios pelo registro: `nomePaciente`, `sexoBiologico`, `objetivos`, mais os campos calculados `scoreRisco`/`prioridade` (`evaluation-registry.ts:33`). O formulário (`AnamneseInicialForm.jsx`, 1305 linhas) tem 4 blocos — identificação/objetivo, histórico clínico, estilo de vida, histórico familiar — com dezenas de campos de texto livre e seletores (sono 1–5, estresse 1–10, álcool/tabaco por categoria, ciclo menstrual, nível competitivo, fase de treino) (`AnamneseInicialForm.jsx:52-55,620-657,698-701,802-805`). Esforço de preenchimento: **alto** (é o maior formulário do sistema).

**O que calcula.** Motor de regras (`calculationEngine.js:2364-2560`, `formulaId: anamnese_risk_rules_v1`): sinaliza comorbidade cardiometabólica, risco de comportamento alimentar alterado (transtorno/compulsão), polifarmácia (≥5 medicamentos), privação de sono (<5h ou 5–6h), estresse alto (≥8) ou moderado (6–7), tabagismo, álcool elevado, baixa atividade física e ciclo menstrual irregular — cada flag com `severity` e `referrals` (médico/psicólogo/fisioterapeuta) (`calculationEngine.js:2390-2513`). Não há equação numérica de "score" ponderado documentada como tal — é uma lista de regras booleanas que compõe flags e prioridade.

**Como é mostrado.** Card de resumo no dashboard (queixa/risco/prioridade) (`DashboardAvaliacoes.jsx:64-68`); alergias/medicamentos/restrições aparecem no card "Anamnese inicial" do resumo clínico do prontuário (`DashboardAvaliacoes.jsx:772-901`, atrás da flag `mostrarResumoClinico`, desligada por padrão — `DashboardAvaliacoes.jsx:566`).

**Ligação com a prescrição.** É a **única** fonte de restrições alimentares automáticas: `restricoesDaAnamnese()` lê só o campo de texto livre `dados.alergias`; se não for uma negação inequívoca ("nenhuma", "não possui" etc.), marca `pendenteRevisao: true` e suspende sugestões automáticas até o profissional conferir (`server/src/planos-alimentares/referencias-prescricao.ts:115-133`). Também alimenta sexo/idade da referência DRI de 8 micronutrientes (`referencias-prescricao.ts:85-113`). A flag de "risco de comportamento alimentar alterado" calculada aqui (linha 2401-2410) **não** é lida em lugar nenhum da prescrição — não encontrei nenhuma referência a ela em `plano-alimentar.service.ts` nem em `AvaliacaoCompleta.jsx`.

**Organização da tela.** O formulário é dividido em 4 abas nomeadas — "Identificação e objetivo", "Histórico clínico", "Estilo de vida", "Histórico familiar" (`AnamneseInicialForm.jsx:52-55`) — o que já evita uma lista única gigante. O que confunde: dentro de "Histórico clínico" não há diferenciação visual entre um campo de risco alto (ex. patologias que geram flag `danger`) e um campo de contexto (ex. modalidade praticada); a pessoa só descobre a gravidade depois de salvar e ver a flag calculada, não enquanto preenche. Agrupar melhor sem mudar o que é enviado: dentro da aba já existente, separar visualmente (não em nova aba) os campos que alimentam flags de segurança (patologias, medicações, sinais de alerta alimentar) dos campos de contexto geral, com um rótulo de seção do tipo "Pode gerar encaminhamento".

**Veredito: ajuda.** As flags de risco têm rótulo, gravidade e encaminhamento sugerido — dá para entender o "porquê" sem decorar a regra; a forma conservadora de tratar texto livre nas restrições (suspende automatismo em vez de arriscar) também ajuda quem lê depois.

**Sugestões.**
- **Alta** — mostrar a flag `eating_behavior_risk` (linha 2401) como aviso na tela de prescrição, não como bloqueio: hoje um atleta marcado com risco de transtorno alimentar na anamnese pode receber um plano hipocalórico sem nenhum aviso na tela de prescrição.
- **Média** — expor ao profissional, na própria tela de anamnese, que só a negação explícita em `alergias` desbloqueia sugestões automáticas (hoje isso só aparece implicitamente no contexto retornado ao back-end).

---

### 3.2 Avaliação clínica

**Objetivo clínico.** Sinais vitais e triagem de segurança para liberar o atendimento nutricional: PA, FC, glicemia capilar, temperatura, edema, VO2max estimado, taxa de sudorese, preensão palmar.

**O que pede.** Obrigatórios: `pressaoSistolica`, `pressaoDiastolica`, `frequenciaCardiaca`, `prioridadeCuidado` (`evaluation-registry.ts:41`). Formulário com 32 campos rotulados, incluindo PA sistólica/diastólica, FC, glicemia capilar + contexto da glicemia, temperatura, grau de edema, VO2max estimado, taxa de sudorese, preensão palmar direita/esquerda (`AvaliacaoClinicaForm.jsx:768-997`). Esforço: **médio**.

**O que calcula.** O servidor **sempre recalcula e ignora qualquer valor de classificação enviado pelo cliente** (`avaliacao-clinica-normalizer.ts:119-121`): classificação de PA pelos cortes da SBC 2020 (Normal / Normal-alta / Pré-HAS / HAS Estágio 1/2/3) (`avaliacao-clinica-normalizer.ts:48-62`) e `prioridadeCuidado` derivada dela (urgente/alta/média/baixa) (linhas 64-69). Há também red flags "HAS-2016" contadas em `redFlagsCount` com `formulaId: 'avaliacao_clinica_has_2016_redflags_v1'` (`AvaliacaoClinicaForm.jsx:565`). Esse recálculo obrigatório no servidor é uma boa prática de segurança (o cliente não pode "mentir" a classificação).

**Como é mostrado.** Mini-dashboard de sinais vitais com tom de cor por faixa fisiológica (PA/FC/temperatura) no card "Avaliação clínica" do resumo clínico (`DashboardAvaliacoes.jsx:719-769,201-224`, atrás de `mostrarResumoClinico`, desligada por padrão); sparklines de PA e FC dentro do próprio formulário (`AvaliacaoClinicaForm.jsx:1113-1114`). O rótulo de classificação (ex. "HAS Estágio 1") já vem com a semântica pronta — não é só o número solto.

**Organização da tela.** Cinco seções nomeadas com `<h4 className="eval-section-title">`: "Sinais vitais" (primária, destacada com `eval-section--primary`), "Dados opcionais", "Contexto esportivo", "Resultados calculados", "Observações clínicas" (`AvaliacaoClinicaForm.jsx:753-754,831-832,960-961,1009-1010,1120-1121`). É a organização mais clara entre os formulários lidos: o que é obrigatório para segurança vem primeiro e em destaque visual próprio, o que é secundário vem depois. O único ponto confuso é a seção "Resultados calculados" ficar separada da seção "Sinais vitais" que a gerou — quem quer ver o valor de entrada e a classificação juntos precisa rolar a tela duas vezes.

**Ligação com a prescrição.** Não é lida por `getPacienteContext` (`plano-alimentar.service.ts:911-938`) — a prescrição é decidida sem consultar PA/FC/glicemia. Isso é aceitável como escopo (triagem clínica não precisa virar número de dieta), mas significa que hoje não há nenhum aviso na tela de prescrição quando a última avaliação clínica indica `prioridadeCuidado: urgente/alta`.

**Veredito: ajuda.** Sinais vitais com classificação por cor, referência (SBC 2020) e tendência (sparkline) — quando consultada, a tela responde "o que isso significa", não só "qual o número".

**Sugestões.**
- **Média** — um aviso (não bloqueio) na tela de prescrição quando a última avaliação clínica tiver `prioridadeCuidado: urgente/alta`, no mesmo espírito do aviso de RED-S.
- **Baixa** — ligar o card de sinais vitais ao painel principal (hoje fica atrás de uma flag desligada por padrão, `mostrarResumoClinico=false`), e aproximar visualmente "Sinais vitais" de "Resultados calculados".

---

### 3.3 Socioeconômica (EBIA)

**Objetivo clínico.** Rastrear insegurança alimentar pela Escala Brasileira de Insegurança Alimentar (EBIA), 14 itens (8 quando o domicílio não tem menores) — instrumento oficial do IBGE/PNAD, não uma criação do sistema.

**O que pede.** Obrigatórios: `temMenores`, `pontuacaoEBIA`, `classificacaoLabel` (`evaluation-registry.ts:50`). 14 perguntas sim/não (`avaliacao-socioeconomica-normalizer.ts:110-114`), reduzidas a 8 quando `temMenores=false`. Esforço: **baixo/médio** (14 perguntas binárias).

**O que calcula.** Pontuação = soma das respostas "sim" entre as perguntas aplicáveis; classificação por faixas oficiais da EBIA — com menores: SA=0, Leve=1–5, Moderada=6–9, Grave=10–14; sem menores: SA=0, Leve=1–3, Moderada=4–5, Grave=6–8 (`avaliacao-socioeconomica-normalizer.ts:57-78`). Essas faixas batem com os pontos de corte oficiais da EBIA usados pelo IBGE **[baixa confiança — não conferi o documento oficial linha a linha, mas os cortes 1-3/4-5/6-8 e 1-5/6-9/10-14 são os valores amplamente citados como EBIA/EBIA reduzida]**.

**Como é mostrado.** Card no dashboard com classificação/pontuação (`DashboardAvaliacoes.jsx:84-88`) — rótulo por extenso ("Insegurança Alimentar Moderada"), não só a sigla, o que ajuda a leitura rápida.

**Organização da tela.** Formulário curto (476 linhas), com um bloco "Progresso do questionário" (`AvaliacaoSocioeconomica.jsx:337`) que mostra quantas das 14/8 perguntas já foram respondidas — um bom recurso para um questionário binário longo, evita a pessoa perder a conta de onde parou.

**Ligação com a prescrição.** Não é lida por `getPacienteContext`; a decisão de meta calórica/macro não depende dela, o que é esperado — EBIA não é um dado nutricional per se, é contexto social. O que falta não é integração automática, é visibilidade: hoje, para saber se o atleta está em insegurança alimentar antes de sugerir substituições, o profissional precisa lembrar de abrir esse módulo à parte.

**Veredito: ajuda**, quando consultada. A classificação vem clara, com rótulo por extenso e contador de progresso. O ponto fraco não é a tela em si, é ela ficar fora do caminho de quem está montando o plano.

**Sugestões.**
- **Média** — mostrar a classificação EBIA como contexto visível (aviso, não trava) na própria tela de prescrição, para lembrar o profissional de considerar custo/acesso ao sugerir alimentos.

---

### 3.4 Perímetros

**Objetivo clínico.** Antropometria básica: peso, estatura, cintura, quadril, pescoço → IMC, RCQ, índice cintura-estatura, índice de conicidade, %gordura por equação YMCA.

**O que pede.** Obrigatórios: `peso`, `estatura` (`evaluation-registry.ts:59`). Formulário grande (2681 linhas) com campos opcionais de cintura/quadril/pescoço e foco cardiometabólico. Esforço: **baixo** para o mínimo, **médio** com as circunferências completas.

**O que calcula.** IMC com classificação da OMS para adultos, sem nenhuma ressalva para atleta (`calculationEngine.js:147-152`); idosos (>60 anos) usam Lipschitz 1994, adolescentes usam percentil OMS 2007 (`calculationEngine.js:130-145`) — essas duas exceções por idade existem, mas não há exceção por composição corporal/nível de treino. RCQ, índice cintura-estatura, índice de conicidade (Valdez 1991) e %gordura YMCA por sexo (`calculationEngine.js:155-182,273-298`). O mesmo bloco de TMB comparativa (9 fórmulas, ver seção 3.8) também é calculado aqui e repassado para a composição corporal integrada (`PerimetrosCorporaisForm.jsx:756-769`).

**Risco conceitual [julgamento clínico].** Aplicar os cortes de IMC da OMS (pensados para a população geral) a atletas universitários com massa magra elevada é um risco documentado na literatura — a OMS já reconhece que o IMC não distingue massa magra de massa gorda. O código não traz nenhuma ressalva textual nesse sentido; o rótulo "Sobrepeso"/"Obesidade grau I" aparece igual para um sedentário e para um atleta de força com o mesmo IMC.

**Como é mostrado.** Card "Perímetros" no dashboard (IMC, cintura, RCQ) (`DashboardAvaliacoes.jsx:54-58`); classificações com `tone` (success/warning/danger) por faixa.

**Organização da tela.** Cinco blocos com `<legend className="eval-section-title eval-legend">` dentro de `<fieldset>`: "Dados obrigatórios", "Dados opcionais", "Contexto da medição", "Circunferências corporais", "Comparativo de TMB" (`PerimetrosCorporaisForm.jsx:1447,1499,1653,1837,1902`). A separação obrigatório/opcional logo no topo é um bom padrão — deixa claro o que é imprescindível sem obrigar a rolar a tela toda. O que confunde: a classificação de IMC aparece dentro do fluxo normal de resultado, com o mesmo peso visual do RCQ ou do índice de conicidade, sem nenhuma marca (nem cor, nem nota) diferenciando "isto pode não valer para quem tem muita massa magra" dos demais índices.

**Ligação com a prescrição.** Indireta: peso/estatura entram como fonte de composição corporal de última prioridade (só quando não há dobras/bioimpedância/DEXA) dentro de `calculateIntegratedBodyComposition` (`calculationEngine.js:2027-2032`, hierarquia em `calculationEngine.js:2127`), e daí seguem para o TMB/GET. IMC/RCQ em si não chegam à prescrição — o que é esperado, já que são índices de triagem, não metas nutricionais.

**Veredito: ajuda**, com ressalva. Sustenta o cálculo calórico quando não há método melhor disponível; mas o IMC exibido pode induzir leitura clínica equivocada num atleta.

**Sugestões.**
- **Média** — adicionar uma nota ao lado da classificação de IMC quando o paciente tiver massa magra elevada conhecida (de dobras/bioimpedância), avisando que o corte de IMC não diferencia massa magra de gorda. **[julgamento conceitual]**

---

### 3.5 Dobras cutâneas

**Objetivo clínico.** Estimar %gordura/massa magra por espessura de dobras cutâneas — método de referência prático em contextos esportivos (ISAK/ACSM), mais barato que DEXA e mais específico que bioimpedância para atletas treinados **[julgamento clínico, prática comum na literatura de avaliação antropométrica esportiva]**.

**O que pede.** Obrigatórios: `protocolo`, `sexo`, `dobras` (`evaluation-registry.ts:69`). Formulário de 1437 linhas com múltiplos protocolos (a fórmula é `{protocolo}-siri` / `{protocolo}-brozek`, ou seja, o protocolo de dobras é escolhido pelo usuário e a % gordura sai por Siri (1961) ou Brozek (1963) conforme `conversionMethod` (`dobras-cutaneas-normalizer.ts:129`, default `'siri'`). Esforço: **alto** — múltiplas dobras a medir com plicômetro.

**O que calcula.** Densidade corporal → %gordura via Siri/Brozek, massa gorda/massa magra em kg, soma de dobras (`dobras-cutaneas-normalizer.ts:132-180`). Classificação de %gordura registrada mas o texto exato da tabela de corte fica no `calculationEngine.js` (função `classifyBodyFatByLohman`, linha 1514) — sugere uso da referência de Lohman, comum em avaliação de composição corporal esportiva **[baixa confiança sobre o ano/edição exata da tabela Lohman usada]**.

**Como é mostrado.** Card "Dobras cutâneas" no dashboard (%gordura, soma de dobras, massa magra) (`DashboardAvaliacoes.jsx:49-53`) — mostra o resultado, mas não o protocolo/método usado para chegar nele.

**Organização da tela.** Quatro seções: "Protocolo e identificação", "Dados do avaliado", "Dobras do protocolo", "Comparação longitudinal" (`DobrasCutaneasForm.jsx:716,831,879,1015`). Faz sentido pedir o protocolo antes das medidas (o protocolo decide quais dobras aparecem depois). O que confunde: como o protocolo é escolhido no início e o resultado é mostrado só como "%gordura" no card, quem olha o histórico meses depois não sabe se duas medições usaram o mesmo protocolo — e comparar %gordura de protocolos diferentes ao longo do tempo é uma leitura arriscada.

**Ligação com a prescrição.** Uma das fontes de maior prioridade na hierarquia de composição corporal (`calculationEngine.js:2127`: "DEXA > Dobras cutâneas > BIA tetrapolar segmentar > BIA tetrapolar convencional > BIA bipolar > Equações antropométricas") — como o sistema não tem DEXA implementado, dobras cutâneas é, na prática, a fonte de maior confiança disponível, e sua massa magra alimenta o TMB por Cunningham/Guedes quando escolhida como fonte oficial.

**Veredito: ajuda**, com uma lacuna de rastreabilidade. O cálculo é sólido e as seções seguem uma ordem lógica; falta mostrar o protocolo junto do resultado para quem está comparando ao longo do tempo.

**Sugestões.**
- **Baixa** — expor no card do dashboard/prontuário qual protocolo/método foi usado ao lado do valor de %gordura (hoje o `protocolo` fica em `dados`, mas a exibição no card não mostra qual protocolo gerou o número) — importante sobretudo para não comparar protocolos diferentes como se fossem a mesma medida.

---

### 3.6 Bioimpedância

**Objetivo clínico.** Estimativa de composição corporal via BIA (tetrapolar/bipolar) — %gordura, massa magra, água corporal, TMB do aparelho, ângulo de fase.

**O que pede.** Obrigatórios: `percentualGordura`, `massaMagra`, `aguaTotal` (`evaluation-registry.ts:78`). Formulário de 1620 linhas cobrindo bioresistência/reatância, ângulo de fase, ECW/ICW.

**O que calcula.** %gordura, massa magra, água corporal total e como % do peso/massa magra; TMB comparando o valor do aparelho com Cunningham e Guedes (`bioimpedancia-normalizer.ts:127-218`, campos `tmbCunningham`, `tmbGuedes`, `diffDeviceVsCunningham/Guedes`); classificação de %gordura (`classifyBodyFatForBia`, `calculationEngine.js:1029`) e de ângulo de fase (`classifyPhaseAngle`, linha 998) — ângulo de fase é um marcador de qualidade celular usado em nutrição esportiva **[julgamento clínico sobre o uso, sem certeza da referência de corte exata aplicada no código]**.

**Risco conceitual [julgamento clínico].** BIA é sensível a estado de hidratação — um atleta desidratado após treino terá leitura de %gordura distorcida. Não vi no código nenhum aviso obrigatório de "jejum/hidratação/horário do dia" antes da medida (pode existir apenas como texto no formulário, não verifiquei linha a linha os 1620 campos de UI).

**Como é mostrado.** Card "Bioimpedância" no dashboard (%gordura, massa magra, TMB) (`DashboardAvaliacoes.jsx:44-48`); é também o tipo usado como card de "Composição corporal" do resumo clínico do prontuário (`PRONTUARIO_SUMMARY_TYPES.COMPOSICAO = 'bioimpedancia'`, `DashboardAvaliacoes.jsx:120`) — **nota**: esse card de resumo usa especificamente `bioimpedancia`, não a composição corporal integrada nem dobras cutâneas, então se o profissional usar dobras como fonte oficial, o resumo clínico ainda mostra o número de bioimpedância, um risco real de leitura errada (dois números diferentes chamados "composição corporal" no mesmo prontuário).

**Organização da tela.** Seis seções: "Equipamento e condições pré-avaliação", "Dados de entrada ou leitura direta", "Base antropométrica", "Comparativo BIA vs Dobras vs DEXA (sessão)", "Observações" (`BioimpedanciaForm.jsx:685,860,971,1121,1149`). A seção "Equipamento e condições pré-avaliação" vindo logo no início é um bom sinal — é onde as condições de hidratação/jejum entrariam, se estiverem ali (não confirmei o texto exato desses campos). A seção "Comparativo BIA vs Dobras vs DEXA" já expõe a divergência entre métodos dentro da própria tela, o que ajuda bastante a não tratar o número como absoluto.

**Ligação com a prescrição.** Fonte de composição corporal (rank abaixo de dobras, acima de perímetros) — mesma cadeia até o TMB/GET (`calculationEngine.js:2013-2025`).

**Veredito: ajuda**, com a ressalva de hidratação e a inconsistência do card de resumo clínico.

**Sugestões.**
- **Média** — corrigir a inconsistência do card de resumo clínico: usar a mesma fonte "oficial" escolhida na composição corporal integrada em vez de fixar `bioimpedancia` (`DashboardAvaliacoes.jsx:120,820-838`).

---

### 3.7 Composição corporal por imagem

**Objetivo clínico.** Estimar composição corporal a partir de 3+ fotos (frontal, lateral direita, posterior, entre outras — `AvaliacaoImagem.jsx:41-58`) processadas por um serviço 3D externo. É explicitamente rotulada **experimental** em todo o back-end (`avaliacao-imagem.service.ts:136,156,372,431,444,583`, `formulaId: 'body3d_experimental_v1'`).

**O que pede.** Sem campos obrigatórios no registro (`evaluation-registry.ts:120`, `requiredFields: []`) — o esforço do atleta/profissional é capturar as fotos seguindo instruções de enquadramento (fácil) e esperar o processamento assíncrono (que pode falhar: há um erro explícito `PROCESSOR_NOT_CONFIGURED` quando o serviço 3D não está configurado no servidor, `avaliacao-imagem.service.ts:301-302`).

**O que calcula.** %gordura, massa gorda, massa magra (`avaliacao-imagem.service.ts:377-392`) por um algoritmo externo cuja versão é registrada (`algoritmoVersion`). Segundo a auditoria de 2026-09-11 (não é achado meu, é documentação já existente): passaram 48 testes de núcleo Python, mas **não** foram executados captura de câmera real, processamento com modelo real, nem validação contra medidas de referência (`docs/auditoria-2026-09-11/produto-clinico.md`, seção "Avaliação corporal por imagem").

**Como é mostrado.** Card próprio no dashboard (`DashboardAvaliacoes.jsx:40,109-113`), aberto como modal (`AvaliacaoImagem`) e não como aba do fluxo de avaliação normal (`DashboardAvaliacoes.jsx:579-587,1203-1207`).

**Organização da tela.** Fluxo passo a passo com título por etapa (`<h3 className="ai-step-title">`): "Dados e consentimento", "Permissão da câmera", "Revisar capturas", "Enviando avaliação" (`AvaliacaoImagem.jsx:307,448,703,772`) — desenho de wizard, adequado para um fluxo de captura assistida. O que confunde: por ser aberta como modal separado do restante do fluxo de avaliação (não é uma aba entre as outras 16), é fácil um usuário não perceber que ela existe ou não voltar a consultá-la junto das demais.

**Ligação com a prescrição.** **Nenhuma**, e isso é coerente: `calculateIntegratedBodyComposition` não inclui `composicao_corporal_imagem` na hierarquia de fontes (`calculationEngine.js:2007-2028` só busca DEXA, dobras, bioimpedância, perímetros) nem no snapshot de composição do dashboard (`DashboardAvaliacoes.jsx:663-668`, lista `sourcePriority` sem a imagem).

**Veredito: neutra.** Ficar fora do fluxo automático é a decisão certa dado o estágio experimental; o risco é de percepção, não de dado incorreto entrando na prescrição.

**Sugestões.**
- **Baixa** — no card do dashboard, junto do rótulo, deixar textualmente visível "estimativa experimental, não usada no cálculo de dieta" para quem só olha a tela (hoje a natureza experimental está no código/documentação, não necessariamente no rótulo da interface que o aluno vê — não confirmei o texto exato renderizado no card).

---

### 3.8 Gasto energético total

**Objetivo clínico.** Estimar a taxa metabólica basal (TMB) e o gasto energético total (GET) para embasar a meta calórica da prescrição.

**O que pede.** Obrigatórios: `tmbBaseKcal`, `fatorAtividade`, `getEstimadoKcal` (`evaluation-registry.ts:130`). Formulário de 1697 linhas com nível de atividade (5 categorias), nível competitivo, e um registro semanal de atividades por MET (7 dias × tipo/categoria/intensidade/MET/duração) (`GastoEnergeticoTotalForm.jsx:14-36,49-59`). Esforço: **alto**, se o registro semanal completo de MET for preenchido; **baixo** se só o nível de atividade genérico for usado.

**O que calcula.** A base de TMB não vem de uma fórmula fixa aqui — vem herdada da composição corporal integrada da mesma sessão (`calculateGetEvaluation`, `calculationEngine.js:2207-2311`, `tmbUsedKcal = manualTmbKcal ?? integratedBase.tmbKcal`). O fator de atividade pode ser um dos 5 presets ou personalizado (0,8–2,5) (`calculationEngine.js:2132-2161`). Também calcula um **PAL real** a partir do registro semanal de MET dividido pela TMB×7 dias, comparado com um "PAL subjetivo legado" informado manualmente (`GastoEnergeticoTotalForm.jsx:326-350,850-856`) — uma forma mais objetiva de estimar atividade do que um fator fixo. GET final = TMB × fator de atividade (ou TMB puro se a fórmula selecionada for DRI/EER, que já embute atividade) (`calculationEngine.js:2238-2242`); metas derivadas: manutenção, emagrecimento leve/moderado/intenso (−300/−500/−750 kcal), hipertrofia (+300/+500 kcal) (`calculationEngine.js:2244-2249`), com alerta de ingestão intensa abaixo do mínimo seguro por sexo (1200/1500/1300 kcal) (`calculationEngine.js:2251-2266`). Há também uma tabela de referência de CHO periodizado por fase de treino (5–12 g/kg/dia conforme a fase) exibida na tela (`GastoEnergeticoTotalForm.jsx:39-46`) — **[julgamento clínico]** esses valores estão na faixa citada pelo posicionamento conjunto ACSM/Academy of Nutrition and Dietetics/Dietitians of Canada sobre nutrição esportiva, mas não confirmei a referência exata usada pelo time do projeto.

**Risco conceitual — fórmula de TMB para atletas não é escolhida por padrão [fato + julgamento].** O motor compara 9 fórmulas de TMB (Harris-Benedict original e revisada, Mifflin-St Jeor, Cunningham, Owen, Schofield, Henry, Guedes, Falkner pediátrica, DRI/IOM-EER) e escolhe uma "oficial" por regra: Cunningham só é escolhida se `context === 'atleta'` **e** houver massa magra conhecida; senão cai em Schofield (menores de 18) ou Henry (população "tropical") (`calculationEngine.js:571-578`). Busquei em todo o repositório por `context: 'atleta'` e não há **nenhum** ponto de chamada que passe esse valor — os dois lugares que chamam `calculateTmbComparative` passam só `population: 'tropical'` (`PerimetrosCorporaisForm.jsx:756-769`, `calculationEngine.js:2068-2077`). Resultado: mesmo com massa magra medida por dobras/bioimpedância, o padrão automático escolhido para um adulto é **Henry (2005)** — uma equação para "populações tropicais", não Cunningham (1980), que é a fórmula que o próprio catálogo do sistema rotula como indicada para "atletas e indivíduos com massa magra conhecida" (`calculationEngine.js:38-46`). O profissional pode trocar manualmente a fórmula na composição corporal integrada (`dados.selectedTmbFormulaId`), então o dado não está errado — só o padrão automático não reflete a lógica que o próprio código diz que deveria aplicar.

**Como é mostrado.** Card "Gasto energético total" no dashboard (GET, TMB base, fórmula) (`DashboardAvaliacoes.jsx:59-63`); widget de macros/GET no resumo clínico (`DashboardAvaliacoes.jsx:492-516,904-918`). O card mostra o `formulaId` (texto técnico, ex. `henry_2005`) ao lado do GET, então tecnicamente a fórmula usada não fica escondida — só não vem com nenhuma explicação de "por que essa fórmula" nem sinal de que poderia ser outra mais adequada.

**Organização da tela.** Três seções: "Base energética", "Registro de atividades da semana", "Observações" (`GastoEnergeticoTotalForm.jsx:931,1013,1214`). Faz sentido separar a base (TMB herdada + fator de atividade) do registro detalhado por dia — quem só quer o número não precisa abrir a tabela semanal. A tabela de CHO periodizado por fase de treino aparece como referência solta, sem uma seção própria com título — fica menos visível do que merecia dado seu valor para a prescrição.

**Ligação com a prescrição.** É a única avaliação (junto com anamnese) lida automaticamente em `getPacienteContext`: `extractGetMetasFromAvaliacao` busca `getEstimadoKcal`/`cho`/`ptn`/`lip` da última avaliação finalizada (`plano-alimentar.service.ts:386-430`), mas os campos `choG`/`ptnG`/`lipG` nunca são preenchidos por este formulário (não encontrei nenhum cálculo de macro em grama no `GastoEnergeticoTotalForm.jsx` nem no normalizador) — na prática só a meta calórica chega pronta; os gramas de carboidrato/proteína/lipídio são preenchidos manualmente na tela de prescrição (`prescricaoCatalogo.js:121-131`, `adaptarMetas` repassa `null` quando ausente).

**Veredito: ajuda**, com uma ressalva de interpretação. O card mostra o número certo de forma clara, mas não avisa quando a fórmula por trás dele não é a mais indicada para o perfil da pessoa — quem lê o GET não tem como saber, sem abrir o detalhe, que o padrão caiu em Henry (2005) em vez de Cunningham.

**Sugestões.**
- **Alta** — passar `context: 'atleta'` (ou equivalente) nas duas chamadas de `calculateTmbComparative` para que Cunningham/Guedes concorram de verdade como padrão quando há massa magra conhecida.
- **Média** — calcular e exportar `choG`/`ptnG`/`lipG` a partir do GET e da tabela de CHO periodizado já existente, em vez de deixar esses três campos sempre nulos até a prescrição.

---

### 3.9 Carga de treino e periodização

**Objetivo clínico.** Monitorar carga de treino (PSE × duração) e risco de lesão por ACWR (razão carga aguda:crônica).

**O que pede.** Obrigatórios: `faseAtual`, `sessoesSemana`, `cargaSemanaAtual` (`evaluation-registry.ts:140`). Registro por dia da semana: tipo, duração (min), PSE (0–10), MET (`carga-treino-normalizer.ts:99-141`). Esforço: **médio/alto** se preenchido dia a dia.

**O que calcula.** Carga por sessão = PSE × duração (min) (`carga-treino-normalizer.ts:127-129`); carga semanal = soma das 7 cargas diárias; monotonia = média/desvio-padrão das cargas diárias; ACWR = carga da semana atual / média das últimas 4 semanas; strain = carga semanal × monotonia (`carga-treino-normalizer.ts:188-229`). Classificação por faixas de ACWR: subcarga (<0,8), zona segura (0,8–1,3), zona de alerta (1,3–1,5), zona de risco (>1,5) (`carga-treino-normalizer.ts:91-97`) — esses cortes (0,8/1,3/1,5) são os mais citados na literatura de ACWR (Gabbett 2016 e revisões posteriores) **[média confiança na atribuição exata do autor/ano, mas os valores batem com o que é amplamente replicado nessa literatura]**.

**Como é mostrado.** Aqui está o achado mais concreto desta avaliação: o card "Carga de treino e periodização" no "Painel de avaliações" **não tem nenhuma métrica configurada**. `DashboardAvaliacoes.jsx` define `METRIC_SPECS` para 14 dos 17 tipos (`DashboardAvaliacoes.jsx:43-114`) e `carga_treino` não está entre eles; o card cai no caminho `specs.length ? ... : "Sem indicadores configurados."` (`DashboardAvaliacoes.jsx:414-424`). Existe uma segunda tabela de specs, `EVAL_METRIC_SPECS`, que **tem** `carga_treino` com ACWR/fase/sessões por semana (`evaluationSummaryUtils.js:120-124`) e uma função pronta para usá-la, `getModuleMetrics` — mas essa função não é chamada em nenhum lugar do código (busquei `getModuleMetrics(` em todo `src/` e o único resultado é a própria definição). Ou seja: o ACWR é calculado, existe até uma segunda versão da tela pronta para mostrá-lo, e nenhuma das duas chega à pessoa que abre o painel.

**Organização da tela.** Três seções sem `eval-section-title` — usam `<h4>` simples: "Contexto esportivo da sessão", "Sessões da semana", "Histórico das últimas 4 semanas" (`AvaliacaoCargaTreino.jsx:648,731,835`), uma ordem que acompanha o raciocínio do ACWR (contexto → semana atual → histórico de comparação). O problema não é a organização interna da tela, é o que sai dela para o resto do sistema (ver acima).

**Ligação com a prescrição.** O registro semanal de MET alimenta o cálculo de PAL real do Gasto Energético Total quando o profissional integra os dois módulos (`GastoEnergeticoTotalForm.jsx:326-337`); a fase de treino (`faseAtual`) também é referenciada na tabela de CHO periodizado do GET. Isso é uma boa ponte informal entre os dois módulos, mesmo sem ser uma leitura automática.

**Veredito: atrapalha por omissão.** Não é a tela do formulário que atrapalha — é o card do painel de avaliações, que fica vazio mesmo com o dado calculado, exatamente para o indicador (ACWR) mais ligado a risco de lesão desta avaliação.

**Sugestões.**
- **Alta** — adicionar `carga_treino` (e `triagem_reds`, ver seção 3.14) ao `METRIC_SPECS` de `DashboardAvaliacoes.jsx`, ou trocar essa tabela local pela já existente e mais completa em `evaluationSummaryUtils.js`, eliminando a duplicidade.

---

### 3.10 Avaliação alimentar (NOVA)

**Objetivo clínico.** Classificar o padrão alimentar habitual pelo grau de processamento (classificação NOVA: in natura, minimamente processados, processados, ultraprocessados).

**O que pede.** Obrigatório: `categorias` (`evaluation-registry.ts:150`) — quilocalorias por categoria NOVA, vindas de registros individuais de alimentos ou de valores agregados direto (`alimentar-normalizer.ts:138-180`). Esforço: **médio/alto**, dependendo de quantos registros de alimentos forem lançados manualmente.

**O que calcula.** Percentual de cada categoria sobre o total diário; classificação do padrão: saudável (<10% ultraprocessado), moderado (<20%), de risco (<30%), de alto risco (≥30%) (`alimentar-normalizer.ts:84-89`) — esses cortes seguem a lógica difundida a partir da classificação NOVA (Monteiro et al.) de associar % calórico de ultraprocessados a risco, mas os limiares exatos (10/20/30%) são uma convenção do próprio sistema, não um ponto de corte oficial publicado que eu tenha conseguido confirmar **[baixa confiança — não encontrei essa tabela de limiares na literatura NOVA original]**.

**Como é mostrado.** Card "Avaliação alimentar (NOVA)" no dashboard (kcal, %ultraprocessados, padrão) (`DashboardAvaliacoes.jsx:74-78`).

**Organização da tela.** Duas seções: "Kcal por grupo NOVA" e "Resumo do consumo" (`AvaliacaoAlimentarNOVA.jsx:354,389`) — organização enxuta e direta, condizente com o formulário mais curto entre os 17 (524 linhas). Não identifiquei nada que confunda na estrutura em si.

**Ligação com a prescrição.** Não entra em `getPacienteContext` — o que é razoável, já que é um retrato do consumo *atual*, não uma meta futura. Aparece como sinal cruzado dentro da própria tela de avaliação: se a ingestão calórica desta avaliação e o GET divergirem em mais de 500 kcal, um sinal "danger" (déficit) ou "warning" (superávit) é mostrado ali mesmo (`AvaliacaoCompleta.jsx:1059-1087`).

**Veredito: ajuda.** A classificação por padrão (saudável/moderado/risco/alto risco) é direta de ler, e o sinal de divergência com o GET já aparece no lugar certo — dentro da própria tela de avaliação, perto de onde os dois números coexistem.

**Sugestões.**
- **Baixa** — repetir o sinal de balanço energético (ingestão NOVA vs. GET) também como referência na tela de prescrição, para quem não passou pela tela de avaliação antes de prescrever.

---

### 3.11 Hidratação

**Objetivo clínico.** Medir perda hídrica durante o exercício (peso antes/depois) e estimar taxa de sudorese, para orientar reposição hídrica.

**O que pede.** Obrigatórios: `pesoAntesExercicio`, `pesoAposExercicio`, `duracaoExercicioMin`, `perdaPesoPercentual` (`evaluation-registry.ts:160`). Também pede volume ingerido/urinado, modalidade, temperatura ambiente (`hidratacao-normalizer.ts:90-97`). Esforço: **baixo/médio** — precisa de pesagem antes/depois do treino, o que exige logística (balança disponível na sessão de treino).

**O que calcula.** Perda de peso absoluta e percentual; perda hídrica líquida = perda de peso (kg)×1000 + volume ingerido − volume urinado; taxa de sudorese (L/h) (`hidratacao-normalizer.ts:99-117`, mesma fórmula replicada em `calculationEngine.js:701-715`). Classificação por perda percentual: sem perda relevante (≤0%), leve (0–2%), moderada (2–3%), importante (≥3%) (`hidratacao-normalizer.ts:55-64`) — esses cortes (2%/3% de perda de peso corporal como limiar de desidratação relevante durante exercício) são consistentes com o que costuma ser citado em diretrizes de reposição hídrica no esporte (ex. ACSM) **[julgamento clínico, sem confirmar a edição exata da diretriz]**.

**Como é mostrado.** Card "Hidratação" no dashboard (perda hídrica %, taxa de sudorese, classificação) (`DashboardAvaliacoes.jsx:79-83`).

**Organização da tela.** Duas seções: "Estratégia hídrica e adesão" e "Resultados automáticos" (`AvaliacaoHidratacao.jsx:404,430`) — separa bem o que a pessoa preenche do que o sistema calcula, o que ajuda a não confundir dado medido com dado derivado.

**Ligação com a prescrição.** Não há campo de meta de hidratação na prescrição (`prescricao-contract.ts` só trata calorias/macros/fibra) nem em `getPacienteContext` — hidratação não é hoje parte do que a prescrição formaliza como meta.

**Veredito: ajuda.** A classificação de perda hídrica vem com rótulo direto ("Desidratação moderada" etc.) e a taxa de sudorese é uma medida individualizada de verdade, não um genérico — útil sempre que alguém abrir esta avaliação para pensar em reposição líquida.

**Sugestões.**
- **Baixa** — mostrar a taxa de sudorese calculada como referência textual na tela de prescrição, para quem estiver montando a estratégia de líquidos do plano sem precisar abrir outra tela.

---

### 3.12 Psicologia

**Objetivo clínico.** Triagem emocional focada em nutrição esportiva: humor, estresse, sono, suporte social, risco de compulsão alimentar, mais dois instrumentos validados — PHQ-9 (depressão) e GAD-7 (ansiedade).

**O que pede.** Sem campos obrigatórios formais no registro (`evaluation-registry.ts:180`, `requiredFields: ['objetivo','estresse']` na prática — conferir). Nove campos de triagem geral (data, objetivo do atendimento, humor atual, estresse 0–10, motivação 0–10, qualidade do sono, suporte social, sinais de alerta psicológico, risco de compulsão alimentar) (`AvaliacaoPsicologia.jsx:226-274`), mais PHQ-9 (9 perguntas) e GAD-7 (7 perguntas) (`AvaliacaoPsicologia.jsx:281-300`, `PHQ9_QUESTIONS`/`GAD7_QUESTIONS`). Esforço: **médio** (16 perguntas objetivas + 9 campos curtos).

**O que calcula.** PHQ-9 e GAD-7 somam 0–27 e 0–21 respectivamente, com faixas de gravidade padrão (Mínima/Leve/Moderada/Moderadamente grave/Grave para PHQ-9; Mínima/Leve/Moderada/Grave para GAD-7) e ponto de corte ≥10 marcado como `AboveCutOff` para os dois (`psicologia-normalizer.ts:39-91,152-161`) — esses são os instrumentos e cortes padrão da literatura (Kroenke, Spitzer & Williams 2001 para o PHQ-9; Spitzer et al. 2006 para o GAD-7), citados no próprio código (`AvaliacaoPsicologia.jsx:283,299`, "Patient Health Questionnaire" e "Generalized Anxiety Disorder").

**Como é mostrado.** Card "Psicologia" no dashboard (objetivo, estresse, humor) (`DashboardAvaliacoes.jsx:94-98`); um alerta best-effort é enviado à equipe (não ao profissional de nutrição especificamente) quando PHQ-9 ou GAD-7 ficam acima do corte (`clinical-alerts.service.ts:148-165`).

**Organização da tela.** Os 9 campos de triagem geral ficam num único `eval-grid` sem subtítulo, todos com o mesmo peso visual (`AvaliacaoPsicologia.jsx:226-274`); só depois vêm as duas seções tituladas dos questionários, cada uma com `QuestionnaireSection` (título, subtítulo e citação da referência) (`AvaliacaoPsicologia.jsx:281-300`). Isso é o que mais confunde nesta avaliação: "Risco de compulsão alimentar" e "Sinais de alerta psicológico" — dois campos de texto livre com peso clínico potencialmente alto para uma equipe de nutrição — aparecem lado a lado com "Humor atual" e "Qualidade do sono", sem nenhuma diferenciação visual (cor, ícone, agrupamento) que sinalize "preste atenção nestes dois". Agrupar melhor sem mudar o que é enviado: separar visualmente, dentro do mesmo grid (sem criar nova aba), os campos que já geram alerta silencioso (risco de compulsão, sinais de alerta) dos campos de contexto (humor, sono, suporte social) — por exemplo com um rótulo "Sinais de atenção" acima dos dois primeiros.

**Ligação com a prescrição.** Não entra em `getPacienteContext`; o único efeito automático é a notificação best-effort à equipe (`clinical-alerts.service.ts:94-114,148-165`) — que não é lida por ninguém na tela de prescrição.

**Veredito: neutra**, tendendo a **atrapalhar** por falta de destaque visual. Os dois questionários validados (PHQ-9/GAD-7) são exemplares — citação, corte, gravidade, tudo visível. O problema é que os dois campos de texto livre mais graves da tela (compulsão, sinais de alerta) ficam com a mesma aparência que os campos triviais, o que aumenta a chance de passarem despercebidos por quem só está fazendo uma leitura rápida.

**Sugestões.**
- **Alta** — dar destaque visual (não preencher automaticamente nada, só chamar atenção) aos campos "Risco de compulsão alimentar" e "Sinais de alerta psicológico" dentro da própria tela, e considerar um aviso (não bloqueio) na tela de prescrição quando PHQ-9/GAD-7 estiverem acima do corte, já que um plano hipocalórico agressivo é um risco adicional real nesse cenário **[julgamento clínico]**.

---

### 3.13 Fisioterapia

**Objetivo clínico.** Avaliação funcional multiprofissional: queixa, diagnóstico cinético-funcional, dor, mobilidade, testes especiais, sessões de acompanhamento e condutas.

**O que pede.** Sem campos obrigatórios formais no registro (`evaluation-registry.ts:190`, `requiredFields: []`). Formulário robusto de 1039 linhas: queixa principal, intensidade de dor (provavelmente 0–10, mesmo padrão de outras avaliações), mobilidade, diagnóstico clínico e cinético-funcional, exames complementares, sessões (array de data + conteúdo), objetivos de curto e médio/longo prazo (arrays com texto + concluído), condutas (`fisioterapia-normalizer.ts:77-102`). Esforço: **alto**.

**O que calcula.** Não há fórmula numérica — `formulaId: 'fisioterapia_funcional_basica'` é um rótulo de versão de schema, não um cálculo (`fisioterapia-normalizer.ts:107`). É registro estruturado, não escore.

**Como é mostrado.** Card "Fisioterapia" no dashboard (queixa, dor, classificação funcional) (`DashboardAvaliacoes.jsx:89-93`).

**Organização da tela.** Sete seções: "Escritos", "Sessões de medição", "Inspeção", "Dor à Palpação", "Perimetria", "Testes Especiais", "Intervenções" (`AvaliacaoFisioterapia.jsx:396,432,470,483,496,554,737`) — é a avaliação mais setorizada do sistema, o que faz sentido dado o volume de instrumentos físicos diferentes que ela cobre (inspeção, palpação, perimetria, testes especiais). Não há nada que confunda na estrutura; o risco aqui é de excesso de seções para quem só quer uma visão geral rápida, não de campos mal agrupados.

**Ligação com a prescrição.** Não entra em `getPacienteContext` — coerente, já que fisioterapia e nutrição são domínios distintos por natureza.

**Veredito: neutra.** Bem organizada para seu próprio propósito interprofissional; simplesmente não é (nem precisa ser) parte do raciocínio de quem prescreve dieta.

**Sugestões.**
- **Baixa** — nenhuma sugestão de alta prioridade para esta avaliação dentro do escopo desta análise (foco em nutrição/prescrição); melhorias de usabilidade específicas de fisioterapia ficam fora do que consegui avaliar com profundidade.

---

### 3.14 Triagem de disponibilidade energética (RED-S)

**Objetivo clínico.** Rastrear risco de Deficiência Energética Relativa no Esporte (RED-S) — calcula Disponibilidade Energética (DE) e aplica questionários de risco (LEAF-Q para mulheres, LEA-Q13 para homens). É o instrumento de segurança mais bem construído do sistema no que diz respeito à ponte com a prescrição.

**O que pede.** Obrigatórios: `disponibilidadeEnergetica`, `scoreLeafQ` (`evaluation-registry.ts:170`). Ingestão calórica, gasto de exercício e massa magra podem vir automaticamente de outras avaliações da mesma sessão (alimentar, GET, composição integrada) ou ser informados manualmente como *fallback* quando a automação não está disponível (`triagem-reds-normalizer.ts:145-244`, `AvaliacaoTriagemREDS.jsx:732,759`); histórico de amenorreia, fratura por estresse, pressão por restrição, sintomas, e os questionários LEAF-Q/LEA-Q13 (`triagem-reds-normalizer.ts:285-291`). Esforço: **médio**, mais baixo quando os dados automáticos já estão disponíveis.

**O que calcula.** DE = (ingestão − gasto de exercício) / massa magra (kg) (`triagem-reds-normalizer.ts:246-253`) — a fórmula clássica de disponibilidade energética usada na literatura de RED-S/triadíade da atleta. Classificação: ótima (≥45 kcal/kg MM), risco relativo (30–45), RED-S estabelecido (<30) (`triagem-reds-normalizer.ts:91-96`) — esses cortes (45 e 30 kcal/kg de massa magra/dia) são os valores clássicos citados desde Loucks et al. e replicados no consenso do COI sobre RED-S **[média confiança — os valores 45/30 são amplamente citados nessa literatura, mas não confirmei contra o texto exato do consenso do COI de 2023]**. Score LEAF-Q/LEA-Q13 somado a partir das respostas.

**Como é mostrado.** Mesmo problema estrutural da carga de treino: `triagem_reds` **não está** em `DashboardAvaliacoes.jsx:METRIC_SPECS` (`DashboardAvaliacoes.jsx:43-114`), então o card no "Painel de avaliações" mostra "Sem indicadores configurados" mesmo depois de calcular DE e LEAF-Q — apesar de existir uma segunda tabela de specs com `triagem_reds` pronta e não usada (`evaluationSummaryUtils.js:115-119`, mesma função órfã `getModuleMetrics`). Dentro da própria tela de avaliação, porém, o resultado é bem apresentado, com seções "Resultado DE", "LEAF-Q (mulheres)", "LEA-Q13 (homens)", "Questionário de risco", "Sinais adicionais de risco" (ver abaixo).

**Organização da tela.** Sete seções: "Dados automáticos da sessão", "Informar manualmente", "Resultado DE", "LEAF-Q (mulheres)", "LEA-Q13 (homens)", "Questionário de risco", "Sinais adicionais de risco" (`AvaliacaoTriagemREDS.jsx:732,759,802,835,855,867,873`). A separação entre "dados automáticos" e "informar manualmente" é uma boa prática de transparência — deixa claro para quem preenche de onde cada número veio. LEAF-Q e LEA-Q13 aparecerem como seções sempre visíveis (não filtradas por sexo, a julgar pelos títulos "(mulheres)"/"(homens)" ficarem lado a lado no código) pode gerar confusão sobre qual dos dois preencher — não confirmei se a tela oculta um deles condicionalmente.

**Ligação com a prescrição.** É a avaliação com o aviso mais forte do sistema: quando a classificação é "estabelecido", abrir o plano alimentar dispara um diálogo de confirmação (`"Alerta RED-S — Disponibilidade Energética Crítica"`) que exige justificativa explícita e registra autor/hora antes de liberar a navegação (`AvaliacaoCompleta.jsx:1982-2002,2106-2120,1912-1919`); enquanto o aviso não for resolvido, um banner persistente também aparece na tela de avaliação (`AvaliacaoCompleta.jsx:2516-2524`). Isso é um aviso bem feito, não um bloqueio absoluto — o profissional sempre pode prosseguir, mas fica um registro de que decidiu fazê-lo cientemente. A lacuna: esse aviso só dispara na faixa "estabelecido" (DE<30); a faixa "risco_relativo" (DE 30–45) — que a própria literatura de RED-S trata como parte do mesmo contínuo de risco, não como "sem risco" — não gera nenhum aviso equivalente, nem na navegação nem no banner **[julgamento clínico sobre a relevância da faixa moderada]**.

**Veredito: ajuda** fortemente no aviso da faixa "estabelecido" — é o único caso do sistema em que uma avaliação efetivamente interrompe o fluxo até a prescrição com contexto e trilha de auditoria. Mas **atrapalha por omissão** em dois pontos: o card do painel principal fica vazio, e a faixa de risco moderado não tem nenhum sinal.

**Sugestões.**
- **Alta** — adicionar `triagem_reds` ao `METRIC_SPECS` do dashboard (mesmo ponto da seção 3.9), para que DE e classificação apareçam no painel principal sem precisar abrir a avaliação.
- **Média** — estender o aviso (não bloqueio) também à faixa "risco_relativo", com um tom visual mais leve que o de "estabelecido" — por exemplo um banner informativo em vez do diálogo de confirmação.

---

### 3.15 Exames laboratoriais

**Objetivo clínico.** Registrar resultados de exames (painel + analitos) e classificar cada um contra faixa de referência.

**O que pede.** Obrigatórios: `painel`, `analitos` (`evaluation-registry.ts:200`). Cada analito: nome, valor, unidade, referência mínima/máxima, data de coleta, laboratório (`exames-laboratoriais-normalizer.ts:100-123`). Esforço: **médio/alto**, proporcional ao número de analitos lançados manualmente (não há integração com laboratório externo, aparentemente).

**O que calcula.** Status por analito: alterado (fora da faixa), limítrofe (dentro de 5% da margem da faixa), normal, sem dado, sem referência (`exames-laboratoriais-normalizer.ts:45-65`); status do painel = pior status entre os analitos; um "score de risco" = (alterados×2 + limítrofes) × 10, limitado a 100 (`exames-laboratoriais-normalizer.ts:132-144`) — este score de risco parece ser uma convenção interna do projeto, não um índice clínico publicado **[baixa confiança sobre origem do score]**.

**Como é mostrado.** Card "Exames laboratoriais" no dashboard (total de analitos, alterados, painel) (`DashboardAvaliacoes.jsx:99-103`); dentro da própria tela de avaliação, um sinal "danger" destacado aparece quando há analitos alterados, com até 3 nomes listados (`AvaliacaoCompleta.jsx:1036-1047`).

**Organização da tela.** Duas seções: "Analitos" (lista/tabela editável) e "Resumo calculado" (`AvaliacaoExamesLaboratoriais.jsx:636,735`) — organização direta: entrada de um lado, resultado derivado do outro. Ponto de atenção: como os analitos são lançados como uma lista genérica (nome + valor + referência), não há agrupamento por sistema (ex. "hematológico", "hormonal", "ósseo") — para um painel com muitos analitos, uma lista plana pode dificultar notar padrões relacionados (ex. ferritina baixa + hemoglobina baixa apontando para o mesmo problema).

**Ligação com a prescrição.** Não entra em `getPacienteContext`; a única leitura automática hoje é o checklist de "conduta pronta para plano", que verifica apenas se existe um registro de exames finalizado — não se os valores estão dentro da referência (`AvaliacaoCompleta.jsx:814-829`). Os alertas configurados para vitamina D baixa e ferritina baixa em atletas (`AlertaBanner.jsx:18-31`) nunca chegam a aparecer, pois esse componente não é renderizado em lugar nenhum (ver seção 4).

**Veredito: ajuda** dentro da própria tela de avaliação — o sinal "danger" é direto e lista os analitos por nome — mas **atrapalha por omissão** no momento de prescrever: um exame claramente alterado (ex. ferritina baixa) não aparece em nenhum aviso na tela de prescrição, mesmo já existindo o sinal calculado em outro lugar do sistema.

**Sugestões.**
- **Alta** — levar o sinal de "analitos alterados" também como aviso (não bloqueio) para a tela de prescrição, reaproveitando o cálculo que já existe em `AvaliacaoCompleta.jsx:1036-1047`.

---

### 3.16 Evolução e retorno

**Objetivo clínico.** Acompanhar adesão ao plano alimentar/atividade física entre consultas e decidir a conduta de retorno.

**O que pede.** Obrigatórios: `adesaoPlanoAlimentar`, `adesaoAtividadeFisica`, `scoreAdesaoGeral` (`evaluation-registry.ts:210`). Adesão ao plano alimentar (%), adesão à atividade física (%), resposta percebida (1–5), intercorrências, sintomas, conduta, próxima avaliação (data) (`evolucao-retorno-normalizer.ts:72-106`). Esforço: **baixo/médio**.

**O que calcula.** Score de adesão geral = adesão alimentar×0,5 + adesão atividade física×0,35 + resposta percebida convertida em score×0,15 (`evolucao-retorno-normalizer.ts:108-114`) — uma média ponderada simples, não uma fórmula clínica publicada, e sim uma convenção do próprio sistema para sintetizar adesão **[fato do código, ponderação é decisão de produto, não citação clínica]**. Prioridade de retorno: alta (score<50 ou intercorrência/sintoma extenso), moderada (score<75), baixa (`evolucao-retorno-normalizer.ts:118-123`).

**Como é mostrado.** Card "Evolução e retorno" no dashboard ("Aplicação da Dieta" %, data, conduta) (`DashboardAvaliacoes.jsx:104-108`) — nota: o rótulo do card é "Aplicação da Dieta", mas o score é uma composição de adesão alimentar + atividade física + resposta percebida, não só dieta; o nome pode induzir a pensar que é 100% sobre alimentação.

**Organização da tela.** Duas seções: "Resumo calculado" e uma segunda com título dinâmico (`AvaliacaoEvolucaoRetorno.jsx:482,497`) — não confirmei o texto exato da segunda por não ter lido a tela inteira; a estrutura geral (poucas seções, formulário de 635 linhas) é compacta e direta para o propósito de registro de retorno.

**Ligação com a prescrição.** Não entra em `getPacienteContext`; o score de adesão só aparece no checklist interno de "conduta pronta para plano" dentro da tela de avaliação, com um aviso quando a adesão está abaixo de 60% mesmo com a conduta marcada como pronta (`AvaliacaoCompleta.jsx:1021-1034`) — um bom exemplo de aviso não bloqueante, no espírito certo.

**Veredito: ajuda.** O score é simples de entender, a prioridade de retorno é clara, e o aviso de baixa adesão aparece no lugar certo (perto de onde a decisão de seguir para o plano é tomada).

**Sugestões.**
- **Baixa** — renomear o rótulo "Aplicação da Dieta" no card do dashboard para algo que reflita que o score mistura alimentação, atividade física e resposta percebida (ex. "Adesão geral"), para não induzir a leitura de que é uma medida só de dieta.

---

### 3.17 Plano de metas

**Objetivo clínico.** Ferramenta de entrevista motivacional — o que a pessoa quer mudar, prós/contras, estratégias, grau de confiança — mais próxima de uma técnica de aconselhamento comportamental do que de um instrumento clínico calculado.

**O que pede.** Obrigatórios: `oQueQueroMudar`, `motivacao` (`evaluation-registry.ts:220`). Duas versões: "simples" (o que quero mudar, motivação 0–10, prós, contras) e "completa" (mudança desejada, motivos, como planejo, estratégias, planos para dificuldades, como outros podem ajudar, como monitorar, grau de confiança 1–10, observações) (`plano-metas-normalizer.ts:55-80`). Esforço: **baixo** (versão simples) a **médio** (versão completa).

**O que calcula.** Nada além de normalizar/limitar os campos numéricos (motivação 0–10, confiança 1–10) (`plano-metas-normalizer.ts:59-63,75-79`) — não há classificação nem score derivado; é puramente registro qualitativo estruturado.

**Como é mostrado.** Não tem card configurado em `DashboardAvaliacoes.jsx:METRIC_SPECS` nem em `evaluationSummaryUtils.js:EVAL_METRIC_SPECS` — é a única das 17 avaliações ausente das duas tabelas de indicadores (confirmei buscando `plano_metas` em ambos os arquivos). O card no painel de avaliações mostrará "Sem indicadores configurados" como carga de treino e RED-S, mas aqui isso é menos grave: sendo texto livre motivacional, não há de fato um "número" óbvio para resumir num card.

**Organização da tela.** Duas seções: "Exploração da mudança" e "Planejamento detalhado" (`PlanoMetasForm.jsx:303,338`) — nomes que acompanham a lógica de entrevista motivacional (primeiro explorar ambivalência, depois planejar). Estrutura clara para o que é.

**Ligação com a prescrição.** Não entra em `getPacienteContext` — coerente com a natureza do instrumento (motivação e estratégia comportamental não são, em si, uma meta calórica ou uma restrição alimentar).

**Veredito: neutra.** Bem estruturado para seu próprio propósito; como não há número a interpretar mal, o risco de leitura errada é baixo, mas também não há muito "ajuda" ativa a oferecer no raciocínio de prescrição — é antes um contexto qualitativo que o profissional pode ler para calibrar tom e estratégia de adesão do plano.

**Sugestões.**
- **Baixa** — nenhuma prioridade alta identificada; se algum resumo textual curto (ex. "o que o atleta quer mudar") fosse exposto como contexto na tela de prescrição, poderia ajudar a calibrar a comunicação do plano, mas isso é um "nice to have", não uma lacuna de segurança.

---

## 4. Análise transversal

### 4.1 Fluxo de dados das avaliações até a prescrição

Nem toda avaliação precisa alimentar a prescrição — a maioria tem propósito próprio (triagem, acompanhamento, registro interprofissional). O mapa abaixo é só o fato de quem lê o quê, sem julgar isso como certo ou errado:

| Origem | O que passa adiante | Destino | Automático ou manual |
|---|---|---|---|
| Perímetros / Dobras cutâneas / Bioimpedância | %gordura, massa gorda, massa magra, água corporal | Composição corporal integrada (hierarquia de fontes, `calculationEngine.js:2007-2032,2127`) | Automático, com override do profissional (`ComposicaoCorporalIntegradaForm.jsx:144-157`, exige justificativa) |
| Composição corporal integrada | %gordura/massa magra "oficiais", TMB selecionada | Gasto energético total (`calculationEngine.js:2172-2205`) | Automático |
| Carga de treino | Registro semanal de MET, fase de treino | Gasto energético total (PAL real, referência de CHO periodizado) | Manual (o profissional decide integrar os dois módulos) |
| Gasto energético total | Meta calórica (kcal) | Prescrição (`plano-alimentar.service.ts:386-430`) | Automático |
| Anamnese inicial | Restrições/alergias (texto livre), sexo/idade | Prescrição — restrições e referência DRI (`referencias-prescricao.ts:85-133`) | Automático, com suspensão de sugestões até conferência humana quando o texto não é uma negação clara |
| Alimentar (NOVA), GET | Ingestão vs. gasto (comparação) | Sinal de balanço energético na tela de avaliação | Automático, mas só dentro da tela de avaliação (`AvaliacaoCompleta.jsx:1059-1087`) |
| Triagem RED-S | Classificação "estabelecido" | Aviso com override obrigatório antes de abrir o plano | Automático (aviso), nunca bloqueio absoluto |
| Exames laboratoriais, Evolução/retorno | Presença de registro finalizado, score de adesão | Checklist de "conduta pronta para plano" (`AvaliacaoCompleta.jsx:809-854`) | Automático, mas só verifica presença/score — não valores clínicos |
| Socioeconômica, Hidratação, Psicologia, Fisioterapia, Plano de metas, Composição por imagem, Avaliação clínica | — | — | Nenhuma leitura automática pela prescrição hoje; ficam disponíveis para consulta manual no prontuário |

### 4.2 Lacunas

- **Ajuste automático de meta por risco de RED-S**: mesmo com DE calculada, a meta calórica do GET não é automaticamente protegida contra um déficit adicional quando a triagem indica risco — o aviso existe, mas o número da meta não muda sozinho. Isso é aceitável como decisão de produto (a decisão final é clínica, não deveria ser automática), mas vale registrar que não existe.
- **Meta de macronutrientes em grama**: como visto na seção 3.8, o GET não calcula `choG`/`ptnG`/`lipG`, apesar de já ter a base (peso, tabela de CHO periodizado por fase de treino) para fazer isso.
- **Contexto de custo/acesso a alimentos** (EBIA): existe classificação de insegurança alimentar pronta, mas nenhuma tela de prescrição a exibe como lembrete.

### 4.3 Sobreposições e conflitos

- **%gordura/massa magra em 4 lugares** (perímetros por equação, dobras cutâneas, bioimpedância, imagem 3D): o sistema já resolve isso bem para os 3 primeiros — hierarquia explícita de prioridade, cálculo do *spread* entre métodos com sinalização quando a divergência é grande (`hasRelevantMethodSpread`, `calculationEngine.js:2121`), e override do profissional com justificativa obrigatória. A avaliação por imagem fica de fora dessa reconciliação (ver 3.7) — o que evita um quinto número concorrendo, mas também significa que, se algum dia ela virar validada, vai exigir entrar nessa hierarquia.
- **Peso corporal em 4+ avaliações** (perímetros, bioimpedância, GET, imagem): não encontrei nenhuma verificação cruzada de consistência entre pesos registrados na mesma sessão (ex. avisar se o peso da bioimpedância difere muito do peso dos perímetros no mesmo dia) — não é uma falha grave, mas é uma oportunidade perdida de checagem barata.
- **"Composição corporal" no resumo clínico do dashboard fixada em `bioimpedancia`** (`DashboardAvaliacoes.jsx:120`), mesmo quando a fonte oficial escolhida na composição corporal integrada é outra (dobras, por exemplo) — o card mostra sempre o número de bioimpedância, criando risco real de dois números diferentes com o mesmo rótulo "composição corporal" no mesmo prontuário (ver 3.6).
- **`composicao_corporal_integrada` fora do catálogo oficial**: não aparece em `evaluation-registry.ts` (servidor) nem em `src/constants/evaluationRegistry.js` (frontend) — apesar de ser o módulo que decide a fonte "oficial" de composição corporal e a fórmula de TMB usada no GET. Tem seu próprio normalizador (`composicao-corporal-integrada-normalizer.ts`), suas próprias regras de finalização (`avaliacoes.service.ts:1377`) e seu próprio formulário, mas nenhum registro formal no catálogo dos "17 tipos" — o que é estranho dado seu papel central, mesmo não afetando o funcionamento.

### 4.4 Hierarquia de informação no momento de prescrever

O que o prescritor vê primeiro, na tela `PrescricaoPlano.jsx`: painel de macros/meta calórica (`PainelMacros.jsx`), tabela de adequação contra a referência DRI (`TabelaAdequacao.jsx`), restrições pendentes/conferidas (`PainelRestricoes.jsx`), depois a lista de refeições. O aviso de RED-S aparece **antes** de chegar a essa tela (na navegação, `AvaliacaoCompleta.jsx:2106-2120`), não dentro dela — quem entra direto pela URL `/prescricao-plano/:id` sem passar pela navegação guardada não recebe esse aviso de novo (não confirmei se há uma segunda checagem na própria tela de prescrição; pelo código lido, o aviso é só na navegação a partir de `AvaliacaoCompleta.jsx`).

O que deveria estar mais perto do início e não está: classificação EBIA (custo/acesso), última avaliação clínica com prioridade alta/urgente, exame alterado, questionário psicológico acima do corte. Nenhum desses aparece na tela de prescrição hoje.

O que sobra: a tela de prescrição não tem excesso de números por si — a organização (`PainelMacros` → `TabelaAdequacao` → `PainelRestricoes` → refeições) é enxuta. O excesso está espalhado nas 17 avaliações, sem nenhum resumo consolidado que reúna os pontos de atenção (RED-S, exames, psicologia, EBIA) num único lugar visível a partir da prescrição.

### 4.5 Segurança clínica — avisos que existem, que não existem, e o que fazer com eles

Sem recomendar bloqueio de plano por falta de avaliação — a única trava hoje é o RED-S "estabelecido", e ela já é bem desenhada (aviso + justificativa + registro de autoria, sem impedir definitivamente). O que falta é estender o mesmo espírito de **aviso** (nunca bloqueio automático) a outros sinais que já são calculados, mas não aparecem:

- RED-S "risco_relativo" — calculado, sem nenhum aviso (nem na navegação, nem no card do painel, que fica vazio).
- Exame laboratorial alterado — calculado e mostrado com destaque dentro da tela de avaliação (`AvaliacaoCompleta.jsx:1036-1047`), mas não chega como aviso à tela de prescrição.
- PHQ-9/GAD-7 acima do corte — dispara só uma notificação best-effort à equipe (`clinical-alerts.service.ts`), não um aviso na tela de prescrição.
- `AlertaBanner.jsx` — componente pronto para RED-S, vitamina D baixa, ferritina baixa e ACWR de risco, nunca importado em lugar nenhum do sistema. É o exemplo mais claro de um aviso que já foi construído e nunca chegou a aparecer para ninguém.

### 4.6 Um padrão que se repete: telas construídas e nunca ligadas

Vale nomear como achado transversal, porque aparece pelo menos quatro vezes: `AlertaBanner.jsx` (154 linhas, 0 usos fora de si mesmo), `ModuloCard.jsx` (0 usos), a função `getModuleMetrics` em `evaluationSummaryUtils.js` (0 chamadas), e a tela `PrescricaoPlanoAlimentar.jsx` (988 linhas, importada em `App.jsx:31` mas nunca renderizada em nenhuma rota — a rota ativa usa `PrescricaoPlano.jsx`, `App.jsx:118`). Isso não é uma crítica a essas peças em si — o código parece funcional —, mas indica que revisões de tela substituíram partes do fluxo sem remover o que ficou para trás, e alguém lendo o repositório (ou outra IA) pode facilmente assumir que essas telas estão em uso quando não estão.

---

## 5. Top 10 recomendações

Ordenadas pelo impacto esperado no raciocínio de quem prescreve — não pela integração automática, que não é objetivo em si. Nenhuma recomendação abaixo é "bloquear o plano"; onde cabe alerta, é aviso com opção de prosseguir, como o RED-S já faz.

1. **Religar os avisos que já existem mas não aparecem a ninguém — `AlertaBanner.jsx`** (RED-S de risco, vitamina D baixa, ferritina baixa, ACWR de risco). Esforço: **baixo** (o componente já está pronto, falta só importá-lo em algum lugar real da interface e alimentar `alertas`/`pacienteId`).
2. **Dar indicadores ao card de Carga de treino e ao de Triagem RED-S no "Painel de avaliações"** — hoje ambos mostram "Sem indicadores configurados" mesmo com ACWR e DE já calculados; existe até uma segunda tabela de specs pronta e não usada (`evaluationSummaryUtils.js:115-124`). Esforço: **baixo**.
3. **Estender o aviso de RED-S para a faixa "risco_relativo"**, com um tom visual mais leve que "estabelecido" (banner informativo, sem o diálogo de confirmação). Esforço: **médio**.
4. **Levar o sinal de "exame alterado" (já calculado em `AvaliacaoCompleta.jsx:1036-1047`) como aviso na tela de prescrição.** Esforço: **médio** (o cálculo já existe, falta expor no lugar certo).
5. **Dar destaque visual aos campos de maior risco na avaliação de psicologia** ("Risco de compulsão alimentar", "Sinais de alerta psicológico"), hoje com o mesmo peso visual que "Humor atual". Esforço: **baixo**.
6. **Corrigir o card "Composição corporal" do resumo clínico para acompanhar a fonte oficial escolhida** em vez de ficar fixo em `bioimpedancia` (`DashboardAvaliacoes.jsx:120`). Esforço: **baixo**.
7. **Adicionar uma nota de ressalva à classificação de IMC quando há massa magra elevada conhecida** (de dobras/bioimpedância), avisando que o corte de IMC não diferencia massa magra de gorda. Esforço: **baixo**.
8. **Fazer `context: 'atleta'` chegar às duas chamadas de `calculateTmbComparative`**, para que Cunningham/Guedes concorram de verdade como padrão quando há massa magra conhecida, em vez de o padrão cair silenciosamente em Henry (2005). Esforço: **médio**.
9. **Calcular e exportar metas de macro em grama (CHO/PTN/LIP)** a partir do GET e da tabela de CHO periodizado por fase de treino que já existe na tela, em vez de deixar esses campos sempre nulos até a prescrição. Esforço: **médio**.
10. **Arrumar a casa: decidir o destino do código órfão** (`PrescricaoPlanoAlimentar.jsx`, `ModuloCard.jsx`, `getModuleMetrics`) e registrar `composicao_corporal_integrada` no catálogo oficial de avaliações, dado seu papel central no cálculo de composição corporal e TMB. Esforço: **baixo/médio**.

---

## 6. Limites da análise

- **Só li código, não rodei nada.** Não abri o app em navegador, não vi nenhuma tela renderizada de verdade, não simulei preenchimento nem sessão real. Tudo o que descrevo como "como é mostrado" é inferido da JSX/CSS/props, não de uma captura de tela. Onde a tarefa pedia verificação visual, não pude fazer — a instrução foi explícita em não subir a aplicação.
- **Não conferi todos os textos de UI linha a linha.** Formulários como `PerimetrosCorporaisForm.jsx` (2681 linhas), `AvaliacaoImagem.jsx` (2285 linhas), `BioimpedanciaForm.jsx` (1620 linhas) e `GastoEnergeticoTotalForm.jsx` (1697 linhas) foram lidos por amostragem (busca de padrões, seções específicas), não integralmente. Pode haver ressalvas, textos de ajuda ou tooltips que eu não vi e que mitigam algum dos riscos de leitura apontados (por exemplo, pode existir um aviso textual sobre hidratação antes da bioimpedância que não encontrei).
- **Referências clínicas citadas são, em parte, reconhecimento de padrão, não verificação bibliográfica.** Marquei explicitamente com **[julgamento clínico]** ou **[baixa/média confiança]** todo ponto em que citei uma diretriz, consenso ou fonte sem ter conferido o documento original (ex. cortes de RED-S, ACWR, hidratação, EBIA, CHO periodizado). Onde o próprio código já cita a referência (ex. Mifflin-St Jeor, Harris-Benedict, Lipschitz, PHQ-9/GAD-7, SBC 2020), tratei isso como fato do código, não como verificação clínica minha.
- **Não testei o comportamento em runtime**, então não posso garantir que toda lógica lida (ex. condições de exibição, ordens de fallback) se comporta exatamente como o código sugere em todos os casos — há sempre a possibilidade de um estado que só aparece com dados reais e que eu não simulei.
- **Fisioterapia, avaliação clínica e psicologia foram analisadas com foco no que interessa à nutrição/prescrição**, por ser esse o eixo pedido pela tarefa; uma análise dedicada à qualidade clínica *dentro* desses domínios (ex. adequação dos testes especiais de fisioterapia) exigiria um especialista de cada área, não uma leitura de código.
- **Não tive acesso a nenhum dado real de paciente**, então não posso avaliar como esses formulários se comportam com dados de fronteira reais, taxas de preenchimento incompleto, ou frequência real de cada risco (ex. quantos atletas de fato caem em "risco_relativo" de RED-S) — só descrevo o que o código faz, não o que acontece na prática.
- **A "Organização da tela"** foi inferida da estrutura de seções/títulos no JSX (`<h4 className="eval-section-title">`, `<legend>`, arrays de abas), não de um teste de usabilidade real com usuários — é uma leitura estrutural, não uma avaliação de UX validada com pessoas.

---
