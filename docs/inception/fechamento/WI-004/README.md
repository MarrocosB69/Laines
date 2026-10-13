# WI-004 — Onda 3: documentação, imagem e homologação

@work-item-id WI-004

Status: implementação local e ensaio isolado executados em 2026-09-21; release e homologação não concluídas.
Origem: [onda 3 da proposta aprovada](../../../auditoria-2026-09-11/proposta-atualizacao.md), UPD-19, UPD-21 e UPD-22. O usuário autorizou iniciar e continuar esta onda. UPD-23/24 continuam condicionais às dependências e ao impacto no fechamento.

## Intenção e comportamento esperado

- UPD-19: atualizar referências canônicas e distinguir manuais/relatos históricos da árvore local em revisão; registrar destino e retenção de artefatos sem apagar ou mover evidências.
- UPD-22: identificar resultado por imagem como estimativa experimental, mostrar qualidade/versão somente quando fornecidas, manter ausência distinta de zero, retomar capturas pendentes e estados de processamento, e verificar vínculo atual antes do acesso/upload local.
- UPD-21: conferir evidências e ambiente para implantação conjunta, migrations, TLS e restauração de banco e arquivos. Apenas verificações locais isoladas são autorizadas nesta etapa; deploy e banco real permanecem decisões separadas.

## Arquivos e responsabilidade

- UPD-19: `README.md`, `docs/rbac-matrix.md`, `docs/manual/manual-laines.html`, `docs/operations/README.md`; em `src/App.jsx`, somente o comentário desatualizado sobre prescrição por seed.
- UPD-22: `src/components/Avaliacoes/avaliacao-imagem/AvaliacaoImagem.jsx`, `src/services/avaliacaoImagemService.js`, `server/src/avaliacao-imagem/avaliacao-imagem.service.ts`, `avaliacao-imagem.controller.ts`, `avaliacao-imagem-storage.service.ts`, `avaliacao-imagem.module.ts`; `scripts/test-image-evaluation.cjs` e `docs/operations/avaliacao-imagem.md`. Em `server/src/main.ts`, somente impedir que a opção de uploads públicos sirva o diretório privado de imagens, inclusive por caminhos codificados.
- Complemento indispensável do UPD-22: em `server/src/avaliacoes/avaliacoes.service.ts`, restringir somente o atalho de leitura por autoria histórica quando o tipo for `composicao_corporal_imagem`, exigindo vínculo atual também pela rota genérica. As demais políticas de autorização não mudam nesta onda. Validar essa rota no teste de imagem.
- UPD-21: `scripts/test-backup-restore.cjs` e artefatos sintéticos em `tmp/onda3-backup-restore-<id>/`. Usar binários PostgreSQL 18 existentes para criar cluster novo em loopback na porta 55449; recusar porta ocupada e conferir `data_directory`/porta antes de gravar. Fazer dump/restore em dois bancos sintéticos próprios, restaurar cópias de arquivos e conferir linhas, FK, hashes e divergências; encerrar somente o cluster criado, preservando evidência. Nenhuma conexão ao serviço PostgreSQL preexistente.
- Coordenação: este registro, `docs/product/construction/fechamento/logical_design.md` e `docs/implementacao/README.md`.

## Invariantes, limites e reversão

Um agente por UPD e arquivos disjuntos. Sem commits, instalações, migrações reais, mudança do modelo clínico ou política global de autorização. Preservar alterações locais anteriores. Reutilizar o contrato de vínculo do UPD-12; autorização negada deve preceder leitura, gravação e processamento (INV-002/003). Não usar pacientes reais nem enviar e-mails (INV-005). Hash do HEAD não identifica sozinho esta árvore modificada (INV-006).

Não gerar capturas novas nem reescrever manuais inteiros. URLs MinIO já assinadas têm validade própria; os testes locais não comprovam revogação antecipada ou proteção de storage em produção. Procedimento de calibração escrito não equivale a validação clínica. Reversão retira somente os trechos desta onda, preservando alterações anteriores e evidências.

## Verificação e dependências

Testes sintéticos de autorização por vínculo, upload/retomada, transições de processamento e ausência de resultados; tipos do backend, lint e build do frontend; referências documentais e verificação PhaseGate pertinente. Nenhum check substitui câmera, modelo real, MinIO, CI remoto ou restauração operacional.

