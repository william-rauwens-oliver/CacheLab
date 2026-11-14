// Unit: a refused operation (duplicate, absent key, capacity) changes neither data nor counters,
// can be repeated harmlessly, and never triggers a resize.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CustomHashTable } from "../../dist/engine/hash-table/custom-hash-table.js";
import { sizeOfEntry } from "../helpers/storage-helpers.mjs";

const CACHE_MAX_BYTES = 12;
const SEED = [
  ["a", "1"],
  ["b", "2"],
  ["c", "3"]
];

function seededCache() {
  const cache = new CustomHashTable(CACHE_MAX_BYTES);
  for (const [key, value] of SEED) {
    assert.deepEqual(cache.create(key, value), { ok: true });
  }
  return cache;
}

function assertSeedReadable(cache) {
  for (const [key, value] of SEED) {
    assert.deepEqual(cache.get(key), { ok: true, value });
  }
}

const refusals = [
  {
    name: "create of an existing key",
    run: (cache) => cache.create("a", "other"),
    error: "KEY_ALREADY_EXISTS"
  },
  {
    name: "create over the capacity",
    run: (cache) => cache.create("key", "value"),
    error: "CAPACITY_EXCEEDED"
  },
  {
    name: "update over the capacity",
    run: (cache) => cache.update("a", "0123456789"),
    error: "CAPACITY_EXCEEDED"
  },
  {
    name: "update of an absent key",
    run: (cache) => cache.update("missing", "value"),
    error: "KEY_NOT_FOUND"
  },
  {
    name: "delete of an absent key",
    run: (cache) => cache.delete("missing"),
    error: "KEY_NOT_FOUND"
  },
  {
    name: "get of an absent key",
    run: (cache) => cache.get("missing"),
    error: "KEY_NOT_FOUND"
  }
];

describe("Un refus ne modifie ni les données ni les compteurs", () => {
  for (const refusal of refusals) {
    test(`${refusal.name} is refused and leaves the state untouched`, () => {
      const cache = seededCache();
      const before = cache.getStats();

      assert.deepEqual(refusal.run(cache), { ok: false, error: refusal.error });

      assert.deepEqual(cache.getStats(), before);
      assertSeedReadable(cache);
    });

    test(`${refusal.name} stays harmless when repeated`, () => {
      const cache = seededCache();
      const before = cache.getStats();

      for (let attempt = 0; attempt < 5; attempt += 1) {
        assert.deepEqual(refusal.run(cache), { ok: false, error: refusal.error });
      }

      assert.deepEqual(cache.getStats(), before);
      assertSeedReadable(cache);
    });
  }
});

describe("Un refus ne déclenche jamais de redimensionnement", () => {
  const entries = Array.from({ length: 12 }, (_, index) => [
    `key-${index}`,
    `value-${index}`
  ]);

  test("a create refused for capacity on the 13th position does not resize", () => {
    const capacity = entries.reduce((sum, [key, value]) => sum + sizeOfEntry(key, value), 0);
    const cache = new CustomHashTable(capacity);
    for (const [key, value] of entries) {
      assert.deepEqual(cache.create(key, value), { ok: true });
    }
    const before = cache.getStats();

    assert.deepEqual(cache.create("key-12", "value-12"), {
      ok: false,
      error: "CAPACITY_EXCEEDED"
    });

    assert.deepEqual(cache.getStats(), before);
    assert.equal(cache.getStats().bucketCount, 16);
    assert.equal(cache.getStats().resizeCount, 0);
  });

  test("a duplicate create on the 13th position does not resize", () => {
    const cache = new CustomHashTable(10000);
    for (const [key, value] of entries) {
      cache.create(key, value);
    }
    const before = cache.getStats();

    assert.deepEqual(cache.create("key-0", "other"), {
      ok: false,
      error: "KEY_ALREADY_EXISTS"
    });

    assert.deepEqual(cache.getStats(), before);
    assert.equal(cache.getStats().resizeCount, 0);
  });
});