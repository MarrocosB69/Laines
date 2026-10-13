# LAINES Mobile/PWA

O mobile do LAINES usa o mesmo frontend React/Vite publicado em `https://laines.facisa.ufrn.br` e a mesma API NestJS via `/api`.

## Configuracao esperada

- Frontend em producao: `https://laines.facisa.ufrn.br`
- API no mesmo dominio: `https://laines.facisa.ufrn.br/api`
- `.env.production` do frontend: `VITE_API_URL=/api`
- `server/.env` em producao: `CORS_ORIGIN=https://laines.facisa.ufrn.br`
- Nginx deve servir o `dist` e encaminhar `/api` para `http://127.0.0.1:4000`.

## Instalacao no celular

No Android/Chrome, abrir `https://laines.facisa.ufrn.br` e usar "Adicionar a tela inicial".

No iPhone/Safari, abrir `https://laines.facisa.ufrn.br`, tocar em compartilhar e usar "Adicionar a Tela de Inicio".

## Regras de cache

O service worker cacheia apenas shell/arquivos estaticos. Chamadas `/api` e `/socket.io` nao sao cacheadas para evitar exposicao ou uso de dados clinicos desatualizados.

## Proximos passos para ficar mais parecido com app nativo

- Gerar icones PNG 192x192 e 512x512 oficiais para melhorar instalabilidade Android.
- Revisar telas de maior uso em viewport 390x844 e 430x932.
- Criar uma barra inferior mobile para acoes frequentes de cada perfil, se o uso em campo justificar.
- Depois do PWA estabilizado, avaliar Capacitor somente se houver necessidade real de recursos nativos.
