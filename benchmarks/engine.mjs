// Engine benchmark (no HTTP): latency and throughput of CustomHashTable operations with Tinybench.
// Operations so far: get() on an existing and on an absent key, update() of an existing key with a value
// of the same size, delete() of an existing key, create() of a new key, on a table of 10,000 then
// 1,000,000 entries. delete() and create() change the table: each batch does 1,000 of them inside the
// timed section, then undoes them outside of it, so the table has the same content at the start of
// every batch. 1,000 creations never trigger a resize at these volumes (resize is measured in
// engine-structure.mjs).
// Each Tinybench sample is the mean latency of a batch of calls: a single get() lasts a few tens of
// nanoseconds, which is below the timer resolution, so timing one call at a time would give zeros.
// Percentiles are therefore percentiles of batch means, not of single operations.
// Usage: npm run bench:engine

import { Bench } from "tinybench";

import { BATCH_SIZE, VALUE, batched, buildTable, latencyRow, scatter } from "./engine-helpers.mjs";
import { saveResults } from "./save-results.mjs";

const VOLUMES = [10_000, 1_000_000];
const UPDATED_VALUE = "y".repeat(16);

async function measureVolume(volume) {
  const cache = buildTable(volume);
  const stats = cache.getStats();
  if (stats.entryCount !== volume) {
    throw new Error(`expected ${volume} entries, found ${stats.entryCount}`);
  }

  const existingKeys = Array.from({ length: volume }, (_, index) => `key:${index}`);
  const absentKeys = Array.from({ length: volume }, (_, index) => `absent:${index}`);
  const nextExisting = scatter(volume);
  const nextAbsent = scatter(volume);
  const nextUpdated = scatter(volume);
  const nextDeleted = scatter(volume);
  const nextCreated = scatter(volume);

  const bench = new Bench({
    time: 1000,
    warmupTime: 300,
    retainSamples: true
  });

  bench.add(
    "get existing key",
    batched(bench, () => {
      if (!cache.get(existingKeys[nextExisting()]).ok) {
        throw new Error("an existing key was not found");
      }
    })
  );
  bench.add(
    "get absent key",
    batched(bench, () => {
      if (cache.get(absentKeys[nextAbsent()]).ok) {
        throw new Error("an absent key was found");
      }
    })
  );
  bench.add(
    "update existing key (same size)",
    batched(bench, () => {
      if (!cache.update(existingKeys[nextUpdated()], UPDATED_VALUE).ok) {
        throw new Error("an existing key was not updated");
      }
    })
  );

  bench.add("delete existing key", () => {
    const callStart = bench.now();
    const keys = Array.from({ length: BATCH_SIZE }, () => existingKeys[nextDeleted()]);

    const deleteStart = bench.now();
    for (const key of keys) {
      if (!cache.delete(key).ok) {
        throw new Error("an existing key was not deleted");
      }
    }
    const deleteElapsed = bench.now() - deleteStart;

    for (const key of keys) {
      if (!cache.create(key, VALUE).ok) {
        throw new Error("a deleted key was not recreated");
      }
    }
    return {
      overriddenDuration: deleteElapsed / BATCH_SIZE,
      overriddenIterationCost: bench.now() - callStart
    };
  });

  bench.add("create new key", () => {
    const callStart = bench.now();
    const keys = Array.from({ length: BATCH_SIZE }, () => absentKeys[nextCreated()]);

    const createStart = bench.now();
    for (const key of keys) {
      if (!cache.create(key, VALUE).ok) {
        throw new Error("a new key was not created");
      }
    }
    const createElapsed = bench.now() - createStart;

    for (const key of keys) {
      if (!cache.delete(key).ok) {
        throw new Error("a created key was not deleted");
      }
    }
    return {
      overriddenDuration: createElapsed / BATCH_SIZE,
      overriddenIterationCost: bench.now() - callStart
    };
  });

  await bench.run();

  const finalStats = cache.getStats();
  if (finalStats.entryCount !== volume || finalStats.usedBytes !== stats.usedBytes) {
    throw new Error("the measured operations changed the table size");
  }

  return bench.tasks.map((task) => latencyRow(task, { volume }));
}

const rows = [];
for (const volume of VOLUMES) {
  console.log(`Measuring ${volume.toLocaleString("en-US")} entries...`);
  rows.push(...(await measureVolume(volume)));
}
saveResults(
  "engine",
  { volumes: VOLUMES, valueBytes: VALUE.length, batchSize: BATCH_SIZE, warmupMs: 300, measureMs: 1000 },
  rows
);