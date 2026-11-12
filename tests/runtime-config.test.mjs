import assert from "node:assert/strict";
import test from "node:test";

import { loadRuntimeConfig } from "../dist/config/runtime-config.js";

test("loads external configuration with safe network defaults", () => {
  const config = loadRuntimeConfig({ CACHE_MAX_BYTES: "1024" });
  assert.deepEqual(config, {
    cacheMaxBytes: 1024,
    corsOrigins: [],
    docsEnabled: false,
    host: "127.0.0.1",
    httpBodyLimit: "1mb",
    port: 3000,
    shutdownTimeoutMs: 10000
  });
});

test("accepts explicit network configuration", () => {
  const config = loadRuntimeConfig({
    CACHE_MAX_BYTES: "2048",
    CORS_ALLOWED_ORIGINS: "https://one.example, https://two.example",
    DOCS_ENABLED: "true",
    HOST: "0.0.0.0",
    HTTP_BODY_LIMIT: "2mb",
    PORT: "8080",
    SHUTDOWN_TIMEOUT_MS: "2500"
  });
  assert.equal(config.cacheMaxBytes, 2048);
  assert.deepEqual(config.corsOrigins, [
    "https://one.example",
    "https://two.example"
  ]);
  assert.equal(config.docsEnabled, true);
  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.httpBodyLimit, "2mb");
  assert.equal(config.port, 8080);
  assert.equal(config.shutdownTimeoutMs, 2500);
});

test("ignores empty origins and the retired CORS_ORIGINS variable", () => {
  const config = loadRuntimeConfig({
    CACHE_MAX_BYTES: "1024",
    CORS_ALLOWED_ORIGINS: " , https://allowed.example,  , ",
    CORS_ORIGINS: "https://retired.example"
  });

  assert.deepEqual(config.corsOrigins, ["https://allowed.example"]);

  const retiredOnly = loadRuntimeConfig({
    CACHE_MAX_BYTES: "1024",
    CORS_ORIGINS: "https://retired.example"
  });
  assert.deepEqual(retiredOnly.corsOrigins, []);
});

test("rejects missing or invalid configuration", () => {
  assert.throws(() => loadRuntimeConfig({}), /CACHE_MAX_BYTES/);
  assert.throws(
    () => loadRuntimeConfig({ CACHE_MAX_BYTES: "1024", PORT: "70000" }),
    /PORT/
  );
  assert.throws(
    () => loadRuntimeConfig({ CACHE_MAX_BYTES: "1024", PORT: "not-a-number" }),
    /PORT.*not-a-number/
  );
  assert.throws(
    () => loadRuntimeConfig({ CACHE_MAX_BYTES: "1024", HTTP_BODY_LIMIT: "10zz" }),
    /HTTP_BODY_LIMIT.*10zz/
  );
  assert.throws(
    () => loadRuntimeConfig({ CACHE_MAX_BYTES: "1024", HTTP_BODY_LIMIT: "0mb" }),
    /HTTP_BODY_LIMIT.*0mb/
  );
  assert.throws(
    () => loadRuntimeConfig({ CACHE_MAX_BYTES: "1024", HOST: "" }),
    /HOST/
  );
  assert.throws(
    () => loadRuntimeConfig({ CACHE_MAX_BYTES: "1024", HOST: "   " }),
    /HOST/
  );
  assert.throws(
    () => loadRuntimeConfig({ CACHE_MAX_BYTES: "1024", DOCS_ENABLED: "yes" }),
    /DOCS_ENABLED.*yes/
  );
  for (const value of ["0", "-1", "1.5", "not-a-number"]) {
    assert.throws(
      () =>
        loadRuntimeConfig({
          CACHE_MAX_BYTES: "1024",
          SHUTDOWN_TIMEOUT_MS: value
        }),
      /SHUTDOWN_TIMEOUT_MS/
    );
  }
});

test("normalizes valid body limits and hosts", () => {
  const config = loadRuntimeConfig({
    CACHE_MAX_BYTES: "1024",
    HOST: " 127.0.0.1 ",
    HTTP_BODY_LIMIT: " 512KB "
  });

  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.httpBodyLimit, "512kb");
});
