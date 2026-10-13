# Primeira página: direção "Energia e velocidade"

O usuário pediu para modernizar a primeira página, com animação, referência ao esporte e sem dado clínico, mostrando as áreas da liga. Entre duas leituras da direção A, escolheu `docs/design/landing-v2/a2-energia/`. O escopo, os invariantes e a reversão estão em [change-intent.md](change-intent.md).

## O que mudou para quem usa

| Antes | Agora |
|---|---|
| "Laines App — Sistema de gestão clínico-educacional", números de atletas, avaliações e membros, pílulas "Avaliações clínicas" e um carrossel de telas internas. | Estádio à noite, pista em perspectiva e o nome da liga em largada escalonada. Nenhum número, nenhuma captura interna e nenhum termo clínico. |
| Painel "Entrar na plataforma", com botão "Entrar agora" e o chip "Sistema operacional" fixo no código. | Painel branco cortado na diagonal: "Entrar", os dois campos, "Mostrar", "Esqueci minha senha" e duas portas ("Entrar na lista de espera" e "Solicitar acesso"). |
| Campo vazio barrado pela validação nativa do navegador. | Mensagem abaixo do campo, foco no primeiro campo vazio e um tranco curto. O erro do servidor continua em `.landing-error`, com o mesmo texto. |
| Não havia. | As quatro áreas da liga (Ensino, Pesquisa, Extensão, Comunicação), com o texto das próprias telas do sistema. |
| Entrada com framer-motion em cada bloco. | Uma entrada de cerca de 2 s, só em CSS, na primeira visita da sessão. Não toca em `/recuperar-senha` nem com movimento reduzido. |

## Como foi feito

1. **Contrato antes dos agentes,** feito pelo orquestrador:
   - tokens novos (fonte, cores da cena, degradê do botão, borda do campo, relógio da entrada), com os pares acrescentados a `test-landing-tokens.cjs`;
   - `LoginPage.jsx` com a composição nova;
   - a mudança de `.field-shell` para `landing-modais.css`, porque o modal de recuperação a usa;
   - a cópia da versão anterior em `tmp/landing-v1/`.
2. **Três agentes em paralelo,** com arquivos disjuntos: A fez a cena, a marca, o título e a moldura do painel; B, o formulário; C, as áreas, o rodapé e `test-landing-conteudo.cjs`. Os três travaram uma vez por falha do serviço e foram retomados do ponto gravado.
3. **Verificação integrada em navegador** (`tmp/landing-v2/verificar.mjs`, com API sintética), em cinco rodadas. Cada uma encontrou o que a anterior não media.
4. **Revisão independente** (seção abaixo).

## Defeitos encontrados no caminho

1. **O título da página estava invisível.** Nenhum teste estático pegou isso; só a captura. `src/index.css` pinta todo `h1` com um degradê azul-escuro recortado no texto, e `color: white` não desfaz o recorte. Corrigido no `.lp-titulo`.
2. **O título das áreas estava a 1,09:1 e em Poppins.** A causa são as regras globais `h2`/`h3` de cor e `h1…h6` de fonte. O agente C achou a cor pela amostragem de pixels, e o orquestrador achou a fonte pela lista de famílias em uso.
3. **A porta "Solicitar acesso" passava da borda a 320 px.** Ela é um `<button>`, e `button { white-space: nowrap }` global impedia a quebra. A porta vizinha é um `<a>` e não tinha o problema.
4. **A compressão para caber o "Entrar" a 320×640 jogava o título sobre a luz do horizonte.** O horizonte estava fixo em 7,5rem enquanto o chão encolhia para 4rem. Agora ele segue `--lp-chao-altura`. O limiar da compressão caiu de 760 para 700 px de altura: a 360×740 a página cabe sem comprimir.
5. **Nenhum agente conseguia abrir a página no navegador.** `tmp/` tinha cerca de 500 MB de ensaios de release e cópias de banco, fora do `.gitignore`, e a varredura de classes do Tailwind v4 fazia o Vite levar mais de 3 minutos para responder. Com três agentes subindo servidores ao mesmo tempo, nenhum terminava. `tmp/` entrou no `.gitignore`, e o build caiu para cerca de 23 s.

## Evidência

| Verificação | Resultado |
|---|---|
| `npm run test:ui` | Todos passam, inclusive contraste (27), modais (4), isolamento (2), cascata (3) e conteúdo (6, novo). |
| `npm run lint` | 0 erros. Os 8 avisos são anteriores e ficam fora da landing. |
| `npm run build` | Passa. O CSS da landing tem 28,6 kB, e o `@import` das fontes fica no topo do arquivo gerado. |
| Rolagem horizontal e texto cortado (1280, 768, 390, 360, 320) | Nenhum. O texto é medido pelo retângulo do próprio texto, não da caixa. |
| Famílias em uso | Só Sofia Sans e Sofia Sans Extra Condensed. |
| Pior contraste medido sobre o fundo real da cena | 4,83:1, na terceira linha do título a 320×640. A 390 px é 4,87:1 e a 1280 px é 5,05:1. |
| Base do "Entrar" | 546 px (320×640), 678 px (360×740), 687 px (390×844) e 464 px (1280×800). Sempre na primeira tela. |
| Entrada | Toca na primeira visita e não toca na recarga da mesma sessão. |
| Fim da entrada contra o estado sem movimento | 0 pixel diferente em 1.024.000. Antes de o `will-change` sair, 3% diferiam só em bordas de letras: eram camadas do compositor que ficavam presas. |
| Erro de credencial (401 sintético) | "E-mail, CPF ou senha incorretos." em `.landing-error`. |
| Modais e `/recuperar-senha#token=…` | Os dois modais funcionam com a fonte nova. O token abre a etapa de redefinição, o hash é limpo e não há entrada por trás. |

