# Landing v2: duas direções para a primeira página do LAINES

Proposta de direção de arte. Nenhum código de produção muda nesta etapa. O usuário escolhe uma das direções, e só depois a página real é refeita.

Processo seguido: `.claude/skills/frontend-design/SKILL.md`. Primeiro fundamentar no assunto, depois planejar os tokens, revisar o plano contra o briefing e contra os padrões genéricos, construir e, por fim, criticar as capturas.

Arquivos desta pasta:

| Arquivo | O que é |
|---|---|
| `plano.md` | Este documento. |
| `direcao-a.html`, `direcao-b.html` | Mockups estáticos, autocontidos, com o conteúdo real da página. |
| `direcao-a-1280.png`, `direcao-a-390.png`, `direcao-b-1280.png`, `direcao-b-390.png` | Capturas da primeira tela em 1280×800 e 390×844, feitas com o Playwright em Node. |
| `direcao-a-390-inteira.png`, `direcao-b-390-inteira.png` | A página inteira a 390 px, para ver o que fica abaixo da primeira tela. |
| `contraste.cjs` | Calcula todos os pares de cor citados abaixo (`node docs/design/landing-v2/contraste.cjs`), com a fórmula de `scripts/test-landing-tokens.cjs`. |
| `capturar.mjs` | Gera as capturas e mede, em cada largura, rolagem horizontal, texto cortado e fontes carregadas. |

A subpasta `antes/` é de outro agente e não faz parte desta entrega.

## 1. O assunto, antes do desenho

**O que é.** O LAINES é a Liga Acadêmica Interprofissional de Nutrição Esportiva da UFRN, no campus da FACISA. O sistema cumpre dois papéis: a gestão da liga (ensino, pesquisa, extensão, comunicação) e o atendimento clínico de atletas. Nesse atendimento, alunos avaliam, montam o plano alimentar e o profissional responsável revisa.

**Quem chega e o que quer:**

| Quem | Quer | Destino hoje |
|---|---|---|
| Aluno, professor, nutricionista supervisor, coordenação | Entrar no sistema | Formulário de login |
| Atleta | Ser atendido | `/inscricao` (lista de espera) |
| Professor ou profissional de fora (CRN, CREFITO, CRP) | Uma conta | Modal "Solicitar acesso" (os cargos aceitos são professor e profissional) |

**O trabalho da página** é deixar a pessoa entrar. Todo o resto é secundário e não pode empurrar o formulário para fora da primeira tela no celular.

**O que o próprio sistema diz desse mundo.** Estes são os materiais que usei, todos existentes, nenhum inventado:

- O **emblema**: um corredor em azul-violeta escuro sobre um disco dividido em azul e verde, dentro de um anel. Amostrei os pixels do `LogoLaines.webp`. O escuro real do emblema é `#2d2d46`, e não o `#0c1f30` que a página atual usa como texto. O arquivo é **opaco, com fundo branco quadrado**, então só pode ficar sobre branco ou recortado em círculo.
- O **protocolo de avaliação** (`src/constants/evaluationRegistry.js`): triagem (anamnese, avaliação clínica, socioeconômica), composição corporal (perímetros, dobras, bioimpedância, imagem), demanda e desempenho (gasto energético, carga de treino), rotina alimentar (avaliação alimentar, hidratação), multiprofissional (psicologia, fisioterapia) e conduta.
- O **caminho do plano**: avaliação, plano alimentar, revisão profissional e plano publicado no portal do atleta, com o PDF da mesma versão (UPD-07 e UPD-10, concluídos).
- Os **números públicos** de `/public/stats`, com o significado exato do servidor (`server/src/public/public.service.ts`): `atletas` são pacientes com status `ativo`, `avaliacoes` são avaliações com status `finalizada` e `membros` são usuários com status `ativo`.

### O que a página atual tem e nenhuma das duas direções mantém

Tirei da leitura do código e das capturas em `tmp/landing-visual/`:

1. **O carrossel de capturas.** A 1280 px, o texto dentro das imagens fica com 8 a 9 px e ninguém lê. As imagens mostram telas internas de administração e trazem nomes de fixture numa página pública ("Paciente CI Vinculado", "Admin E2E", "Projeto CI Analytics", visíveis em `desktop-1280-pagina.png`). A 320 px, a legenda "Protocolo multiprofissional integrado por etapas" sai cortada pela direita (`mobile-320-pagina.png`).
2. **O selo "Sistema operacional".** É texto fixo em `LoginPanel.jsx`, não uma verificação de saúde. Ele diz que o sistema está no ar mesmo quando não está, e isso é um sinal inventado.
3. **Os números em estado de carregamento eterno.** `LoginPage.jsx` faz `.catch(() => {})`. Se `/public/stats` falhar, o esqueleto "Carregando" fica para sempre, e erro fica indistinguível de espera.
4. **"Membros" pode incluir atletas.** Atleta tem papel próprio de usuário (`src/constants/roles.js`), e `membros` conta todos os usuários ativos. O rótulo "membros" pode estar somando atletas com conta. Não resolvi isso aqui (é do servidor). Os mockups mantêm o rótulo atual, e o ponto fica registrado para quem implementar.
5. **"Avaliações" são só as finalizadas.** O rótulo atual omite isso. Os mockups dizem "avaliações finalizadas".
6. **Padrões de página gerada que a skill lista:** rótulo em caixa alta acima do título ("ACESSO AO SISTEMA"), rótulos de campo em caixa alta ("CPF OU E-MAIL"), meta-texto com ponto médio ("… · UFRN"), seta "→" no fim do botão, fileira de número grande com rótulo pequeno, faixa em gradiente no topo do painel e pílulas arredondadas iguais ("Avaliações clínicas", "Gestão de atletas"…) que não levam a lugar nenhum.

### O que fica nas duas direções (o que é fixo e o que já foi conquistado)

- O logotipo e o par **azul `#2560a8`** e **verde `#3d8c2a`**.
- A separação entre o verde de marca (`#3d8c2a`, só gráfico, 4,21:1 sobre branco) e o verde de texto e botão (`#2d7a1a`, 5,37:1 com branco), definida pela rodada anterior.
- O foco visível em duas camadas: 2 px de branco e um anel azul sólido `#2560a8` (6,33:1 contra o branco). Nos mockups é um `outline` de 3 px com afastamento de 2 px, porque todo controle fica sobre fundo branco. Na implementação vale o token `--lt-focus-ring`, que isola o anel de qualquer fundo.
- Alvo de 44 px nos controles, rótulo sempre visível acima do campo, erro com `role="alert"` e o par de erro `#b91c1c` sobre `#fef2f2`.
- As três portas de entrada, com os mesmos destinos: login, `/inscricao` e o modal "Solicitar acesso". Os modais de solicitação e de recuperação não mudam de conteúdo nesta proposta, só herdam os tokens da direção escolhida.
- Os números vêm de `/public/stats`. Nada de métrica, depoimento, selo ou parceiro novo.

## 2. Direção A: a curva da pista

**Ideia.** A página abre com a curva de uma pista de atletismo vista de cima: raias azuis separadas por linhas brancas, gramado verde por dentro e o emblema da liga no centro da curva, como um medalhão.

**Por que o hero mostra isso.** A pista é o chão dos atletas que a liga atende, e o emblema já desenha um corredor sobre um disco azul e verde. Vista de cima, uma pista azul com o campo verde é o par da liga transformado em lugar, em vez de gradiente. A identidade fica mais forte sem ser trocada: é o emblema em escala de página.

### Paleta

| Nome | Hex | Papel |
|---|---|---|
| Tinta | `#262947` | Texto principal. É o azul-violeta do corredor do emblema (`#2d2d46`), um pouco mais escuro. |
| Apoio | `#555c78` | Texto secundário, dica do campo, rodapé. |
| Pista | `#2560a8` | As raias, os links e o anel de foco. Azul da marca. |
| Gramado | `#3d8c2a` | O campo interno da curva. Verde da marca, **só gráfico**, nunca texto. |
| Largada | `#2d7a1a` | Fundo do botão Entrar, o único sólido da página. |
| Cal | `#ffffff` | Fundo da página e linhas das raias. |

Neutro de limite: borda de campo `#7a8098`.

| Par | Contraste | Mínimo |
|---|---|---|
| Tinta sobre cal | 14,09:1 | 4,5:1 |
| Apoio sobre cal | 6,59:1 | 4,5:1 |
| Pista sobre cal (links) | 6,33:1 | 4,5:1 |
| Cal sobre largada (botão) | 5,37:1 | 4,5:1 |
| Erro `#b91c1c` sobre `#fef2f2` | 5,91:1 | 4,5:1 |
| Borda do campo sobre cal | 3,91:1 | 3:1 (gráfico) |
| Linha da raia sobre pista | 6,33:1 | 3:1 (gráfico) |
| Gramado contra a página | 4,21:1 | 3:1 (gráfico) |

