// HTTP integration: nominal DELETE /api/v1/keys/:key (204, key unreadable afterwards,
// other entries preserved, used bytes released, key can be created again).

import assert from "node:assert/strict";
import { test } from "node:test";

import { startServer } from "../helpers/start-server.mjs";

test("DELETE /api/v1/keys/:key answers 204 with an empty body", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "obsolete", value: "value" });

  const response = await api.remove("obsolete");

  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
});

test("DELETE /api/v1/keys/:key makes the key unreadable afterwards", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "obsolete", value: "value" });

  await api.remove("obsolete");

  assert.equal((await api.read("obsolete")).status, 404);
});

test("DELETE /api/v1/keys/:key preserves every other entry", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "first", value: "one" });
  await api.create({ key: "target", value: "remove-me" });
  await api.create({ key: "last", value: "three" });

  assert.equal((await api.remove("target")).status, 204);

  assert.deepEqual(await (await api.read("first")).json(), { key: "first", value: "one" });
  assert.deepEqual(await (await api.read("last")).json(), { key: "last", value: "three" });
  assert.equal(api.engine.getStats().entryCount, 2);
});

test("DELETE /api/v1/keys/:key releases the used bytes", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "user:1", value: "Alice" });

  await api.remove("user:1");

  const stats = api.engine.getStats();
  assert.equal(stats.entryCount, 0);
  assert.equal(stats.usedBytes, 0);
});

test("DELETE /api/v1/keys/:key allows the key to be created again", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "again", value: "first" });
  await api.remove("again");

  assert.equal((await api.create({ key: "again", value: "second" })).status, 201);

  assert.deepEqual(await (await api.read("again")).json(), { key: "again", value: "second" });
});