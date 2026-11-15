// Unit: logical capacity counted in UTF-8 bytes (RM-014, SC-005): refusals without mutation,
// exact fit, size difference on update, space freed by delete, no automatic eviction, invalid capacity.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CustomHashTable } from "../../dist/engine/hash-table/custom-hash-table.js";
import { sizeOfEntry } from "../helpers/storage-helpers.mjs";

describe("Capacité logique en octets UTF-8 (RM-014, SC-005)", () => {
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

  test("create over the limit is refused without any mutation", () => {
    const cache = new CustomHashTable(10);
    cache.create("key", "value");
    const before = cache.getStats();

    assert.deepEqual(cache.create("other", "value"), {
      ok: false,
      error: "CAPACITY_EXCEEDED"
    });

    assert.deepEqual(cache.getStats(), before);
    assert.deepEqual(cache.get("other"), {
      ok: false,
      error: "KEY_NOT_FOUND"
    });
    assert.deepEqual(cache.get("key"), { ok: true, value: "value" });
  });

  test("update over the limit leaves every counter untouched", () => {
    const cache = new CustomHashTable(8);
    cache.create("key", "old");
    const before = cache.getStats();

    assert.deepEqual(cache.update("key", "too-long"), {
      ok: false,
      error: "CAPACITY_EXCEEDED"
    });

    assert.deepEqual(cache.getStats(), before);
    assert.deepEqual(cache.get("key"), { ok: true, value: "old" });
  });

  test("accepts an entry that fills the capacity exactly and refuses one byte more", () => {
    const cache = new CustomHashTable(6);
    assert.deepEqual(cache.create("abc", "def"), { ok: true });
    assert.equal(cache.getStats().usedBytes, 6);

    assert.deepEqual(cache.update("abc", "defg"), {
      ok: false,
      error: "CAPACITY_EXCEEDED"
    });
    assert.deepEqual(cache.create("x", ""), {
      ok: false,
      error: "CAPACITY_EXCEEDED"
    });
    assert.equal(cache.getStats().usedBytes, 6);
  });

  test("update accounts for the size difference of the value", () => {
    const cache = new CustomHashTable(1024);
    cache.create("key", "long value");

    cache.update("key", "x");
    assert.equal(cache.getStats().usedBytes, sizeOfEntry("key", "x"));

    cache.update("key", "a-longer-value-than-before");
    assert.equal(
      cache.getStats().usedBytes,
      sizeOfEntry("key", "a-longer-value-than-before")
    );
  });

  test("frees capacity on delete and never evicts an entry on its own", () => {
    const cache = new CustomHashTable(6);
    cache.create("abc", "def");

    assert.deepEqual(cache.create("x", "y"), {
      ok: false,
      error: "CAPACITY_EXCEEDED"
    });
    assert.deepEqual(cache.get("abc"), { ok: true, value: "def" });

    assert.deepEqual(cache.delete("abc"), { ok: true });
    assert.equal(cache.getStats().usedBytes, 0);
    assert.deepEqual(cache.create("x", "y"), { ok: true });
  });

  test("rejects an invalid capacity at construction", () => {
    for (const invalid of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => new CustomHashTable(invalid), RangeError);
    }
  });
});