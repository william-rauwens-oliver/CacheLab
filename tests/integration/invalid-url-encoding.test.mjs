import assert from "node:assert/strict";
import test from "node:test";

import { createCacheLab } from "../../dist/app.js";

const config = {
  cacheMaxBytes: 1024,
  corsOrigins: [],
  docsEnabled: false,
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
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

test("rejects invalid URL encoding for GET, PUT and DELETE without mutation", async (context) => {
  const server = await start();
  context.after(server.close);
  server.repository.create("stable", "value");
  const statsBeforeRequests = server.engine.getStats();

  for (const method of ["GET", "PUT", "DELETE"]) {
    const response = await fetch(`${server.baseUrl}/api/v1/keys/%E0%A4%A`, {
      method,
      headers: method === "PUT" ? { "content-type": "application/json" } : undefined,
      body: method === "PUT" ? JSON.stringify({ value: "replacement" }) : undefined
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.deepEqual(body, {
      error: {
        code: "VALIDATION_ERROR",
        message: "URL contains invalid percent-encoding"
      }
    });
    const serializedBody = JSON.stringify(body);
    assert.doesNotMatch(serializedBody, /%E0%A4%A|URIError|create-http-app|stack/i);
  }

  assert.deepEqual(server.engine.getStats(), statsBeforeRequests);
  assert.deepEqual(server.repository.get("stable"), { ok: true, value: "value" });
});

test("preserves valid percent-encoded keys", async (context) => {
  const server = await start();
  context.after(server.close);
  server.repository.create("é", "accented");
  server.repository.create("a/b", "slash");

  const [accentedResponse, slashResponse] = await Promise.all([
    fetch(`${server.baseUrl}/api/v1/keys/%C3%A9`),
    fetch(`${server.baseUrl}/api/v1/keys/a%2Fb`)
  ]);

  assert.equal(accentedResponse.status, 200);
  assert.deepEqual(await accentedResponse.json(), { key: "é", value: "accented" });
  assert.equal(slashResponse.status, 200);
  assert.deepEqual(await slashResponse.json(), { key: "a/b", value: "slash" });
});
