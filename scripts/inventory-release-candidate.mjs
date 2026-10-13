// Inventario local dos bytes copiados por package-release em deploy.yml.
// Uso: node scripts/inventory-release-candidate.mjs create candidato.json
//      node scripts/inventory-release-candidate.mjs verify candidato.json
// A saida fica sempre em tmp/onda3-inventario/; nunca le .env ou uploads.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'tmp', 'onda3-inventario');
const workflowPath = path.join(root, '.github', 'workflows', 'deploy.yml');
const requiredCopies = [
  'cp -R dist/. release/frontend/',
  'cp -R server/dist release/server/dist',
  'cp server/package.json release/server/package.json',
  'cp server/package-lock.json release/server/package-lock.json',
];
const sections = [
  { source: 'dist', release: 'frontend' },
  { source: 'server/dist', release: 'server/dist' },
  { source: 'server/package.json', release: 'server/package.json' },
  { source: 'server/package-lock.json', release: 'server/package-lock.json' },
];

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const posix = value => value.split(path.sep).join('/');

function filenameFromArgument(value) {
  assert.match(value ?? '', /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/, 'Informe somente um nome .json, sem diretorio');
  return path.join(outputDir, value);
}

async function workflowDigest() {
  const bytes = await fs.readFile(workflowPath);
  const workflow = bytes.toString('utf8');
  const start = workflow.indexOf('- name: Prepare release artifact');
  const end = workflow.indexOf('- name: Upload release artifact', start);
  assert.ok(start >= 0 && end > start, 'Etapa package-release nao encontrada');
  const recipe = workflow.slice(start, end);
  for (const command of requiredCopies) {
    assert.ok(recipe.includes(command), `Receita de pacote mudou: ${command}`);
  }
  const copies = [...recipe.matchAll(/^\s*(cp\s+[^\r\n]+)$/gm)].map(match => match[1].trim()).sort();
  assert.deepEqual(copies, [...requiredCopies].sort(), 'Receita de copia do pacote mudou');
  assert.ok(!/processor|processador/i.test(recipe), 'Receita passou a incluir processador; revise o escopo do inventario');
  return hash(bytes);
}

async function enumerate() {
  const files = [];
  async function visit(source, release) {
    const absolute = path.join(root, source);
    const stat = await fs.lstat(absolute);
    assert.ok(!stat.isSymbolicLink(), `Link simbolico fora do inventario: ${source}`);
    if (stat.isDirectory()) {
      const children = (await fs.readdir(absolute)).sort();
      for (const child of children) {
        await visit(path.join(source, child), `${release}/${child}`);
      }
      return;
    }
    assert.ok(stat.isFile(), `Entrada nao regular: ${source}`);
    const bytes = await fs.readFile(absolute);
    files.push({ path: posix(release), bytes: bytes.length, sha256: hash(bytes) });
  }
  for (const section of sections) await visit(section.source, section.release);
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  assert.ok(files.some(file => file.path === 'frontend/index.html'), 'Build frontend ausente');
  assert.ok(files.some(file => file.path === 'server/dist/main.js'), 'Build backend ausente');
  assert.ok(files.length > 4, 'Inventario vazio');
  const canonical = files.map(file => `${file.path}\0${file.bytes}\0${file.sha256}\n`).join('');
  return { files, aggregateSha256: hash(canonical) };
}

function gitState() {
  const run = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const lines = run(['status', '--porcelain=v1', '--untracked-files=all']).split(/\r?\n/).filter(Boolean);
  return { head: run(['rev-parse', 'HEAD']), workingTreeClean: lines.length === 0, statusLineCount: lines.length };
}

const [mode, filename] = process.argv.slice(2);
assert.ok(mode === 'create' || mode === 'verify', 'Use create ou verify');
const manifestPath = filenameFromArgument(filename);
const recipeSha256 = await workflowDigest();
const current = await enumerate();

if (mode === 'create') {
  await fs.mkdir(outputDir, { recursive: true });
  const manifest = {
    schemaVersion: 1,
    kind: 'local-release-candidate-inventory',
    createdAtUtc: new Date().toISOString(),
    git: gitState(),
    recipe: { path: '.github/workflows/deploy.yml', sha256: recipeSha256 },
    fileCount: current.files.length,
    aggregateSha256: current.aggregateSha256,
    files: current.files,
    limits: [
      'Os builds foram inspecionados localmente; este inventario nao prova que derivam do HEAD.',
      'Uma arvore de trabalho alterada nao e uma revisao imutavel nem evidencia de CI remoto.',
      'O processador de imagem nao integra o pacote definido no workflow atual.',
      'Banco, uploads, storage remoto, configuracao efetiva e deploy nao fazem parte deste inventario.',
    ],
  };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ result: 'created', manifest: posix(path.relative(root, manifestPath)), files: manifest.fileCount, aggregateSha256: manifest.aggregateSha256, git: manifest.git }, null, 2));
} else {
  const expected = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  assert.equal(expected.schemaVersion, 1);
  assert.equal(expected.kind, 'local-release-candidate-inventory');
  assert.equal(expected.recipe?.sha256, recipeSha256, 'Workflow alterado desde a captura');
  const before = new Map(expected.files.map(file => [file.path, file]));
  const after = new Map(current.files.map(file => [file.path, file]));
  const absent = [...before.keys()].filter(file => !after.has(file));
  const added = [...after.keys()].filter(file => !before.has(file));
  const changed = [...before.keys()].filter(file => after.has(file) && (before.get(file).bytes !== after.get(file).bytes || before.get(file).sha256 !== after.get(file).sha256));
  assert.deepEqual({ absent, added, changed }, { absent: [], added: [], changed: [] }, 'Arquivos do candidato divergiram');
  assert.equal(expected.fileCount, current.files.length, 'Contagem divergente');
  assert.equal(expected.aggregateSha256, current.aggregateSha256, 'Hash agregado divergente');
  console.log(JSON.stringify({ result: 'verified', manifest: posix(path.relative(root, manifestPath)), files: current.files.length, aggregateSha256: current.aggregateSha256, gitNow: gitState() }, null, 2));
}
