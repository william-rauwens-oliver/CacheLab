// Unit: nominal CRUD on the engine (RM-004, RM-005, RM-009, SC-001), consistent entryCount
// and usedBytes through the lifecycle, empty value.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CustomHashTable } from "../../dist/engine/hash-table/custom-hash-table.js";
import { sizeOfEntry } from "../helpers/storage-helpers.mjs";

describe("CRUD nominal (RM-004, RM-005, RM-009, SC-001)", () => {
  test("supports the CRUD lifecycle", () => {
    const cache = new CustomHashTable(1024);
    assert.deepEqual(cache.create("user:1", "Alice"), { ok: true });
    assert.deepEqual(cache.get("user:1"), { ok: true, value: "Alice" });
    assert.deepEqual(cache.update("user:1", "Alice Martin"), { ok: true });
    assert.deepEqual(cache.get("user:1"), { ok: true, value: "Alice Martin" });
    assert.deepEqual(cache.delete("user:1"), { ok: true });
    assert.deepEqual(cache.get("user:1"), { ok: false, error: "KEY_NOT_FOUND" });
  });

  test("keeps entryCount and usedBytes consistent through the lifecycle", () => {
    const cache = new CustomHashTable(1024);

    cache.create("user:1", "Alice");
    assert.equal(cache.getStats().entryCount, 1);
    assert.equal(cache.getStats().usedBytes, sizeOfEntry("user:1", "Alice"));

    cache.update("user:1", "Alice Martin");
    assert.equal(cache.getStats().entryCount, 1);
    assert.equal(cache.getStats().usedBytes, sizeOfEntry("user:1", "Alice Martin"));

    cache.delete("user:1");
    assert.equal(cache.getStats().entryCount, 0);
    assert.equal(cache.getStats().usedBytes, 0);
  });

  test("accepts an empty value and keeps it readable", () => {
    const cache = new CustomHashTable(1024);
    assert.deepEqual(cache.create("empty", ""), { ok: true });
    assert.deepEqual(cache.get("empty"), { ok: true, value: "" });
    assert.equal(cache.getStats().usedBytes, sizeOfEntry("empty", ""));

    assert.deepEqual(cache.update("empty", "filled"), { ok: true });
    assert.deepEqual(cache.get("empty"), { ok: true, value: "filled" });

    assert.deepEqual(cache.update("empty", ""), { ok: true });
    assert.deepEqual(cache.get("empty"), { ok: true, value: "" });
    assert.equal(cache.getStats().usedBytes, sizeOfEntry("empty", ""));
  });
});