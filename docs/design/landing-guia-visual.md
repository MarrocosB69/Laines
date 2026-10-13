# Guia visual — landing e login do LAINES

@origem: docs/auditoria-2026-09-11/interface-usabilidade.md, seção "Direção visual proposta" e achado UX-08.
@escopo: `src/views/LoginPage.jsx` / `src/views/LoginPage.css` (a landing atual) e os componentes que a substituem em `src/views/landing/`.

Este documento é o vocabulário visual para o redesenho da landing/login. Não é um mockup: é a decisão, o motivo e o valor concreto de cada token, para quem for montar os componentes em `src/views/landing/`. Os tokens em si estão em `src/views/landing/landing-tokens.css`; este guia explica por que cada um tem o valor que tem.

## Direção vigente: "Energia e velocidade" (25/09/2026)

Esta seção prevalece sobre as seções abaixo onde as duas divergem. O usuário julgou "amadoras" as versões anteriores e escolheu a direção de `docs/design/landing-v2/a2-energia/` (plano, mockup, capturas e vídeo). O mandato citado em "Mandato e limite" foi superado por essa decisão: a página tem entrada animada e não mostra números nem capturas de telas internas. O motivo de cada valor está em `docs/design/landing-v2/a2-energia/plano.md`, e a implementação está em `docs/implementacao/landing-v2/`.

| Tema | Antes (seções abaixo) | Agora |
|---|---|---|
| **Tipografia** | Só Outfit. | Duas famílias da mesma superfamília: Sofia Sans (400–700) para texto e Sofia Sans Extra Condensed Italic 900 (`--lt-font-display`) só para o título, "Entrar" e os nomes das áreas. Custo medido: 55,0 KB. |
| **Texto** | `#0c1f30` / `#4e6a82` / `#527293` | `#262947` / `#555c78` / `#5f6782`, o azul-violeta do corredor do emblema. Os três passam de 4,5:1 sobre branco, campo e fundo. |
| **Cena** | Três blobs e depois um, estático. | Estádio (`--lt-color-stadium` `#0b2a5e`), pista em perspectiva e luz do horizonte. Texto sobre a cena usa só branco ou `--lt-color-mist`, com o pior caso medido sobre o fundo real: 4,83:1. |
| **Botão primário** | Verde sólido; o degradê anterior tinha pontos a 3,45:1. | Degradê de `--lt-color-start-top` a `--lt-color-start-bottom`. As duas pontas são medidas pelo teste: 4,82:1 e 6,20:1. Continua sendo o único sólido da página. |
| **Borda do campo** | Translúcida. | `--lt-color-border-field` `#7a8098`, 3,91:1 (componente, WCAG 1.4.11). |
| **Movimento** | Nenhuma animação como substituto de reorganização. | Uma entrada de cerca de 2 s na primeira visita da sessão, com relógio único em `--lt-entrada-*`. Sem laço, só `transform`/`opacity`. Com movimento reduzido, a página nasce no estado final. |

Continuam valendo: foco (`--lt-focus-ring`), alvo mínimo de 44 px, uma ação sólida por região, raios de borda e os tokens semânticos. Os pares de cor desta tabela são verificados por `scripts/test-landing-tokens.cjs`.

**Armadilha registrada na implementação:** `src/index.css` e `src/styles/theme.css` têm regras globais de elemento que vencem a herança dentro da landing:
- `h1` com degradê em `background-clip: text`, que deixou o título invisível;
- `h1…h6` em Poppins e com cor azul-escura, que deixou o título das áreas a 1,09:1;
- `button { white-space: nowrap }`, que fez uma porta passar da borda a 320 px.

Todo título ou botão novo da landing precisa declarar a própria cor, fonte e quebra de linha.

## Mandato e limite

A auditoria já decidiu a direção; este guia não a reabre:

> "Manter identidade azul/verde e componentes existentes. A melhoria deve vir de hierarquia: título claro, uma ação principal, menos cartões aninhados, menos variações de estado. Não trocar todas as cores ou adicionar animações como substituto da reorganização."

