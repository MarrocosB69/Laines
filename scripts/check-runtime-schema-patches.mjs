import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "server", "src");
const MIGRATIONS_DIR = path.resolve(ROOT, "database", "migrations");
const EXTENSIONS = new Set([".ts"]);
const FORBIDDEN_PATTERNS = [
  /\bensureUsersTempPasswordColumn\b/,
  /\bALTER\s+TABLE\b/i,
  /\bCREATE\s+TABLE\b/i,
  /\bDROP\s+TABLE\b/i,
  /\bADD\s+COLUMN\b/i,
];

const shouldIgnoreFile = (filePath) => {
  const normalized = filePath.replace(/\\/g, "/");
  const migrationsNormalized = MIGRATIONS_DIR.replace(/\\/g, "/");
  return normalized.startsWith(migrationsNormalized);
};

const walkFiles = (dir, acc = []) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, acc);
      continue;
    }
    if (EXTENSIONS.has(path.extname(entry.name))) {
      acc.push(fullPath);
    }
  }
  return acc;
};

const findViolations = (content) => {
  const lines = content.split(/\r?\n/);
  const violations = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(line))) {
      violations.push({ line: i + 1, content: line.trim() });
    }
  }
  return violations;
};

const files = walkFiles(ROOT).filter((file) => !shouldIgnoreFile(file));
let hasViolations = false;

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const violations = findViolations(content);
  if (violations.length === 0) continue;

  hasViolations = true;
  const relativePath = path.relative(process.cwd(), file);
  console.error(`\nForbidden runtime schema pattern in ${relativePath}`);
  for (const violation of violations) {
    console.error(`  L${violation.line}: ${violation.content}`);
  }
}

if (hasViolations) {
  console.error(
    "\nRuntime schema patches are not allowed outside migrations. Use TypeORM migrations only."
  );
  process.exit(1);
}

console.log("Runtime schema patch guard passed.");
