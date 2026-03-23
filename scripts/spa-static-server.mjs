import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const rootDir = path.resolve(process.argv[2] || 'dist');
const host = process.env.STATIC_HOST || '127.0.0.1';
const port = Number(process.env.STATIC_PORT || process.argv[3] || 4173);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8'
};

const safeRead = (filePath) => {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
};

const resolveRequestPath = (requestUrl) => {
  const parsed = url.parse(requestUrl || '/');
  const pathname = decodeURIComponent(parsed.pathname || '/');
  if (!pathname || pathname === '/') {
    return path.join(rootDir, 'index.html');
  }

  const normalized = pathname.replace(/^\/+/, '');
  const fullPath = path.resolve(rootDir, normalized);
  if (!fullPath.startsWith(rootDir)) {
    return null;
  }
  return fullPath;
};

const server = http.createServer((req, res) => {
  const targetPath = resolveRequestPath(req.url || '/');
  if (!targetPath) {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }

  let finalPath = targetPath;
  let content = safeRead(finalPath);

  if (!content && fs.existsSync(`${targetPath}.html`)) {
    finalPath = `${targetPath}.html`;
    content = safeRead(finalPath);
  }

  if (!content) {
    finalPath = path.join(rootDir, 'index.html');
    content = safeRead(finalPath);
  }

  if (!content) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  const ext = path.extname(finalPath).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
  res.end(content);
});

server.listen(port, host, () => {
  console.log(`[spa-static-server] serving ${rootDir} on http://${host}:${port}`);
});
