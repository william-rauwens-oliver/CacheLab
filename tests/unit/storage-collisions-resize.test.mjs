// Unit: collision chains (read, update, delete at every position), cumulative collisionCount,
// and the resize on the thirteenth insertion that keeps every entry and counter.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CustomHashTable,
  djb2
} from "../../dist/engine/hash-table/custom-hash-table.js";
import { sizeOfEntry, findCollidingKeys } from "../helpers/storage-helpers.mjs";

describe("Collisions et redimensionnement (SC règle « collisions »)", () => {
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

  for (const [position, victimIndex] of [
    ["head", 2],
    ["middle", 1],
    ["tail", 0]
  ]) {
    test(`deletes the ${position} of a collision chain and keeps the others`, () => {
      const cache = new CustomHashTable(1024);
      const keys = findCollidingKeys(3);
      keys.forEach((key, index) => cache.create(key, `value-${index}`));

      assert.deepEqual(cache.delete(keys[victimIndex]), { ok: true });

      assert.deepEqual(cache.get(keys[victimIndex]), {
        ok: false,
        error: "KEY_NOT_FOUND"
      });
      keys.forEach((key, index) => {
        if (index !== victimIndex) {
          assert.deepEqual(cache.get(key), { ok: true, value: `value-${index}` });
        }
      });
      assert.equal(cache.getStats().entryCount, 2);
    });
  }

  test("reads and updates entries anywhere in a collision chain", () => {
    const cache = new CustomHashTable(1024);
    const keys = findCollidingKeys(3);
    keys.forEach((key, index) => cache.create(key, `value-${index}`));

    for (const key of keys) {
      assert.deepEqual(cache.update(key, `updated-${key}`), { ok: true });
    }
    for (const key of keys) {
      assert.deepEqual(cache.get(key), { ok: true, value: `updated-${key}` });
    }
    assert.equal(cache.getStats().entryCount, 3);
  });

  test("collisionCount is cumulative and not decreased by a delete (architecture 11.2)", () => {
    const cache = new CustomHashTable(1024);
    const keys = findCollidingKeys(2);
    cache.create(keys[0], "first");
    cache.create(keys[1], "second");
    assert.equal(cache.getStats().collisionCount, 1);

    cache.delete(keys[1]);
    assert.equal(cache.getStats().collisionCount, 1);
  });

  test("does not resize before the thirteenth insertion", () => {
    const cache = new CustomHashTable(10000);
    for (let index = 0; index < 12; index += 1) {
      cache.create(`key-${index}`, `value-${index}`);
    }
    assert.equal(cache.getStats().bucketCount, 16);
    assert.equal(cache.getStats().resizeCount, 0);
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

  test("keeps every entry and the occupancy counters across a resize", () => {
    const cache = new CustomHashTable(10000);
    let expectedBytes = 0;
    for (let index = 0; index < 13; index += 1) {
      const key = `key-${index}`;
      const value = `value-${index}`;
      cache.create(key, value);
      expectedBytes += sizeOfEntry(key, value);
    }

    assert.equal(cache.getStats().resizeCount, 1);
    assert.equal(cache.getStats().entryCount, 13);
    assert.equal(cache.getStats().usedBytes, expectedBytes);
    for (let index = 0; index < 13; index += 1) {
      assert.deepEqual(cache.get(`key-${index}`), {
        ok: true,
        value: `value-${index}`
      });
    }
  });
});