A pista e o gramado medem só 1,50:1 entre si. Por isso nunca se tocam: uma linha branca de raia sempre os separa, como numa pista de verdade. Nenhum texto fica sobre o gramado nem sobre as raias.

### Tipografia

**Sofia Sans** (Lettersoup, Botio Nikoltchev) em duas larguras da mesma família:

- **Sofia Sans Extra Condensed 800** só no título, o nome da liga em quatro linhas. É a letra estreita e pesada de placar e número de camisa. O nome longo, "Liga Acadêmica Interprofissional de Nutrição Esportiva", vira um bloco compacto em vez de uma frase que atravessa a tela.
- **Sofia Sans 400 a 700** em todo o resto: formulário, texto e links. Na largura normal, legível a 16 px.

Escala: 13, 16, 17 e 28 px no texto, e o título de 40 px (celular) a 68 px (desktop), com entrelinha 0,95, que a letra estreita aguenta. O nome sempre quebra nas mesmas três linhas: "Liga Acadêmica / Interprofissional de / Nutrição Esportiva". Corpo com entrelinha 1,5 e linhas com menos de 70 caracteres.

**Custo medido** (subconjunto latino, arquivos reais do Google Fonts): Sofia Sans 400–700 variável pesa 39,4 KB, e Extra Condensed 800, 15,4 KB, somando **54,8 KB em dois arquivos**. A Outfit atual pesa 31,5 KB em um arquivo, então a diferença é de **+23,3 KB**. Existe uma otimização possível: o título é texto fixo, e com o parâmetro `text=` do Google Fonts o Extra Condensed cai para **4,1 KB**, com total de 43,5 KB (+12 KB). O custo é que qualquer mudança no texto do título exige atualizar o parâmetro. **Por que vale:** a largura estreita é o que faz o nome da liga caber como bloco e dar peso de esporte à página. A alternativa de uma família só com eixo de largura, a Archivo, pesa 88,0 KB, e foi descartada por isso (ver revisão).

### Layout

Desktop, 1280×800. Duas regiões e nenhum cartão. A curva é um gráfico delimitado dentro da coluna da esquerda, não uma metade colorida. O formulário fica direto sobre o branco. Tudo alinhado à esquerda.

```
+------------------------------------------------------------------------------+
|                                                    |                         |
|  Liga Acadêmica                                    |  Entrar                 |
|  Interprofissional de         (Extra Cond. 800,    |  Use seu CPF, só os     |
|  Nutrição Esportiva            68 px, tinta)       |  números, ou seu e-mail.|
|  FACISA, Universidade Federal do Rio Grande do     |                         |
|  Norte                                             |  CPF ou e-mail          |
|                                                    |  [_____________________]|
|  Alunos atendem atletas com supervisão             |  Senha                  |
|  profissional: avaliação, plano alimentar e        |  [_____________|Mostrar]|
|  revisão. Hoje são 48 atletas ativos, 312          |  [       Entrar        ]|
|  avaliações finalizadas e 37 membros ativos.       |  Esqueci minha senha    |
|                                                    |  ---------------------  |
|  =========================================.        |  É atleta e quer ser    |
|  ====== (8 raias azuis, linhas brancas) ==== .     |  atendido pela liga?    |
|  =========================================  \ \    |  Entrar na lista de     |
|  ---------------------------------------.  | | |   |  espera                 |
|  (gramado verde)                         \ | | |   |  Professor ou profis-   |
|   (medalhão)                              || | |   |  sional sem conta?      |
|                                           || | |   |  Solicitar acesso       |
+------------------------------------------------------------------------------+
   as retas saem pela borda esquerda; a dobra fica voltada para o formulário
```

A curva é uma só forma CSS: o gramado é um retângulo com o canto superior direito arredondado, e as raias são sombras sólidas concêntricas (`box-shadow` com `spread`), que acompanham o raio. Não há imagem nem SVG, e a curva escala com a coluna. As retas saem pela borda esquerda da página, então todo corte acontece na borda da tela, e a dobra se volta para o formulário.

Celular, 390×844. O título e uma faixa baixa da curva vêm primeiro, o formulário logo em seguida, com o botão ainda na primeira tela. O texto sobre a liga e os números descem para depois das portas secundárias.

