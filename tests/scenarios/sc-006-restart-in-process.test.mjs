// Scenario SC-006 (in-process): after a restart the previous data is gone and the service works.

import assert from "node:assert/strict";
import { test } from "node:test";

import { startServer } from "../helpers/start-server.mjs";

const ENTRIES = [
  ["user:1", "Alice"],
  ["user:2", "Bob"],
  ["session:abc", "token"]
];

test("SC-006 : après un redémarrage, les données précédentes ne sont plus présentes et le service fonctionne", async (context) => {
  const before = await startServer(context);
  for (const [key, value] of ENTRIES) {
    assert.equal((await before.create({ key, value })).status, 201);
  }
  assert.equal(before.engine.getStats().entryCount, ENTRIES.length);

  await before.close();

  const after = await startServer(context);

  for (const [key] of ENTRIES) {
    assert.equal((await after.read(key)).status, 404, `${key} ne doit pas survivre au redémarrage`);
  }
  assert.equal(after.engine.getStats().entryCount, 0);
  assert.equal(after.engine.getStats().usedBytes, 0);

  assert.equal((await fetch(`${after.baseUrl}/health`)).status, 200);
  assert.equal((await after.create({ key: "user:1", value: "Alice" })).status, 201);
});