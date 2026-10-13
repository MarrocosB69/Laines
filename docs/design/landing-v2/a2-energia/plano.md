# A2, energia: a largada

Evolução da direção A (`../direcao-a.html`) na leitura "energia e velocidade". É um mockup de direção de arte e não muda código de produção. Outra leitura da mesma direção está em `../a2-pista/`, e o usuário escolhe entre as duas.

Este plano foi gravado antes do HTML. As seções 1 a 6 são o plano, e a seção 7 registra o que mudou depois das capturas.

## 0. Ponto de partida

- **O que o usuário disse:** as duas direções anteriores ficaram "amadoras" e é preciso "modernizar". A escolha foi "melhorar em cima da direção A, com animações, tudo bonito, com referências ao esporte".
- **Diagnóstico da rodada anterior:** a recusa aos padrões da skill foi levada tão longe que a página ficou plana: sem profundidade, sem movimento, links sublinhados, campos crus e a curva como um adesivo estático. As palavras do cliente vencem, e ele pediu moderno.
- **O que fica da direção A:** a Sofia Sans Extra Condensed como voz do título, a pista como origem da identidade, o azul e o verde da marca como lugar (raia azul e gramado verde) e o formulário com rótulo sempre visível.
- **O que muda:** a pista sai do adesivo plano e ganha profundidade (perspectiva, luz, horizonte). O título deixa de ser só texto grande e vira composição. A página passa a ter uma entrada orquestrada, e o formulário ganha acabamento de produto.

## 1. Briefing fixo

- Nenhum dado clínico nem de pacientes: sem números de `/public/stats`, sem percurso de atendimento, sem capturas de telas internas.
- Conteúdo: nome da liga, uma frase curta, login, lista de espera (`/inscricao`), solicitar acesso (modal) e as quatro áreas, uma linha cada, com o texto tirado do sistema.
- Logotipo `src/assets/LogoLaines.webp` e o par `#2560a8` e `#3d8c2a`.
- Movimento: uma entrada orquestrada e microinterações na ação da pessoa. Nada em laço. Com `prefers-reduced-motion`, a página aparece no estado final. Só `transform` e `opacity` são animados.
- Piso: texto com contraste de 4,5:1 ou mais, foco visível, alvos de 44 px ou mais, nada cortado a 320 px, botão Entrar na primeira tela do celular e uma ação sólida por região.
- No máximo duas famílias de fonte, com o custo medido.

### O texto das quatro áreas (origem)

| Área | Linha na página | De onde vem |
|---|---|---|
| Ensino | Reuniões científicas, rodas de conversa e materiais de apoio. | `src/views/admin/Areas/Ensino.jsx`, linhas 61–62 (descrição do painel) |
| Pesquisa | Projetos, ideias e produções científicas da liga. | `src/views/admin/Research/ResearchProjects.jsx`, linhas 76–77, sem o final "em um só lugar" |
| Extensão | Triagens, capacitações e materiais produzidos pela liga. | `src/views/admin/Areas/Extensao.jsx`, linhas 67–68 (descrição do painel) |
| Comunicação | Avisos, campanhas e divulgações da liga. | `src/views/admin/Areas/Comunicacao.jsx`, linhas 68–69 (seção Comunicados) |

As quatro raízes coincidem com `ACADEMIC_NAVIGATION` em `src/constants/academicNavigation.js` (ensino, research, extensao, comunicacao).

**Frase sobre a liga:** "A liga da FACISA/UFRN que reúne estudantes e profissionais de saúde em torno da nutrição no esporte." Ela diz o que a liga é e não traz número nem promessa. "Profissionais de saúde" corresponde aos cargos que o modal de acesso aceita (professor e profissional com CRN, CREFITO ou CRP).

## 2. Tokens

### Cores

| Nome | Hex | Papel |
|---|---|---|
| Estádio | `#0b2a5e` | Céu da cena e faixa das áreas. É o azul da marca escurecido, e não um quase-preto. |
| Pista | `#2560a8` | Superfície das raias, links e anel de foco. É o azul da marca. |
| Gramado | `#3d8c2a` | Campo interno e luz do horizonte. É o verde da marca, **só como gráfico**, nunca atrás de texto. |
| Largada | `#2d7a1a` | O botão Entrar, com um degradê de `#33821f` a `#2a6f18`. É o único sólido da página. |
| Cal | `#ffffff` | Superfície do formulário e texto sobre a cena. |
| Tinta | `#262947` | Texto do formulário. É o azul-violeta do corredor do emblema. |

