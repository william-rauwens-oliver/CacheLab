import assert from "node:assert/strict";
import test from "node:test";

import { createCacheLab } from "../dist/app.js";

const defaultConfig = {
  cacheMaxBytes: 1024,
  corsOrigins: [],
  host: "127.0.0.1",
  httpBodyLimit: "1mb",
  port: 3000
};

async function start(overrides = {}) {
  const cacheLab = createCacheLab({ ...defaultConfig, ...overrides });
  const server = cacheLab.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");
  return {
    ...cacheLab,
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function stop(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
}

test("POST creates an entry and GET returns it", async () => {
  const { server, baseUrl } = await start();
  try {
    const created = await fetch(`${baseUrl}/api/v1/keys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "product:42", value: "19.99" })
    });
    assert.equal(created.status, 201);

    const read = await fetch(`${baseUrl}/api/v1/keys/product%3A42`);
    assert.equal(read.status, 200);
    assert.deepEqual(await read.json(), { key: "product:42", value: "19.99" });
  } finally {
    await stop(server);
  }
});

test("POST refuses a duplicate without replacing the original value", async () => {
  const { server, baseUrl } = await start();
  try {
    const request = (value) =>
      fetch(`${baseUrl}/api/v1/keys`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "same", value })
      });

    assert.equal((await request("original")).status, 201);
    const duplicate = await request("replacement");
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).error.code, "KEY_ALREADY_EXISTS");

    const read = await fetch(`${baseUrl}/api/v1/keys/same`);
    assert.deepEqual(await read.json(), { key: "same", value: "original" });
  } finally {
    await stop(server);
  }
});

test("POST rejects invalid data without creating an entry", async () => {
  const { server, baseUrl, repository } = await start();
  try {
    const response = await fetch(`${baseUrl}/api/v1/keys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "", value: "invalid" })
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
    assert.equal(repository.getStats().entryCount, 0);
  } finally {
    await stop(server);
  }
});

test("POST reports capacity exhaustion", async () => {
  const { server, baseUrl } = await start({ cacheMaxBytes: 4 });
  try {
    const response = await fetch(`${baseUrl}/api/v1/keys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "key", value: "value" })
    });
    assert.equal(response.status, 507);
    assert.equal((await response.json()).error.code, "CAPACITY_EXCEEDED");
  } finally {
    await stop(server);
  }
});

test("GET returns 404 for an absent key", async () => {
  const { server, baseUrl } = await start();
  try {
    const response = await fetch(`${baseUrl}/api/v1/keys/missing`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, "KEY_NOT_FOUND");
  } finally {
    await stop(server);
  }
});

test("successive GET requests do not mutate the cache", async () => {
  const { server, baseUrl, repository } = await start();
  try {
    repository.create("stable", "value");
    const before = repository.getStats();

    assert.equal((await fetch(`${baseUrl}/api/v1/keys/stable`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/v1/keys/stable`)).status, 200);
    assert.deepEqual(repository.getStats(), before);
  } finally {
    await stop(server);
  }
});
