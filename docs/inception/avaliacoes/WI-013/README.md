# WI-013 — avaliações: cálculos corretos, nome "disponibilidade energética" e resultados claros

@work-item-id WI-013

## Intenção de mudança

A análise de 01/10/2026 (`docs/implementacao/avaliacoes-v2/analise-completa/`) confirmou que as avaliações são independentes, mas encontrou cálculos que mostram e **gravam** números enganosos, painéis sem indicador e telas que misturam o preenchimento com o resultado. O usuário pediu, em 02/10/2026, para trabalhar nestas frentes:

1. **Cálculos:** corrigir os seis defeitos confirmados, cada um com teste de regressão.
2. **Nome:** a triagem chamada "RED-S" passa a ser **"disponibilidade energética"** em toda a interface e nas mensagens do servidor.
3. **Painéis:** a disponibilidade energética e a carga de treino ganham indicadores no prontuário e no cartão do professor; o cartão "Composição" segue a fonte real; a ausência de dado deixa de aparecer como "0 alertas" ou como código cru.
4. **Resultado de cada avaliação:** cada avaliação passa a ter duas partes, **Preencher** e **Resultado**, independentes de qualquer outra avaliação. O resultado mostra o que importa, com referência e com a comparação com a avaliação anterior **do mesmo tipo**. Os detalhes técnicos ficam recolhidos. Esta frente vem depois das outras três.

## Fora do escopo (decisão do usuário, 02/10/2026)

- **Liberação de resultados para o atleta:** fica para depois. Nada muda no que o atleta vê.
- **Plano de metas (comportamento alimentar):** não muda.
- **Agrupar avaliações em "consulta":** o usuário descartou a ideia. Cada avaliação é única.
- **Corrigir dados já gravados no banco real:** é uma decisão separada, que pede migração e o aval do usuário. Esta mudança corrige só cálculos novos e a exibição.

## Decisões de cálculo (registradas para revisão clínica)

| # | Defeito | Correção |
|---|---|---|
| 1 | % de gordura YMCA com cm e kg numa equação em polegadas e libras (`calculationEngine.js:322-326` e a cópia em `PerimetrosCorporaisForm.jsx`) | Converter: cintura ÷ 2,54 e peso × 2,20462 antes da equação. Um resultado fora de uma faixa plausível vira "—" com aviso, nunca um número absurdo. Um registro antigo com valor absurdo também aparece como "—", com a nota de que o valor foi calculado com unidades erradas. O servidor passa a recalcular o YMCA a partir de cintura, peso e sexo. |
| 2 | Aviso de conduta dos Exames procura "critico"/"alto", mas o status usa "alterado" (`AvaliacaoExamesLaboratoriais.jsx:500-520`) | Reconhecer os status reais: "alterado" leva pelo menos ao tom de atenção, "limitrofe" a atenção, "normal" a ok, e "sem_classificacao" a "sem dados", que nunca é "consistente". Usar os textos que já existem. |
| 3 | Escore de adesão da Evolução conta componente ausente como 0 (`evolucao-retorno-normalizer.ts:110-114` e o cálculo do cliente) | Componente ausente sai do cálculo e os pesos são redistribuídos entre os presentes, como o aviso da tela já descreve. Sem nenhum componente, o escore e a prioridade são nulos e aparecem como "—", sem "conduta prioritária". O mesmo vale no servidor e no cliente. |
| 4 | GET: semana vazia gera PAL 1,0 e anula o nível de atividade (`GastoEnergeticoTotalForm.jsx:279-305, 1534-1539`) | Sem atividade registrada, o gasto semanal e o PAL real ficam nulos, e vale o fator do nível de atividade escolhido. |
| 5 | Hidratação: ganho de peso gera perda, sudorese e reposição negativas (`hidratacao-normalizer.ts:99-117` e o cliente) | Variação de peso negativa aparece como **ganho**, não como "perda negativa". Perda de suor calculada (Δpeso + ingestão − urina) igual ou menor que zero vira nula, com aviso de registro inconsistente, e o mesmo vale para a taxa de sudorese e a meta de reposição. Nunca grava valor negativo. |
| 6 | Alimentar sem registros classificada como "Padrão saudável" (`alimentar-normalizer.ts:84-89, 203-205`) | Com total zero, os percentuais NOVA e a classificação ficam nulos e aparecem como "—"/"Sem classificação". |

Cada correção ganha um teste de regressão: no servidor (spec do normalizador) e no cliente (script `node`).

## Nome: glossário