Traduzindo para esta entrega: **"clean" é subtrair variação não intencional, não redesenhar do zero.** Onde a landing atual (`LoginPage.css`, 959 linhas) já faz algo bem — hierarquia geral de seções, identidade verde/azul, layout de duas colunas (conteúdo + painel de login) — este guia mantém. Onde ela acumulou variação sem motivo (oito tons de azul diferentes para texto, seis raios de borda distintos, duas famílias tipográficas, três blobs animados), este guia propõe cortar.

Cada decisão abaixo está marcada como **[auditoria]** (decorre diretamente do texto citado ou de UX-08) ou **[decisão deste guia]** (minha leitura de "clean = subtrair", justificada, mas não uma citação literal da auditoria).

## Tipografia

### Uma família, não duas — [decisão deste guia]

Hoje o CSS carrega duas famílias do Google Fonts num único `@import`:

```
@import url('...family=Outfit:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');
```

É uma única requisição HTTP para o CSS do Google Fonts, mas o navegador ainda baixa os arquivos de fonte de cada família/peso referenciado — hoje até 8 arquivos (5 pesos de Outfit + 3 de Space Grotesk), todos no caminho crítico da primeira tela que a pessoa vê. Numa landing cujo único trabalho é "explicar o que é o sistema e deixar entrar", cada fonte extra é atraso antes do título aparecer.

Visualmente, Outfit e Space Grotesk são as duas faces geométricas/humanistas da mesma família de estilo — a diferença entre elas em títulos de 24–48px é sutil, não uma escolha de identidade como seria misturar uma serifada com uma geométrica. Outfit já cobre 400–800: essa faixa de peso, combinada com `letter-spacing` negativo nos degraus grandes (como o H2 do Space Grotesk já fazia, `-0.03em` a `-0.045em`), reproduz a mesma sensação de "título desenhado" sem carregar uma segunda família.

**Decisão: manter só Outfit.** Hierarquia vem de tamanho (escala abaixo), peso (600 para ênfase, 700–800 para título) e `letter-spacing`, não de trocar de fonte.

**Ação de acompanhamento, fora da minha fronteira de arquivos:** quando os componentes novos pararem de depender de `LoginPage.css`, o `@import` deve cair para `family=Outfit:wght@400;500;600;700;800&display=swap` — remover `Space+Grotesk` do import é uma linha em `LoginPage.css`, que este item não pode tocar (outro agente está nele agora). Registro aqui para não se perder.

### Escala — 7 degraus, mapeados ao uso real

A escala hoje é ad hoc: o arquivo atual tem pelo menos 15 valores de `font-size` diferentes só na landing (0.63rem, 0.64rem, 0.65rem, 0.67rem, 0.68rem, 0.7rem, 0.71rem, 0.72rem, 0.76rem, 0.77rem, 0.78rem, 0.8rem, 0.88rem, 0.9rem, 0.93rem, 1.02rem, 1.1rem, mais dois `clamp()`). Nenhum desses valores comunica uma decisão — são o resultado de ajustes pontuais acumulados. A proposta reduz para 7 degraus nomeados por uso, não por tamanho:

| Token | Valor | Uso | Exemplo no fluxo atual |
|---|---|---|---|
| `--lt-text-2xs` | `0.6875rem` (11px) | Rótulos em caixa alta, selos, eyebrow | "Acesso ao sistema", rótulo de campo ("CPF OU E-MAIL"), texto do selo "Sistema operacional" |
| `--lt-text-xs` | `0.75rem` (12px) | Metadados, legendas curtas | Legenda do carrossel, rótulo de estatística ("atletas ativos"), copyright do rodapé |
| `--lt-text-sm` | `0.8125rem` (13px) | Texto secundário e botões de ação secundária | "Esqueci minha senha", botões de rodapé do painel, mensagens de erro/sucesso |
| `--lt-text-base` | `0.9375rem` (15px) | Corpo de texto padrão | Subtítulo do hero, texto dos campos de formulário, descrição de passo concluído |
| `--lt-text-md` | `1.125rem` (18px) | Ênfase pontual, não é título de seção | "Senha redefinida com sucesso!" |
| `--lt-text-lg` | `clamp(1.5rem, 2vw, 1.875rem)` (24–30px) | Título de painel/modal — a âncora da ação principal daquela região | "Entrar na plataforma", "Solicitar acesso", número grande de estatística (atletas/avaliações/membros) |
| `--lt-text-xl` | `clamp(2.25rem, 4vw, 3rem)` (36–48px) | Título da página — só o H1 usa este degrau | "Laines App" |

