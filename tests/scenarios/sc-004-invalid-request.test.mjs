// Scenario SC-004: invalid POST requests answer 400 without storing anything,
// and the service keeps working afterwards.

import assert from "node:assert/strict";
import { test } from "node:test";

import { startServer } from "../helpers/start-server.mjs";

const invalidBodies = [
  ["clé absente", { value: "v" }],
  ["clé vide", { key: "", value: "v" }],
  ["clé qui n'est pas une chaîne", { key: 123, value: "v" }],
  ["valeur absente", { key: "k" }],
  ["valeur qui n'est pas une chaîne", { key: "k", value: 42 }]
];

for (const [label, body] of invalidBodies) {
  test(`SC-004 : POST avec ${label} est rejeté en 400 sans rien enregistrer`, async (context) => {
    const api = await startServer(context);
    assert.equal((await api.create({ key: "user:1", value: "Alice" })).status, 201);
    const before = api.engine.getStats();

    const response = await api.create(body);

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
    assert.deepEqual(api.engine.getStats(), before);
    assert.deepEqual(await (await api.read("user:1")).json(), {
      key: "user:1",
      value: "Alice"
    });
  });
}

test("SC-004 : le service continue de fonctionner après plusieurs requêtes invalides", async (context) => {
  const api = await startServer(context);

  for (const [, body] of invalidBodies) {
    assert.equal((await api.create(body)).status, 400);
  }

  assert.equal((await fetch(`${api.baseUrl}/health`)).status, 200);
  assert.equal((await api.create({ key: "valid", value: "ok" })).status, 201);
  assert.equal(api.engine.getStats().entryCount, 1);
});