# Change Intent — avaliações no padrão visual do sistema

Data: 27/09/2026. O usuário pediu que a parte de avaliações ganhe organização e a mesma identidade visual do resto do sistema ("Energia e velocidade", da landing), num trabalho bem estruturado e feito com agentes. O commit fica com o usuário.

## Problema

As 17 avaliações e a página que as reúne (`AvaliacaoCompleta`) somam cerca de 40 mil linhas, e cada formulário tem CSS próprio, com Poppins/Inter e cores fixas. Os formulários longos não têm agrupamento claro, e o mesmo elemento aparece com visual e comportamento diferentes de um formulário para outro. O resto do sistema (landing, inscrição, sidebars, Visão geral e áreas da Liga) já segue o padrão novo.

## Decisões do usuário (27/09/2026)

1. **Escopo:** os formulários e a página que os reúne, com o cabeçalho do atleta, as etapas e a navegação entre módulos. Como os resultados aparecem no prontuário fica para a onda seguinte, com as mesmas peças.
2. **Organização:** reagrupar os campos em seções com título, mudar a ordem visual e dividir os formulários longos em blocos. Os campos, os rótulos, as validações e o dado salvo continuam os mesmos.
3. **Validação:** checagem leve em cada lote (ESLint, testes estáticos e diff contra o backup). O navegador entra só no fim, numa rodada única, porque a máquina está pesada.
4. **As avaliações não são pré-requisito do plano alimentar.** Nenhuma delas precisa estar ligada ao plano para liberá-lo, e esta onda não cria travas nem integrações.

## Escopo (arquivos)

| Grupo | Arquivos |
|---|---|
| Página | `src/views/AvaliacaoCompleta.jsx` (3.640) e `.css` (4.021) |
| Peças comuns | `src/components/Avaliacoes/components/*`, `hooks/*` e `avaliacoes.css` |
| Antropometria | `Antropometria/` Perímetros, Dobras, Bioimpedância e Gasto energético total |
| Clínica | `anamnese/`, `clinica/`, `avaliacao-socioeconomica/` e `avaliacao-exames-laboratoriais/` |
| Esporte | `src/views/avaliacoes/` (Alimentar, Carga de treino, Triagem REDS) e `avaliacao-hidratacao/` |
| Interprofissional | `avaliacao-psicologia/`, `avaliacao-fisioterapia/`, `avaliacao-evolucao-retorno/` e `plano-metas/` |
| Imagem | `avaliacao-imagem/` (JSX de 2.285 linhas, CSS de 3.267 e `Body3D`) |

`src/components/Triagem/EscalasVisuais` já foi feito na onda da inscrição e só é reutilizado.

## Fatos medidos (27/09/2026)

Medição pelo orquestrador, depois de conferir o inventário do agente, que estava incompleto.

- **A página monta 16 módulos** (`AvaliacaoCompleta.jsx`, por volta das linhas 2284–2315). A 17ª avaliação, **Imagem** (`composicao_corporal_imagem`), é montada no prontuário (`DashboardAvaliacoes.jsx`) e na tela do aluno (`StudentView.jsx`). Ela entra no lote IMG, mas os hospedeiros continuam como estão.
- **Sem nenhum import, fora da onda:** `ComposicaoCorporalIntegradaForm`, `AvaliacaoAlimentarNOVA`, `AvaliacaoTextual` e `ResultadosAntropometricos`. A remoção fica como item de acompanhamento e depende de aprovação.
- **Rótulos:** nenhum formulário usa `htmlFor` (a Imagem usa 1). Os rótulos envolvem o campo ou ficam soltos.
- **Componentes de campo locais:** cada formulário define os seus (`InputField`, `Field`, `FieldText`…).
- **CSS:** todos os formulários, menos a Imagem, importam o comum `avaliacoes.css` (1.099 linhas) e mais um CSS próprio.

## Não objetivos

- Os resultados no prontuário (`src/components/Prontuario/*`), o relatório clínico e a tela do atleta.
- O servidor, os normalizadores, os cálculos, as classificações e os pontos de corte.
- **O conteúdo clínico.** Nenhum campo é criado nem removido, e nenhum texto de rótulo, opção ou orientação muda. As sugestões de conteúdo da análise conceitual viram uma proposta separada, que depende de aprovação.
- `modalSystem.css` e os modais globais.
- O modo escuro, que o usuário decide depois para todas as superfícies novas de uma vez.