```
+--------------------------------+
| Liga Acadêmica                 |
| Interprofissional de           |
| Nutrição Esportiva   (40 px)   |
| FACISA, Universidade Federal   |
| do Rio Grande do Norte         |
| ==========================.    |
| ===(faixa da curva, 148px)= \  |
| (medalhão) (gramado)       ||  |
|--------------------------------|
| Entrar                         |
| Use seu CPF...                 |
| CPF ou e-mail                  |
| [____________________________] |
| Senha                          |
| [___________________|Mostrar]  |
| [           Entrar           ] |
| Esqueci minha senha            |
|                                |
| É atleta e quer ser atendido?  |
| Entrar na lista de espera      |
| Professor ou profissional sem  |
| conta? Solicitar acesso        |
|--------------------------------|
| Alunos atendem atletas...      |
| Hoje são 48 atletas ativos...  |
| © 2026 LAINES                  |
+--------------------------------+
```

### Princípios

1. **A pista é o único gesto grande.** Todo o resto é quieto: branco, tinta e um único botão sólido.
2. **Nada de texto sobre a pista nem sobre o gramado.** Eles são lugar, não fundo de texto.
3. **O emblema aparece uma vez**, no centro da curva, recortado em círculo sobre o verde, o que resolve o fundo branco opaco do arquivo.
4. **Um movimento só:** a curva se revela uma vez ao abrir, a partir da dobra (0,9 s, `clip-path`). Com `prefers-reduced-motion`, ela já aparece pronta. É o único movimento que não vem de ação da pessoa, e pode ser cortado sem perda. O estado final da animação foi conferido por captura e é idêntico ao estado sem movimento.

### A única coisa memorável

A curva da pista com o emblema no centro: o disco azul e verde do logotipo ampliado até virar o chão da página.

## 3. Direção B: o percurso

**Ideia.** A página abre com o caminho real de um atendimento na liga, da inscrição do atleta ao plano entregue, composto em letra grande como uma ficha de protocolo. Ao lado de cada etapa aparece quem a executa.

**Por que o hero mostra isso.** É o que a liga faz, e serve às três pessoas que chegam: o membro reconhece a rotina de trabalho, o atleta vê o que acontece depois da lista de espera e o profissional de fora vê onde entra a supervisão. É uma sequência de verdade, então numerar as etapas informa em vez de decorar. Cada etapa sai de um estado que o sistema já tem: inscrição pública, triagem, avaliação, plano, revisão e publicação no portal. As palavras das etapas são uma síntese minha a partir do sistema, e **a coordenação precisa validá-las antes da produção**.

As seis etapas, com a origem de cada uma:

| # | Etapa | Quem faz | O que acontece | De onde vem |
|---|---|---|---|---|
| 1 | Inscrição | Atleta | Preenche o formulário público e entra na lista de espera. | `/inscricao`, status "Triagem Publica" |
| 2 | Triagem | Aluno | Anamnese, avaliação clínica e socioeconômica. | `evaluationRegistry.js`, etapa `triagem` |
| 3 | Avaliação | Aluno | Composição corporal, rotina alimentar, demanda de treino, psicologia e fisioterapia. | Etapas `composicao_corporal`, `rotina_alimentar`, `demanda_performance`, `multiprofissional` |
| 4 | Plano alimentar | Aluno | Monta o plano a partir da avaliação. | Briefing; prescrição (UPD-06) |
| 5 | Revisão | Profissional responsável | Revisa e aprova o plano. | UPD-07: o aluno não publica como profissional |
| 6 | Entrega | Atleta | Recebe o plano aprovado no portal, com o PDF da mesma versão. | UPD-10 |

### Paleta

| Nome | Hex | Papel |
|---|---|---|
| Tinta | `#262947` | Texto principal e nomes das etapas. O mesmo azul-violeta do emblema. |
| Apoio | `#555c78` | Descrição das etapas, dica do campo e rodapé. |
| Ficha | `#f2f7ef` | Fundo da coluna do percurso, um papel levemente verde (frio, não creme). |
| Gramado | `#3d8c2a` | A linha contínua do percurso. Verde da marca, só gráfico. |
| Verde de ação | `#2d7a1a` | Botão Entrar, marcadores numerados e "quem faz". |
| Azul | `#2560a8` | Links e anel de foco. |

O fundo da coluna do formulário é branco. Neutro de limite: borda de campo `#7a8098`.

