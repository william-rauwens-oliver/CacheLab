// HTTP integration: a refused request (409, 404, 400, 413, 507) leaves data and counters untouched,
// and counters stay consistent when successes and refusals are mixed.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { startServer } from "../helpers/start-server.mjs";

const CACHE_MAX_BYTES = 12;
const SEED = [
  ["a", "1"],
  ["b", "2"],
  ["c", "3"]
];

async function startSeeded(context) {
  const api = await startServer(context, { cacheMaxBytes: CACHE_MAX_BYTES });
  for (const [key, value] of SEED) {
    assert.equal((await api.create({ key, value })).status, 201);
  }
  return api;
}

async function assertSeedReadable(api) {
  for (const [key, value] of SEED) {
    const response = await api.read(key);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { key, value });
  }
}

const refusals = [
  {
    name: "POST of an existing key",
    run: (api) => api.create({ key: "a", value: "other" }),
    status: 409,
    code: "KEY_ALREADY_EXISTS"
  },
  {
    name: "POST over the capacity",
    run: (api) => api.create({ key: "key", value: "value" }),
    status: 507,
    code: "CAPACITY_EXCEEDED"
  },
  {
    name: "POST with an empty key",
    run: (api) => api.create({ key: "", value: "v" }),
    status: 400,
    code: "VALIDATION_ERROR"
  },
  {
    name: "POST with a non-string value",
    run: (api) => api.create({ key: "new", value: 42 }),
    status: 400,
    code: "VALIDATION_ERROR"
  },
  {
    name: "GET of an absent key",
    run: (api) => api.read("missing"),
    status: 404,
    code: "KEY_NOT_FOUND"
  },
  {
    name: "PUT of an absent key",
    run: (api) => api.update("missing", { value: "v" }),
    status: 404,
    code: "KEY_NOT_FOUND"
  },
  {
    name: "PUT over the capacity",
    run: (api) => api.update("a", { value: "0123456789" }),
    status: 507,
    code: "CAPACITY_EXCEEDED"
  },
  {
    name: "PUT with a non-string value",
    run: (api) => api.update("a", { value: 42 }),
    status: 400,
    code: "VALIDATION_ERROR"
  },
  {
    name: "DELETE of an absent key",
    run: (api) => api.remove("missing"),
    status: 404,
    code: "KEY_NOT_FOUND"
  }
];

describe("Une requête refusée ne modifie ni les données ni les compteurs", () => {
  for (const refusal of refusals) {
    test(`${refusal.name} answers ${refusal.status} and leaves the state untouched`, async (context) => {
      const api = await startSeeded(context);
      const before = api.engine.getStats();

      const response = await refusal.run(api);

      assert.equal(response.status, refusal.status);
      assert.equal((await response.json()).error.code, refusal.code);
      assert.deepEqual(api.engine.getStats(), before);
      await assertSeedReadable(api);
    });
  }

  test("all refusals in a row leave the state untouched, and the service keeps working", async (context) => {
    const api = await startSeeded(context);
    const before = api.engine.getStats();

    for (const refusal of refusals) {
      const response = await refusal.run(api);
      assert.equal(response.status, refusal.status, refusal.name);
    }

    assert.deepEqual(api.engine.getStats(), before);
    await assertSeedReadable(api);
    assert.equal((await fetch(`${api.baseUrl}/health`)).status, 200);
  });
});

describe("Les compteurs restent cohérents quand succès et refus se mélangent", () => {
  test("usedBytes and entryCount follow only the accepted operations", async (context) => {
    const api = await startSeeded(context);
    assert.equal(api.engine.getStats().usedBytes, 6);

    assert.equal((await api.create({ key: "key", value: "value" })).status, 507);
    assert.equal((await api.create({ key: "d", value: "4" })).status, 201);
    assert.equal((await api.create({ key: "d", value: "other" })).status, 409);
    assert.equal((await api.update("d", { value: "0123456789" })).status, 507);
    assert.equal((await api.update("a", { value: "11" })).status, 204);
    assert.equal((await api.remove("missing")).status, 404);
    assert.equal((await api.remove("b")).status, 204);

    const stats = api.engine.getStats();
    assert.equal(stats.entryCount, 3);
    assert.equal(stats.usedBytes, 7);
    assert.deepEqual(await (await api.read("a")).json(), { key: "a", value: "11" });
    assert.equal((await api.read("b")).status, 404);
  });

  test("a refused creation does not consume the capacity: it is still available afterwards", async (context) => {
    const api = await startSeeded(context);

    assert.equal((await api.create({ key: "key", value: "value" })).status, 507);

    assert.equal((await api.create({ key: "d", value: "12345" })).status, 201);
    assert.equal(api.engine.getStats().usedBytes, 12);
  });
});