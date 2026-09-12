# Engenharia, testes e operação

## Estado verificado

O frontend compila, a API passa na checagem TypeScript e os testes atuais passam. Entretanto, o pipeline de CI contém YAML inválido, o lint está vermelho e os testes de núcleo não capturam falhas importantes entre tela e servidor.

| Verificação executada | Resultado nesta rodada | Evidência |
|---|---|---|
| `npm run build` | Passou; Vite alertou sobre chunk grande. | [build-frontend.log](evidencias/build-frontend.log) |
| `npm run test:core` | **100 testes passaram**, zero falhas; inclui compilação do servidor. | [test-core.log](evidencias/test-core.log) |
| `npm run lint:server` | Passou. É `tsc --noEmit`, não uma análise ampla de qualidade/segurança. | [lint-server.log](evidencias/lint-server.log) |
| `npm run guard:schema` e `guard:copy` | Passaram quando executados separadamente. | [schema](evidencias/guard-schema.log), [copy](evidencias/guard-copy.log) |
| `npm run lint` | **23 erros e 10 avisos**. O encadeamento não executa o guard de copy quando o ESLint falha. | [lint-frontend.log](evidencias/lint-frontend.log) |
| `npm run lint:css` | **6.893 erros e 1.852 avisos**. Grande parte é convenção de sintaxe/estilo, não falha funcional individual. | [lint-css.log](evidencias/lint-css.log) |
| Parser YAML dos workflows | `ci.yml` inválido: chave duplicada em **192:9**; outros três workflows parsearam. | [engineering-inventory.json](evidencias/engineering-inventory.json) |
| `npm audit --omit=dev` | Frontend: **10 pacotes sinalizados** — 9 altos, 1 moderado. | [JSON frontend](evidencias/npm-audit-frontend.json) |
| `npm --prefix server audit --omit=dev` | API: **16 pacotes sinalizados** — 8 altos, 7 moderados, 1 baixo. | [JSON servidor](evidencias/npm-audit-server.json) |
| `python -m unittest discover -s laines-image-processor/tests -p test_core.py` | **48 testes passaram**. Não cobre o pipeline completo com câmera/modelos/armazenamento. | [test-image-core.log](evidencias/test-image-core.log) |
| Provas de segurança e contrato clínico | Oito vetores de segurança reproduzidos; inconsistências de plano e autoria reproduzidas com serviços atuais e doubles sintéticos. | [segurança](security-probes.json), [clínico](evidencias/clinical-contract-result.json) |

As primeiras consultas npm falharam por rede/cache do ambiente. Foram repetidas com acesso permitido e os arquivos finais contêm respostas completas do registro. Não foi executado `audit fix`, instalado pacote ou alterado lockfile por esta auditoria.

## Achados de engenharia

### ENG-01 / P0 — CI não é uma barreira confiável no estado atual

`.github/workflows/ci.yml:188–193` define duas vezes `env` no mesmo step de smoke de perfis. O parser retornou `duplicated mapping key`. Corrigir o YAML, validar todos os workflows e executar a pipeline de uma revisão imutável. Parse local não substitui uma execução real do GitHub Actions.

O lint inclui erros reais em `AvaliacaoImagem.jsx:538`, `AvaliacaoCompleta.jsx:2265` e outros componentes, além de arquivos temporários não adequados à configuração de browser. Corrigir o código relevante e delimitar o escopo dos arquivos de ferramenta; não desabilitar regras globais apenas para obter verde. Para CSS, criar uma linha de base e reduzir por componente; um auto-fix massivo simultâneo dificultaria revisar regressões visuais.

### ENG-02 / P1 — cobertura concentrada em funções, lacunas nos contratos e jornadas

Os 100 testes de núcleo passam mesmo com 200 kcal na tela e 0 no servidor para o mesmo plano. Há testes úteis do motor de restrições, mas a tela passa uma lista vazia. O smoke de perfis testa entrada/conteúdo/menu; não prova que salvar, reabrir, revisar, imprimir e entregar funcionam. As suítes de roles usam um subconjunto das combinações de permissões, diretorias e vínculo.

Adicionar poucos testes de alto valor: round-trip da prescrição atual e legada; aluno e profissional com mesma versão; leitura acadêmica transversal + escrita negada; evento clínico entre duas equipes; upload negado sem escrita; recuperação sem segredo rejeitada. Sucesso de `test:all` só é evidência válida se as credenciais/cenários obrigatórios não foram pulados.

### ENG-03 / P1 — dependências precisam de atualização com análise de aplicabilidade

