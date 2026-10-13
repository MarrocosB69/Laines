# Contrato da base das avaliações

Fixado na fase 1 da onda (ver `change-intent.md`). Os lotes A1, A2, C, E, I e IMG migram os formulários contra esta interface, em paralelo. Se um lote precisar mudar a base, ele para e relata ao orquestrador; não edita `src/components/Avaliacoes/base/` nem as peças comuns.

A regra de fundo: **só a marcação e as classes mudam.** Estado, efeitos, handlers, payload, chamadas de API, cálculos, validações e textos ficam idênticos aos de `tmp/avaliacoes-v1/`. Os únicos textos novos permitidos estão listados na seção 10.

## Arquivos da base

| Arquivo | O que tem |
|---|---|
| `src/components/Avaliacoes/base/index.js` | Exporta tudo e carrega o CSS. |
| `AvaliacaoModulo.jsx` | `AvaliacaoModulo`, `AvaliacaoSecao` e `AvaliacaoIndice` |
| `Campo.jsx` | `Campo`, `CampoNumero`, `GrupoOpcoes` e `Opcao` |
| `Resultado.jsx` | `ResultadoCalculado`, `AvisoAvaliacao` e `BarraAcoesAvaliacao` |
| `Tendencia.jsx` | `Tendencia`, sobre o `MiniSparkline` compartilhado |
| `Dica.jsx` | `Dica` (a dica "?" avulsa) e as peças que `Campo`, `GrupoOpcoes` e `ResultadoCalculado` usam |
| `useDica.js` | O estado da dica (aberta ou fechada): o único estado da base |
| `apoio.js` | `normalizarTom`, `valorAusente` e `idTituloSecao` (funções puras), mais as regras da dica e da variação |
| `avaliacao-base.css` | Visual, todo escopado em `.av-modulo` |

```jsx
import '../avaliacoes.css';            // continua, na mesma posição
import {
  AvaliacaoModulo, AvaliacaoSecao, AvaliacaoIndice, Campo, CampoNumero, GrupoOpcoes, Opcao,
  ResultadoCalculado, AvisoAvaliacao, BarraAcoesAvaliacao, Tendencia, Dica, idTituloSecao
} from '../base';                      // de src/views/avaliacoes/: '../../components/Avaliacoes/base'
import './MeuForm.css';                // o CSS próprio vem por último
```

**Ordem dos imports:** `avaliacoes.css`, depois a base e por último o CSS próprio. A base vence as regras de `avaliacoes.css` por especificidade, e a ordem garante os empates.

Os componentes são só apresentação: nenhum estado de negócio, nenhuma chamada de API e nenhuma conversão de unidade. Eles recebem `value`/`onChange` e os demais props do formulário e os repassam sem mudança. O único estado é o da dica "?" (aberta ou fechada), em `useDica.js`, e ele nunca vai para o dado salvo. `scripts/test-avaliacao-base.cjs` verifica isso.

**Props novas são opcionais.** Sem elas, a marcação é a de antes, byte a byte. Isso foi medido na consolidação de 29/09: os 12 formulários que não adotaram nada renderizam o mesmo HTML com a base nova (94 cenários sintéticos).

## 1. Raiz `av-modulo`

Todo formulário migrado tem a classe `av-modulo` na raiz. O CSS da base só vale dentro dela, porque `avaliacoes.css` também é importado por `src/views/Athlete/AthleteSelfEvaluationModal.jsx`, que está fora da onda.

```jsx
<AvaliacaoModulo
  className="eval-card bioimpedancia-form"   // as classes da raiz antiga continuam
  titulo="Bioimpedância"                      // o mesmo texto do título de antes
  descricao="Avaliação da composição corporal por BIA"
  icone={<Scale size={22} />}                 // decorativo (aria-hidden)
  status="Rascunho" statusTom="warn"          // opcional: texto sempre escrito
  data={dataSalva}                            // opcional: Date (dd/mm/aaaa) ou o texto que já existia
  acoes={<Button ...>...</Button>}            // opcional: ações do cabeçalho
>
  {/* seções */}
</AvaliacaoModulo>
```