Duas decisões que merecem justificativa própria:

1. **`--lt-text-lg` é compartilhado entre o H2 do painel de login e os números de estatística.** Hoje é o inverso do que devia: o número da estatística (`clamp(2rem, 3vw, 2.6rem)`, até 42px) é fisicamente maior que "Entrar na plataforma" (`clamp(1.65rem, 2.4vw, 2.1rem)`, até 34px) — um dado secundário lendo mais forte que o título da ação principal. Igualar os dois em `--lt-text-lg` corrige a inversão e reduz variação ao mesmo tempo: o H1 continua sendo, sem ambiguidade, o maior texto da página; H2 e números de estatística ficam no mesmo segundo nível, em regiões diferentes da tela, sem competir entre si.
2. **Só existe um degrau "grande" (`xl`) e ele é exclusivo do H1.** Isso é o que dá ao título da página uma âncora visual única — o pedido "uma ação principal" se estende, por analogia, a "um título principal".

### Peso e interlinha

Não há necessidade de tokens numéricos novos para peso — use os pesos já carregados (400 corpo, 600 ênfase/botão, 700–800 título) diretamente. Para interlinha, três tokens bastam e evitam o `line-height: 1.0` hoje hardcoded no H1 (compressão agressiva demais para acessibilidade de texto grande em alguns navegadores/zoom):

| Token | Valor | Uso |
|---|---|---|
| `--lt-leading-tight` | `1.15` | Títulos (`--lt-text-lg`, `--lt-text-xl`) |
| `--lt-leading-snug` | `1.35` | Rótulos, botões, texto curto de uma linha |
| `--lt-leading-normal` | `1.5` | Parágrafos e texto de formulário |

## Espaçamento

Régua única de múltiplos de 4px, 8 degraus — cobre desde o gap entre ícone e texto de um selo até o respiro entre seções, sem inventar um valor fracionário para cada caso:

| Token | Valor | Uso |
|---|---|---|
| `--lt-space-1` | `0.25rem` (4px) | Gap ícone↔texto em selos/pills; espaço entre rótulo e sublinha de foco |
| `--lt-space-2` | `0.5rem` (8px) | Gap entre rótulo do campo e a caixa de input; gap entre dots do carrossel |
| `--lt-space-3` | `0.75rem` (12px) | Padding interno de botões; gap entre pills de recurso |
| `--lt-space-4` | `1rem` (16px) | Gap entre campos de formulário; padding interno de card pequeno |
| `--lt-space-5` | `1.5rem` (24px) | Gap entre blocos dentro de uma seção (badge → título → estatísticas); padding padrão de painel/cartão |
| `--lt-space-6` | `2rem` (32px) | Padding de painel em telas largas; gap entre coluna de conteúdo e painel de login |
| `--lt-space-7` | `3rem` (48px) | Padding vertical de seção (topo/base do hero) |
| `--lt-space-8` | `4rem` (64px) | Respiro entre seções empilhadas (hero → rodapé) em telas altas |

Regra de aplicação: **espaçamento interno de um componente nunca deve exceder o espaçamento entre componentes irmãos** — é essa relação, mais do que o valor isolado, que faz uma tela "respirar" em vez de parecer um bloco só. Concretamente: o gap entre campos de um formulário (`--lt-space-4`) deve ser menor que o padding do painel que o contém (`--lt-space-5`/`--lt-space-6`), que por sua vez é menor que o espaço entre o painel e a coluna ao lado (`--lt-space-6`).

## Cor

Identidade mantida — verde e azul continuam a paleta, como a auditoria pede. O que muda é: (a) qual tom de cada cor é seguro para texto, porque nem todo tom que hoje aparece como texto realmente atinge 4,5:1; e (b) quantas variações de cada cor existem.

### Método