## Acréscimo (26/09/2026): fachada da FACISA e pista mais realista

Pedido do usuário: a foto da FACISA ao fundo do estádio e uma pista mais realista.

- **Foto:** `src/assets/facisa-fachada.webp`, com 54,7 kB. O arquivo original é um PNG de 678×452 px e 496 kB, convertido pelo Chromium com `tmp/landing-v2/converter-webp.mjs`, sem dependência nova.
  - Ela entra como camada da cena (`.lp-cena::before`), com o prédio de pé sobre o horizonte, a 112% da altura do céu. O tamanho foi calibrado com o usuário: cobrir o céu todo ampliava demais, e 88% deixava o prédio pequeno.
  - Fica em preto e branco com as bordas esmaecidas. O céu azul virou uma camada translúcida por cima (`::after`), que tinge a foto no tom da marca.
- **Pista:**
  - a linha branca passou a medir 1/24 da raia, proporção da World Athletics (5 cm em 1,22 m), com borda suavizada;
  - entraram o meio-fio de concreto com sombra, o grão de piso emborrachado (ruído SVG), a luz de refletor perto da câmera e uma vinheta nos cantos;
  - as marcas que passam na entrada ficaram mais discretas.
  
  A pesquisa das proporções foi feita por um subagente Haiku.
- **Contraste:** medido sobre o fundo real, de 1920 a 320 px. Na primeira tentativa, a frase caiu para 4,32:1 no desktop, e "FACISA, UFRN" para 4,49:1 a 320 px. Com o céu mais fechado perto do horizonte e no alto, o pior caso passou a 4,75:1.
- **Verificação:** o resto também passou. Nada cortado, "Entrar" na primeira tela em todas as larguras e fim da entrada idêntico ao estado sem movimento (0 px).
- **Falso positivo corrigido em `test-landing-isolamento.cjs`:** o `.webp` de `url(...)` era lido como a classe `webp`.
- **Pendências:**
  - confirmar a autoria e a permissão de uso da foto, e o crédito, se houver;
  - obter um original de 1920 px ou mais. O arquivo atual é ampliado cerca de 1,3× em telas largas e depende de um desfoque leve para não serrilhar.

## Revisão independente

O veredito foi **aprovado com ressalvas**, sem bloqueantes.

**O que o revisor conferiu:**
- **Escopo:** pela data de modificação, e não pelo `git status`, que já tinha centenas de arquivos anteriores.
- **Invariantes 1 a 8.**
- **`LoginPage.jsx` diante da cópia anterior:** a lógica de login, recuperação e solicitação está idêntica byte a byte.
- **Checagens:** `lint`, `test:ui` e `build`.
- **Provas de mutação próprias, em cópias:**
  - para `test-landing-conteudo.cjs`, quatro mutações, todas pegas;
  - para os pares novos de `test-landing-tokens.cjs`, a névoa escurecida para 2,60:1, pega.

**Achados corrigidos:**
1. A entrada do título tinha um quadro intermediário (`40% { opacity: 1 }`), fora da regra "só `from`". A opacidade virou uma animação própria de 280 ms.
2. Os comentários de `landing-modais.css` citavam classes que não existem mais (`.landing-submit`, `.landing-login-panel__foot`).
3. A frase, as descrições das áreas e o rodapé herdavam a entrelinha 1,6 do `p` global. Agora declaram `--lt-leading-normal`.
4. O `will-change` ficava ativo a sessão inteira, porque `data-entrada` não sai do DOM. Foi removido: o navegador já promove o elemento enquanto ele anima.

## Limites

- Tudo foi verificado com dados sintéticos e API interceptada, no Chromium sem GPU. Isso não substitui homologação.
- Não testados:
  - leitor de tela;
  - zoom de 200%;
  - Safari e Firefox (`overflow: clip` exige Safari 16 ou mais recente e cai para `hidden` antes disso);
  - celular real;
  - desempenho do plano 3D em aparelho fraco. O mockup mediu 18 quadros/s sem GPU a 1280.
- Os modais não foram redesenhados. Só herdam fonte e cor, e o título deles não usa a fonte de campanha.
- `lint:css` (stylelint) acusa problemas nas folhas da landing, como já acusava na versão anterior. Ele não faz parte de `npm run lint` nem do CI.

## Acompanhamento

- O endpoint `/public/stats` ficou sem consumidor na página pública; decidir se ele sai.
- `public/screenshots/` deixou de ser usada pela landing, mas as capturas continuam no repositório. Apagar ou não é uma decisão separada.
- A regra global de `h1` com degradê e a Poppins global (`src/index.css`) continuam valendo para o sistema inteiro.
- `tmp/landing-v1/` guarda a versão anterior só até esta mudança ser commitada.
