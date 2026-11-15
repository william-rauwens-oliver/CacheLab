// HTTP integration: RM-012, an entry created through the API never expires and is removed
// only by an explicit DELETE (simulated clock).

import assert from "node:assert/strict";
import { test } from "node:test";

import { startServer } from "../helpers/start-server.mjs";

const DAY = 24 * 60 * 60 * 1000;

test("RM-012 : une entrée créée par l'API reste lisible après un an simulé", async (context) => {
  const api = await startServer(context);
  assert.equal((await api.create({ key: "user:1", value: "Alice" })).status, 201);
  const before = api.engine.getStats();

  context.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  context.mock.timers.tick(365 * DAY);

  const response = await api.read("user:1");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { key: "user:1", value: "Alice" });
  assert.deepEqual(api.engine.getStats(), before);
});

test("RM-012 : l'entrée n'est retirée que par un DELETE explicite", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "kept", value: "1" });
  await api.create({ key: "removed", value: "2" });

  context.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  context.mock.timers.tick(365 * DAY);
  assert.equal((await api.remove("removed")).status, 204);
  context.mock.timers.tick(365 * DAY);

  assert.equal((await api.read("removed")).status, 404);
  assert.deepEqual(await (await api.read("kept")).json(), { key: "kept", value: "1" });
});