A triagem passa a se chamar **"Disponibilidade energética"**. As classificações por faixa de DE ficam assim:
- "ótima" → **"Disponibilidade energética adequada"**;
- "risco relativo" → **"Disponibilidade energética reduzida"**;
- "RED-S estabelecido" → **"Baixa disponibilidade energética"**.

Continuam iguais:
- os nomes próprios dos questionários (LEAF-Q, LEA-Q13);
- as chaves de dados e os identificadores de código (`triagem_reds` e o resto), para não mexer em dado salvo nem em rota.

## Invariantes

- **Avaliações independentes,** como no WI-007. Só peso e estatura são compartilhados, e nenhuma bloqueia outra nem o plano.
- **Liberação ao atleta e Plano de metas** sem nenhuma mudança.
- **Chaves de payload, tipos e rotas** sem mudança. O que muda é o valor calculado em registros novos e a exibição.
- **Testes de autonomia** continuam passando: `test-reds-autonomy`, `test-get-autonomy` e `test-integrated-composition-autonomy`.
- **Nenhum dado real** em teste. Nada de deploy nem de mudança no banco real.

## Verificação

- Testes novos de regressão dos cálculos, no servidor e no cliente.
- ESLint, `tsc` do servidor nos arquivos tocados e os testes estáticos pertinentes.
- **Quando a máquina for liberada:** navegador e revisão independente.

## Rollback

Os backups ficam em `tmp/wi013-v1/`, nos mesmos caminhos, gravados antes de cada frente. Reverter uma frente = copiar os arquivos de volta e remover os testes novos.

## Andamento

### Frente 2 — nome: concluída (02/10/2026)
- **Feito pelo executor:**
  - "RED-S" trocado por "disponibilidade energética" em 12 arquivos (interface, PDF do relatório, manual gerado e testes);
  - a faixa mostrada com o código cru (`reds_estabelecido`) passou a usar o glossário, por um mapa só de exibição (`ROTULO_CLASSIFICACAO_DE` no servidor e um mapa local no formulário);
  - chaves, condições e classes CSS sem mudança;
  - `test-reds-autonomy` ganhou asserções de que o rótulo segue o glossário e a chave gravada continua a mesma.
- **Checagens:** `test-reds-autonomy`, `test-public-triage-context` e `test-get-autonomy` passam; ESLint limpo; `tsc` do servidor sem erros.
- **O orquestrador trocou também:** "Triagem REDs" no prontuário (`PatientProntuario.jsx`), "REDs" no resumo da triagem pública (`Extensao.jsx`) e os rótulos dos mapas do Playwright na raiz.
- **Pendente:** regerar os manuais (`docs/manual*`), que ainda têm o texto antigo. O gerador já foi atualizado.
- **Para decidir:**
  - o nome do módulo ainda aparece como "Triagem de Disponibilidade Energetica", sem acento, em vários lugares, entre eles o título do formulário, o `TIPO_LABEL` do relatório e as mensagens do servidor;
  - "RED-S CAT" no relatório foi mantido, porque é o nome próprio da ferramenta do COI;
  - o manual ainda diz que a triagem "requer" Alimentar e Carga de treino e que dados são "importados automaticamente", o que contradiz o WI-007.

### Defeito de segurança encontrado durante a frente 2
`clinical-alerts.service.ts:25-38`: a faixa **baixa** (`reds_estabelecido`, DE abaixo de 30), que é a mais grave, **não gerava alerta clínico**, enquanto a faixa reduzida gerava. A correção, com teste, foi passada à frente 1 como defeito 7.

### Frente 3 — painéis: concluída (02/10/2026)
- **Feito pelo executor:**
  - **Prontuário, painel de avaliações:** indicadores para carga de treino (ACWR, carga da semana, zona e fase) e para disponibilidade energética (DE em kcal/kg MLG/dia e a faixa pelo glossário);
  - **cartão "Composição" do resumo clínico:** mostra a avaliação de composição mais recente, com "Fonte: … · data", sem misturar fontes. Hoje esse resumo está desligado (`mostrarResumoClinico`);
  - **cartão do professor:** ramos para a disponibilidade energética e para a imagem (esta como "Estimativa experimental", sem comparação clínica), e `DOMAIN_BY_TYPE` com as chaves reais;
  - **clínica vazia:** passa a mostrar "—"/"Sem dados", não "0 alertas" em verde.
- **Prova:** nenhum cálculo mudou. O SSR de backup contra versão atual não teve falhas, a prova por mutação pegou 5 de 5 mutantes, e o atleta não vê nenhum desses componentes.
- **Conferência do orquestrador:** ESLint limpo; `test-prontuario-pendencias` (5), `test-visualizacao-dados` (9) e `test-avaliacao-base` (36) passam; ligações da clínica iguais.