Contraste calculado pela mesma fórmula WCAG 2.2 que `scripts/test-acessibilidade-tokens.cjs` já usa no projeto (luminância relativa sRGB → razão `(L1+0,05)/(L2+0,05)`). Não reescrevi a fórmula: `scripts/test-landing-tokens.cjs` reproduz o mesmo algoritmo (mesmas funções `hexToRgb` / `srgbChannelToLinear` / `relativeLuminance` / `contrastRatio`) porque o arquivo de referência não exporta módulo — cada script de teste do projeto é autocontido. Nenhum valor da tabela abaixo foi arredondado a favor da aprovação: são os números que o script imprime.

Todos os pares abaixo são texto de tamanho normal (a maior fonte de texto corrido da landing, 15px, fica abaixo do piso de "texto grande" do WCAG — 18,66px em negrito ou 24px normal). Por isso apliquei o piso mais rígido, 4,5:1, a **todos** os tokens de texto, inclusive os que tecnicamente poderiam usar a folga de "texto grande" (H1/H2) — não precisei da exceção, e não quis depender dela.

### Texto

| Token | Valor | Uso | Contraste (mín. 4,5:1) |
|---|---|---|---|
| `--lt-color-text` | `#0c1f30` | Título, corpo principal, rótulos de campo | 16,74:1 sobre branco · 15,67:1 sobre `--lt-color-surface-field` · 15,87:1 sobre `--lt-color-bg-app` |
| `--lt-color-text-muted` | `#4e6a82` | Texto secundário — subtítulo do hero, descrição de card, texto de rodapé de painel | 5,66:1 sobre branco · 5,30:1 sobre field · 5,37:1 sobre app-bg |
| `--lt-color-text-subtle` | `#527293` | Metadados terciários — legenda de estatística, timestamp, texto de apoio pequeno | 5,02:1 sobre branco · 4,70:1 sobre field · 4,75:1 sobre app-bg |
| `--lt-color-text-inverse` | `#ffffff` | Texto sobre fundo escuro (botão primário) | 5,37:1 sobre `--lt-color-brand-green-text` (ver abaixo) |

**Achado que motivou `--lt-color-text-subtle` ser uma cor nova, não a reaproveitada:** o tom terciário atual da landing (`--lp-subtle: #7a96ae`) mede **3,09:1 sobre branco e 2,89:1 sobre o fundo dos campos** — abaixo do mínimo AA, e ele é usado hoje em texto de tamanho normal (rótulo de estatística a 0,67rem/11px, legenda do carrossel a 0,64rem/10px, copyright do rodapé a 0,68rem/11px — nenhum se qualifica como "texto grande"). É exatamente o tipo de token que UX-08 pede para verificar nominalmente ("tokens como... precisam ser avaliados no fundo e tamanho realmente usados"). `#527293` é o tom mais claro que encontrei que ainda cruza 4,5:1 no pior fundo catalogado (o field, `#f3f8fd`) com margem — não é o mínimo absoluto (`#557596` já cruzaria, mas com folga de 0,00–0,05 contra arredondamento); preferi uma margem confortável a um valor no limite.

### Marca

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `--lt-color-brand-green` | `#3d8c2a` | **Decorativo apenas** — preenchimento de ícone ≥24px, traço/divisor, base de gradiente removida (ver "o que não fazer") | 4,21:1 sobre branco — **não usar como cor de texto** |
| `--lt-color-brand-green-text` | `#2d7a1a` | Verde seguro para texto/ícone pequeno e para o botão primário (fundo, com texto branco por cima) | 5,37:1 sobre branco · 5,03:1 sobre field · como fundo de botão, 5,37:1 com texto branco |
| `--lt-color-brand-blue` | `#2560a8` | Único azul do vocabulário — links, ação secundária, ícone de navegação, anel de foco | 6,33:1 sobre branco · 5,93:1 sobre field |

