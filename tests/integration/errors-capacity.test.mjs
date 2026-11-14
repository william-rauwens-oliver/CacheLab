// HTTP integration: 507 CAPACITY_EXCEEDED on POST and PUT (RM-014, SC-005), exact-fit boundary,
// UTF-8 byte counting, recovery after DELETE, concurrency, and the distinction from the 413 body limit.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { assertErrorResponse } from "../helpers/assertions.mjs";
import { startServer } from "../helpers/start-server.mjs";

describe("Dépassement de capacité (RM-014, SC-005)", () => {
  test("POST over the capacity answers 507 CAPACITY_EXCEEDED", async (context) => {
    const api = await startServer(context, { cacheMaxBytes: 3 });

    const response = await api.create({ key: "key", value: "value" });

    await assertErrorResponse(response, { status: 507, code: "CAPACITY_EXCEEDED" });
    assert.equal((await api.read("key")).status, 404);
  });

  test("PUT over the capacity answers 507 CAPACITY_EXCEEDED and keeps the old value", async (context) => {
    const api = await startServer(context, { cacheMaxBytes: 8 });
    await api.create({ key: "key", value: "old" });

    const response = await api.update("key", { value: "too-long" });

    await assertErrorResponse(response, { status: 507, code: "CAPACITY_EXCEEDED" });
    assert.deepEqual(await (await api.read("key")).json(), { key: "key", value: "old" });
  });

  test("the 507 body does not echo the key or the value sent by the client", async (context) => {
    const api = await startServer(context, { cacheMaxBytes: 3 });

    const response = await api.create({ key: "secret-key", value: "secret-value" });

    await assertErrorResponse(response, {
      status: 507,
      code: "CAPACITY_EXCEEDED",
      mustNotContain: ["secret-key", "secret-value"]
    });
  });

  test("an entry that fills the capacity exactly is accepted, one more byte is refused", async (context) => {
    const api = await startServer(context, { cacheMaxBytes: 6 });

    assert.equal((await api.create({ key: "abc", value: "def" })).status, 201);
    assert.equal(api.engine.getStats().usedBytes, 6);

    await assertErrorResponse(await api.update("abc", { value: "defg" }), {
      status: 507,
      code: "CAPACITY_EXCEEDED"
    });
    await assertErrorResponse(await api.create({ key: "x", value: "" }), {
      status: 507,
      code: "CAPACITY_EXCEEDED"
    });
    assert.equal(api.engine.getStats().usedBytes, 6);
  });

  test("the capacity counts UTF-8 bytes, not characters", async (context) => {
    const api = await startServer(context, { cacheMaxBytes: 5 });

    await assertErrorResponse(await api.create({ key: "€", value: "éé" }), {
      status: 507,
      code: "CAPACITY_EXCEEDED"
    });

    assert.equal((await api.create({ key: "€", value: "é" })).status, 201);
    assert.equal(api.engine.getStats().usedBytes, 5);
  });

  test("a refused creation succeeds after a DELETE has freed enough space", async (context) => {
    const api = await startServer(context, { cacheMaxBytes: 6 });
    await api.create({ key: "abc", value: "def" });

    assert.equal((await api.create({ key: "x", value: "y" })).status, 507);
    assert.deepEqual(await (await api.read("abc")).json(), { key: "abc", value: "def" });

    assert.equal((await api.remove("abc")).status, 204);
    assert.equal((await api.create({ key: "x", value: "y" })).status, 201);
  });

  test("concurrent POSTs never exceed the capacity", async (context) => {
    const api = await startServer(context, { cacheMaxBytes: 12 });

    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, index) => api.create({ key: `k${index}`, value: "v" }))
    );

    const statuses = responses.map((response) => response.status);
    assert.equal(statuses.filter((status) => status === 201).length, 4);
    assert.equal(statuses.filter((status) => status === 507).length, 6);
    assert.equal(api.engine.getStats().usedBytes, 12);
    assert.equal(api.engine.getStats().entryCount, 4);
  });
});

describe("Capacité du cache (507) et limite HTTP du corps (413) sont deux limites distinctes", () => {
  test("a small body over a small capacity answers 507, not 413", async (context) => {
    const api = await startServer(context, { cacheMaxBytes: 12 });

    const response = await api.create({ key: "a", value: "x".repeat(100) });

    await assertErrorResponse(response, { status: 507, code: "CAPACITY_EXCEEDED" });
  });

  test("a body over the HTTP limit answers 413, even with a large capacity", async (context) => {
    const api = await startServer(context, { cacheMaxBytes: 100000, httpBodyLimit: "100b" });

    const response = await api.create({ key: "a", value: "x".repeat(500) });

    await assertErrorResponse(response, { status: 413, code: "PAYLOAD_TOO_LARGE" });
    assert.equal(api.engine.getStats().entryCount, 0);
  });
});