## Invariantes

1. **Mesmo dado salvo.** O payload de cada avaliação (chaves, tipos, conversões de unidade, `tipo`, rascunho e finalização) fica idêntico. A prova é o diff contra `tmp/avaliacoes-v1/`: estados, handlers, montagem do payload e chamadas de API sem mudança. Só muda a marcação.
2. **Mesmos cálculos e classificações** no cliente: fórmulas, arredondamentos e pontos de corte.
3. **Mesmas validações e obrigatoriedades,** com as mesmas mensagens.
4. **Mesmos fluxos:**
   - salvamento automático e rascunho (`useSaveStatus`, `useModuleSnapshot` e `useEdicaoPendente`);
   - "valor anterior" (`ValorAnterior`, `historicoDeCampo`);
   - prontidão (`EvaluationReadiness`);
   - revisão e supervisão;
   - contexto da triagem pública.
5. **Mesmas permissões:** quem edita, quem só lê e quem revisa.
6. **Mesmos textos:** rótulos, opções, ajudas e mensagens.
7. **Nenhum dado real** em teste nem em verificação.

## Padrão visual

- **O mesmo das ondas anteriores:**
  - os tokens `--lt-*` de `src/views/landing/landing-tokens.css`;
  - o par Sofia Sans;
  - cartões brancos com `--lt-radius-card`;
  - alvos de 44 px ou mais e campos de 48 px;
  - foco com `--lt-focus-ring`;
  - contraste de 4,5:1 ou mais;
  - status escritos (nunca só cor).
- **Formulários:** o padrão de `src/views/public/inscricao/campos.jsx` (`FieldGroup` com `useId`/`htmlFor`), com todo campo rotulado e a unidade visível.
- **Resultados calculados:** valor, unidade, referência e classificação escrita.
- **Armadilhas globais:** `h1…h6`, `p`, `button` e `input:not(...)`. Ver a seção "Direção vigente" de `docs/design/landing-guia-visual.md`.

## Fases

0. **Inventário:**
   - o inventário visual e estrutural, medido por um agente Haiku;
   - a análise conceitual (o que cada avaliação pede e mostra), feita por um agente Sonnet.
1. **Base comum:** um executor Opus faz:
   - o contrato `contrato-avaliacao.md`;
   - os componentes compartilhados de formulário e resultado;
   - o CSS base escopado;
   - as peças comuns já existentes no novo visual;
   - um teste estático.
2. **Página `AvaliacaoCompleta`:** cabeçalho do atleta, etapas e navegação entre módulos.
3. **Lotes de formulários em paralelo,** com um executor Opus por lote, arquivos disjuntos, no máximo 3 ao mesmo tempo (limite de uso):
   - A1: Perímetros e Dobras;
   - A2: Bioimpedância e Gasto energético total;
   - C: Anamnese, Clínica, Socioeconômica e Exames;
   - E: Alimentar, Carga de treino, Triagem REDS e Hidratação;
   - I: Psicologia, Fisioterapia, Evolução/retorno e Plano de metas;
   - IMG: Imagem.
4. **Verificação final:**
   - `npm run lint`, `test:ui` e `build`;
   - a rodada de navegador do orquestrador com API sintética, com as 17 avaliações a 1280 e 390 px, como quem edita e como quem só lê;
   - a revisão independente em Opus;
   - as correções.

## Verificação por lote (checagem leve)

- `npx eslint` nos arquivos do lote e o postcss lendo o CSS sem erro.
- Diff contra `tmp/avaliacoes-v1/`: estados, handlers, payload e chamadas iguais, e nenhum texto visível perdido.
- O teste estático da base, com escopo, fontes, tokens e campos rotulados.

## Reversão

As cópias de antes estão em `tmp/avaliacoes-v1/` (76 arquivos, mesmos caminhos). Para reverter um lote, copie de volta os arquivos dele.

## Andamento

### Fase 1, base comum: concluída
- Contrato, componentes, CSS escopado em `.av-modulo` e `test-avaliacao-base.cjs` (25 verificações, já no `test:ui`).
- **Correção do orquestrador** depois do A1: a raiz com `eval-card` herdava o hover de `avaliacoes.css`, que levantava o módulo inteiro, e a trama de leitura em `::before`. As duas foram neutralizadas em `avaliacao-base.css`.

