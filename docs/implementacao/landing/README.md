# Landing + login — redesenho

Pedido do usuário: repaginar e deixar limpo. Direção fixada pela auditoria (`interface-usabilidade.md`, "Direção visual proposta"): manter a identidade azul/verde, melhorar hierarquia, não trocar paleta nem usar animação como substituto de reorganização. Especificação: [guia visual](../../design/landing-guia-visual.md).

## Como foi feito

1. **Estrutura sem mudar aparência.** `LoginPage.jsx` (1123 linhas, tudo num componente) foi quebrado em peças em `src/views/landing/`: barra superior, hero, carrossel, painel de login, rodapé e os dois modais. A folha `LoginPage.css` (959 linhas) foi dividida por peça.
2. **Guia visual e tokens** (`landing-tokens.css`, prefixo `--lt-*`), com contraste calculado.
3. **Quatro agentes em paralelo**, um por superfície, sem arquivo compartilhado.
4. **Revisão de conjunto e captura em navegador real** (Chromium, 1280/768/390/320 px).

## O que mudou para quem usa

| Antes | Depois |
|---|---|
| Duas famílias do Google Fonts no caminho crítico do primeiro acesso. | Space Grotesk removida da landing. **Correção posterior:** a página ainda carrega duas famílias — Outfit e Poppins. A Poppins vem do `@import` global em `src/index.css`, que vale para o sistema inteiro; a captura desta rodada verificava só a ausência da Space Grotesk, e a ferramenta `scripts/verificar-tela.mjs` mostrou as duas em uso. Uma fonte só na landing exige mover esse `@import` para o carregamento da área autenticada. |
| Três manchas decorativas animadas no fundo. | Uma, estática. |
| Número de estatística (até 42 px) maior que o título "Entrar na plataforma" (34 px). | Título principal é o único no maior degrau; título do painel, títulos dos modais e números dividem o degrau seguinte. |
| Tom terciário em 3,09:1 e verde da marca usado como texto em 3,63–4,21:1. | Verde decorativo separado do verde de texto; todos os pares de texto ≥ 4,5:1. |
| Anel de foco translúcido que não cruzava 3:1 contra o botão verde. | Anel de duas camadas (halo claro + anel azul), independente do fundo. |
| Botão primário em gradiente — texto branco em 3,45:1 nos pontos claros, com um tom solto fora do vocabulário. | Verde sólido, 5,37:1. |
| Botões em caixa alta com espaçamento; "Solicitar acesso institucional" cortava a 320 px. | Caixa normal; caixa alta só em rótulos pequenos, como manda o guia. |
| Dois botões secundários com estilos diferentes sem motivo. | Um estilo secundário, igual no painel e nos modais. |
| Campo de login com caixa dentro de caixa. | Uma caixa por campo; foco na moldura inteira. |
| Carrossel trocava sozinho a cada 4,2 s, sem pausa. | Pausa com mouse e foco, respeita movimento reduzido, controles nomeados, texto alternativo descritivo. |
| Recuperação de senha em quatro estados sem indicação de etapa. | Indicador de progresso com rótulo textual. |
| Formulário de solicitação sem seções. | Quatro seções rotuladas e nota explicando os campos que mudam conforme o cargo. |

## Defeitos encontrados no caminho

1. **O celular quebrou com a divisão do CSS — erro do orquestrador.** O bloco de media queries foi para o arquivo base, importado antes das peças. Media query não aumenta especificidade, então as regras de desktop das peças anularam as de celular: a 390 px a página ficou em duas colunas espremidas, com campos mostrando "CPF ou" e "S". Lint, build e todos os testes passavam — só a captura em navegador revelou. Corrigido com `landing-responsivo.css`, importado por último, e travado por `scripts/test-landing-cascata.cjs`, que lê a ordem real dos imports e falha se qualquer regra responsiva for anulada por uma de desktop carregada depois.
2. **A caixa dupla e os campos de fundos diferentes tinham a mesma causa.** A regra global de `theme.css` para `input` tem especificidade maior que as regras da landing e desenhava borda, fundo branco e padding no campo interno. Corrigido do lado da landing, igualando a especificidade; `theme.css` é compartilhado com o sistema e não foi alterado.
3. **Estilo da landing vazava para o admin, dependendo do caminho de navegação.** A gestão de usuários usava classes que só a landing define. Como a landing carrega sob demanda, quem passava pelo login antes via o cartão de credencial (desenhado com 420 px) abrir com 880 px e sem padding; quem abria `/admin` direto via o certo. As classes foram removidas do admin, e `scripts/test-landing-isolamento.cjs` falha se qualquer arquivo de fora voltar a usar classe exclusiva da landing.
4. **Revisão de conjunto** encontrou divergências que nenhuma peça isolada mostrava: título, tipografia de botão e foco dos modais diferentes do painel vizinho. Unificados.

## Evidência

- Testes ligados a `npm run test:ui`: contraste (18), modais (4), isolamento (2), cascata (3).
- Captura em Chromium, quatro larguras, com os dois modais abertos e foco no primeiro campo: sem rolagem horizontal, sem texto cortado (medido elemento a elemento — rolagem horizontal sozinha não detecta conteúdo cortado), uma coluna a partir de 1080 px, painel de login primeiro no celular, só Outfit em uso. Roteiro em `tmp/landing-visual/capturar.mjs`.
- Núcleo, lint e build de produção sem regressão.

## Limites

- Captura com dados sintéticos e API interceptada; não substitui homologação.
- Leitor de tela não foi testado.
- O erro de login continua sendo uma mensagem única do formulário, não por campo — o componente não recebe qual campo falhou, e mudar isso exigiria alterar o contrato com `LoginPage.jsx`.
- `modalSystem.css` (compartilhado) mantém seu próprio anel de foco para modais fora da landing.