- **A raiz é um invólucro.** Ela empilha os blocos com `gap`. Se a raiz antiga tinha grade própria (duas colunas, por exemplo), essa grade vai para um filho.
- **Sem título próprio:** omita `titulo` e o cabeçalho não aparece.
- **Só adotar a raiz** (`<div className="av-modulo ...">` sem os componentes) já deixa as classes legadas no visual novo: `eval-section`, `eval-card`, `eval-field`, `eval-label`, `eval-input`/`-select`/`-textarea`, `eval-note--*`, `eval-btn*`, `ui-button*`, `eval-summary-*`, `eval-unit-badge` e `*-unit-badge`, `eval-readiness*`, `valor-anterior*`, `save-indicator`, `eval-grid`, `eval-hint`, `eval-legend` e `eval-field-group*`.

## 2. Hierarquia de títulos

| Nível | Quem | Onde |
|---|---|---|
| h1 | Título da página | `RouteSidebarLayout` |
| h2 | "Avaliação completa" | `AvaliacaoCompleta` |
| h3 | Nome do módulo na barra da página | `AvaliacaoCompleta` (fase 2) |
| **h3** | **Título do módulo** | `AvaliacaoModulo` ou `EvaluationHeader` |
| **h4** | **Seção** | `AvaliacaoSecao` |
| **h5** | **Subseção** (seção dentro de seção) | `AvaliacaoSecao` aninhada |
| h6 | Só em exceção | à mão, com o mesmo reset |

**Por quê:** medido em 27/09, os 16 formulários da página têm h3 no módulo, próprio ou via `EvaluationHeader`, e quase todos usam h4 nas seções. A exceção é Perímetros, que salta para h5, e ganha o h4 na migração. Manter esses níveis evita reescrever o esqueleto de cada um e cabe sob o h2 da página. Com o módulo em h4, as subseções iriam a h6 e não sobraria degrau.

`AvaliacaoSecao` deriva o nível do contexto, então ninguém passa nível à mão. Uma seção dentro de outra vira h5, e uma seção fora de `AvaliacaoModulo` é h4.

**Imagem (lote IMG):** ela abre como diálogo no prontuário e na tela do aluno, com título próprio em h2. Use `nivelTitulo={2}`: as seções ficam h3.

## 3. Seções, blocos e índice

```jsx
<AvaliacaoIndice itens={[
  { id: 'bia-medidas', titulo: 'Medidas do aparelho' },
  { id: 'bia-resultados', titulo: 'Resultados' }
]} />

<AvaliacaoSecao id="bia-medidas" titulo="Medidas do aparelho" descricao="Opcional" acoes={<.../>}
  className="eval-section">           {/* só se o bloco antigo era .eval-section */}
  <div className="av-grade">{/* campos */}</div>
  <AvaliacaoSecao titulo="Tronco">{/* subseção h5, faixa sem cartão */}</AvaliacaoSecao>
</AvaliacaoSecao>
```

- **Sem etapas e sem assistente.** Reagrupar, mudar a ordem visual e dividir em blocos pode; o fluxo de salvar não muda. A Imagem já tem o próprio passo a passo de câmera, que continua como está.
- **O título da seção** é um texto que já existia no formulário (título de seção, legenda ou rótulo de grupo). Seção nova, criada para reagrupar, pede título novo: liste esses títulos no relatório, porque são os únicos textos novos permitidos.
- **O índice "Neste formulário"** entra nos formulários com 4 seções ou mais, logo depois do cabeçalho.
  - O `id` de cada seção leva o prefixo do formulário (`bia-`, `dobras-`, `anamnese-`...).
  - O link rola até a seção e leva o foco ao título sem mudar a URL. Um `#id` nativo trocaria o `location.state`, e o "Voltar" da página iria para outro lugar.
  - Uma seção escondida pelo modo essencial não rola; é aceitável.
- **O título da seção tem id fixo:** `${id}-titulo`, que `idTituloSecao(id)` devolve. Use-o para rotular por `aria-labelledby` um grupo, uma tabela ou uma região da própria seção, sem escrever o sufixo à mão:
  ```jsx
  <table aria-labelledby={idTituloSecao('carga-sessoes')}>...</table>
  ```
  Sem `id`, a seção gera um id próprio, e o título continua ligado a ela, mas não dá para apontá-lo de fora.
- **Seção é cartão branco.** Cartão dentro de cartão vira faixa com fio: subseção, `eval-card` interno e prontidão dentro de uma seção.
- **Grades:**
  - `av-grade` (ou a `eval-grid` antiga) dá colunas de 13rem ou mais;
  - `av-resultados` é a grade dos resultados;
  - `av-inteiro` (ou `eval-field-full`) ocupa a linha toda.
