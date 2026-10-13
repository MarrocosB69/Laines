# WI-017 — Estabilização pós-auditoria para liberação

@work-item-id WI-017

Status: em implementacao local; rodadas 1A-E, 2A-C e 3A-D verificadas localmente, sem implantacao na VM.

## Change Intent da rodada 2C: escopo da coordenacao de atendimento

Problema: a coordenacao de atendimento possui a capacidade de gerir pacientes na interface, mas a API devolve lista vazia e 404 em qualquer prontuario por falta de vinculo. O painel inicial tambem exige projeto inexistente para esse papel. Decisao do usuario nesta sessao: a coordenacao deve acessar todos os pacientes da liga.

Resultado: o papel `coord_atendimento` lista e gerencia o cadastro/vinculos de todos os pacientes e le seus registros clinicos em escopo global auditado. Isso nao concede autoria/revisao de avaliacao ou plano, nem exportacao clinica detalhada. A marca avulsa `coordAtendimento` em outro papel nao amplia acesso. O painel agregado pode usar todos os projetos, mas mantem anonimização obrigatoria.

Escopo: autorizacao clinica, filtro do cadastro de pacientes, escopo analitico e testes negativos de papel; decisao em `docs/product/construction/fechamento/coord_atendimento.md`. Nao inclui acesso do atleta, politicas de publicacao de resultados, migracao ou deploy.

Invariantes: cargo academico nao concede prontuario; papeis sem vinculo continuam negados; leitura de gestao gera trilha; alteracoes clinicas continuam reservadas a autores/revisores autorizados. Validacao: testes unitarios de permissao e seguranca, build/lint da API e HTTP com fixture isolada. Reversao: retirar apenas este escopo e as assercoes correspondentes; nenhum dado/schema e transformado.

## Change Intent da rodada 1D: login do roteiro de auditoria

Problema: a landing atual abre o login em `/` e usa `data-testid` nos campos; `journey-audit.mjs` tenta `/login` e placeholders removidos, encerrando a jornada antes de testar qualquer papel. Resultado: usar o contrato atual da tela e aguardar o redirecionamento ou erro real antes de classificar o acesso.

Escopo: somente `scripts/journey-audit.mjs` e a decisao em `docs/product/construction/fechamento/journey_login.md`. Nao muda autenticacao, credenciais, usuarios, landing ou dados. Validacao: parse, ensaio local sintetico de login e verificacao de falha sem credenciais. Reversao: desfazer o ajuste de seletores, sem restaurar credenciais literais.

## Change Intent da rodada 1E: status valido na fixture analitica

Problema: o seed `seed-ci-analytics.js` grava tres avaliacoes como `concluida`, fora do contrato atual (`rascunho`/`finalizada`). O painel analitico passa, mas `GET /avaliacoes/pendencias/:pacienteId` responde 400 e quebra a visao geral do prontuario sintetico. Resultado: seed usa `finalizada`, sem mudar tipos, datas, IDs ou totais.

Escopo: seed sintetico, um contrato cruzado no E2E analitico habilitado apenas pelo harness local, prova HTTP no banco `laines_audit_wi017` e `docs/product/construction/fechamento/analytics_fixture_status.md`. Nenhuma alteracao em status de paciente real ou logica clinica. Validacao: repetir seed isolado e analytics E2E, verificar pendencias 200 e build/testes. Reversao: retirar as tres substituicoes e o contrato de teste se surgir um estado clinico diferente formalmente aceito.

## Change Intent da rodada 3D: cartao de pacientes no celular

Problema: o cartao de "Meus atletas" combina padding externo com `width:100%` de conteudo no botao interno, corta controles em 390 px e apresenta a entrada do prontuario apenas como clique implicito. Resultado: o cartao cabe na coluna e exibe acoes nomeadas "Prontuario" e "Agendar", com alvos de 44 px.

Escopo: JSX/CSS do `StudentDashboard` e `docs/product/construction/fechamento/cartao_pacientes.md`. Nao muda callbacks, agenda, permissao, paciente ou API. Invariantes: as duas acoes existentes continuam chamando `onSelectPatient` e `onAgendar`; lista e cartao conservam os mesmos pacientes. Validacao: build, UI e navegador em 390/1280 com seed sintetico, verificando largura e alcance dos botoes. Reversao: retirar apenas este ajuste visual/rotulo.
Origem: auditoria local de 13/10/2026 no banco isolado `laines_audit_20261002_01`; preservar a proposta histórica em `docs/auditoria-2026-09-11/`.

## Problema e resultado esperado

A inicialização normal da API falha sem ajuste temporário em memória. A auditoria também encontrou divergência na projeção clínica para o atleta, upload de produção com efeitos antes da autorização, diálogo de avaliação por imagem inacessível, falhas de integridade no cadastro/exclusão e exportações com defeitos de segurança ou leitura. A versão só poderá ser candidata à produção quando cada correção tiver regressão específica e a jornada integrada passar sem o ajuste temporário.

