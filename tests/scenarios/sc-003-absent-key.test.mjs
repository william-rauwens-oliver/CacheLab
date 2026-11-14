// Scenario SC-003: GET, PUT and DELETE on an absent key answer 404 without creating or changing anything.

import assert from "node:assert/strict";
import { test } from "node:test";

import { startServer } from "../helpers/start-server.mjs";

const NOT_FOUND = {
  error: { code: "KEY_NOT_FOUND", message: "Key not found" }
};

test("SC-003 : GET, PUT et DELETE sur user:999 répondent 404 sans rien créer ni modifier", async (context) => {
  const api = await startServer(context);

  assert.equal((await api.create({ key: "user:1", value: "Alice" })).status, 201);
  const before = api.engine.getStats();

  const read = await api.read("user:999");
  assert.equal(read.status, 404);
  assert.deepEqual(await read.json(), NOT_FOUND);

  const update = await api.update("user:999", { value: "Nouvelle valeur" });
  assert.equal(update.status, 404);
  assert.deepEqual(await update.json(), NOT_FOUND);

  const removal = await api.remove("user:999");
  assert.equal(removal.status, 404);
  assert.deepEqual(await removal.json(), NOT_FOUND);

  assert.equal((await api.read("user:999")).status, 404);
  assert.deepEqual(api.engine.getStats(), before);
  assert.deepEqual(await (await api.read("user:1")).json(), {
    key: "user:1",
    value: "Alice"
  });
});