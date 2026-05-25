# Metodologia tecnica para o TCC - Sistema LAINES

Este documento e um rascunho de metodologia baseado na estrutura atual do sistema LAINES. Ele pode ser usado como base para o capitulo de Metodologia do TCC, principalmente na parte tecnica de desenvolvimento, validacao e caracterizacao do sistema.

> Ajuste os trechos entre colchetes conforme o curso, instituicao, periodo de desenvolvimento, local de aplicacao e orientacoes do professor.

## 1. Caracterizacao da pesquisa

Esta pesquisa pode ser caracterizada como aplicada, pois tem como finalidade desenvolver uma solucao computacional voltada a uma necessidade pratica: apoiar a gestao de atendimentos, pacientes, avaliacoes e acompanhamento multiprofissional no contexto do LAINES.

Quanto aos objetivos, o trabalho possui natureza exploratoria e descritiva. E exploratorio porque parte da compreensao dos fluxos de atendimento, perfis de usuarios e demandas operacionais do laboratorio/projeto; e descritivo porque documenta a arquitetura, as funcionalidades implementadas, os requisitos atendidos e os mecanismos de validacao do sistema.

Quanto aos procedimentos tecnicos, o trabalho envolve desenvolvimento de software, analise de requisitos, modelagem de dados, implementacao de uma aplicacao web, testes funcionais e avaliacao tecnica. O produto desenvolvido consiste em um sistema web cliente-servidor, com frontend em React e backend em NestJS, integrado a banco de dados PostgreSQL.

Sugestao de texto para o TCC:

> A metodologia adotada consistiu no desenvolvimento incremental de uma aplicacao web para apoio aos processos internos do LAINES. Inicialmente, foram identificados os principais perfis de usuarios e fluxos de uso do sistema, abrangendo administradores, alunos, professores, equipe tecnica e atletas. Em seguida, foram definidos os requisitos funcionais e nao funcionais, modelada a estrutura de dados, implementadas as interfaces e a API, e realizadas validacoes tecnicas por meio de testes automatizados, verificacoes de seguranca, testes de navegacao e validacao dos fluxos criticos.

## 2. Etapas metodologicas

O desenvolvimento pode ser descrito nas seguintes etapas:

1. Levantamento de requisitos

Foram identificadas as necessidades relacionadas a autenticacao, gestao de usuarios, gestao de pacientes, vinculacao entre pacientes e responsaveis, registro de avaliacoes, prontuario, agendamentos, relatorios, notificacoes, tarefas e acompanhamento por diferentes perfis de acesso.

2. Definicao dos perfis de usuario

O sistema foi organizado por papeis de acesso, permitindo que cada grupo de usuario tenha uma experiencia e permissao adequada. Os principais perfis mapeados foram: administrador, coordenacao, presidente, vice, diretorias, coordenacao de atendimento, aluno, professor, profissional, pesquisador, colaborador, tecnico e atleta.

3. Modelagem da arquitetura

Foi adotada uma arquitetura web cliente-servidor. O frontend e responsavel pela interface, navegacao e interacao do usuario. O backend concentra as regras de negocio, autenticacao, autorizacao, persistencia de dados e integracoes operacionais. O banco de dados relacional armazena os registros estruturados do sistema.

4. Implementacao incremental

As funcionalidades foram implementadas em modulos, permitindo evolucao progressiva do sistema. Essa organizacao facilitou a separacao entre areas como autenticacao, pacientes, avaliacoes, agendamentos, relatorios, auditoria, notificacoes, configuracoes, catalogos nutricionais e planos alimentares.

5. Validacao tecnica

A validacao foi planejada com diferentes niveis de teste: testes de nucleo, build da aplicacao, smoke test de API, testes end-to-end, testes de controle de acesso por perfil, avaliacao de fluxos criticos, verificacoes de seguranca, avaliacao de desempenho e validacao da interface em navegador.

6. Documentacao e operacao

Foram considerados documentos de apoio operacional, como checklist de producao, SLOs, runbooks, CI/CD e relatorios de readiness, com o objetivo de registrar criterios para manutencao, disponibilidade, monitoramento e continuidade da aplicacao.

