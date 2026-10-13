# A2, "Pista em movimento": plano

Evolução da direção A (`../plano.md`, seção 2) depois da decisão do usuário: "melhorar em cima da direção A, com animações, tudo bonito, com referências ao esporte". Este é um mockup de direção de arte, não código de produção.

Arquivos desta pasta:

| Arquivo | O que é |
|---|---|
| `plano.md` | Este documento. |
| `index.html`, `estilo.css`, `formulario.css`, `animacao.js` | O mockup, abrível direto no navegador (`file://`). A pista é um SVG dentro do HTML; `estilo.css` tem a página, a pista e a coreografia; `formulario.css`, o login, as portas e o modal; `animacao.js`, só a marcação de início e as microinterações. |
| `contraste.cjs` | Contraste de todos os pares citados aqui (`node docs/design/landing-v2/a2-pista/contraste.cjs`). |
| `capturar.mjs` | Capturas, vídeo da entrada, medições (rolagem horizontal, texto cortado, alvos, posição do botão, fontes) e comparação pixel a pixel entre o estado final e o estado sem movimento (`node docs/design/landing-v2/a2-pista/capturar.mjs [pasta-de-conferência]`). |
| `pista-1280.png`, `pista-390.png` | Estado final, primeira tela. |
| `pista-sem-movimento-1280.png` | Mesma tela com `prefers-reduced-motion: reduce`. |
| `pista-entrada.webm` | A sequência de entrada a 1280×800. |

## 1. Diagnóstico da rodada anterior

A direção A tinha a ideia certa (a curva da pista com o emblema no centro, o disco azul e verde do logotipo virando chão) e o acabamento errado. O que leu como amador:

- A pista era uma forma CSS chapada (sombras sólidas concêntricas), sem luz, sem textura e sem marcação. Parecia um ícone ampliado.
- O formulário era o padrão do navegador com borda: campo cru, links sublinhados no meio da frase, nenhum estado além do foco.
- Muito branco sem função: metade da coluna da esquerda era vazio entre o texto e a curva.
- Nenhum movimento que desse vida à primeira impressão.

## 2. A ideia

**A pista à noite, com o estádio aceso.** O painel da esquerda é o estádio visto de cima, depois que as luzes acendem: o azul do emblema vira a noite em volta da pista, as raias azuis com linhas brancas fazem a curva, o gramado verde tem as listras de corte que se veem nas transmissões, e o emblema fica no centro da curva.

**O movimento é o da corrida.** Uma volta de luz percorre a raia 1 rente ao meio-fio interno. É a referência exata das luzes de ritmo (Wavelight) que as provas de meio-fundo usam hoje: uma fileira de LEDs verdes no meio-fio que corre na velocidade do recorde. A luz é verde porque é a luz do ritmo, e é o verde da liga.

Referências esportivas usadas, todas com função na imagem:

| Referência | Onde aparece |
|---|---|
| Curva de pista de 8 raias vista de cima, com meio-fio branco | O herói |
| Largada escalonada: as linhas de partida avançam raia a raia na curva | Marcas brancas curtas na curva, em diagonal |
| Número de raia pintado no chão | Números na pista e na lista das áreas |
| Luz de ritmo no meio-fio | A volta de luz da entrada |
| Listras de corte do gramado | O campo interno |
| Verde de largada | O botão Entrar, a única ação sólida |
| Quadro de largada das transmissões (raia, nome, informação) | A lista das quatro áreas |

## 3. As quatro áreas como raias

**Uso, com um limite.** As quatro áreas trabalham ao mesmo tempo, lado a lado, e não em sequência. É exatamente o que raias são: posições paralelas numa mesma prova. A ordem das raias segue o tripé universitário (ensino, pesquisa, extensão, mais comunicação), que não é ranking.