### Achados da frente 3 para decidir
1. **Decisão clínica:** o filtro de bradicardia fisiológica do atleta (`AvaliacaoClinicaForm.jsx:409`) procura o id `fc_critica`, mas o motor grava `critical_heart_rate` (`calculationEngine.js:3124`). O filtro **nunca age**: o alerta "FC < 40 ou > 120" aparece também para o atleta com bradicardia esperada. Corrigir faz esse alerta **sumir** para ele, o que reduz alertas, e por isso não foi feito sem aval.
2. **Composição:** o painel visível usa prioridade fixa de fonte (integrada → BIA → dobras → perímetros), e o cartão do resumo usa a mais recente. É preciso unificar a regra.
3. **Ausência virando zero que ainda resta:**
   - "Massa Magra 100% / Massa Gorda 0,0 %" quando só há massa magra (`DashboardAvaliacoes.jsx:801-803`);
   - "0 flag(s)" e "0 / 0" no cartão do professor (`evaluationResultAdapter.js:444, 494, 674`);
   - `red_flags_count ?? 0` gravado pela clínica (`AvaliacaoClinicaForm.jsx:641`).
4. **Disponibilidade energética no cartão do professor:** DE maior conta como "melhora", inclusive acima de 45. A pergunta é se vale "melhora" ou só "subiu/desceu".
5. **Grafia:** "--" e "—" convivem para ausência, e as variações usam ponto decimal.

### Frente 1 — cálculos: concluída (02/10/2026)
**Executor:** os 6 defeitos, mais o defeito 7 (a faixa baixa de disponibilidade energética passa a gerar alerta) e o item 8 ("Hormonal feminino / disponibilidade energética" nos Exames).

**Testes de regressão:**
- `server/src/avaliacoes/normalizers-calculos.spec.ts` e `scripts/test-calculos-avaliacoes.mjs`, este já incluído no `test:ui`;
- a prova por mutação pegou 13 de 13.

**Antes → depois (dados sintéticos):**
- **YMCA:** homem com 80 cm e 75 kg, de 303% para 11,3%; resultado fora de 2–70% vira "—".
- **Exames:** analito alterado mostra "Exames sugerem monitoramento".
- **Evolução:** com só a adesão alimentar = 80, o escore passa de 40 para 80; formulário vazio mostra "—".
- **GET:** semana vazia deixa PAL e total nulos, e volta a valer o nível de atividade.
- **Hidratação:** ganho de peso aparece como ganho; perda e meta inconsistentes ficam nulas, nunca negativas.
- **Alimentar:** total zero dá "Sem classificação".

**O servidor passa a ser a autoridade** do YMCA (recalcula a partir de cintura, peso e sexo) e do escore, prioridade e classificação da Evolução.

**Conferência do orquestrador:**
- `test-calculos-avaliacoes`, os três testes de autonomia e `test-avaliacao-base` passam;
- o spec do servidor passou com 23/23 pelo executor compatível com jest do scratchpad (`tsx jest-shim-runner.mjs`), porque **jest não está instalado em `server/node_modules`**;
- ESLint limpo;
- `tsc` sem erros nos arquivos do WI-013. Os erros restantes estão em `server/src/tarefas/*` e `triagem-publica-prioridade.ts`, de outra frente que estava editando esses arquivos às 12:03 de 02/10.

### Defeito grave encontrado e corrigido pelo orquestrador: categorias NOVA no singular
A tela do recordatório 24h (`AvaliacaoAlimentar.jsx`, perto da linha 405) envia `categorias` com chaves no singular (`minimamente_processado`, `processado`, `ultraprocessado`). O servidor só lia o plural (`alimentar-normalizer.ts` e `avaliacoes.service.ts`, `resolveNovaCategoryEnergy`). Com isso, **as kcal de processados e ultraprocessados eram ignoradas**, e o padrão saía "saudável" sempre que havia algo in natura.

**Correção:** o servidor aceita as duas formas, sem mudar as chaves gravadas, que continuam no plural. Teste: "lê as chaves no singular que a tela do R24h envia" (50% de ultraprocessados → "Padrao de alto risco").

**Registros antigos** continuam com a classificação errada no banco. Corrigi-los é migração, que depende de decisão.

### Para decidir (frente 1)
- **Faixa plausível do YMCA:** 2–70%. Um atleta muito magro abaixo de 2% veria "—".
- **Evolução com intercorrência e sem nenhum componente:** a prioridade fica nula, quando antes era "alta". Pede revisão clínica.
- **Registros antigos no banco:** YMCA absurdo, PAL 1,0, negativos da hidratação e classificação NOVA errada. A migração depende de decisão.
