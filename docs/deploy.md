# Deploy

## Estado in-process

O LAINES APP ainda possui caches in-process no fluxo de autenticacao, incluindo
coalescing/LRU de comparacao bcrypt e emissao de resposta de login.

Enquanto esses caches estiverem ativos, mantenha o PM2 em modo fork/single
process. Nao habilite PM2 cluster mode sem migrar esse estado para armazenamento
compartilhado ou sem aceitar a perda de coalescing entre workers.

O rastreamento de tentativas de login fica persistido em PostgreSQL na tabela
`login_attempts`.

## Primeiro administrador

Em um banco novo, crie o primeiro administrador com o bootstrap de uso unico:

```bash
BOOTSTRAP_ADMIN_EMAIL=admin@instituicao.br \
BOOTSTRAP_ADMIN_PASSWORD='SenhaInicialForte123' \
BOOTSTRAP_ADMIN_NAME='Administrador LAINES' \
npm --prefix server run bootstrap:admin
```

O script aborta se ja existir qualquer `admin`, `coordenacao`, `presidente` ou
`vice` ativo. A senha inicial nao e gravada em texto puro e o usuario criado fica
com `mustChangePassword=true`, exigindo troca de senha no primeiro acesso.