O ensaio de restauração usa schema SQL mínimo versionado de fixture, não migrations TypeORM nem jornada da aplicação. Executar `node --check scripts/test-backup-restore.cjs` e `node scripts/test-backup-restore.cjs`. Seu sucesso comprova somente a mecânica isolada de banco e arquivos; não encerra UPD-21.

UPD-12 foi informado como concluído pelo usuário; os registros históricos ainda estão desatualizados. UPD-20 consta como parcial e UPD-08 tem CI remoto pendente no estado de execução; conferir antes de fechar UPD-21. UPD-09 está concluído com ressalva e eslint adiado para UPD-24. Resultados não executados continuam pendentes.

## Resultado desta execução

- **UPD-19 — documentação atualizada no recorte autorizado:** matriz por domínio, manual com oito correções e aviso editorial, referências canônicas e inventário parcial. Checagem inicial: 147 links relativos, 77 âncoras, sete hashes e 30 imagens preservadas. Após registrar a exceção de autoria histórica, 59 links da matriz passaram. O inventário não representa a release inteira.
- **UPD-22 — implementado e validado localmente:** retomada preserva capturas confirmadas; upload local exige sessão/vínculo; rotas de imagem e leitura genérica desse tipo exigem vínculo atual; static bloqueia caminhos privados diretos, codificados e variantes Windows. Resultados não inventam qualidade/versão, e a gravação de avaliação/processamento usa transação. `node scripts/test-image-evaluation.cjs`: 16 checks aprovados, exit 0, com doubles, renderização dos componentes e HTTP loopback. Dez variantes privadas que o static serviria no Windows foram bloqueadas. Tipos backend: `npm.cmd --prefix server run lint`, exit 0.
- **UPD-21 — ensaio isolado aprovado; homologação pendente:** [relatório](../../../../tmp/onda3-backup-restore-sUyfoO/report.json), sete checks, exit 0. Cluster PostgreSQL 18.3 próprio, banco/arquivos restaurados, versão da fixture/FK/hashes/tamanhos conferidos e cluster encerrado. O serviço instalado não foi usado. Schema sintético não valida migrations TypeORM, jornada clínica ou rollback de release.
- **Contrato de autorização:** reexecutado depois das alterações paralelas, `node scripts/test-security-authorization.cjs`, dez verificações aprovadas, exit 0. Isso não elimina a exceção residual descrita abaixo.
- **Validação global final:** `npm.cmd run lint`, exit 0, zero erros e oito avisos existentes; copy/permission guardrails OK. `npm.cmd run build` com `VITE_API_URL=http://127.0.0.1:44100`, exit 0, encoding OK, 3.099 módulos e 29,27 s; permanece o aviso de chunk acima de 500 kB. O erro intermediário de Fast Refresh foi corrigido retirando o export de produção de uma função usada só pelo teste, sem suprimir a regra. O teste de imagem passou novamente após a correção.
- **Conferência de encerramento em 2026-09-22:** hashes dos 14 arquivos de código/manifests acompanhados permaneceram iguais aos do início da validação global final. HEAD continua `a55e05f` e o índice Git está vazio. Resultados recuperados das execuções concluídas, sem repetição desnecessária dos testes.

O primeiro ensaio de restauração foi bloqueado pelo sandbox (`pg_ctl`, erro 87). Execuções fora do sandbox foram aprovadas pela revisão automática. Dois defeitos do runner foram corrigidos sem afrouxar os critérios: pipes herdados no Windows e projeção do endereço PostgreSQL com máscara `/32`. Os relatórios das tentativas anteriores permanecem em `tmp/onda3-backup-restore-h7r9dp`, `tmp/onda3-backup-restore-Ajz5Fi` e `tmp/onda3-backup-restore-lgi1kx`; não são execuções aprovadas. O resultado válido é o relatório vinculado acima.

### Rastreabilidade e alterações paralelas

SHA-256 final do índice operacional revisado nesta onda: `52c74927cf4101515ebed258e3f9611a5d78f84dfb8b47c0b412c56948fe39a6`. Hash agregado das 30 tags de imagem preservadas no manual: `8e1f3e3d78f8962ab6f7ceb07ae7f18c6ba36a45dd87f82d635cc0565cbbf119`.

