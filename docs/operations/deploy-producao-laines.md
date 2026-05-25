# Deploy de producao do LAINES App

Este deploy usa Nginx para servir o build estatico do Vite, Nginx como proxy reverso `/api` para o NestJS em `127.0.0.1:4000`, PM2 para manter a API ativa e PostgreSQL como servico local.

## Execucao na VM

Na VM Ubuntu, rode:

```bash
cd /home/admin/projetos/laines-app
bash scripts/deploy-production-ubuntu.sh
```

Para tentar emitir HTTPS automaticamente com Certbot, informe um e-mail administrativo:

```bash
cd /home/admin/projetos/laines-app
CERTBOT_EMAIL=seu-email@facisa.ufrn.br bash scripts/deploy-production-ubuntu.sh
```

O script nao imprime valores de `.env`; ele apenas informa quais arquivos existem.

## Arquitetura configurada

- Frontend: `npm run build`, servido de `/home/admin/projetos/laines-app/dist`.
- API: PM2 com processo `laines-api`, em `/home/admin/projetos/laines-app/server`.
- Backend: `npm run start:prod`, com `NODE_ENV=production`, `PORT=4000` e `HOST=127.0.0.1`.
- Proxy: `/api/...` no Nginx remove o prefixo `/api` antes de encaminhar para a API.
- Socket.IO: `/api/socket.io` no Nginx encaminha para `/socket.io` no NestJS.

## Operacao diaria

Status e logs:

```bash
pm2 status
pm2 logs laines-api
sudo systemctl status nginx --no-pager
```

Reiniciar backend:

```bash
pm2 restart laines-api --update-env
```

Rebuild do frontend:

```bash
cd /home/admin/projetos/laines-app
npm run build
sudo systemctl reload nginx
```

Rebuild do backend:

```bash
cd /home/admin/projetos/laines-app/server
npm run build
pm2 restart laines-api --update-env
```

Verificacao de saude:

```bash
curl http://127.0.0.1:4000/health
curl -H "Host: laines.facisa.ufrn.br" http://127.0.0.1/api/health
pm2 status
sudo nginx -t
```

## Dependencias da TI

Se o Certbot nao conseguir emitir HTTPS, solicitar:

- DNS de `laines.facisa.ufrn.br` apontando para a VM ou para o reverso institucional correto.
- Trafego HTTP/HTTPS liberado ate a VM ou ate o reverso institucional.
- Portas 80 e 443 liberadas no firewall institucional.
- Manter PostgreSQL e porta 4000 sem exposicao publica.