## 3. Requisitos funcionais identificados

Os requisitos funcionais do sistema podem ser descritos assim:

- Permitir autenticacao de usuarios por credenciais institucionais.
- Redirecionar usuarios para areas especificas conforme o perfil de acesso.
- Controlar rotas e funcionalidades com base em autorizacao por papel.
- Permitir cadastro, edicao, listagem e gerenciamento de usuarios.
- Permitir cadastro, edicao, vinculacao e acompanhamento de pacientes.
- Registrar projetos, alunos vinculados e responsaveis.
- Gerenciar solicitacoes publicas de acesso e aprovacao administrativa.
- Registrar agendamentos, remarcacoes, status de consultas e historico associado.
- Permitir abertura e preenchimento de avaliacoes multiprofissionais.
- Centralizar os dados do paciente em prontuario com visao clinica, avaliacoes, agendamentos, historico e documentos.
- Permitir acompanhamento por aluno, professor, equipe tecnica, atleta e administracao.
- Gerar visoes analiticas e relatorios administrativos.
- Manter notificacoes e tarefas operacionais.
- Registrar auditoria de acoes relevantes.
- Manter catalogos de apoio, como METs e TACO, para calculos e consultas nutricionais.
- Permitir prescricao e organizacao de planos alimentares.

## 4. Requisitos nao funcionais

Os requisitos nao funcionais observados no projeto incluem:

- Seguranca: autenticacao por JWT, renovacao de sessao, controle de acesso por perfil, hash de senhas, protecao contra tentativas repetidas de login, CORS configuravel e headers de hardening HTTP.
- Privacidade: separacao de acesso por papeis, restricao de rotas privadas e controle de escopo de visualizacao conforme o usuario autenticado.
- Confiabilidade: health check, readiness check, tratamento global de erros e identificador de requisicao em respostas HTTP.
- Manutenibilidade: organizacao modular do backend em recursos independentes e organizacao do frontend em componentes, views, services, contexts e constantes.
- Escalabilidade: separacao entre cliente, API e banco de dados, uso de pool de conexoes e estrutura modular para novos dominios.
- Usabilidade: interfaces especificas por perfil, navegacao por rotas, feedback de carregamento, modais de apoio, mensagens de erro e estados visuais.
- Observabilidade: metricas operacionais, registro de erros, eventos persistidos, SLOs e endpoints administrativos de monitoramento.
- Portabilidade: ambiente baseado em Node.js, Vite, NestJS e PostgreSQL, configurado por variaveis de ambiente.

## 5. Arquitetura do sistema

O sistema segue uma arquitetura cliente-servidor composta por tres camadas principais:

1. Camada de apresentacao

Implementada em React com Vite, essa camada concentra as telas, componentes visuais, rotas protegidas, formularios, dashboards, prontuario, relatorios e interacoes do usuario. A navegacao e organizada com React Router, e as chamadas HTTP sao realizadas por meio de Axios.

2. Camada de aplicacao/API

Implementada com NestJS, essa camada concentra controllers, services, DTOs, validacoes, autenticacao, autorizacao, regras de negocio, normalizacao de dados e comunicacao em tempo real. A API e organizada por modulos, como autenticacao, usuarios, pacientes, avaliacoes, agendamentos, projetos, relatorios analiticos, notificacoes, tarefas, auditoria e configuracoes.

3. Camada de persistencia

Implementada com PostgreSQL e TypeORM, essa camada armazena os dados relacionais do sistema. As entidades representam usuarios, pacientes, projetos, sessoes e registros de avaliacao, agendamentos, solicitacoes de acesso, notificacoes, tarefas, auditoria, configuracoes, catalogos de METs e TACO, alem de planos alimentares.

Sugestao de texto para o TCC:

> A arquitetura adotada foi do tipo cliente-servidor, separando a interface web, a API e a camada de persistencia. O frontend foi desenvolvido em React com Vite, utilizando rotas protegidas e componentes reutilizaveis. O backend foi implementado em NestJS, com organizacao modular, validacao de dados e persistencia via TypeORM. O banco de dados utilizado foi PostgreSQL, escolhido por permitir armazenamento relacional, suporte a campos estruturados em JSONB e integridade por meio de migracoes.

