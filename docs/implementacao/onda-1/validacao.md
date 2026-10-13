# Reproduzir a validação local

@work-item-id WI-002

## Verificações sem banco

Na raiz, com as dependências dos dois lockfiles instaladas:

```text
npm run test:core
npm run test:security
npm run lint
npm run guard:schema
npm run test:meal-plan:browser
```

Em PowerShell, usar npm.cmd. O teste de navegador requer Chromium instalado pelo Playwright, abre somente 127.0.0.1:54111, intercepta a API e bloqueia destinos externos. Resultados e capturas sintéticas ficam em tmp/onda1-athlete-meal-plan. O servidor de teste é encerrado ao terminar. Não mede a jornada completa autenticada.

## PostgreSQL, HTTP e WebSocket

O teste de integração recusa qualquer ambiente diferente de DB_HOST=127.0.0.1, DB_PORT=55439, DB_NAME=laines_onda0 e ONDA0_API_URL=http://127.0.0.1:44100. Essa restrição evita executá-lo acidentalmente em produção.

Preparar uma instância PostgreSQL temporária, ouvindo somente loopback na porta 55439, com usuário laines_test e banco laines_onda0. Na execução registrada foi usado PostgreSQL 18, diretório tmp/pg-onda0-20260912. Não reutilizar banco ou volume clínico. O teste cria dados sintéticos; não limpa nem altera outro ambiente.

Definir no processo de teste: DB_USER=laines_test, DB_PASSWORD=synthetic-only, DB_SYNC=false, DB_MIGRATIONS_RUN=false, NODE_ENV=test, MAIL_ENABLED=false, PORT=44100, AUTH_NEW_FLOW_ENABLED=true e os dois JWT secrets exclusivamente sintéticos. Definir CORS_ORIGIN=http://127.0.0.1:4173. Essas variáveis devem prevalecer sobre qualquer .env local.

```text
npm --prefix server run build
npm --prefix server run migration:run
node server/dist/main.js
```

Depois que a API iniciar, em outro processo com as mesmas variáveis e ONDA0_API_URL definido:

```text
npm run test:integration:isolated
```

São cinco grupos de integração: migração/proibição de senha em texto; logout de família HTTP/socket; consumo concorrente do desafio e revogação; round-trip/CAS do plano; publicação e entrega com PDF, cópia do publicado, rollback e concorrência. O envio de email é substituído em memória. Ao terminar, encerrar somente a API e a instância temporárias. Na execução registrada ambas foram encerradas.

## Evidência desta execução

- [Resultados do PostgreSQL](evidencias/postgresql.txt).
- [Resultados do navegador](evidencias/navegador.json), [320 px](evidencias/plano-320.png), [390 px](evidencias/plano-390.png) e [1280 px](evidencias/plano-1280.png).
- [Núcleo](evidencias/core.txt) e [segurança/prescrição](evidencias/seguranca-prescricao.txt).
- [Lint](evidencias/lint.txt), [build frontend](evidencias/build-frontend-resultado.json) e [backend](evidencias/build-backend.txt).
- [Fontes identificadas por hash](evidencias/manifesto-fontes.json).

Resultado: 100 verificações do núcleo, 45 de segurança/prescrição, 5 grupos PostgreSQL e 10 cenários de navegador aprovados. Lint: zero erros e dez avisos existentes. Builds frontend/backend aprovados; chunks grandes permanecem como dívida de desempenho. YAML dos workflows e guard de schema válidos. Não houve execução remota de CI, teste de SMTP real, deploy ou homologação clínica.