- **Tabela larga** fica num invólucro cuja classe contém `table-wrap` (os `bia-table-wrap` e afins já contêm). Ele rola sozinho, e a página não ganha rolagem horizontal.

## 4. Campos

```jsx
<Campo rotulo="Peso antes (kg)" ajuda="Balança calibrada" erro={erros.peso} obrigatorio
  className="eval-field eval-field--critical" classeObrigatorio="dobras-required-dot"
  anterior={<ValorAnterior anterior={ant} atual={dados.peso} melhorQuando="menor" />}>
  <input className="eval-input" name="pesoAntesExercicio" value={dados.pesoAntesExercicio}
    onChange={handleChange} disabled={readOnly} />
</Campo>

<CampoNumero rotulo="Peso" unidade="kg" value={v} onChange={(e) => onChange(e.target.value)}
  disabled={readOnly} inputClassName="eval-input bia-input-invalid" className="eval-field" />

<Campo rotulo="Sexo">{(ligacao) => <SelectProprio {...ligacao} className="av-controle" />}</Campo>

<GrupoOpcoes legenda="Há moradores menores de 18 anos no domicílio?" horizontal>
  <Opcao rotulo="Sim" name="temMenores" value="sim" checked={dados.temMenores === 'sim'} onChange={handleChange} disabled={readOnly} />
  <Opcao rotulo="Não" name="temMenores" value="nao" checked={dados.temMenores === 'nao'} onChange={handleChange} disabled={readOnly} />
</GrupoOpcoes>
```

**Props:**

| Componente | Props |
|---|---|
| `Campo` | `rotulo`, `unidade`, `ajuda`, `erro`, `obrigatorio`, `classeObrigatorio`, `anterior`, `rotuloOculto`, `id`, `className`, `children`, **`dica`**, **`tom`** |
| `CampoNumero` | as do `Campo` (menos `children`), mais `inputClassName`, `type` (padrão `text`) e `inputMode` (padrão `decimal`); todo o resto vai para o `<input>` (`dica` e `tom` vão para o `Campo`, nunca para o `<input>`) |
| `GrupoOpcoes` | `legenda`, `ajuda`, `erro`, `obrigatorio`, `classeObrigatorio`, `horizontal`, `className`, `children`, **`dica`**, **`tom`**, **`rotuladoPor`** |
| `Opcao` | `tipo` (`radio` ou `checkbox`), `rotulo`, `descricao` e `className`; todo o resto vai para o `<input>` |
| `Dica` | `texto`, `rotulo` e `id`: a dica avulsa, fora de campo, grupo e resultado |

**O que o `Campo` faz:**

- Liga o rótulo ao controle (`htmlFor`/`id`) de três formas, como `FieldGroup` da inscrição:
  - clona um único `input`, `select` ou `textarea`;
  - chama uma função com `{ id, 'aria-describedby', 'aria-invalid' }`;
  - rotula como grupo (`role="group"`) qualquer outro conteúdo.
- Ao clonar, preserva o `id` e as classes do controle e acrescenta `av-controle`.
- Põe unidade, ajuda, valor anterior e erro em `aria-describedby`. O erro também marca `aria-invalid`.

**Regras:**

1. **Todo controle tem rótulo associado.** O rótulo é o texto que já existia, inclusive o que estava só no `placeholder` ou num `<span>` solto. O placeholder continua com o mesmo texto de antes. `ajuda` e `erro` também recebem só textos que o formulário já tinha: a ajuda do exemplo acima é ilustrativa.
2. **A unidade fica visível fora do placeholder**, na caixa ao lado do controle (`unidade`). Se a unidade já estava no rótulo ("Peso antes (kg)"), o rótulo não muda: não repita a unidade na prop.
3. **Obrigatório** é escrito por extenso ("obrigatório") dentro do rótulo, com `obrigatorio`. Isso não põe `required` no controle: o atributo `required` continua onde já estava, e só lá.
4. **Nenhuma classe legada é posta pela base.** O modo essencial de `AvaliacaoCompleta` faz três coisas com elas:
   - conta os `.eval-field`;
   - trata como essencial o `.eval-field--critical`, o `[required]` e as marcas `anamnese-required`, `dobras-required-dot`, `perimetros-required-dot`, `pm-field__required` e `clinica-required-dot`;
   - esconde as `.eval-section` e os `.eval-field-group` sem campo essencial.

   Portanto, passe `eval-field`, `eval-field--critical`, `eval-section` e `eval-field-group` em `className`, e a marca antiga em `classeObrigatorio`, **exatamente onde estavam e só onde estavam**. Se a contagem mudar, muda o texto "Ver todos os N campos" e o modo pode aparecer onde não aparecia.
