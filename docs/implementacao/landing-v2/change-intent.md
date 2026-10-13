# Change Intent — primeira página, direção "Energia e velocidade"

Data: 25/09/2026. Decisão do usuário: `docs/design/landing-v2/plano.md`, seção "Rodada A2 — decisão". Mockup de referência: `docs/design/landing-v2/a2-energia/` (`index.html`, `plano.md`, capturas e `energia-entrada.webm`).

## Problema

A primeira página ainda se apresenta como sistema clínico: números de `/public/stats` (atletas, avaliações), pílulas "Avaliações clínicas" e um carrossel de capturas de telas internas. O usuário julgou as versões anteriores "amadoras", pediu para modernizar, com animação e referência ao esporte, sem dado clínico, e mostrando as quatro áreas da liga.

## Comportamento esperado

- **Primeira tela:** um estádio à noite, uma pista em perspectiva e o nome da liga em largada escalonada. O login fica num painel branco cortado na diagonal, com duas portas secundárias: a lista de espera (`/inscricao`) e a solicitação de acesso (modal atual).
- **Abaixo da primeira tela:** as quatro áreas (Ensino, Pesquisa, Extensão e Comunicação), com o texto do sistema (tabela na seção 1 do plano do mockup), e o rodapé.
- **Entrada orquestrada de cerca de 2 s:**
  - Só `transform` e `opacity`, e nada em laço.
  - Toca na primeira visita da sessão do navegador, marcada em `sessionStorage` e com a leitura protegida por try/catch.
  - Não toca em `/recuperar-senha` nem com `prefers-reduced-motion`.
  - O estado final é o CSS em repouso, e as animações usam o preenchimento `backwards`. Sem a animação, a página nasce pronta.
- **Painel de login:**
  - Validação de campo vazio com a mensagem abaixo do campo.
  - Erro do servidor na mesma `.landing-error` com `role="alert"`.
  - "Mostrar"/"Ocultar" com `aria-pressed`.
  - "Entrando" durante o envio.
  - Um tranco curto no erro, desligado com movimento reduzido.
- **Nenhum número público,** nenhuma captura de tela interna e nenhum texto clínico.

## Arquivos afetados e donos

| Superfície | Arquivos | Dono |
|---|---|---|
| Contrato comum | `src/views/landing/landing-tokens.css`, `src/views/LoginPage.jsx`, `scripts/test-landing-tokens.cjs` | orquestrador (antes dos agentes) |
| Primeira tela: cena, marca, título, frase, moldura diagonal do painel, grade da página e breakpoints de layout | `HeroCopy.jsx`, `PistaCena.jsx` (novo), `landing-base.css`, `landing-hero.css`, `landing-responsivo.css`. Remoção de `HeroCarousel.jsx` e `LandingTopBar.jsx` | agente A |
| Formulário dentro do painel | `LoginPanel.jsx`, `landing-login.css` | agente B |
| Áreas e rodapé | `AreasLiga.jsx` (novo), `SiteFooter.jsx`, `landing-areas.css` (novo) | agente C |
| Dependentes do texto antigo ("Entrar na plataforma", "Entrar agora") | `tests/browser/readiness.spec.js`, `tests/browser/tour-completo.spec.js`, `scripts/browser-assessment.mjs`, `scripts/capture-tcc-figures.mjs`, `scripts/journey-audit.mjs`, `scripts/generate-manual.mjs` | orquestrador |
| Documentação | `docs/design/landing-guia-visual.md`, `docs/implementacao/landing-v2/README.md`, `docs/implementacao/status.json` | orquestrador |
| Acrescentados na integração | `package.json` (liga `test-landing-conteudo.cjs` ao `test:ui`) e `.gitignore` (`tmp/`). O segundo não estava previsto: com cerca de 500 MB de ensaios em `tmp/`, a varredura de classes do Tailwind v4 fazia o Vite levar mais de 3 minutos para servir a primeira página, e nenhuma verificação em navegador terminava. O Tailwind respeita o `.gitignore`, e `tmp/` não tem nenhum arquivo versionado. | orquestrador |

Preparação já feita:
- As regras `.field-shell` e `.password-visibility` saíram de `landing-login.css` e foram para `landing-modais.css`, sem mudança de regra. `PasswordRecoveryModal.jsx` usa essas regras, e o painel novo não.
- Cópia da landing anterior, que nunca foi commitada, em `tmp/landing-v1/`.

## Fora do escopo

- O conteúdo e o desenho dos dois modais. Eles só herdam fonte e cor pelos tokens.
- O endpoint `/public/stats` no servidor: a página deixa de consumir, e o endpoint fica.
- O `@import` global da Poppins em `src/index.css`.
- `public/screenshots/`: a página deixa de usar essas capturas, mas elas não são apagadas.
- Deploy, commit e banco.

## Invariantes

1. **Contrato de login:**
   - `data-testid="login-identifier"` e `"login-password"` permanecem.
   - `autocomplete="username"` e `"current-password"` permanecem.
   - `.landing-error` continua com `role="alert"` e `id="landing-login-error"`.
   - As mensagens de erro de `LoginPage.jsx` não mudam.
   - A conversão de CPF para `@laines.ufrn.br` não muda.
   - O redirecionamento por papel não muda.
   - O botão de envio ganha `data-testid="login-submit"`.
2. `/recuperar-senha` com o token no hash continua abrindo o modal na etapa de redefinição e limpando o hash.
3. Os fluxos de solicitação de acesso e de recuperação de senha continuam idênticos, com os mesmos componentes, props e textos.
4. O isolamento do CSS continua valendo: nenhuma classe exclusiva da landing é usada fora dela (`test-landing-isolamento.cjs`).
5. A cascata continua correta: `landing-responsivo.css` é importada por último e nenhuma media query é anulada (`test-landing-cascata.cjs`).
6. Todo texto tem contraste de 4,5:1 ou mais sobre o token e sobre o fundo real da cena.
   - O foco é visível.
   - Os alvos têm 44 px ou mais.
   - Nada fica cortado e não há rolagem horizontal a 1280, 768, 390 e 320 px.
7. O botão "Entrar" fica na primeira tela a 390×844, 360×740 e 320×640. O mockup falhava a 320×640, e isso passa a ser critério.
8. A página usa no máximo duas famílias próprias: Sofia Sans e Sofia Sans Extra Condensed Italic 900, carregadas pela landing. A Poppins global já existia e continua fora do escopo.

## Testes e verificações

- `npm run test:ui`:
  - tokens, com os pares da cena acrescentados;
  - modais;
  - isolamento;
  - cascata.
- `npm run lint`, `npm run build` e o núcleo sem regressão.
- `node scripts/verificar-tela.mjs --rota=/` a 1280, 768, 390 e 320 px: rolagem, texto cortado, fontes e erros de console.
- Captura da entrada em vídeo, comparação do estado final com o estado sem movimento, e medição do botão "Entrar" nas três alturas de celular.
- Revisão independente (`laines-revisor`) antes de dar por encerrado.

## Reversão

Nada foi commitado. Para voltar à landing anterior:
1. Copie `tmp/landing-v1/LoginPage.jsx` e `tmp/landing-v1/landing/*` de volta para `src/views/`.
2. Apague os arquivos novos: `PistaCena.jsx`, `AreasLiga.jsx` e `landing-areas.css`.
3. Restaure `scripts/test-landing-tokens.cjs` e `docs/design/landing-guia-visual.md` a partir de `tmp/landing-v1/`.

Os dependentes de texto (testes de navegador e scripts de captura) voltam pelo diff desta mudança.
