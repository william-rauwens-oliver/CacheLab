// Unit: the in-memory repository delegates to the engine (architecture 5.9.1);
// getStats returns the engine statistics and follows its changes.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { InMemoryCacheRepository } from "../../dist/adapters/storage/in-memory-cache-repository.js";
import { CustomHashTable } from "../../dist/engine/hash-table/custom-hash-table.js";

describe("Adaptateur de stockage : délégation au moteur (architecture 5.9.1)", () => {
  test("getStats returns the statistics of the engine", () => {
    const engine = new CustomHashTable(1024);
    const repository = new InMemoryCacheRepository(engine);

    repository.create("user:1", "Alice");

    assert.deepEqual(repository.getStats(), engine.getStats());
    assert.equal(repository.getStats().entryCount, 1);
    assert.equal(repository.getStats().usedBytes, "user:1".length + "Alice".length);
  });

  test("getStats follows the engine after a change made through the engine itself", () => {
    const engine = new CustomHashTable(1024);
    const repository = new InMemoryCacheRepository(engine);

    engine.create("a", "1");

    assert.equal(repository.getStats().entryCount, 1);
  });
});
