# Landing: materiais e luz mais naturais

@work-item-id WI-005

O ajuste visual mantém a composição da landing, a foto da FACISA, as oito raias, a perspectiva, o painel, os textos e os fluxos. A pista ganhou microtextura de piso emborrachado azul; o gramado ganhou variação de lâminas e iluminação. O céu e o horizonte usam transições mais suaves, e a textura da pista recebe uma camada de cor para não parecer cascalho em primeiro plano.

O código mudou apenas em `src/views/landing/landing-hero.css`. Os arquivos `src/assets/landing/pista-borracha-leve.webp` (442 kB) e `src/assets/landing/gramado-natural-leve.webp` (461 kB) são texturas novas e decorativas, sem texto ou logotipo. Foram geradas em modo fotorealista pelo ImageGen, uma imagem para cada material, e convertidas para WebP pelo Chromium. Os prompts finais descrevem, respectivamente, uma vista ortogonal repetível de borracha azul granular de pista de atletismo, com desgaste discreto e luz difusa de fim de tarde, e uma vista ortogonal repetível de grama esportiva natural com lâminas finas e variação verde/oliva. Ambos excluem perspectiva, pessoas, faixas, objetos, texto, marcas e sombras direcionais. Não representam um estádio específico.

As capturas de comparação estão em `tmp/landing-realismo/antes-1280x800-viewport.png`, `antes-390x844-viewport.png` e `antes-320x640-viewport.png`; as finais, em `1280x800-viewport.png`, `390x844-viewport.png` e `320x640-viewport.png`. O relatório do build servido localmente é `tmp/landing-realismo/report.json`: não houve rolagem horizontal, o botão Entrar permaneceu na primeira tela nas três larguras, e não houve erros de página ou de console. A revisão visual independente confirmou a preservação do formulário, da geometria e do recorte responsivo.

## Verificação

| Comando ou evidência | Resultado |
|---|---|
| `npm run build` e `npm run test:ui` | Passaram (código 0). O build gerou as duas texturas novas sem dependência adicional. |
| `npm run lint` | Passou (código 0), com 8 avisos em arquivos fora da landing. |
| `tmp/landing-v2/verificar.mjs`, com fontes carregadas e API sintética | Sete larguras, de 1920 a 320 px: sem rolagem horizontal, texto cortado ou erros de console. O menor contraste da cena foi 6,11:1, acima de 4,5:1. O botão Entrar ficou na primeira tela em todas; a base foi 687 px em 390×844, 678 px em 360×740 e 546 px em 320×640. Login com 401 sintético, modais e redefinição de senha foram verificados. Relatório: `tmp/landing-realismo/validacao-rede/relatorio.json`. |
| `phasegate validate --layer L2` e `phasegate:check-ready` | Passaram; L2: 7 validadores aprovados, 1 ignorado; check-ready: 1 aprovado. |
| `phasegate validate --layer L3` | Falhou somente em L3-003: a configuração exige cobertura de 90% e não há relatório de cobertura. Não foi gerado ou alterado nesta mudança visual. |
| `npm run lint:css` | Falhou com 6.973 erros e 1.723 avisos no conjunto de CSS do repositório; a própria documentação da landing anterior já registra que esta checagem não passa. Não foi ampliado o escopo para corrigir folhas não relacionadas. |

A comparação automatizada do fim da animação com o modo de movimento reduzido diferiu em 0,72% dos pixels, concentrados na rasterização do texto do painel, sem deslocamento visual perceptível. As regras de animação não foram modificadas. Uma primeira medição em ambiente restrito acusou falsamente fontes ausentes, corte e baixo contraste porque o navegador não conseguia carregar Google Fonts; a rodada com rede liberada e fontes renderizadas é a evidência final.

## Refinamento da luz verde

Na continuação pedida pelo usuário, a luz verde foi mantida e concentrada um pouco mais perto do ponto de fuga. Um reflexo esverdeado fraco liga visualmente a iluminação do céu à pista e ao gramado; o branco das linhas e marcas foi suavizado sem mover nenhuma raia. Não houve novo asset, elemento, movimento ou alteração de layout. As capturas imediatamente anteriores estão em `tmp/landing-realismo/antes-refino-1280x800.png`, `antes-refino-390x844.png` e `antes-refino-320x640.png`; o resultado está nos arquivos `*-viewport.png` da mesma pasta. A revisão visual independente considerou a mudança sutil e sem perda de legibilidade.

O build, `test:ui` e o lint principal passaram. A validação de navegador com fontes carregadas e API sintética (`tmp/landing-realismo/validacao-refino/relatorio.json`) passou nas sete larguras: sem rolagem, texto cortado ou erros; menor contraste real de 6,11:1; Entrar na primeira tela, com bases de 464, 687 e 546 px em 1280, 390 e 320 px. A entrada na primeira visita, recarga, login 401, modais e recuperação também passaram. Nesta rodada, o estado final da animação e o modo de movimento reduzido foram idênticos nos 1.024.000 pixels comparados. Para reverter apenas este refinamento, restaurar os valores anteriores dos gradientes, do reflexo e da opacidade das linhas em `landing-hero.css`.

Limites: os dois novos arquivos somam cerca de 903 kB antes do cache do navegador. O desempenho em celular real e Safari/Firefox não foi medido. A autoria/permissão de uso e a baixa resolução da foto FACISA são pendências anteriores a esta mudança. Para reverter esta etapa, remover somente as camadas decorativas adicionadas ao CSS e os dois WebP novos, preservando os demais estilos e assets anteriores.