| Par | Contraste | Mínimo |
|---|---|---|
| Tinta sobre branco | 14,09:1 | 4,5:1 |
| Tinta sobre ficha | 12,97:1 | 4,5:1 |
| Apoio sobre branco | 6,59:1 | 4,5:1 |
| Apoio sobre ficha | 6,06:1 | 4,5:1 |
| Verde de ação sobre ficha ("quem faz") | 4,94:1 | 4,5:1 |
| Azul sobre branco (links) | 6,33:1 | 4,5:1 |
| Branco sobre verde de ação (botão, número da etapa) | 5,37:1 | 4,5:1 |
| Erro `#b91c1c` sobre `#fef2f2` | 5,91:1 | 4,5:1 |
| Borda do campo sobre branco | 3,91:1 | 3:1 (gráfico) |
| Linha do percurso sobre ficha | 3,88:1 | 3:1 (gráfico) |

Nesta direção **o verde domina e o azul recua** para links e foco. É o rebalanceamento que o briefing permite, e é o inverso da direção A.

### Tipografia

**Atkinson Hyperlegible Next** (Braille Institute, 2025), uma família só, pesos 400 a 800 num arquivo variável.

- Foi desenhada para diferenciar caracteres parecidos, como I, l e 1 ou 0 e O. É exatamente o problema de quem digita CPF e senha, e o de quem lê a página no celular, na beira do campo. A escolha responde ao trabalho principal da página, e não ao gosto.
- Tem personalidade própria (terminais inclinados, formas abertas) sem ser a Inter ou a Outfit de qualquer painel.

Escala (terça maior, cerca de 1,25): 14, 17, 18, 21, 27 e 34 px. Os nomes das etapas usam 34 px em peso 700 no desktop e 27 px no celular, e são o elemento tipográfico ativo da página. O corpo fica em 17 px, porque letra de alta legibilidade pede corpo um pouco maior, com entrelinha 1,5. Os campos usam 18 px.

**Custo medido:** 33,2 KB em um arquivo, contra 31,5 KB da Outfit atual, **+1,7 KB**. Troca praticamente neutra.

### Layout

Desktop, 1280×800. Timbre no topo, como o cabeçalho dos documentos da liga. Abaixo, o acesso à esquerda sobre branco e o percurso à direita sobre a ficha, que vai até a borda da tela. O acesso fica à esquerda, na posição de leitura, porque entrar é o trabalho da página. Assim, a ordem do DOM é a ordem visual em todas as larguras. Alinhamento à esquerda.

```
+------------------------------------------------------------------------------+
| (emblema) Liga Acadêmica Interprofissional de Nutrição Esportiva             |
|           FACISA, Universidade Federal do Rio Grande do Norte                |
+------------------------------+-----------------------------------------------+
|                              | (ficha verde-clara)                           |
|  Entrar                      | Da inscrição ao plano revisado, o atendimento |
|  Use seu CPF, só os números, | de cada atleta passa por seis etapas.         |
|  ou seu e-mail de acesso.    |                                               |
|                              |  (1)  Inscrição                               |
|  CPF ou e-mail               |   |   Atleta: preenche o formulário público…  |
|  [__________________________]|  (2)  Triagem                                 |
|  Senha                       |   |   Aluno: anamnese, avaliação clínica…     |
|  [__________________|Mostrar]|  (3)  Avaliação                               |
|  [          Entrar          ]|   |   Aluno: composição corporal, rotina…     |
|  Esqueci minha senha         |  (4)  Plano alimentar                         |
|  --------------------------  |   |   Aluno: monta o plano…                   |
|  É atleta e quer ser         |  (5)  Revisão                                 |
|  atendido pela liga?         |   |   Profissional responsável: revisa…       |
|  Entrar na lista de espera   |  (6)  Entrega                                 |
|  Professor ou profissional   |       Atleta: recebe o plano no portal…       |
|  sem conta? Solicitar acesso |                                               |
|                              | Hoje são 48 atletas ativos, 312 avaliações    |
|  © 2026 LAINES               | finalizadas e 37 membros ativos.              |
+------------------------------+-----------------------------------------------+
```

Celular, 390×844. Timbre compacto e o formulário em seguida, com o botão na primeira tela. O percurso vem depois das portas secundárias.

```
+--------------------------------+
| (emb.) Liga Acadêmica          |
|        Interprofissional de    |
|        Nutrição Esportiva      |
|        FACISA, UFRN            |
|--------------------------------|
| Entrar                         |
| Use seu CPF...                 |
| CPF ou e-mail                  |
| [____________________________] |
| Senha                          |
| [___________________|Mostrar]  |
| [           Entrar           ] |
| Esqueci minha senha            |
| É atleta...? Entrar na lista…  |
| Professor...? Solicitar acesso |
|================================|
| (ficha) Da inscrição ao plano  |
| revisado... seis etapas.       |
|  (1) Inscrição                 |
|   |  Atleta: ...               |
|  ...                           |
|  (6) Entrega                   |
| Hoje são 48 atletas ativos...  |
| © 2026 LAINES                  |
+--------------------------------+
```