**Achado:** o verde da marca (`--lp-green: #3d8c2a`) é usado hoje como cor de **texto** em pelo menos quatro lugares (selo "LIGA ACADÊMICA...", chip "Sistema operacional", eyebrow "Acesso ao sistema", link "Entrar na lista de espera") e mede 3,63–4,21:1 nesses contextos reais (variando com o fundo do chip) — abaixo de 4,5:1 em todos. A causa é usar o mesmo tom para duas funções diferentes: cor de marca decorativa (onde 3:1 bastaria, por ser elemento gráfico, não texto) e cor de texto (onde precisa 4,5:1). A correção não é escurecer o verde da marca inteiro — isso mudaria a identidade que a auditoria pede para manter —, é **separar as duas funções em dois tokens**: `--lt-color-brand-green` continua sendo o verde "de marca" que todo mundo reconhece, mas só aparece como preenchimento gráfico; `--lt-color-brand-green-text` é o mesmo verde, escurecido o suficiente para ser lido como texto.

**Achado, azul:** o arquivo atual usa pelo menos seis tons de azul/azul-acinzentado diferentes como cor de texto ou ícone: `#2560a8`, `#1a567e`, `#163a7a`, `#1b4167`, `#385572`, `#5a738a`, além de `#88aacc`/`#7898b4` em ícones de campo. Nenhum é claramente "o azul da marca" versus "um cinza-azulado neutro" — são pontos intermediários que se acumularam. O vocabulário novo tem **um** azul (`--lt-color-brand-blue`) para toda ação secundária/link, e usa a escala de cinza-azulado (`--lt-color-text-muted`/`-subtle`) para o que hoje são "azuis neutros" disfarçados.

### Superfícies

| Token | Valor | Uso |
|---|---|---|
| `--lt-color-surface` | `#ffffff` | Painel de login, cartões, modais |
| `--lt-color-surface-field` | `#f3f8fd` | Fundo de campo de formulário em repouso |
| `--lt-color-bg-app` | `#f5faf7` | Fundo sólido da página, por trás do gradiente ambiente |

### Bordas (não-texto)

Bordas não carregam texto — não precisam de 4,5:1, mas idealmente atingem 3:1 como limite de componente (WCAG 1.4.11). São translúcidas por design (permitem o fundo aparecer), então documento aqui como decorativas, não como par texto/fundo, e o teste automatizado não as cobra em 4,5:1:

| Token | Valor | Uso |
|---|---|---|
| `--lt-color-border` | `rgba(12, 31, 48, 0.12)` | Borda neutra padrão — campo, botão secundário, divisor |
| `--lt-color-border-brand` | `rgba(61, 140, 42, 0.2)` | Borda com identidade — acento no topo do painel, foco de marca |

### Estados semânticos

Já estavam corretos hoje — mantidos sem alteração, verificados para não regredir:

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `--lt-color-danger-text` | `#b91c1c` | Texto de erro | 5,91:1 sobre `--lt-color-danger-bg` |
| `--lt-color-danger-bg` | `#fef2f2` | Fundo de mensagem de erro | — |
| `--lt-color-success-text` | `#166534` | Texto de sucesso | 6,81:1 sobre `--lt-color-success-bg` |
| `--lt-color-success-bg` | `#f0fdf4` | Fundo de mensagem de sucesso | — |

## Foco visível — [auditoria, UX-08]

O anel de foco atual (`--lp-focus: 0 0 0 3px rgba(61, 140, 42, 0.26)`) é um brilho translúcido: medi seu tom efetivo contra branco e contra o botão verde e **nenhuma opacidade razoável (testei 0,26 a 0,5) cruza 3:1** contra os dois fundos ao mesmo tempo — o problema estrutural é que uma cor semitransparente só pode ter um contraste garantido contra um fundo específico, não contra "qualquer fundo em que o foco pode cair" (campo branco, painel branco, botão verde escuro).

A correção não é escurecer/aumentar a opacidade até funcionar num caso e falhar no outro — é desacoplar o anel do fundo por trás dele:

```
--lt-focus-ring: 0 0 0 2px var(--lt-color-surface), 0 0 0 4px var(--lt-color-brand-blue);
```

Um halo branco sólido de 2px isola o elemento de qualquer cor de fundo (campo, painel, botão), e o anel azul sólido de 4px por fora só precisa de 3:1 contra esse branco conhecido — que já mede 6,33:1, folga larga. Isso vale para qualquer controle, independente do que está atrás dele, por construção — não por sorte de combinação de cores.

## Alvo mínimo — [auditoria, UX-08]