5. **Mantenha o `type`:** um campo `type="number"` continua `number`, porque o `onChange` recebe valores diferentes entre os dois tipos. O padrão do `CampoNumero` é `type="text"` com `inputMode="decimal"`, como em Bioimpedância; um campo que era `number` passa `type="number"`.
6. **Campos de 48 px, com texto a 16 px** para evitar o zoom do iOS.
   - Só leitura (`disabled` ou `readOnly`) mantém o valor na cor de texto.
   - Erro e atenção pintam borda e fundo por `aria-invalid`, pelas classes `*-input-invalid`/`*-input-warning` que já existem ou por `av-controle--erro`/`--atencao`. A mensagem escrita continua sendo a do formulário.
7. **Rádio e caixa de seleção** vão em `GrupoOpcoes` (`fieldset`/`legend`), com opções de 44 px. Os handlers ficam como estão: `onChange={handleChange}` ou `onChange={() => onChange(key, true)}`, repassados sem mudança. Chips com `aria-pressed` também podem ir dentro do `GrupoOpcoes`.
8. **Campos em tabela** (várias medidas numa linha) usam `rotuloOculto` com um rótulo que combine a linha e a coluna já escritas na tabela ("Tríceps, medida 1"). Esse rótulo só o leitor de tela lê, e não conta como texto novo visível.
   - Sem valor anterior e sem dica, a linha do rótulo sai da caixa (`display: contents`) e não deixa vão acima do controle. O `gap: 0` que alguns formulários puseram no próprio CSS (Fisioterapia, Carga de treino) ficou inofensivo e pode sair numa próxima passada.

### 4.1 Dica "?"

```jsx
<Campo rotulo="Conversao de % gordura"
  dica={{ texto: ['Siri (1956): %G = (495 / DC) - 450', 'Brozek (1963): ...'], rotulo: 'Abrir informação' }}>
  <select ...>...</select>
</Campo>

<ResultadoCalculado rotulo="IMC" valor="23,4" dica={{ texto: linhas, rotulo: 'Abrir informacao' }} />
<GrupoOpcoes legenda="Sinais e sintomas" dica={{ texto: linhas, rotulo: 'Abrir informacao' }}>...</GrupoOpcoes>
<AvaliacaoSecao titulo="Resultados calculados" acoes={<Dica texto={linhas} rotulo="Abrir informação" />}>
```

- **`dica`** aceita um texto, uma lista de linhas ou `{ texto, rotulo }`. `rotulo` é o nome do botão; sem ele, "Mais informações". Linhas vazias saem, e uma dica sem nenhuma linha não mostra botão.
- **O "?" é um `<button type="button">` de 44 px**, ao lado do rótulo e **fora** do `<label>` e da `legend`. O nome dele não entra no nome do campo nem no do grupo.
  - `aria-expanded` e `aria-controls` apontam o painel com o texto, que fica logo abaixo da linha do rótulo, com `hidden` enquanto fechado.
  - Aberto, o painel entra no `aria-describedby` do controle (no Campo) ou do grupo, depois das outras descrições. Fechado, não descreve nada.
  - Enter e espaço abrem e fecham. Esc fecha, com o foco no botão ou no controle do campo. O clique, o Enter e o espaço no "?" não sobem para um ancestral clicável (a linha da tabela de TMB de Perímetros).
  - Aberta, a marca fica cheia (azul com "?" branco): o estado muda a forma, não só a cor.
- **No `GrupoOpcoes`**, com `dica`, a legenda vira um `<span>` com id ao lado do botão, e o grupo passa a ser `role="group"` com `aria-labelledby` nesse `<span>`: o "?" dentro da `legend` entraria no nome do grupo.
- **`Dica` avulsa** (nas `acoes` de uma seção ou numa célula de tabela) põe o botão e o painel lado a lado no fluxo. Num contêiner flex com quebra, o painel ocupa a linha de baixo. O texto da dica é o que o formulário já tinha: a dica não é lugar de texto novo.

### 4.2 Tom de atenção e de perigo