Os JSONs do npm incluem Axios, React Router, Socket.IO/parser/transportes e, no backend, Multer/Nest, MinIO e TypeORM entre os pacotes sinalizados. Avaliar caminho realmente usado: este frontend é SPA; um aviso sobre SSR não prova vulnerabilidade nesse uso. Um aviso de TypeORM limitado a MySQL/MariaDB não comprova injeção no PostgreSQL do LAINES. Um aviso de adaptador Node de Axios não prova impacto no navegador.

Por outro lado, parser de socket, upload e API estão em superfícies relevantes. Atualizar conjuntos compatíveis, revisar overrides e testar regressões. A sugestão automática para MinIO inclui mudança de versão principal/downgrade; não deve ser aplicada cegamente. “26” é a soma dos pacotes sinalizados nas duas árvores, com componentes repetidos, não o número de CVEs distintos nem de explorações. As URLs dos avisos estão nos JSONs para análise individual.

### ENG-04 / P2 — tamanho e acoplamento aumentam o custo de refinamento

Inventário: 285 arquivos de fonte/estilo no frontend (~120 mil linhas), 210 na API (~33 mil linhas) e 41 migrations. `AvaliacaoCompleta.jsx` tem 3.608 linhas; `PatientProntuario.jsx`, 2.274; `ProntuarioPatch.css`, 2.404. Esses números sinalizam custo de manutenção, não são defeitos funcionais por si só.

Separar progressivamente apresentação, transformação de dados, cálculo e persistência; compartilhar DTOs/esquemas e regras de permissão. Priorizar o contrato do plano, depois o prontuário e os componentes de avaliação. Manter o núcleo puro de prescrição e os componentes compartilhados existentes. Não reescrever o sistema inteiro.

### ENG-05 / P2 — bundle e carregamento precisam de orçamento por jornada

O build produziu 59 arquivos JS/CSS somando 3.807.896 bytes (~991.104 gzip); isso não é o tamanho inicial de cada página. O maior chunk genérico tem 864.272 bytes (~244.425 gzip), avaliação completa 469.367 (~119.251 gzip). Há lazy loading, que deve ser preservado. Medir rede, memória e tempo de interação em build de produção antes de decidir novas divisões. Não foram feitos testes de carga de API nem medições de Core Web Vitals em produção.

### ENG-06 / P1 — release, restauração e configurações precisam de evidência operacional

Há workflows de deploy e rollback com comandos de backup/restore exigidos em cenários de migration (`deploy.yml:327–328,459–472`) e checklist operacional. Isso é positivo. Nesta rodada não foi restaurado backup nem executada migration em cópia de produção. Confirmar banco **e** anexos/imagens, versões compatíveis da API/processador e retorno do release anterior. Health isolado não prova jornada clínica.

O projeto tem duas variantes de Nginx (HTTP e HTTPS) e integração de imagens em Docker. Registrar qual caminho é canônico por ambiente, configuração efetiva de cookies/CORS/CSP e como o navegador chega ao storage privado. Não inferir configuração ativa a partir de um arquivo local. A versão de frontend deve corresponder à API e ao contrato de dados publicados juntos.

### ENG-07 / P2 — PWA deve ter política explícita de atualização e dados

`public/sw.js` evita cache de `/api` e `/socket.io`, um controle útil. Cache estático usa nome fixo e `skipWaiting`/`clients.claim`; avaliar atualização durante atendimento e limpeza dos assets antigos. O bypass depende da forma das URLs; testar se outra configuração de API usa caminho não contemplado. Não foi demonstrado vazamento de prontuário por cache nesta rodada.

### ENG-08 / P1 — documentação antiga descreve outro estado do produto

`docs/rbac-matrix.md` é de maio e enumera roles/guards que já não representam toda a autorização por permissões e serviços. `App.jsx` comenta prescrição ainda em seed, mas a tela integra API. O relatório de readiness de maio dizia zero vulnerabilidades; a consulta de setembro tem outro resultado. Relatórios datados são históricos, não certificados permanentes.

Manter esta auditoria como fotografia datada, publicar matriz canônica e registrar release, migrations, contratos e limitações. Arquivos temporários, capturas, pacotes de deploy e diretórios paralelos precisam de destinos e retenção definidos; não foram apagados nesta rodada para preservar o trabalho existente.

## Rastreabilidade

[manifesto-fontes.json](evidencias/manifesto-fontes.json) registra hashes de 572 arquivos e HEAD do Git. Há muitas alterações locais pré-existentes; o hash do commit sozinho não representa a versão auditada. Segredos e arquivos `.env` foram excluídos do manifesto. [resumo-verificacoes.json](evidencias/resumo-verificacoes.json) consolida testes, dependências e capturas.

Os logs de shell podem conter a formatação do PowerShell em stderr mesmo em teste bem-sucedido. O resultado do teste deve ser lido pelo término do runner e pela contagem, não por uma linha isolada chamada `NativeCommandError`.
