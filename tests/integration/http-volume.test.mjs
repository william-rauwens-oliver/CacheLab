// HTTP integration: one million distinct POSTs sent to a real CacheLab process with Autocannon.
// Every request must answer 201, then a deterministic sample of keys is read back and one is deleted.
// Throughput and latency are only reported as diagnostics, never asserted.

import assert from "node:assert/strict";
import { test } from "node:test";

import autocannon from "autocannon";

import { getFreePort, startProcess } from "../helpers/start-process.mjs";

const ENTRIES = 1_000_000;
const CONNECTIONS = 50;
const key = (index) => `key:${index}`;
const value = (index) => `value-${index}`;

test("one million POSTs are all accepted and the entries stay readable", async (context) => {
  const server = await startProcess(context, {
    port: await getFreePort(),
    cacheMaxBytes: 1024 * 1024 * 1024
  });

  let next = 0;
  const result = await autocannon({
    url: server.baseUrl,
    connections: CONNECTIONS,
    amount: ENTRIES,
    requests: [
      {
        method: "POST",
        path: "/api/v1/keys",
        headers: { "content-type": "application/json" },
        setupRequest: (request) => {
          request.body = JSON.stringify({ key: key(next), value: value(next) });
          next += 1;
          return request;
        }
      }
    ]
  });

  context.diagnostic(
    `${result.duration} s, ${result.requests.average} req/s, latency average ${result.latency.average} ms, p99 ${result.latency.p99} ms, max ${result.latency.max} ms`
  );
  assert.equal(result["2xx"], ENTRIES);
  assert.equal(result.non2xx, 0);
  assert.equal(result.errors, 0);
  assert.equal(result.timeouts, 0);

  const sample = [0, 1, ENTRIES - 1];
  for (let step = 1; step <= 1000; step += 1) {
    sample.push((step * 7919) % ENTRIES);
  }
  for (const index of sample) {
    const response = await fetch(`${server.baseUrl}/api/v1/keys/${encodeURIComponent(key(index))}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { key: key(index), value: value(index) });
  }

  const removed = await fetch(`${server.baseUrl}/api/v1/keys/${encodeURIComponent(key(0))}`, {
    method: "DELETE"
  });
  assert.equal(removed.status, 204);
  const gone = await fetch(`${server.baseUrl}/api/v1/keys/${encodeURIComponent(key(0))}`);
  assert.equal(gone.status, 404);
  const neighbour = await fetch(`${server.baseUrl}/api/v1/keys/${encodeURIComponent(key(1))}`);
  assert.equal(neighbour.status, 200);

  await server.stop();
});