### Princípios

1. **O conteúdo é a imagem.** Não há gráfico decorativo: o percurso, composto em letra grande, é o que dá corpo à página.
2. **A estrutura só aparece onde informa.** Número porque é sequência, linha contínua porque é caminho, "quem faz" porque as três pessoas que chegam à página são as mesmas que aparecem nas etapas.
3. **Nenhum movimento.** A página não anima nada sozinha. A sobriedade faz parte do caráter clínico.
4. **Legibilidade antes de estilo:** corpo de 17 px, campos de 18 px e letra desenhada para não confundir caracteres.

### A única coisa memorável

O protocolo de atendimento como título da página: seis etapas em letra grande presas a uma linha verde contínua, da inscrição à entrega.

## 4. Revisão do plano contra o briefing e contra os padrões

Fiz o teste da skill: se o pedido fosse "página de login de um sistema clínico universitário de nutrição esportiva", onde eu chegaria sem pensar? Numa tela dividida, com painel em gradiente azul e verde à esquerda, logotipo, título grande, fileira de números e um cartão branco com sombra à direita. É, quase exatamente, a página atual. Cada mudança abaixo se afasta disso.

**O que mudei no plano e por quê:**

1. **A: a metade azul virou um gráfico delimitado.** A primeira versão da direção A pintava a coluna esquerda inteira de azul, com as raias atravessando e o título em branco por cima. Troquei por três motivos. Linhas de raia cruzando o título prejudicam a leitura. Meia tela azul lê como página de campanha, e o briefing diz que a página não é isso. E era o mesmo "painel colorido à esquerda" do padrão, só que com listras. Agora a página é branca, e a curva é uma forma com borda, como o disco do emblema.
2. **A: a Archivo saiu, a Sofia Sans entrou.** A ideia de "uma família em duas larguras" começou com a Archivo, que tem eixo de largura. Medi o arquivo: 88,0 KB, quase três vezes a Outfit. A Sofia Sans entrega a mesma ideia com a largura normal e a Extra Condensed da mesma família: 54,8 KB, ou 43,5 KB com o título subconjuntado.
3. **B: cortei a régua dupla verde e azul sob o timbre.** Era a faixa em gradiente do painel atual com outra roupa: decoração de modelo, não informação.
4. **B: o link do atleta saiu da etapa 1.** Pensei em pôr "Entrar na lista de espera" dentro da etapa de inscrição. No celular, o percurso fica abaixo do formulário, e o atleta teria de rolar por seis etapas para achar a porta dele. O link fica na região de acesso, um por destino.
5. **B: descartei o diagrama em raias (swimlane)**, com atleta, aluno e profissional em linhas e etapas em colunas. Informa bem no desktop, mas vira uma tabela ilegível a 320 px.
6. **As duas: os números viraram frase.** "Hoje são 48 atletas ativos, 312 avaliações finalizadas e 37 membros ativos." A frase substitui a fileira de número grande com rótulo pequeno. Os rótulos dizem exatamente o que o servidor conta. Se `/public/stats` falhar, a frase inteira some, sem zero e sem esqueleto eterno. Enquanto carrega, o espaço fica reservado e vazio.
7. **As duas: o carrossel, as pílulas e o selo "Sistema operacional" saíram** (motivos na seção 1).
8. **As duas: "Acesso ao sistema" + "Entrar na plataforma" + "Entrar agora" viraram "Entrar" + "Entrar".** O título da região e o botão usam o mesmo verbo. "Solicitar acesso institucional" virou "Solicitar acesso", igual ao título do modal que ele abre.
9. **As duas: "Mostrar" por extenso no lugar do ícone de olho**, com `aria-pressed`. Não depende de ícone para ser entendido.

**Conferência item a item com a lista da skill:**

