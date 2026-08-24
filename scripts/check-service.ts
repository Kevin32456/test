import assert from "node:assert/strict";

const baseUrl = (process.env.SERVICE_URL ?? process.env.STAGING_URL ?? "http://127.0.0.1:4318").replace(/\/+$/, "");
const timeoutMs = Math.max(1000, Number(process.env.SERVICE_TIMEOUT_MS ?? 5000));

async function readJson(path: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  assert.equal(response.ok, true, `${path} returned HTTP ${response.status}`);
  return await response.json() as Record<string, unknown>;
}

try {
  const health = await readJson("/health");
  const ready = await readJson("/ready");
  const metricsResponse = await fetch(`${baseUrl}/metrics`, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  assert.equal(metricsResponse.ok, true, `/metrics returned HTTP ${metricsResponse.status}`);
  const metrics = await metricsResponse.text();
  for (const metric of [
    "shuai_gou_ready",
    "shuai_gou_active_connections",
    "shuai_gou_rooms",
    "shuai_gou_invalid_actions_total",
  ]) {
    assert.match(metrics, new RegExp(`^${metric}(?:\\s|\\{)`, "m"), `missing metric ${metric}`);
  }
  assert.equal(ready.ready, true, "/ready reported ready=false");

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    health,
    ready,
    metrics: { bytes: metrics.length, checked: true },
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    baseUrl,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
}