## Escopo das rodadas

1. Restaurar inicialização e portões de teste: metadados TypeORM, fixture de `test:security`, harness analítico e linha de base reproduzível.
2. Proteger dados e arquivos: projeção de avaliações e PDF clínico por papel, upload de produções, CSV e dependências com vulnerabilidades aplicáveis.
3. Recuperar fluxos essenciais: diálogo da avaliação por imagem, criação de paciente com equipe, remoção/transferência de projetos vinculados.
4. Corrigir apresentação e exportação: paginação do PDF clínico, recortes explícitos, cache, landing, painel do atleta e acabamento da prescrição.
5. Reexecutar a matriz completa em ambiente isolado, ensaiar migração/backup/rollback, registrar lacunas e preparar candidato imutável para homologação.

Cada rodada terá intenção delimitada, arquivos autorizados, evidência sintética e critério de saída próprio antes da próxima. `docs/product/...` receberá a decisão aceita antes de qualquer mudança de fonte.

## Módulos e arquivos prováveis

- API: `server/src/tarefas/`, `avaliacoes/`, `avaliacao-imagem/`, `projetos/`, `pacientes/`, controllers de exportação e respectivas migrations quando necessárias.
- Cliente: `src/components/Prontuario/`, `src/components/Avaliacoes/avaliacao-imagem/`, `src/views/landing/`, `src/views/Athlete/`, `src/views/admin/Registration/`, `src/views/Student/Patients/` e `src/views/planos/`.
- Provas: `scripts/`, `tests/`, CI e registros novos em `docs/implementacao/`; reutilizar as evidências sintéticas em `tmp/audit_visual_current/` e `tmp/pdfs/export-audit/`.

## Não objetivos

- Implantar, alterar o banco real, usar pacientes reais ou enviar e-mail real nesta fase de planejamento.
- Reabrir todas as ondas históricas ou mudar a arquitetura React/Nest/TypeORM.
- Tratar aprovação clínica de divulgação como simples ajuste visual; definir a política antes de expor resultados ao atleta.

## Invariantes

Preservar INV-001 a INV-006 de `templates/invariant-register.md`: sessão e vínculo atuais, upload negado sem gravação, legado e totais do plano, testes só com dados sintéticos e trabalho local preexistente. Cargo acadêmico não concede acesso clínico. Avaliações seguem independentes. Não trocar teste falho por skip nem afrouxar autorização para tornar a suíte verde.

## Verificação e saída

- Rodada 1: `migration:run` e boot normais, sem shim; `test:security` e analytics local com configuração padrão corrigida.
- Rodadas 2 e 3: testes negativos provam ausência de arquivo/dado indevido; HTTP por papel e navegador validam projeção, vínculo, CRUD e avaliação por imagem em 1280 e 390 px.
- Rodada 4: PDFs renderizados com casos curtos e extensos; CSV com prefixos de fórmula; inspeção visual e teclado.
- Rodada 5: build, lint, `test:core`, `test:ui`, `test:security`, E2E pertinentes, PhaseGate, dependências revisadas e ensaio isolado de migração/backup/restauração. O resultado não executado permanece pendente.

## Reversão e riscos

Reverter apenas deltas identificados de cada rodada e preservar os arquivos locais anteriores. Contratos de API e migrations exigem ensaio de compatibilidade e restauração antes de qualquer deploy. A avaliação por imagem depende de câmera, processador e armazenamento externos ainda não homologados; o PDF clínico depende de decisão explícita sobre a projeção permitida ao atleta. A homologação de produção é uma etapa separada.

---

## Change Intent da rodada 1A: metadados de tarefas

Problema: o TypeORM recebe `Object` como tipo inferido de `completedByName` e `actorName`, ambos `string | null`, e a API normal falha antes de iniciar. Resultado esperado: declarar `varchar` explicitamente, preservando nomes, comprimento, nulabilidade, migration e dados existentes.

Escopo: `server/src/tarefas/tarefa.entity.ts`, `server/src/tarefas/tarefa-evento.entity.ts` e a prova de inicializacao; decisao tecnica em `docs/product/construction/fechamento/runtime_bootstrap.md`. Nao inclui mudanca de schema, API, tela, permissoes, producao ou outros achados da auditoria.

Invariantes: INV-005 (somente banco/dados sinteticos) e INV-006 (preservar toda alteracao local anterior). A coluna da tarefa e a do evento continuam nullable, `varchar(120)`, sem reinterpretar registros legados.

Validacao: build e lint do servidor; metadados TypeORM sem `Object` nessas propriedades; inicializacao normal contra banco de auditoria isolado, sem shim, e `GET /health` quando disponivel. Se o banco isolado nao estiver disponivel, registrar o limite sem simular sucesso.

Reversao: remover apenas `type: 'varchar'` das duas declaracoes e a evidencia desta rodada. A reversao reintroduziria a falha de inicializacao; nao ha migration nem transformacao de dados a reverter.

