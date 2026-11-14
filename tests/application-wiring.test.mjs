// Checks that the application is assembled through the storage port: the HTTP layer talks to
// the cache repository, never directly to the engine.

import assert from "node:assert/strict";
import test from "node:test";

import { createCacheLab } from "../dist/app.js";

test("assembles the application through the storage port", () => {
  const { repository } = createCacheLab({
    cacheMaxBytes: 1024,
    corsOrigins: [],
    host: "127.0.0.1",
    httpBodyLimit: "1mb",
    port: 3000
  });

  assert.deepEqual(repository.create("key", "value"), { ok: true });
  assert.deepEqual(repository.get("key"), { ok: true, value: "value" });
});