Durante a execução, outra frente alterou `package.json`, `server/package.json`, `docs/implementacao/status.json`, `server/src/auth/authorization.ts` e posteriormente `src/App.jsx`. Nenhum desses quatro primeiros arquivos foi editado pelos agentes desta onda. Em `App.jsx`, nossa edição é apenas o comentário; seu hash no inventário identifica o instante da revisão editorial, anterior à alteração externa. Não atualizar esse hash equivale a preservar a evidência, não a afirmar correspondência com a árvore posterior. O inventário global da release continua pendente. O contrato de autorização consumido pelo teste de imagem foi identificado por SHA-256 `5c057c7bd98cc6ae29bb97f28aea6dd3ee5d3ab175a9970f0edf65bf5ccd32ba`.

### Limitações para fechamento

- Na execução inicial, o atalho legado de autoria histórica permaneceu nos tipos diferentes de imagem. A continuação abaixo remove essa exceção nos demais tipos.
- Câmera/MediaRecorder reais, modelo de processamento, MinIO e concorrência entre múltiplas instâncias não foram homologados. URLs MinIO já emitidas mantêm o TTL de 15 minutos.
- A inspeção dos templates Nginx não encontrou alias público direto de uploads. Isso não comprova configuração remota efetiva. O pacote de deploy não identifica o processador como parte do release; o rollback atual não demonstra restauração dos arquivos. UPD-20 integral e CI remoto permanecem pré-requisitos do fechamento operacional.
- `phasegate:check-ready` passou, mas encontrou zero stories; não é evidência funcional. `p2:validate-pointers` passou para dois ponteiros do documento detectado. `phasegate lint` falhou por incompatibilidade com configuração/dependências ESLint existentes; não houve alteração de setup ou bypass.
- UPD-23/24 não foram iniciados nesta execução. Nenhum commit, instalação de dependência ou deploy foi realizado.

## Continuação autorizada — 2026-09-23

Objetivo: completar as jornadas locais que faltam ao UPD-20 e exercitar migrations e restauração da aplicação para UPD-21, fechando as exceções de vínculo atual encontradas no UPD-12. Esta etapa reutiliza a autorização de continuidade, sem commit, dependências novas, banco real ou deploy.

Escopo disjunto por responsável:

- UPD-12: `server/src/avaliacoes/avaliacoes.service.ts`, somente retirar o atalho de autoria histórica em `findById` e aplicar o escopo assistencial existente também à listagem genérica discente em `findAll`, preservando o filtro de autoria; `scripts/test-security-authorization.cjs`, regressões de leitura. Gestão auditada, regras de edição por área e `authorization.ts` permanecem intactos.
- UPD-20: `scripts/test-onda0-postgres.cjs`, preservar os cinco grupos anteriores e acrescentar duas equipes sintéticas com papéis iguais, criação por gestor, avaliação GET finalizada, revisão, publicação, PDF e entrega ao atleta por HTTP; negativas bilaterais por identificador/listagem/anexo, isolamento de eventos e revogação do vínculo. Corrigir somente a fixture GET antiga de `concluida` para `finalizada`. Verificar ausência de arquivos órfãos após upload negado, sem suprimir falhas.
- UPD-21: novo `scripts/test-release-local.cjs` e artefatos em `tmp/onda3-release-local-*/`. Compilar o backend em pasta exclusiva; criar cluster PostgreSQL próprio em `127.0.0.1:55439`, banco `laines_onda0`, API em `127.0.0.1:44100`. Recusar portas ocupadas e conferir endereço, porta e `data_directory` antes de escrever. Usar cwd vazio e ambiente sintético por lista permitida, sem carregar `.env` real; desabilitar SMTP, processador e serviços externos. Aplicar migrations reais, executar a jornada, parar a API, fazer dump/cópia dos arquivos, preservar as origens e restaurar banco/uploads isolados. Comparar tabelas, constraints, sequences, migrations e hashes antes de reiniciar a API. Encerrar apenas processos/cluster criados pelo runner.
- Coordenação: atualizar este registro e o design já existente. Uma falha de upload negado identificada na leitura será primeiro reproduzida; eventual correção terá escopo explícito antes de editar produção.