Autorizacao: o pedido atual de finalizar o sistema pela auditoria cobre esta correcao local. Publicacao na VM e alteracao do banco real permanecem fora desta rodada.

## Change Intent da rodada 1B: fixture de exportacao

Problema: `test:security` falha no teste SEC-06 porque o double de relatorio nao fornece `period` nem data do paciente. A exportacao atual filtra linhas pelo periodo e a fixture artificialmente retorna lista vazia. Resultado esperado: fixture sintetica com periodo e data coerentes, mantendo a assercao de que administracao global pode exportar detalhe, sem afrouxar acesso delegado.

Escopo: `scripts/test-security-access.cjs` e decisao em `docs/product/construction/fechamento/security_gate_fixture.md`. Fora de escopo: alterar a implementacao de exportacao, permissao, formato, pacientes reais ou banco. Invariantes INV-002, INV-005 e INV-006 permanecem; teste delegado continua exigindo so agregados.

Validacao: `npm run test:security` completo e verificacao de que o paciente sintetico fora do periodo nao aparece. Reversao: retirar apenas a fixture de periodo e as novas assercoes, ciente de que o portao voltaria a falhar sem representar o contrato vigente.

## Change Intent da rodada 2A: credenciais do script de auditoria

Problema: `scripts/journey-audit.mjs` contem pares de acesso fixos e valores padrao de senha. Resultado esperado: o script aceita somente credenciais `E2E_*` fornecidas pelo ambiente, ignora perfis sem par completo e nunca incorpora senhas ao repositorio.

Escopo: o proprio script, verificacao estatica e `docs/product/construction/fechamento/audit_credentials.md`. Nao altera contas, banco, autenticacao, API ou publicacao. INV-001, INV-005 e INV-006: testes nao usam contas reais; a remocao do codigo nao substitui rotacao das senhas que possam ter sido expostas.

Validacao: parse do modulo, varredura de pares literais e execucao de selecao de perfis sem credenciais com falha explicita; nao executar jornada contra producao. Reversao: restaurar apenas a logica de selecao de perfil a partir de uma copia segura, sem restaurar literais de senha. Rotacao externa segue pendente.

## Change Intent da rodada 1C: ensaio analitico local

Problema: `e2e-analytics-local.mjs` semeia o banco definido em `server/.env` quando `DB_NAME` nao e informado; neste checkout o nome padrao e `laines`. O ensaio pode escrever no banco errado e `STRICT_COUNTS=false` pode ocultar dados extras. Resultado esperado: recusar qualquer destino que nao seja banco de auditoria explicitamente indicado em loopback, exigir API de loopback e contagens estritas por padrao antes de iniciar seeds.

Escopo: `scripts/e2e-analytics-local.mjs` e `docs/product/construction/fechamento/analytics_local_gate.md`. Nao alterar seeds, dados, relatorios de produto ou ambiente de producao. INV-003, INV-005 e INV-006: nenhuma escrita se o destino nao passar pelo preflight.

Validacao: entradas sem `DB_NAME`, `DB_NAME=laines` e URL remota devem falhar antes do seed; banco `laines_audit_*` em loopback pode executar apenas contra API isolada. A primeira tentativa positiva expos emails divergentes de tecnico/atleta entre os dois seeds; alinhar esses identificadores no ambiente do harness para criar a fixture. Reversao: retirar o preflight se substituido por garantia equivalente de isolamento; nunca retornar ao fallback silencioso para `server/.env`.

## Evidencia local das rodadas 1A, 1B, 1C e 2A (13/10/2026)

- Build e lint do servidor: exit 0. Metadados TypeORM: 22 entidades carregadas; `completedByName` e `actorName` com `varchar(120)` nullable.
- API sem shim em `127.0.0.1:4198`, `DB_NAME=laines_audit_20261002_01`, migrations e sync desligadas: `GET /health` 200, `database=up`; processo encerrado apos a prova.
- `npm run test:security`: exit 0 apos ajustar a fixture SEC-06 ao periodo; perfil delegado segue agregado e o paciente sintetico fora do periodo nao entra no detalhe.
- Script de jornada: `node --check` exit 0, zero pares de credenciais literais/fallbacks E2E e erro antes do navegador quando nenhum par esta configurado. Rotacao das credenciais historicas ainda e pendencia operacional.
- Harness analitico: preflight recusou banco ausente, `laines` e API remota (exit 1, antes do seed). Criado banco novo `laines_audit_wi017`; 43 migrations rodaram com exit 0. Com API local nessa base, seed de 16 usuarios e fixture deterministica passaram; E2E de dashboard, correlacoes, overview, CSV, JSON e negativas student/professor: exit 0. API encerrada apos a prova. O banco anterior nao foi limpo.
- `npm run test:ui`, `npm run test:core` e `phasegate validate --layer L2 --format human`: exit 0. Estes portoes nao substituem a matriz completa nem homologacao de producao.

## Change Intent da rodada 2B: anexo de producao cientifica

