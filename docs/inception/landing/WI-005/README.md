# WI-005 — realismo visual da landing

@work-item-id WI-005

## Intenção de mudança

O usuário considera artificial o estádio da landing atual: a pista e o gramado parecem superfícies desenhadas. O objetivo é dar aparência mais próxima de materiais e luz reais, preservando a composição existente, a foto da FACISA, o texto, os controles, a navegação e a animação de entrada.

Comportamento esperado: pista azul com textura sutil de piso emborrachado, gramado com variação natural e horizonte/iluminação menos chapados. As oito raias, a geometria em perspectiva, a posição do painel e a leitura da marca permanecem. O visual deve funcionar em desktop e celular, inclusive com movimento reduzido.

Escopo mínimo: camadas decorativas em `src/views/landing/landing-hero.css`; novos assets de textura raster em `src/assets/landing/` apenas se melhorarem a cena após inspeção. Registro de resultado em `docs/implementacao/landing-realismo/README.md`. Não alterar DOM, componentes JSX, textos, layout, tokens dos formulários, autenticação, recuperação, inscrição, backend ou foto existente da FACISA.

Invariantes: login e modais idênticos; `PistaCena` continua `aria-hidden`; contraste de texto mínimo de 4,5:1 no fundo renderizado; sem corte/rolagem horizontal em 1280, 768, 390 e 320 px; botão Entrar na primeira tela a 390×844, 360×740 e 320×640; animação e `prefers-reduced-motion` inalterados; preservar alterações locais anteriores. A autoria/permissão e a resolução da foto FACISA continuam como pendência preexistente.

Verificação: captura antes/depois e inspeção visual em 1280, 390 e 320 px; `tmp/landing-v2/verificar.mjs` para contraste real, posição do botão e animação; `npm run test:ui`, `npm run lint`, `npm run build` e PhaseGate pertinentes. Testes de interação não devem ser alterados para acomodar mudanças visuais. Rollback: retirar apenas as novas camadas CSS e os assets novos, sem restaurar arquivos inteiros ou remover evidências anteriores.

## Refinamento da luz (continuação)

O usuário aprovou a direção visual e pediu mais realismo sem alterar sua aparência. A luz verde do horizonte continua presente; o refinamento limita-se a suavizar a faixa uniforme e espalhar um reflexo discreto sobre a parte distante da pista e da grama. Não adicionar elementos, imagens, movimento, geometria ou cores de marca. As mesmas invariantes e verificações acima continuam válidas. Reversão desta continuação: restaurar apenas os valores de gradiente e iluminação ajustados nesta etapa.