Neutros: Apoio `#555c78` (texto secundário sobre branco), Névoa `#d6e3f5` (texto secundário sobre a cena), Borda `#7a8098` (limite do campo) e o par de erro `#b91c1c` sobre `#fef2f2`.

| Par | Contraste | Mínimo |
|---|---|---|
| Cal sobre Estádio (título, áreas) | 13,93:1 | 4,5:1 |
| Cal sobre Pista (ponto mais claro da cena) | 6,33:1 | 4,5:1 |
| Névoa sobre Estádio (frase, descrição das áreas) | 10,73:1 | 4,5:1 |
| Névoa sobre Pista (pior caso, se a frase encostar no azul claro) | 4,87:1 | 4,5:1 |
| Cal sobre Largada, do topo à base do degradê (`#33821f` a `#2a6f18`) | 4,82 a 6,20:1 | 4,5:1 |
| Tinta sobre Cal | 14,09:1 | 4,5:1 |
| Apoio sobre Cal | 6,59:1 | 4,5:1 |
| Pista sobre Cal (links, "Mostrar") | 6,33:1 | 4,5:1 |
| Erro sobre fundo de erro | 5,91:1 | 4,5:1 |
| Borda do campo sobre Cal | 3,91:1 | 3:1 (componente) |
| Anel de foco (Pista) sobre Cal | 6,33:1 | 3:1 |

Todos os pares são recalculados por `contraste.cjs`, que usa a fórmula de `scripts/test-landing-tokens.cjs`.

**O degradê tem papel.** Na cena, o azul escuro fica em cima (céu), a luz verde fica no horizonte, onde a pista some, e o azul claro fica no chão perto da câmera. É profundidade de lugar, não lavagem. No botão, o degradê é luz de cima e dá volume ao único sólido.

### Tipografia

- **Sofia Sans Extra Condensed Italic 900:** título, marca "LAINES", "Entrar" e nomes das áreas. É a letra estreita da direção A, agora itálica e no peso máximo. A inclinação é a do número de peito e do placar em movimento.
- **Sofia Sans 400 a 700** (largura normal, variável): todo o resto.

São duas famílias do Google Fonts, da mesma superfamília, mas com leitura bem distinta: uma estreita, itálica e pesada, e outra larga, reta e de texto. Custo medido nos arquivos reais (subconjunto latino):

| Arquivo | Bytes | KB |
|---|---|---|
| Sofia Sans 400–700 variável | 40.372 | 39,4 |
| Sofia Sans Extra Condensed Italic 900, estática | 15.972 | 15,6 |
| **Total** | **56.344** | **55,0** |
| Extra Condensed com `text=` (só as letras do título e das áreas) | 5.772 | 5,6 |
| **Total com o subconjunto** | **46.144** | **45,1** |

A Outfit atual pesa 31,5 KB, então a diferença é de +23,5 KB, ou +13,6 KB com o subconjunto. Pedir `ital,wght@1,800;1,900` traz o arquivo variável de 41,0 KB, por isso o mockup pede só `1,900`.

Escala do texto: 13, 15, 16, 17 e 20 px. Escala de exibição: 44 px ("Entrar"), 44 a 72 px (áreas) e o título de 38 a 92 px conforme a largura, com entrelinha de 0,9, que a caixa alta estreita aguenta. O título usa caixa alta via CSS: é manchete de campanha, não rótulo. Tudo o mais fica em caixa normal.

## 3. Layout

### A ideia

**O título é uma largada escalonada.** Nos 200 m e nos 400 m, cada raia larga um pouco à frente da de dentro, porque a curva é maior por fora. As três linhas do nome da liga ficam em três raias, cada uma recuada em relação à de cima, como os blocos de partida. A pista, em perspectiva, sai do canto de baixo e corre na diagonal até o horizonte, que fica atrás do formulário. **A pista leva à entrada.**

Alinhamento: tudo alinhado à esquerda, inclusive o formulário. O escalonamento do título é o único desvio, e é intencional.

### Desktop, 1280×800

