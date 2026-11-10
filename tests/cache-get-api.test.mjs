import assert from "node:assert/strict";
import test from "node:test";

import { createCacheLab } from "../dist/app.js";

const config = {
  cacheMaxBytes: 1024,
  corsOrigins: [],
  host: "127.0.0.1",
  httpBodyLimit: "1mb",
  port: 3000
};

async function start() {
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

test("GET /api/v1/keys/:key returns an existing entry", async (context) => {
  const server = await start();
  context.after(server.close);
  server.repository.create("product:42", "19.99");

  const response = await fetch(`${server.baseUrl}/api/v1/keys/product%3A42`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { key: "product:42", value: "19.99" });
});

test("GET /api/v1/keys/:key returns 404 for an absent entry", async (context) => {
  const server = await start();
  context.after(server.close);

  const response = await fetch(`${server.baseUrl}/api/v1/keys/missing`);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { code: "KEY_NOT_FOUND", message: "Key not found" }
  });
});

test("GET /api/v1/keys/:key never mutates the cache", async (context) => {
  const server = await start();
  context.after(server.close);
  server.repository.create("stable", "value");
  const statsBeforeReads = server.engine.getStats();

  const firstResponse = await fetch(`${server.baseUrl}/api/v1/keys/stable`);
  const secondResponse = await fetch(`${server.baseUrl}/api/v1/keys/stable`);

  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 200);
  assert.deepEqual(server.engine.getStats(), statsBeforeReads);
  assert.deepEqual(server.repository.get("stable"), { ok: true, value: "value" });
});