O limite: **o texto não vai pintado na pista.** Raia com proporção real é estreita (na curva da página, 15 px no desktop e 7 px no celular). Para caber uma linha de texto, a raia teria de ter 60 px, e a curva, raio de mais de 1.500 px, que não cabe em tela nenhuma. Encolher a curva até caber deforma a pista em um desenho de ícone. Então a lista das áreas usa a linguagem do quadro de largada da transmissão: número da raia em algarismo de pista, nome, uma linha de descrição, e fios finos entre as linhas como linhas de raia. O número liga a lista à pista: quando a luz passa e as marcas de largada acendem nas raias 1 a 4, o número da área correspondente acende junto.

Texto das áreas, tirado do sistema:

| Raia | Área | Linha | Origem |
|---|---|---|---|
| 1 | Ensino | Reuniões científicas, rodas de conversa e materiais de apoio. | `Ensino.jsx`, descrição da visão geral, literal |
| 2 | Pesquisa | Projetos, ideias abertas a estudantes e produções científicas. | `ResearchProjects.jsx`: "Projetos, ideias e produções científicas da liga" e "Propostas abertas para estudantes" |
| 3 | Extensão | Inscrições de atletas, capacitações, guias e protocolos. | `Extensao.jsx`: triagens públicas (as inscrições do formulário `/inscricao`), capacitações e "Guias, protocolos e materiais" |
| 4 | Comunicação | Avisos, campanhas e divulgações da liga. | `Comunicacao.jsx`, descrição de Comunicados, literal |

Frase sobre a liga: "Reúne estudantes e profissionais de várias áreas da saúde em torno da nutrição de atletas." "Várias áreas" vem do próprio sistema: o modal de acesso aceita nutrição, fisioterapia e psicologia (CRN, CREFITO, CRP). Nenhum número, depoimento, selo ou parceiro.

## 4. Tokens

### Cor

| Nome | Hex | Papel |
|---|---|---|
| Noite | `#1c2150` | Fundo do painel do estádio. O azul-violeta do corredor do emblema (`#2d2d46`), levado para o azul. |
| Pista | `#2560a8` | Superfície das raias (mais clara sob o refletor, mais escura nas bordas), links e anel de foco. Azul da marca. |
| Gramado | `#3d8c2a` | Campo interno, com listra `#367f25`. Verde da marca, **só gráfico**. |
| Largada | `#2d7a1a` | Botão Entrar. |
| Tinta | `#262947` | Texto sobre branco. |
| Cal | `#ffffff` | Fundo do formulário, linhas de raia, texto sobre a noite. |

Apoio: Névoa `#c3c8e6` (texto secundário sobre a noite), Apoio `#555c78` (texto secundário sobre branco), borda de campo `#7a8098`, Luz `#c9f7b0` (a luz de ritmo, só gráfico), erro `#b91c1c` sobre `#fef2f2`.

Contraste medido (fórmula de `scripts/test-landing-tokens.cjs`; a tabela completa sai de `contraste.cjs`):

| Par | Razão | Mínimo |
|---|---|---|
| Cal sobre noite (título, nomes das áreas) | 15,19:1 | 4,5:1 |
| Névoa sobre noite (frase, descrições) | 9,20:1 | 4,5:1 |
| Tinta sobre cal | 14,09:1 | 4,5:1 |
| Apoio sobre cal | 6,59:1 | 4,5:1 |
| Pista sobre cal (links) | 6,33:1 | 4,5:1 |
| Cal sobre largada (botão) | 5,37:1 | 4,5:1 |
| Cal sobre pista (número de raia) | 6,33:1 | 4,5:1 |
| Erro | 5,91:1 | 4,5:1 |
| Borda do campo sobre cal | 3,91:1 | 3:1 |
| Borda do campo sobre o fundo do campo `#f6f7fb` | 3,65:1 | 3:1 |
| Linha de raia sobre pista | 6,33:1 | 3:1 |

Pista e gramado medem 1,50:1 entre si, e por isso nunca se tocam: o meio-fio branco os separa, como numa pista de verdade. Nenhum texto fica sobre a pista nem sobre o gramado.