```
+--------------------------------------------------------------------------------+
| (emb) LAINES  FACISA, UFRN                                     /               |
|                                                               /                |
|  LIGA ACADÊMICA                                              /   Entrar        |
|  ─────────────────────────────────────                      /    Use seu CPF...|
|  ▌    INTERPROFISSIONAL DE                                 /                   |
|  ─────────────────────────────────────                    /  CPF ou e-mail     |
|  ▌         NUTRIÇÃO ESPORTIVA                            /   [_______________] |
|                                                         /    Senha   Esqueci.. |
|  A liga da FACISA/UFRN que reúne estudantes e          /     [________Mostrar] |
|  profissionais de saúde em torno da nutrição...       /      [    Entrar     ] |
|                           · · · luz verde · · ·      /                         |
|        _______________________________________  ___/  ---------------------  |
|    ___/  /    /    /     (raias em perspectiva)    /   [ícone] É atleta ... >  |
|  _/(gramado) /    /     marcas passam na largada  /    [ícone] Profission. >   |
+--------------------------------------------------------------------------------+
| As quatro áreas da liga                                                        |
|================================================================================|
|  ENSINO              Reuniões científicas, rodas de conversa e materiais...    |
|--------------------------------------------------------------------------------|
|    PESQUISA          Projetos, ideias e produções científicas da liga.         |
|--------------------------------------------------------------------------------|
|      EXTENSÃO        Triagens, capacitações e materiais produzidos pela liga.  |
|--------------------------------------------------------------------------------|
|        COMUNICAÇÃO   Avisos, campanhas e divulgações da liga.                  |
+--------------------------------------------------------------------------------+
| © 2026 LAINES, Universidade Federal do Rio Grande do Norte                     |
```

- A primeira tela é a cena com o formulário. O painel branco corta a cena numa diagonal que se inclina para a frente, na direção da corrida.
- A pista é um plano em perspectiva, feito com CSS 3D (`perspective` e `rotateX`): raias azuis, linhas brancas, o gramado verde por dentro da raia 1 e marcas da largada escalonada. O horizonte é uma luz verde atrás da diagonal.
- As áreas ficam numa faixa própria abaixo da primeira tela, como quatro raias vistas de cima. Não são cartões: são linhas de pista, com o nome em letra de campanha e a descrição alinhada numa coluna só, para ser lida de uma vez. Os nomes seguem o mesmo escalonamento do título.

### Celular, 390×844

```
+--------------------------------+
| (emb) LAINES     FACISA, UFRN  |
|                                |
| LIGA ACADÊMICA                 |
|  ▌ INTERPROFISSIONAL DE        |   título 36 px, escalonado
|  ▌   NUTRIÇÃO ESPORTIVA        |
|   ____/  /  /  (pista, 96px) / |
|  /(gramado)/  /   /  /  /  /   |
|\______________________________ |   diagonal: o painel sobe sobre a cena
| Entrar                         |
| Use seu CPF ou e-mail.         |
| CPF ou e-mail                  |
| [____________________________] |
| Senha        Esqueci minha...  |
| [___________________ Mostrar]  |
| [           Entrar           ] |   base do botão a 715 px (medido)
|                                |
| [ícone] É atleta...?         > |
| [ícone] Professor ou prof... > |
|================================|
| A liga da FACISA/UFRN...       |
| As quatro áreas da liga        |
| ENSINO                         |
| Reuniões científicas...        |
| ...                            |
| © 2026 LAINES                  |
+--------------------------------+
```

No celular, a frase sobre a liga desce para a faixa das áreas, para o botão Entrar ficar na primeira tela. "Esqueci minha senha" sobe para a linha do rótulo "Senha", porque isso economiza uma linha inteira.

## 4. Movimento

### A entrada: parado, e depois dispara

Tudo usa só CSS, em `transform` e `opacity`, e termina em 1,95 s. Nada fica em laço.

