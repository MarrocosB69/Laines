import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const DIRECTORIES = ['src', 'server/src', 'server/scripts', 'scripts', 'e2e-artifacts/journey-audit']
  .map((relativePath) => path.resolve(PROJECT_ROOT, relativePath))
  .filter((absolutePath) => fs.existsSync(absolutePath));
const ROOT_FILES = ['index.html']
  .map((relativePath) => path.resolve(PROJECT_ROOT, relativePath))
  .filter((absolutePath) => fs.existsSync(absolutePath));

const EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.css',
  '.md',
  '.json',
  '.html',
  '.mjs',
]);

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git',
]);

// Moji-bake patterns represented with explicit Unicode escapes to avoid editor corruption.
const BAD_PATTERNS = [
  /\uFFFD/u, // replacement character
  /\u00EF\u00BF\u00BD/u, // visible U+00EF U+00BF U+00BD sequence
  /\u00C3[\u0080-\u00BF]/u, // "Ãx"
  /\u00C2[\u0080-\u00BF]/u, // "Âx"
  /\u00E2[\u0080-\u00BF]{2}/u, // "â€™", "â€œ", etc
];

const shouldTrackFile = (filename) => EXTENSIONS.has(path.extname(filename));

const walk = (directory, results = []) => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        walk(fullPath, results);
      }
      continue;
    }

    if (shouldTrackFile(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
};

const findBadLines = (content) => {
  const lines = content.split(/\r?\n/);
  const issues = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (BAD_PATTERNS.some((pattern) => pattern.test(line))) {
      issues.push({ lineNumber: index + 1, line });
    }
  }
  return issues;
};

const files = [
  ...ROOT_FILES,
  ...DIRECTORIES.flatMap((directory) => walk(directory)),
];

let hasIssues = false;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const issues = findBadLines(content);
  if (issues.length === 0) continue;

  hasIssues = true;
  console.error(`\nEncoding issues found in: ${path.relative(PROJECT_ROOT, file)}`);
  for (const issue of issues) {
    console.error(`  ${issue.lineNumber}: ${issue.line}`);
  }
}

if (hasIssues) {
  console.error('\nFix the encoding issues above before building.');
  process.exit(1);
}

console.log('Encoding check passed.');
