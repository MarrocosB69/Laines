# Auth V2 + CSP Rollout

## Novo fluxo de autenticação (V2)

- `POST /auth/login` com header `x-auth-flow: v2`:
  - retorna `accessToken` no corpo.
  - envia `refreshToken` em cookie `HttpOnly`.
- `POST /auth/refresh`:
  - usa apenas cookie `refreshToken`.
  - faz rotação: invalida o refresh anterior e emite um novo par.
- `POST /auth/logout`:
  - revoga o refresh token atual.
  - limpa cookie.
- `POST /auth/logout-all`:
  - mantém comportamento de revogação global (`session_version` + refresh tokens).

## Reuse detection

- Se um refresh token já usado for reutilizado:
  - backend revoga a família e todos os refresh tokens do usuário.
  - incrementa `session_version` para invalidar access tokens ativos.
  - retorna `401` com código `REFRESH_TOKEN_REUSE_DETECTED`.

## Feature flags

- Frontend: `VITE_NEW_AUTH_FLOW=true` ativa o fluxo V2.
- Backend: `AUTH_NEW_FLOW_ENABLED=false` desativa endpoints/fluxo V2 e força fallback para V1.

## Cookies de refresh

- `HttpOnly=true`
- `Secure` por ambiente (`AUTH_REFRESH_COOKIE_SECURE`; default `true` em produção)
- `SameSite` (`AUTH_REFRESH_COOKIE_SAMESITE`; default `lax`)
- `Path` (`AUTH_REFRESH_COOKIE_PATH`; default `/auth`)
- `Domain` opcional (`AUTH_REFRESH_COOKIE_DOMAIN`)

## CSP

- `CSP_MODE=report-only|enforce|off`
- `CSP_POLICY` pode sobrescrever a política padrão.
- Endpoint de relatório: `POST /csp-report`.

## Rollout sugerido

1. Subir backend com `AUTH_NEW_FLOW_ENABLED=true` e `CSP_MODE=report-only`.
2. Ativar `VITE_NEW_AUTH_FLOW=true` só para time interno.
3. Acompanhar:
   - taxa de erro em `POST /auth/refresh`
   - eventos de `REFRESH_TOKEN_REUSE_DETECTED`
   - relatórios CSP em `/csp-report`
4. Migrar `CSP_MODE` para `enforce` após período de observação.
