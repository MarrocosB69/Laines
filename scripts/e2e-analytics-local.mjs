import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const apiBaseUrl = process.env.E2E_API_BASE_URL || process.env.API_BASE_URL || "http://127.0.0.1:4000";

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  return raw.split(/\r?\n/).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return acc;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) return acc;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    acc[key] = value;
    return acc;
  }, {});
};

const envFileValues = parseEnvFile(path.resolve(process.cwd(), "server", ".env"));

const localEnv = {
  ...process.env,
  E2E_API_BASE_URL: apiBaseUrl,
  E2E_ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL || "admin.ci@laines.ufrn.br",
  E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD || "Admin#123456",
  E2E_STUDENT_EMAIL: process.env.E2E_STUDENT_EMAIL || "aluno.ci@laines.ufrn.br",
  E2E_STUDENT_PASSWORD: process.env.E2E_STUDENT_PASSWORD || "Aluno#123456",
  E2E_PROFESSOR_EMAIL: process.env.E2E_PROFESSOR_EMAIL || "professor.ci@laines.ufrn.br",
  E2E_PROFESSOR_PASSWORD: process.env.E2E_PROFESSOR_PASSWORD || "Professor#123456",
  E2E_ANALYTICS_PROJECT_ID: process.env.E2E_ANALYTICS_PROJECT_ID || "11111111-1111-4111-8111-111111111111",
  DB_HOST: process.env.DB_HOST || envFileValues.DB_HOST || "127.0.0.1",
  DB_PORT: process.env.DB_PORT || envFileValues.DB_PORT || "5432",
  DB_USER: process.env.DB_USER || envFileValues.DB_USER || "laines",
  DB_PASSWORD: process.env.DB_PASSWORD || envFileValues.DB_PASSWORD || "",
  DB_NAME: process.env.DB_NAME || envFileValues.DB_NAME || "laines"
};

const runStep = (label, cmd, args) => {
  console.log(`[e2e-analytics-local] ${label}`);
  const result = spawnSync(cmd, args, {
    env: localEnv,
    stdio: "inherit",
    shell: false
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

const ensureApiUp = async () => {
  const response = await fetch(`${apiBaseUrl}/health`);
  if (!response.ok) {
    throw new Error(`API health check failed with status ${response.status}`);
  }
};

const main = async () => {
  console.log(`[e2e-analytics-local] API base: ${apiBaseUrl}`);
  await ensureApiUp();
  runStep("seed users", "node", ["server/scripts/seed-ci-users.js"]);
  runStep("seed analytics fixture", "node", ["server/scripts/seed-ci-analytics.js"]);
  runStep("run analytics e2e", "node", ["scripts/e2e-analytics.mjs"]);
};

main().catch((error) => {
  console.error(`[e2e-analytics-local] failed: ${error.message}`);
  process.exit(1);
});
