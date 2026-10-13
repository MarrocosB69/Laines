# Change Intent — página do plano alimentar no padrão visual do sistema

Data: 27/09/2026. O usuário pediu outro agente para melhorar o visual da página do plano alimentar. O commit fica com o usuário.

## Escopo

- **A página em uso:** `/prescricao-plano/:pacienteId`, ou seja, `src/views/planos/PrescricaoPlano.jsx` (743 linhas) e `.css` (459), mais `src/components/Prescricao/*.jsx` (17 componentes, usados só por essa página).
- **Fora:**
  - `PrescricaoPlanoAlimentar.jsx`/`.css`: tem import em `App.jsx:31`, mas nenhuma rota; é código morto e fica como item de acompanhamento;
  - a tela do atleta (`AthleteMealPlan.jsx`);
  - `src/core/prescricao/*`, `usePrescricaoApi.js`, `prescricaoCatalogo.js`, `formato.js` e o servidor.

## Onda só visual

Mesmo conteúdo, mesmos dados e mesmos fluxos, no padrão "Energia e velocidade":
- tokens `--lt-*`, o par Sofia Sans, cartões brancos e alvos de 44 px;
- foco visível, contraste de 4,5:1 ou mais;
- status e selos escritos, sem depender só da cor.

## Invariantes

1. **Contrato de prescrição** (UPD-06: CLI-01, CLI-02 e CLI-08), autoria da revisão fixada no servidor (UPD-07), publicação e entrega ao atleta (UPD-10) e justificativa para item em conflito com restrição (UPD-11). O payload e as chamadas de API ficam idênticos.
2. **Cálculos e formatação sem mudança:** totais, adequação, equivalência, substitutos e macros, tanto no núcleo quanto em `formato.js`.
3. **Mesmos avisos,** incluindo o aviso de RED-S, **e mesmos textos.**
4. **A prova é o diff contra `tmp/plano-v1/`:** estados, handlers, efeitos e chamadas iguais. Só a marcação e o CSS mudam.

## Linha de base (antes da onda)

- `node scripts/test-prescription-contract.cjs`: 14 verificações passam.
- `node scripts/test-prescription-adequacy.cjs`: **já falha** na linha 66. O teste espera `grupo` nulo para o perfil feminino e recebe "mulher 19–30 anos". O teste ainda não é rastreado pelo git, e `src/core/prescricao/*` tem mudanças não commitadas, de outra frente do usuário. Esta onda não mexe nisso.

## Verificação

- **Checagem leve** (a máquina está pesada): ESLint, postcss, os dois testes acima e o diff contra o backup.
- **No fim da onda:** a rodada de navegador junto com as outras, e a revisão independente.

## Reversão

O backup está em `tmp/plano-v1/` (19 arquivos, mesmos caminhos).

## Resultado (27/09/2026)

Executor Opus. Conferência do orquestrador:
- ESLint limpo;
- `test-prescription-contract`: 14 de 14;
- `test-prescription-adequacy`: a mesma falha preexistente;
- linhas 1–446 da página idênticas ao backup (só entram 3 ícones no import);
- as mesmas chamadas e as mesmas assinaturas de props nos componentes;
- as 333 regras do CSS dentro de `.prescricao-plano`.

**Nada foi visto em navegador ainda.**

**Mudanças visíveis:**
- o nome do paciente passa a ser `h2`, e as refeições e os painéis, `h3`;
- os estados do plano aparecem como selos escritos;
- os avisos ficam no padrão das Áreas, e o erro ganha `role="alert"`;
- rótulos visíveis nos parâmetros de treino;
- refeições em cartões; abaixo de 40rem, cada item vira um bloco;
- o resumo de metas fica fixo na lateral a partir de 60rem;
- a situação da adequação aparece escrita, com o tom de cor;
- o conflito com restrição ganha mais destaque;
- "excluir refeição" passa a ter o nome da refeição no nome acessível.

**Para decidir:**
1. **O `h1` da rota diz "Sistema LAINES".** Falta `/prescricao-plano` em `PAGE_LABELS` (`RouteSidebarLayout.jsx`); a correção é uma linha, "Plano alimentar".
2. **A página não mostra aviso de RED-S.** Hoje o aviso aparece antes de navegar, na avaliação. Levá-lo para a página seria conteúdo novo; ver a análise conceitual.
3. **Etiquetas IG/CG e selo de equivalência:** mostram o número com tom de cor, mas não o estado escrito ("baixo", "alta"). Seria texto clínico novo.
4. **Ícone de arrastar sem arrastar:** o `GripVertical` aparece, mas não há como arrastar.
5. **Excluir refeição sem confirmação.** O comportamento já era esse antes da onda.

**A medir no navegador:**
- a coluna fixa dentro do `container-type`;
- a semântica de tabela no layout estreito (linhas em `display: grid`);
- quem revisa, com "Aprovar revisão" como ação primária.