### Tipografia

Mantida da direção A, porque funcionou e porque a família dá as duas vozes de que a página precisa:

- **Sofia Sans Extra Condensed 800**: o nome da liga e os números de raia (na lista e pintados na pista). É a letra estreita e pesada do número de peito e do placar.
- **Sofia Sans 400 a 700**: formulário, frase, nomes e descrições das áreas.

Na primeira construção, os nomes das áreas também usavam a Extra Condensed, e a lista disputava com o título. Passaram para a Sofia Sans 700, e a letra de placar ficou só onde ela é placar: o nome e os números.

Custo medido: 39,4 KB + 15,4 KB = **54,8 KB** em dois arquivos, confirmado no navegador (56.144 bytes baixados). A Outfit atual pesa 31,5 KB, então a diferença é de **+23,3 KB**. Nenhum peso novo entra nesta rodada. A Extra Condensed só desenha texto fixo (o nome e os algarismos de 1 a 8), então o parâmetro `text=` do Google Fonts a reduz a cerca de 4 KB. O custo é que qualquer mudança no título exige atualizar o parâmetro.

Escala: 13, 15, 16, 17, 22 e 28 px no texto; título de 38 px (celular) a 60 px (desktop), entrelinha 0,95.

## 5. Layout

Desktop, 1280×800. O painel do estádio é um bloco com cantos arredondados de 24 px, recuado 12 px da borda, e ocupa a coluna da esquerda. O formulário fica sobre o branco, à direita, sem cartão. Alinhamento à esquerda em tudo.

```
+--------------------------------------------------------------------------------+
| +-------------------------------------------------------+                      |
| | Liga Acadêmica                1  Ensino               |   Entrar             |
| | Interprofissional de             Reuniões científicas…|   Use seu CPF…       |
| | Nutrição Esportiva            2  Pesquisa             |                      |
| | FACISA, Universidade…            Projetos, ideias…    |   CPF ou e-mail      |
| | Reúne estudantes e            3  Extensão             |   [______________]   |
| | profissionais…                   Inscrições de…       |   Senha    Esqueci   |
| |                               4  Comunicação          |   [__________][o]    |
| |                                  Avisos, campanhas…   |   [    Entrar     ]  |
| | ==========(8 raias, reta)==========.                  |                      |
| | ===================================  .                |   +----------------+ |
| | ===================================\  \  \            |   | É atleta…      | |
| | ------------------------------.  \  |  |  |           |   | Lista de espera| |
| | (gramado com listras)          \ |  |  |  |           |   +----------------+ |
| |            (EMBLEMA)            ||  |  |  |           |   | Professor…     | |
| |                                 ||  |  |  |           |   | Solicitar      | |
| +-------------------------------------------------------+   +----------------+ |
+--------------------------------------------------------------------------------+
  a reta sai pela borda esquerda do painel; a curva se volta para o formulário;
  o emblema fica no centro geométrico da curva
```

Celular, 390×844. O painel do estádio vem primeiro (título, instituição, frase e uma faixa da curva com o emblema). O formulário sobe sobre o painel como uma folha branca de cantos arredondados, com o botão na primeira tela. Depois vêm as duas portas, a lista das áreas num segundo painel escuro e o rodapé.

```
+--------------------------------+
| Liga Acadêmica                 |
| Interprofissional de   (38 px) |
| Nutrição Esportiva             |
| FACISA, UFRN…                  |
| Reúne estudantes…              |
| =======================.       |
| ====(faixa da curva)=== \      |
|  (gramado)   (EMBLEMA)   |     |
|+------------------------------+|
|| Entrar                       ||
|| CPF ou e-mail                ||
|| [__________________________] ||
|| Senha           Esqueci      ||
|| [______________________][o]  ||
|| [          Entrar          ] ||  <- base abaixo de 760 px
|+------------------------------+|
| [É atleta…  lista de espera ]  |
| [Professor… solicitar acesso]  |
| +----------------------------+ |
| | 1 Ensino …                 | |
| | 2 Pesquisa …               | |
| | 3 Extensão …               | |
| | 4 Comunicação …            | |
| +----------------------------+ |
| © 2026 LAINES                  |
+--------------------------------+
```

