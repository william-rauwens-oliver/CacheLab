// HTTP integration: invalid data (RM-013, SC-004). Non-conforming bodies, malformed JSON,
// wrong Content-Type, oversized bodies (413) and invalid URL encoding of the route key.
// Tests marked todo document a known bug (CAC-31).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { assertErrorResponse } from "../helpers/assertions.mjs";
import { startServer } from "../helpers/start-server.mjs";

const JSON_HEADERS = { "content-type": "application/json" };

async function startSeeded(context, overrides) {
  const api = await startServer(context, overrides);
  assert.equal((await api.create({ key: "a", value: "1" })).status, 201);
  return api;
}

async function assertSeedUntouched(api, before) {
  assert.deepEqual(api.engine.getStats(), before);
  assert.deepEqual(await (await api.read("a")).json(), { key: "a", value: "1" });
}

describe("POST : corps non conforme (RM-013)", () => {
  const bodies = [
    ["an array", [], "VALIDATION_ERROR"],
    ["an empty object", {}, "VALIDATION_ERROR"],
    ["an extra field", { key: "k", value: "v", extra: true }, "VALIDATION_ERROR"],
    ["an extra field instead of the value", { key: "k", other: "v" }, "VALIDATION_ERROR"],
    ["null", null, "INVALID_JSON"],
    ["a string", "text", "INVALID_JSON"],
    ["a number", 42, "INVALID_JSON"]
  ];

  for (const [label, body, code] of bodies) {
    test(`POST with ${label} answers 400 ${code} and stores nothing`, async (context) => {
      const api = await startSeeded(context);
      const before = api.engine.getStats();

      const response = await api.create(body);

      await assertErrorResponse(response, { status: 400, code });
      await assertSeedUntouched(api, before);
    });
  }

  test("POST with a __proto__ field is rejected as an unknown field", async (context) => {
    const api = await startSeeded(context);
    const before = api.engine.getStats();

    const response = await api.raw("/api/v1/keys", {
      method: "POST",
      headers: JSON_HEADERS,
      body: '{"key":"k","value":"v","__proto__":{"admin":true}}'
    });

    await assertErrorResponse(response, { status: 400, code: "VALIDATION_ERROR" });
    await assertSeedUntouched(api, before);
  });

  test("POST with a key made of spaces is accepted as is (no implicit trim)", async (context) => {
    const api = await startServer(context);

    assert.equal((await api.create({ key: "   ", value: "v" })).status, 201);

    assert.deepEqual(await (await api.read("   ")).json(), { key: "   ", value: "v" });
  });
});

describe("PUT : corps non conforme (SC-004, variante PUT)", () => {
  const bodies = [
    ["an array", [], "VALIDATION_ERROR"],
    ["an empty object", {}, "VALIDATION_ERROR"],
    ["a numeric value", { value: 42 }, "VALIDATION_ERROR"],
    ["a null value", { value: null }, "VALIDATION_ERROR"],
    ["an extra field", { value: "v", extra: true }, "VALIDATION_ERROR"],
    ["the key repeated in the body", { key: "a", value: "v" }, "VALIDATION_ERROR"],
    ["null", null, "INVALID_JSON"],
    ["a string", "text", "INVALID_JSON"]
  ];

  for (const [label, body, code] of bodies) {
    test(`SC-004 (PUT) : PUT with ${label} answers 400 ${code} and keeps the value`, async (context) => {
      const api = await startSeeded(context);
      const before = api.engine.getStats();

      const response = await api.update("a", body);

      await assertErrorResponse(response, { status: 400, code });
      await assertSeedUntouched(api, before);
    });
  }

  test("SC-004 (PUT) : an invalid body on an absent key answers 400, not 404", async (context) => {
    const api = await startServer(context);

    const response = await api.update("missing", { value: 42 });

    await assertErrorResponse(response, { status: 400, code: "VALIDATION_ERROR" });
  });
});