Problema: o interceptor grava o multipart em disco antes de `createProducao` validar permissao e projeto; so a extensao e verificada e o download usa `inline`. Resultado esperado: upload negado ou invalido cria zero arquivos; conteudo e MIME precisam corresponder ao formato permitido; o anexo autorizado e salvo depois das validacoes e baixado como anexo.

Escopo: `server/src/projetos/projetos.controller.ts`, `projetos.service.ts`, helper do upload, prova sintetica em `server/scripts/` e entrada de `test:security` em `package.json`; contrato em `docs/product/construction/fechamento/producao_upload.md`. Nao alterar formatos aceitos, RBAC, entidade, migration, frontend, pacientes ou conteudos. INV-003, INV-005, INV-006: negar antes da escrita e testar so em pasta temporaria.

Validacao: multipart negado, projeto ausente, MIME/conteudo falso e persistencia falha deixam zero arquivo; PDF permitido gera metadados e bytes identicos; resposta de download usa `attachment`/`nosniff`. Build, lint, testes de seguranca e PhaseGate. Reversao: restaurar apenas o fluxo anterior se substituido por outro que mantenha a ausencia de escrita indevida; nenhum schema muda.

## Evidencia local da rodada 2B (13/10/2026)

- Build e lint do servidor: exit 0. `test-producao-upload.cjs`: seis cenarios em loopback/pasta temporaria passaram, incluindo negativa sem arquivo, projeto ausente, MIME/conteudo falso, limpeza apos falha de save, bytes de PDF e `attachment`/`nosniff`, caminho fora da raiz rejeitado.
- `npm run test:security` com a nova prova integrada: exit 0. `phasegate validate --layer L2 --format human`: PASS. Nao houve uso de arquivo de paciente nem acesso a producao.
- Risco restante: a validacao por assinatura reduz arquivo disfarçado, mas nao substitui antivírus ou inspecao profunda de documentos Office; homologar politica institucional de arquivos antes do deploy.

## Change Intent da rodada 3A: datas civis no cliente

Problema: `toDate('YYYY-MM-DD')` usa UTC implicito e exibe o dia anterior em `America/Fortaleza`/`America/Sao_Paulo`. Resultado esperado: somente strings de data civil sao construidas em meia-noite local; timestamps com hora/fuso mantem o significado atual. Data civil invalida e rejeitada.

Escopo: `src/utils/dateUtils.js`, regressao em `scripts/run-core-tests.mjs` e contrato em `docs/product/construction/fechamento/datas_civis.md`. Fora de escopo: alterar agenda no servidor, schema, fuso de relatorios ou calculos clinicos. INV-004 e INV-006: nao reinterpretar timestamps nem dados de plano. Validacao: subprocesso com `TZ=America/Fortaleza` prova data civil estavel e timestamp ainda como instante; `test:core`, `test:ui`, build e PhaseGate. Reversao: retirar apenas ramo de data civil e o teste, ciente de que o desvio de dia retorna.

## Change Intent da rodada 3B: numero invalido na prescricao

Problema: `n()` mostra `NaN`/infinito como texto no plano. Resultado esperado: formatadores `n`, `sinal` e `qtd` mostram traco para valor ausente ou nao finito, mantendo zero legitimo e valores finitos. Escopo: `src/components/Prescricao/formato.js`, prova em `scripts/`, entrada de `test:ui` no `package.json` e contrato em `docs/product/construction/fechamento/formato_prescricao.md`. Fora de escopo: modificar calculos ou inferir peso/meta ausentes. INV-004: zero e ausencia permanecem distintos. Validacao: casos NaN, infinito, nulo, zero e numero positivo, `test:ui`, build e PhaseGate. Reversao: retirar apenas o guard; a origem numerica do `NaN` permanece investigacao separada.

## Change Intent da rodada 3C: alcance do dialogo de imagem

Problema: o overlay `position: fixed` da avaliacao por imagem fica dentro de ancestrais animados com `transform`, podendo perder o viewport e bloquear controles. Resultado esperado: renderizar o mesmo dialogo em `document.body` por portal, mantendo foco, fechamento, passos, permissao e efeitos. Escopo: `src/components/Avaliacoes/avaliacao-imagem/AvaliacaoImagem.jsx`, contrato em `docs/product/construction/fechamento/imagem_modal.md` e ensaio de navegador. Fora de escopo: processamento, upload, calculos e layout interno. INV-002, INV-005, INV-006. Validacao: build, UI, teste de abertura/teclado/fechamento em 1280 e 390 px com seed sintetico. Reversao: retirar apenas o portal se a posicao for corrigida por equivalente acessivel.

## Evidencia local das rodadas 1D, 3A, 3B e 3C (13/10/2026)