O desenho da pista é um SVG só, com `viewBox` fixo e `preserveAspectRatio="xMaxYMax slice"`: a curva e o emblema ficam ancorados à direita e embaixo, e é a reta que se corta na borda esquerda quando a tela estreita.

## 6. A coreografia da entrada

Uma sequência única, de cerca de 3 s, que não se repete. O formulário está visível e utilizável desde o primeiro quadro: a animação não atrasa o login.

| Tempo | Nome | O que acontece | Propriedade animada |
|---|---|---|---|
| 0 – 600 ms | As luzes acendem | A superfície da pista e o gramado surgem do escuro. | `opacity` |
| 150 – 1.150 ms | As raias se desenham | As nove linhas brancas se traçam da reta para a curva, de dentro para fora, 45 ms de defasagem entre linhas. | `stroke-dashoffset` |
| 1.000 – 1.400 ms | Às suas marcas | As marcas de largada escalonadas aparecem raia a raia. Nas raias 1 a 4, o número da área correspondente na lista acende junto. | `opacity`, `transform` |
| 1.350 – 2.750 ms | A volta | A luz de ritmo corre pelo meio-fio no sentido real da corrida (anti-horário): entra pela borda de baixo, contorna a curva e segue pela reta até sumir no escuro. São quatro camadas com a mesma ponta: um clarão largo que ilumina a raia, o rastro fino, o halo e o núcleo. | `stroke-dashoffset`, `opacity` |
| 2.050 – 2.750 ms | Chegada | Quando a luz deixa a curva, o emblema pousa no centro dela: fica opaco em 130 ms, desce 14 px, passa um pouco do tamanho (1,05) e se acomoda. | `transform`, `opacity` |
| 2.250 – 3.050 ms | O anel | Um anel branco se abre em volta do emblema e some, uma vez. | `transform`, `opacity` |

Estado final: raias traçadas, marcas visíveis, números acesos, emblema no lugar, luz e anel invisíveis. Com `prefers-reduced-motion: reduce`, a página nasce nesse estado, sem nenhuma transição. Sem JavaScript também: a classe que liga a coreografia é posta por `animacao.js`.

Todas as animações usam preenchimento `backwards`. Ao terminar, cada elemento volta ao estilo estático, que é igual ao último quadro, e solta a camada de composição. É isso que faz o estado final coincidir pixel a pixel com o estado sem movimento (seção 9).

Microinterações do formulário (respostas à ação da pessoa):

- Foco: a borda passa a azul e um anel de 4 px aparece (`opacity` e `transform`).
- O campo "CPF ou e-mail" reconhece o que está sendo digitado e mostra "CPF" ou "E-mail" dentro do campo.
- Senha: botão de mostrar com ícone, `aria-pressed` e rótulo acessível; aviso de Caps Lock ativado.
- Entrar: ao passar o mouse, um brilho atravessa o botão uma vez (a mesma luz de ritmo); ao pressionar, afunda levemente; ao enviar, "Entrando…" com uma luz correndo na base do botão enquanto espera.
- Erro: campos vazios ganham mensagem própria; credencial recusada mostra o erro em `role="alert"` e o formulário balança uma vez (sem balanço com movimento reduzido).
- As duas portas são linhas clicáveis inteiras, com borda e estado de passagem do mouse; "Solicitar acesso" abre o modal existente, representado no mockup só pelo cabeçalho e pelos primeiros campos.

## 7. A única coisa memorável

A volta de luz: a luz verde de ritmo contorna a curva no meio-fio, e quando ela termina, o emblema pousa no centro da curva. Parada, a mesma imagem continua de pé: o estádio aceso à noite com o emblema no meio do gramado.

