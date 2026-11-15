// HTTP integration: nominal PUT /api/v1/keys/:key (204 with an empty body, value replaced,
// empty value, successive updates, other entries unchanged, used bytes follow the size difference).

import assert from "node:assert/strict";
import { test } from "node:test";

import { startServer } from "../helpers/start-server.mjs";

test("PUT /api/v1/keys/:key answers 204 with an empty body", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "product:42", value: "19.99" });

  const response = await api.update("product:42", { value: "24.99" });

  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
});

test("PUT /api/v1/keys/:key replaces the previous value", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "product:42", value: "19.99" });

  await api.update("product:42", { value: "24.99" });

  const read = await api.read("product:42");
  assert.deepEqual(await read.json(), { key: "product:42", value: "24.99" });
});

test("PUT /api/v1/keys/:key accepts an empty value", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "k", value: "filled" });

  assert.equal((await api.update("k", { value: "" })).status, 204);
  assert.deepEqual(await (await api.read("k")).json(), { key: "k", value: "" });

  assert.equal((await api.update("k", { value: "again" })).status, 204);
  assert.deepEqual(await (await api.read("k")).json(), { key: "k", value: "again" });
});

test("PUT /api/v1/keys/:key keeps the last value after successive updates", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "k", value: "v0" });

  for (const value of ["v1", "v2", "v3"]) {
    assert.equal((await api.update("k", { value })).status, 204);
  }

  assert.deepEqual(await (await api.read("k")).json(), { key: "k", value: "v3" });
  assert.equal(api.engine.getStats().entryCount, 1);
});

test("PUT /api/v1/keys/:key leaves the other entries unchanged", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "a", value: "1" });
  await api.create({ key: "b", value: "2" });

  await api.update("a", { value: "changed" });

  assert.deepEqual(await (await api.read("b")).json(), { key: "b", value: "2" });
});

test("PUT /api/v1/keys/:key updates the used bytes with the size difference", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "key", value: "long value" });

  await api.update("key", { value: "x" });

  assert.equal(api.engine.getStats().usedBytes, Buffer.byteLength("keyx", "utf8"));
});