- Data civil: `test:core` passou com subprocesso em `America/Fortaleza`; timestamp com fuso preservado. `test:ui` e build do cliente passaram.
- Formatadores: regressao de `NaN`, infinito, ausente, zero e valor finito passou em `test:ui`; a origem do valor invalido continua em investigacao.
- Imagem: com paciente sintetico em `laines_audit_wi017`, login e prontuario abriram. O dialogo foi renderizado como filho de `body`; em 1280x900 mediu x=150, y=122, largura=980 e altura=655; em 390x844 ocupou x=0, y=0, largura=390 e altura=844. Sem overflow horizontal; Escape fechou o dialogo. Build passou. Foco/fluxo de camera ainda exigem ensaio adicional.
- Roteiro de auditoria: o navegador confirmou que o login vigente abre em `/` e usa `login-identifier`/`login-password`; o ajuste de seletores passa em `node --check`. A jornada completa permanece pendente porque outros seletores historicos ainda precisam de revisao.
- Fixture analitica 1E: antes da correcao, o prontuario sintetico retornava HTTP 400 com `Status de avaliacao invalido.` em `/avaliacoes/pendencias/:pacienteId`. Depois de semear os tres registros como `finalizada`, o mesmo endpoint retornou 200 com pendencias validas; o E2E analitico completo passou no banco isolado.
- Cartao 3D: com aluno/paciente sinteticos, em 390 px o cartao mediu x=38 a 352, ambos os botoes ficaram contidos e com 44 px de altura; em 1280 px mediu x=122 a 671. Sem overflow horizontal. Lint e build passaram.
- Coordenacao 2C: `coord_atendimento` no banco `laines_audit_wi017` recebeu 200 para lista de pacientes, prontuario, avaliacoes, pendencias, planos, agenda e painel; 200 para atualizar o mesmo nome cadastral; 403 para nota clinica, consentimento de pesquisa, criar avaliacao, plano e avaliacao por imagem. A trilha isolada registrou leitura de prontuario, avaliacao individual e acesso ao plano. `coordAtendimento` avulso nao concede leitura global no teste de contrato. Build/lint da API, `test:security`, `test:ui`, teste core e PhaseGate passaram. Excluir paciente e editar anexos clinicos continuam guardados por papeis anteriores.

---

## Auditoria e2e complementar — adicionada por Claude (13/10/2026)

> **Aviso:** esta seção foi escrita por **Claude** (assistente de IA da Anthropic, no Claude Code), a pedido do responsável pelo projeto. Ela só acrescenta informação e não altera o texto acima nem as decisões da outra frente.
>
> - **Status:** diagnóstico. Nenhuma correção de código foi feita.
> - Os itens marcados **Decisão** dependem da liga.

### Método e ambiente

- **Banco:** clone isolado `laines_audit_claude_20261013`, criado como TEMPLATE de `laines_audit_20261002_01`.
  - Usuários e atletas são só sintéticos (`server/scripts/seed-datasets/e2e-users.json`).
  - Nenhum dado real foi usado e nenhum e-mail foi enviado.
- **API:** compilada em `tmp/audit-claude/build`, na porta 4197.
  - Para subir, foi preciso o mesmo ajuste temporário da rodada 1: tipo explícito nas colunas de `Tarefa` e `TarefaEvento`, feito só no build temporário.
  - Isso confirma o bloqueio de inicialização já registrado acima.
- **Front:** Vite em modo desenvolvimento, na porta 5197, com Playwright Chromium.
- **Cobertura:**
  - 16 perfis logados mais o público: admin, coordenação, coordenação de atendimento, presidente sem gestão, vice com gestão, aluno, diretorias de Ensino, Extensão, Pesquisa e Comunicação, professor, profissional, pesquisador com gestão, colaborador, técnico e atleta.
  - 694 telas, a 1280 e a 390 px: barra lateral, abas do prontuário, os 16 módulos de avaliação e o plano alimentar.
  - 11 jornadas de ação: agendar, salvamento automático da avaliação, salvar plano, validação de cadastros, relatórios e CSV, solicitações do vice, revisão do professor, pendências do atleta, encerrar sessão e inscrição pública.
- **Medições automáticas:**
  - respostas de API ≥ 400 e erros de console;
  - número de `h1`, campos sem rótulo, alvos menores que 44 px e rolagem horizontal;
  - fontes fora do padrão e textos crus (`NaN`, códigos com sublinhado).
- **Análise:**
  - Quatro agentes especializados leram as evidências, um por dimensão: visual, funcional, conceitual e usabilidade.
  - Claude orquestrou, conferiu os achados altos no código e na API isolada e consolidou o resultado.
- **Evidências:** ficam locais em `tmp/audit-claude/`, pasta ignorada pelo git.
  - `run/` traz `report.json`, `resumo.md`, as capturas e as folhas de contato; `acoes/` traz as jornadas.
  - Os arquivos `achados-{visual,funcional,conceitual,usabilidade}.md` têm 71 achados detalhados, com IDs V-, F-, C- e U-. Os IDs abaixo se referem a eles.

### Limites

