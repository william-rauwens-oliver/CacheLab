// HTTP latency probe: the latency of every single request, timed by this script with a nanosecond clock.
// Autocannon only reports whole milliseconds, so it cannot tell 0.05 ms from 0.9 ms. This probe sends the
// requests itself, one connection at a time or a few in parallel, times each request from the moment it is
// sent until its response is fully received, and computes exact percentiles on all the samples.
// Operations: GET, PUT (same size), POST (new key) and DELETE, each with 1 then 10 connections. Each
// measure starts a fresh CacheLab process (see http-server.mjs). A warm-up phase is sent first and its
// samples are dropped. The probe must never run at the same time as another load: it measures the server
// alone, and the clock includes the probe's own overhead (event loop, HTTP client), a few tens of µs.
// The requests come from http-requests.cjs, the file the Autocannon benchmark also uses.
// Usage: npm run bench:latency

import http from "node:http";
import { createRequire } from "node:module";

import { startFilledServer } from "./http-server.mjs";
import { saveResults } from "./save-results.mjs";

const WARMUP_REQUESTS = 20_000;
const MEASURED_REQUESTS = 100_000;
const CONNECTION_LEVELS = [1, 10];
const NANOSECONDS_PER_MICROSECOND = 1000;

const buildRequest = createRequire(import.meta.url)("./http-requests.cjs");

// DELETE removes a different existing key per request, so its table must hold all of them.
const SCENARIOS = [
  { name: "GET existing key", kind: "get", startEntries: 10_000 },
  { name: "PUT existing key (same size)", kind: "put", startEntries: 10_000 },
  { name: "POST new key", kind: "post", startEntries: 10_000 },
  { name: "DELETE existing key", kind: "delete", startEntries: WARMUP_REQUESTS + MEASURED_REQUESTS }
];

// Sends one request and resolves with its duration in nanoseconds (a BigInt).
function timeRequest(agent, baseUrl, { method, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const request = http.request(new URL(path, baseUrl), { method, headers, agent }, (response) => {
      response.resume();
      response.once("end", () => {
        const elapsed = process.hrtime.bigint() - start;
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`${method} ${path} answered ${response.statusCode}`));
        } else {
          resolve(elapsed);
        }
      });
    });
    request.once("error", reject);
    request.end(body);
  });
}

// Runs `total` requests with `connections` loops in parallel. Returns the latency of each, in microseconds.
async function sendRequests(agent, baseUrl, kind, entries, connections, total) {
  const samples = new Float64Array(total);
  let issued = 0;
  const loop = async () => {
    while (issued < total) {
      const slot = issued;
      issued += 1;
      const request = buildRequest({}, { kind, entries, workers: 1 });
      samples[slot] = Number(await timeRequest(agent, baseUrl, request)) / NANOSECONDS_PER_MICROSECOND;
    }
  };
  await Promise.all(Array.from({ length: connections }, loop));
  return samples;
}

function exactPercentile(sorted, percentile) {
  return sorted[Math.ceil(percentile * sorted.length) - 1];
}

const round = (microseconds) => Math.round(microseconds * 10) / 10;

async function measure({ name, kind, startEntries }, connections) {
  const server = await startFilledServer(startEntries);
  const agent = new http.Agent({ keepAlive: true, maxSockets: connections });
  try {
    await sendRequests(agent, server.baseUrl, kind, startEntries, connections, WARMUP_REQUESTS);
    const samples = await sendRequests(agent, server.baseUrl, kind, startEntries, connections, MEASURED_REQUESTS);
    const sorted = samples.slice().sort();
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    return {
      scenario: name,
      connections,
      samples: samples.length,
      "mean (µs)": round(mean),
      "p50 (µs)": round(exactPercentile(sorted, 0.5)),
      "p95 (µs)": round(exactPercentile(sorted, 0.95)),
      "p99 (µs)": round(exactPercentile(sorted, 0.99)),
      "max (µs)": round(sorted[sorted.length - 1])
    };
  } finally {
    agent.destroy();
    await server.stop();
  }
}

const rows = [];
for (const scenario of SCENARIOS) {
  for (const connections of CONNECTION_LEVELS) {
    console.log(`Measuring "${scenario.name}" with ${connections} connection(s)...`);
    rows.push(await measure(scenario, connections));
  }
}
saveResults(
  "latency",
  {
    connectionLevels: CONNECTION_LEVELS,
    warmupRequests: WARMUP_REQUESTS,
    measuredRequests: MEASURED_REQUESTS,
    valueBytes: 16
  },
  rows
);
