// Unit: correctness at volume. One million distinct entries go through every resize (16 to 2^21 buckets);
// none may be lost, counters must stay exact, and the load factor must stay within 0.75.
// Timings are only reported as diagnostics, never asserted.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CustomHashTable } from "../../dist/engine/hash-table/custom-hash-table.js";

const ENTRIES = 1_000_000;
const key = (index) => `key:${index}`;
const value = (index) => `value-${index}`;
const entryBytes = (index) => Buffer.byteLength(key(index)) + Buffer.byteLength(value(index));

function fill(cache) {
  let expectedBytes = 0;
  for (let index = 0; index < ENTRIES; index += 1) {
    const result = cache.create(key(index), value(index));
    if (!result.ok) {
      assert.fail(`create failed at ${index}: ${result.error}`);
    }
    expectedBytes += entryBytes(index);
  }
  return expectedBytes;
}

describe("Volume : un million d'entrées dans le moteur", () => {
  test("keeps every entry readable and the counters exact across all resizes", (context) => {
    const cache = new CustomHashTable(1024 * 1024 * 1024);

    const startCreate = process.hrtime.bigint();
    const expectedBytes = fill(cache);
    context.diagnostic(`create: ${Number(process.hrtime.bigint() - startCreate) / 1e6} ms`);

    const stats = cache.getStats();
    assert.equal(stats.entryCount, ENTRIES);
    assert.equal(stats.usedBytes, expectedBytes);
    assert.ok(stats.entryCount / stats.bucketCount <= 0.75);
    assert.equal(stats.bucketCount & (stats.bucketCount - 1), 0);
    assert.equal(stats.bucketCount, 2 ** (4 + stats.resizeCount));
    assert.ok(stats.collisionCount > 0);

    const startGet = process.hrtime.bigint();
    for (let index = 0; index < ENTRIES; index += 1) {
      const result = cache.get(key(index));
      if (!result.ok || result.value !== value(index)) {
        assert.fail(`entry ${index} lost or altered: ${JSON.stringify(result)}`);
      }
    }
    context.diagnostic(`get: ${Number(process.hrtime.bigint() - startGet) / 1e6} ms`);
    context.diagnostic(`stats: ${JSON.stringify(stats)}`);
  });

  test("deleting half of the entries leaves the other half intact and the counters exact", () => {
    const cache = new CustomHashTable(1024 * 1024 * 1024);
    let expectedBytes = fill(cache);

    for (let index = 0; index < ENTRIES; index += 2) {
      assert.deepEqual(cache.delete(key(index)), { ok: true });
      expectedBytes -= entryBytes(index);
    }

    const stats = cache.getStats();
    assert.equal(stats.entryCount, ENTRIES / 2);
    assert.equal(stats.usedBytes, expectedBytes);
    for (let index = 0; index < ENTRIES; index += 1) {
      const result = cache.get(key(index));
      if (index % 2 === 0) {
        assert.deepEqual(result, { ok: false, error: "KEY_NOT_FOUND" });
      } else if (!result.ok || result.value !== value(index)) {
        assert.fail(`entry ${index} lost or altered: ${JSON.stringify(result)}`);
      }
    }
  });
});