Compatibilidade das evidências do UPD-12: ajustar somente o caso de autoria histórica em `scripts/test-image-evaluation.cjs`, cujo resultado antigo permitia anamnese sem vínculo, para exigir a mesma negativa do novo contrato. Atualizar a ressalva correspondente em `docs/rbac-matrix.md`. Isso não altera o módulo de imagem nem amplia a política aprovada.

Compatibilidade das fixtures do UPD-20: o primeiro ensaio aplicou as 42 migrations, passou nos quatro grupos iniciais e parou porque a publicação legada não informava conferência das restrições, exigida pelo UPD-11. Completar os dados sintéticos de conferência no mesmo script, seguindo o contrato atual; manter a validação de produção e todas as asserções. A ausência de anamnese não será convertida em ausência de restrições.

Contrato entre os testes: `ONDA0_PHASE=seed|verify-restored`, `ONDA0_MANIFEST` absoluto dentro da pasta exclusiva e `UPLOAD_DIR` absoluto isolado. A fase seed registra IDs/estados/hashes; a fase restaurada reloga e consulta os mesmos objetos e bytes permitidos/negados, sem recriar fixtures substitutas. A transferência final do paciente revoga a equipe anterior. Mantêm-se INV-001/002/003/004/005/006.

Verificação: sintaxe dos scripts, `node scripts/test-security-authorization.cjs`, `node scripts/test-release-local.cjs`, tipos do backend, lint e build. O runner comprova apenas jornada HTTP/socket e restauração local da aplicação; navegador completo, rollback de versão, Nginx/TLS, modelo, MinIO, SMTP e CI remoto continuam fora desse resultado. Reversão: retirar somente os deltas desta continuação; preservar alterações anteriores e relatórios das tentativas.

### Evidências da continuação

- UPD-12: retirada da leitura por autoria histórica e listagem discente combinada com vínculo atual. O novo caso falhou antes da correção e `node scripts/test-security-authorization.cjs` passou com 15 verificações depois dela. O teste de imagem tinha uma expectativa explícita do comportamento antigo; ajustado esse único caso ao contrato aprovado, suas 16 verificações passaram.
- Tipos do backend: `npm.cmd --prefix server run lint`, exit 0. Lint global: exit 0, zero erros e oito avisos existentes; guardrails de copy/permissão OK. Build frontend: exit 0, 3.099 módulos, 2 min 7 s, aviso existente de chunk acima de 500 kB. `phasegate:check-ready`: exit 0, zero stories; não é evidência funcional.
- Primeiro ensaio da aplicação: [relatório](../../../../tmp/onda3-release-local-XCqxtj/report.json) e [saída da jornada](../../../../tmp/onda3-release-local-XCqxtj/journey-seed.log). Build backend isolado e 42 migrations reais passaram. Os quatro grupos iniciais da jornada passaram; a fixture antiga do UPD-10 falhou por falta de conferência de restrições e foi atualizada no script, sem alterar a validação de produção. API e cluster próprios foram encerrados. Esse ensaio não chegou ao backup/restore.
- Bloqueio de upload reproduzido separadamente: [evidência](../../../../tmp/onda3-upload-denied-KWh60l/report.json). A rota real `POST /pacientes/:id/anexos`, executada em Nest loopback com repositórios sintéticos, respondeu 404 ao professor sem vínculo e deixou um PDF em disco. `PacientesController` grava no interceptor antes da verificação do serviço; `findAccessiblePacienteOrFail` lança antes dos blocos de limpeza de `addAttachment`. Nenhum dos dois arquivos de produção foi alterado nesta continuação; a jornada mantém a asserção contra arquivos órfãos.
- Ensaio final: [relatório](../../../../tmp/onda3-release-local-9f1HZN/report.json), [saída completa da jornada](../../../../tmp/onda3-release-local-9f1HZN/journey-seed.log). As 42 migrations e 11 grupos da jornada passaram: os cinco legados, duas equipes completas por HTTP, negativas bilaterais, isolamento de socket, logout e transferência/revogação. A listagem genérica real já não expõe a avaliação ao autor desvinculado. O 12º grupo falhou com `Upload negado deixou arquivo orfao no paciente A`; o ensaio terminou com exit 1 e encerrou API/cluster próprios. UPD-20 não concluído; backup/restore da aplicação não executado e UPD-21 não concluído. Não houve skip ou relaxamento de asserções.
- Ajustes de fixtures preservaram o contrato: conferência sintética de restrições carimbada pelo servidor, e-mails em minúsculas como no cadastro normal e quantidade de 1.000 g para a composição sintética de 2.100 kcal (210 kcal/100 g). Tentativas intermediárias preservadas em `tmp/onda3-release-local-5JhOt3` e `tmp/onda3-release-local-od4fSC`; não são ensaios aprovados. A correção final das fixtures foi assumida pelo coordenador após interrupção do agente por limite, sem edição concorrente.
- Conferência de escopo: os quatro manifests/lockfiles, `authorization.ts`, `App.jsx` e os dois arquivos de pacientes mantiveram os hashes da retomada. O delta de produção é somente `findById`/`findAll` no serviço de avaliações. Nenhum commit ou dependência nova; HEAD `a55e05f` e índice vazio. Baseline dos arquivos acompanhados em `tmp/onda3-continuacao-6rDUYh`; reversão deve retirar apenas esses deltas, sem restaurar arquivos inteiros sobre outras alterações locais.