```jsx
<Campo rotulo="Tríceps" unidade="mm" ajuda={mensagemDaFaixa} tom={foraDaFaixa ? 'atencao' : undefined}>...</Campo>
<GrupoOpcoes legenda={textoDaQuestaoDeRisco} tom="atencao">...</GrupoOpcoes>
```

- `tom` aceita `atencao` e `perigo` e o vocabulário de `normalizarTom` (`warn`, `risk`...). Os outros tons não se aplicam a campo.
- **No `Campo`:** ícone de forma própria no rótulo (triângulo na atenção, octógono no perigo; `aria-hidden`), borda e fundo do controle no tom (os pares `--av-atencao-*` e `--lt-color-danger-*`) e a `ajuda` escrita no tom, em negrito.
  - Tom não é erro: não marca `aria-invalid`. Foco, só leitura e erro continuam vencendo o tom no controle.
- **No `GrupoOpcoes`:** a faixa no tom, com um fio à esquerda, e o ícone na legenda.
- **A cor nunca vai sozinha:** o que o tom quer dizer está no texto do formulário (a mensagem da faixa na `ajuda`, ou o rótulo que já diz que é um campo de risco).

### 4.3 Grupo rotulado por um título que já existe

```jsx
<AvaliacaoSecao id="reds-sinais" titulo="Sinais de risco">
  <GrupoOpcoes rotuladoPor={idTituloSecao('reds-sinais')} horizontal>...</GrupoOpcoes>
</AvaliacaoSecao>
```

- `rotuladoPor` recebe o id de um título visível e gera `role="group"` com `aria-labelledby`, sem `fieldset` e sem `legend`. `legenda` e "obrigatório" não aparecem nesse caso: o título é o rótulo.

## 5. Resultados calculados

```jsx
<div className="av-resultados">
  <ResultadoCalculado rotulo="% gordura" valor={Number.isFinite(pg) ? formatNumber(pg, 1) : null}
    unidade="%" classificacao={classificacao?.label} tom={classificacao?.tone}
    referencia={classificacao?.source} semValor="Não calculado" />
</div>
```

**Props:** `rotulo`, `valor`, `unidade`, `classificacao`, `tom`, `referencia`, `metodo`, `semValor`, `className` e, desde a consolidação, **`dica`**, **`valorEmTexto`**, **`variacao`** e **`melhorQuando`**.

```jsx
<ResultadoCalculado rotulo="Prioridade" valor={prioridade?.label || null} valorEmTexto tom={prioridade?.tone} />
<ResultadoCalculado rotulo="% gordura" valor="22,40" unidade="%"
  variacao={formatSigned(delta, '%')} melhorQuando="menor" />
```

- **`rotulo` é opcional.** Sem ele, a linha do rótulo não aparece (antes ficava um `<p>` vazio).
- **`valorEmTexto`:** quando a classificação é o próprio valor ("Prioridade: Alta", "Risco relativo"), o valor vai em texto, e não na voz de número, e o `tom` vale mesmo sem `classificacao`, porque o valor já é a classificação escrita. O texto fica na cor do tom, com contraste medido sobre o fundo do cartão. Sem valor, continua "—" (ou `semValor`), sem tom. Não repita o mesmo texto em `classificacao`.
- **`variacao`:** a variação em relação à avaliação anterior, **escrita pelo formulário com o sinal** (`formatSigned`), numa linha abaixo do valor. O leitor de tela ouve "Variação em relação à avaliação anterior:" antes dela.
  - Sem `melhorQuando`, a variação fica neutra: um aumento não é bom por si (o % de gordura, por exemplo).
  - Com `melhorQuando` (`maior` ou `menor`), a base lê o sinal escrito (`+`, `−` ou `-`) e usa a regra de `ValorAnterior`: na direção desejada, visto e "(na direção desejada)" para o leitor de tela; na direção oposta, triângulo e "(atenção: na direção oposta à desejada)". Zero ("+0,00") é estável e fica neutro.
  - A base não calcula nem formata a variação: um número cru não recebe sinal.
- **`dica`:** o "?" ao lado do rótulo, como no `Campo` (seção 4.1).

- **O valor chega formatado pelo formulário,** com a função e as casas de antes. A base não arredonda, não converte e não calcula.
- **Ausência é "—", nunca 0.** `null`, `undefined`, `''` e número não finito mostram "—", com "sem valor" para o leitor de tela. O zero continua zero.
  - Se o formulário já escrevia a ausência ("Não calculado", "Sem classificação"), passe esse texto em `semValor`, e o texto de antes continua.
  - Quando o código antigo usa `|| 0` só para exibir, passe `null` na exibição. Se o 0 entra em cálculo ou no payload, não mexa: registre no relatório.
