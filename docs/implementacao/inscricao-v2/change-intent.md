# Change Intent — formulário público de inscrição e triagem no padrão "Energia e velocidade"

Data: 25/09/2026. O usuário pediu para organizar a parte visual do preenchimento do formulário público (`/inscricao`) com os mesmos agentes da primeira página, para manter o padrão visual. O commit fica com o usuário.

## Problema

A primeira página passou a usar a direção "Energia e velocidade" (`docs/implementacao/landing-v2/`), mas o formulário ao qual ela leva ("Entrar na lista de espera") continua no visual anterior:
- Outfit e Space Grotesk;
- fundo verde-claro com gradientes;
- cartão com faixa degradê;
- rótulos que não estão ligados aos campos. O `<label>` do `FieldGroup` envolve só o texto, e o leitor de tela não anuncia o nome do campo.

## Comportamento esperado

A mesma identidade da primeira página:
- **Cabeçalho:** faixa azul-estádio com o emblema e a voz de campanha.
- **Indicador das seis etapas:** raias.
- **Campos, opções e botões:** o vocabulário do painel de login, com os tokens `--lt-*` e o par Sofia Sans.
- **Tom:** calmo, porque é uma tarefa longa com perguntas de saúde. Não há entrada coreografada, só transições curtas de etapa, desligadas com movimento reduzido.
- **Rótulos:** todo campo passa a ter um rótulo ligado a ele.

## Arquivos e donos

**Passo 0, feito pelo orquestrador antes dos agentes.** É uma separação mecânica, sem mudança visível. A prova é a captura pixel a pixel e o envio idêntico ao da linha de base.
- `InscricaoPublica.jsx` é dividido: as seis etapas, o `FieldGroup` e as constantes vão para `src/views/public/inscricao/`.
- `InscricaoPublica.css` é repartido por superfície.

| Superfície | Arquivos | Dono |
|---|---|---|
| Moldura: página, cabeçalho, indicador de etapas, cartão, navegação, aviso de rascunho, tela de sucesso e rodapé | `InscricaoPublica.jsx` (só o `return`, sem tocar a lógica) e `inscricao-base.css` | agente A |
| Vocabulário de campos e etapas 1 e 2: título da etapa, seções, painéis, campos, grade, rádio, termo, erros e ajuda | `inscricao/campos.jsx`, `inscricao/EtapaTermo.jsx`, `inscricao/EtapaDados.jsx` e `inscricao-campos.css` | agente B |
| Etapas 3 a 6 e escalas visuais (chips, Bristol, urina, questionário sim/não) | `inscricao/EtapaEsporte.jsx`, `EtapaSaude.jsx`, `EtapaRotina.jsx`, `EtapaFinalizacao.jsx`, `src/components/Triagem/EscalasVisuais.jsx`/`.css` e `scripts/test-inscricao-visual.cjs` (novo) | agente C |

Cópia de antes: `tmp/inscricao-v1/`. Os arquivos nunca foram commitados.

## Fora do escopo

- Qualquer texto: o termo, as perguntas, as opções, as mensagens de validação e os avisos. A caixa alta por CSS é permitida. Se um texto precisar mudar, o agente para e relata.
- Os instrumentos clínicos (`src/constants/clinicalInstruments.js`) e a lista de municípios.
- O servidor, o endpoint e o formato do envio.
- Deploy e commit.

## Invariantes

1. **Envio idêntico.** Com os mesmos dados, o corpo do `POST /public/inscricao` é igual ao da linha de base. A prova é a captura, que grava o envio interceptado.
2. **Lógica intocada:**
   - validação e mensagens;
   - o termo como portão de todas as etapas;
   - a etapa na URL (`?etapa=`);
   - o rascunho só com dados de cadastro, nunca o aceite nem as respostas de saúde;
   - o aviso ao sair e ao fechar a aba;
   - só as etapas concluídas podem ser clicadas no indicador.
3. **Textos idênticos,** principalmente os dois termos de consentimento, que são texto legal.
4. **Rótulo em todo campo** (`<label for>` ou `aria-labelledby`), foco visível e alvos de pelo menos 44 px nas opções.
5. **Layout:** nada cortado e nenhuma rolagem horizontal a 1280, 390 e 320 px, em todas as etapas e na tela de sucesso.
6. **Tipografia e contraste:** só Sofia Sans e Sofia Sans Extra Condensed; contraste de texto de pelo menos 4,5:1; os tokens vêm de `src/views/landing/landing-tokens.css`.
7. **Nenhuma chamada de rede nova.**

## Testes e verificações

- `npm run lint`, `npm run test:ui` (com o teste novo ligado) e `npm run build`.
- `tmp/inscricao-v2/capturar.mjs`: seis etapas, erros da etapa 2 e tela de sucesso, a 1280, 390 e 320 px. Mede rolagem, texto cortado, campos sem rótulo, alvos, fontes e o envio. Uma rodada só, feita pelo orquestrador; os agentes não sobem servidor nem navegador.
- Revisão independente (`laines-revisor`).

## Reversão

1. Copie `tmp/inscricao-v1/public/*` para `src/views/public/` e `tmp/inscricao-v1/Triagem/*` para `src/components/Triagem/`.
2. Apague `src/views/public/inscricao/`, os CSS novos e o teste novo.
3. Tire o teste da linha `test:ui` do `package.json`.