## 8. Revisão do plano contra o briefing e contra os padrões

Teste da skill: se o pedido fosse "login moderno de liga acadêmica de nutrição esportiva", eu chegaria a um painel em gradiente azul e verde, logotipo, título e fileira de números, com um cartão branco com sombra à direita. O que muda aqui:

1. **O painel não é gradiente de marca, é um lugar.** A noite, a pista e o gramado são desenho com marcação real; o gradiente só existe como luz de estádio sobre a pista.
2. **Nenhum número de atendimento.** As estatísticas da direção A saíram (dado clínico, vetado pelo usuário). No lugar, as quatro áreas.
3. **O formulário não está num cartão.** Fica sobre o branco, e o acabamento está nos componentes: campo preenchido de cantos 12 px, estados de foco, erro e carregamento.
4. **Links no meio da frase viraram duas linhas clicáveis.** Não dependem só da cor para serem reconhecidos como ação (na direção A, o azul do link media 1,04:1 contra o texto ao lado, e só o sublinhado os distinguia).
5. **Descartei** pôr as áreas pintadas dentro das raias (seção 3), a pista inteira em oval (vira ícone de mapa e perde a ideia da curva como chão) e a vista em perspectiva a partir da linha de largada (pesada, e o texto em perspectiva não se lê).

Conferência com a lista da skill: sem rótulo em caixa alta acima de título, sem "→" em botão ou link, sem meta-texto com ponto médio (a instituição é uma frase: "FACISA, Universidade Federal do Rio Grande do Norte"), sem fileira de número grande com rótulo pequeno, sem palavra destacada no título. Numeração só nas raias, onde o número é a identidade da raia.

Briefing fixo:

- Sem dado clínico nem de paciente: conferido, a página tem nome, frase, áreas, login e as duas portas.
- Identidade: emblema inteiro, recortado em círculo (o arquivo é opaco com fundo branco), e o par `#2560a8` / `#3d8c2a` como pista e gramado.
- Movimento: sem laço; termina em cerca de 3 s; só `opacity`, `transform` e `stroke-dashoffset`; movimento reduzido nasce no estado final.
- Piso: contraste medido na seção 4; foco visível; alvos de 48 px; medições de 320 px e posição do botão na seção 9.

## 9. Crítica das capturas

Capturas e medições feitas por `capturar.mjs` com o Chromium do Playwright do projeto, por `file://`. As fontes do Google são baixadas uma vez e servidas da memória, para nenhuma captura mostrar a fonte de reserva. As capturas de entrega são tiradas **depois** da entrada (3,4 s), com movimento ligado. As capturas de conferência (quadros da animação, foco, erros, envio, modal, 320 px, 375×667, página inteira) ficaram fora desta pasta.

### Medições da última rodada

| Verificação | 1280×800 | 390×844 | 375×667 | 320×700 |
|---|---|---|---|---|
| Rolagem horizontal | não | não | não | não |
| Texto fora da janela ou cortado | nenhum | nenhum | nenhum | nenhum |
| Alvos menores que 44 px | nenhum | nenhum | nenhum | nenhum |
| Altura da página | 800 (cabe numa tela) | 1.488 | 1.409 | 1.512 |
| Base do botão Entrar | 441 | 743 | 623 | 664 |
| Botões sólidos na página | só "Entrar" | só "Entrar" | só "Entrar" | só "Entrar" |
| Fontes | Sofia Sans e Extra Condensed, 56.144 bytes | idem | idem | idem |
| Erros de console | nenhum | nenhum | nenhum | nenhum |

**Estado final e estado sem movimento:** comparados pixel a pixel (canal com diferença acima de 8), **0 pixel diferente** a 1280×800 e a 390×844. `pista-1280.png` e `pista-sem-movimento-1280.png` são idênticas.

**Vídeo:** `pista-entrada.webm`, 1280×800, 4,36 s. Cobre da página escura até o anel se apagar.

### O que vi e mudei, na ordem

