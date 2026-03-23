import fs from "node:fs";
import path from "node:path";
import axios from "axios";

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:4000";
const ADMIN_TOKEN = process.env.DRILL_ADMIN_TOKEN || "";
const SAMPLES = Number(process.env.DRILL_SAMPLES || 120);
const OUTPUT_DIR = process.env.DRILL_OUTPUT_DIR || path.resolve(process.cwd(), "drill-artifacts");

if (!ADMIN_TOKEN) {
  console.error("Missing DRILL_ADMIN_TOKEN environment variable.");
  process.exit(1);
}

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    Authorization: `Bearer ${ADMIN_TOKEN}`,
    "Content-Type": "application/json"
  }
});

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const parseIsoMs = (value) => {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const filterAlertsByWindow = (alerts, startedAtMs) => {
  if (!Array.isArray(alerts)) return [];
  return alerts.filter((item) => parseIsoMs(item?.timestamp) >= startedAtMs);
};

const writeStageArtifact = (name, payload) => {
  ensureDir(OUTPUT_DIR);
  const fullPath = path.join(OUTPUT_DIR, `${name}.json`);
  fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const assertAlertPresent = (alerts, key) => {
  if (!alerts.some((item) => item.key === key && item.status === "triggered")) {
    throw new Error(`Expected alert ${key} to be triggered during current stage.`);
  }
};

const assertAlertResolved = (alerts, key) => {
  if (!alerts.some((item) => item.key === key && item.status === "resolved")) {
    throw new Error(`Expected alert ${key} to be resolved during current stage.`);
  }
};

const fetchSloAndAlerts = async (stageStartedAtMs) => {
  const [sloRes, alertsRes, eventsRes] = await Promise.all([
    client.get("/observability/slo"),
    client.get("/observability/alerts", { params: { limit: 100 } }),
    client.get("/observability/events", { params: { limit: 200, type: "alert" } })
  ]);
  const persistedAlertsRaw = Array.isArray(eventsRes.data) ? eventsRes.data : [];

  return {
    fetchedAt: new Date().toISOString(),
    slo: sloRes.data,
    alertsInRun: filterAlertsByWindow(alertsRes.data, stageStartedAtMs),
    alertsRaw: Array.isArray(alertsRes.data) ? alertsRes.data : [],
    persistedAlertsInRun: filterAlertsByWindow(
      persistedAlertsRaw.map((item) => item?.payload || item),
      stageStartedAtMs
    ),
    persistedAlertsRaw
  };
};

const runScenario = async (stageName, scenario, runStartedAtMs) => {
  const stageStartedAtMs = Date.now();
  await client.post("/observability/drill", { scenario, samples: SAMPLES });
  const snapshot = await fetchSloAndAlerts(runStartedAtMs);
  const payload = {
    stage: stageName,
    scenario,
    stageStartedAt: new Date(stageStartedAtMs).toISOString(),
    ...snapshot
  };
  writeStageArtifact(stageName, payload);
  return payload;
};

const formatSlo = (payload) => {
  const window = payload?.slo?.window || {};
  return `req=${window.requestCount || 0}, 5xx=${window.errorRatePercent || 0}%, p95=${window.criticalP95Ms || 0}ms`;
};

const main = async () => {
  const runStartedAtMs = Date.now();
  const runStartedAt = new Date(runStartedAtMs).toISOString();
  ensureDir(OUTPUT_DIR);
  console.log(`[drill] API base: ${API_BASE_URL}`);
  console.log(`[drill] output dir: ${OUTPUT_DIR}`);
  console.log(`[drill] run started at: ${runStartedAt}`);

  const before = await fetchSloAndAlerts(runStartedAtMs);
  writeStageArtifact("before", {
    stage: "before",
    runStartedAt,
    ...before
  });
  console.log(`[drill] before snapshot: ${formatSlo({ slo: before.slo })}`);

  const latency = await runScenario("latency", "latency", runStartedAtMs);
  assertAlertPresent(latency.alertsInRun, "critical_p95");
  assertAlertPresent(latency.persistedAlertsInRun, "critical_p95");
  console.log(`[drill] latency ok: ${formatSlo(latency)}`);

  const error = await runScenario("error", "error", runStartedAtMs);
  assertAlertPresent(error.alertsInRun, "error_rate_5xx");
  assertAlertPresent(error.persistedAlertsInRun, "error_rate_5xx");
  console.log(`[drill] error ok: ${formatSlo(error)}`);

  const recover = await runScenario("recover", "recover", runStartedAtMs);
  assertAlertResolved(recover.alertsInRun, "critical_p95");
  assertAlertResolved(recover.alertsInRun, "error_rate_5xx");
  assertAlertResolved(recover.persistedAlertsInRun, "critical_p95");
  assertAlertResolved(recover.persistedAlertsInRun, "error_rate_5xx");
  const activeAlerts = Array.isArray(recover?.slo?.activeAlerts) ? recover.slo.activeAlerts : [];
  if (activeAlerts.length > 0) {
    throw new Error(`Expected activeAlerts to be empty after recover, received ${activeAlerts.length}.`);
  }
  console.log(`[drill] recover ok: ${formatSlo(recover)}`);

  writeStageArtifact("summary", {
    runStartedAt,
    completedAt: new Date().toISOString(),
    checks: {
      latencyTriggered: true,
      errorTriggered: true,
      recoverResolved: true,
      activeAlertsCleared: true
    }
  });
  console.log("[drill] observability drill finished successfully.");
};

main().catch((error) => {
  const message = error?.response?.data || error?.message || String(error);
  writeStageArtifact("failure", {
    failedAt: new Date().toISOString(),
    message
  });
  console.error("[drill] failed:", message);
  process.exit(1);
});
