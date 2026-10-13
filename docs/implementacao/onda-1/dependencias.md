# UPD-09 — dependências da aplicação

@work-item-id WI-002

Execução em 12/09/2026, Windows, Node 24.12.0 e npm. Escopo: os dois manifests e lockfiles. A proposta e as evidências da auditoria original permanecem como linha de base.

## Decisão

Atualizar bibliotecas com correções publicadas, mantendo as famílias atuais de React, Router, Vite, Nest e TypeORM. Preservar scripts, ferramentas recém-adotadas e TypeScript 5.9.3. Instalação sem `--force`, sem `--legacy-peer-deps` e sem scripts de instalação de terceiros. Não executar migrações nem acessar banco ou SMTP reais nesta frente.

As alterações não modificam regras clínicas ou de autorização. INV-001 a INV-004 são verificadas pelas regressões existentes de credenciais, eventos, upload e prescrição na integração; INV-005 e INV-006 são preservadas pela ausência de dados reais e pelo escopo restrito aos manifests.

## Correções e fontes

- Axios e React Router: atualizar dentro das majors atuais. Fontes: [Axios 1.20.0](https://github.com/axios/axios/releases/tag/v1.20.0) e [React Router 7.18.3](https://github.com/remix-run/react-router/releases/tag/react-router%407.18.3).
- Upload: Multer anterior a 2.3.0 permite derrubar o processo com campos multipart malformados. Mesmo Nest 11.2.3 ainda fixa Multer 2.2.0; um override específico é necessário para obter a correção. Fontes: [aviso do mantenedor](https://github.com/expressjs/multer/security/advisories/GHSA-wc9g-mqfw-jrwm) e [release Nest](https://github.com/nestjs/nest/releases/tag/v11.2.3).
- Eventos: atualizar Engine.IO, Socket.IO parser e ws para corrigir falhas de esgotamento de recursos. Fontes: [Engine.IO](https://github.com/socketio/socket.io/security/advisories/GHSA-r635-g3xr-vw7x), [parser](https://github.com/socketio/socket.io/security/advisories/GHSA-2m8v-j782-fhvr) e [ws](https://github.com/websockets/ws/security/advisories/GHSA-96hv-2xvq-fx4p).
- Nodemailer: atualizar dentro da série 9. TypeORM: atualizar dentro da série 0.3. O aviso de SQL injection específico de MySQL/MariaDB não corresponde ao PostgreSQL deste projeto, mas a correção de geração de migrations também justifica o patch. Fontes: [Nodemailer](https://github.com/nodemailer/nodemailer/releases) e [TypeORM](https://github.com/typeorm/typeorm/releases).

## Residual MinIO

O npm propõe um downgrade de MinIO 8.0.7 para 7.1.3 para eliminar avisos transitivos. Essa sugestão não é uma atualização compatível e não foi aplicada. A versão publicada da série 8 consultada continua em 8.0.7. O [manifest oficial](https://github.com/minio/minio-js/blob/master/package.json) ainda declara `query-string ^7.1.3` e `stream-json ^1.8.0`.

O [aviso de stream-json](https://github.com/uhop/stream-json/security/advisories/GHSA-528h-pc64-c93x) afeta filtros `pick/ignore/filter/replace` e indica correção em 3.5.0, fora da série usada pelo SDK. O MinIO instalado importa o parser JSONL para notificações; o serviço LAINES de armazenamento de imagens não chama `listenBucketNotification` nem esses filtros. A inferência de menor exposição se limita a esse caminho observado, sem retirar a dependência do inventário vulnerável.

O [aviso de decode-uri-component](https://github.com/SamVerschueren/decode-uri-component/security/advisories/GHSA-vcc3-ghjq-m6fr) afeta decodificação malformada via `query-string`. No SDK instalado, as chamadas localizadas são `qs.stringify`; não há chamada LAINES a `query-string` ou `decode-uri-component`. Uma futura atualização do SDK ou substituição do adaptador exige validar upload, leitura, remoção e URLs assinadas em armazenamento sintético. Não aplicar overrides de majors incompatíveis para zerar o contador.

## Verificação e reversão

Os números do npm contam pacotes afetados na árvore, incluindo efeitos transitivos; não são contagem de falhas exploráveis distintas. O frontend usa `BrowserRouter` em SPA: avisos SSR/RSC não provam exploração nesse modo. Vite/PostCSS aparecem também em `--omit=dev` pela árvore de Tailwind; são ferramentas de construção, não um servidor de produção autorizado.

Antes da alteração: raiz 10 pacotes afetados (9 altos, 1 moderado); backend 16 (8 altos, 7 moderados, 1 baixo), sem críticos. Evidências brutas locais em `tmp/upd09-*-audit-before.json`. Resultado final: frontend 0 avisos; backend 4 moderados, todos na árvore de MinIO, sem altos ou críticos. O patch compatível de body-parser também foi aplicado. Relatórios finais em evidencias/dependencias-frontend.json e evidencias/dependencias-backend.json. Regressões de credenciais (16), realtime (8), acesso/upload (11) e prescrição (10) passaram; o núcleo passou com 100 testes. Builds e navegador são registrados na consolidação da etapa.

Reversão: recuperar conjuntamente os manifests e lockfiles da revisão anterior a UPD-09, preservando as demais mudanças da versão; executar `npm ci` na raiz e no servidor e reconstruir. Isso também reintroduz os avisos corrigidos, portanto não é uma recomendação de publicação. Esta frente não altera schema ou dados.