### Lote A1, Perímetros e Dobras: concluído
**Conferência do orquestrador:**
- ESLint sem erro (1 aviso preexistente, `sexToken`);
- `onChange`/`value`/`checked`/`disabled` e as chamadas idênticas ao backup;
- o teste da base passa.

**O executor verificou:**
- o modo essencial com a mesma contagem em 6 cenários sintéticos;
- os controles sem rótulo, que caíram de 10–35 para 0;
- nenhum texto perdido.

**Mudança de ordem para confirmar:** em Perímetros, "Contexto da medição" subiu para antes de "Dados opcionais".

**Pedidos à base, para a consolidação depois dos lotes:**
- um espaço de variação em `ResultadoCalculado`;
- um espaço de dica "?" com 44 px no `Campo`;
- um tom de atenção em `Campo` para a faixa fisiológica.

### Coordenação com o WI-007 (28/09/2026)
Outra frente, o **WI-007** ("organização do prontuário e autonomia das avaliações", `docs/inception/prontuario/WI-007/README.md`), editou em 27/09, entre 19:33 e 19:53, vários arquivos da página e dos formulários. Mudou lógica e textos: removeu a dependência entre módulos, fez o GET calcular a TMB pelo perfil e tirou `cargaTreinoIntegracao` do payload do GET. Os arquivos:
- `AvaliacaoCompleta.jsx`, o GET, Carga de treino, RED-S (JSX e CSS), Evolução/retorno e Exames;
- `calculationEngine.js`;
- no prontuário, `DashboardAvaliacoes`, `VisaoGeral` e `ProntuarioPatch.css`.

**Decisão do usuário:** "nova linha de base". O WI-007 **ainda vai continuar**. Por isso:
- **A nova base para a prova por diff é `tmp/avaliacoes-v1b/`,** gravada em 28/09 às 06:30. As mudanças do WI-007 são o novo "antes" e têm de ser preservadas. Os hashes dos arquivos do WI-007 estão em `tmp/avaliacoes-v1b/wi007-hashes.txt`.
- **Os arquivos do WI-007 ficam por último.** Antes de gravar em um deles, o executor confere se o hash mudou desde que leu. Se mudou, para aquele arquivo e reporta, sem sobrescrever.
- **Mudanças de dado salvo, lógica e texto nesses arquivos são do WI-007,** não desta onda. Exemplo: a remoção de `cargaTreinoIntegracao` do GET.
- **A página ficou com as duas frentes misturadas.** No JSX estão a marcação da fase 2 (Painel e ícones) e a lógica do WI-007. O CSS da página é só desta onda e estava pela metade quando o limite de uso caiu.

### Lote A2: Bioimpedância concluída; GET adiado
Conferência do orquestrador: ESLint limpo, mesmas ligações de campo e postcss ok. Mudança de ordem: "Base antropométrica" passou para antes da leitura. **O GET foi adiado** porque o WI-007 o alterou durante o lote. Ele volta num lote próprio, contra a base v1b e com a proteção de hash.

### Fase 2, página `AvaliacaoCompleta`: concluída
**Conferência do orquestrador:**
- o JSX é idêntico à v1b (sha1 `40a4aa28449a`): a marcação da fase 2 foi gravada antes do WI-007, e nada do WI-007 foi tocado;
- ESLint limpo;
- CSS de 4.021 para 2.178 linhas (259 regras), só com `--lt-font-family`/`--lt-font-display` e sem nenhum seletor `eval-card`/`.card`/`av-modulo`.

**Pendências da seção 12 do contrato, resolvidas:**
- a regra que zerava os cartões internos foi removida;
- o h3 do módulo na trilha vira `<p>` quando um módulo está aberto;
- a área do módulo fica no fundo da página;
- o bloco de contagem do modo essencial ficou intacto.

**Mudanças visíveis a confirmar:**
- o histórico passou para depois do formulário no celular;
- a ficha base, a triagem e a última sessão ficaram num só cartão;
- os estados aparecem escritos no seletor e no mapa ("pendente" é novo).

**Para decidir:**
- não há controle de etapas (a faixa `.avaliacao-stage-tab` não existe nem na v1);
- o Painel não tem tom de perigo;
- a prioridade dos próximos passos só aparece pela cor;
- os termos de estado estão desuniformes;
- o `aria-label` do aside ficou impreciso.