## 6. Tecnologias utilizadas

As principais tecnologias identificadas no projeto sao:

| Camada | Tecnologias |
|---|---|
| Frontend | React, Vite, React Router, Axios, Recharts, Socket.IO Client, CSS modular por telas/componentes |
| Backend | NestJS, TypeScript, TypeORM, Passport/JWT, bcryptjs, class-validator, Socket.IO |
| Banco de dados | PostgreSQL |
| Testes | Playwright, scripts de teste core, smoke tests e validacoes E2E |
| Qualidade | ESLint, Stylelint, scripts de auditoria e verificacao de encoding |
| Operacao | Health check, readiness check, observabilidade, SLOs, runbooks e checklist de producao |

Texto pronto:

> O frontend foi desenvolvido com React e Vite, permitindo construcao de uma interface responsiva e organizada por componentes. A comunicacao com a API ocorre por meio da biblioteca Axios, com interceptadores para inclusao do token de autenticacao e tratamento de expiracao de sessao. O backend foi construido com NestJS e TypeScript, adotando uma estrutura modular baseada em controllers, services, DTOs e entidades. A persistencia dos dados foi realizada em PostgreSQL, com TypeORM para mapeamento objeto-relacional e controle de migracoes.

## 7. Organizacao dos modulos

No frontend, o sistema esta organizado em views, componentes, servicos, contextos e constantes. As principais areas de interface sao:

- Login e solicitacao de acesso.
- Area administrativa.
- Area do aluno.
- Area do professor.
- Portal da equipe tecnica.
- Portal do atleta.
- Prontuario do paciente.
- Avaliacao completa.
- Prescricao de plano alimentar.
- Relatorios administrativos.

No backend, os principais modulos sao:

- Auth: autenticacao, login, refresh token, troca e recuperacao de senha.
- Users: cadastro e gerenciamento de usuarios.
- Pacientes: cadastro, vinculacao e acompanhamento de pacientes.
- Projetos: gerenciamento de projetos e vinculos.
- Avaliacoes: registro e normalizacao dos modulos avaliativos.
- Agendamentos: consultas, agenda e remarcacoes.
- Solicitacoes de acesso: fluxo publico de solicitacao e aprovacao.
- Auditoria: registro de acoes relevantes.
- Notificacoes: comunicacoes internas.
- Tarefas: tarefas operacionais por perfil.
- Conteudos: conteudos informativos.
- Analytics: resumos, relatorios e indicadores.
- Observability: metricas, erros, alertas e SLOs.
- Settings: configuracoes administrativas.
- Mets e TACO: catalogos de apoio para calculos nutricionais e esportivos.
- Planos alimentares: prescricao e organizacao de planos.
- Realtime: comunicacao em tempo real por WebSocket autenticado.

## 8. Controle de acesso e seguranca

O sistema implementa autenticacao com tokens JWT e controle de acesso baseado em papeis. No frontend, rotas privadas verificam se o usuario autenticado possui permissao para acessar determinada area. No backend, os endpoints sao protegidos por guards, validacoes e regras de escopo.

Os perfis administrativos incluem administrador, coordenacao, presidente, vice, diretorias e coordenacao de atendimento. Os perfis operacionais incluem aluno, professor, profissional, pesquisador, colaborador, tecnico e atleta. Cada perfil possui redirecionamento e acesso a funcionalidades especificas.

Tambem foram identificados mecanismos de seguranca relevantes:

- Hash de senha com bcrypt.
- Bloqueio temporario apos tentativas repetidas de login.
- Tokens de acesso e refresh token com rotacao.
- Revogacao de sessoes.
- CORS configuravel por ambiente.
- Validacao global de DTOs no backend.
- Remocao de campos nao permitidos em requisicoes.
- Headers de seguranca HTTP.
- Identificador de requisicao em cada resposta.
- Modo de manutencao configuravel.
- WebSocket autenticado por token JWT.

Texto pronto:

> Para protecao das rotas e dados, foi implementado controle de acesso baseado em papeis. O usuario autenticado recebe um token JWT, utilizado nas requisicoes subsequentes. No frontend, as rotas privadas verificam o perfil do usuario antes de renderizar cada area. No backend, as regras de autorizacao sao aplicadas nos endpoints, evitando acesso indevido a recursos restritos. Senhas sao armazenadas de forma protegida por hash, e a sessao pode ser renovada por refresh token com rotacao e revogacao.

## 9. Modelagem de dados

A modelagem de dados foi realizada com base nos principais objetos do dominio:

- Usuario: representa as credenciais, papel, dados pessoais, status e configuracoes de sessao.
- Paciente: representa dados de identificacao, saude, modalidade esportiva, vinculos com aluno, professor, equipe tecnica e projeto.
- Projeto: representa iniciativas vinculadas a areas, coordenadores e alunos.
- Sessao de avaliacao: agrupa avaliacoes realizadas em determinada data de referencia.
- Avaliacao: registra dados e resultados de cada modulo avaliativo, com suporte a JSONB para campos especificos por tipo.
- Agendamento: representa consultas, horarios, status e remarcacoes.
- Solicitacao de acesso: representa pedidos de acesso pendentes, aprovados ou recusados.
- Tarefa: representa demandas operacionais atribuidas a papeis.
- Notificacao: representa comunicacoes internas.
- Auditoria: registra acoes e alteracoes relevantes.
- Configuracoes do sistema: armazena parametros administrativos.
- Catalogos METs e TACO: armazenam dados auxiliares para calculos.
- Plano alimentar: armazena prescricoes, metas nutricionais e refeicoes.

Sugestao de texto:

> A modelagem de dados considerou entidades centrais do dominio de atendimento e acompanhamento multiprofissional. O uso do PostgreSQL permitiu combinar dados relacionais, como usuarios, pacientes e agendamentos, com estruturas flexiveis em JSONB para formularios de avaliacao que variam conforme o tipo de modulo. Essa estrategia reduziu rigidez excessiva do modelo e permitiu evolucao dos formularios sem necessidade de remodelagem completa a cada nova avaliacao.

## 10. Modulos de avaliacao multiprofissional

O sistema possui um registro padronizado de tipos de avaliacao, com metadados como tipo, nome, macroetapa, dominio, versao de schema, formulas associadas, campos obrigatorios, ordem de exibicao e disponibilidade para prontuario/analytics.

Os modulos avaliativos identificados sao:

- Anamnese inicial.
- Avaliacao clinica.
- Exames laboratoriais.
- Avaliacao socioeconomica com EBIA.
- Triagem RED-S.
- Perimetros corporais.
- Dobras cutaneas.
- Bioimpedancia.
- Composicao corporal integrada.
- Gasto energetico total.
- Carga de treino e periodizacao.
- Avaliacao alimentar.
- Hidratacao.
- Psicologia.
- Fisioterapia.
- Evolucao/retorno.

Esses modulos estao organizados por macroetapas, como triagem, conduta, composicao corporal, demanda e performance, rotina alimentar e acompanhamento multiprofissional.

Texto pronto:

> As avaliacoes foram estruturadas em modulos independentes, permitindo que diferentes areas profissionais registrem dados especificos do atendimento. Cada modulo possui metadados proprios, como dominio, versao de schema, campos obrigatorios e formulas associadas. Essa organizacao favorece a expansao do sistema, pois novos formularios podem ser adicionados ao registro de avaliacoes mantendo um padrao comum de exibicao, armazenamento e analise.

## 11. Desenvolvimento do frontend

O frontend foi implementado como uma Single Page Application. A aplicacao utiliza rotas para separar as principais areas do sistema:

- `/login`: autenticacao e solicitacao de acesso.
- `/admin`: area administrativa.
- `/aluno`: area do aluno.
- `/professor`: area do professor.
- `/equipe`: area da equipe tecnica.
- `/atleta`: area do atleta.
- `/avaliacao/:id`: avaliacao/prontuario.
- `/planos-alimentares/:pacienteId`: prescricao de plano alimentar.