A auditoria já resolveu a controvérsia: "o alvo de 24×24 CSS px do critério 2.5.8 tem exceções; 44×44 px pode ser adotado como preferência de conforto, não como citação incorreta desse mínimo." Uso essa leitura:

| Token | Valor | Uso |
|---|---|---|
| `--lt-target-min` | `44px` | `min-width`/`min-height` de botões e controles interativos autônomos (setas do carrossel, alternar senha visível, fechar modal) |

O indicador visual pode continuar pequeno (o dot do carrossel não precisa virar um botão de 44px) — o que precisa crescer é a área clicável, via padding ou pseudo-elemento, não o desenho.

## Hierarquia de botões — uma ação por região [auditoria]

O painel de login já segue bem a regra: um botão sólido ("Entrar agora") e duas ações secundárias com aparência mais discreta. O problema não é ter ações demais — é que as duas ações secundárias hoje têm **tratamentos visuais diferentes** para o mesmo papel (secundário): "Solicitar acesso institucional" usa borda neutra + texto azul-acinzentado (`#1a567e`); "Entrar na lista de espera" usa borda verde + texto verde. Duas cores diferentes para duas ações da mesma categoria sugerem que uma é "mais importante" que a outra sem motivo — nenhuma das duas é a ação principal da região.

**Decisão: um único estilo secundário.** Toda ação que não é o envio do formulário principal usa: borda `--lt-color-border`, texto `--lt-color-brand-blue`, sem preenchimento. O verde fica reservado para o botão primário (fundo) e para indicadores de sucesso/status — nunca para um botão de contorno secundário. Isso não muda nenhum destino de clique nem remove nenhuma ação; unifica a cor de quatro botões (`Solicitar acesso`, `Entrar na lista de espera`, `Esqueci minha senha`, `Cancelar` dos modais) num só vocabulário.

## Raio de borda — [decisão deste guia]

O arquivo atual usa pelo menos seis raios distintos sem relação aparente entre si: `1.4rem` (painel), `0.85rem` (campo/botão), `0.72rem` (campo de modal), `0.6rem` (botão de rodapé), `1.1rem` (painel mobile), `999px` (pills). Três degraus bastam:

| Token | Valor | Uso |
|---|---|---|
| `--lt-radius-control` | `0.75rem` (12px) | Campos de formulário, botões, itens de lista |
| `--lt-radius-card` | `1.25rem` (20px) | Painéis, cartões, modais |
| `--lt-radius-pill` | `999px` | Selos, chips, indicadores |

## Os três blobs de fundo — [decisão deste guia, com base em direção da auditoria]

Avaliação honesta: contribuem pouco e custam mais do que parecem. Os três `.landing-v2__ambient` são formas radiais desfocadas (`blur(96px)`) com animação contínua (`ambientFloat`, 18s, infinita) atrás do conteúdo. A favor: dão um toque de identidade a uma tela que, sem eles, seria branco/verde-claro plano; o projeto já cuida bem das exceções (some no mobile abaixo de 600px, para com `prefers-reduced-motion`). Contra: são três formas com raios, posições e delays de animação diferentes — variação sem diferença de significado, exatamente o que a auditoria pede para reduzir — e a animação contínua roda o tempo todo numa tela cujo único objetivo é "ler o título, ler a ação, entrar", não uma página de campanha para explorar.

A auditoria não nomeia os blobs, então isto é leitura minha, não citação — mas decorre diretamente do texto citado no topo deste guia ("não adicionar animações como substituto da reorganização" implica, por simetria, não *manter* animação decorativa que não carrega hierarquia). **Recomendação: manter uma forma (a de maior escala, próxima do cabeçalho/marca) como identidade visual sutil, estática — sem `animation` —, e remover as outras duas.** Isso preserva o "não é uma página em branco" sem o custo de três elementos animados competindo por atenção com o título e o formulário. Não é uma remoção total: uma mancha de cor ainda ajuda a landing a não parecer uma tela de sistema interno genérica.

## O que não fazer

Derivado diretamente da auditoria e do que a investigação acima encontrou:

1. **Não trocar a paleta.** Verde e azul continuam a identidade. Os tokens novos são os mesmos tons, reorganizados por função (texto vs. decorativo), não uma paleta nova.
2. **Não adicionar animação nova em lugar nenhum.** Se algo já anima hoje (os blobs, o shimmer do skeleton de estatística, o pulso do status "operacional"), a pergunta é se deve continuar existindo — nunca "o que mais poderia animar".
3. **Não introduzir uma segunda ação com peso visual de primária na mesma região.** Um botão sólido por região; todo o resto é contorno, no único estilo secundário definido acima.
4. **Não usar `--lt-color-brand-green` (o verde decorativo) como `color` de texto.** Se o texto precisa ser verde, é `--lt-color-brand-green-text`.
5. **Não inventar um novo tom "só um pouco diferente" de azul, verde ou cinza para um caso específico.** Os tokens desta tabela cobrem título, corpo, secundário, terciário, marca e estado — um caso que pareça não caber em nenhum é motivo para reabrir este guia, não para criar um valor solto no CSS do componente.
6. **Não usar zero, `0` ou um cartão vazio para comunicar "carregando" ou "sem dado".** Isto não é um token de cor, mas é uma regra que atravessa a landing: o esqueleto de estatística (`hero-stat__skeleton`) já faz isso corretamente hoje (mostra um placeholder animado em vez de `0` enquanto `stats` é `null`) — manter esse padrão em qualquer novo indicador numérico que a landing ganhar.

## O que já está bem e não deve mudar

"Clean" não é sinônimo de mexer em tudo:

- **O layout de duas colunas** (conteúdo à esquerda, painel de login à direita, painel primeiro no mobile via `order: -1`) já resolve bem "uma ação principal por região" — a decisão de manter foi tomada aqui, ativamente, não por omissão.
- **O carrossel de capturas reais do sistema** já cumpre o papel de mostrar o produto sem inventar conteúdo; navegação por setas com `aria-label`, dots com `aria-label` por slide, e pausa implícita em `prefers-reduced-motion` (a animação de transição de slide para, mas a troca automática por `setInterval` continua — isso é um achado de comportamento, não de cor/token, fora do escopo deste guia, mas vale registrar para quem for aos componentes: o `useEffect` do `setInterval` em `LoginPage.jsx:184-189` não observa `prefers-reduced-motion`).
- **Os breakpoints existentes** (1080px, 860px, 600px, 540px) cobrem os pontos de quebra reais do layout atual; a escala de espaçamento nova encaixa neles sem precisar de breakpoints adicionais.
- **A separação entre rótulo de campo sempre visível e placeholder de exemplo** (`<span>CPF ou e-mail</span>` acima do input, com `placeholder="CPF ou usuario@laines.ufrn.br"` dentro) já é o padrão correto — o placeholder de baixíssimo contraste (`#a6bece`, ~1,8:1) não é uma falha de acessibilidade aqui porque não é o único rótulo do campo (WCAG 1.4.3 não se aplica a texto de placeholder quando um rótulo persistente equivalente já existe). Não criei um token para "cor de placeholder": é decoração de conveniência, não vocabulário de hierarquia.

## Arquivos desta entrega

- `docs/design/landing-guia-visual.md` — este guia.
- `src/views/landing/landing-tokens.css` — os tokens como custom properties, comentados, sem nenhuma regra de componente.
- `scripts/test-landing-tokens.cjs` — verifica que todo par texto/fundo listado acima permanece ≥4,5:1, lendo os valores do arquivo de tokens (não copiados à mão).

## Ações de acompanhamento, fora da fronteira deste item

1. Remover `Space+Grotesk` do `@import` em `LoginPage.css` quando os componentes novos não depenerem mais desse arquivo.
2. Aplicar os tokens (`--lt-*`) nos componentes de `src/views/landing/*.jsx`/`*.css` que outro agente está construindo — esta entrega é só o vocabulário, não a aplicação.
3. Reduzir os três `.landing-v2__ambient` para um, estático, quando o CSS da landing for reescrito.
4. Revisar o `setInterval` do carrossel (`LoginPage.jsx:184-189`) para respeitar `prefers-reduced-motion` — achado de comportamento, não de token.