## Correção delimitada para prosseguir — upload de anexo

@work-item-id WI-004

Problema reproduzido no 12º grupo do ensaio local: `POST /pacientes/:id/anexos` grava o PDF pelo `FileInterceptor` antes de `addAttachment` verificar o vínculo. Quando a leitura do paciente é negada, a exceção ocorre fora da limpeza atual e o arquivo fica órfão. Isso viola INV-002/003 e bloqueia UPD-20/21.

Comportamento esperado: receber o multipart com o limite atual de 10 MB sem gravar em disco; depois de validar o paciente, vínculo atual e permissão de anexar, gravar o arquivo em diretório isolado e persistir metadados. Negativas, erros de validação e falhas de persistência não devem deixar arquivo novo; um anexo anterior permanece intacto. Respostas HTTP, formatos permitidos e contrato de download permanecem iguais.

Escopo mínimo: `server/src/pacientes/pacientes.controller.ts` e `server/src/pacientes/pacientes.service.ts`; usar a asserção HTTP já presente em `scripts/test-onda0-postgres.cjs` e repetir `scripts/test-release-local.cjs`. Se uma regressão específica adicional for necessária, limitar ao script de segurança de upload. Registrar resultados nesta WI e em `docs/implementacao/onda-3/README.md`, sem reescrever evidências anteriores.

O revisor identificou uma lacuna relevante no teste existente: falha de persistência depois de gravar o arquivo. `scripts/test-patient-attachment-upload.cjs` cobre negativa de vínculo, sucesso/download e essa falha por HTTP sintético; adicionar o script ao `test:security` em `package.json` para mantê-lo na regressão obrigatória. Uploads simultâneos ainda disputam o array JSONB de metadados do mesmo paciente; tratar a concorrência exige um contrato separado e não faz parte desta correção delimitada.

Não objetivos: mudar o modelo clínico, permissões de outros domínios, storage externo, migrations, limite de tamanho, tipos aceitos, dados reais ou implantação. Preservar INV-001/004/005/006. Verificar tipos do backend, lint e PhaseGate, além da jornada HTTP e do restore; ensaio local não equivale a homologação remota.

Reversão: retirar somente o delta desses dois arquivos e do eventual teste, restaurando o processamento anterior de anexos sem sobrescrever outras alterações locais. O rollback da release continua pendente de homologação operacional.

### Ajuste do ensaio de restauração no Windows

Após a correção do anexo, os 12 grupos da jornada passaram, o backup de banco e arquivos foi conferido e o PostgreSQL restaurou em um banco novo. O runner parou ao renomear `uploads` para `uploads-before-restore` (`EPERM` no Windows), com a API já encerrada; o cluster próprio também foi encerrado. Relatório preservado em `tmp/onda3-release-local-pcR552/report.json`.