- **Modo desenvolvimento:** o `React.StrictMode` roda os efeitos duas vezes, o que dobra as contagens de chamadas e os toasts. O build de produção não foi auditado.
- **Abaixo da dobra:** as capturas mostram só o topo da tela. Por isso o ponto exato do `NaN` no plano e o cartão de ganho de peso da hidratação (WI-013) **não foram vistos**.
- **Não avaliado:** contraste, navegação por teclado e leitor de tela. A troca de período nos Relatórios também não foi testada.
- **Efeito do seed:** parte dos 403 vem dos dados sintéticos: coordenação de atendimento e pesquisador sem projeto, professor sem CRN e paciente sem sexo. Cada item diz se o problema vale além do seed.
- **Itens já deste WI:** não reavaliei o que ele já registra (projeção ao atleta, PDF, upload, CSV, diálogo da avaliação por imagem, CRUD).

### Urgente, fora das telas

- **Credenciais fixas em script versionado.**
  - `scripts/journey-audit.mjs`, linhas 46, 72 e 81, tem e-mail e senha de contas `@laines.ufrn.br` escritos no código, sem leitura de variável de ambiente.
  - Isso vale no commit inicial (`66f014d`) e na cópia de trabalho. Os valores não são reproduzidos aqui.
  - **Recomendação:**
    - trocar essas senhas;
    - ler credenciais só de variável de ambiente;
    - avaliar se o histórico do repositório remoto expõe os valores.
  - Encaixa na rodada 2.

### Achados de severidade alta (conferidos)

| # | Problema | Causa e prova | IDs | Rodada |
|---|---|---|---|---|
| A-01 | Diretorias de Ensino, Extensão e Pesquisa (papel `aluno` com diretoria) entram em `/admin`, no "Painel administrativo", com consultas do dia, fila de espera, pacientes ativos, pacientes sem responsável e agenda geral. Contraria o invariante "cargo acadêmico não concede acesso clínico". Os números são agregados; falta confirmar se a agenda geral mostra nomes. | `canAccessAnalyticsDashboard` aceita qualquer permissão `*_CREATE`/`*_UPDATE_OWN_AREA` de diretoria (`server/src/auth/access-control.ts:93-101`). O texto da tela está em `report.json`. A diretoria de Comunicação, com o mesmo papel, entra na página única `/aluno`; a causa da diferença está a confirmar. | C-08 | 2 |
| A-02 | A presidência, mesmo sem gestão, vê os 4 atletas da fila de espera em "Meus atletas — seus atletas vinculados", com atalhos de avaliação e agenda que não funcionam. | Conferido na API: `GET /pacientes` devolve uma versão `restricted` (nome, nº de prontuário, modalidade, situação e projeto), e `GET /pacientes/:id` responde 404. **Não vaza dado clínico**: o erro é de apresentação e de regra (`PRESIDENCY_ROLES`, `server/src/pacientes/pacientes.service.ts:87-88`). **Decisão:** a presidência deve ver a fila? Se sim, no "Cadastro de atletas", não em "Meus atletas". | C-03 | 2 |
| A-03 | O vice com `requests:review` vê "Solicitações" e recebe 403, dois toasts e um falso "Nenhuma solicitação encontrada" com contadores em 0. | A capacidade `gestao.solicitacoes` vale para admin ou `requests:review` (`server/src/auth/authorization.ts:261`), mas todas as rotas exigem `@Roles(...ADMIN_ROLES)` (`server/src/solicitacoes-acesso/solicitacoes.controller.ts:45-89`). O 403 foi reproduzido na API isolada. **Decisão:** quem revisa pedidos de acesso. | F-02, C-01, U-04, V-03 | 2 |
| A-04 | A coordenação de atendimento não consegue usar nada: Início dá 403, Atletas fica sempre vazio e Relatórios dá 403. | (a) A aba Início é padrão em `/admin` (`src/constants/adminTabs.js:48`), mas o papel não está em `canAccessAnalyticsDashboard`. (b) O escopo clínico do papel é `1 = 0` (`server/src/auth/authorization.ts:131-149`), embora `gestao.pacientes` seja verdadeiro. (c) O Perfil dos atletas exige projeto (`access-control.ts:66-67`), pendência já registrada no WI-016. As falhas (a) e (b) acontecem com qualquer dado. **Decisão:** qual o escopo clínico do papel. | F-03, C-09 | 2 |
| A-05 | Datas sem horário aparecem um dia antes: em 13/10 a agenda mostra "Dia selecionado: 12/10/2026". Provavelmente o mesmo vale para data de nascimento e idade (a confirmar na tela). | `toDate` faz `new Date('AAAA-MM-DD')`, que o JavaScript lê como meia-noite UTC (`src/utils/dateUtils.js:6-8`). Reproduzido com `TZ=America/Fortaleza`. | F-05, U-02 | 3 |
| A-06 | Quando falta o sexo, o gasto energético de adulto é calculado pela fórmula pediátrica Falkner/Bernstein. A tela mostra `formulaId: falkner_pediatrica` para um atleta de 26 anos, e o valor segue para as metas do plano e para a disponibilidade energética. | A fórmula é marcada aplicável para qualquer idade (`src/services/calculationEngine.js:583-592`), e a seleção cai na "primeira aplicável" (`:640`). Vale para qualquer paciente real cadastrado sem sexo. | F-06, C-15 | 3 (validar com nutricionista) |
| A-07 | O texto `NaN` aparece no plano alimentar: 8 capturas, a 1280 e a 390 px, em três perfis. | O formatador só trata `null`/`undefined` como ausência (`src/components/Prescricao/formato.js:3-7`). O cálculo de origem está a confirmar; o candidato é o peso do plano vazio. | F-10, U-05, V-08 | 3 |
| A-08 | O atleta recebe pendências sem ação: "Consentimento de pesquisa pendente" e "Solicite um novo horário". O consentimento aparece como "ATENÇÃO" e conta no selo e no sino. | Os itens são montados sem ação (`src/views/Athlete/AthletePortal.jsx:637-659`). **Decisão (ética de pesquisa/CEP):** apresentar o consentimento como convite neutro, fora da contagem de pendências. | F-13, C-05, C-06, U-03 | 3 |
| A-09 | O botão "Agendar" do painel do aluno só troca para a Agenda, que não cria consulta, apenas remarca. Só o prontuário permite criar uma. | `src/views/Student/StudentView/StudentView.jsx:168-174`; `src/views/Student/StudentAgenda/StudentAgenda.jsx:921-931`; `src/components/Prontuario/ProximasConsultas.jsx:33-37`. | F-12, U-02 | 3 |
| A-10 | A 390 px, o cartão de "Meus atletas" passa da largura e esconde as ações de prontuário e agendamento. A 1280 px essas ações são só ícones. | `run/shots/aluno--390--menu-meus-atletas.png`. A medição de rolagem não pega o problema porque o corte é interno ao cartão. | U-01 | 4 |
| A-11 | Textos sem acento e códigos crus em telas de uso diário: "Relatorios", "Configuracoes" e "Solicitacoes" na barra; "Triagem de Disponibilidade Energetica", "Prontidao do modulo" e "Duracao"; `nao_informado`, `sem_classificacao`, `falkner_pediatrica` e `anamnese_inicial`; para o atleta, "Area do atleta" e "Nao informado". | Origens confirmadas: `server/src/analytics/analytics.service.ts:2029-2034`, `GastoEnergeticoTotalForm.jsx:874,1156`, `AvaliacaoExamesLaboratoriais.jsx:754`. | V-01, V-02, F-09, U-10, C-07, C-19 | 4 |
| A-12 | Configurações › Perfil mostra dados fixos de demonstração ("Coordenacao Geral", e-mail e telefone fictícios) para qualquer pessoa logada, com o aviso "Sem persistência registrada". | Conferido com a sessão "Admin E2E" (`verifica/config-perfil-admin.png`). **Decisão:** esconder a tela até ela salvar de verdade, ou ligá-la ao usuário logado. | V-12, U-13 | 4 |