| Padrão | A | B |
|---|---|---|
| Fundo creme, serifa de alto contraste, acento terracota | Não: branco, sem serifa, azul e verde da marca | Não: a ficha é verde fria (`#f2f7ef`), não creme |
| Fundo quase preto com um acento ácido | Não | Não |
| Layout de jornal: fios finos, raio zero, colunas densas | Não | Risco, por ser uma "ficha". Contido: sem grade de fios, sem colunas de texto, linha grossa só onde é caminho |
| Kit de cartões SaaS iguais, mesma sombra, gradiente | Não há cartão. O formulário fica sobre o branco | Não há cartão. Duas superfícies planas |
| Rótulo em caixa alta acima de título | Não. Rótulos de campo em caixa normal | Não |
| Meta-texto com ponto médio | Não. "FACISA, Universidade Federal do Rio Grande do Norte" | Não |
| Quase preto tingido no lugar de preto | A tinta é o azul-violeta do emblema, escolhido por identidade | Idem |
| Monoespaçada em rótulo de dado | Não | Não |
| "→" no fim de botão ou link | Não | Não |
| Número grande com rótulo pequeno | Não, virou frase | Não, virou frase |
| Palavra destacada no título | Não | Não |
| Numeração 01/02/03 sem sequência | Não há numeração | Numeração só no percurso, que é sequência |
| Entrada com fade e subida em cada seção | Não. Um único movimento: a curva se revela uma vez | Nenhum movimento |

**Contra o que o briefing fixa:**

- Identidade: o logotipo aparece inteiro e sem distorção nas duas. O par `#2560a8` e `#3d8c2a` está presente nas duas, com pesos diferentes (A: azul e verde em equilíbrio, como no disco do emblema; B: verde domina).
- Contraste: todos os pares de texto ≥ 4,5:1, verificados por `contraste.cjs`.
- Foco visível, `prefers-reduced-motion`, 320 px sem corte e uma ação primária por região: verificados nas capturas (seção 5).
- Nada inventado: todo texto vem do sistema ou do briefing. Os números dos mockups são exemplos, marcados como tal no código.
- Custo: A, +23,3 KB (ou +12 KB com subconjunto); B, +1,7 KB. Medidos, não estimados.

## 5. Crítica das capturas

Capturas e medições feitas por `capturar.mjs`, com o Chromium do Playwright do projeto, abrindo os arquivos por `file://` e emulando `prefers-reduced-motion: reduce`. Olhei cada captura e corrigi o mockup antes de entregar. As capturas de conferência (320 px, foco no campo, foco no botão, erro) ficaram fora desta pasta, que guarda só o que foi pedido.

**Medições da última rodada:**

| Verificação | 1280×800 | 390×844 | 320×700 |
|---|---|---|---|
| Rolagem horizontal | não | não | não |
| Texto fora da janela ou cortado (medido elemento a elemento) | nenhum | nenhum | nenhum |
| Altura da página | A: 800, B: 800 (cabe numa tela) | A: 1185, B: 1728 | A: 1228, B: 1852 |
| Base do botão Entrar | A: 398, B: 469 | A: 752, B: 519 (dentro dos 844) | A: 752, B: 542 |
| Botões sólidos na página | só "Entrar" | só "Entrar" | só "Entrar" |
| Fontes carregadas | A: Sofia Sans e Extra Condensed, 56.144 bytes; B: Atkinson Hyperlegible Next, 33.996 bytes | idem | idem |
| Erros de console | nenhum | nenhum | nenhum |

Os bytes de fonte medidos no navegador batem com a medição direta no Google Fonts (seções 2 e 3).

**O que vi e mudei, na ordem:**

1. **A, primeira captura:** a reta terminava num corte vertical duro no meio da página, colado à coluna do formulário, e parecia imagem recortada. **Espelhei a curva:** a dobra ficou voltada para o formulário e as retas saem pela borda esquerda da tela. Assim, todo corte acontece na borda.
2. **A:** "FACISA, Universidade Federal do Rio Grande do Norte." abria o parágrafo como frase solta. **Virou a linha de identificação sob o título.**
3. **A, 320 px:** a dica quebrava em "e-/mail". **"e-mail" ficou inquebrável** (vale também para B).
4. **A, 390 px:** o botão Entrar ficou a 794 px, no limite da primeira tela, e o medalhão saía 5 px cortado pela base da faixa. **Reduzi o respiro do topo e a faixa, e ancorei o medalhão pela base.** O botão subiu para 752 px, e o medalhão não corta em nenhuma altura de janela.
5. **A, 1280×800:** 9 px de rolagem vertical. **A altura mínima da curva caiu de 300 para 240 px**, e a página passou a caber em 800.
6. **A, animação:** conferi por captura sem movimento reduzido que o estado final da revelação é idêntico ao estado estático.
7. **B, primeira captura:** 826 px de altura a 1280×800, com a frase dos números cortada na borda inferior, e a frase de abertura em três linhas por um limite de largura estreito. **Alarguei a abertura** (duas linhas) **e apertei o espaço entre etapas.** Agora cabe em 800.
8. **B, 390 px:** a instituição e o rodapé deixavam "Norte" sozinho numa linha. **Quebra equilibrada** (`text-wrap: balance`).
9. **Foco e erro, nas duas:** o anel azul aparece no campo e no botão, e a mensagem de erro aparece logo abaixo do botão, em `role="alert"`, com contraste de 5,91:1. Com o erro visível, a coluna do formulário de B cresce e a página rola alguns pixels a 1280×800. Nada fica inacessível.