Foram utilizados contextos para compartilhar estado global, como autenticacao, dados de paciente e feedback de interface. A comunicacao com a API foi centralizada em um servico Axios, que adiciona token de autenticacao, normaliza textos enviados, trata timeout e executa tentativa de renovacao de sessao quando necessario.

Sugestao de texto:

> A interface foi desenvolvida em React, utilizando componentes reutilizaveis e rotas protegidas. O estado de autenticacao foi centralizado em um contexto global, permitindo que a aplicacao identifique o usuario logado, seu papel e suas permissoes. As requisicoes HTTP foram encapsuladas em um servico dedicado, responsavel por anexar o token JWT, tratar erros de conexao e renovar a sessao quando aplicavel.

## 12. Desenvolvimento do backend

O backend foi implementado em NestJS, seguindo uma estrutura modular. Cada dominio possui controller para expor endpoints, service para regras de negocio, DTOs para entrada de dados e entity para persistencia.

As validacoes sao aplicadas globalmente por meio de `ValidationPipe`, com remocao de campos nao esperados e rejeicao de propriedades nao permitidas. O sistema tambem possui filtro global de excecoes para padronizar respostas de erro e registrar falhas na observabilidade.

Sugestao de texto:

> A API foi desenvolvida com NestJS, framework escolhido pela organizacao modular e suporte nativo a injecao de dependencias, validacao, guards e integracao com TypeORM. O backend concentra as regras de negocio e disponibiliza endpoints REST para consumo pelo frontend. A validacao de entrada foi configurada globalmente, reduzindo o risco de persistencia de dados inconsistentes.

## 13. Integracao em tempo real

O sistema possui modulo de comunicacao em tempo real por WebSocket, utilizando Socket.IO no backend e cliente Socket.IO no frontend. A conexao e autenticada com JWT, e os usuarios sao organizados em salas por identificador e por papel.

Esse recurso permite enviar eventos para usuarios especificos ou grupos de perfis, sendo util para notificacoes, atualizacoes operacionais e sincronizacao de estados relevantes.

Texto pronto:

> Para eventos em tempo real, foi utilizado WebSocket com Socket.IO. A conexao exige token JWT valido e respeita as mesmas restricoes de origem configuradas para a API. Apos autenticacao, o usuario e associado a salas especificas por identificador e papel, permitindo envio segmentado de notificacoes e eventos operacionais.

## 14. Catalogos e bases auxiliares

O sistema possui mecanismos de seed para popular catalogos auxiliares:

- METs: catalogo baseado no Compendio de Ainsworth 2011, usado em calculos relacionados a gasto energetico e atividade fisica.
- TACO: base de composicao de alimentos, usada no modulo alimentar e na construcao de refeicoes/planos.

Texto pronto:

> Foram incorporadas bases auxiliares ao sistema para apoiar calculos e consultas. O catalogo de METs subsidia estimativas relacionadas a atividade fisica, enquanto a base TACO apoia consultas nutricionais e composicao alimentar. Essas bases sao carregadas por scripts de seed, permitindo reproducibilidade em diferentes ambientes.

## 15. Validacao e testes

A validacao tecnica do sistema foi organizada em diferentes frentes:

- Build do frontend e backend.
- Testes core automatizados.
- Smoke test de API.
- Testes end-to-end de fluxos criticos.
- Testes de contrato por papel de usuario.
- Testes de autenticacao e sessao.
- Testes especificos de finalizacao de avaliacoes.
- Testes de analytics.
- Avaliacao de seguranca.
- Avaliacao de desempenho.
- Avaliacao de navegacao em navegador.
- Validacao de ambiente E2E.

Os scripts identificados incluem:

- `npm run build`
- `npm run test:core`
- `npm run smoke:api`
- `npm run test:e2e:critical`
- `npm run test:e2e:avaliacoes`
- `npm run test:e2e:auth-session`
- `npm run test:e2e:roles`
- `npm run test:e2e:analytics`
- `npm run assess:security`
- `npm run assess:perf`
- `npm run assess:browser`
- `npm run test:all`

Sugestao de texto:

> A validacao do sistema foi conduzida por meio de testes automatizados e verificacoes operacionais. Os testes core verificam regras essenciais da aplicacao e do backend. Os smoke tests validam a disponibilidade da API e endpoints criticos. Os testes end-to-end simulam fluxos de uso no navegador, como login, acesso por perfil, preenchimento de avaliacoes, navegacao por dashboards e validacao de permissoes. Tambem foram previstos scripts de avaliacao de seguranca, desempenho e comportamento da interface em navegador.

Importante: no TCC, registre quais comandos foram executados, em qual data, ambiente e resultado. Exemplo de tabela:

| Tipo de validacao | Comando | Resultado | Observacao |
|---|---|---|---|
| Build frontend | `npm run build` | [aprovado/reprovado] | [data e ambiente] |
| Build backend | `npm --prefix server run build` | [aprovado/reprovado] | [data e ambiente] |
| Testes core | `npm run test:core` | [aprovado/reprovado] | [resumo] |
| E2E critico | `npm run test:e2e:critical` | [aprovado/reprovado] | [credenciais de teste] |

## 16. Observabilidade e operacao

O sistema inclui recursos voltados a operacao e monitoramento:

- Endpoint de saude: `GET /health`.
- Endpoint de prontidao: `GET /ready`.
- Metricas operacionais: `GET /observability/metrics`.
- Erros recentes: `GET /observability/errors`.
- Eventos e alertas: endpoints do modulo de observabilidade.
- SLOs para disponibilidade, latencia, taxa de erro, sucesso de deploy e RTO.
- `X-Request-Id` em respostas para rastreabilidade.
- Runbooks e checklist de producao.

Texto pronto:

> Alem das funcionalidades de negocio, foram considerados aspectos operacionais da aplicacao. O backend disponibiliza endpoints de saude e prontidao, registra identificadores de requisicao e mantem metricas de erros, latencia e alertas. A documentacao operacional define objetivos de nivel de servico, procedimentos de resposta a incidentes e checklist de producao, contribuindo para a manutencao do sistema apos a implantacao.

## 17. Criterios eticos e privacidade

Como o sistema lida com informacoes pessoais e potencialmente sensiveis de pacientes/atletas, a metodologia deve mencionar cuidados eticos e de privacidade. Mesmo que o TCC seja tecnico, recomenda-se registrar:

- Uso de dados ficticios ou anonimizados durante testes.
- Restricao de acesso por perfil.
- Autenticacao obrigatoria para rotas privadas.
- Nao exposicao de senhas em texto puro.
- Registro de auditoria para acoes relevantes.
- Consentimento de pesquisa quando aplicavel.
- Adequacao as diretrizes institucionais e a LGPD.

Sugestao de texto:

> Durante o desenvolvimento e a validacao, recomenda-se a utilizacao de dados ficticios ou anonimizados, evitando exposicao de informacoes pessoais reais. O sistema foi projetado com controle de acesso por perfil, autenticacao obrigatoria, armazenamento protegido de senhas e mecanismos de auditoria. Por envolver dados relacionados a saude e acompanhamento de pacientes/atletas, a utilizacao em ambiente real deve observar as normas institucionais, termos de consentimento aplicaveis e a Lei Geral de Protecao de Dados.

## 18. Limitacoes metodologicas

As principais limitacoes que podem ser citadas sao:

- A validacao descrita e predominantemente tecnica; a validacao com usuarios reais deve ser documentada separadamente caso tenha ocorrido.
- Resultados de usabilidade, satisfacao ou impacto operacional dependem de coleta especifica com participantes.
- Testes automatizados dependem de ambiente configurado, credenciais de teste e dados de seed.
- Alguns modulos podem evoluir conforme novas demandas do laboratorio/projeto.
- A disponibilidade e desempenho em producao dependem da infraestrutura de hospedagem adotada.

Texto pronto:

> Como limitacao, destaca-se que a validacao tecnica nao substitui uma avaliacao longitudinal com usuarios finais. Os testes automatizados verificam funcionamento, permissoes e fluxos criticos, mas metricas de satisfacao, aceitabilidade e impacto na rotina de atendimento exigem instrumentos proprios de coleta, como questionarios, entrevistas ou observacao assistida. Assim, a metodologia tecnica pode ser complementada posteriormente por uma avaliacao com usuarios do LAINES.

