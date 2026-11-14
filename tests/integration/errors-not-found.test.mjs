// HTTP integration: 404 KEY_NOT_FOUND for GET, PUT and DELETE on absent or deleted keys
// (RM-007, RM-008, RM-010) and 404 ROUTE_NOT_FOUND for unknown routes.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { assertErrorResponse } from "../helpers/assertions.mjs";
import { startServer } from "../helpers/start-server.mjs";

const keyOperations = [
  ["GET", (api, key) => api.read(key)],
  ["PUT", (api, key) => api.update(key, { value: "v" })],
  ["DELETE", (api, key) => api.remove(key)]
];

describe("Clé absente : KEY_NOT_FOUND (RM-007, RM-008, RM-010)", () => {
  for (const [method, run] of keyOperations) {
    test(`${method} of an absent key answers 404 KEY_NOT_FOUND`, async (context) => {
      const api = await startServer(context);

      const response = await run(api, "user:999");

      await assertErrorResponse(response, { status: 404, code: "KEY_NOT_FOUND" });
    });
  }

  for (const [method, run] of keyOperations) {
    test(`${method} of a deleted key answers 404 KEY_NOT_FOUND`, async (context) => {
      const api = await startServer(context);
      await api.create({ key: "gone", value: "value" });
      assert.equal((await api.remove("gone")).status, 204);

      const response = await run(api, "gone");

      await assertErrorResponse(response, { status: 404, code: "KEY_NOT_FOUND" });
    });
  }

  test("PUT of an absent key does not create it", async (context) => {
    const api = await startServer(context);

    await api.update("missing", { value: "new" });

    assert.equal((await api.read("missing")).status, 404);
    assert.equal(api.engine.getStats().entryCount, 0);
  });

  test("the 404 body does not echo the requested key", async (context) => {
    const api = await startServer(context);

    const response = await api.read("secret-key");

    await assertErrorResponse(response, {
      status: 404,
      code: "KEY_NOT_FOUND",
      mustNotContain: ["secret-key"]
    });
  });
});

describe("Route inconnue : ROUTE_NOT_FOUND", () => {
  for (const path of ["/unknown", "/api/v1/unknown", "/api/v2/keys/a"]) {
    test(`GET ${path} answers 404 ROUTE_NOT_FOUND`, async (context) => {
      const api = await startServer(context);

      const response = await api.raw(path);

      await assertErrorResponse(response, { status: 404, code: "ROUTE_NOT_FOUND" });
    });
  }

  test("GET /api/v1/keys/ without a key answers 404 ROUTE_NOT_FOUND", async (context) => {
    const api = await startServer(context);

    const response = await api.raw("/api/v1/keys/");

    await assertErrorResponse(response, { status: 404, code: "ROUTE_NOT_FOUND" });
  });

  test("no route lists the keys", async (context) => {
    const api = await startServer(context);
    await api.create({ key: "listed?", value: "value" });

    const response = await api.raw("/api/v1/keys");

    await assertErrorResponse(response, {
      status: 404,
      code: "ROUTE_NOT_FOUND",
      mustNotContain: ["listed?"]
    });
  });

  for (const [method, path] of [
    ["PATCH", "/api/v1/keys/a"],
    ["PUT", "/api/v1/keys"],
    ["DELETE", "/api/v1/keys"]
  ]) {
    test(`${method} ${path} answers 404 ROUTE_NOT_FOUND (current behavior)`, async (context) => {
      const api = await startServer(context);

      const response = await api.raw(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "v" })
      });

      await assertErrorResponse(response, { status: 404, code: "ROUTE_NOT_FOUND" });
    });
  }
});