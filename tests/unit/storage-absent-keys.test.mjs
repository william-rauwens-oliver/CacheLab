// Unit: get, update and delete on absent keys report KEY_NOT_FOUND and change nothing
// (RM-007, RM-008, RM-010, SC-003).

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CustomHashTable } from "../../dist/engine/hash-table/custom-hash-table.js";

describe("Clés absentes (RM-007, RM-008, RM-010, SC-003)", () => {
  test("get on an absent key reports KEY_NOT_FOUND", () => {
    const cache = new CustomHashTable(1024);
    assert.deepEqual(cache.get("user:999"), {
      ok: false,
      error: "KEY_NOT_FOUND"
    });
  });

  test("update on an absent key reports KEY_NOT_FOUND and creates nothing", () => {
    const cache = new CustomHashTable(1024);
    const before = cache.getStats();

    assert.deepEqual(cache.update("user:999", "value"), {
      ok: false,
      error: "KEY_NOT_FOUND"
    });
    assert.deepEqual(cache.get("user:999"), {
      ok: false,
      error: "KEY_NOT_FOUND"
    });
    assert.deepEqual(cache.getStats(), before);
  });

  test("delete on an absent key reports KEY_NOT_FOUND and changes nothing", () => {
    const cache = new CustomHashTable(1024);
    cache.create("present", "value");
    const before = cache.getStats();

    assert.deepEqual(cache.delete("user:999"), {
      ok: false,
      error: "KEY_NOT_FOUND"
    });
    assert.deepEqual(cache.getStats(), before);
    assert.deepEqual(cache.get("present"), { ok: true, value: "value" });
  });

  test("deleting the same key twice reports KEY_NOT_FOUND the second time", () => {
    const cache = new CustomHashTable(1024);
    cache.create("once", "value");

    assert.deepEqual(cache.delete("once"), { ok: true });
    assert.deepEqual(cache.delete("once"), {
      ok: false,
      error: "KEY_NOT_FOUND"
    });
  });
});