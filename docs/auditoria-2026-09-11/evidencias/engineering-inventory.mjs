import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import zlib from 'node:zlib';

const require = createRequire(path.resolve('package.json'));
const root = process.cwd();
const out = path.resolve('docs/auditoria-2026-09-11/evidencias');
const files = [];
const walk = (directory) => {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '.git', '__pycache__'].includes(entry.name)) walk(full);
    } else files.push(full);
  }
};
['src', 'server/src', 'scripts', 'tests', 'laines-image-processor'].forEach(walk);
const source = files.filter((file) => /\.(jsx?|tsx?|css|mjs|cjs|py)$/.test(file)).map((file) => ({
  file: file.replaceAll('\\', '/'),
  bytes: fs.statSync(file).size,
  lines: fs.readFileSync(file, 'utf8').split(/\r?\n/).length,
}));
const byGroup = {};
for (const entry of source) {
  const group = entry.file.startsWith('server/src') ? 'server/src' : entry.file.split('/')[0];
  byGroup[group] ||= { files: 0, lines: 0, bytes: 0 };
  byGroup[group].files += 1;
  byGroup[group].lines += entry.lines;
  byGroup[group].bytes += entry.bytes;
}
let yaml;
try { yaml = require('js-yaml'); } catch { yaml = require('./server/node_modules/js-yaml'); }
const workflows = fs.readdirSync('.github/workflows').filter((name) => /\.ya?ml$/.test(name)).map((file) => {
  try {
    yaml.load(fs.readFileSync(path.join('.github/workflows', file), 'utf8'));
    return { file, valid: true };
  } catch (error) {
    return { file, valid: false, reason: error.reason, line: error.mark?.line + 1, column: error.mark?.column + 1 };
  }
});
const assets = fs.readdirSync('dist/assets').filter((name) => /\.(js|css)$/.test(name)).map((file) => {
  const contents = fs.readFileSync(path.join('dist/assets', file));
  return { file, bytes: contents.length, gzipBytes: zlib.gzipSync(contents).length };
});
const result = { recordedAt: new Date().toISOString(), byGroup, largestSource: source.sort((a,b) => b.lines-a.lines).slice(0, 25), workflows, largestAssets: assets.sort((a,b)=>b.bytes-a.bytes).slice(0, 15), assetTotals: { files: assets.length, bytes: assets.reduce((s,a)=>s+a.bytes,0), gzipBytes: assets.reduce((s,a)=>s+a.gzipBytes,0) }, migrationCount: fs.readdirSync('server/src/database/migrations').filter((f)=>f.endsWith('.ts')).length };
fs.writeFileSync(path.join(out, 'engineering-inventory.json'), JSON.stringify(result, null, 2)+'\n');
console.log(JSON.stringify(result, null, 2));