**O que continua fraco:**

- **B no celular:** a primeira tela é o timbre pequeno e o formulário, bem resolvida para entrar, mas sem nada memorável. O percurso só aparece depois da rolagem. É o preço de pôr a tarefa primeiro.
- **A no celular:** o medalhão de 76 px mostra o emblema, mas o texto do anel do logotipo fica ilegível nesse tamanho. O logotipo não foi desenhado para ser lido tão pequeno, e isso vale para qualquer uso dele abaixo de uns 120 px.
- **Não testado:** leitor de tela, zoom de 200%, orientação horizontal no celular, Safari e Firefox. Os mockups são HTML estático. As capturas não substituem a verificação da página real depois de implementada.
- **Semântica provisória nos mockups:** o `h1` de A e de B fica fora do `main`, porque a grade precisa de filhos diretos. Na implementação, o marco `main` deve envolver título e acesso.

## 6. Recomendação

**Recomendo a direção B, o percurso.**

- **Responde melhor ao briefing.** A página é a porta de um sistema clínico e acadêmico, não de campanha. B mostra o trabalho. A mostra o esporte. As duas são honestas, mas só B diz ao atleta o que acontece depois da lista de espera e diz ao profissional de fora onde a supervisão entra.
- **A escolha tipográfica serve à tarefa principal.** Uma letra feita para não confundir 1, l e I, ou 0 e O, está na página cujo trabalho é digitar CPF e senha.
- **Custa quase nada:** +1,7 KB de fonte, nenhum gráfico e nenhum movimento.
- **Envelhece melhor.** A curva de A é memorável no primeiro acesso e repetitiva no centésimo, e a maior parte de quem chega é membro, que entra todo dia.
- **Põe a tarefa na posição de leitura.** No desktop, o formulário fica à esquerda, e a ordem do DOM coincide com a visual em todas as larguras.

O ponto a favor de A é real: ela é mais reconhecível à distância e dá à liga uma imagem própria, que B não tem. Se a coordenação quiser a página também como cartão de visita da liga (divulgação, eventos), A cumpre melhor esse papel.

O ponto fraco de B é o celular: a primeira tela não tem nada memorável (seção 5). Não recomendo misturar as duas direções, por exemplo com a curva de A como faixa no topo de B. A skill pede para gastar a ousadia num lugar só, e a mistura divide a página entre dois assuntos.

Condição para B ir à produção: a coordenação valida o texto das seis etapas.

---

## Decisão do usuário (2026-09-24): as duas direções foram recusadas

- **Leitura do usuário:** as duas ficaram amadoras; o pedido é **modernizar**.
- **Dado clínico não entra na página pública.** As duas exibiam atletas ativos e avaliações finalizadas, e a B detalhava o percurso clínico. O briefing desta rodada deveria ter vetado isso; não vetou.
- **Diagnóstico do orquestrador:** a skill `frontend-design` foi seguida à risca na recusa aos "defaults" (sem cartões, sem profundidade, links sublinhados, nenhum movimento). O resultado ficou editorial e plano, e para o cliente isso leu como inacabado. A própria skill diz que as palavras do cliente vencem — e o cliente pediu moderno.
- Mantido desta rodada: a crítica aos vícios de texto (rótulos em caixa alta, seta nos botões, meta-texto com ponto médio) e os achados sobre a página atual.

## Rodada A2 — decisão (25/09/2026)

Duas leituras da direção A foram entregues como mockup: `a2-pista/` (pista vista de cima, áreas na primeira tela) e `a2-energia/` (estádio em perspectiva, título em largada escalonada, painel em diagonal). O orquestrador conferiu as capturas e os quadros da entrada das duas antes de apresentá-las.

**Escolha do usuário: `a2-energia/` — "Energia e velocidade".** A implementação no React segue [`docs/implementacao/landing-v2/change-intent.md`](../../implementacao/landing-v2/change-intent.md). O que o próprio mockup apontou como fraco (peso do plano 3D sem GPU, "Entrar" abaixo da dobra a 320×640, rodapé com FACISA por extenso sem fonte no sistema) entra como critério da implementação, não como pendência.