1. **O aviso "Caps Lock ativado" aparecia sem motivo.** O `display: inline-block` do aviso anulava o atributo `hidden`. Correção: regra global `[hidden] { display: none !important }`.
2. **A 1280×800, 23 px de rolagem e a reta cortada no alto.** O `viewBox` era mais alto que a célula da curva, e o `slice` cortava as raias externas da reta. Refiz a geometria (`viewBox` 820×384, meio-fio de raio 140, raias de 15) e compactei a lista das áreas. A página passou a caber em 800.
3. **Estado final diferente do estado sem movimento (14.570 pixels).** A máscara de diferença apontou os números da lista, o emblema e as linhas da curva: o preenchimento `both` mantinha camadas de composição e o tracejado das linhas depois do fim. Com `backwards`, e com o tracejado só dentro dos `@keyframes`, a diferença caiu para 0.
4. **A luz de ritmo não aparecia.** Com `var()` dentro dos `@keyframes`, o Chrome interpolava o `stroke-dashoffset` de forma discreta, e a luz saltava do começo para o fim na metade do tempo. Troquei por um `@keyframes` literal por camada.
5. **A luz passava depressa pela curva e se arrastava no escuro.** Encurtei o caminho para o trecho visível e acrescentei o clarão largo, que ilumina a raia em volta da luz.
6. **O emblema entrava translúcido, como um fantasma sobre o gramado.** Agora fica opaco em 130 ms, e só a escala continua.
7. **Havia uma emenda retangular onde começa o desenho.** A luz do refletor pintava a noite fora da pista. Ela passou a cair só sobre a pista e o gramado.
8. **A lista das áreas disputava com o título.** Os nomes passaram para a Sofia Sans 700 (seção 4).
9. **No celular, o botão Entrar ficava a 830 px (798 sem o aviso fantasma).** Apertei o ritmo vertical e, em telas de até 720 px de altura, a faixa da pista passou a 128 px e o título diminuiu. O botão ficou a 743 px em 390×844 e a 623 px em 375×667.
10. **O formulário saltava para cima quando um erro aparecia.** A coluna estava centrada na vertical. Passou a ser ancorada no topo.
11. **Os botões do modal estavam desalinhados.** A margem do botão Entrar no desktop vencia a do botão compacto (mesma especificidade, regra posterior). Correção: seletor com duas classes.

### O que continua fraco

- **A metade de cima do painel ainda é texto sobre fundo liso.** Título à esquerda e lista à direita, com a pista só na metade de baixo. A imagem fica dividida entre "slide de duas colunas" e "estádio". Levar as áreas para baixo da dobra daria mais pista à primeira tela, mas tiraria as áreas dela no desktop.
- **O medalhão continua sendo um adesivo branco.** O arquivo do logotipo é opaco, com fundo branco quadrado. Um emblema em SVG, ou em PNG com transparência, deixaria o disco azul e verde assentar direto no gramado, que é a ideia original da direção A.
- **No celular, o emblema tem 84 px** e o texto do anel não se lê. É o limite do logotipo abaixo de uns 120 px, já registrado na rodada anterior.
- **A volta de luz dura 1,4 s, e quem entra todo dia a vê toda vez.** Na implementação, vale considerar tocar a entrada completa só na primeira visita da sessão e, nas seguintes, nascer no estado final.
- **Os números de 1 a 4 na lista das áreas** podem ser lidos como ordem de importância. A leitura pretendida é a de raia, e o texto não a explica.
- **Não testado:** leitor de tela, zoom de 200%, orientação horizontal no celular, Safari e Firefox (recorte, filtros SVG e `pathLength` variam entre motores), e desempenho em celular modesto (o desfoque SVG da luz é recalculado a cada quadro durante 1,4 s).
- **Semântica provisória:** o `h1` está fora do `main`, porque a grade precisa de filhos diretos. Na implementação, o marco `main` deve envolver título e acesso, como já apontado na rodada anterior.
