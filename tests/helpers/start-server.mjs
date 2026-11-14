import assert from "node:assert/strict";

import { createCacheLab } from "../../dist/app.js";

export const defaultConfig = Object.freeze({
  cacheMaxBytes: 1024,
  corsOrigins: [],
  docsEnabled: false,
  host: "127.0.0.1",
  httpBodyLimit: "1mb",
  port: 3000
});

const JSON_HEADERS = { "content-type": "application/json" };

function keyUrl(baseUrl, key) {
  return `${baseUrl}/api/v1/keys/${encodeURIComponent(key)}`;
}

export async function startServer(context, overrides = {}) {
  const cacheLab = createCacheLab({ ...defaultConfig, ...overrides });
  const server = cacheLab.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  let closing;
  const close = () => {
    closing ??= new Promise((resolve, reject) => {
      server.close((error) => (error === undefined ? resolve() : reject(error)));
    });
    return closing;
  };
  context.after(close);

  const address = server.address();
  assert.equal(typeof address, "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    ...cacheLab,
    baseUrl,
    close,
    create: (body) =>
      fetch(`${baseUrl}/api/v1/keys`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(body)
      }),
    read: (key) => fetch(keyUrl(baseUrl, key)),
    update: (key, body) =>
      fetch(keyUrl(baseUrl, key), {
        method: "PUT",
        headers: JSON_HEADERS,
        body: JSON.stringify(body)
      }),
    remove: (key) => fetch(keyUrl(baseUrl, key), { method: "DELETE" }),
    raw: (path, init) => fetch(`${baseUrl}${path}`, init)
  };
}