- **A classificação vai sempre escrita.** O `tom` é complemento e, sem classificação escrita, a base não pinta nada.
  - Os tons aceitos são `neutro`, `positivo`, `atencao` e `perigo`.
  - `normalizarTom` aceita o vocabulário dos formulários: `ok`, `warn`, `warning`, `risk`, `danger`, `neutral`, `info`...
- **`referencia` e `metodo` são textos de apoio.** Meta individual, limite de segurança e referência populacional são coisas diferentes: o texto de `referencia` diz qual delas é, como o formulário já dizia. Não junte duas numa só linha.
- **Resumo antigo:** `eval-summary-grid`/`eval-summary-item` já recebem o mesmo visual. Migrar para `ResultadoCalculado` só vale quando o bloco tem classificação ou referência a mostrar.

## 6. Avisos

```jsx
<AvisoAvaliacao tipo="info">Somente leitura para o seu perfil.</AvisoAvaliacao>
<AvisoAvaliacao tipo="perigo" anunciar className="bia-error-note">{error}</AvisoAvaliacao>
```

**Props:** `tipo`, `titulo`, `rotuloTipo`, `anunciar`, `className` e `children`.

| `tipo` | Classe antiga equivalente | Prefixo lido |
|---|---|---|
| `info` | `eval-note` | "Informação:" |
| `atencao` | `eval-note--warning` | "Atenção:" |
| `perigo` | `eval-note--danger` | "Alerta:" |
| `sucesso` | `eval-note--success` | "Sucesso:" |

- O texto é o mesmo de antes. O tipo aparece num ícone de forma própria e num prefixo que só o leitor de tela lê.
  - Se o texto já começa com "Atenção:" ou parecido, use `rotuloTipo=""`.
- `anunciar` torna o aviso uma região viva (`alert` para `perigo`, `status` para os outros). Use só em mensagem que aparece depois de uma ação (erro ao salvar). Aviso fixo não anuncia.
- `eval-hint` é ajuda, não aviso: aparece como texto de apoio.

## 7. Ações e status de salvamento

```jsx
<BarraAcoesAvaliacao status={saveStatus}>
  <Button type="button" variant="primary" onClick={handleSalvar} disabled={readOnly} loading={saveStatus === 'saving'}>
    Salvar bioimpedancia
  </Button>
</BarraAcoesAvaliacao>
```

**Props:** `status`, `textosStatus`, `className` e `children`.

- **Os textos de status são os de hoje:** "Salvando...", "Salvo" e "Erro ao salvar". Um formulário com texto diferente passa `textosStatus`; a Alimentar, por exemplo, usa `textosStatus={{ error: 'Erro' }}`.
- **A região de status existe sempre,** vazia quando não há status: `role="status"` com `aria-live` só anuncia o que muda depois de já estar na página. Ela mantém as classes `save-indicator` e o status.
- **Os botões são os do formulário,** com o mesmo texto, `onClick`, `disabled` e `loading`. Dentro de `.av-modulo`:
  - `ui-button-primary` e `eval-btn-primary` usam o degradê de largada;
  - `ui-button-secondary` e `eval-btn-secondary` usam contorno;
  - `ui-button-ghost` usa link azul;
  - todos têm 44 px ou mais, e o tamanho `sm` também sobe para 44 px.
- **Uma ação sólida por barra.** Se a barra tinha dois primários ("Salvar rascunho" e "Finalizar"), o de rascunho vira `variant="secondary"`. Isso é classe, não fluxo.
- **Mensagem de erro** junto da barra: use `AvisoAvaliacao tipo="perigo" anunciar` ou mantenha o elemento antigo.

## 8. Valor anterior e tendência

- **`ValorAnterior`** vai na prop `anterior` do `Campo`, fora do `<label>`: o rótulo não fica com números no nome acessível.
  - Ele fica na linha do rótulo, à direita, e é ligado ao controle por `aria-describedby`.
  - O leitor de tela ouve "Valor anterior:" e o sentido da variação quando o módulo passa `melhorQuando`.
  - Quem vê tem um ícone (visto ou triângulo) além da cor.
  - A API não mudou.
