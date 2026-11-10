import assert from "node:assert/strict";
import test from "node:test";

import { createCacheLab } from "../dist/app.js";

const baseConfig = {
  cacheMaxBytes: 1024,
  corsOrigins: [],
  host: "127.0.0.1",
  httpBodyLimit: "1mb",
  port: 3000
};

async function start(config = baseConfig) {
  const cacheLab = createCacheLab(config);
  const server = cacheLab.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  const address = server.address();
  assert.equal(typeof address, "object");

  return {
    ...cacheLab,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      })
  };
}

async function put(baseUrl, key, body) {
  return fetch(`${baseUrl}/api/v1/keys/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

test("PUT /api/v1/keys/:key updates an existing value", async (context) => {
  const server = await start();
  context.after(server.close);
  server.repository.create("product:42", "19.99");

  const response = await put(server.baseUrl, "product:42", { value: "24.99" });

  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.deepEqual(server.repository.get("product:42"), {
    ok: true,
    value: "24.99"
  });
});

test("PUT /api/v1/keys/:key never creates a missing entry", async (context) => {
  const server = await start();
  context.after(server.close);

  const response = await put(server.baseUrl, "missing", { value: "new" });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { code: "KEY_NOT_FOUND", message: "Key not found" }
  });
  assert.deepEqual(server.repository.get("missing"), {
    ok: false,
    error: "KEY_NOT_FOUND"
  });
  assert.equal(server.engine.getStats().entryCount, 0);
});

test("PUT /api/v1/keys/:key preserves data when the value is invalid", async (context) => {
  const server = await start();
  context.after(server.close);
  server.repository.create("stable", "original");

  const response = await put(server.baseUrl, "stable", { value: 42 });

  assert.equal(response.status, 400);
  assert.deepEqual(server.repository.get("stable"), {
    ok: true,
    value: "original"
  });
});

test("PUT /api/v1/keys/:key is atomic when capacity is exceeded", async (context) => {
  const server = await start({ ...baseConfig, cacheMaxBytes: 8 });
  context.after(server.close);
  server.repository.create("key", "old");

  const response = await put(server.baseUrl, "key", { value: "too-long" });

  assert.equal(response.status, 507);
  assert.deepEqual(await response.json(), {
    error: { code: "CAPACITY_EXCEEDED", message: "Cache capacity exceeded" }
  });
  assert.deepEqual(server.repository.get("key"), { ok: true, value: "old" });
});
