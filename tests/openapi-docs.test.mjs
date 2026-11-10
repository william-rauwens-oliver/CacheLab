import assert from "node:assert/strict";
import test from "node:test";

import { parse } from "yaml";

import { createCacheLab } from "../dist/app.js";

const baseConfig = {
  cacheMaxBytes: 1024,
  corsOrigins: [],
  docsEnabled: true,
  host: "127.0.0.1",
  httpBodyLimit: "1mb",
  port: 3000
};

async function start(config = baseConfig) {
  const server = createCacheLab(config).app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

test("serves an OpenAPI 3.1 contract for the four CRUD operations", async (context) => {
  const server = await start();
  context.after(server.close);

  const response = await fetch(`${server.baseUrl}/openapi.yaml`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/yaml/);

  const document = parse(await response.text());
  assert.equal(document.openapi, "3.1.0");
  assert.deepEqual(Object.keys(document.paths).sort(), [
    "/api/v1/keys",
    "/api/v1/keys/{key}"
  ]);
  assert.equal(typeof document.paths["/api/v1/keys"].post, "object");
  assert.equal(typeof document.paths["/api/v1/keys/{key}"].get, "object");
  assert.equal(typeof document.paths["/api/v1/keys/{key}"].put, "object");
  assert.equal(typeof document.paths["/api/v1/keys/{key}"].delete, "object");
  assert.ok(document.paths["/api/v1/keys"].post.responses["201"]);
  assert.ok(document.paths["/api/v1/keys/{key}"].get.responses["200"]);
  assert.ok(document.paths["/api/v1/keys/{key}"].put.responses["204"]);
  assert.ok(document.paths["/api/v1/keys/{key}"].delete.responses["204"]);
});

test("serves Swagger UI when documentation is enabled", async (context) => {
  const server = await start();
  context.after(server.close);

  const response = await fetch(`${server.baseUrl}/docs/`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /CacheLab API documentation/);
  assert.match(html, /swagger-ui-bundle\.js/);
});

test("redirects the root route to Swagger when documentation is enabled", async (context) => {
  const server = await start();
  context.after(server.close);

  const response = await fetch(`${server.baseUrl}/`, { redirect: "manual" });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/docs/");
});

test("does not expose documentation by default", async (context) => {
  const server = await start({ ...baseConfig, docsEnabled: false });
  context.after(server.close);

  const [contractResponse, uiResponse] = await Promise.all([
    fetch(`${server.baseUrl}/openapi.yaml`),
    fetch(`${server.baseUrl}/docs/`)
  ]);
  assert.equal(contractResponse.status, 404);
  assert.equal(uiResponse.status, 404);
});
