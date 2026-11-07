import assert from "node:assert/strict";
import test from "node:test";

import { loadRuntimeConfig } from "../dist/config/runtime-config.js";

test("loads external configuration with safe network defaults", () => {
  const config = loadRuntimeConfig({ CACHE_MAX_BYTES: "1024" });
  assert.deepEqual(config, {
    cacheMaxBytes: 1024,
    host: "127.0.0.1",
    port: 3000
  });
});

test("accepts explicit network configuration", () => {
  const config = loadRuntimeConfig({
    CACHE_MAX_BYTES: "2048",
    HOST: "0.0.0.0",
    PORT: "8080"
  });
  assert.equal(config.cacheMaxBytes, 2048);
  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.port, 8080);
});

test("rejects missing or invalid configuration", () => {
  assert.throws(() => loadRuntimeConfig({}), /CACHE_MAX_BYTES/);
  assert.throws(
    () => loadRuntimeConfig({ CACHE_MAX_BYTES: "1024", PORT: "70000" }),
    /PORT/
  );
});
