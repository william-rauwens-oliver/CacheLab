import assert from "node:assert/strict";
import test from "node:test";

import { createCacheLab } from "../../dist/app.js";

const baseConfig = {
  cacheMaxBytes: 1024,
  corsOrigins: [],
  docsEnabled: false,
  host: "127.0.0.1",
  httpBodyLimit: "1mb",
  port: 3000,
  shutdownTimeoutMs: 10000
};

async function start(corsOrigins) {
  const server = createCacheLab({ ...baseConfig, corsOrigins }).app.listen(
    0,
    "127.0.0.1"
  );
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

test("allows origins configured through CORS_ALLOWED_ORIGINS", async (context) => {
  const server = await start([
    "https://a.example",
    "https://b.example"
  ]);
  context.after(server.close);

  for (const origin of ["https://a.example", "https://b.example"]) {
    const response = await fetch(`${server.baseUrl}/health`, {
      headers: { origin }
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
  }
});

test("allows browser preflight for a configured origin", async (context) => {
  const server = await start(["https://app.example"]);
  context.after(server.close);

  const response = await fetch(`${server.baseUrl}/api/v1/keys`, {
    method: "OPTIONS",
    headers: {
      origin: "https://app.example",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type"
    }
  });

  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    "https://app.example"
  );
  assert.match(response.headers.get("access-control-allow-methods"), /POST/);
  assert.match(response.headers.get("access-control-allow-headers"), /content-type/i);
});

test("does not emit a CORS allow header for unconfigured origins", async (context) => {
  const server = await start(["https://allowed.example"]);
  context.after(server.close);

  const response = await fetch(`${server.baseUrl}/health`, {
    headers: { origin: "https://blocked.example" }
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("keeps the CORS policy closed when no origin is configured", async (context) => {
  const server = await start([]);
  context.after(server.close);

  const response = await fetch(`${server.baseUrl}/health`, {
    headers: { origin: "https://a.example" }
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});