### Achados médios e baixos, agrupados

**Permissão e navegação**
- **Pesquisador com gestão e sem projeto:** a Visão geral e os Relatórios dão 403 e mostram cartões vazios. A capacidade não considera o projeto (F-04, C-09).
- **"Ir para Presidência":** para o presidente sem gestão, o atalho volta para `/aluno` (`src/navigation/sidebarModel.js:238-243`) (F-08, C-23).
- **"Avaliação por imagem":** abre a Visão geral com o título cru "imagem" (`StudentView.jsx:231-237,326-331`). Complementa a rodada 3 deste WI (F-07, C-21).
- **Técnico:**
  - vê o cartão "Saúde" e o nome e a situação das avaliações clínicas;
  - tem 13 itens da seção Liga, vários só com aviso de "restrito".
  - **Decisão:** o que a equipe técnica vê (C-11, C-12).
- **Rótulo de papel errado:** colaborador, profissional e pesquisador aparecem como "Professor · Supervisão ativa" (C-10, V-14).
- **Menu das diretorias com itens duplicados:** dois "Ensino" para a mesma tela; "Pesquisa" e "Painel" levam ao mesmo lugar (U-11).
- **Visão geral única:** a do vice e da Comunicação não tem o bloco "Direção" previsto no WI-015 (C-02).

**Conceito clínico e vocabulário** (validar com a liga)
- **Avaliações como sequência:** as 16 avaliações independentes aparecem como etapas: "Avaliação completa", "0/16", "1 de 3" e Anterior/Próximo/Finalizar. Isso contraria a independência (C-13).
- **Catálogo contado de três jeitos:** 15, 16 ou 17 avaliações, conforme a tela (C-14).
- **Zeros e padrões que fingem dado** (C-16, F-14, U-12, U-17):
  - "Taxa de comparecimento 0%" sem nenhum atendimento (`ProfessorDashboard.jsx:621`);
  - duração 0 já preenchida na hidratação;
  - nível de atividade "Sedentário" já escolhido no gasto energético.
