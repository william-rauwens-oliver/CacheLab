import assert from "node:assert/strict";
import test from "node:test";

import {
  CustomHashTable,
  djb2
} from "../dist/engine/hash-table/custom-hash-table.js";

test("supports the CRUD lifecycle", () => {
  const cache = new CustomHashTable(1024);
  assert.deepEqual(cache.create("user:1", "Alice"), { ok: true });
  assert.deepEqual(cache.get("user:1"), { ok: true, value: "Alice" });
  assert.deepEqual(cache.update("user:1", "Alice Martin"), { ok: true });
  assert.deepEqual(cache.get("user:1"), { ok: true, value: "Alice Martin" });
  assert.deepEqual(cache.delete("user:1"), { ok: true });
  assert.deepEqual(cache.get("user:1"), { ok: false, error: "KEY_NOT_FOUND" });
});

test("refuses duplicate keys", () => {
  const cache = new CustomHashTable(1024);
  cache.create("key", "original");
  assert.deepEqual(cache.create("key", "replacement"), {
    ok: false,
    error: "KEY_ALREADY_EXISTS"
  });
  assert.deepEqual(cache.get("key"), { ok: true, value: "original" });
});

test("preserves colliding keys", () => {
  const cache = new CustomHashTable(1024);
  const keys = [];
  for (let index = 0; keys.length < 2; index += 1) {
    const candidate = `key-${index}`;
    if (keys.length === 0 || djb2(candidate) % 16 === djb2(keys[0]) % 16) {
      keys.push(candidate);
    }
  }

  cache.create(keys[0], "first");
  cache.create(keys[1], "second");
  assert.deepEqual(cache.get(keys[0]), { ok: true, value: "first" });
  assert.deepEqual(cache.get(keys[1]), { ok: true, value: "second" });
  assert.equal(cache.getStats().collisionCount, 1);
});

test("enforces UTF-8 capacity without corrupting data", () => {
  const cache = new CustomHashTable(5);
  assert.deepEqual(cache.create("é", "a"), { ok: true });
  assert.equal(cache.getStats().usedBytes, 3);
  assert.deepEqual(cache.update("é", "long"), {
    ok: false,
    error: "CAPACITY_EXCEEDED"
  });
  assert.deepEqual(cache.get("é"), { ok: true, value: "a" });
});

test("resizes on the thirteenth insertion", () => {
  const cache = new CustomHashTable(10000);
  for (let index = 0; index < 13; index += 1) {
    cache.create(`key-${index}`, `value-${index}`);
  }
  assert.equal(cache.getStats().bucketCount, 32);
  assert.equal(cache.getStats().resizeCount, 1);
  assert.deepEqual(cache.get("key-12"), { ok: true, value: "value-12" });
});

test("starts empty after a restart", () => {
  const runningCache = new CustomHashTable(1024);
  runningCache.create("temporary", "value");

  const restartedCache = new CustomHashTable(1024);
  assert.deepEqual(restartedCache.get("temporary"), {
    ok: false,
    error: "KEY_NOT_FOUND"
  });
  assert.equal(restartedCache.getStats().entryCount, 0);
});