- **`Tendencia`** substitui os cartões locais de minigráfico, que diferem só no invólucro:
  - `bia-sparkline-card`, `dobras-sparkline-card` e `get-sparkline`;
  - o `SparklineCard` de Perímetros e o de Clínica.

```jsx
<Tendencia rotulo="% gordura (últimos 6)" valores={sparklineValues}
  alvo={previous?.metrics?.percentFat ?? null} largura={240} altura={82}
  unidade="%" casas={1} rotuloAlvo="valor anterior" />
```

**Props:** `rotulo`, `valores`, `alvo`, `largura`, `altura`, `unidade`, `casas`, `rotuloAlvo` e `className`.

- `valores`, `alvo`, `largura` e `altura` vão para o `MiniSparkline` sem mudança, com a mesma expressão de antes. O teste compara o SVG.
- O gráfico fica escondido do leitor de tela, que ouve um resumo em texto: "3 medições; primeira 24,1 %; última 22,3 %; valor anterior 23 %."
- `rotuloAlvo` diz o que é a linha tracejada: em BIA, Dobras e Perímetros, é o valor anterior.
- A linha tracejada é cinza, porque é referência, não alerta.
- O rótulo vira `figcaption`. Onde o rótulo antigo era título (`<h5>` em Dobras), o bloco pode virar subseção com esse título.
- A função local `buildSparklineSeries` e os `useMemo` das séries **não** mudam.

## 9. CSS de cada formulário

**Apague do CSS próprio** o que a base já faz:

- fontes (Poppins, Inter, `--font-poppins`) e tamanhos de rótulo, título, campo e botão;
- cores fixas (hex, `rgba`, `--evx-*`, `--evf-*` e `--eval-*`) de texto, borda e fundo;
- estilos de `eval-*` repetidos com o prefixo do formulário (`.bioimpedancia-form .eval-section`...);
- cartões, sombras, gradientes, `border-left` de seção, pílulas de unidade e de "opcional";
- `transform` no hover, `animation`, `will-change` e `transition: all`;
- estilos de erro e atenção de campo (`*-input-invalid`, `*-input-warning`): a base já os pinta;
- desde a consolidação: balão de dica próprio (`*-help`, `*-help-tooltip`), ajuda pintada no tom da faixa, texto de classificação em `.av-resultado__numero`, `gap: 0` de campo com `rotuloOculto` e o cartão de variação (`*-delta`, `is-up`/`is-down`). Use `dica`, `tom`, `valorEmTexto`, `variacao` e `melhorQuando`.

**Pode ficar** só o que é específico do formulário, escopado em `.av-modulo`:

- layout próprio: a grade de duas colunas da Alimentar, o radar de Dobras, a silhueta de Perímetros e o `Body3D` da Imagem;
- larguras de coluna de tabela;
- desenhos em SVG.

```css
.av-modulo .dobras-radar-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
```

**Regras:**

- Sem família fora do par Sofia (`var(--lt-font-family)` e `var(--lt-font-display)`).
- Sem cor fixa fora de token. Um tom que falte vira `--<prefixo>-*` declarado em `.av-modulo .<raiz>`, com o contraste medido no comentário.
- Só `--lt-*` que existam em `src/views/landing/landing-tokens.css`.
- Sem `will-change`, sem `!important` e sem regra de modo escuro.
- Para vencer a base num caso específico, escreva `.av-modulo .<raiz-do-form> .<classe>`. Não use `!important`.

## 10. Prova das invariantes (cada lote entrega)

Leitura apenas: `git diff --no-index` compara arquivos sem mexer no estado do repositório.

```bash
git diff --no-index -w tmp/avaliacoes-v1/src/<caminho>/<Form>.jsx src/<caminho>/<Form>.jsx
```

1. **Lógica idêntica.** No diff não pode aparecer linha alterada em:
   - `useState`, `useReducer`, `useMemo`, `useCallback`, `useEffect` e `useRef`;
   - handlers (`handle*`, `dispatch*`, `salvar*`, `update*`) e funções de cálculo, formatação e classificação;
   - montagem do payload (`onSalvar(`, `onAutoSave(`, `tipo:`, `rascunho`, `finalizado`, `dadosBrutos`) e chamadas de API;
   - validações e mensagens.

   Mover um bloco inteiro de lugar sem alterar o conteúdo é aceitável: diga no relatório de onde para onde.
