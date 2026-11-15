// Unit: key uniqueness and independence (RM-001, RM-002, RM-003, SC-002): duplicates refused,
// counters untouched, no implicit normalization (case and spaces are significant).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CustomHashTable } from "../../dist/engine/hash-table/custom-hash-table.js";

describe("Unicité et indépendance des clés (RM-001, RM-002, RM-003, SC-002)", () => {
  test("refuses duplicate keys", () => {
    const cache = new CustomHashTable(1024);
    cache.create("key", "original");
    assert.deepEqual(cache.create("key", "replacement"), {
      ok: false,
      error: "KEY_ALREADY_EXISTS"
    });
    assert.deepEqual(cache.get("key"), { ok: true, value: "original" });
  });

  test("leaves every counter untouched when a duplicate is refused", () => {
    const cache = new CustomHashTable(1024);
    cache.create("key", "original");
    const before = cache.getStats();

    cache.create("key", "replacement");

    assert.deepEqual(cache.getStats(), before);
  });

  test("keeps keys independent from each other", () => {
    const cache = new CustomHashTable(1024);
    cache.create("a", "1");
    cache.create("b", "2");

    cache.update("a", "changed");
    assert.deepEqual(cache.get("b"), { ok: true, value: "2" });

    cache.delete("a");
    assert.deepEqual(cache.get("b"), { ok: true, value: "2" });
  });

  test("treats keys differing by case or surrounding spaces as distinct", () => {
    const cache = new CustomHashTable(1024);
    assert.deepEqual(cache.create("user", "plain"), { ok: true });
    assert.deepEqual(cache.create("User", "capitalized"), { ok: true });
    assert.deepEqual(cache.create(" user", "leading space"), { ok: true });
    assert.deepEqual(cache.create("user ", "trailing space"), { ok: true });

    assert.deepEqual(cache.get("user"), { ok: true, value: "plain" });
    assert.deepEqual(cache.get("User"), { ok: true, value: "capitalized" });
    assert.deepEqual(cache.get(" user"), { ok: true, value: "leading space" });
    assert.deepEqual(cache.get("user "), { ok: true, value: "trailing space" });
    assert.equal(cache.getStats().entryCount, 4);
  });
});