| Tempo | O que acontece | Como |
|---|---|---|
| 0 a 0,10 s | A cena já está pintada, com céu, pista e gramado parados. O título e o painel ainda não aparecem. | Estado inicial dos quadros-chave. |
| 0,06 a 0,45 s | **Às suas marcas.** A linha de largada escalonada se desenha no chão, raia por raia. | `scaleX` de 0 a 1 em cada marca, a partir da esquerda, 220 ms cada, com 24 ms de defasagem. |
| 0,45 s | **Disparo.** | Todas as animações seguintes começam neste instante. |
| 0,45 a 1,65 s | As marcas do chão passam por baixo da câmera, que acompanha o atleta, e freiam até parar. | `translateY` da camada de marcas no plano 3D, com `cubic-bezier(.12,.8,.2,1)`: arranque explosivo e freada longa. |
| 0,45 a 0,95 s | A luz verde do horizonte acende. | `opacity` de 0,35 a 1. |
| 0,45, 0,53 e 0,61 s | As três linhas do título saem dos blocos, uma por raia, como na largada escalonada. | `translateX` de −14 vw a 0 e `skewX` de −16° a 0 (um arrasto de velocidade que assenta na itálica), mais `opacity`, 700 ms cada, com saída exponencial. |
| 0,65 a 1,30 s | O painel branco varre a tela pela diagonal, opaco, como o corte de uma vinheta de transmissão. | `translateX` de 105% a 0. |
| 0,90 a 1,35 s | O formulário assenta dentro do painel. | `opacity` e `translateX` de 24 px. |
| 0,95 a 1,45 s | A frase assenta. A marca LAINES já está na tela desde o primeiro quadro. | `opacity` e `translateX` de −12 px. |
| 1,50 a 1,95 s | **Chegada.** Um brilho atravessa o botão Entrar uma única vez, e o olhar termina na ação. | Pseudoelemento com `translateX` de −120% a 220% e `opacity`. |

Com `prefers-reduced-motion: reduce`, nenhuma animação é declarada, e o CSS em repouso é o estado final. Cada quadro-chave define só o `from`, e o preenchimento é `backwards`: ao terminar, a animação sai de cena e sobra o CSS em repouso. A captura sem movimento prova isso (seção 7).

### Microinterações, só onde a pessoa age

- **Foco no campo:** a borda vira Pista, e uma linha de raia azul e verde corre por baixo do campo, da esquerda para a direita (`scaleX`, 280 ms). O rótulo também vira Pista.
- **Mostrar senha:** o botão alterna entre "Mostrar" e "Ocultar", com `aria-pressed`.
- **Botão Entrar:** sobe 1 px e ganha sombra no hover, com o brilho passando uma vez. Ao pressionar, afunda (`scale(.98)`). Enquanto envia, mostra "Entrando" e uma barra que corre na base. A barra para quando a resposta chega, sempre antes de 5 s.
- **Erro:** o formulário dá um tranco curto na horizontal (320 ms), a mensagem aparece com `role="alert"` e os campos ficam com borda vermelha e `aria-invalid`. Com campo vazio, a mensagem diz o que falta, logo abaixo do campo.
- **Portas secundárias:** o fundo acende no hover e a seta desliza 3 px, e o foco é visível.
- **Solicitar acesso:** abre um `<dialog>` que sobe 12 px ao abrir. O conteúdo do modal atual não muda nesta proposta.

Com movimento reduzido, as microinterações mantêm a mudança de cor e de borda, que é o que informa, e perdem o deslocamento.

## 5. A única coisa memorável

**O nome da liga largando.** As três linhas do título, em itálica estreita e pesada, escalonadas como os blocos dos 400 m, disparam uma após a outra enquanto a pista passa por baixo da câmera e freia até parar diante do formulário.

## 6. Revisão do plano contra o briefing e contra os padrões

**Teste da skill:** se o pedido fosse "landing esportiva moderna com login", onde eu chegaria sem pensar? Em fundo quase preto com verde neon, foto de atleta desfocada, título gigante com uma palavra em verde, cartão de vidro com o login e três ícones com número. Onde o plano ainda se parecia com isso, eu revisei:

1. **O fundo escuro.** O primeiro rascunho usava `#0b1020`, um quase-preto tingido: o padrão 2 da skill. Troquei por Estádio `#0b2a5e`, o azul da marca escurecido, que é claramente azul, e pus a luz no horizonte em verde da marca, não em acento ácido.
2. **O cartão de vidro com desfoque (glassmorphism) sobre a cena.** É o login esportivo padrão. Troquei por um painel branco cortado na diagonal, que é o gesto de velocidade da própria página, sem `backdrop-filter`.
3. **Palavra destacada no título.** A tentação era pôr "Esportiva" em verde. Não fiz isso. O destaque é a composição inteira: o escalonamento.
4. **As áreas como quatro cartões com ícone.** Esse é o kit SaaS. Viraram quatro raias, sem caixa, sem ícone e sem número. Raia de pista tem número, mas a ordem aqui não é sequência, então numerar seria decoração.
5. **Foto de atleta.** Não existe foto própria da liga, e foto de banco seria inventar. A figura é o corredor do emblema, que já existe.
6. **Rótulo em caixa alta acima do título** ("LIGA ACADÊMICA · UFRN"). Cortado. A identificação é "LAINES" ao lado do emblema, com "FACISA, UFRN" em caixa normal, sem ponto médio.
7. **Seta "→" no texto dos botões.** Não há. As portas secundárias têm um chevron desenhado em SVG, fora do texto, porque a linha inteira é clicável e o chevron indica isso. O botão Entrar só tem a palavra.
8. **Movimento espalhado.** Não há entrada separada por seção. É uma sequência só, na direção da corrida, e a faixa das áreas não anima.

**Conferência com o briefing:**

- Dado clínico: nenhum. Não há estatística, percurso nem captura de tela interna.
- Texto das áreas: literal do sistema (tabela da seção 1).
- Identidade: emblema recortado em disco branco (o arquivo tem fundo branco quase opaco), e o azul e o verde da marca como pista e gramado.
- Movimento: 1,95 s, sem laço, só `transform` e `opacity`, com movimento reduzido idêntico ao estado final.
- Fontes: duas famílias, 55,0 KB, ou 45,1 KB com subconjunto.
- Sólidos: só o botão Entrar. As portas secundárias são linhas com contorno.

## 7. Crítica das capturas e o que mudou

Capturas, medições e vídeo gerados por `capturar.mjs`, com o Chromium do Playwright do projeto, abrindo `index.html` por `file://`. Os pares de token estão em `contraste.cjs`. As capturas de conferência (320 px, foco, erro, envio, diálogo e quadros da entrada) ficam fora desta pasta.

### Medições da última rodada

| Verificação | 1280×800 | 390×844 | 320×640 |
|---|---|---|---|
| Rolagem horizontal | não | não | não |
| Texto fora da janela ou cortado | nenhum | nenhum | nenhum |
| Alvo clicável menor que 44 px | nenhum | nenhum | nenhum |
| Base do botão Entrar | 472 px | 715 px (na primeira tela) | 717 px (abaixo da dobra de 640) |
| Ações sólidas | só "Entrar" | só "Entrar" | só "Entrar" |
| Pior contraste do texto sobre o fundo real da cena e da faixa das áreas | 5,05:1 (frase) | 4,87:1 (terceira linha do título) | 5,17:1 |
| Fontes carregadas | 56.344 bytes em 2 arquivos | idem | idem |
| Erros de console | nenhum | nenhum | nenhum |

**Fim da animação e estado sem movimento:** o par entregue, `energia-1280.png` e `energia-sem-movimento-1280.png`, é idêntico byte a byte: 0 pixel diferente de 1.024.000, medido aos 6 s. O script compara pixel a pixel, espera o compositor assentar (até 12 s) e grava exatamente o par que mediu (`fimIgualSemMovimento` no relatório do script). O resultado varia um pouco entre rodadas, por causa do momento em que o compositor refaz a rasterização: em outras, sobrou 1 pixel com diferença de 1/255, ou 856 pixels (0,08%) com até 7/255 nos rótulos do formulário quando a captura saiu cedo. Aos 2,3 s, sem esperar o compositor, a diferença era de 4,5% dos pixels, só em contornos. Em nenhum caso a diferença foi de estado, só de suavização.

**Contraste sobre degradê:** um par de tokens não prova nada sobre o céu e a luz do horizonte. O script esconde o texto, fotografa o fundo e procura, dentro de cada linha de texto, o pixel com pior contraste contra a cor da letra.

### O que vi e mudei, na ordem