- **Sexo e gênero misturados:** sexo biológico e gênero se confundem entre a ficha base, os módulos, o prontuário e o cadastro (C-15).
- **Conferência sem anamnese:** o plano pede "Conferi a anamnese" mesmo sem anamnese finalizada. **Validar com nutricionista** (C-20).
- **Mesmo conceito, números diferentes:**
  - fila de espera com 1 no Início e 4 no Cadastro (C-17);
  - "avaliação pendente" com definições diferentes para aluno e professor (C-22);
  - semestre 2026.2 para uns e 2026.1 para outros, no mesmo dia (C-24).
- **Vocabulário instável:** atleta e paciente se alternam; "triagem" tem quatro sentidos; o nome no menu difere do título da tela (C-18, C-04).

**Formulários e acessibilidade**
- **Validação inconsistente:** Novo membro usa o balão nativo do navegador; Novo atleta usa um toast que cita só o primeiro campo; o campo "Sexo *" já vem preenchido (V-06, U-07, F-15).
- **Campos sem rótulo:** 121 campos só com placeholder, nas buscas e nos formulários de Materiais, Reuniões, Capacitações e Comunicados (U-08, V-11).
- **Títulos** (U-09, V-10):
  - 50 telas com dois `h1`: o título da barra e o do cabeçalho;
  - `h1` genérico: "Avaliação" nos 16 módulos e "Sistema LAINES" no plano;
  - `document.title` igual em todas as telas.
- **Barra fixa da avaliação:** cobre campos ao rolar (a confirmar), e "Finalizar" fica em destaque mesmo com o módulo vazio (V-07, U-12).
- **Membros:** a lista tem dois separadores "Alunos" e gera aviso de chave React duplicada (`UserManagement.jsx:788-803`) (F-11).
- **Tabelas no celular:** rolagem interna e e-mails quebrados (U-15, V-09).
- **403 tratado como outra coisa:** aparece como falha temporária, com "Tentar novamente", ou como lista vazia (V-03, U-04).

**Acabamento**
- **Cartão do atleta a 390 px:** a data "13/10/2026" quebra em duas linhas, e o título da barra fica cortado (V-04, U-14).
- **Telas e controles:**
  - a página 404 está fora da identidade visual e não tem link para entrar (V-05, U-18);
  - "Exportar CSV" fica apertado a 390 px (V-13);
  - a inscrição tem alvos de toque pequenos (U-16).
- **401 em `/auth/me`:** aparece em toda carga completa de página, porque a inicialização chama `/auth/me` antes do refresh (`src/contexts/AuthContext.jsx:54-64`). Não é perda de sessão, mas polui a monitoração (F-01).

### O que funcionou

- **Proteção de rotas:**
  - o acesso direto à área de outro perfil volta ao portal de cada um;
  - o atleta não abre avaliação nem plano;
  - depois de encerrar a sessão, a rota protegida leva ao login.
- **Fluxos testados:**
  - a página única do WI-015 funciona para o vice;
  - o salvamento automático da avaliação funciona (`PATCH` 200 e "Salvo");
  - as versões do plano são registradas e a exportação CSV baixa o arquivo;
  - a inscrição pública valida o aceite do termo;
  - o módulo de disponibilidade energética diz com clareza o que falta.
- **Visual:**
  - a identidade "Energia e velocidade" está aplicada em todos os portais;
  - nenhuma tela tem rolagem horizontal, fonte fora do padrão ou botão sem nome;
  - "RED-S" não aparece em nenhuma tela.

### Decisões pendentes da liga

1. Qual o escopo clínico da coordenação de atendimento (A-04).
2. Quem revisa as solicitações de acesso (A-03).
3. Se a presidência deve ver a fila de espera, e onde (A-02).
4. Se o Início das diretorias deve ficar sem indicadores clínicos (A-01).
5. O que a equipe técnica vê (C-11, C-12).
6. Como apresentar o consentimento de pesquisa, consultando o CEP (A-08).
7. Sexo biológico de referência ou gênero, e a regra de cálculo quando falta o sexo (A-06, C-15).
8. Como conferir restrições quando não há anamnese finalizada (C-20).

### Encaixe nas rodadas deste WI

- **Rodada 1:** acrescentar ao portão de testes uma matriz por papel que abre cada item da barra e falha em 403. Ela teria pegado A-01, A-03, A-04 e F-04. Incluir coordenação de atendimento, diretorias e pesquisador nos testes de navegador.
- **Rodada 2:** A-01 a A-04, as credenciais fixas no script e C-11.
- **Rodada 3:** A-05 a A-09, F-07 e F-08.
- **Rodada 4:** A-10 a A-12 e os grupos de conceito, formulários e acabamento.
- **Rodada 5:**
  - reexecutar esta auditoria num build de produção;
  - localizar o `NaN`;
  - verificar o cartão de ganho de peso da hidratação e a troca de período dos Relatórios.
