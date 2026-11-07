import assert from "node:assert/strict";
import test from "node:test";

import { loadRuntimeConfig } from "../dist/config/runtime-config.js";

test("loads external configuration with safe network defaults", () => {
  const config = loadRuntimeConfig({ CACHE_MAX_BYTES: "1024" });
  assert.deepEqual(config, {
    cacheMaxBytes: 1024,
    corsOrigins: [],
    host: "127.0.0.1",
    httpBodyLimit: "1mb",
    port: 3000
  });
});

test("accepts explicit network configuration", () => {
  const config = loadRuntimeConfig({
    CACHE_MAX_BYTES: "2048",
    CORS_ORIGINS: "https://one.example, https://two.example",
    HOST: "0.0.0.0",
    HTTP_BODY_LIMIT: "2mb",
    PORT: "8080"
  });
  assert.equal(config.cacheMaxBytes, 2048);
  assert.deepEqual(config.corsOrigins, [
    "https://one.example",
    "https://two.example"
  ]);
  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.httpBodyLimit, "2mb");
  assert.equal(config.port, 8080);
});

test("rejects missing or invalid configuration", () => {
  assert.throws(() => loadRuntimeConfig({}), /CACHE_MAX_BYTES/);
  assert.throws(
    () => loadRuntimeConfig({ CACHE_MAX_BYTES: "1024", PORT: "70000" }),
    /PORT/
  );
  assert.throws(
    () => loadRuntimeConfig({ CACHE_MAX_BYTES: "1024", HTTP_BODY_LIMIT: "" }),
    /HTTP_BODY_LIMIT/
  );
});
