// HTTP integration: 409 KEY_ALREADY_EXISTS on POST of an existing key (RM-002, SC-002).
// The original value is kept, the body does not echo client data, concurrent creations produce one entry.

import assert from "node:assert/strict";
import { test } from "node:test";

import { assertErrorResponse } from "../helpers/assertions.mjs";
import { startServer } from "../helpers/start-server.mjs";

test("POST of an existing key answers 409 KEY_ALREADY_EXISTS and keeps the original value", async (context) => {
  const api = await startServer(context);
  assert.equal((await api.create({ key: "cart", value: "first" })).status, 201);

  const response = await api.create({ key: "cart", value: "replacement" });

  await assertErrorResponse(response, { status: 409, code: "KEY_ALREADY_EXISTS" });
  assert.deepEqual(await (await api.read("cart")).json(), { key: "cart", value: "first" });
});

test("POST of an existing key is refused even with the same value", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "same", value: "value" });

  const response = await api.create({ key: "same", value: "value" });

  await assertErrorResponse(response, { status: 409, code: "KEY_ALREADY_EXISTS" });
  assert.equal(api.engine.getStats().entryCount, 1);
});

test("POST of an existing key is refused when its value is empty", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "empty", value: "" });

  const response = await api.create({ key: "empty", value: "now filled" });

  await assertErrorResponse(response, { status: 409, code: "KEY_ALREADY_EXISTS" });
  assert.deepEqual(await (await api.read("empty")).json(), { key: "empty", value: "" });
});

test("POST of an existing key keeps the value set by a previous PUT", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "k", value: "created" });
  await api.update("k", { value: "updated" });

  const response = await api.create({ key: "k", value: "again" });

  await assertErrorResponse(response, { status: 409, code: "KEY_ALREADY_EXISTS" });
  assert.deepEqual(await (await api.read("k")).json(), { key: "k", value: "updated" });
});

test("the 409 body does not echo the key or the value sent by the client", async (context) => {
  const api = await startServer(context);
  await api.create({ key: "secret-key", value: "secret-value" });

  const response = await api.create({ key: "secret-key", value: "other-secret" });

  await assertErrorResponse(response, {
    status: 409,
    code: "KEY_ALREADY_EXISTS",
    mustNotContain: ["secret-key", "secret-value", "other-secret"]
  });
});

test("a duplicate is reported as 409 even when the new value would also exceed the capacity", async (context) => {
  const api = await startServer(context, { cacheMaxBytes: 12 });
  await api.create({ key: "a", value: "1" });

  const response = await api.create({ key: "a", value: "0123456789012345" });

  await assertErrorResponse(response, { status: 409, code: "KEY_ALREADY_EXISTS" });
});

test("concurrent POSTs of the same key create it exactly once", async (context) => {
  const api = await startServer(context);

  const responses = await Promise.all(
    Array.from({ length: 10 }, (_, index) => api.create({ key: "race", value: `v${index}` }))
  );

  const statuses = responses.map((response) => response.status).sort();
  assert.deepEqual(statuses, [201, ...Array(9).fill(409)]);
  assert.equal(api.engine.getStats().entryCount, 1);
});