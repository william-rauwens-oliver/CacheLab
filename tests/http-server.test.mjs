import assert from "node:assert/strict";
import test from "node:test";

import { createCacheLab } from "../dist/app.js";

const config = {
  cacheMaxBytes: 1024,
  corsOrigins: [],
  docsEnabled: false,
  host: "127.0.0.1",
  httpBodyLimit: "1mb",
  port: 3000
};

test("starts, answers health checks and stops cleanly", async () => {
  const server = createCacheLab(config).app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");

  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.has("x-powered-by"), false);
  assert.deepEqual(await response.json(), { status: "ok" });

  await new Promise((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
});

test("describes the service at the root when documentation is disabled", async () => {
  const server = createCacheLab(config).app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");

  const response = await fetch(`http://127.0.0.1:${address.port}/`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    name: "CacheLab",
    status: "ok",
    apiBasePath: "/api/v1"
  });

  await new Promise((resolve) => server.close(resolve));
});

test("does not expose unknown routes", async () => {
  const server = createCacheLab(config).app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");

  const response = await fetch(`http://127.0.0.1:${address.port}/unknown`);
  assert.equal(response.status, 404);

  await new Promise((resolve) => server.close(resolve));
});