## 19. Estrutura sugerida para o capitulo de metodologia

Uma estrutura viavel para o TCC seria:

1. Tipo e caracterizacao da pesquisa.
2. Contexto do estudo e problema abordado.
3. Levantamento de requisitos.
4. Materiais e tecnologias utilizadas.
5. Arquitetura do sistema.
6. Modelagem de dados.
7. Implementacao dos modulos.
8. Seguranca e controle de acesso.
9. Procedimentos de teste e validacao.
10. Aspectos eticos e privacidade.
11. Limitacoes.

## 20. Versao resumida para inserir direto no TCC

> A presente pesquisa consistiu no desenvolvimento de uma aplicacao web para apoio a gestao de atendimentos, pacientes, avaliacoes e acompanhamento multiprofissional no contexto do LAINES. O trabalho possui natureza aplicada, com abordagem tecnologica, pois busca entregar uma solucao pratica para organizacao de fluxos internos e registro estruturado de informacoes.
>
> O desenvolvimento foi conduzido de forma incremental, iniciando pelo levantamento dos perfis de usuario e principais necessidades do sistema. Foram definidos os papeis de administrador, aluno, professor, equipe tecnica e atleta, alem de perfis administrativos especificos. A partir desses perfis, foram modeladas as permissoes de acesso, as rotas do frontend e os endpoints do backend.
>
> A arquitetura adotada foi cliente-servidor. O frontend foi desenvolvido em React com Vite, utilizando React Router para navegacao, Axios para comunicacao com a API e componentes reutilizaveis para construcao das telas. O backend foi implementado em NestJS com TypeScript, organizado em modulos independentes, controllers, services, DTOs e entidades. A persistencia foi realizada em PostgreSQL com TypeORM, utilizando migracoes para controle da estrutura do banco de dados.
>
> O sistema contempla modulos de autenticacao, usuarios, pacientes, projetos, avaliacoes, agendamentos, solicitacoes de acesso, auditoria, notificacoes, tarefas, relatorios, configuracoes, catalogos auxiliares e planos alimentares. As avaliacoes multiprofissionais foram organizadas em um registro padronizado, abrangendo anamnese, avaliacao clinica, exames laboratoriais, EBIA, RED-S, antropometria, bioimpedancia, gasto energetico, avaliacao alimentar, hidratacao, psicologia, fisioterapia e evolucao/retorno.
>
> Para seguranca, foram utilizados JWT, refresh token com rotacao, hash de senhas, controle de acesso por papeis, validacao global de entradas, CORS configuravel, headers de seguranca e registro de auditoria. A validacao tecnica foi planejada por meio de build da aplicacao, testes automatizados, smoke tests de API, testes end-to-end, testes de contrato por papel, avaliacoes de seguranca, desempenho e navegacao em navegador.
>
> Por se tratar de um sistema que pode manipular dados pessoais e informacoes de saude, recomenda-se que os testes sejam realizados com dados ficticios ou anonimizados, respeitando as normas institucionais e a Lei Geral de Protecao de Dados. A validacao tecnica pode ser complementada por avaliacao com usuarios finais, caso o objetivo do TCC inclua usabilidade, aceitabilidade ou impacto operacional.

## 21. O que ainda precisa ser personalizado

Preencha no TCC:

- Periodo de desenvolvimento: [mes/ano a mes/ano].
- Local/contexto de aplicacao: [laboratorio, projeto, instituicao].
- Participantes do levantamento de requisitos: [professores, alunos, equipe, atletas].
- Forma de coleta dos requisitos: [reunioes, entrevistas, observacao, analise documental].
- Ambiente de desenvolvimento: [sistema operacional, versoes principais, banco local/remoto].
- Ambiente de testes: [local, staging, CI].
- Resultados dos testes: [tabela com comandos, data e status].
- Se houve avaliacao com usuarios: [quantidade, perfil, instrumento, resultados].
- Se houve comite de etica ou dispensa: [numero do parecer ou justificativa].

