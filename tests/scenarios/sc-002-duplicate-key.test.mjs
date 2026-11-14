// Scenario SC-002: creating an existing key is refused with 409 and the stored value is kept.

import assert from "node:assert/strict";
import { test } from "node:test";

import { startServer } from "../helpers/start-server.mjs";

test("SC-002 : la création d'une clé existante est refusée et la valeur est conservée", async (context) => {
  const api = await startServer(context);

  assert.equal((await api.create({ key: "user:1", value: "Alice" })).status, 201);
  const before = api.engine.getStats();

  const conflict = await api.create({ key: "user:1", value: "Bob" });
  assert.equal(conflict.status, 409);
  assert.deepEqual(await conflict.json(), {
    error: { code: "KEY_ALREADY_EXISTS", message: "Key already exists" }
  });

  const read = await api.read("user:1");
  assert.equal(read.status, 200);
  assert.deepEqual(await read.json(), { key: "user:1", value: "Alice" });

  assert.deepEqual(api.engine.getStats(), before);
});