// Scenario SC-001: full lifecycle of the key user:1 through the HTTP API
// (create, read, update, read, delete, read again).

import assert from "node:assert/strict";
import { test } from "node:test";

import { startServer } from "../helpers/start-server.mjs";

test("SC-001 : cycle de vie complet de la clé user:1", async (context) => {
  const api = await startServer(context);

  assert.equal((await api.read("user:1")).status, 404);

  const created = await api.create({ key: "user:1", value: "Alice" });
  assert.equal(created.status, 201);

  const firstRead = await api.read("user:1");
  assert.equal(firstRead.status, 200);
  assert.deepEqual(await firstRead.json(), { key: "user:1", value: "Alice" });

  const updated = await api.update("user:1", { value: "Alice Martin" });
  assert.equal(updated.status, 204);

  const secondRead = await api.read("user:1");
  assert.equal(secondRead.status, 200);
  assert.deepEqual(await secondRead.json(), { key: "user:1", value: "Alice Martin" });

  const removed = await api.remove("user:1");
  assert.equal(removed.status, 204);

  assert.equal((await api.read("user:1")).status, 404);
  assert.equal(api.engine.getStats().entryCount, 0);
  assert.equal(api.engine.getStats().usedBytes, 0);
});