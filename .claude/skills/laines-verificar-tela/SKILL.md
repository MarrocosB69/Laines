---
name: laines-verificar-tela
description: Verificação visual automatizada de uma tela do LAINES antes de reportar uma mudança de layout ou redesenho como pronta. Use sempre que tocar em CSS, estrutura visual ou responsividade de uma página — landing, telas internas ou qualquer superfície redesenhada — e antes de dizer "pronto" ou "sem regressão". Roda em Playwright/Node, sobe o app com API sintética e mede rolagem horizontal, texto cortado, fontes em uso e erros de console.
---

# Verificar tela (LAINES)

Ferramenta: `scripts/verificar-tela.mjs`. Existe porque, numa rodada anterior
do redesenho da landing, a página quebrou no celular (campos mostrando "CPF
ou" e "S", layout em duas colunas espremidas) **com lint, build e todos os
testes passando**. Só uma captura em navegador real revelou o defeito. Esta
ferramenta é essa captura, permanente e reutilizável — não um roteiro avulso.

## Quando usar

- Antes de reportar como concluída qualquer mudança que toque CSS, layout,
  estrutura de componente visual ou responsividade.
- Em ondas com vários agentes redesenhando a mesma página ou páginas
  próximas: cada agente roda a ferramenta na **sua** tela antes de relatar —
  não confie no relato de outro agente sobre a própria tela dele.
- Para comparar antes/depois de um redesenho (veja `docs/design/landing-v2/antes/`
  para o formato de uma linha de base).

## Como usar

Rode `--help` primeiro — lista todas as opções com seus padrões:

```
node scripts/verificar-tela.mjs --help
```

Uso básico (rota pública, ex.: landing):

```
node scripts/verificar-tela.mjs --rota=/ --rodada=<nome-da-sua-rodada> --saida=<pasta>
```

Rota autenticada (sessão sintética — ver "Limites" abaixo):

```
node scripts/verificar-tela.mjs --rota=/aluno --papel=aluno --rodada=<nome> --saida=<pasta>
```

`--papel` aceita `aluno`, `professor`, `tecnico`, `atleta` ou `admin`. Sempre
dê um `--rodada` com nome descritivo (ex.: `antes`, `onda3-hero`) — os
arquivos são prefixados por ele, então rodadas diferentes não se sobrescrevem
na mesma pasta de saída.

**Se você usa Git Bash no Windows**: `--rota=/` pode virar um caminho do
Windows por conversão automática do MSYS (`--rota=C:/Program Files/Git/`).
Se a ferramenta navegar para um lugar estranho, rode com
`MSYS_NO_PATHCONV=1` na frente do comando.

## Como ler o relatório

Cada rodada grava `<saida>/<rodada>__relatorio.json` com um item por largura
testada. Campos que importam:

- **`ok`** (topo) — `true` só se nenhuma largura tiver problema. É o mesmo
  sinal do código de saída do processo (`0` = ok, `1` = problema ou falha).
- **`problemas`** (topo) — lista legível do que falhou, já localizado por
  largura.
- **`rolagemHorizontal`** — `scrollWidth` maior que `clientWidth` na página
  inteira. Não pega corte *dentro* de um elemento — para isso:
- **`textoCortado`** — elemento a elemento, cada um com seletor e os
  primeiros caracteres do texto. É a medida que pegou o defeito do celular
  na rodada anterior; rolagem horizontal sozinha não pegou.
- **`familiasTipograficasEmUso`** — fontes que algum elemento *visível, com
  texto próprio* de fato usa (não o que o CSS declara em algum lugar, o que
  está realmente renderizado). Se a intenção da tela era usar uma família
  só, compare a lista com essa intenção.
- **`colunasLayoutPrincipal`** — heurística genérica (maior elemento em
  `display:grid` dentro de `<main>` ou com "grid" na classe). Pode vir
  `null` — ausência de medida, não "zero colunas" — quando o layout não usa
  CSS grid ou a heurística não encontra um candidato claro; nesse caso,
  confie nas capturas, não no número.
- **`errosConsole`** vs **`errosConsoleInesperados`** — a lista completa e a
  lista já sem o 401 esperado de `/auth/me`/`/auth/refresh` (a sessão é
  sintética, então toda navegação anônima começa negada). Só a segunda conta
  para `ok`/código de saída. Se aparecer algo inesperado ali, é real: a API
  sintética só serve `/public/stats`, `/projetos/public` e (com `--papel`)
  `/auth/me`; qualquer outra chamada volta 404 e pode gerar ruído de
  console em telas internas — leia a mensagem antes de assumir que é
  defeito da tela.
- **`modalAcesso`** / **`modalRecuperacao`** — só relevantes na rota `/`;
  `nao_aplicavel` nas demais rotas, `nao_encontrado` se o botão não existir
  na tela, `capturado` se a captura do modal aberto foi salva.

As capturas (`__pagina.png` página inteira já rolada, `__foco.png` com foco
de teclado visível, `__modal-*.png`) ficam na mesma pasta, com o mesmo
prefixo `<rodada>__wLARGURA__`.

## Regra obrigatória: olhe as capturas antes de relatar

O relatório JSON pega o que é mensurável. Ele não pega hierarquia visual
estranha, espaçamento desequilibrado, contraste que passa no número mas
incomoda, ou qualquer coisa que só o olho vê. Antes de dizer que uma tela
está pronta: **abra as capturas geradas e critique o próprio trabalho** —
esta é a mesma regra que a skill `frontend-design` dá ("critique your own
work as you build, taking screenshots to review"). `ok: true` no relatório
não substitui olhar a imagem.

## Limites conhecidos

- **Sessão sintética (`--papel`) só mocka `/auth/me`** (mais `/public/stats`
  e `/projetos/public`, sempre disponíveis). Uma tela interna que dependa de
  outros endpoints vai mostrar estado vazio, de carregamento ou erro — real,
  não simulado — porque nada além desses três está mockado. Ao verificar uma
  tela nova que dependa de outro endpoint, isso vai aparecer como erro de
  console inesperado; extenda o roteador em `scripts/verificar-tela.mjs`
  (dentro da fronteira desse arquivo) com o mock daquele endpoint específico
  em vez de ignorar o sinal.
- **Não substitui homologação.** Dados sintéticos, API interceptada,
  Chromium só. Não testa leitor de tela nem navegação só por teclado além do
  foco no primeiro campo.
- **`colunasLayoutPrincipal` é heurística**, não uma leitura garantida do
  design system da tela — sirva-se dela como pista, não como veredito.
