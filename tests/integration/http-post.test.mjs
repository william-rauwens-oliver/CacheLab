// HTTP integration: nominal POST /api/v1/keys (201 with an empty body, entry readable afterwards,
// empty value, independent entries, statistics updated).

import assert from "node:assert/strict";
import { test } from "node:test";

import { startServer } from "../helpers/start-server.mjs";

test("POST /api/v1/keys answers 201 with an empty body", async (context) => {
  const api = await startServer(context);

  const response = await api.create({ key: "product:42", value: "19.99" });

  assert.equal(response.status, 201);
  assert.equal(await response.text(), "");
});

test("POST /api/v1/keys makes the entry readable through GET", async (context) => {
  const api = await startServer(context);

  assert.equal((await api.create({ key: "product:42", value: "19.99" })).status, 201);

  const read = await api.read("product:42");
  assert.equal(read.status, 200);
  assert.deepEqual(await read.json(), { key: "product:42", value: "19.99" });
});

test("POST /api/v1/keys accepts an empty value", async (context) => {
  const api = await startServer(context);

  assert.equal((await api.create({ key: "empty", value: "" })).status, 201);

  const read = await api.read("empty");
  assert.equal(read.status, 200);
  assert.deepEqual(await read.json(), { key: "empty", value: "" });
});

test("POST /api/v1/keys stores several distinct entries independently", async (context) => {
  const api = await startServer(context);

  assert.equal((await api.create({ key: "a", value: "1" })).status, 201);
  assert.equal((await api.create({ key: "b", value: "2" })).status, 201);

  assert.deepEqual(await (await api.read("a")).json(), { key: "a", value: "1" });
  assert.deepEqual(await (await api.read("b")).json(), { key: "b", value: "2" });
});

test("POST /api/v1/keys is counted in the cache statistics", async (context) => {
  const api = await startServer(context);

  await api.create({ key: "user:1", value: "Alice" });

  const stats = api.engine.getStats();
  assert.equal(stats.entryCount, 1);
  assert.equal(stats.usedBytes, Buffer.byteLength("user:1Alice", "utf8"));
});