const domain = process.env.LAINES_DOMAIN || 'laines.facisa.ufrn.br';
const vmIp = process.env.LAINES_VM_IP || '10.3.227.82';
const publicScheme = process.env.LAINES_PUBLIC_SCHEME || 'https';
const publicBaseUrl = (process.env.LAINES_PUBLIC_BASE_URL || `${publicScheme}://${domain}`).replace(/\/+$/, '');
const corsOrigin = process.env.CORS_ORIGIN || [
  `https://${domain}`,
  `http://${domain}`,
  `http://${vmIp}`
].join(',');

module.exports = {
  apps: [
    {
      name: 'laines-api',
      cwd: '/home/admin/projetos/laines-app/server',
      script: 'npm',
      args: 'run start:prod',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '768M',
      kill_timeout: 10000,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: '4000',
        HOST: '127.0.0.1',
        TRUST_PROXY: 'loopback',
        CORS_ORIGIN: corsOrigin,
        API_BASE_URL: `${publicBaseUrl}/api`,
        UPLOAD_BASE_URL: `${publicBaseUrl}/api`,
        AUTH_REFRESH_COOKIE_PATH: '/api/auth',
        AUTH_REFRESH_COOKIE_SECURE: process.env.AUTH_REFRESH_COOKIE_SECURE
          || (publicScheme === 'https' ? 'true' : 'false'),
        CSP_REPORT_URI: '/api/csp-report'
      }
    }
  ]
};