**Teste de navegador desatualizado (antes desta onda):** `tests/browser/readiness.spec.js:74-78` espera "Progresso clínico" e `.avaliacao-stage-tab`, que não existem nem na v1.

### Lote I: Psicologia, Plano de metas e Fisioterapia concluídos; Evolução em conserto
**Conferência do orquestrador:** ESLint limpo, `onChange`/`value`/`checked`/`disabled` e chamadas iguais à v1b, postcss ok nos três. O executor comparou com SSR sintético: mesmos controles e textos, e a contagem do modo essencial igual.

**Destaques:**
- **Psicologia:** questões do PHQ-9/GAD-7 em `fieldset` com as 4 respostas rotuladas; o escore incompleto mostra "—"; faixa de atenção nos campos de risco e no item 9.
- **Plano de metas:** o alternador Simples/Completo ganhou `aria-pressed`.
- **Fisioterapia:** todo campo de tabela tem rótulo; novos subtítulos "Objetivos"/"Condutas".

**Incidente na Evolução (28/09):**
- **O que houve:** uma gravação parcial do lote deixou o JSX sem compilar, com tags abertas e variáveis sem uso. Às 07:07:43, outra gravação, provavelmente a limpeza de lint do WI-007, fechou as tags e apagou o que estava sem uso.
- **Resultado:** o campo "Próxima avaliação" sumiu da tela (o valor continua no dado salvo), junto com a nota de conduta e a linha de contexto.
- **Apuração do orquestrador:** a página ainda passa `onboardingContext`, e `condutaStatus` usa só dados da própria Evolução. A remoção foi limpeza, não decisão do WI-007.
- **Consertado às 13:03:** o arquivo foi montado no scratchpad e gravado uma vez, com o hash conferido (`a55b6cd6` → `4e987adb`). A conferência do orquestrador:
  - ESLint limpo;
  - ligações iguais à v1b;
  - o campo "Próxima avaliação", a nota de conduta e a linha de contexto de volta;
  - SSR do executor com 9 controles iguais em 7 cenários.

  Mudança de ordem a confirmar: a nota de conduta foi para "Resumo calculado".
- **Lição para os próximos lotes:** em arquivo com outra frente ativa, montar a versão inteira no scratchpad e gravar uma vez só.

**Defeitos notados (sem correção):**
- **Escore de adesão da Evolução** (`calculationEngine.js:3264-3303`): um indicador ausente conta como 0. Com o formulário vazio, a tela mostra 0%, prioridade "alta" e "Retorno exige conduta prioritária". Esse 0 vai para o dado salvo.
- **Prioridade crua na Evolução:** aparece como "sem_classificacao".
- **Perimetria da Fisioterapia:** usa o nome do segmento como chave, então cada tecla remonta a linha e tira o foco.
- **Data máxima do Plano de metas:** o `max` usa UTC e aceita a data de amanhã depois das 21h.

### Lote C: Socioeconômica, Anamnese, Clínica e Exames concluídos
**Conferência do orquestrador:** ESLint limpo, ligações e chamadas iguais à v1b, postcss ok nos quatro. Os Exames foram gravados com conferência de hash (`62960c79` → `98c92028`). Pelo SSR do executor, 39 cenários sem falha, exceto o "—" deliberado da EBIA.

**Para confirmar:**
- a EBIA sem respostas mostra "—" no lugar de "0 pontos · Segurança Alimentar";
- na Clínica, os resultados vieram para logo depois de "Sinais vitais";
- a Anamnese ficou sem índice, porque as abas já cumprem esse papel;
- a Socioeconômica ganhou índice.

**Defeitos notados (sem correção):**
- `condutaLabStatus` (Exames) procura `critico`, `alto` e `moder`, mas `statusPainel` só usa `alterado`, `limitrofe`, `normal` e `sem_classificacao`. Com isso, um painel com analito alterado e escore abaixo de 40 aparece como "Exames consistentes para conduta";
- com o formulário vazio, a Clínica mostra "0 alertas" em verde;
- os Exames mostram "0 %" mesmo sem nenhum analito classificado;
- a Anamnese vazia mostra prioridade "Baixa";
- os botões de remover da Anamnese não têm nome acessível.