describe("JSON malformé et Content-Type (400 INVALID_JSON / VALIDATION_ERROR)", () => {
  for (const [label, body] of [
    ["a malformed body", "{bad"],
    ["a truncated body", '{"key":"k","value":'],
    ["a body that is not JSON", "key=k&value=v"]
  ]) {
    test(`POST with ${label} answers 400 INVALID_JSON and stores nothing`, async (context) => {
      const api = await startSeeded(context);
      const before = api.engine.getStats();

      const response = await api.raw("/api/v1/keys", {
        method: "POST",
        headers: JSON_HEADERS,
        body
      });

      await assertErrorResponse(response, { status: 400, code: "INVALID_JSON" });
      await assertSeedUntouched(api, before);
    });

    test(`PUT with ${label} answers 400 INVALID_JSON and keeps the value`, async (context) => {
      const api = await startSeeded(context);
      const before = api.engine.getStats();

      const response = await api.raw("/api/v1/keys/a", {
        method: "PUT",
        headers: JSON_HEADERS,
        body
      });

      await assertErrorResponse(response, { status: 400, code: "INVALID_JSON" });
      await assertSeedUntouched(api, before);
    });
  }

  test("POST with a text/plain Content-Type answers 400 VALIDATION_ERROR (current behavior)", async (context) => {
    const api = await startSeeded(context);
    const before = api.engine.getStats();

    const response = await api.raw("/api/v1/keys", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ key: "k", value: "v" })
    });

    await assertErrorResponse(response, { status: 400, code: "VALIDATION_ERROR" });
    await assertSeedUntouched(api, before);
  });

  test("POST without any body answers 400 VALIDATION_ERROR", async (context) => {
    const api = await startSeeded(context);
    const before = api.engine.getStats();

    const response = await api.raw("/api/v1/keys", { method: "POST" });

    await assertErrorResponse(response, { status: 400, code: "VALIDATION_ERROR" });
    await assertSeedUntouched(api, before);
  });
});

describe("Corps trop volumineux (413 PAYLOAD_TOO_LARGE)", () => {
  const smallBodyLimit = { httpBodyLimit: "100b" };

  test("POST above the body limit answers 413 and stores nothing", async (context) => {
    const api = await startSeeded(context, smallBodyLimit);
    const before = api.engine.getStats();

    const response = await api.create({ key: "big", value: "x".repeat(500) });

    await assertErrorResponse(response, { status: 413, code: "PAYLOAD_TOO_LARGE" });
    await assertSeedUntouched(api, before);
  });

  test("PUT above the body limit answers 413 and keeps the value", async (context) => {
    const api = await startSeeded(context, smallBodyLimit);
    const before = api.engine.getStats();

    const response = await api.update("a", { value: "x".repeat(500) });

    await assertErrorResponse(response, { status: 413, code: "PAYLOAD_TOO_LARGE" });
    await assertSeedUntouched(api, before);
  });

  test("a body under the limit is still accepted", async (context) => {
    const api = await startServer(context, smallBodyLimit);

    assert.equal((await api.create({ key: "small", value: "ok" })).status, 201);
  });
});

describe("Clé de route à l'encodage invalide (AGENTS.md §8 : 400)", () => {
  for (const [method, run] of [
    ["GET", (api) => api.raw("/api/v1/keys/%E0%A4%A")],
    [
      "PUT",
      (api) =>
        api.raw("/api/v1/keys/%E0%A4%A", {
          method: "PUT",
          headers: JSON_HEADERS,
          body: JSON.stringify({ value: "v" })
        })
    ],
    ["DELETE", (api) => api.raw("/api/v1/keys/%E0%A4%A", { method: "DELETE" })]
  ]) {
    test(
      `${method} with an invalid percent-encoding answers 400`,
      { todo: "CAC-31 : l'application répond 500 INTERNAL_ERROR" },
      async (context) => {
        const api = await startSeeded(context);

        const response = await run(api);

        assert.equal(response.status, 400);
      }
    );
  }
});