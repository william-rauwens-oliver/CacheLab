// Scenario SC-005: creation and update beyond the capacity answer 507,
// and the service still accepts what fits within the limit.

import assert from "node:assert/strict";
import { test } from "node:test";

import { startServer } from "../helpers/start-server.mjs";

const CACHE_MAX_BYTES = 12;
const CAPACITY_EXCEEDED = {
  error: { code: "CAPACITY_EXCEEDED", message: "Cache capacity exceeded" }
};

async function startWithData(context) {
  const api = await startServer(context, { cacheMaxBytes: CACHE_MAX_BYTES });
  for (const [key, value] of [["a", "1"], ["b", "2"], ["c", "3"]]) {
    assert.equal((await api.create({ key, value })).status, 201);
  }
  assert.equal(api.engine.getStats().usedBytes, 6);
  return api;
}

async function assertExistingEntriesReadable(api) {
  for (const [key, value] of [["a", "1"], ["b", "2"], ["c", "3"]]) {
    const response = await api.read(key);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { key, value });
  }
}

test("SC-005 : une création qui dépasse la capacité est refusée en 507", async (context) => {
  const api = await startWithData(context);
  const before = api.engine.getStats();

  const response = await api.create({ key: "key", value: "value" });

  assert.equal(response.status, 507);
  assert.deepEqual(await response.json(), CAPACITY_EXCEEDED);

  await assertExistingEntriesReadable(api);
  assert.deepEqual(api.engine.getStats(), before);
  assert.equal((await api.read("key")).status, 404);
});

test("SC-005 : une modification qui dépasse la capacité est refusée en 507", async (context) => {
  const api = await startWithData(context);
  const before = api.engine.getStats();

  const response = await api.update("a", { value: "0123456789" });

  assert.equal(response.status, 507);
  assert.deepEqual(await response.json(), CAPACITY_EXCEEDED);

  await assertExistingEntriesReadable(api);
  assert.deepEqual(api.engine.getStats(), before);
});

test("SC-005 : le service reste opérationnel et accepte encore ce qui tient dans la limite", async (context) => {
  const api = await startWithData(context);

  assert.equal((await api.create({ key: "key", value: "value" })).status, 507);

  assert.equal((await fetch(`${api.baseUrl}/health`)).status, 200);
  assert.equal((await api.create({ key: "d", value: "4" })).status, 201);
  assert.deepEqual(await (await api.read("d")).json(), { key: "d", value: "4" });
  assert.equal(api.engine.getStats().usedBytes, 8);
});