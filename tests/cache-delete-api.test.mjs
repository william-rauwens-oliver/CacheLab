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

async function remove(baseUrl, key) {
  return fetch(`${baseUrl}/api/v1/keys/${encodeURIComponent(key)}`, {
    method: "DELETE"
  });
}

test("DELETE /api/v1/keys/:key removes an existing entry", async (context) => {
  const server = await start();
  context.after(server.close);
  server.repository.create("obsolete", "value");

  const response = await remove(server.baseUrl, "obsolete");

  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.deepEqual(server.repository.get("obsolete"), {
    ok: false,
    error: "KEY_NOT_FOUND"
  });
});

test("DELETE /api/v1/keys/:key returns 404 for an absent entry", async (context) => {
  const server = await start();
  context.after(server.close);

  const response = await remove(server.baseUrl, "missing");

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { code: "KEY_NOT_FOUND", message: "Key not found" }
  });
});

test("DELETE /api/v1/keys/:key preserves every other entry", async (context) => {
  const server = await start();
  context.after(server.close);
  server.repository.create("first", "one");
  server.repository.create("target", "remove-me");
  server.repository.create("last", "three");

  const response = await remove(server.baseUrl, "target");

  assert.equal(response.status, 204);
  assert.deepEqual(server.repository.get("first"), { ok: true, value: "one" });
  assert.deepEqual(server.repository.get("last"), { ok: true, value: "three" });
  assert.equal(server.engine.getStats().entryCount, 2);
});
