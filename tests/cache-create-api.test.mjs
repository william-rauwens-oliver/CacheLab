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

async function post(baseUrl, body) {
  return fetch(`${baseUrl}/api/v1/keys`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

test("POST /api/v1/keys creates a cache entry", async (context) => {
  const server = await start();
  context.after(server.close);

  const response = await post(server.baseUrl, { key: "product:42", value: "19.99" });

  assert.equal(response.status, 201);
  assert.equal(await response.text(), "");
  assert.deepEqual(server.repository.get("product:42"), {
    ok: true,
    value: "19.99"
  });
});

test("POST /api/v1/keys rejects a duplicate without replacing it", async (context) => {
  const server = await start();
  context.after(server.close);

  assert.equal((await post(server.baseUrl, { key: "cart", value: "first" })).status, 201);
  const response = await post(server.baseUrl, { key: "cart", value: "replacement" });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: { code: "KEY_ALREADY_EXISTS", message: "Key already exists" }
  });
  assert.deepEqual(server.repository.get("cart"), { ok: true, value: "first" });
});

test("POST /api/v1/keys validates the request body", async (context) => {
  const server = await start();
  context.after(server.close);

  const response = await post(server.baseUrl, { key: "", value: "value" });

  assert.equal(response.status, 400);
  assert.equal(server.engine.getStats().entryCount, 0);
});

test("POST /api/v1/keys reports exhausted cache capacity", async (context) => {
  const server = await start({ ...baseConfig, cacheMaxBytes: 3 });
  context.after(server.close);

  const response = await post(server.baseUrl, { key: "key", value: "value" });

  assert.equal(response.status, 507);
  assert.deepEqual(await response.json(), {
    error: { code: "CAPACITY_EXCEEDED", message: "Cache capacity exceeded" }
  });
});