Alterar apenas `scripts/test-release-local.cjs`: manter `uploads` original intocado, copiar o backup para um novo diretório `uploads-restored` dentro da pasta exclusiva e apontar somente a API reiniciada para esse diretório. Comparar hashes e caminhos do diretório restaurado com o snapshot, além de conferir que o original não mudou. Isso testa a leitura pós-restauração sem mover evidência nem reduzir as asserções de banco, arquivos ou jornada. Não usar diretórios externos, banco real ou serviço existente. Reversão: retirar apenas esse ajuste do runner.

### Resultado de 2026-09-27

O upload negado passou a não criar arquivo nem metadado. A regressão HTTP específica cobriu negativa, sucesso/download, revogação e falha de persistência (3 checks); `npm run test:security` passou integralmente. A [execução final do runner](../../../../tmp/onda3-release-local-8renYj/report.json) passou com 42 migrations, 12 grupos da jornada, backup, comparação de 23 tabelas e dois arquivos restaurados, verificação pós-restauração pela API e encerramento do cluster próprio. Tipos do backend, lint global (zero erros, oito avisos), `phasegate:check-ready` e validação L2 passaram. Detalhes e limites estão no [registro da onda 3](../../../implementacao/onda-3/README.md).

UPD-20 tem evidência integrada local; UPD-21 tem restauração local da mesma versão. Homologação operacional, rollback entre versões, CI remoto e inventário imutável da release seguem pendentes. O teste de imagem experimental continua limitado às provas locais anteriores. A concorrência de dois uploads autorizados no mesmo paciente não foi tratada nesta correção.

A revisão independente deu **PASS com ressalva**, sem bloqueio: o serviço tenta limpar o arquivo novo se `repo.save` falhar, mas ignora erro de `unlink` para preservar a exceção original. Os testes cobrem a limpeza normal, não uma falha física dessa remoção. O limite está registrado no relatório da onda.

## Continuação: inventário do candidato local (UPD-19)

Problema: o workflow de deploy identifica o pacote pelo HEAD e copia `dist/`, `server/dist/`, `server/package.json` e `server/package-lock.json`; a árvore de trabalho atual contém alterações locais não commitadas. HEAD sozinho não identifica os bytes construídos nem autoriza chamar o candidato de release imutável.

Comportamento esperado: gerar em `tmp/onda3-inventario/` um manifesto verificável de tamanho e SHA-256 dos componentes que o workflow empacotaria, com hash agregado estável e indicação explícita do HEAD e de alterações locais. A verificação deve detectar arquivo alterado, ausente ou acrescentado no conjunto, sem ler `.env`, `uploads/`, dados clínicos ou segredos. Os diretórios de build são reconstruídos antes da captura; o relatório diferencia o pacote local, as fontes ainda mutáveis e os componentes ausentes do empacotamento, inclusive o processador de imagem.

Escopo: novo `scripts/inventory-release-candidate.mjs`, esta intenção, `docs/product/construction/fechamento/logical_design.md`, `docs/implementacao/onda-3/README.md`, o registro operacional em `docs/operations/README.md`, o estado específico de UPD-19 em `docs/implementacao/status.json` e evidência temporária exclusiva. Não mudar workflows, source de produto, autenticação, banco, artefatos existentes, CI remoto, pacote de produção ou deploy. Invariantes: preservar alterações locais e artefatos anteriores; operação somente leitura sobre o candidato; saída apenas em `tmp/`; não afirmar proveniência imutável nem homologação. Verificação: `node --check`, build frontend/backend, criação e conferência do manifesto, prova de detecção de alteração em cópia isolada, lint e PhaseGate pertinentes. Reversão: remover apenas o script e o registro desta continuação; preservar os relatórios de ensaio para auditoria até decisão de retenção.

Resultado local: builds frontend/backend e sintaxe passaram; o manifesto em `tmp/onda3-inventario/candidato-local-01.json` identifica 740 arquivos e passou na conferência. A cópia com um hash alterado foi rejeitada. Lint, PhaseGate L2, check-ready e validação de ponteiros passaram; L3 ainda exige relatório de cobertura de 90% não gerado por esta frente. A árvore permanece alterada, portanto o inventário imutável e a homologação seguem pendentes.