2. **Componente local de campo** (`InputField`, `Field`, `BaseNumericField`...):
   - pode passar a usar `Campo`/`CampoNumero` por dentro, mantendo a assinatura, ou ser substituído nos usos;
   - nos dois casos, `value`, `onChange`, `onBlur`, `name`, `type`, `disabled`, `readOnly` e `placeholder` chegam ao `<input>` iguais.
3. **Textos visíveis.** Todo texto de antes continua presente: rótulos, opções, ajudas, placeholders, avisos, títulos, botões e estados vazios. Confira extraindo os textos das duas versões e comparando:

   ```bash
   tr '\n' ' ' < <arquivo> \
     | grep -oE ">[^<>{}]*[[:alpha:]][^<>{}]*<|(label|rotulo|legenda|titulo|placeholder|title|aria-label|ajuda|descricao)=\"[^\"]+\"" \
     | sed -E 's/^[a-z-]+=//; s/[[:space:]]+/ /g; s/^> ?/>/; s/ ?<$/</' | sort -u
   ```

   O `tr` junta as linhas, para pegar o texto de JSX que fica sozinho numa linha entre as tags. O comando não pega texto dentro de expressão JavaScript (`'Salvando...'`, constantes de opções): esse texto aparece no diff do item 1 e deve estar inalterado.

   A lista de depois contém a de antes, e o que sobrar a mais é só:
   - os títulos de seção novos;
   - "obrigatório";
   - "Neste formulário".
4. **Modo essencial.** A contagem de cada marca é a mesma de antes, lida no JSX renderizado: `eval-field`, `eval-field--critical`, `eval-section`, `eval-field-group`, `required` e as classes `*-required*`. Um `Campo className="eval-field"` conta como um `.eval-field`.
5. **O que pode mudar:** marcação, classes, ordem visual dos blocos, agrupamento em seções e o CSS próprio.

**Checagem leve** (nada de navegador, build nem `test:ui`):

```bash
npx eslint <arquivos do lote>
node -e "require('postcss').parse(require('fs').readFileSync('<css do lote>','utf8'))"
node scripts/test-avaliacao-base.cjs
```

## 11. Relatório de cada lote

1. **Arquivos alterados**, uma linha cada.
2. **Por formulário:**
   - as seções (título e o que entrou em cada uma);
   - se tem índice;
   - o nível de título do módulo.
3. **O diff contra `tmp/avaliacoes-v1/`:**
   - a confirmação dos itens 1 e 2 da seção 10;
   - os blocos movidos, de onde para onde;
   - qualquer linha de lógica que tenha mudado, com o motivo (o esperado é nenhuma).
4. **Textos:**
   - a comparação do item 3 da seção 10;
   - a lista de textos novos (títulos de seção), que é a única permitida.
5. **Modo essencial:** a contagem antes e depois de cada marca.
6. **Ausência exibida como 0** que o lote encontrou e trocou por "—", ou deixou por entrar em cálculo.
7. **CSS:**
   - linhas antes e depois;
   - o que ficou e por quê;
   - a saída do postcss.
8. **A saída exata** de `eslint` e de `test-avaliacao-base`.
9. **O que medir no navegador** na rodada final.
10. **O que não foi feito** e o que depende de outro lote ou da fase 2.

## 12. Pendências fora da base (para a fase 2 e o orquestrador)

- `AvaliacaoCompleta.css:1952` (`.avaliacao-completa .avaliacao-body .eval-card`, especificidade 0,3,0) zera fundo, borda e padding de **todo** `.eval-card` do corpo. Com isso, os cartões internos (Alimentar, Carga de treino e REDS) ficam transparentes, apesar da base. A fase 2 deve remover ou restringir essa regra.
- **Dois h3 com o mesmo nome.** A barra da página tem um h3 com o nome do módulo, e o módulo traz o próprio h3. A fase 2 decide se o da barra vira texto (sem título) enquanto um módulo está aberto. Na "Visão geral", que não tem módulo, ele pode continuar h3.
- **O módulo traz os próprios cartões brancos** (cabeçalho, índice e seções). A área do módulo na página deve ter fundo de página (`--lt-color-bg-app`) e não envolver o módulo noutro cartão branco.
- **O modo essencial** (seletores em `AvaliacaoCompleta.jsx` e `avaliacoes.css`) não conhece as classes `av-*`. Hoje ele funciona porque os lotes repassam as classes legadas (seção 4, regra 4). Passar a reconhecer `av-campo` exige mudar a página e `avaliacoes.css` no mesmo passo.
