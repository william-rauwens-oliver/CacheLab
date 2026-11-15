// HTTP integration: nominal GET /api/v1/keys/:key (200 JSON, empty value, special keys
// round-trip, no side effect on the cache).

import assert from "node:assert/strict";
import { test } from "node:test";

import { startServer } from "../helpers/start-server.mjs";

test("GET /api/v1/keys/:key answers 200 with the key and its value", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "product:42", value: "19.99" });

  const response = await api.read("product:42");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { key: "product:42", value: "19.99" });
});

test("GET /api/v1/keys/:key answers in JSON", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "k", value: "v" });

  const response = await api.read("k");

  assert.match(response.headers.get("content-type"), /^application\/json/);
});

test("GET /api/v1/keys/:key returns an empty value as an empty string", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "empty", value: "" });

  const response = await api.read("empty");

  assert.deepEqual(await response.json(), { key: "empty", value: "" });
});

for (const key of [
  "product:42",
  "clé:é",
  "a b",
  "a/b",
  "a+b",
  "100%",
  "emoji-\u{1F600}"
]) {
  test(`GET /api/v1/keys/:key round-trips the key ${JSON.stringify(key)}`, async (context) => {
    const api = await startServer(context);
    assert.equal((await api.create({ key, value: "v" })).status, 201);

    const response = await api.read(key);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { key, value: "v" });
  });
}

test("GET /api/v1/keys/:key does not modify the cache", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "stable", value: "value" });
  const before = api.engine.getStats();

  assert.equal((await api.read("stable")).status, 200);
  assert.equal((await api.read("stable")).status, 200);

  assert.deepEqual(api.engine.getStats(), before);
  assert.deepEqual(api.repository.get("stable"), { ok: true, value: "value" });
});