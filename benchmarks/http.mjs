// HTTP benchmark: throughput and latency of CacheLab seen from a client, with Autocannon.
// Scenarios: GET and PUT (same size) on existing keys for a fixed duration, POST of new keys and DELETE of
// existing keys for a fixed number of requests (they change the table, so a time-based run would not stay
// comparable). Each scenario starts a fresh CacheLab process and fills it through the API first, so no
// scenario inherits the state left by another one. Keys are visited in a scattered order.
// The load is sent by several client threads (Autocannon workers): one thread tops out at roughly
// 50,000 requests/s, so it can hide the real limit of the server. The requests are built in
// benchmarks/http-requests.cjs, which each worker loads.
// Autocannon reports latency in whole milliseconds, so it cannot resolve the sub-millisecond latencies of
// a local server: read the throughput first, and use the latency only as an order of magnitude.
// Usage: npm run bench:http
//        BENCH_WORKERS=4 BENCH_CONNECTIONS=40 npm run bench:http   (4 client threads, 40 connections)

import { fileURLToPath } from "node:url";

import autocannon from "autocannon";

import { assertClean, startFilledServer } from "./http-server.mjs";
import { saveResults } from "./save-results.mjs";

const WORKERS = Number(process.env.BENCH_WORKERS ?? 1);
const CONNECTIONS = Number(process.env.BENCH_CONNECTIONS ?? 10);
const DURATION_SECONDS = 10;
const SETUP_REQUEST_FILE = fileURLToPath(new URL("./http-requests.cjs", import.meta.url));

if (!Number.isInteger(WORKERS) || WORKERS < 1 || !Number.isInteger(CONNECTIONS) || CONNECTIONS < WORKERS) {
  throw new Error("BENCH_WORKERS must be an integer >= 1 and BENCH_CONNECTIONS an integer >= BENCH_WORKERS");
}

// Each scenario gives the request kind, the number of entries present before the measure and how long it
// runs: a duration, or a number of requests.
const SCENARIOS = [
  { name: "GET existing key", kind: "get", startEntries: 10_000, run: { duration: DURATION_SECONDS } },
  { name: "PUT existing key (same size)", kind: "put", startEntries: 10_000, run: { duration: DURATION_SECONDS } },
  { name: "POST new key", kind: "post", startEntries: 10_000, run: { amount: 200_000 } },
  { name: "DELETE existing key", kind: "delete", startEntries: 200_000, run: { amount: 100_000 } }
];

async function measure({ name, kind, startEntries, run }) {
  const server = await startFilledServer(startEntries);
  try {
    const result = await autocannon({
      url: server.baseUrl,
      connections: CONNECTIONS,
      workers: WORKERS,
      ...run,
      initialContext: { kind, entries: startEntries, workers: WORKERS },
      requests: [{ setupRequest: SETUP_REQUEST_FILE }]
    });
    assertClean(result);
    return {
      scenario: name,
      "entries at start": startEntries,
      workers: WORKERS,
      connections: CONNECTIONS,
      requests: result.requests.total,
      "req/s": Math.round(result.requests.average),
      "p50 (ms)": result.latency.p50,
      "p99 (ms)": result.latency.p99,
      "max (ms)": result.latency.max
    };
  } finally {
    await server.stop();
  }
}

const rows = [];
for (const scenario of SCENARIOS) {
  console.log(`Measuring "${scenario.name}" (${WORKERS} worker(s), ${CONNECTIONS} connections)...`);
  rows.push(await measure(scenario));
}
saveResults(
  "http",
  { workers: WORKERS, connections: CONNECTIONS, durationSeconds: DURATION_SECONDS, valueBytes: 16 },
  rows
);