1. **Rolagem horizontal de 681 px a 1280.** As linhas das raias do título passavam da borda. A primeira seção passou a cortar o excesso.
2. **Celular: o título sobre a pista,** com texto branco sobre as linhas brancas. O chão ganhou uma faixa própria de 7,5 rem abaixo do título.
3. **Desktop: gramado chapado e uma mancha turva no horizonte.** O céu ganhou uma rampa até uma linha de luz verde. O fundo da pista ganhou névoa, e o gramado, as faixas de corte da grama, que a perspectiva encurta até o horizonte.
4. **Plano de 12.000 px.** Aprofundar o plano para esconder a borda distante estourou a rasterização do Chromium, e a página renderizou quebrada. Voltei para 4.200 px, e a máscara esconde a borda.
5. **Celular: a luz do horizonte caía atrás da terceira linha do título.** Ganhou um respiro de 1,25 rem. O pior caso medido ficou em 4,87:1.
6. **Áreas: as descrições escalonavam junto com os nomes,** numa coluna torta e com um vão grande. O escalonamento ficou só no nome, que ganhou a marca de largada do título, e a descrição ficou numa coluna única.
7. **Tablet: pista rala.** A largura da raia passou a acompanhar a largura da tela.
8. **Entrada: painel semitransparente sobre a pista entre 0,7 e 1,3 s,** o que parecia barato. Virou uma varredura opaca, e o formulário assenta depois.
9. **A largada escalonada ainda se desenhava depois do disparo.** Os tempos foram ajustados.
10. **Mensagem de erro com espaços soltos** ("ou  e-mail  ."). O texto foi para um único `span`.
11. **Fim da animação diferente do estado sem movimento** (4,5% dos pixels, só contornos). Com preenchimento `both`, os elementos continuavam em camadas próprias do compositor. Passou a `backwards`, e a captura final espera o compositor refazer a rasterização. Diferença: zero.
12. **O foco rolava a primeira seção 18 px na horizontal** no celular, porque `overflow: hidden` ainda é contêiner rolável. Passou a `overflow: clip`.
13. **Ordem do Tab: "Esqueci minha senha" vinha antes do campo de senha.** Foi para depois do campo no DOM, sem sair da linha do rótulo.
14. **Vídeo com quadros brancos, quadros parciais e fonte substituta.** Passou a ser gravado num navegador próprio, com as fontes servidas da memória. O começo branco é aparado pelo conteúdo.
15. **O vídeo pulava da largada direto para o fim.** A medição mostrou que a entrada rodava a 8–11 quadros/s no Chromium sem GPU, e o custo era o plano da pista: 11 quadros/s com ele e 35–38 sem ele, enquanto máscara e sombra quase não pesavam. Reduzi o plano de 7.280 × 4.200 para 4.880 × 2.400 px a 1280, sem mudança visível: a taxa foi para 18 a 1280 e 29 a 390, sem GPU. O vídeo passou a ser gravado com GPU, que é o caso de um navegador de verdade (~50 quadros/s medidos).
16. **"Esqueci minha senha" 6 px acima do rótulo.** A margem de baixo anulava a margem negativa do alvo de 44 px. Corrigido: os centros ficaram a 0,75 px um do outro.

### O que continua fraco

- **A pista é CSS 3D, não ilustração.** De perto, os traços das raias perto do horizonte serrilham, e a névoa é um degradê simples. Um ilustrador faria melhor com SVG desenhado à mão ou uma imagem. O CSS tem a vantagem de escalar em qualquer largura sem arquivo extra.
- **O plano da pista ainda pesa.** Sem GPU, a entrada roda a 18 quadros/s a 1280, o que dá um tranco visível em máquina fraca. Não medi em celular real. Na implementação, vale trocar o plano 3D por uma imagem pré-renderizada da pista, mais uma camada 2D só com as marcas que passam, ou desligar a passagem das marcas quando o aparelho for fraco.
- **Celular: a luz do horizonte é uma faixa larga** logo abaixo do título. Na tela pequena, lê-se mais como brilho do que como estádio.
- **O logotipo em 44 a 52 px** mostra o corredor, mas o texto do anel é ilegível, como na rodada anterior.
- **O brilho que cruza o botão** reduz o contraste do rótulo por cerca de 0,2 s enquanto passa. É transitório, mas existe.
- **A 320×640, o botão Entrar fica abaixo da dobra.** O briefing pede a primeira tela do celular de 390×844, e ali ele está.
- **Não testado:** leitor de tela, zoom de 200%, orientação horizontal, Safari e Firefox (o `overflow: clip` exige Safari 16 ou mais recente e cai para `hidden` antes disso) e a página real depois de implementada.