### Lote E: Hidratação, Alimentar, Carga de treino e RED-S concluídos
**Conferência do orquestrador:**
- ESLint limpo, chamadas iguais à v1b e postcss ok nos quatro;
- `test-reds-autonomy` e `test-avaliacao-base` passam;
- as diferenças de `value=` na Hidratação e na Carga são dos cartões de exibição, que viraram `ResultadoCalculado valor=` com as mesmas expressões.

O executor rodou SSR em 41 cenários, com os mesmos controles, e comparou por AST: nenhuma linha de lógica mudou. O trabalho do WI-007 em Carga e RED-S continua lá, e nada do que ele removeu voltou.

**Para confirmar:**
- "—" no lugar de 0 na Alimentar (kcal e macros sem registro, notas de adesão sem resposta) e na carga semanal da Carga;
- a barra de salvar da Alimentar foi para o pé do módulo;
- cores NOVA com dois hex novos (`#0f766e` e `#b45309`);
- a classificação aparece repetida entre o selo e o cartão na Hidratação, na Carga e na RED-S.

**Defeito notado (sem correção):** na Hidratação, com ganho de peso, aparecem perda, taxa de sudorese e meta de reposição negativas (por exemplo, "-600 ml").

### Pedidos à base (consolidar depois dos lotes)
- Um espaço de dica "?" com 44 px fora do `<label>` em `Campo` e `ResultadoCalculado` (A1 e C).
- Um tom de atenção em `Campo`/`GrupoOpcoes` para a faixa fisiológica (A1, I e C).
- `ResultadoCalculado` com valor em texto (classificação), `rotulo` opcional e espaço de variação (A1, I, C e E).
- `rotuloOculto` sem deixar o espaço vazio do cabeçalho (I e E).
- Um grupo de opções rotulado por um título existente, sem `legend` (C e E).
- Oficializar o id `${id}-titulo` de `AvaliacaoSecao` (E).

### Lote IMG: pausado (28/09, 18:54)
Outra frente reescreveu a Imagem às 14:58–14:59: 591 linhas no JSX, 384 no CSS e 22 no `Body3D`. Mudaram `findEvaluation`, `listImageEvaluations`, a trava de foco do diálogo e o movimento reduzido. O executor não gravou nada, e a base v1c ficou invalidada. A Imagem só volta à onda quando a outra frente terminar, com uma base nova.

### GET: pausado
Continua igual à v1c desde 06:57, mas fica para o fim pelo mesmo motivo: a outra frente está ativa. O WI-007 mexeu duas vezes na lógica dele.

### Defeito de cálculo encontrado (fora da onda, precisa de aprovação)
**% de gordura YMCA:** `src/services/calculationEngine.js:322-324` aplica a equação YMCA com cintura em cm e peso em kg, mas ela foi calibrada em polegadas e libras. A cópia local em `PerimetrosCorporaisForm.jsx` (`computeYmcaPercentFat`) repete o erro. Com dados plausíveis, a tela mostra cerca de 345%.

### Estados só por cor (preexistentes, fora da onda por ser texto novo)
- A assimetria de 10% ou mais ganhou um ícone.
- A silhueta não tem legenda.
- A variação pinta de verde qualquer aumento, inclusive o do % de gordura.

### Consolidação da base: concluída (29/09)
**Conferência do orquestrador:**
- `test-avaliacao-base`: 36 verificações (25 antigas e 11 novas);
- `test-painel`: 17;
- ESLint só com o aviso preexistente `sexToken`;
- ligações iguais em Dobras, Perímetros e Clínica;
- postcss ok;
- a correção da raiz `eval-card` preservada.

O executor comparou com SSR: sem as props novas, os 12 formulários que não adotaram nada renderizam HTML idêntico (94 de 94 cenários). A prova por mutação pegou 14 de 14.

**Props novas, opcionais:** `dica` (botão "?" de 44 px fora do rótulo, com `aria-expanded` e Esc), `tom` em `Campo` e `GrupoOpcoes`, e `ResultadoCalculado` com `rotulo` opcional, `valorEmTexto` e `variacao` + `melhorQuando`. Também: `rotuloOculto` sem o vão, `GrupoOpcoes rotuladoPor` e `idTituloSecao`.

**Adotado em Dobras, Perímetros e Clínica:** o texto "Abrir informação" saiu do nome acessível dos campos (eram 12, 8 e 22).

**Mudança de interação:** a dica abre no clique, Enter ou espaço, e não mais no hover.

A lista de gambiarras locais que as props novas podem substituir numa próxima passada está no relatório do executor.
