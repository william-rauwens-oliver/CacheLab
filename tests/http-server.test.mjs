import assert from "node:assert/strict";
import test from "node:test";

import { createHttpServer } from "../dist/http/create-http-server.js";

test("starts, answers health checks and stops cleanly", async () => {
  const server = createHttpServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");

  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });

  await new Promise((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
});

test("does not expose unknown routes", async () => {
  const server = createHttpServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");

  const response = await fetch(`http://127.0.0.1:${address.port}/unknown`);
  assert.equal(response.status, 404);

  await new Promise((resolve) => server.close(resolve));
});
