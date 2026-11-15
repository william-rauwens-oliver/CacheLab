// Scenario SC-006 (real process): a stopped then restarted process starts with an empty cache,
// and stops cleanly on SIGINT.

import assert from "node:assert/strict";
import { test } from "node:test";

import { getFreePort, startProcess } from "../helpers/start-process.mjs";

const ENTRIES = [
  ["user:1", "Alice"],
  ["user:2", "Bob"],
  ["session:abc", "token"]
];

async function post(baseUrl, key, value) {
  return fetch(`${baseUrl}/api/v1/keys`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, value })
  });
}

const get = (baseUrl, key) => fetch(`${baseUrl}/api/v1/keys/${encodeURIComponent(key)}`);

test("SC-006 : un processus arrêté puis relancé repart avec un cache vide", async (context) => {
  const port = await getFreePort();

  const first = await startProcess(context, { port });
  for (const [key, value] of ENTRIES) {
    assert.equal((await post(first.baseUrl, key, value)).status, 201);
  }
  for (const [key, value] of ENTRIES) {
    const response = await get(first.baseUrl, key);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { key, value });
  }

  const stopped = await first.stop("SIGTERM");
  assert.deepEqual(stopped, { code: 0, signal: null });
  await assert.rejects(fetch(`${first.baseUrl}/health`));

  const second = await startProcess(context, { port });

  for (const [key] of ENTRIES) {
    assert.equal((await get(second.baseUrl, key)).status, 404, `${key} ne doit pas survivre au redémarrage`);
  }

  assert.equal((await fetch(`${second.baseUrl}/health`)).status, 200);
  assert.equal((await post(second.baseUrl, "user:1", "Alice")).status, 201);

  assert.deepEqual(await second.stop("SIGTERM"), { code: 0, signal: null });
});

test("SC-006 : le processus s'arrête proprement sur SIGINT", async (context) => {
  const port = await getFreePort();
  const running = await startProcess(context, { port });
  assert.equal((await post(running.baseUrl, "k", "v")).status, 201);

  assert.deepEqual(await running.stop("SIGINT"), { code: 0, signal: null });
});