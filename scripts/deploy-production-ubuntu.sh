#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/admin/projetos/laines-app}"
SERVER_DIR="${SERVER_DIR:-$PROJECT_DIR/server}"
DOMAIN="${DOMAIN:-laines.facisa.ufrn.br}"
VM_IP="${VM_IP:-10.3.227.82}"
APP_USER="${APP_USER:-admin}"
SITE_CONF="/etc/nginx/sites-available/$DOMAIN"
SITE_LINK="/etc/nginx/sites-enabled/$DOMAIN"
TLS_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
TLS_KEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
STAMP="$(date +%Y%m%d-%H%M)"

log() {
  printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

backup_file() {
  local target="$1"
  if [ -e "$target" ] || [ -L "$target" ]; then
    local backup="$target.bak-$STAMP"
    if [[ "$target" == /etc/* ]]; then
      sudo cp -a "$target" "$backup"
    else
      cp -a "$target" "$backup"
    fi
    printf 'Backup criado: %s\n' "$backup"
  fi
}

has_tls_certificate() {
  sudo test -f "$TLS_CERT" && sudo test -f "$TLS_KEY"
}

require_project() {
  if [ ! -d "$PROJECT_DIR" ] || [ ! -f "$PROJECT_DIR/package.json" ] || [ ! -d "$SERVER_DIR" ]; then
    echo "Projeto nao encontrado em $PROJECT_DIR" >&2
    exit 1
  fi
}

ensure_sudo() {
  if sudo -n true 2>/dev/null; then
    return
  fi
  log "Validando sudo; a VM pode pedir a senha do usuario $APP_USER."
  sudo -v
}

print_versions_and_scripts() {
  log "Versoes e scripts detectados"
  node -v
  npm -v
  node -e "const p=require('./package.json'); console.log('frontend build:', p.scripts && p.scripts.build);"
  node -e "const p=require('./server/package.json'); console.log('backend build:', p.scripts && p.scripts.build); console.log('backend start:prod:', p.scripts && p.scripts['start:prod']);"
  for f in .env .env.production .env.example server/.env server/.env.example; do
    if [ -e "$f" ]; then
      printf 'Arquivo de ambiente encontrado: %s (conteudo oculto)\n' "$f"
    fi
  done
}

ensure_dependencies() {
  log "Conferindo dependencias de sistema"
  if ! command -v nginx >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y nginx
  fi
  sudo systemctl enable --now nginx

  if ! command -v pm2 >/dev/null 2>&1; then
    sudo npm install -g pm2
  fi
}

ensure_node_modules() {
  log "Conferindo dependencias Node"
  if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    (cd "$PROJECT_DIR" && npm ci)
  fi
  if [ ! -d "$SERVER_DIR/node_modules" ]; then
    (cd "$SERVER_DIR" && npm ci)
  fi
}

write_frontend_env() {
  log "Preparando configuracao de build do frontend"
  if [ -e "$PROJECT_DIR/.env.production" ]; then
    backup_file "$PROJECT_DIR/.env.production"
  fi
  cat > "$PROJECT_DIR/.env.production" <<'ENVEOF'
VITE_API_URL=/api
VITE_API_TIMEOUT_MS=15000
VITE_NEW_AUTH_FLOW=true
VITE_DASHBOARD_REFRESH_MS=60000
ENVEOF
}

build_frontend() {
  log "Gerando build estatico do frontend"
  (cd "$PROJECT_DIR" && npm run build)
  test -f "$PROJECT_DIR/dist/index.html"
}

build_backend() {
  log "Gerando build de producao do backend"
  (cd "$SERVER_DIR" && npm run build)
  test -f "$SERVER_DIR/dist/main.js"
}

configure_nginx() {
  log "Configurando Nginx"
  local template="$PROJECT_DIR/deploy/nginx/$DOMAIN.conf"
  local http_template="$PROJECT_DIR/deploy/nginx/$DOMAIN-http.conf"
  local selected_template="$template"
  if ! has_tls_certificate; then
    selected_template="$http_template"
    echo "Certificado TLS ainda nao encontrado; usando configuracao HTTP temporaria."
  fi
  if [ ! -f "$selected_template" ]; then
    echo "Template Nginx nao encontrado: $selected_template" >&2
    exit 1
  fi

  backup_file "$SITE_CONF"
  # envsubst substitui ${MINIO_CSP_ORIGIN} no CSP do nginx.
  # Defina MINIO_CSP_ORIGIN no ambiente antes do deploy quando usar MinIO externo
  # (ex: export MINIO_CSP_ORIGIN="https://minio.facisa.ufrn.br:9000").
  # Deixe vazio para driver local (padrão).
  MINIO_CSP_ORIGIN="${MINIO_CSP_ORIGIN:-}" envsubst '${MINIO_CSP_ORIGIN}' < "$selected_template" | sudo tee "$SITE_CONF" > /dev/null

  if [ -e /etc/nginx/sites-enabled/default ] || [ -L /etc/nginx/sites-enabled/default ]; then
    backup_file /etc/nginx/sites-enabled/default
    sudo rm -f /etc/nginx/sites-enabled/default
  fi

  sudo ln -sfn "$SITE_CONF" "$SITE_LINK"
  sudo nginx -t
  sudo systemctl reload nginx
  sudo systemctl status nginx --no-pager
}

maybe_configure_https() {
  log "Verificando possibilidade de HTTPS"
  local resolved_ip
  resolved_ip="$(getent ahostsv4 "$DOMAIN" | awk '{ print $1; exit }' || true)"
  if [ -z "$resolved_ip" ]; then
    echo "DNS ainda nao resolveu para $DOMAIN. HTTPS automatico ignorado."
    return
  fi
  echo "DNS local para $DOMAIN: $resolved_ip"

  if [ -z "${CERTBOT_EMAIL:-}" ]; then
    echo "CERTBOT_EMAIL nao definido. Pulando Certbot para evitar emissao sem contato administrativo."
    return
  fi

  if ! command -v certbot >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
  fi

  sudo certbot --nginx \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --redirect \
    -m "$CERTBOT_EMAIL"
}

configure_pm2() {
  log "Configurando PM2"
  local scheme="http"
  local secure_cookie="false"
  if has_tls_certificate; then
    scheme="https"
    secure_cookie="true"
  fi

  export LAINES_DOMAIN="$DOMAIN"
  export LAINES_VM_IP="$VM_IP"
  export LAINES_PUBLIC_SCHEME="${LAINES_PUBLIC_SCHEME:-$scheme}"
  export AUTH_REFRESH_COOKIE_SECURE="${AUTH_REFRESH_COOKIE_SECURE:-$secure_cookie}"

  if pm2 describe laines-api >/dev/null 2>&1; then
    (cd "$PROJECT_DIR" && pm2 reload ecosystem.config.cjs --only laines-api --update-env)
  else
    (cd "$PROJECT_DIR" && pm2 start ecosystem.config.cjs --only laines-api)
  fi
  pm2 save

  local startup_output
  startup_output="$(pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" || true)"
  printf '%s\n' "$startup_output"

  local startup_cmd
  startup_cmd="$(printf '%s\n' "$startup_output" | sed -n 's/.*\(sudo env PATH=.*pm2 startup.*\)$/\1/p' | tail -n 1)"
  if [ -n "$startup_cmd" ]; then
    eval "$startup_cmd"
    pm2 save
  fi
}

configure_firewall() {
  log "Verificando firewall"
  if ! command -v ufw >/dev/null 2>&1; then
    echo "UFW nao instalado; nenhuma regra alterada."
    return
  fi

  sudo ufw status verbose
  if sudo ufw status | grep -qi "Status: active"; then
    sudo ufw allow OpenSSH
    sudo ufw allow 'Nginx Full' || {
      sudo ufw allow 80/tcp
      sudo ufw allow 443/tcp
    }
    sudo ufw deny 4000/tcp || true
    sudo ufw status verbose
  else
    echo "UFW inativo; nao habilitei firewall automaticamente para nao arriscar bloquear SSH."
  fi
}

run_checks() {
  log "Testes finais"
  node -v
  npm -v
  pm2 status
  curl -fsS http://127.0.0.1:4000/health
  sudo nginx -t
  sudo systemctl status nginx --no-pager
  if has_tls_certificate; then
    curl -fkS --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health"
    curl -fkSI --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/"
  else
    curl -fsS -H "Host: $DOMAIN" http://127.0.0.1/api/health
    curl -fsSI -H "Host: $DOMAIN" http://127.0.0.1
  fi
  pm2 reload laines-api --update-env
  pm2 logs laines-api --lines 50 --nostream
}

main() {
  require_project
  ensure_sudo
  cd "$PROJECT_DIR"
  print_versions_and_scripts
  ensure_dependencies
  ensure_node_modules
  write_frontend_env
  build_frontend
  build_backend
  configure_nginx
  maybe_configure_https
  if has_tls_certificate; then
    configure_nginx
  fi
  configure_pm2
  configure_firewall
  run_checks

  log "Deploy concluido. Se o HTTPS foi pulado, a TI ainda precisa liberar DNS e portas 80/443."
}

main "$@"
