# Formulário público de inscrição e triagem: padrão "Energia e velocidade"

O usuário pediu para organizar a parte visual do preenchimento do formulário público (`/inscricao`) com os mesmos agentes da primeira página, mantendo o padrão visual. O escopo, os invariantes e a reversão estão em [change-intent.md](change-intent.md). O commit fica com o usuário.

## O que mudou para quem preenche

| Antes | Agora |
|---|---|
| Fundo verde-claro com gradientes, Outfit e Space Grotesk. | Cabeçalho em faixa azul-estádio com o emblema e o título na voz de campanha, e o corpo em Sofia Sans, como na primeira página. |
| No celular, o indicador de etapas rolava para o lado, e as etapas 4 a 6 ficavam fora da vista. | Desktop: seis raias com a marca verde de largada na etapa atual. Celular: "Etapa X de 6", o nome da etapa e uma raia de seis segmentos. As etapas concluídas continuam clicáveis. |
| 22 campos sem rótulo ligado: o leitor de tela não dizia o nome do campo. | Todo campo tem rótulo associado. O erro fica ligado ao campo por `aria-describedby`, e o campo com erro recebe `aria-invalid`. |
| Opções de rádio e caixa de aceite de 13 a 18 px, e as três perguntas da EBIA como rádios de 13 px. | As opções são clicáveis na linha inteira, com 48 px. A EBIA usa o mesmo par Sim/Não do questionário de energia, com 44 px e `aria-pressed`. |
| Chips, escalas e botões no estilo antigo. | O vocabulário do painel de login: campo branco com borda de componente, foco em anel, "Avançar" no degradê do "Entrar" e seleção em azul com fundo claro (nunca sólido). |
| Estado e Cidade lado a lado, cortando "Escolha o estado primeiro" no celular. | Empilhados abaixo de 420 px. |

Nenhum texto mudou: termos, perguntas, opções, placeholders, validação e sucesso ficam como antes. As cores da escala de urina também não mudaram.

## Como foi feito

1. **Linha de base em navegador:** `tmp/inscricao-v2/capturar.mjs` percorre as seis etapas, os erros da etapa 2 e a tela de sucesso, a 1280, 390 e 320 px. Os dados são sintéticos, e o envio é interceptado e gravado.
2. **Passo 0, uma separação sem mudança visível:**
   - o `InscricaoPublica.jsx` de 1.309 linhas foi dividido em `src/views/public/inscricao/` (constantes, `FieldGroup` e as seis etapas);
   - o CSS foi dividido por superfície.
   
   A prova foi **0 pixel diferente em 24 capturas e envio idêntico**. Essa captura pegou um defeito que o lint não pegava: o `import()` dinâmico da lista de municípios apontava para a pasta antiga.
3. **Os três agentes da primeira página, com arquivos disjuntos:**
   - A: a moldura;
   - B: o `FieldGroup` com a associação de rótulo e o vocabulário de campos;
   - C: as etapas 3 a 6, as escalas e `scripts/test-inscricao-visual.cjs`.
   
   Nenhum deles subiu navegador; a verificação ficou numa rodada única do orquestrador.
4. **Verificação integrada e correções:**
   - o rótulo "Dados pessoais" saía cortado a 1280 px, porque as raias tinham largura igual;
   - as etapas futuras ficavam em 3,53:1 por causa da opacidade, e agora estão em 5,31:1;
   - Estado e Cidade ficaram empilhados no celular;
   - `.ip-step` ganhou uma regra.
5. **Revisão independente:** seção abaixo.

## Evidência (rodada final)

| Verificação | Resultado |
|---|---|
| Envio (`POST /public/inscricao`) com os mesmos dados | Idêntico ao da linha de base. |
| Lógica do componente principal (até `if (result)`) | Idêntica ao original, byte a byte. |
| Termos de consentimento | Hash SHA-256 igual ao original, travado por `test-inscricao-visual.cjs`. |
| Campos sem rótulo | 0 em todas as etapas e larguras (eram 22). |
| Rolagem horizontal e texto cortado | Nenhum. O que o medidor aponta é o texto oculto para leitor de tela. |
| Alvos menores que 24 px | Nenhum, exceto um link dentro de parágrafo na tela de sucesso, isento pelo WCAG 2.5.8. |
| Famílias em uso | Só Sofia Sans e Sofia Sans Extra Condensed. |
| `npm run test:ui` | Passa, inclusive `test-inscricao-visual.cjs` (5) e o isolamento da landing. |
| `npm run lint` / `npm run build` | 0 erros (os 8 avisos já existiam e ficam fora do formulário) e build de produção sem erro. |
| Cores da escala de urina (`URINE_TONES`) | Idênticas ao original. |
| `constantes.js` diante do original | Mesmos valores. As únicas diferenças são o `export` e o caminho corrigido do `import()` de municípios. |

## Revisão independente

O veredito foi **aprovado com ressalvas**, sem bloqueantes. A primeira tentativa parou por limite de sessão da API e foi retomada.

**O que o revisor confirmou por conta própria:**
- o envio é igual em profundidade ao da linha de base;
- a lógica do componente e o bloco `if (result)` são idênticos ao original;
- a EBIA grava os mesmos valores, na mesma ordem e sem virar alternância;
- `constantes.js` e `URINE_TONES` são idênticos;
- os termos são iguais byte a byte;
- os 110 itens de "texto cortado" da rodada final são todos texto oculto de propósito, e nenhum é corte real.

**Prova de mutação em cópia:** termo alterado, classe inexistente e fonte antiga fora de comentário. As três foram pegas.

**Achados corrigidos:**
1. 11 variáveis `--ip-*` sem nenhum consumidor foram removidas de `inscricao-base.css`.
2. A raia clicável do indicador caía para 24 px no celular. Agora tem 44 px, como os demais alvos do formulário; a linha visível continua fina.
3. `.ip-urine-when` herdava a entrelinha do `p` global. Agora declara `--lt-leading-normal`.

## Limites

- Tudo foi verificado com dados sintéticos e o envio interceptado, no Chromium. Nada foi enviado ao servidor.
- Não testados: leitor de tela real, zoom de 200%, Safari, Firefox e celular real.
- Na escala de urina a 320 px, as faixas ficaram altas (grade 4×2), e a etapa 5 ficou mais longa que antes.

## Acompanhamento

- `tmp/inscricao-v1/` guarda a versão anterior só até esta mudança ser commitada.
